import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const locationSearchCache = new Map<string, { suggestions: unknown[]; expiresAt: number }>();

// Named localities (e.g. "Gulberg, Lahore") rarely move, so once resolved
// they're cached far longer than a free-text search - this is what lets the
// /areas batch endpoint avoid re-hitting Mapbox/Nominatim on every browser
// session that expands a city's area list.
const AREA_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const AREA_NEGATIVE_CACHE_TTL_MS = 5 * 60 * 1000;
const areaResolutionCache = new Map<
  string,
  { result: NormalizedLocationResult | null; expiresAt: number }
>();
const AREA_RESOLUTION_CONCURRENCY = 3;
const MAX_AREAS_PER_REQUEST = 40;

const locationSearchQuerySchema = z.object({
  q: z.string().trim().max(160).optional().default(''),
  city: z.string().trim().max(80).optional().default('')
});

const locationAreasQuerySchema = z.object({
  city: z.string().trim().min(1).max(80),
  areas: z
    .string()
    .trim()
    .min(1)
    .transform((value) =>
      value
        .split(',')
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0 && entry.length <= 80)
    )
    .refine((areas) => areas.length > 0 && areas.length <= MAX_AREAS_PER_REQUEST, {
      message: `areas must contain between 1 and ${MAX_AREAS_PER_REQUEST} entries`
    })
});

const locationReverseQuerySchema = z.object({
  latitude: z.coerce.number().min(-90).max(90),
  longitude: z.coerce.number().min(-180).max(180)
});

interface NominatimLocationResult {
  place_id?: number;
  display_name?: string;
  lat?: string;
  lon?: string;
  name?: string;
  address?: Record<string, string | undefined>;
  class?: string;
  type?: string;
}

// Normalized shape both providers (Mapbox and the Nominatim fallback) map
// into, so the rest of the app (nearby search, venue onboarding) never has
// to know which one actually answered the request.
interface NormalizedLocationResult {
  id: string;
  label: string;
  primaryLabel: string;
  secondaryLabel: string;
  latitude: number | null;
  longitude: number | null;
  locality?: string;
  city?: string;
  // False for a bare city/district/region/country-level match (e.g. Mapbox
  // falling back to "Faisalabad, Punjab, Pakistan" when it can't resolve a
  // specific street). Callers that need a precise point - like computing a
  // salon's distance from its stored address - must not treat a low-
  // precision match as if it were that exact location, or every salon whose
  // address the provider can't pin down collapses onto the same city-center
  // point and reports a bogus near-zero distance.
  isPreciseMatch: boolean;
}

interface MapboxFeature {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  context?: Array<{ id?: string; text?: string }>;
  place_type?: string[];
}

const MAPBOX_BROAD_PLACE_TYPES = new Set(['country', 'region', 'postcode', 'district', 'place']);

const isPreciseMapboxFeature = (feature: MapboxFeature): boolean => {
  const types = feature.place_type ?? [];
  return types.length > 0 && types.every((type) => !MAPBOX_BROAD_PLACE_TYPES.has(type));
};

const NOMINATIM_BROAD_PLACE_TYPES = new Set([
  'country',
  'state',
  'region',
  'province',
  'city',
  'town',
  'village',
  'municipality',
  'county',
  'administrative'
]);

const isPreciseNominatimResult = (result: NominatimLocationResult): boolean => {
  const isAdministrativeBoundary = result.class === 'boundary' || result.class === 'place';
  return !(isAdministrativeBoundary && NOMINATIM_BROAD_PLACE_TYPES.has(result.type ?? ''));
};

interface MapboxGeocodingResponse {
  features?: MapboxFeature[];
}

const isMapboxConfigured = (): boolean => Boolean(env.MAPBOX_ACCESS_TOKEN?.trim());

const getMapboxContextValue = (
  feature: MapboxFeature,
  prefixes: string[]
): string | undefined => {
  for (const entry of feature.context ?? []) {
    if (!entry.id || !entry.text) {
      continue;
    }

    if (prefixes.some((prefix) => entry.id!.startsWith(prefix))) {
      return entry.text.trim();
    }
  }

  return undefined;
};

const normalizeMapboxFeature = (feature: MapboxFeature): NormalizedLocationResult => {
  const [longitude, latitude] = feature.center ?? [];
  const label = feature.place_name?.trim() ?? '';
  const primaryLabel = feature.text?.trim() || label;
  const secondaryLabel = label.startsWith(primaryLabel)
    ? label.slice(primaryLabel.length).replace(/^,\s*/, '')
    : label;

  return {
    id: feature.id ?? label,
    label,
    primaryLabel: primaryLabel || label,
    secondaryLabel,
    latitude: typeof latitude === 'number' ? latitude : null,
    longitude: typeof longitude === 'number' ? longitude : null,
    locality: getMapboxContextValue(feature, ['locality.', 'neighborhood.']),
    city: getMapboxContextValue(feature, ['place.', 'district.']),
    isPreciseMatch: isPreciseMapboxFeature(feature)
  };
};

const fetchMapboxJson = async (path: string): Promise<MapboxGeocodingResponse> => {
  const token = env.MAPBOX_ACCESS_TOKEN?.trim();
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `https://api.mapbox.com/geocoding/v5/mapbox.places/${path}${separator}access_token=${encodeURIComponent(token ?? '')}`
  );

  if (!response.ok) {
    throw new Error(`Mapbox request failed with status ${response.status}`);
  }

  return (await response.json()) as MapboxGeocodingResponse;
};

const searchViaMapbox = async (query: string): Promise<NormalizedLocationResult[]> => {
  const params = new URLSearchParams({ autocomplete: 'true', limit: '8' });
  const countryCode = getLocationSearchCountryCode();

  if (countryCode) {
    params.set('country', countryCode);
  }

  const payload = await fetchMapboxJson(`${encodeURIComponent(query)}.json?${params.toString()}`);
  return (payload.features ?? []).map(normalizeMapboxFeature);
};

const reverseViaMapbox = async (
  latitude: number,
  longitude: number
): Promise<NormalizedLocationResult | null> => {
  const payload = await fetchMapboxJson(
    `${longitude},${latitude}.json?types=address,place`
  );
  const feature = payload.features?.[0];
  return feature ? normalizeMapboxFeature(feature) : null;
};

const getProviderBaseUrl = (): string =>
  env.LOCATION_SEARCH_PROVIDER_BASE_URL?.trim() || 'https://nominatim.openstreetmap.org';

const getLocationSearchCountryCode = (): string =>
  env.PUBLIC_LOCATION_SEARCH_COUNTRY_CODE?.trim().toLowerCase() ?? '';

const buildProviderHeaders = (): Record<string, string> => {
  const baseIdentity =
    env.PUBLIC_BASE_URL ||
    env.PUBLIC_SUPPORT_PLATFORM_NAME ||
    env.PUBLIC_SUPPORT_COMPANY_NAME ||
    'platform';

  return {
    Accept: 'application/json',
    'Accept-Language': 'en',
    'User-Agent': `${baseIdentity} geocoding`
  };
};

const getPrimaryLabel = (result: NominatimLocationResult): string => {
  const address = result.address ?? {};

  return (
    result.name?.trim() ||
    address.city?.trim() ||
    address.town?.trim() ||
    address.village?.trim() ||
    address.suburb?.trim() ||
    result.display_name?.split(',')[0]?.trim() ||
    ''
  );
};

const getSecondaryLabel = (result: NominatimLocationResult): string => {
  const displayName = result.display_name?.trim() ?? '';

  if (!displayName) {
    return '';
  }

  const [, ...parts] = displayName
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.join(', ');
};

const normalizeLocationResult = (result: NominatimLocationResult): NormalizedLocationResult => {
  const label = result.display_name?.trim() ?? '';
  const address = result.address ?? {};

  return {
    id: String(result.place_id ?? label),
    label,
    primaryLabel: getPrimaryLabel(result) || label,
    secondaryLabel: getSecondaryLabel(result),
    latitude: typeof result.lat === 'string' ? Number(result.lat) : null,
    longitude: typeof result.lon === 'string' ? Number(result.lon) : null,
    locality: address.suburb?.trim() || address.neighbourhood?.trim(),
    city: address.city?.trim() || address.town?.trim() || address.village?.trim(),
    isPreciseMatch: isPreciseNominatimResult(result)
  };
};

// Nominatim's usage policy caps unauthenticated use at 1 request/second
// platform-wide (not per-caller) - blow past that and their public server
// starts returning 429s to every request from this IP, geocoding and all,
// until the block lifts. A shared queue serializes every outbound call
// through this function so concurrent searches/reverse-lookups/area
// resolutions can never collectively exceed that rate, no matter how many
// requests arrive at once.
const NOMINATIM_MIN_INTERVAL_MS = 1100;
let nominatimQueue: Promise<void> = Promise.resolve();
let nominatimLastCallAt = 0;

const runNominatimThrottled = <T>(task: () => Promise<T>): Promise<T> => {
  const run = nominatimQueue.then(async () => {
    const waitMs = Math.max(0, NOMINATIM_MIN_INTERVAL_MS - (Date.now() - nominatimLastCallAt));

    if (waitMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }

    nominatimLastCallAt = Date.now();
    return task();
  });

  // Keep the queue moving even if this task throws, so one failed request
  // doesn't stall every request queued behind it.
  nominatimQueue = run.then(
    () => undefined,
    () => undefined
  );

  return run;
};

const fetchProviderJson = async <T>(path: string): Promise<T> =>
  runNominatimThrottled(async () => {
    const response = await fetch(`${getProviderBaseUrl()}${path}`, {
      headers: buildProviderHeaders()
    });

    if (!response.ok) {
      throw new Error(`Location provider request failed with status ${response.status}`);
    }

    return (await response.json()) as T;
  });

const searchViaNominatim = async (query: string, countryCode: string): Promise<NormalizedLocationResult[]> => {
  const params = new URLSearchParams({
    q: query,
    format: 'jsonv2',
    addressdetails: '1',
    limit: '8',
    dedupe: '1'
  });

  if (countryCode) {
    params.set('countrycodes', countryCode);
  }

  const payload = await fetchProviderJson<NominatimLocationResult[]>(`/search?${params.toString()}`);
  return payload.map(normalizeLocationResult);
};

const reverseViaNominatim = async (
  latitude: number,
  longitude: number
): Promise<NormalizedLocationResult> => {
  const params = new URLSearchParams({
    lat: String(latitude),
    lon: String(longitude),
    format: 'jsonv2',
    addressdetails: '1'
  });

  const payload = await fetchProviderJson<NominatimLocationResult>(`/reverse?${params.toString()}`);
  return normalizeLocationResult(payload);
};

const mapWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>
): Promise<R[]> => {
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  });

  await Promise.all(workers);
  return results;
};

const dedupeByLabel = (results: NormalizedLocationResult[]): NormalizedLocationResult[] => {
  const seenLabels = new Set<string>();

  return results.filter((entry) => {
    if (!entry.label) {
      return false;
    }

    const dedupeKey = entry.label.toLowerCase();

    if (seenLabels.has(dedupeKey)) {
      return false;
    }

    seenLabels.add(dedupeKey);
    return true;
  });
};

// Mapbox is the spec's preferred provider for addresses/places, but its
// POI/business coverage in Pakistan is effectively empty (e.g. a search for
// "kfc" returns zero features even scoped to a city) - it fails
// "successfully" with an empty array rather than throwing, so a
// catch()-only fallback never kicks in. Nominatim (OSM) does have real
// local POI data (KFC branches are tagged there), so both providers are
// queried and merged on every request instead of only falling back to
// Nominatim on a hard Mapbox error.
// A result only counts as "in" cityFilter when its own (structured) city
// field says so. Appending ", <city>" to the query text (see providerQuery
// in search() below) only biases the provider - it doesn't stop it from
// returning a same-named place in a different city, which is exactly the
// case a city-scoped search must exclude.
const isInCity = (result: NormalizedLocationResult, normalizedCityFilter: string): boolean => {
  const resultCity = result.city?.trim().toLowerCase() ?? '';

  if (resultCity) {
    // Trust the structured field over the full label: a result whose city
    // is clearly something else ("Gojra") must not pass just because the
    // filter text also happens to appear as a larger enclosing division
    // ("...Faisalabad Division") somewhere in its full address string.
    return resultCity === normalizedCityFilter || resultCity.includes(normalizedCityFilter);
  }

  // No structured city field to trust (context data gaps happen, especially
  // on Nominatim POIs) - fall back to scanning the full address string.
  return result.label.toLowerCase().includes(normalizedCityFilter);
};

// Mapbox is the spec's preferred provider for addresses/places, but its
// POI/business coverage in Pakistan is effectively empty (e.g. a search for
// "kfc" returns zero features even scoped to a city) - it fails
// "successfully" with an empty array rather than throwing, so a
// catch()-only fallback never kicks in. Nominatim (OSM) does have real
// local POI data (KFC branches are tagged there), so both providers are
// queried and merged on every request instead of only falling back to
// Nominatim on a hard Mapbox error.
const fetchMergedSuggestions = async (
  query: string,
  countryCode: string,
  cityFilter?: string
): Promise<NormalizedLocationResult[]> => {
  const [mapboxResults, nominatimResults] = await Promise.all([
    isMapboxConfigured() ? searchViaMapbox(query).catch(() => []) : Promise.resolve([]),
    searchViaNominatim(query, countryCode).catch(() => [])
  ]);

  // Precise (street/POI-level) matches first, regardless of which provider
  // found them - a bare city/district fallback from one provider must never
  // outrank a specific match the other provider has, or every caller that
  // blindly trusts suggestions[0] (e.g. the salon-distance lookup, or the
  // area resolver below) ends up treating "the whole city" as if it were
  // one exact point.
  const merged = dedupeByLabel(
    [...mapboxResults, ...nominatimResults].sort((a, b) =>
      a.isPreciseMatch === b.isPreciseMatch ? 0 : a.isPreciseMatch ? -1 : 1
    )
  );

  const normalizedCityFilter = cityFilter?.trim().toLowerCase();

  if (!normalizedCityFilter) {
    return merged;
  }

  // Strict on purpose, including the empty-array case: a selected city means
  // only that city's results, full stop - falling back to the unscoped list
  // when nothing matched used to leak other cities' places into the
  // dropdown (e.g. "Model City, Lodhran..." showing up while Faisalabad was
  // selected), which is worse than occasionally showing fewer results.
  return merged.filter((result) => isInCity(result, normalizedCityFilter));
};

const resolveBestMatch = async (
  query: string,
  countryCode: string,
  cityFilter?: string
): Promise<NormalizedLocationResult | null> => {
  const suggestions = await fetchMergedSuggestions(query, countryCode, cityFilter);
  return suggestions[0] ?? null;
};

export const locationController = {
  async search(_req: Request, res: Response): Promise<void> {
    const { q: query, city } = locationSearchQuerySchema.parse(_req.query);

    if (query.length < 2) {
      res.status(200).json({
        suggestions: [],
        countryCode: getLocationSearchCountryCode(),
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
      return;
    }

    // Bias the provider query toward the user's selected city, unless
    // they've already typed it themselves. The city must go BEFORE the
    // typed text, not after: Mapbox's autocomplete=true only prefix-matches
    // the last word of the query, so "<query>, <city>" makes it complete
    // the already-finished city name instead of the user's partial word -
    // e.g. typing "wa" under a Faisalabad filter became "wa, Faisalabad",
    // Mapbox autocompleted "Faisalabad" (nothing to complete) and returned
    // only the city itself, never "Wapda ...". "<city>, <query>" keeps the
    // partial word last so it's the one that actually gets autocompleted.
    const providerQuery =
      city && !query.toLowerCase().includes(city.toLowerCase()) ? `${city}, ${query}` : query;

    const countryCode = getLocationSearchCountryCode();
    const cacheKey = `geo:${countryCode}:${city.toLowerCase()}:${query.toLowerCase()}`;
    const cached = locationSearchCache.get(cacheKey);

    if (cached && Date.now() < cached.expiresAt) {
      res.status(200).json({
        suggestions: cached.suggestions,
        countryCode,
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
      return;
    }

    try {
      const suggestions = await fetchMergedSuggestions(providerQuery, countryCode, city);

      locationSearchCache.set(cacheKey, { suggestions, expiresAt: Date.now() + LOCATION_CACHE_TTL_MS });

      res.status(200).json({
        suggestions,
        countryCode,
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
    } catch (error) {
      logger.error('Location search failed', error);
      res.status(502).json({ error: 'Unable to search locations right now' });
    }
  },

  // Batch-resolves a fixed set of known localities (e.g. Lahore's "Gulberg",
  // "DHA", ...) for the city-area autocomplete step. Replaces what used to
  // be one /search call per area fired in parallel from the browser (up to
  // ~40 simultaneous upstream Mapbox+Nominatim requests for a single
  // keystroke) with one request that resolves them here with bounded
  // concurrency and a 30-day shared cache, since named localities don't
  // move - so beyond the first resolution platform-wide, this is served
  // entirely from cache.
  async areas(_req: Request, res: Response): Promise<void> {
    const { city, areas } = locationAreasQuerySchema.parse(_req.query);
    const countryCode = getLocationSearchCountryCode();

    try {
      const resolved = await mapWithConcurrency(areas, AREA_RESOLUTION_CONCURRENCY, async (area) => {
        const cacheKey = `area:${countryCode}:${city.toLowerCase()}:${area.toLowerCase()}`;
        const cached = areaResolutionCache.get(cacheKey);
        const isCacheFresh = Boolean(cached) && Date.now() < cached!.expiresAt;

        // City first, area last - matches the same ordering fix in search()
        // below: Mapbox's autocomplete only prefix-completes the last word,
        // and city-first also keeps this consistent with how the main
        // search box biases its queries, so an area and its equivalent
        // free-text search resolve to the same place.
        const match = isCacheFresh
          ? cached!.result
          : await resolveBestMatch(`${city}, ${area}`, countryCode, city).catch(() => null);

        if (!isCacheFresh) {
          // A miss can mean "this area genuinely isn't in either provider"
          // or "Nominatim/Mapbox hiccuped (rate limit, timeout) just now" -
          // those aren't distinguishable here, so a null match only gets a
          // short TTL. Caching it for the full 30 days would let one
          // transient failure permanently "poison" that area platform-wide
          // until a server restart.
          const ttlMs = match ? AREA_CACHE_TTL_MS : AREA_NEGATIVE_CACHE_TTL_MS;
          areaResolutionCache.set(cacheKey, { result: match, expiresAt: Date.now() + ttlMs });
        }

        return {
          name: area,
          id: match?.id ?? null,
          secondaryLabel: match?.secondaryLabel ?? null,
          latitude: match?.latitude ?? null,
          longitude: match?.longitude ?? null
        };
      });

      res.status(200).json({ areas: resolved });
    } catch (error) {
      logger.error('Location area batch resolution failed', error);
      res.status(502).json({ error: 'Unable to resolve area suggestions right now' });
    }
  },

  async reverse(_req: Request, res: Response): Promise<void> {
    const { latitude, longitude } = locationReverseQuerySchema.parse(_req.query);

    try {
      const location = isMapboxConfigured()
        ? (await reverseViaMapbox(latitude, longitude).catch(() => null)) ??
          (await reverseViaNominatim(latitude, longitude))
        : await reverseViaNominatim(latitude, longitude);

      res.status(200).json({
        location,
        countryCode: getLocationSearchCountryCode(),
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
    } catch (error) {
      logger.error('Location reverse lookup failed', error);
      res.status(502).json({ error: 'Unable to detect the current location right now' });
    }
  }
};

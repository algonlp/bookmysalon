import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

const LOCATION_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const locationSearchCache = new Map<string, { suggestions: unknown[]; expiresAt: number }>();

const locationSearchQuerySchema = z.object({
  q: z.string().trim().max(160).optional().default('')
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
}

interface MapboxFeature {
  id?: string;
  place_name?: string;
  text?: string;
  center?: [number, number];
  context?: Array<{ id?: string; text?: string }>;
}

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
    city: getMapboxContextValue(feature, ['place.', 'district.'])
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
    city: address.city?.trim() || address.town?.trim() || address.village?.trim()
  };
};

const fetchProviderJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(`${getProviderBaseUrl()}${path}`, {
    headers: buildProviderHeaders()
  });

  if (!response.ok) {
    throw new Error(`Location provider request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
};

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

export const locationController = {
  async search(_req: Request, res: Response): Promise<void> {
    const query = locationSearchQuerySchema.parse(_req.query).q;

    if (query.length < 2) {
      res.status(200).json({
        suggestions: [],
        countryCode: getLocationSearchCountryCode(),
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
      return;
    }

    const countryCode = getLocationSearchCountryCode();
    const cacheKey = `${isMapboxConfigured() ? 'mapbox' : 'nominatim'}:${countryCode}:${query.toLowerCase()}`;
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
      // Mapbox is the spec's preferred provider, but a booking/onboarding
      // flow must never fail just because it is unavailable - fall back to
      // the Nominatim provider (already free/keyless) on any Mapbox error.
      const rawResults = isMapboxConfigured()
        ? await searchViaMapbox(query).catch(() => searchViaNominatim(query, countryCode))
        : await searchViaNominatim(query, countryCode);
      const suggestions = dedupeByLabel(rawResults);

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

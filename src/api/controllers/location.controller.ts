import type { Request, Response } from 'express';
import { z } from 'zod';
import { env } from '../../config/env';
import { logger } from '../../shared/logger';

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

const normalizeLocationResult = (result: NominatimLocationResult) => {
  const label = result.display_name?.trim() ?? '';

  return {
    id: String(result.place_id ?? label),
    label,
    primaryLabel: getPrimaryLabel(result) || label,
    secondaryLabel: getSecondaryLabel(result),
    latitude: typeof result.lat === 'string' ? Number(result.lat) : null,
    longitude: typeof result.lon === 'string' ? Number(result.lon) : null
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

    const params = new URLSearchParams({
      q: query,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '8',
      dedupe: '1'
    });

    const countryCode = getLocationSearchCountryCode();

    if (countryCode) {
      params.set('countrycodes', countryCode);
    }

    try {
      const payload = await fetchProviderJson<NominatimLocationResult[]>(
        `/search?${params.toString()}`
      );
      const seenLabels = new Set<string>();
      const suggestions = payload
        .map(normalizeLocationResult)
        .filter((entry) => entry.label.length > 0)
        .filter((entry) => {
          const dedupeKey = entry.label.toLowerCase();

          if (seenLabels.has(dedupeKey)) {
            return false;
          }

          seenLabels.add(dedupeKey);
          return true;
        });

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
    const params = new URLSearchParams({
      lat: String(latitude),
      lon: String(longitude),
      format: 'jsonv2',
      addressdetails: '1'
    });

    try {
      const payload = await fetchProviderJson<NominatimLocationResult>(
        `/reverse?${params.toString()}`
      );

      res.status(200).json({
        location: normalizeLocationResult(payload),
        countryCode: getLocationSearchCountryCode(),
        countryLabel: env.PUBLIC_LOCATION_SEARCH_COUNTRY_LABEL?.trim() ?? ''
      });
    } catch (error) {
      logger.error('Location reverse lookup failed', error);
      res.status(502).json({ error: 'Unable to detect the current location right now' });
    }
  }
};

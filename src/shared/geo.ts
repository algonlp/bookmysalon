const EARTH_RADIUS_KM = 6371;

// Great-circle distance between two lat/lng points, in kilometers.
export const haversineDistanceKm = (
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number }
): number => {
  const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
  const latDelta = toRadians(to.latitude - from.latitude);
  const lonDelta = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(latDelta / 2) ** 2 + Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;

  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

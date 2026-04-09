export const serviceLocationValues = ['physical', 'mobile', 'virtual'] as const;

export type ServiceLocation = (typeof serviceLocationValues)[number];

export const defaultServiceLocation: ServiceLocation = serviceLocationValues[0];
export const addressRequiredServiceLocation: ServiceLocation = 'mobile';

export const defaultBookingLocationLabels: Record<ServiceLocation, string> = {
  physical: 'Visit the salon',
  mobile: 'Barber comes to my home',
  virtual: 'Online service'
};

export const defaultBookingLocationLabel = 'Service location';
export const defaultBookingAddressLabel = 'Home address';
export const defaultBookingAddressPlaceholder = 'Enter your home address';
export const defaultBookingAddressHelp =
  'Add the address where you want to receive the service.';
export const defaultBookingAddressRequiredMessage =
  'Home address is required when you choose at-home service.';

export const normalizeServiceLocations = (value: unknown): ServiceLocation[] => {
  const rawValues = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];

  return rawValues.filter(
    (item): item is ServiceLocation =>
      typeof item === 'string' && serviceLocationValues.includes(item as ServiceLocation)
  );
};

export const getDefaultBookingServiceLocation = (
  serviceLocations: ServiceLocation[]
): ServiceLocation =>
  serviceLocations.includes(defaultServiceLocation)
    ? defaultServiceLocation
    : serviceLocations[0] ?? defaultServiceLocation;

export const serviceLocationRequiresAddress = (serviceLocation: string): boolean =>
  serviceLocation === addressRequiredServiceLocation;

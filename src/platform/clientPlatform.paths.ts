export const platformClientPagePaths = {
  signup: '/signup',
  calendar: '/calendar',
  onboarding: {
    businessName: '/onboarding/business-name',
    serviceTypes: '/onboarding/service-types',
    accountType: '/onboarding/account-type',
    serviceLocation: '/onboarding/service-location',
    venueLocation: '/onboarding/venue-location',
    launchLinks: '/onboarding/launch-links',
    language: '/onboarding/language',
    complete: '/onboarding/complete'
  }
} as const;

export const platformClientAuthMessages = {
  accountExists: 'Account already exists. Please log in.',
  accountNotFound: 'No account found. Continue with sign up.'
} as const;

export const buildPlatformClientPagePath = (path: string, clientId?: string): string =>
  clientId
    ? `${path}?clientId=${encodeURIComponent(clientId)}`
    : path;

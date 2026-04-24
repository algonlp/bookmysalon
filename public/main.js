const CLIENT_STORAGE_KEY = 'qr-platform-client-id';
const NOTIFICATION_READ_STORAGE_KEY = 'qr-platform-read-notifications';
const REPORTS_WORKSPACE_STORAGE_KEY = 'qr-platform-reports-workspace';
const DASHBOARD_NOTIFICATION_REFRESH_INTERVAL_MS = 30000;
const DEFAULT_PHONE_PLACEHOLDER = '+1234567890';
const DEFAULT_BOOKING_PHONE_PLACEHOLDER = 'Enter phone number';
const DEFAULT_BOOKING_PHONE_LABEL = 'Phone number';
const DEFAULT_BOOKING_PHONE_HELP = 'You and the business will receive SMS updates on this number.';
const DEFAULT_PHONE_COUNTRY_CODE_LABEL = 'Country code';
const DEFAULT_BUSINESS_PHONE_LABEL = 'Business phone number';
const DEFAULT_DASHBOARD_UI_COPY = {
  locale: 'en-GB',
  bookingSourceLabels: {
    qr: 'QR',
    direct: 'Direct',
    instagram: 'Instagram',
    facebook: 'Facebook',
    applemaps: 'Apple Maps'
  },
  appointmentStatusLabels: {
    booked: 'BOOKED',
    completed: 'COMPLETED',
    cancelled: 'CANCELLED'
  },
  bookedAppointmentActionLabels: {
    edit: 'Edit',
    runningLate: 'Running late',
    complete: 'Complete',
    cancel: 'Cancel'
  },
  calendar: {
    today: 'Today',
    day: 'Day',
    agenda: 'Agenda',
    dateTimeConnector: 'at',
    bookingSourceTemplate: '{source} booking',
    add: 'Add',
    addMenuAria: 'Add menu',
    bookAppointment: 'Book appointment',
    showQrCode: 'Show QR code',
    groupAppointment: 'Group appointment',
    blockedTime: 'Blocked time',
    sale: 'Sale',
    quickPayment: 'Quick payment',
    onlineBookingsTitle: 'Online bookings',
    onlineBookingsDescription:
      'Appointments booked through your public salon links, social links, and QR code.',
    bookingLinkLabel: 'Open booking page',
    filterAll: 'All',
    filterBooked: 'Booked',
    filterQr: 'QR source',
    overviewSelectedDayLabel: 'Selected day',
    overviewSelectedDayMeta: 'appointments on this date',
    overviewComingAppointmentLabel: 'Coming appointment',
    overviewComingAppointmentMeta: 'currently active appointments',
    overviewNextClientLabel: 'Next client',
    overviewNextClientMeta: 'upcoming on the selected day',
    overviewNextClientEmpty: 'No bookings yet',
    appointmentsEmptyTitle: 'No bookings yet',
    appointmentsEmptyDescription:
      'Share your booking page, social links, or QR code to start collecting appointments.',
    qrEyebrow: 'Share booking QR',
    qrTitle: 'Scan to book',
    qrDescription:
      'Place this QR code on your salon door so clients can scan and book instantly.',
    qrPrint: 'Print QR code'
  },
  reports: {
    allFolders: 'All folders',
    rangeToday: 'Today',
    range7Days: '7 days',
    range30Days: '30 days',
    range90Days: '90 days',
    lastDaysTemplate: 'Last {days} days',
    exportCsv: 'Export CSV',
    print: 'Print',
    newCustomReport: 'New custom report',
    revenue: 'Revenue',
    appointments: 'Appointments',
    completed: 'Completed',
    clients: 'Clients',
    bookedInRangeTemplate: '{count} booked in range',
    completionFlowTemplate: '{label} completion flow',
    repeatClientsTeamTemplate: '{repeat} repeat â€¢ {team} team'
  }
};
let currentDashboardUiCopy = DEFAULT_DASHBOARD_UI_COPY;
const DEFAULT_CALENDAR_TIME_SLOTS = ['09:00', '10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00'];
const DEFAULT_BUSINESS_SETTINGS = {
  currencyCode: 'USD',
  currencyLocale: 'en-US',
  slotTimes: DEFAULT_CALENDAR_TIME_SLOTS,
  useServiceTemplates: true,
  reportMetadata: {
    pageTitle: 'Reporting and analytics',
    pageSubtitle: 'Access all of your business reports in one workspace.'
  }
};
let currentBusinessSettings = DEFAULT_BUSINESS_SETTINGS;
const BOOKED_APPOINTMENT_ACTIONS = [
  { key: 'edit', labelKey: 'edit', fallbackLabel: 'Edit', handlerKey: 'onEdit' },
  { key: 'runningLate', labelKey: 'runningLate', fallbackLabel: 'Running late', handlerKey: 'onRunningLate' },
  { key: 'complete', labelKey: 'complete', fallbackLabel: 'Complete', handlerKey: 'onComplete' },
  { key: 'cancel', labelKey: 'cancel', fallbackLabel: 'Cancel', handlerKey: 'onCancel', danger: true }
];
const PAYMENT_METHOD_OPTIONS = [
  { value: 'cash', label: 'Cash' },
  { value: 'card', label: 'Card' },
  { value: 'bank_transfer', label: 'Bank transfer' },
  { value: 'wallet', label: 'Wallet' },
  { value: 'other', label: 'Other' }
];
const PAYMENT_METHOD_LABELS = Object.fromEntries(
  PAYMENT_METHOD_OPTIONS.map((option) => [option.value, option.label])
);
const TEAM_MEMBER_WEEKDAY_IDS = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday'
];
const BOOKING_SOURCE_VALUES = ['qr', 'direct', 'instagram', 'facebook', 'applemaps'];

const getDashboardUiCopy = () => currentDashboardUiCopy;

const setDashboardUiCopy = (value) => {
  if (value && typeof value === 'object') {
    currentDashboardUiCopy = value;
    return;
  }

  currentDashboardUiCopy = DEFAULT_DASHBOARD_UI_COPY;
};

const normalizeBookingSource = (sourceValue) => {
  if (typeof sourceValue !== 'string') {
    return 'direct';
  }

  const normalizedValue = sourceValue.trim().toLowerCase();

  return BOOKING_SOURCE_VALUES.includes(normalizedValue)
    ? normalizedValue
    : 'direct';
};

const formatBookingSourceLabel = (sourceValue) =>
  getDashboardUiCopy().bookingSourceLabels?.[normalizeBookingSource(sourceValue)] ??
  DEFAULT_DASHBOARD_UI_COPY.bookingSourceLabels.direct;

const buildTrackedBookingPath = (clientId, sourceValue) => {
  const normalizedSource = normalizeBookingSource(sourceValue);
  return `/book/${encodeURIComponent(clientId)}?source=${encodeURIComponent(normalizedSource)}`;
};

const formatTimeForDisplay = (timeValue) => {
  if (typeof timeValue !== 'string') {
    return '';
  }

  const match = timeValue.match(/^(\d{2}):(\d{2})$/);

  if (!match) {
    return timeValue;
  }

  const hour = Number(match[1]);
  const minutes = match[2];
  const locale = getDashboardUiCopy().locale || 'en-GB';
  const date = new Date(`2026-01-01T${String(hour).padStart(2, '0')}:${minutes}:00`);

  return new Intl.DateTimeFormat(locale, {
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
};

const formatDateForDisplay = (dateValue) => {
  if (typeof dateValue !== 'string' || !dateValue) {
    return '';
  }

  const parsedDate = new Date(`${dateValue}T00:00:00`);

  if (Number.isNaN(parsedDate.getTime())) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(getDashboardUiCopy().locale || 'en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  }).format(parsedDate);
};

const formatDateTimeForDisplay = (dateValue, timeValue) => {
  const formattedDate = formatDateForDisplay(dateValue);
  const formattedTime = formatTimeForDisplay(timeValue);

  if (formattedDate && formattedTime) {
    const connector =
      getDashboardUiCopy().calendar?.dateTimeConnector ??
      DEFAULT_DASHBOARD_UI_COPY.calendar.dateTimeConnector;

    return connector ? `${formattedDate} ${connector} ${formattedTime}` : `${formattedDate} ${formattedTime}`;
  }

  return formattedDate || formattedTime;
};

const getWeekdayDisplayOptions = () => {
  const formatter = new Intl.DateTimeFormat(undefined, { weekday: 'long' });
  const sundayReferenceDate = new Date('2026-01-04T00:00:00');

  return TEAM_MEMBER_WEEKDAY_IDS.map((weekdayId, index) => {
    const date = new Date(sundayReferenceDate);
    date.setDate(sundayReferenceDate.getDate() + index);
    return {
      value: weekdayId,
      label: formatter.format(date)
    };
  });
};

const addMinutesToTimeValue = (timeValue, minutesToAdd) => {
  if (typeof timeValue !== 'string' || !/^\d{2}:\d{2}$/.test(timeValue)) {
    return timeValue;
  }

  const [hoursValue, minutesValue] = timeValue.split(':');
  const totalMinutes = Number(hoursValue) * 60 + Number(minutesValue) + minutesToAdd;
  const normalizedMinutes = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalizedMinutes / 60);
  const minutes = normalizedMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const getAppointmentStatusMeta = (statusValue) =>
  ({
    booked: {
      badgeClass: 'is-booked',
      label:
        getDashboardUiCopy().appointmentStatusLabels?.booked ??
        DEFAULT_DASHBOARD_UI_COPY.appointmentStatusLabels.booked
    },
    completed: {
      badgeClass: 'is-completed',
      label:
        getDashboardUiCopy().appointmentStatusLabels?.completed ??
        DEFAULT_DASHBOARD_UI_COPY.appointmentStatusLabels.completed
    },
    cancelled: {
      badgeClass: 'is-cancelled',
      label:
        getDashboardUiCopy().appointmentStatusLabels?.cancelled ??
        DEFAULT_DASHBOARD_UI_COPY.appointmentStatusLabels.cancelled
    }
  }[statusValue] ?? {
    badgeClass: 'is-booked',
    label: getDashboardUiCopy().appointmentStatusLabels?.booked ?? DEFAULT_DASHBOARD_UI_COPY.appointmentStatusLabels.booked
  });

const getAppointmentServiceSummary = (appointment) =>
  appointment.teamMemberName
    ? `${appointment.serviceName} with ${appointment.teamMemberName}`
    : appointment.serviceName;

const formatPaymentMethodLabel = (methodValue) =>
  PAYMENT_METHOD_LABELS[typeof methodValue === 'string' ? methodValue.trim() : ''] ?? 'Other';

const formatDateForApi = (date) => date.toISOString().slice(0, 10);

const normalizeBusinessSettings = (value) => {
  const slotPattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const slotTimes = Array.isArray(value?.slotTimes)
    ? [...new Set(
        value.slotTimes
          .map((slotTime) => (typeof slotTime === 'string' ? slotTime.trim() : ''))
          .filter((slotTime) => slotPattern.test(slotTime))
      )].sort()
    : [];

  return {
    currencyCode:
      typeof value?.currencyCode === 'string' && /^[a-z]{3}$/i.test(value.currencyCode.trim())
        ? value.currencyCode.trim().toUpperCase()
        : DEFAULT_BUSINESS_SETTINGS.currencyCode,
    currencyLocale:
      typeof value?.currencyLocale === 'string' && value.currencyLocale.trim()
        ? value.currencyLocale.trim()
        : DEFAULT_BUSINESS_SETTINGS.currencyLocale,
    slotTimes: slotTimes.length > 0 ? slotTimes : [...DEFAULT_BUSINESS_SETTINGS.slotTimes],
    useServiceTemplates:
      typeof value?.useServiceTemplates === 'boolean'
        ? value.useServiceTemplates
        : DEFAULT_BUSINESS_SETTINGS.useServiceTemplates,
    reportMetadata: {
      pageTitle:
        typeof value?.reportMetadata?.pageTitle === 'string' && value.reportMetadata.pageTitle.trim()
          ? value.reportMetadata.pageTitle.trim()
          : DEFAULT_BUSINESS_SETTINGS.reportMetadata.pageTitle,
      pageSubtitle:
        typeof value?.reportMetadata?.pageSubtitle === 'string' &&
        value.reportMetadata.pageSubtitle.trim()
          ? value.reportMetadata.pageSubtitle.trim()
          : DEFAULT_BUSINESS_SETTINGS.reportMetadata.pageSubtitle
    }
  };
};

const getActiveBusinessSettings = () => normalizeBusinessSettings(currentBusinessSettings);
const getActiveCalendarTimeSlots = () => getActiveBusinessSettings().slotTimes;

const formatCurrencyExampleLabel = (amount) => {
  const settings = getActiveBusinessSettings();

  return new Intl.NumberFormat(settings.currencyLocale, {
    style: 'currency',
    currency: settings.currencyCode,
    maximumFractionDigits: 0
  }).format(amount);
};

const normalizePhoneForLookup = (phoneValue) =>
  typeof phoneValue === 'string' ? phoneValue.replace(/[^\d]/g, '').trim() : '';

const normalizePhoneCountryCode = (phoneValue) => {
  if (typeof phoneValue !== 'string') {
    return '';
  }

  const normalizedValue = phoneValue.trim().replace(/\s+/g, '');

  if (!normalizedValue) {
    return '';
  }

  const digitsOnlyValue = normalizedValue.replace(/[^\d+]/g, '');

  if (!digitsOnlyValue) {
    return '';
  }

  return digitsOnlyValue.startsWith('+') ? digitsOnlyValue : `+${digitsOnlyValue.replace(/^\+/, '')}`;
};

const splitPhoneNumberParts = (phoneValue, defaultCountryCode = '') => {
  const normalizedPhoneValue =
    typeof phoneValue === 'string' ? phoneValue.trim().replace(/\s+/g, ' ') : '';
  const normalizedDefaultCountryCode = normalizePhoneCountryCode(defaultCountryCode);

  if (!normalizedPhoneValue) {
    return {
      countryCode: normalizedDefaultCountryCode,
      number: ''
    };
  }

  const compactPhoneValue = normalizedPhoneValue.replace(/\s+/g, '');

  if (
    normalizedDefaultCountryCode &&
    compactPhoneValue.startsWith(normalizedDefaultCountryCode)
  ) {
    return {
      countryCode: normalizedDefaultCountryCode,
      number: compactPhoneValue.slice(normalizedDefaultCountryCode.length)
    };
  }

  const phoneMatch = compactPhoneValue.match(/^(\+\d{1,4})(\d.*)?$/);

  if (phoneMatch) {
    return {
      countryCode: phoneMatch[1],
      number: phoneMatch[2] ?? ''
    };
  }

  return {
    countryCode: normalizedDefaultCountryCode,
    number: normalizedPhoneValue
  };
};

const serviceInput = document.querySelector('#service-query');
const cityInput = document.querySelector('#city-query');
const timeInput = document.querySelector('#time-query');
const searchPanel = document.querySelector('#search-panel');
const menuToggle = document.querySelector('#menu-toggle');
const siteMenu = document.querySelector('#site-menu');
const businessTypesToggle = document.querySelector('#business-types-toggle');
const businessTypesMenu = document.querySelector('#business-types-menu');

const getQueryClientId = () => new URLSearchParams(window.location.search).get('clientId');
const getSetupAction = () => new URLSearchParams(window.location.search).get('setup');

const syncClientIdFromQuery = () => {
  const queryClientId = getQueryClientId();

  if (queryClientId) {
    window.localStorage.setItem(CLIENT_STORAGE_KEY, queryClientId);
  }

  return queryClientId;
};

const getStoredClientId = () => window.localStorage.getItem(CLIENT_STORAGE_KEY);

const getClientId = () => syncClientIdFromQuery() || getStoredClientId();

const setAdminSession = (clientId) => {
  if (typeof clientId === 'string' && clientId) {
    window.localStorage.setItem(CLIENT_STORAGE_KEY, clientId);
  }
};

const getReadNotificationIds = (clientId) => {
  if (!clientId) {
    return new Set();
  }

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    const clientNotificationIds = Array.isArray(parsedValue?.[clientId]) ? parsedValue[clientId] : [];
    return new Set(clientNotificationIds.filter((value) => typeof value === 'string' && value));
  } catch (_error) {
    return new Set();
  }
};

const setReadNotificationIds = (clientId, notificationIds) => {
  if (!clientId) {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(NOTIFICATION_READ_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    parsedValue[clientId] = [...notificationIds];
    window.localStorage.setItem(NOTIFICATION_READ_STORAGE_KEY, JSON.stringify(parsedValue));
  } catch (_error) {
    window.localStorage.setItem(
      NOTIFICATION_READ_STORAGE_KEY,
      JSON.stringify({ [clientId]: [...notificationIds] })
    );
  }
};

const getReportsWorkspaceState = (clientId) => {
  if (!clientId) {
    return {
      favourites: [],
      customReports: [],
      folders: []
    };
  }

  try {
    const rawValue = window.localStorage.getItem(REPORTS_WORKSPACE_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    const clientValue = parsedValue?.[clientId] ?? {};

    return {
      favourites: Array.isArray(clientValue.favourites) ? clientValue.favourites : [],
      customReports: Array.isArray(clientValue.customReports) ? clientValue.customReports : [],
      folders: Array.isArray(clientValue.folders) ? clientValue.folders : []
    };
  } catch (_error) {
    return {
      favourites: [],
      customReports: [],
      folders: []
    };
  }
};

const setReportsWorkspaceState = (clientId, value) => {
  if (!clientId) {
    return;
  }

  try {
    const rawValue = window.localStorage.getItem(REPORTS_WORKSPACE_STORAGE_KEY);
    const parsedValue = rawValue ? JSON.parse(rawValue) : {};
    parsedValue[clientId] = value;
    window.localStorage.setItem(REPORTS_WORKSPACE_STORAGE_KEY, JSON.stringify(parsedValue));
  } catch (_error) {
    window.localStorage.setItem(
      REPORTS_WORKSPACE_STORAGE_KEY,
      JSON.stringify({ [clientId]: value })
    );
  }
};

const clearAdminSession = () => {
  window.localStorage.removeItem(CLIENT_STORAGE_KEY);
};

const normalizeExternalUrl = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmedValue = value.trim();

  if (!trimmedValue) {
    return '';
  }

  return /^https?:\/\//i.test(trimmedValue) ? trimmedValue : `https://${trimmedValue}`;
};

const logoutAdminSession = async (clientId) => {
  if (!clientId) {
    clearAdminSession();
    window.location.assign('/login');
    return;
  }

  const payload = await apiRequest(`/api/platform/clients/${clientId}/logout`, {
    method: 'POST'
  });

  clearAdminSession();
  window.location.assign(payload?.nextStep || '/login');
};

const buildPathWithClientId = (path, clientId) => {
  if (!clientId) {
    return path;
  }

  return `${path}?clientId=${encodeURIComponent(clientId)}`;
};

const redirectTo = (path, clientId) => {
  window.location.assign(buildPathWithClientId(path, clientId));
};

const requireClientId = () => {
  const clientId = getClientId();

  if (!clientId) {
    redirectTo('/signup');
    return null;
  }

  return clientId;
};

const apiRequest = async (path, options = {}) => {
  const response = await fetch(path, {
    credentials: 'include',
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    }
  });

  const responseType = response.headers.get('content-type') ?? '';
  const payload = responseType.includes('application/json') ? await response.json() : null;

  if (response.status === 403 && path.startsWith('/api/platform/clients/')) {
    clearAdminSession();
    window.location.assign('/signup');
    throw new Error(payload?.error ?? 'Admin access is required');
  }

  if (!response.ok) {
    const error = new Error(payload?.error ?? 'Request failed');
    error.statusCode = response.status;
    throw error;
  }

  return payload;
};

const getSetupGuideProgress = (client, appointments = []) => {
  const activeTeamMembers = Array.isArray(client?.teamMembers)
    ? client.teamMembers.filter((teamMember) => teamMember?.isActive !== false)
    : [];
  const activeServices = Array.isArray(client?.services)
    ? client.services.filter((service) => service?.isActive !== false)
    : [];
  const appointmentRecords = Array.isArray(appointments) ? appointments : [];

  const steps = {
    account: Boolean(client?.id),
    barber: activeTeamMembers.length > 0,
    services: activeServices.length > 0,
    appointment: appointmentRecords.length > 0,
    checkout: appointmentRecords.some((appointment) => appointment?.status === 'completed')
  };

  return {
    ...steps,
    isAllComplete: Object.values(steps).every(Boolean)
  };
};

let publicConfigRequest = null;
let currentPublicConfig = null;

const loadPublicConfig = async () => {
  if (!publicConfigRequest) {
    publicConfigRequest = apiRequest('/api/public-config')
      .then((payload) => {
        currentPublicConfig = payload ?? {};
        return currentPublicConfig;
      })
      .catch((error) => {
        publicConfigRequest = null;
        throw error;
      });
  }

  return publicConfigRequest;
};

const interpolateLabel = (template, values = {}) => {
  if (typeof template !== 'string' || !template) {
    return '';
  }

  return Object.entries(values).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value ?? '')),
    template
  );
};

const getProfileUiCopy = () => ({
  titleSuffix:
    typeof currentPublicConfig?.profileTitleSuffix === 'string'
      ? currentPublicConfig.profileTitleSuffix.trim()
      : '',
  description:
    typeof currentPublicConfig?.profileDescription === 'string'
      ? currentPublicConfig.profileDescription.trim()
      : '',
  fieldBusinessNameLabel:
    typeof currentPublicConfig?.profileFieldBusinessNameLabel === 'string'
      ? currentPublicConfig.profileFieldBusinessNameLabel.trim()
      : '',
  fieldBusinessNamePlaceholder:
    typeof currentPublicConfig?.profileFieldBusinessNamePlaceholder === 'string'
      ? currentPublicConfig.profileFieldBusinessNamePlaceholder.trim()
      : '',
  fieldWebsiteLabel:
    typeof currentPublicConfig?.profileFieldWebsiteLabel === 'string'
      ? currentPublicConfig.profileFieldWebsiteLabel.trim()
      : '',
  fieldWebsitePlaceholder:
    typeof currentPublicConfig?.profileFieldWebsitePlaceholder === 'string'
      ? currentPublicConfig.profileFieldWebsitePlaceholder.trim()
      : '',
  fieldPhoneLabel:
    typeof currentPublicConfig?.profileFieldPhoneLabel === 'string'
      ? currentPublicConfig.profileFieldPhoneLabel.trim()
      : '',
  fieldPhonePlaceholder:
    typeof currentPublicConfig?.profileFieldPhonePlaceholder === 'string'
      ? currentPublicConfig.profileFieldPhonePlaceholder.trim()
      : '',
  fieldAddressLabel:
    typeof currentPublicConfig?.profileFieldAddressLabel === 'string'
      ? currentPublicConfig.profileFieldAddressLabel.trim()
      : '',
  fieldAddressPlaceholder:
    typeof currentPublicConfig?.profileFieldAddressPlaceholder === 'string'
      ? currentPublicConfig.profileFieldAddressPlaceholder.trim()
      : '',
  fieldImageLabel:
    typeof currentPublicConfig?.profileFieldImageLabel === 'string'
      ? currentPublicConfig.profileFieldImageLabel.trim()
      : '',
  fieldImagePlaceholder:
    typeof currentPublicConfig?.profileFieldImagePlaceholder === 'string'
      ? currentPublicConfig.profileFieldImagePlaceholder.trim()
      : '',
  actionUploadImage:
    typeof currentPublicConfig?.profileActionUploadImage === 'string'
      ? currentPublicConfig.profileActionUploadImage.trim()
      : '',
  actionRemoveImage:
    typeof currentPublicConfig?.profileActionRemoveImage === 'string'
      ? currentPublicConfig.profileActionRemoveImage.trim()
      : '',
  actionSave:
    typeof currentPublicConfig?.profileActionSave === 'string'
      ? currentPublicConfig.profileActionSave.trim()
      : '',
  validationRequired:
    typeof currentPublicConfig?.profileValidationRequired === 'string'
      ? currentPublicConfig.profileValidationRequired.trim()
      : '',
  errorUpdate:
    typeof currentPublicConfig?.profileErrorUpdate === 'string'
      ? currentPublicConfig.profileErrorUpdate.trim()
      : ''
});

const formatAddressSingleLine = (address) =>
  typeof address === 'string'
    ? address
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
        .slice(0, 2)
        .join(', ')
    : '';

const safeAlert = (message) => {
  window.alert(message);
};

const debounce = (callback, delayMs) => {
  let timeoutId = null;

  return (...args) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }

    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, delayMs);
  };
};

const setMultilineAddress = (element, address) => {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  element.replaceChildren();

  if (typeof address !== 'string' || !address.trim()) {
    return;
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  parts.forEach((part, index) => {
    if (index > 0) {
      element.append(document.createElement('br'));
    }

    element.append(document.createTextNode(part));
  });
};

const escapeHtml = (value) =>
  String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');

const renderCalendarAvatar = (element, fallbackText, imageUrl = '') => {
  if (!(element instanceof HTMLElement)) {
    return;
  }

  const normalizedImageUrl = typeof imageUrl === 'string' ? imageUrl.trim() : '';

  if (normalizedImageUrl) {
    element.textContent = '';
    element.style.backgroundImage = `url("${normalizedImageUrl.replace(/"/g, '%22')}")`;
    element.style.backgroundSize = 'cover';
    element.style.backgroundPosition = 'center';
    element.style.backgroundRepeat = 'no-repeat';
    return;
  }

  element.textContent = fallbackText;
  element.style.backgroundImage = '';
  element.style.backgroundSize = '';
  element.style.backgroundPosition = '';
  element.style.backgroundRepeat = '';
};

const getBookingClientIdFromPath = () => {
  const match = window.location.pathname.match(/^\/book\/([^/]+)$/);
  return match ? decodeURIComponent(match[1]) : null;
};

const getManagedBookingFromPath = () => {
  const match = window.location.pathname.match(/^\/book\/([^/]+)\/manage\/([^/]+)$/);

  if (!match) {
    return null;
  }

  const searchParams = new URLSearchParams(window.location.search);

  return {
    businessId: decodeURIComponent(match[1]),
    appointmentId: decodeURIComponent(match[2]),
    accessToken: searchParams.get('accessToken')?.trim() ?? ''
  };
};

const getPublicBookingSource = () =>
  normalizeBookingSource(new URLSearchParams(window.location.search).get('source'));

const getPublicWaitlistClaim = () => {
  const searchParams = new URLSearchParams(window.location.search);

  return {
    waitlistEntryId: searchParams.get('waitlistEntryId')?.trim() ?? '',
    waitlistOfferToken: searchParams.get('waitlistOfferToken')?.trim() ?? ''
  };
};

const createSvgIcon = (pathData) => {
  const icon = document.createElement('span');
  icon.className = 'calendar-report-card-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.innerHTML =
    '<svg viewBox="0 0 24 24" focusable="false"><path d="M4 19h16"></path><path d="M7 15V9M12 15V5M17 15v-3"></path></svg>';
  return icon;
};

const createDrawerLinks = (items) => {
  const links = document.createElement('div');
  links.className = 'calendar-drawer-links';

  for (const item of items) {
    const button = document.createElement('button');
    const hasDotMeta = item.meta?.type === 'dot';
    button.className = hasDotMeta
      ? 'calendar-drawer-link calendar-drawer-link-with-meta'
      : 'calendar-drawer-link';
    button.type = 'button';
    button.dataset.drawerLabel = item.label;

    const label = document.createElement('span');
    if (item.subtitle) {
      const copy = document.createElement('span');
      copy.className = 'calendar-drawer-link-copy';

      const title = document.createElement('strong');
      title.textContent = item.label;

      const subtitle = document.createElement('small');
      subtitle.textContent = item.subtitle;

      copy.append(title, subtitle);
      button.append(copy);
    } else {
      label.textContent = item.label;
      button.append(label);
    }

    if (hasDotMeta) {
      const meta = document.createElement('span');
      meta.className = 'calendar-drawer-link-meta';
      meta.setAttribute('aria-hidden', 'true');
      button.append(meta);
    }

    links.append(button);
  }

  return links;
};

const renderDrawer = (drawer, titleElement, contentElement) => {
  if (!(titleElement instanceof HTMLElement) || !(contentElement instanceof HTMLElement)) {
    return;
  }

  titleElement.textContent = drawer.title;
  contentElement.replaceChildren();

  for (const section of drawer.sections) {
    if (section.title) {
      const sectionBlock = document.createElement('div');
      sectionBlock.className = 'calendar-drawer-section';

      const heading = document.createElement('h3');
      heading.textContent = section.title;
      sectionBlock.append(heading);
      sectionBlock.append(createDrawerLinks(section.items));
      contentElement.append(sectionBlock);
      continue;
    }

    contentElement.append(createDrawerLinks(section.items));
  }
};

const renderReportsView = (reportsView, elements) => {
  const {
    sidebarTitle,
    menu,
    folderTitle,
    folderActionLabel,
    connectorLabel,
    pageTitle,
    pageSubtitle,
    totalLabel,
    searchPlaceholder,
    filters,
    tabs,
    cards
  } = reportsView;

  const {
    reportsSidebarTitle,
    reportsMenu,
    reportsFolderTitle,
    reportsFolderAction,
    reportsConnectorLabel,
    reportsTitle,
    reportsSubtitle,
    reportsTotal,
    reportsSearchInput,
    reportsFilters,
    reportsTabs,
    reportsCards
  } = elements;

  if (
    !(reportsSidebarTitle instanceof HTMLElement) ||
    !(reportsMenu instanceof HTMLElement) ||
    !(reportsFolderTitle instanceof HTMLElement) ||
    !(reportsFolderAction instanceof HTMLButtonElement) ||
    !(reportsConnectorLabel instanceof HTMLElement) ||
    !(reportsTitle instanceof HTMLElement) ||
    !(reportsSubtitle instanceof HTMLElement) ||
    !(reportsTotal instanceof HTMLElement) ||
    !(reportsSearchInput instanceof HTMLInputElement) ||
    !(reportsFilters instanceof HTMLElement) ||
    !(reportsTabs instanceof HTMLElement) ||
    !(reportsCards instanceof HTMLElement)
  ) {
    return;
  }

  reportsSidebarTitle.textContent = sidebarTitle;
  reportsFolderTitle.textContent = folderTitle;
  reportsFolderAction.textContent = folderActionLabel;
  reportsConnectorLabel.textContent = connectorLabel;
  reportsTitle.textContent = pageTitle;
  reportsSubtitle.textContent = pageSubtitle;
  reportsTotal.textContent = totalLabel;
  reportsSearchInput.placeholder = searchPlaceholder;

  reportsMenu.replaceChildren();
  for (const item of menu) {
    const button = document.createElement('button');
    button.className = item.active
      ? 'calendar-reports-menu-item is-active'
      : 'calendar-reports-menu-item';
    button.type = 'button';
    button.dataset.menuKey = item.key ?? item.label.toLowerCase();

    const label = document.createElement('span');
    label.textContent = item.label;
    button.append(label);

    if (item.meta?.type === 'count') {
      const count = document.createElement('span');
      count.className = 'calendar-reports-count';
      count.textContent = item.meta.value ?? '';
      button.append(count);
    }

    reportsMenu.append(button);
  }

  reportsFilters.replaceChildren();
  for (const filterConfig of filters) {
    const filter = document.createElement('button');
    filter.className = filterConfig.active
      ? 'calendar-reports-filter is-active'
      : 'calendar-reports-filter';
    filter.type = 'button';
    filter.dataset.filterType = filterConfig.type;
    filter.dataset.filterValue = filterConfig.value;
    filter.textContent = filterConfig.label;
    reportsFilters.append(filter);
  }

  reportsTabs.replaceChildren();
  for (const tab of tabs) {
    const button = document.createElement('button');
    button.className = tab.active ? 'calendar-reports-tab is-active' : 'calendar-reports-tab';
    button.type = 'button';
    button.textContent = tab.label;
    button.dataset.tabKey = tab.key ?? tab.label.toLowerCase();
    reportsTabs.append(button);
  }

  reportsCards.replaceChildren();
  for (const card of cards) {
    const article = document.createElement('article');
    article.className = 'calendar-report-card';
    article.tabIndex = 0;
    article.dataset.reportId = card.id;
    article.dataset.reportCategory = card.category ?? 'all';
    article.dataset.reportCreatedBy = card.createdBy ?? 'platform';
    article.dataset.reportKind = card.kind ?? 'standard';
    article.dataset.reportPlan = card.plan ?? 'standard';
    article.dataset.reportFolderIds = Array.isArray(card.folderIds) ? card.folderIds.join(',') : '';

    const icon = createSvgIcon();

    const copy = document.createElement('div');
    copy.className = 'calendar-report-card-copy';

    const title = document.createElement('strong');
    title.textContent = card.title;
    copy.append(title);

    const description = document.createElement('p');
    description.textContent = card.description;
    copy.append(description);

    const meta = document.createElement('div');
    meta.className = 'calendar-report-card-meta';

    const categoryPill = document.createElement('span');
    categoryPill.className = 'calendar-report-card-pill';
    categoryPill.textContent = card.categoryLabel ?? card.category ?? 'Report';

    const sourcePill = document.createElement('span');
    sourcePill.className = 'calendar-report-card-pill';
    sourcePill.textContent = card.createdBy === 'you' ? 'Created by you' : 'Created by platform';

    const planPill = document.createElement('span');
    planPill.className = `calendar-report-card-pill is-${card.plan ?? 'standard'}`;
    planPill.textContent = (card.plan ?? 'standard').toUpperCase();

    meta.append(categoryPill, sourcePill, planPill);

    if (card.summary) {
      const summary = document.createElement('small');
      summary.className = 'calendar-report-card-summary';
      summary.textContent = card.summary;
      copy.append(meta, summary);
    } else {
      copy.append(meta);
    }

    const action = document.createElement('button');
    action.className = card.isFavourite
      ? 'calendar-report-card-action is-active'
      : 'calendar-report-card-action';
    action.type = 'button';
    action.dataset.reportAction = 'favourite';
    action.dataset.reportId = card.id;
    action.setAttribute(
      'aria-label',
      `${card.isFavourite ? 'Unfavourite' : 'Favourite'} ${card.title.toLowerCase()}`
    );
    action.innerHTML =
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M12 3l2.4 4.8L20 10l-4 3.9.9 5.6-4.9-2.6-4.9 2.6.9-5.6L4 10l5.6-2.2z"></path></svg>';

    article.append(icon, copy, action);
    reportsCards.append(article);
  }

  const folderBlock = reportsFolderAction.parentElement;

  if (folderBlock instanceof HTMLElement) {
    const existingList = folderBlock.querySelector('.calendar-reports-folder-list');
    existingList?.remove();

    if (Array.isArray(reportsView.folders) && reportsView.folders.length > 0) {
      const folderList = document.createElement('div');
      folderList.className = 'calendar-reports-folder-list';

      const allFolderButton = document.createElement('button');
      allFolderButton.type = 'button';
      allFolderButton.className =
        reportsView.allFoldersActive
          ? 'calendar-reports-folder-item is-active'
          : 'calendar-reports-folder-item';
      allFolderButton.dataset.folderId = '';
      allFolderButton.textContent =
        getDashboardUiCopy().reports?.allFolders ?? DEFAULT_DASHBOARD_UI_COPY.reports.allFolders;
      folderList.append(allFolderButton);

      for (const folder of reportsView.folders) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = folder.active
          ? 'calendar-reports-folder-item is-active'
          : 'calendar-reports-folder-item';
        button.dataset.folderId = folder.id;
        button.textContent = `${folder.name} (${folder.reportCount})`;
        folderList.append(button);
      }

      folderBlock.append(folderList);
    }
  }
};

const renderDashboardAppointments = (
  appointments,
  container,
  { onEdit, onRunningLate, onComplete, onCancel } = {}
) => {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(appointments) || appointments.length === 0) {
    const dashboardUiCopy = getDashboardUiCopy();
    const emptyState = document.createElement('article');
    emptyState.className = 'calendar-appointment-empty';

    const title = document.createElement('strong');
    title.textContent =
      dashboardUiCopy.calendar?.appointmentsEmptyTitle ??
      DEFAULT_DASHBOARD_UI_COPY.calendar.appointmentsEmptyTitle;

    const copy = document.createElement('p');
    copy.textContent =
      dashboardUiCopy.calendar?.appointmentsEmptyDescription ??
      DEFAULT_DASHBOARD_UI_COPY.calendar.appointmentsEmptyDescription;

    emptyState.append(title, copy);
    container.append(emptyState);
    return;
  }

  for (const appointment of appointments) {
    const card = document.createElement('article');
    card.className = 'calendar-appointment-card';
    const statusMeta = getAppointmentStatusMeta(appointment.status);

    const topRow = document.createElement('div');
    topRow.className = 'calendar-appointment-top';

    const name = document.createElement('strong');
    name.textContent = appointment.customerName;

    const badge = document.createElement('span');
    badge.className = 'calendar-appointment-badge';
    badge.classList.add(statusMeta.badgeClass);
    badge.textContent = statusMeta.label;

    topRow.append(name, badge);

    const service = document.createElement('p');
    service.className = 'calendar-appointment-service';
    service.textContent = getAppointmentServiceSummary(appointment);

    const meta = document.createElement('p');
    meta.className = 'calendar-appointment-meta';
    meta.textContent = formatDateTimeForDisplay(
      appointment.appointmentDate,
      appointment.appointmentTime
    );

    const footer = document.createElement('div');
    footer.className = 'calendar-appointment-footer';

    const source = document.createElement('span');
    source.className = 'calendar-appointment-source';
    source.textContent = interpolateLabel(
      getDashboardUiCopy().calendar?.bookingSourceTemplate ??
        DEFAULT_DASHBOARD_UI_COPY.calendar.bookingSourceTemplate,
      { source: formatBookingSourceLabel(appointment.source) }
    );

    footer.append(meta, source);

    if (appointment.status === 'booked') {
      const actions = document.createElement('div');
      actions.className = 'calendar-appointment-actions';

      const actionHandlers = {
        onEdit,
        onRunningLate,
        onComplete,
        onCancel
      };

      for (const actionConfig of BOOKED_APPOINTMENT_ACTIONS) {
        const actionHandler = actionHandlers[actionConfig.handlerKey];

        if (typeof actionHandler !== 'function') {
          continue;
        }

        const actionButton = createToolActionButton(
          getDashboardUiCopy().bookedAppointmentActionLabels?.[actionConfig.labelKey] ??
            actionConfig.fallbackLabel,
          () => {
          actionHandler(appointment);
          }
        );

        if (actionConfig.danger) {
          actionButton.classList.add('calendar-tool-action-danger');
        }

        actions.append(actionButton);
      }

      card.append(topRow, service, footer, actions);
      container.append(card);
      continue;
    }

    card.append(topRow, service, footer);
    container.append(card);
  }
};

const renderCalendarAppointments = (appointments, container) => {
  if (!(container instanceof HTMLElement)) {
    return;
  }

  container.replaceChildren();

  if (!Array.isArray(appointments) || appointments.length === 0) {
    return;
  }

  const calendarTimeSlots = getActiveCalendarTimeSlots();

  for (const appointment of appointments) {
    if (appointment.status !== 'booked') {
      continue;
    }

    const slotIndex = calendarTimeSlots.indexOf(appointment.appointmentTime);

    if (slotIndex < 0) {
      continue;
    }

    const card = document.createElement('article');
    card.className = 'calendar-grid-appointment';
    card.style.gridRow = String(slotIndex + 1);

    const top = document.createElement('div');
    top.className = 'calendar-grid-appointment-top';

    const time = document.createElement('span');
    time.className = 'calendar-grid-appointment-time';
    time.textContent = formatTimeForDisplay(appointment.appointmentTime);

    const chip = document.createElement('span');
    chip.className = 'calendar-grid-appointment-chip';
    chip.textContent = formatBookingSourceLabel(appointment.source);

    const customer = document.createElement('strong');
    customer.textContent = appointment.customerName;

    const service = document.createElement('p');
    service.textContent = appointment.teamMemberName
      ? `${appointment.serviceName} with ${appointment.teamMemberName}`
      : appointment.serviceName;

    top.append(time, chip);
    card.append(top, customer, service);
    container.append(card);
  }
};

const createToolActionButton = (label, onClick) => {
  const button = document.createElement('button');
  button.className = 'calendar-tool-action';
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
};

const createToolInfoCard = (title, description) => {
  const card = document.createElement('article');
  card.className = 'calendar-notification-item';

  const heading = document.createElement('strong');
  heading.textContent = title;

  const copy = document.createElement('p');
  copy.textContent = description;

  card.append(heading, copy);
  return card;
};

const createMetricPill = (label, value) => {
  const pill = document.createElement('article');
  pill.className = 'calendar-client-directory-metric';

  const heading = document.createElement('span');
  heading.className = 'calendar-client-directory-metric-label';
  heading.textContent = label;

  const copy = document.createElement('strong');
  copy.className = 'calendar-client-directory-metric-value';
  copy.textContent = value;

  pill.append(heading, copy);
  return pill;
};

const createSearchResultButton = ({ title, description, metaLabel, onSelect }) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'calendar-search-result';

  const meta = document.createElement('span');
  meta.className = 'calendar-search-result-meta';
  meta.textContent = metaLabel;

  const heading = document.createElement('strong');
  heading.textContent = title;

  const copy = document.createElement('p');
  copy.textContent = description;

  button.append(meta, heading, copy);
  button.addEventListener('click', onSelect);
  return button;
};

const formatClientContactLabel = (client) => {
  const parts = [];

  if (client.customerPhone) {
    parts.push(client.customerPhone);
  }
  if (client.customerEmail) {
    parts.push(client.customerEmail);
  }

  return parts.length > 0 ? parts.join(' | ') : 'No phone or email saved';
};

const sortClientsForRetention = (clients = []) =>
  [...clients].sort((left, right) => {
    const visitDelta = (right.completedVisits ?? 0) - (left.completedVisits ?? 0);

    if (visitDelta !== 0) {
      return visitDelta;
    }

    const totalVisitDelta = (right.visits ?? 0) - (left.visits ?? 0);

    if (totalVisitDelta !== 0) {
      return totalVisitDelta;
    }

    return `${right.lastDate ?? ''}T${right.lastTime ?? ''}`.localeCompare(
      `${left.lastDate ?? ''}T${left.lastTime ?? ''}`
    );
  });

const getClientLoyaltyStatus = (client, loyaltyProgram = null) => {
  const badges = [];
  const completedVisits = Number(client.completedVisits ?? 0) || 0;
  const totalVisits = Number(client.visits ?? 0) || 0;

  if (totalVisits > 1) {
    badges.push({ label: 'Repeat', tone: 'neutral' });
  }

  if (completedVisits >= 2) {
    badges.push({ label: 'Loyalty-ready', tone: 'gold' });
  }

  if (loyaltyProgram?.isEnabled) {
    const triggerCompletedVisits = Math.max(1, Number(loyaltyProgram.triggerCompletedVisits ?? 1) || 1);
    const completedVisitRemainder = completedVisits % triggerCompletedVisits;
    const visitsUntilReward =
      completedVisits === 0
        ? triggerCompletedVisits
        : completedVisitRemainder === 0
          ? 0
          : triggerCompletedVisits - completedVisitRemainder;

    if (completedVisits >= triggerCompletedVisits && visitsUntilReward === 0) {
      badges.push({ label: 'Reward eligible', tone: 'green' });
    }

    return {
      badges,
      progressLabel: `${completedVisits}/${triggerCompletedVisits} completed visits`,
      statusLabel:
        visitsUntilReward === 0
          ? `${loyaltyProgram.rewardValue}% reward milestone reached`
          : `${visitsUntilReward} more completed visit${visitsUntilReward === 1 ? '' : 's'} until reward`
    };
  }

  return {
    badges,
    progressLabel: `${completedVisits} completed visit${completedVisits === 1 ? '' : 's'}`,
    statusLabel: 'Loyalty program is currently disabled'
  };
};

const createClientDetailCard = (client, options = {}) => {
  const { loyaltyProgram = null } = options;
  const card = document.createElement('article');
  card.className = 'calendar-notification-item calendar-client-detail-card';

  const header = document.createElement('div');
  header.className = 'calendar-client-detail-header';

  const title = document.createElement('strong');
  title.textContent = client.customerName || 'Client';

  const subtitle = document.createElement('p');
  subtitle.className = 'calendar-client-detail-subtitle';
  subtitle.textContent = formatClientContactLabel(client);

  const loyaltyStatus = getClientLoyaltyStatus(client, loyaltyProgram);
  const badges = document.createElement('div');
  badges.className = 'calendar-client-detail-badges';

  for (const badgeConfig of loyaltyStatus.badges) {
    const badge = document.createElement('span');
    badge.className = `calendar-client-detail-badge is-${badgeConfig.tone}`;
    badge.textContent = badgeConfig.label;
    badges.append(badge);
  }

  header.append(title, subtitle);
  if (badges.childElementCount > 0) {
    header.append(badges);
  }

  const metrics = document.createElement('div');
  metrics.className = 'calendar-client-detail-metrics';

  const metricRows = [
    ['Visits', String(client.visits ?? 0)],
    ['Completed', String(client.completedVisits ?? 0)],
    ['Booked', String(client.bookedVisits ?? 0)],
    ['Last service', client.lastService || 'No service yet'],
    [
      'Last booking',
      client.lastDate ? formatDateTimeForDisplay(client.lastDate, client.lastTime) : 'No appointment yet'
    ],
    ['Reward progress', loyaltyStatus.progressLabel],
    ['Status', loyaltyStatus.statusLabel]
  ];

  for (const [label, value] of metricRows) {
    const row = document.createElement('div');
    row.className = 'calendar-client-detail-row';

    const rowLabel = document.createElement('span');
    rowLabel.textContent = label;

    const rowValue = document.createElement('strong');
    rowValue.textContent = value;

    row.append(rowLabel, rowValue);
    metrics.append(row);
  }

  card.append(header, metrics);
  return card;
};

const createClientDirectoryCard = (client, loyaltyProgram = null) => {
  const loyaltyStatus = getClientLoyaltyStatus(client, loyaltyProgram);
  const card = document.createElement('article');
  card.className = 'calendar-client-directory-card';

  const header = document.createElement('div');
  header.className = 'calendar-client-directory-card-header';

  const identity = document.createElement('div');
  identity.className = 'calendar-client-directory-card-identity';

  const name = document.createElement('strong');
  name.textContent = client.customerName || 'Client';

  const contact = document.createElement('p');
  contact.textContent = formatClientContactLabel(client);

  identity.append(name, contact);

  const badges = document.createElement('div');
  badges.className = 'calendar-client-directory-card-badges';

  for (const badgeConfig of loyaltyStatus.badges) {
    const badge = document.createElement('span');
    badge.className = `calendar-client-detail-badge is-${badgeConfig.tone}`;
    badge.textContent = badgeConfig.label;
    badges.append(badge);
  }

  header.append(identity);
  if (badges.childElementCount > 0) {
    header.append(badges);
  }

  const metrics = document.createElement('div');
  metrics.className = 'calendar-client-directory-card-metrics';

  const metricRows = [
    ['Visits', String(client.visits ?? 0)],
    ['Completed', String(client.completedVisits ?? 0)],
    ['Booked', String(client.bookedVisits ?? 0)],
    ['Last service', client.lastService || 'No service yet'],
    [
      'Last booking',
      client.lastDate ? formatDateTimeForDisplay(client.lastDate, client.lastTime) : 'No appointment yet'
    ],
    ['Reward progress', loyaltyStatus.progressLabel]
  ];

  for (const [label, value] of metricRows) {
    const row = document.createElement('div');
    row.className = 'calendar-client-directory-card-row';

    const rowLabel = document.createElement('span');
    rowLabel.textContent = label;

    const rowValue = document.createElement('strong');
    rowValue.textContent = value;

    row.append(rowLabel, rowValue);
    metrics.append(row);
  }

  card.append(header, metrics);
  return card;
};

const buildAdminAppointmentPath = (clientId, appointmentId, actionSuffix = '') => {
  const encodedAppointmentId = encodeURIComponent(appointmentId);
  return `/api/platform/clients/${clientId}/appointments/${encodedAppointmentId}${actionSuffix}`;
};

const parsePriceLabel = (priceLabel) => {
  if (typeof priceLabel !== 'string') {
    return 0;
  }

  const normalizedValue = Number(priceLabel.replace(/[^\d.]/g, ''));
  return Number.isFinite(normalizedValue) ? normalizedValue : 0;
};

const formatCurrencyLabel = (amount) => {
  const normalizedAmount = Number.isFinite(Number(amount)) ? Number(amount) : 0;
  return formatCurrencyExampleLabel(Math.round(normalizedAmount));
};

const formatMoneyValue = (amountValue, currencyCode = '') => {
  const normalizedAmountValue = Number.isFinite(Number(amountValue)) ? Number(amountValue) : 0;
  const normalizedCurrencyCode =
    typeof currencyCode === 'string' ? currencyCode.trim().toUpperCase() : '';
  const settings = getActiveBusinessSettings();
  const formatter = new Intl.NumberFormat(settings.currencyLocale, {
    maximumFractionDigits: 0
  });
  const formattedAmount = formatter.format(Math.round(normalizedAmountValue));
  return normalizedCurrencyCode ? `${normalizedCurrencyCode} ${formattedAmount}` : formattedAmount;
};

const normalizeSearchValue = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/\s+/g, ' ') : '';

const getSalonServiceSearchValues = (salon) =>
  [
    ...(Array.isArray(salon.serviceTypes) ? salon.serviceTypes : []),
    ...(Array.isArray(salon.services) ? salon.services.map((service) => service.name) : [])
  ]
    .filter((value) => typeof value === 'string' && value.trim())
    .map((value) => value.trim());

const matchesSalonServiceQuery = (salon, serviceQuery) => {
  const normalizedQuery = normalizeSearchValue(serviceQuery);

  if (!normalizedQuery) {
    return true;
  }

  const searchText = normalizeSearchValue(
    [
      salon.businessName,
      ...(Array.isArray(salon.serviceLocation) ? salon.serviceLocation : []),
      salon.venueAddress,
      ...(Array.isArray(salon.serviceTypes) ? salon.serviceTypes : []),
      ...(Array.isArray(salon.services) ? salon.services.map((service) => service.name) : [])
    ]
      .filter((value) => typeof value === 'string' && value.trim())
      .join(' ')
  );

  return searchText.includes(normalizedQuery);
};

const getSalonServiceScore = (salon, serviceQuery) => {
  const normalizedQuery = normalizeSearchValue(serviceQuery);

  if (!normalizedQuery) {
    return 0;
  }

  const searchValues = [
    salon.businessName,
    ...getSalonServiceSearchValues(salon)
  ].map((value) => normalizeSearchValue(value));

  if (searchValues.some((value) => value === normalizedQuery)) {
    return 120;
  }

  if (searchValues.some((value) => value.startsWith(normalizedQuery))) {
    return 92;
  }

  if (searchValues.some((value) => value.includes(normalizedQuery))) {
    return 68;
  }

  const queryParts = normalizedQuery.split(' ').filter(Boolean);
  const matchedParts = queryParts.filter((part) =>
    searchValues.some((value) => value.includes(part))
  ).length;

  return matchedParts > 0 ? matchedParts * 16 : -1;
};

const getSalonLocationScore = (salon, locationQuery) => {
  const normalizedQuery = normalizeSearchValue(locationQuery);

  if (!normalizedQuery) {
    return 0;
  }

  const address = normalizeSearchValue(salon.venueAddress);
  if (!address) {
    return -1;
  }

  const addressParts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (addressParts.some((part) => part === normalizedQuery)) {
    return 120;
  }

  if (addressParts.some((part) => part.startsWith(normalizedQuery))) {
    return 96;
  }

  if (address.includes(normalizedQuery)) {
    return 72;
  }

  const queryParts = normalizedQuery.split(' ').filter(Boolean);
  const matchedParts = queryParts.filter((part) => address.includes(part)).length;

  return matchedParts > 0 ? matchedParts * 18 : -1;
};

const getSalonLocationSearchValues = (salon) => {
  const address = typeof salon.venueAddress === 'string' ? salon.venueAddress.trim() : '';

  if (!address) {
    return [];
  }

  const parts = address
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  const cityLike = parts.length >= 3 ? parts[parts.length - 3] : '';
  const regionLike = parts.length >= 4 ? parts[parts.length - 4] : '';

  return [
    cityLike,
    regionLike,
    parts[1],
    parts[0],
    parts.slice(0, 2).join(', '),
    parts.slice(0, 3).join(', ')
  ].filter((value, index, values) => {
    if (typeof value !== 'string' || !value.trim()) {
      return false;
    }

    return values.findIndex(
      (entry) => normalizeSearchValue(entry) === normalizeSearchValue(value)
    ) === index;
  });
};

const getPublicSalonOnlineSummary = (salon) => {
  const onlineCount = Number(salon.onlineTeamMembersCount) || 0;
  const onlineNames = Array.isArray(salon.onlineTeamMemberNames)
    ? salon.onlineTeamMemberNames.filter((name) => typeof name === 'string' && name.trim().length > 0)
    : [];
  const roleLabel =
    Array.isArray(salon.serviceTypes) && salon.serviceTypes.includes('Barber')
      ? onlineCount === 1
        ? 'barber'
        : 'barbers'
      : onlineCount === 1
        ? 'team member'
        : 'team members';

  if (onlineCount <= 0) {
    return {
      isOnline: false,
      label: `No ${roleLabel} online`
    };
  }

  const previewNames =
    onlineNames.length > 2 ? `${onlineNames.slice(0, 2).join(', ')} +${onlineNames.length - 2}` : onlineNames.join(', ');

  return {
    isOnline: true,
    label: `${onlineCount} ${roleLabel} online${previewNames ? ` | ${previewNames}` : ''}`
  };
};

const createSalonShowcaseCard = (salon) => {
  const card = document.createElement('article');
  card.className = 'public-salon-card';

  const header = document.createElement('div');
  header.className = 'public-salon-card-header';

  const titleBlock = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = salon.businessName;

  const meta = document.createElement('p');
  const locationLabel = formatAddressSingleLine(salon.venueAddress) || 'Booking available';
  const typeLabel =
    Array.isArray(salon.serviceTypes) && salon.serviceTypes.length > 0
      ? salon.serviceTypes.join(' | ')
      : 'Salon services';
  meta.textContent = `${locationLabel} | ${typeLabel}`;

  const onlineSummary = getPublicSalonOnlineSummary(salon);
  const onlineBadge = document.createElement('div');
  onlineBadge.className = `public-salon-online-badge${onlineSummary.isOnline ? '' : ' is-offline'}`;
  onlineBadge.textContent = onlineSummary.label;

  titleBlock.append(title, meta, onlineBadge);

  const bookLink = document.createElement('a');
  bookLink.className = 'public-salon-book-link';
  bookLink.href = salon.bookingLink;
  bookLink.textContent = 'Book now';

  header.append(titleBlock, bookLink);

  const reviewMeta = document.createElement('div');
  reviewMeta.className = 'public-salon-review-meta';
  reviewMeta.textContent =
    salon.reviewSummary?.totalReviews > 0
      ? `${salon.reviewSummary.averageRating}/5 | ${salon.reviewSummary.totalReviews} review${salon.reviewSummary.totalReviews === 1 ? '' : 's'}`
      : 'New salon | No reviews yet';

  const services = document.createElement('div');
  services.className = 'public-salon-services';

  for (const service of salon.services ?? []) {
    const serviceCard = document.createElement('div');
    serviceCard.className = 'public-salon-service-card';

    const name = document.createElement('strong');
    name.textContent = service.name;

    const details = document.createElement('span');
    details.textContent = `${service.durationMinutes} min | ${service.priceLabel}`;

    serviceCard.append(name, details);
    services.append(serviceCard);
  }

  card.append(header, reviewMeta, services);
  return card;
};

const initHomeSalonShowcase = () => {
  const showcaseList = document.querySelector('#public-salon-showcase-list');
  const showcaseEmpty = document.querySelector('#public-salon-showcase-empty');

  if (!(showcaseList instanceof HTMLDivElement) || !(showcaseEmpty instanceof HTMLElement)) {
    return;
  }

  apiRequest('/api/public/salons')
    .then((payload) => {
      showcaseList.replaceChildren();

      if (!Array.isArray(payload.salons) || payload.salons.length === 0) {
        showcaseEmpty.classList.remove('is-hidden');
        return;
      }

      showcaseEmpty.classList.add('is-hidden');

      for (const salon of payload.salons) {
        showcaseList.append(createSalonShowcaseCard(salon));
        continue;

        const card = document.createElement('article');
        card.className = 'public-salon-card';

        const header = document.createElement('div');
        header.className = 'public-salon-card-header';

        const titleBlock = document.createElement('div');
        const title = document.createElement('h3');
        title.textContent = salon.businessName;

        const meta = document.createElement('p');
        const locationLabel = formatAddressSingleLine(salon.venueAddress) || 'Booking available';
        const typeLabel =
          Array.isArray(salon.serviceTypes) && salon.serviceTypes.length > 0
            ? salon.serviceTypes.join(' â€¢ ')
            : 'Salon services';
        meta.textContent = `${locationLabel} â€¢ ${typeLabel}`;

        titleBlock.append(title, meta);

        const bookLink = document.createElement('a');
        bookLink.className = 'public-salon-book-link';
        bookLink.href = salon.bookingLink;
        bookLink.textContent = 'Book now';

        header.append(titleBlock, bookLink);

        const reviewMeta = document.createElement('div');
        reviewMeta.className = 'public-salon-review-meta';
        reviewMeta.textContent =
          salon.reviewSummary?.totalReviews > 0
            ? `${salon.reviewSummary.averageRating}/5 â€¢ ${salon.reviewSummary.totalReviews} review${salon.reviewSummary.totalReviews === 1 ? '' : 's'}`
            : 'New salon â€¢ No reviews yet';

        const services = document.createElement('div');
        services.className = 'public-salon-services';

        for (const service of salon.services ?? []) {
          const serviceCard = document.createElement('div');
          serviceCard.className = 'public-salon-service-card';

          const name = document.createElement('strong');
          name.textContent = service.name;

          const details = document.createElement('span');
          details.textContent = `${service.durationMinutes} min â€¢ ${service.priceLabel}`;

          serviceCard.append(name, details);
          services.append(serviceCard);
        }

        card.append(header, reviewMeta, services);
        showcaseList.append(card);
      }
    })
    .catch(() => {
      showcaseEmpty.classList.remove('is-hidden');
      showcaseEmpty.textContent = 'Unable to load featured salons right now.';
    });
};

const initHomeSalonSearch = () => {
  const showcaseList = document.querySelector('#public-salon-showcase-list');
  const showcaseEmpty = document.querySelector('#public-salon-showcase-empty');
  const showcaseTitle = document.querySelector('#public-salon-showcase-title');
  const showcaseStatus = document.querySelector('#public-salon-showcase-status');
  const serviceDropdown = document.querySelector('#service-query-dropdown');
  const cityDropdown = document.querySelector('#city-query-dropdown');
  const locationTrigger = document.querySelector('#city-location-trigger');

  if (
    !(showcaseList instanceof HTMLDivElement) ||
    !(showcaseEmpty instanceof HTMLElement) ||
    !(showcaseTitle instanceof HTMLElement) ||
    !(showcaseStatus instanceof HTMLElement) ||
    !(searchPanel instanceof HTMLFormElement)
  ) {
    return;
  }

  const salonsEndpoint = searchPanel.dataset.salonsEndpoint?.trim() || '/api/public/salons';
  const locationReverseEndpoint =
    searchPanel.dataset.locationReverseEndpoint?.trim() || '/api/public/locations/reverse';
  const defaultTitle = showcaseTitle.textContent ?? 'Newly launched salons ready for booking';
  const defaultStatus = showcaseStatus.textContent ?? 'Showing all salons ready for booking.';
  let allSalons = [];
  let serviceSuggestions = [];
  let citySuggestions = [];
  let resultsLimit = 3;
  let hasRequestedCurrentLocation = false;

  const buildSuggestionEntries = (salons, getValues, chipLabel, metaBuilder) => {
    const suggestionMap = new Map();

    for (const salon of salons) {
      for (const value of getValues(salon)) {
        const normalizedValue = normalizeSearchValue(value);

        if (!normalizedValue) {
          continue;
        }

        const currentSuggestion = suggestionMap.get(normalizedValue) ?? {
          value: value.trim(),
          count: 0
        };
        currentSuggestion.count += 1;
        suggestionMap.set(normalizedValue, currentSuggestion);
      }
    }

    return [...suggestionMap.values()]
      .sort(
        (left, right) =>
          right.count - left.count ||
          left.value.localeCompare(right.value)
      )
      .map((entry) => ({
        ...entry,
        chipLabel,
        meta: metaBuilder(entry.count)
      }));
  };

  const getRankedSuggestions = (suggestions, query) => {
    const normalizedQuery = normalizeSearchValue(query);

    return suggestions
      .map((suggestion) => {
        const normalizedValue = normalizeSearchValue(suggestion.value);
        let score = 0;

        if (!normalizedQuery) {
          score = suggestion.count * 12;
        } else if (normalizedValue === normalizedQuery) {
          score = 140;
        } else if (normalizedValue.startsWith(normalizedQuery)) {
          score = 110;
        } else if (normalizedValue.includes(normalizedQuery)) {
          score = 82;
        } else {
          const matchedParts = normalizedQuery
            .split(' ')
            .filter(Boolean)
            .filter((part) => normalizedValue.includes(part)).length;
          score = matchedParts > 0 ? matchedParts * 24 : -1;
        }

        return {
          ...suggestion,
          score
        };
      })
      .filter((suggestion) => suggestion.score >= 0)
      .sort(
        (left, right) =>
          right.score - left.score ||
          right.count - left.count ||
          left.value.localeCompare(right.value)
      )
      .slice(0, 6);
  };

  const createSearchDropdownController = ({
    input,
    dropdown,
    title,
    subtitle,
    getSuggestions,
    onSelect,
    onOpen
  }) => {
    if (!(input instanceof HTMLInputElement) || !(dropdown instanceof HTMLDivElement)) {
      return {
        open: () => {},
        close: () => {},
        refresh: () => {}
      };
    }

    const container = input.closest('.search-item');

    const close = () => {
      dropdown.classList.add('is-hidden');
      input.setAttribute('aria-expanded', 'false');
    };

    const open = () => {
      onOpen?.();
      dropdown.replaceChildren();

      const copy = document.createElement('div');
      copy.className = 'search-dropdown-copy';
      const heading = document.createElement('strong');
      heading.textContent = title;
      const description = document.createElement('span');
      description.textContent = subtitle;
      copy.append(heading, description);
      dropdown.append(copy);

      const suggestions = getSuggestions(input.value);

      if (suggestions.length === 0) {
        const emptyState = document.createElement('p');
        emptyState.className = 'search-dropdown-empty';
        emptyState.textContent = 'No matching suggestions yet. Keep typing to search all salons.';
        dropdown.append(emptyState);
      } else {
        const options = document.createElement('div');
        options.className = 'search-dropdown-options';

        for (const suggestion of suggestions) {
          const optionButton = document.createElement('button');
          optionButton.type = 'button';
          optionButton.className = 'search-dropdown-option';
          optionButton.setAttribute('role', 'option');
          optionButton.dataset.suggestionValue = suggestion.value;

          const optionCopy = document.createElement('div');
          optionCopy.className = 'search-dropdown-option-copy';
          const optionTitle = document.createElement('strong');
          optionTitle.textContent = suggestion.value;
          const optionMeta = document.createElement('span');
          optionMeta.textContent = suggestion.meta;
          optionCopy.append(optionTitle, optionMeta);

          const optionChip = document.createElement('span');
          optionChip.className = 'search-dropdown-option-chip';
          optionChip.textContent = suggestion.chipLabel;

          optionButton.append(optionCopy, optionChip);
          optionButton.addEventListener('pointerdown', (event) => {
            event.preventDefault();
          });
          optionButton.addEventListener('click', () => {
            onSelect(suggestion.value);
            close();
          });
          options.append(optionButton);
        }

        dropdown.append(options);
      }

      dropdown.classList.remove('is-hidden');
      input.setAttribute('aria-expanded', 'true');
    };

    input.addEventListener('focus', open);
    input.addEventListener('click', open);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        close();
        return;
      }

      if (event.key === 'ArrowDown') {
        open();
        const firstOption = dropdown.querySelector('.search-dropdown-option');

        if (firstOption instanceof HTMLButtonElement) {
          event.preventDefault();
          firstOption.focus();
        }
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!(event.target instanceof Node) || !(container instanceof HTMLElement)) {
        close();
        return;
      }

      if (container.contains(event.target)) {
        return;
      }

      close();
    });

    return {
      open,
      close,
      refresh: () => {
        if (
          document.activeElement === input ||
          !dropdown.classList.contains('is-hidden')
        ) {
          open();
        }
      }
    };
  };

  const renderShowcase = (salons, filters = {}) => {
    const rawLocation = cityInput instanceof HTMLInputElement ? cityInput.value.trim() : '';
    const rawService = serviceInput instanceof HTMLInputElement ? serviceInput.value.trim() : '';
    const locationQuery = filters.locationQuery ?? rawLocation;
    const serviceQuery = filters.serviceQuery ?? rawService;
    const isLimited = Boolean(filters.isLimited);
    const limitedCount = Number(filters.limitedCount) || salons.length;

    showcaseList.replaceChildren();

    if (locationQuery && serviceQuery) {
      showcaseTitle.textContent = `${serviceQuery} near ${locationQuery}`;
    } else if (locationQuery) {
      showcaseTitle.textContent = `Salons near ${locationQuery}`;
    } else if (serviceQuery) {
      showcaseTitle.textContent = `Salons matching ${serviceQuery}`;
    } else {
      showcaseTitle.textContent = defaultTitle;
    }

    if (salons.length === 0) {
      showcaseEmpty.classList.remove('is-hidden');
      showcaseEmpty.textContent = locationQuery
        ? `No salons found near ${locationQuery} yet. Try another area.`
        : serviceQuery
          ? `No salons found for ${serviceQuery} yet. Try another search.`
          : 'No salons have completed setup yet.';
      showcaseStatus.textContent = locationQuery
        ? `No salons matched ${locationQuery}.`
        : serviceQuery
          ? `No salons matched ${serviceQuery}.`
          : defaultStatus;
      return;
    }

    showcaseEmpty.classList.add('is-hidden');
    showcaseStatus.textContent = isLimited
      ? locationQuery && serviceQuery
        ? `Showing the ${limitedCount} best salon match${limitedCount === 1 ? '' : 'es'} for ${serviceQuery} near ${locationQuery}.`
        : locationQuery
          ? `Showing the ${limitedCount} closest salon${limitedCount === 1 ? '' : 's'} near ${locationQuery}.`
          : `Showing the ${limitedCount} best salon match${limitedCount === 1 ? '' : 'es'} for ${serviceQuery}.`
      : locationQuery
        ? `Showing ${salons.length} salon${salons.length === 1 ? '' : 's'} near ${locationQuery}.`
        : serviceQuery
          ? `Showing ${salons.length} salon${salons.length === 1 ? '' : 's'} for ${serviceQuery}.`
          : defaultStatus;

    for (const salon of salons) {
      showcaseList.append(createSalonShowcaseCard(salon));
    }
  };

  const detectCurrentLocation = () => {
    if (
      !(cityInput instanceof HTMLInputElement) ||
      !navigator.geolocation ||
      cityInput.value.trim() ||
      hasRequestedCurrentLocation
    ) {
      return;
    }

    hasRequestedCurrentLocation = true;

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        if (!(cityInput instanceof HTMLInputElement) || cityInput.value.trim()) {
          return;
        }

        try {
          const params = new URLSearchParams({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude)
          });
          const payload = await apiRequest(`${locationReverseEndpoint}?${params.toString()}`);
          const detectedLocation =
            payload?.location?.primaryLabel?.trim() ??
            payload?.location?.label?.split(',')[0]?.trim() ??
            '';

          if (!detectedLocation) {
            return;
          }

          cityInput.value = detectedLocation;
          applyShowcaseFilters();
        } catch (_error) {
          hasRequestedCurrentLocation = false;
        }
      },
      () => {
        hasRequestedCurrentLocation = false;
      },
      {
        enableHighAccuracy: false,
        timeout: 10000,
        maximumAge: 300000
      }
    );
  };

  const applyShowcaseFilters = ({ scrollIntoView = false } = {}) => {
    const locationQuery = cityInput instanceof HTMLInputElement ? cityInput.value.trim() : '';
    const serviceQuery = serviceInput instanceof HTMLInputElement ? serviceInput.value.trim() : '';
    const shouldLimitResults = Boolean(locationQuery || serviceQuery);

    let salons = [...allSalons]
      .map((salon) => {
        const locationScore = locationQuery ? getSalonLocationScore(salon, locationQuery) : 0;
        const serviceScore = serviceQuery ? getSalonServiceScore(salon, serviceQuery) : 0;

        return {
          salon,
          locationScore,
          serviceScore,
          combinedScore: locationScore * 3 + serviceScore * 2
        };
      })
      .filter((entry) => (!locationQuery || entry.locationScore >= 0) && (!serviceQuery || entry.serviceScore >= 0))
      .sort(
        (left, right) =>
          right.combinedScore - left.combinedScore ||
          right.locationScore - left.locationScore ||
          right.serviceScore - left.serviceScore ||
          left.salon.businessName.localeCompare(right.salon.businessName)
      )
      .map((entry) => entry.salon);

    if (!locationQuery && serviceQuery) {
      salons = salons.filter((salon) => matchesSalonServiceQuery(salon, serviceQuery));
    }

    if (shouldLimitResults) {
      salons = salons.slice(0, resultsLimit);
    }

    renderShowcase(salons, {
      locationQuery,
      serviceQuery,
      isLimited: shouldLimitResults,
      limitedCount: Math.min(resultsLimit, salons.length)
    });

    if (scrollIntoView) {
      const showcaseSection = document.querySelector('.public-salon-showcase');
      showcaseSection?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const serviceDropdownController = createSearchDropdownController({
    input: serviceInput,
    dropdown: serviceDropdown,
    title: 'Treatments and categories',
    subtitle: 'Choose a popular service to instantly filter salon cards.',
    getSuggestions: (query) => getRankedSuggestions(serviceSuggestions, query),
    onSelect: (value) => {
      if (serviceInput instanceof HTMLInputElement) {
        serviceInput.value = value;
      }

      applyShowcaseFilters();
    }
  });

  const cityDropdownController = createSearchDropdownController({
    input: cityInput,
    dropdown: cityDropdown,
    title: 'Venue areas',
    subtitle: 'Search nearby salons by city, area, or venue address.',
    getSuggestions: (query) => getRankedSuggestions(citySuggestions, query),
    onSelect: (value) => {
      if (cityInput instanceof HTMLInputElement) {
        cityInput.value = value;
      }

      applyShowcaseFilters();
    },
    onOpen: () => {
      detectCurrentLocation();
    }
  });

  searchPanel.addEventListener('submit', (event) => {
    event.preventDefault();
    serviceDropdownController.close();
    cityDropdownController.close();
    applyShowcaseFilters({ scrollIntoView: true });
  });

  if (cityInput instanceof HTMLInputElement) {
    cityInput.addEventListener('input', () => {
      applyShowcaseFilters();
      cityDropdownController.refresh();
    });
  }

  if (locationTrigger instanceof HTMLButtonElement) {
    locationTrigger.addEventListener('click', () => {
      detectCurrentLocation();
      cityDropdownController.open();
    });
  }

  if (serviceInput instanceof HTMLInputElement) {
    serviceInput.addEventListener('input', () => {
      applyShowcaseFilters();
      serviceDropdownController.refresh();
    });
  }

  if (timeInput instanceof HTMLInputElement) {
    const openDatePicker = () => {
      if (typeof timeInput.showPicker === 'function') {
        timeInput.showPicker();
      }
    };

    timeInput.addEventListener('focus', openDatePicker);
    timeInput.addEventListener('click', openDatePicker);
  }

  Promise.all([loadPublicConfig().catch(() => ({})), apiRequest(salonsEndpoint)])
    .then(([config, payload]) => {
      const configuredResultsLimit = Number(config?.homeSearchResultsLimit);

      if (Number.isFinite(configuredResultsLimit) && configuredResultsLimit > 0) {
        resultsLimit = Math.floor(configuredResultsLimit);
      }

      allSalons = Array.isArray(payload.salons) ? payload.salons : [];
      serviceSuggestions = buildSuggestionEntries(
        allSalons,
        (salon) => getSalonServiceSearchValues(salon),
        'Service',
        (count) => `${count} salon${count === 1 ? '' : 's'} offer this`
      );
      citySuggestions = buildSuggestionEntries(
        allSalons,
        (salon) => getSalonLocationSearchValues(salon),
        'Venue',
        (count) => `${count} salon${count === 1 ? '' : 's'} in this area`
      );
      renderShowcase(allSalons);
      applyShowcaseFilters();
      detectCurrentLocation();
    })
    .catch(() => {
      showcaseEmpty.classList.remove('is-hidden');
      showcaseEmpty.textContent = 'Unable to load featured salons right now.';
      showcaseStatus.textContent = 'Unable to load nearby salons right now.';
    });
};

if (menuToggle instanceof HTMLButtonElement && siteMenu instanceof HTMLDivElement) {
  const closeMenu = () => {
    siteMenu.classList.add('is-hidden');
    menuToggle.setAttribute('aria-expanded', 'false');
  };

  const openMenu = () => {
    siteMenu.classList.remove('is-hidden');
    menuToggle.setAttribute('aria-expanded', 'true');
  };

  menuToggle.addEventListener('click', () => {
    if (siteMenu.classList.contains('is-hidden')) {
      openMenu();
      return;
    }

    closeMenu();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (
      target instanceof Node &&
      !siteMenu.contains(target) &&
      !menuToggle.contains(target)
    ) {
      closeMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  });
}

if (
  businessTypesToggle instanceof HTMLButtonElement &&
  businessTypesMenu instanceof HTMLDivElement
) {
  const closeBusinessTypesMenu = () => {
    businessTypesMenu.classList.add('is-hidden');
    businessTypesToggle.setAttribute('aria-expanded', 'false');
  };

  const openBusinessTypesMenu = () => {
    businessTypesMenu.classList.remove('is-hidden');
    businessTypesToggle.setAttribute('aria-expanded', 'true');
  };

  businessTypesToggle.addEventListener('click', () => {
    if (businessTypesMenu.classList.contains('is-hidden')) {
      openBusinessTypesMenu();
      return;
    }

    closeBusinessTypesMenu();
  });

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (
      target instanceof Node &&
      !businessTypesMenu.contains(target) &&
      !businessTypesToggle.contains(target)
    ) {
      closeBusinessTypesMenu();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeBusinessTypesMenu();
    }
  });
}

const guardAdminPages = () => {
  const protectedPaths = [
    '/onboarding/business-name',
    '/onboarding/service-types',
    '/onboarding/account-type',
    '/onboarding/service-location',
    '/onboarding/venue-location',
    '/onboarding/launch-links',
    '/onboarding/language',
    '/onboarding/complete',
    '/guides/legendary-learner',
    '/calendar'
  ];

  if (!protectedPaths.includes(window.location.pathname)) {
    return true;
  }

  if (!getClientId()) {
    window.location.assign('/signup');
    return false;
  }

  return true;
};

const initSignup = () => {
  const signupForm = document.querySelector('#pro-signup-form');
  const emailInput = document.querySelector('#professional-email');
  const mobileInput = document.querySelector('#professional-mobile');
  const providerButtons = document.querySelectorAll('[data-auth-provider]');

  if (!(signupForm instanceof HTMLFormElement)) {
    return;
  }

  const createEndpoint = signupForm.dataset.createEndpoint?.trim();
  const loginEndpoint = signupForm.dataset.loginEndpoint?.trim();

  if (!createEndpoint || !loginEndpoint) {
    safeAlert('Signup configuration is missing.');
    return;
  }

  const createClient = async (provider, email = '', mobileNumber = '') => {
    const payload = await apiRequest(createEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        provider,
        email: email.trim() || undefined,
        mobileNumber: mobileNumber.trim() || undefined
      })
    });

    setAdminSession(payload.client.id);
    window.location.assign(payload.nextStep);
  };

  const loginClient = async (email = '', mobileNumber = '') => {
    const payload = await apiRequest(loginEndpoint, {
      method: 'POST',
      body: JSON.stringify({
        email: email.trim() || undefined,
        mobileNumber: mobileNumber.trim() || undefined
      })
    });

    setAdminSession(payload.client.id);
    window.location.assign(payload.nextStep);
  };

  const continueWithEmailOrMobile = async (email = '', mobileNumber = '') => {
    try {
      await loginClient(email, mobileNumber);
    } catch (error) {
      if (error instanceof Error && error.statusCode === 404) {
        try {
          await createClient('email', email, mobileNumber);
          return;
        } catch (createError) {
          safeAlert(createError instanceof Error ? createError.message : 'Unable to continue');
          return;
        }
      }

      safeAlert(error instanceof Error ? error.message : 'Unable to continue');
    }
  };

  signupForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    const emailValue = emailInput instanceof HTMLInputElement ? emailInput.value : '';
    const mobileValue = mobileInput instanceof HTMLInputElement ? mobileInput.value : '';

    if (!emailValue.trim() && !mobileValue.trim()) {
      safeAlert('Enter your email address or mobile number to continue.');
      return;
    }

    await continueWithEmailOrMobile(emailValue, mobileValue);
  });

  for (const button of providerButtons) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    button.addEventListener('click', async () => {
      try {
        await createClient(button.dataset.authProvider ?? 'email');
      } catch (error) {
        safeAlert(error instanceof Error ? error.message : 'Unable to continue');
      }
    });
  }
};

const initBusinessProfile = () => {
  const businessForm = document.querySelector('#business-profile-form');
  const businessNameInput = document.querySelector('#business-name-input');
  const businessWebsiteInput = document.querySelector('#business-website-input');
  const businessPhoneInput = document.querySelector('#business-phone-input');
  const businessPhoneLabelText = document.querySelector('#business-phone-label-text');
  const continueButton = document.querySelector('#business-profile-continue');

  if (
    !(businessForm instanceof HTMLFormElement) ||
    !(businessNameInput instanceof HTMLInputElement) ||
    !(businessWebsiteInput instanceof HTMLInputElement) ||
    !(businessPhoneInput instanceof HTMLInputElement) ||
    !(continueButton instanceof HTMLAnchorElement)
  ) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  const applyBusinessProfileUiCopy = () => {
    const profileUiCopy = getProfileUiCopy();

    if (businessPhoneLabelText instanceof HTMLElement) {
      businessPhoneLabelText.textContent =
        profileUiCopy.fieldPhoneLabel || DEFAULT_BUSINESS_PHONE_LABEL;
    }

    businessPhoneInput.placeholder =
      profileUiCopy.fieldPhonePlaceholder || DEFAULT_PHONE_PLACEHOLDER;
  };

  const hydrateClient = async () => {
    try {
      await loadPublicConfig().catch(() => ({}));
      applyBusinessProfileUiCopy();

      const payload = await apiRequest(`/api/platform/clients/${clientId}`);
      businessNameInput.value = payload.client.businessName ?? '';
      businessWebsiteInput.value = payload.client.website ?? '';
      businessPhoneInput.value = payload.client.businessPhoneNumber ?? '';
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load client');
    }
  };

  const saveBusinessProfile = async () => {
    if (!businessNameInput.value.trim()) {
      businessNameInput.focus();
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/business-profile`, {
        method: 'PATCH',
        body: JSON.stringify({
          businessName: businessNameInput.value.trim(),
          website: businessWebsiteInput.value.trim(),
          businessPhoneNumber: businessPhoneInput.value.trim()
        })
      });

      redirectTo('/onboarding/service-types', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save business profile');
    }
  };

  businessForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    await saveBusinessProfile();
  });

  continueButton.addEventListener('click', async (event) => {
    event.preventDefault();
    await saveBusinessProfile();
  });

  hydrateClient();
};

const initServiceTypes = () => {
  const selectedSummary = document.querySelector('#selected-summary');
  const continueButton = document.querySelector('#service-types-continue');
  const selectAllButton = document.querySelector('#service-types-select-all');
  const clearAllButton = document.querySelector('#service-types-clear-all');
  const cards = document.querySelectorAll('[data-service-type]');

  if (
    !(selectedSummary instanceof HTMLDivElement) ||
    !(continueButton instanceof HTMLAnchorElement) ||
    !(selectAllButton instanceof HTMLButtonElement) ||
    !(clearAllButton instanceof HTMLButtonElement) ||
    cards.length === 0
  ) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  const selectedServices = new Set();

  const updateSummary = () => {
    if (selectedServices.size === 0) {
      selectedSummary.textContent = 'No categories selected yet';
      selectedSummary.classList.add('is-empty');
      continueButton.classList.add('onboarding-continue-disabled');
      continueButton.setAttribute('aria-disabled', 'true');
      clearAllButton.disabled = true;
      selectAllButton.disabled = false;
      return;
    }

    selectedSummary.textContent = `Selected: ${Array.from(selectedServices).join(', ')}`;
    selectedSummary.classList.remove('is-empty');
    continueButton.classList.remove('onboarding-continue-disabled');
    continueButton.setAttribute('aria-disabled', 'false');
    clearAllButton.disabled = false;
    selectAllButton.disabled = selectedServices.size === cards.length;
  };

  const applySelection = (serviceType, card, forceSelected = null) => {
    const shouldSelect = forceSelected ?? !selectedServices.has(serviceType);

    if (!shouldSelect) {
      selectedServices.delete(serviceType);
      card.classList.remove('is-selected');
      updateSummary();
      return;
    }

    selectedServices.add(serviceType);
    card.classList.add('is-selected');
    updateSummary();
  };

  for (const card of cards) {
    if (!(card instanceof HTMLButtonElement)) {
      continue;
    }

    card.addEventListener('click', () => {
      const serviceType = card.dataset.serviceType;

      if (!serviceType) {
        return;
      }

      applySelection(serviceType, card);
    });
  }

  selectAllButton.addEventListener('click', () => {
    for (const card of cards) {
      if (!(card instanceof HTMLButtonElement)) {
        continue;
      }

      const serviceType = card.dataset.serviceType;

      if (!serviceType) {
        continue;
      }

      applySelection(serviceType, card, true);
    }
  });

  clearAllButton.addEventListener('click', () => {
    for (const card of cards) {
      if (!(card instanceof HTMLButtonElement)) {
        continue;
      }

      const serviceType = card.dataset.serviceType;

      if (!serviceType) {
        continue;
      }

      applySelection(serviceType, card, false);
    }
  });

  continueButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (selectedServices.size === 0) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/service-types`, {
        method: 'PATCH',
        body: JSON.stringify({
          serviceTypes: Array.from(selectedServices)
        })
      });

      redirectTo('/onboarding/account-type', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save service types');
    }
  });

  apiRequest(`/api/platform/clients/${clientId}`)
    .then((payload) => {
      for (const serviceType of payload.client.serviceTypes ?? []) {
        const card = document.querySelector(`[data-service-type="${CSS.escape(serviceType)}"]`);

        if (card instanceof HTMLButtonElement) {
          applySelection(serviceType, card, true);
        }
      }

      updateSummary();
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load service types');
    });

  updateSummary();
};

const initAccountType = () => {
  const continueButton = document.querySelector('#account-type-continue');
  const cards = document.querySelectorAll('[data-account-type]');

  if (!(continueButton instanceof HTMLAnchorElement) || cards.length === 0) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  let selectedAccountType = '';

  const updateContinue = () => {
    if (!selectedAccountType) {
      continueButton.classList.add('onboarding-continue-disabled');
      continueButton.setAttribute('aria-disabled', 'true');
      return;
    }

    continueButton.classList.remove('onboarding-continue-disabled');
    continueButton.setAttribute('aria-disabled', 'false');
  };

  const setSelectedCard = (accountType) => {
    selectedAccountType = accountType;

    for (const card of cards) {
      if (card instanceof HTMLButtonElement) {
        card.classList.toggle('is-selected', card.dataset.accountType === accountType);
      }
    }

    updateContinue();
  };

  for (const card of cards) {
    if (!(card instanceof HTMLButtonElement)) {
      continue;
    }

    card.addEventListener('click', () => {
      const accountType = card.dataset.accountType;

      if (accountType) {
        setSelectedCard(accountType);
      }
    });
  }

  continueButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!selectedAccountType) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/account-type`, {
        method: 'PATCH',
        body: JSON.stringify({ accountType: selectedAccountType })
      });

      redirectTo('/onboarding/service-location', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save account type');
    }
  });

  apiRequest(`/api/platform/clients/${clientId}`)
    .then((payload) => {
      if (payload.client.accountType) {
        setSelectedCard(payload.client.accountType);
      } else {
        updateContinue();
      }
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load account type');
    });

  updateContinue();
};

const initServiceLocation = () => {
  const continueButton = document.querySelector('#service-location-continue');
  const cards = document.querySelectorAll('[data-service-location]');

  if (!(continueButton instanceof HTMLAnchorElement) || cards.length === 0) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  const selectedServiceLocations = new Set();

  const updateContinue = () => {
    if (selectedServiceLocations.size === 0) {
      continueButton.classList.add('onboarding-continue-disabled');
      continueButton.setAttribute('aria-disabled', 'true');
      return;
    }

    continueButton.classList.remove('onboarding-continue-disabled');
    continueButton.setAttribute('aria-disabled', 'false');
  };

  const toggleSelectedCard = (serviceLocation, forceSelected = null) => {
    const shouldSelect = forceSelected ?? !selectedServiceLocations.has(serviceLocation);

    if (!shouldSelect) {
      selectedServiceLocations.delete(serviceLocation);
    } else {
      selectedServiceLocations.add(serviceLocation);
    }

    for (const card of cards) {
      if (card instanceof HTMLButtonElement && card.dataset.serviceLocation) {
        card.classList.toggle(
          'is-selected',
          selectedServiceLocations.has(card.dataset.serviceLocation)
        );
      }
    }

    updateContinue();
  };

  for (const card of cards) {
    if (!(card instanceof HTMLButtonElement)) {
      continue;
    }

    card.addEventListener('click', () => {
      const serviceLocation = card.dataset.serviceLocation;

      if (serviceLocation) {
        toggleSelectedCard(serviceLocation);
      }
    });
  }

  continueButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (selectedServiceLocations.size === 0) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/service-location`, {
        method: 'PATCH',
        body: JSON.stringify({ serviceLocation: Array.from(selectedServiceLocations) })
      });

      redirectTo('/onboarding/venue-location', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save service location');
    }
  });

  apiRequest(`/api/platform/clients/${clientId}`)
    .then((payload) => {
      if (Array.isArray(payload.client.serviceLocation)) {
        for (const serviceLocation of payload.client.serviceLocation) {
          toggleSelectedCard(serviceLocation, true);
        }
      }

      updateContinue();
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load service location');
    });

  updateContinue();
};

const initVenueLocation = () => {
  const venueAddressInput = document.querySelector('#venue-address-search');
  const selectedVenueAddress = document.querySelector('#selected-venue-address');
  const venueAddressContinue = document.querySelector('#venue-address-continue');
  const venueAddressEdit = document.querySelector('#venue-address-edit');
  const venueCurrentLocation = document.querySelector('#venue-current-location');
  const venueLocationStatus = document.querySelector('#venue-location-status');
  const venueSearchResults = document.querySelector('#venue-search-results');
  const venueSearchResultsTitle = document.querySelector('#venue-search-results-title');
  const venueSearchResultsStatus = document.querySelector('#venue-search-results-status');
  const venueMapLabel = document.querySelector('#venue-map-label');
  const venueMapTitle = document.querySelector('#venue-map-title');
  const venueMapAddress = document.querySelector('#venue-map-address');

  if (
    !(venueAddressInput instanceof HTMLTextAreaElement) ||
    !(selectedVenueAddress instanceof HTMLParagraphElement) ||
    !(venueAddressContinue instanceof HTMLButtonElement) ||
    !(venueSearchResults instanceof HTMLDivElement) ||
    !(venueSearchResultsTitle instanceof HTMLElement) ||
    !(venueSearchResultsStatus instanceof HTMLElement) ||
    !(venueMapLabel instanceof HTMLDivElement) ||
    !(venueMapTitle instanceof HTMLElement) ||
    !(venueMapAddress instanceof HTMLParagraphElement)
  ) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  let selectedVenue = '';
  let activeSearchAbortController = null;
  let latestSearchRequestId = 0;
  let locationCountryLabel = '';

  const setLocationStatus = (message) => {
    if (venueLocationStatus instanceof HTMLParagraphElement) {
      venueLocationStatus.textContent = message;
    }
  };

  const setResultsStatus = (message) => {
    venueSearchResultsStatus.textContent = message;
  };

  const clearSearchResults = () => {
    venueSearchResults.replaceChildren();
    venueSearchResults.classList.add('is-hidden');
  };

  const setCurrentLocationButtonLoading = (isLoading) => {
    if (!(venueCurrentLocation instanceof HTMLButtonElement)) {
      return;
    }

    venueCurrentLocation.classList.toggle('is-loading', isLoading);
    venueCurrentLocation.disabled = isLoading;
    venueCurrentLocation.textContent = isLoading ? 'Detecting location...' : 'Use current location';
  };

  const updateContinue = () => {
    const disabled = selectedVenue.trim().length < 3;
    venueAddressContinue.classList.toggle('onboarding-continue-disabled', disabled);
    venueAddressContinue.disabled = disabled;
  };

  const syncVenuePreview = (nextVenue) => {
    selectedVenue = nextVenue.trim();

    if (!selectedVenue) {
      selectedVenueAddress.textContent = 'Start typing your venue address to preview it here.';
      venueMapLabel.textContent = 'Your venue';
      venueMapTitle.textContent = 'Your venue';
      venueMapAddress.textContent =
        'Start typing your address to preview how it will appear on your booking page.';
      updateContinue();
      return;
    }

    setMultilineAddress(selectedVenueAddress, selectedVenue);
    venueMapLabel.textContent = selectedVenue.split(',')[0]?.trim() || 'Your venue';
    venueMapTitle.textContent = venueMapLabel.textContent;
    venueMapAddress.textContent = selectedVenue;
    updateContinue();
  };

  const applyLocationConfig = (config) => {
    locationCountryLabel = config.locationSearchCountryLabel?.trim() ?? '';
    venueSearchResultsTitle.textContent = locationCountryLabel
      ? `Location suggestions in ${locationCountryLabel}`
      : 'Location suggestions';
    venueAddressInput.placeholder = locationCountryLabel
      ? `Example: Shop number, street, area, city, province, ${locationCountryLabel}`
      : 'Example: Shop number, street, area, city, province, country';
  };

  const applySuggestedVenue = (nextVenue) => {
    venueAddressInput.value = nextVenue;
    syncVenuePreview(nextVenue);
    clearSearchResults();
    setResultsStatus(
      locationCountryLabel
        ? `Suggestion selected. You can keep editing to search more places in ${locationCountryLabel}.`
        : 'Suggestion selected. You can keep editing to search more places.'
    );
  };

  const renderSearchResults = (suggestions) => {
    venueSearchResults.replaceChildren();

    if (!Array.isArray(suggestions) || suggestions.length === 0) {
      clearSearchResults();
      setResultsStatus(
        locationCountryLabel
          ? `No matching locations found in ${locationCountryLabel}.`
          : 'No matching locations found.'
      );
      return;
    }

    suggestions.forEach((suggestion) => {
      const resultButton = document.createElement('button');
      resultButton.type = 'button';
      resultButton.className = 'venue-search-result';
      resultButton.innerHTML = `
        <strong>${escapeHtml(suggestion.primaryLabel || suggestion.label || 'Location')}</strong>
        <span>${escapeHtml(suggestion.secondaryLabel || suggestion.label || '')}</span>
      `;
      resultButton.addEventListener('click', () => {
        applySuggestedVenue(suggestion.label || '');
        venueAddressInput.focus();
      });
      venueSearchResults.append(resultButton);
    });

    venueSearchResults.classList.remove('is-hidden');
    setResultsStatus(
      locationCountryLabel
        ? `Choose a matching place in ${locationCountryLabel}, or keep typing to refine the search.`
        : 'Choose a matching place, or keep typing to refine the search.'
    );
  };

  const searchLocations = async (query) => {
    const trimmedQuery = query.trim();

    if (trimmedQuery.length < 2) {
      clearSearchResults();
      setResultsStatus(
        locationCountryLabel
          ? `Start typing to search locations in ${locationCountryLabel}.`
          : 'Start typing to search for matching locations.'
      );
      return;
    }

    if (activeSearchAbortController instanceof AbortController) {
      activeSearchAbortController.abort();
    }

    latestSearchRequestId += 1;
    const requestId = latestSearchRequestId;
    activeSearchAbortController = new AbortController();

    setResultsStatus(
      locationCountryLabel
        ? `Searching locations in ${locationCountryLabel}...`
        : 'Searching locations...'
    );

    try {
      const payload = await apiRequest(
        `/api/public/locations/search?q=${encodeURIComponent(trimmedQuery)}`,
        { signal: activeSearchAbortController.signal }
      );

      if (requestId !== latestSearchRequestId) {
        return;
      }

      if (payload?.countryLabel) {
        locationCountryLabel = payload.countryLabel.trim();
        venueSearchResultsTitle.textContent = locationCountryLabel
          ? `Location suggestions in ${locationCountryLabel}`
          : 'Location suggestions';
      }

      renderSearchResults(payload?.suggestions ?? []);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      clearSearchResults();
      setResultsStatus(error instanceof Error ? error.message : 'Unable to search locations');
    }
  };

  const debouncedSearchLocations = debounce((query) => {
    void searchLocations(query);
  }, 280);

  const detectCurrentLocation = async () => {
    if (!(venueCurrentLocation instanceof HTMLButtonElement)) {
      return;
    }

    if (!navigator.geolocation) {
      setLocationStatus('Location access is not available in this browser. Enter the address manually.');
      return;
    }

    setCurrentLocationButtonLoading(true);
    setLocationStatus('Requesting your current location...');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const params = new URLSearchParams({
            latitude: String(position.coords.latitude),
            longitude: String(position.coords.longitude)
          });
          const payload = await apiRequest(`/api/public/locations/reverse?${params.toString()}`);
          const detectedLocation = payload?.location?.label?.trim() ?? '';

          if (!detectedLocation) {
            setLocationStatus('Location detected, but no address could be resolved. You can enter it manually.');
            return;
          }

          applySuggestedVenue(detectedLocation);
          setLocationStatus('Current location detected. You can edit the address if you need changes.');
        } catch (error) {
          setLocationStatus(
            error instanceof Error
              ? error.message
              : 'Unable to detect the current location right now.'
          );
        } finally {
          setCurrentLocationButtonLoading(false);
        }
      },
      (error) => {
        const errorMessage =
          error.code === error.PERMISSION_DENIED
            ? 'Location permission was denied. You can still enter the address manually.'
            : error.code === error.POSITION_UNAVAILABLE
              ? 'Current location is unavailable right now. Try again or enter the address manually.'
              : error.code === error.TIMEOUT
                ? 'Location detection timed out. Try again or enter the address manually.'
                : 'Unable to access your current location right now.';

        setLocationStatus(errorMessage);
        setCurrentLocationButtonLoading(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 300000
      }
    );
  };

  venueAddressInput.addEventListener('input', () => {
    syncVenuePreview(venueAddressInput.value);
    debouncedSearchLocations(venueAddressInput.value);
  });

  if (venueAddressEdit instanceof HTMLButtonElement) {
    venueAddressEdit.addEventListener('click', () => {
      venueAddressInput.focus();
      venueAddressInput.select();
    });
  }

  if (venueCurrentLocation instanceof HTMLButtonElement) {
    venueCurrentLocation.addEventListener('click', () => {
      void detectCurrentLocation();
    });
  }

  venueAddressContinue.addEventListener('click', async () => {
    if (!selectedVenue) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/venue-location`, {
        method: 'PATCH',
        body: JSON.stringify({ venueAddress: selectedVenue })
      });

      redirectTo('/onboarding/launch-links', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save venue location');
    }
  });

  loadPublicConfig()
    .then((config) => {
      applyLocationConfig(config ?? {});
      setResultsStatus(
        locationCountryLabel
          ? `Start typing to search locations in ${locationCountryLabel}.`
          : 'Start typing to search for matching locations.'
      );
    })
    .catch(() => {
      setResultsStatus('Start typing to search for matching locations.');
    });

  apiRequest(`/api/platform/clients/${clientId}`)
    .then((payload) => {
      const savedVenue = payload.client.venueAddress;

      if (savedVenue) {
        venueAddressInput.value = savedVenue;
        syncVenuePreview(savedVenue);
        setLocationStatus('Saved location loaded. You can edit it or use your current location.');
        return;
      }

      syncVenuePreview('');
      setLocationStatus('Allow location access to detect your current venue and edit it if needed.');
      window.setTimeout(() => {
        void detectCurrentLocation();
      }, 300);
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load venue location');
    });
};

const initCalendar = () => {
  void loadPublicConfig().catch(() => {});

  const calendarMain = document.querySelector('.calendar-main');
  const calendarToolbar = document.querySelector('.calendar-toolbar');
  const brand = document.querySelector('#calendar-brand');
  const planChip = document.querySelector('#calendar-plan-chip');
  const setupLabel = document.querySelector('#calendar-setup-label');
  const setupButton = document.querySelector('#calendar-setup-button');
  const userAvatar = document.querySelector('#calendar-user-avatar');
  const staffAvatar = document.querySelector('#calendar-staff-avatar');
  const staffName = document.querySelector('#calendar-staff-name');
  const dateLabel = document.querySelector('#calendar-date-label');
  const dateLabelText = document.querySelector('#calendar-date-label-text');
  const dateInput = document.querySelector('#calendar-date-input');
  const nowBadge = document.querySelector('#calendar-now-badge');
  const addButton = document.querySelector('#calendar-add-button');
  const addButtonLabel = document.querySelector('#calendar-add-button-label');
  const addMenu = document.querySelector('#calendar-add-menu');
  const addMenuItems = document.querySelectorAll('.calendar-add-item');
  const todayAction = document.querySelector('#calendar-today-action');
  const prevDayAction = document.querySelector('#calendar-prev-day-action');
  const nextDayAction = document.querySelector('#calendar-next-day-action');
  const teamShortcut = document.querySelector('#calendar-team-shortcut');
  const filtersAction = document.querySelector('#calendar-filters-action');
  const settingsAction = document.querySelector('#calendar-settings-action');
  const appointmentsAction = document.querySelector('#calendar-appointments-action');
  const refreshAction = document.querySelector('#calendar-refresh-action');
  const viewToggle = document.querySelector('#calendar-view-toggle');
  const searchAction = document.querySelector('#calendar-search-action');
  const analyticsAction = document.querySelector('#calendar-analytics-action');
  const notificationsAction = document.querySelector('#calendar-notifications-action');
  const notificationsBadge = document.querySelector('#calendar-notifications-badge');
  const homeAction = document.querySelector('#calendar-home-action');
  const profileAction = document.querySelector('#calendar-profile-action');
  const marketingAction = document.querySelector('#calendar-marketing-action');
  const moreAction = document.querySelector('#calendar-more-action');
  const bookAppointmentAction = document.querySelector('#calendar-book-appointment-action');
  const showQrAction = document.querySelector('#calendar-show-qr-action');
  const groupAppointmentAction = document.querySelector('#calendar-group-appointment-action');
  const blockedTimeAction = document.querySelector('#calendar-blocked-time-action');
  const quickPaymentAction = document.querySelector('#calendar-quick-payment-action');
  const calendarNavCalendar = document.querySelector('#calendar-nav-calendar');
  const salesToggle = document.querySelector('#calendar-sales-toggle');
  const saleAction = document.querySelector('#calendar-sale-action');
  const salesPanel = document.querySelector('#calendar-sales-panel');
  const clientsToggle = document.querySelector('#calendar-clients-toggle');
  const clientsPanel = document.querySelector('#calendar-clients-panel');
  const catalogToggle = document.querySelector('#calendar-catalog-toggle');
  const catalogPanel = document.querySelector('#calendar-catalog-panel');
  const teamToggle = document.querySelector('#calendar-team-toggle');
  const teamPanel = document.querySelector('#calendar-team-panel');
  const reportsToggle = document.querySelector('#calendar-reports-toggle');
  const reportsView = document.querySelector('#calendar-reports-view');
  const calendarBoard = document.querySelector('.calendar-board');
  const salesTitle = document.querySelector('#calendar-sales-title');
  const salesContent = document.querySelector('#calendar-sales-content');
  const clientsTitle = document.querySelector('#calendar-clients-title');
  const clientsContent = document.querySelector('#calendar-clients-content');
  const catalogTitle = document.querySelector('#calendar-catalog-title');
  const catalogContent = document.querySelector('#calendar-catalog-content');
  const teamTitle = document.querySelector('#calendar-team-title');
  const teamContent = document.querySelector('#calendar-team-content');
  const reportsSidebarTitle = document.querySelector('#calendar-reports-sidebar-title');
  const reportsMenu = document.querySelector('#calendar-reports-menu');
  const reportsFolderTitle = document.querySelector('#calendar-reports-folder-title');
  const reportsFolderAction = document.querySelector('#calendar-reports-folder-action');
  const reportsConnectorLabel = document.querySelector('#calendar-reports-connector-label');
  const reportsTitle = document.querySelector('#calendar-reports-title');
  const reportsSubtitle = document.querySelector('#calendar-reports-subtitle');
  const reportsTotal = document.querySelector('#calendar-reports-total');
  const reportsSummary = document.querySelector('#calendar-reports-summary');
  const reportsSearchInput = document.querySelector('#calendar-reports-search-input');
  const reportsFilters = document.querySelector('#calendar-reports-filters');
  const reportsRange = document.querySelector('#calendar-reports-range');
  const reportsActionsBar = document.querySelector('#calendar-reports-actions-bar');
  const reportsTabs = document.querySelector('#calendar-reports-tabs');
  const reportsCards = document.querySelector('#calendar-reports-cards');
  const bookingLink = document.querySelector('#calendar-booking-link');
  const onlineBookingsTitle = document.querySelector('#calendar-online-bookings-title');
  const onlineBookingsDescription = document.querySelector('#calendar-online-bookings-description');
  const overviewDayCount = document.querySelector('#calendar-overview-day-count');
  const overviewBookedCount = document.querySelector('#calendar-overview-booked-count');
  const overviewNextClient = document.querySelector('#calendar-overview-next-client');
  const overviewSelectedDayLabel = document.querySelector('#calendar-overview-selected-day-label');
  const overviewSelectedDayMeta = document.querySelector('#calendar-overview-selected-day-meta');
  const overviewComingAppointmentLabel = document.querySelector('#calendar-overview-coming-appointment-label');
  const overviewComingAppointmentMeta = document.querySelector('#calendar-overview-coming-appointment-meta');
  const overviewNextClientLabel = document.querySelector('#calendar-overview-next-client-label');
  const overviewNextClientMeta = document.querySelector('#calendar-overview-next-client-meta');
  const filterBar = document.querySelector('#calendar-filter-bar');
  const filterAll = document.querySelector('#calendar-filter-all');
  const filterBooked = document.querySelector('#calendar-filter-booked');
  const filterQr = document.querySelector('#calendar-filter-qr');
  const appointmentsList = document.querySelector('#calendar-appointments-list');
  const calendarTimes = document.querySelector('.calendar-times');
  const calendarGrid = document.querySelector('.calendar-grid');
  const appointmentsOverlay = document.querySelector('#calendar-appointments-overlay');
  const qrModal = document.querySelector('#calendar-qr-modal');
  const qrClose = document.querySelector('#calendar-qr-close');
  const qrImage = document.querySelector('#calendar-qr-image');
  const qrLink = document.querySelector('#calendar-qr-link');
  const qrPrint = document.querySelector('#calendar-qr-print');
  const shareDirectLink = document.querySelector('#calendar-share-direct-link');
  const shareInstagramLink = document.querySelector('#calendar-share-instagram-link');
  const shareFacebookLink = document.querySelector('#calendar-share-facebook-link');
  const shareAppleMapsLink = document.querySelector('#calendar-share-applemaps-link');
  const shareQrLink = document.querySelector('#calendar-share-qr-link');
  const qrEyebrow = document.querySelector('#calendar-qr-eyebrow');
  const qrTitle = document.querySelector('#calendar-qr-title');
  const qrDescription = document.querySelector('#calendar-qr-description');
  const toolModal = document.querySelector('#calendar-tool-modal');
  const toolDialog = document.querySelector('.calendar-tool-dialog');
  const toolClose = document.querySelector('#calendar-tool-close');
  const toolEyebrow = document.querySelector('#calendar-tool-eyebrow');
  const toolTitle = document.querySelector('#calendar-tool-title');
  const toolDescription = document.querySelector('#calendar-tool-description');
  const toolActions = document.querySelector('#calendar-tool-actions');

  if (
    !(calendarMain instanceof HTMLElement) ||
    !(calendarToolbar instanceof HTMLElement) ||
    !(brand instanceof HTMLAnchorElement) ||
    !(planChip instanceof HTMLButtonElement) ||
    !(calendarNavCalendar instanceof HTMLAnchorElement) ||
    !(setupLabel instanceof HTMLSpanElement) ||
    !(setupButton instanceof HTMLAnchorElement) ||
    !(userAvatar instanceof HTMLButtonElement) ||
    !(staffAvatar instanceof HTMLDivElement) ||
    !(staffName instanceof HTMLElement) ||
    !(dateLabel instanceof HTMLButtonElement) ||
    !(dateLabelText instanceof HTMLElement) ||
    !(dateInput instanceof HTMLInputElement) ||
    !(nowBadge instanceof HTMLSpanElement) ||
    !(reportsToggle instanceof HTMLButtonElement) ||
    !(reportsView instanceof HTMLElement) ||
    !(calendarBoard instanceof HTMLElement)
  ) {
    return;
  }

  const hasAddMenu =
    addButton instanceof HTMLButtonElement && addMenu instanceof HTMLDivElement;
  const hasSalesDrawer =
    salesToggle instanceof HTMLButtonElement &&
    saleAction instanceof HTMLButtonElement &&
    salesPanel instanceof HTMLElement;
  const hasClientsDrawer =
    clientsToggle instanceof HTMLButtonElement && clientsPanel instanceof HTMLElement;
  const hasCatalogDrawer =
    catalogToggle instanceof HTMLButtonElement && catalogPanel instanceof HTMLElement;
  const hasTeamDrawer =
    teamToggle instanceof HTMLButtonElement && teamPanel instanceof HTMLElement;
  const hasSideDrawers =
    hasSalesDrawer || hasClientsDrawer || hasCatalogDrawer || hasTeamDrawer;
  let publicBookingPath = '';
  let instagramBookingPath = '';
  let facebookBookingPath = '';
  let appleMapsBookingPath = '';
  let qrBookingPath = '';
  let qrCodeImagePath = '';
  let dashboardPayload = null;
  let paymentsPayload = null;
  let billingPayload = null;
  let selectedDate = new Date();
  let appointmentFilter = 'all';
  let currentView = 'day';
  let reportsInteractionsBound = false;
  let setupActionHandled = false;
  let reportsWorkspace = getReportsWorkspaceState(getClientId());
  let activeReportsMenu = 'all reports';
  let activeReportsTab = 'all reports';
  let isNotificationRefreshInFlight = false;
  let activeReportsFilters = {
    createdBy: 'all',
    category: 'all'
  };
  let activeReportsFolderId = '';
  let reportsDateRange = '30d';

  const isBillingFeatureLocked = (featureKey) =>
    Array.isArray(billingPayload?.lockedFeatureKeys) &&
    billingPayload.lockedFeatureKeys.includes(featureKey);

  const getBillingFeatureLabel = (featureKey) => {
    const matchedFeature = Array.isArray(billingPayload?.featureAccess)
      ? billingPayload.featureAccess.find((feature) => feature.key === featureKey)
      : null;

    return matchedFeature?.label || 'This feature';
  };

  const getPricingPath = () => buildPathWithClientId('/pricing', clientId);

  const redirectToPricingForUpgrade = (featureKey) => {
    const featureLabel = getBillingFeatureLabel(featureKey);
    window.sessionStorage.setItem(
      'qr-platform-upgrade-reason',
      `${featureLabel} requires a higher plan. Choose a plan and complete demo checkout to unlock it.`
    );
    window.location.assign(getPricingPath());
  };

  const guardBillingFeature = (featureKey) => {
    if (!isBillingFeatureLocked(featureKey)) {
      return false;
    }

    redirectToPricingForUpgrade(featureKey);
    return true;
  };

  const setBillingLockedState = (element, featureKey) => {
    if (!(element instanceof HTMLElement)) {
      return;
    }

    const isLocked = isBillingFeatureLocked(featureKey);
    element.classList.toggle('calendar-billing-locked', isLocked);
    element.setAttribute(
      'title',
      isLocked
        ? `${getBillingFeatureLabel(featureKey)} requires a higher plan`
        : element.getAttribute('aria-label') || ''
    );
  };

  const renderBillingPlanChip = () => {
    const currentPlan = billingPayload?.currentPlan;
    const subscriptionStatus = billingPayload?.subscription?.status;
    const remainingCredits = Number(billingPayload?.creditBalance?.remaining ?? 0);
    const grantedCredits = Number(billingPayload?.creditBalance?.granted ?? 0);

    planChip.classList.toggle('is-active', Boolean(currentPlan));
    planChip.innerHTML = `
      <span>Using plan</span>
      <strong>${escapeHtml(currentPlan?.name ?? 'No plan')} | ${remainingCredits}/${grantedCredits} credits</strong>
    `;
    planChip.setAttribute(
      'aria-label',
      currentPlan
        ? `Using ${currentPlan.name} plan, status ${subscriptionStatus ?? 'active'}, ${remainingCredits} appointment credits remaining`
        : 'No subscription plan selected, 0 appointment credits remaining'
    );

    setBillingLockedState(salesToggle, 'payments');
    setBillingLockedState(saleAction, 'payments');
    setBillingLockedState(quickPaymentAction, 'payments');
    setBillingLockedState(clientsToggle, 'client_crm');
    setBillingLockedState(catalogToggle, 'products');
    setBillingLockedState(teamToggle, 'team_management');
    setBillingLockedState(teamShortcut, 'team_management');
    setBillingLockedState(reportsToggle, 'advanced_reports');
    setBillingLockedState(analyticsAction, 'advanced_reports');
    setBillingLockedState(marketingAction, 'marketing');
  };

  const getSelectedDateValue = () => {
    const year = selectedDate.getFullYear();
    const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
    const day = String(selectedDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const closeToolModal = () => {
    if (!(toolModal instanceof HTMLDivElement)) {
      return;
    }

    toolModal.classList.add('is-hidden');
    toolModal.setAttribute('aria-hidden', 'true');

    if (toolDialog instanceof HTMLDivElement) {
      toolDialog.classList.remove('calendar-tool-dialog-wide');
    }
  };

  const setFilterBarVisibility = (isVisible) => {
    if (!(filterBar instanceof HTMLElement)) {
      return;
    }

    filterBar.classList.toggle('is-hidden', !isVisible);

    if (filtersAction instanceof HTMLButtonElement) {
      filtersAction.classList.toggle('is-active', isVisible);
      filtersAction.setAttribute('aria-pressed', isVisible ? 'true' : 'false');
    }
  };

  const openToolModal = ({
    eyebrow = 'Calendar tool',
    title,
    description,
    actions = [],
    dialogClassName = ''
  }) => {
    if (
      !(toolModal instanceof HTMLDivElement) ||
      !(toolDialog instanceof HTMLDivElement) ||
      !(toolEyebrow instanceof HTMLElement) ||
      !(toolTitle instanceof HTMLElement) ||
      !(toolDescription instanceof HTMLElement) ||
      !(toolActions instanceof HTMLElement)
    ) {
      safeAlert(title);
      return;
    }

    toolEyebrow.textContent = eyebrow;
    toolTitle.textContent = title;
    toolDescription.textContent = description;
    toolActions.replaceChildren(...actions);
    toolDialog.classList.toggle('calendar-tool-dialog-wide', dialogClassName === 'wide');
    toolModal.classList.remove('is-hidden');
    toolModal.setAttribute('aria-hidden', 'false');
  };

  const getDashboardAppointments = () => {
    const appointments = dashboardPayload?.dashboard?.appointments;
    return Array.isArray(appointments) ? appointments : [];
  };

  const getDashboardBusinessSettings = () =>
    normalizeBusinessSettings(dashboardPayload?.client?.businessSettings);

  const getCalendarTimeSlots = () => getDashboardBusinessSettings().slotTimes;

  const syncCalendarTimeGrid = () => {
    if (
      !(calendarTimes instanceof HTMLElement) ||
      !(calendarGrid instanceof HTMLElement) ||
      !(appointmentsOverlay instanceof HTMLElement)
    ) {
      return;
    }

    const calendarTimeSlots = getCalendarTimeSlots();
    const rowTemplate = `repeat(${calendarTimeSlots.length}, minmax(88px, 1fr))`;
    const existingNowLine = calendarGrid.querySelector('.calendar-now-line');
    const existingOverlay = calendarGrid.querySelector('#calendar-appointments-overlay');

    calendarTimes.replaceChildren(
      ...calendarTimeSlots.map((slotTime) => {
        const label = document.createElement('span');
        label.innerHTML = formatTimeForDisplay(slotTime).replace(' ', '<br />');
        return label;
      })
    );

    const slotElements = calendarTimeSlots.map(() => {
      const slot = document.createElement('div');
      slot.className = 'calendar-slot';
      return slot;
    });

    calendarGrid.replaceChildren(
      ...(existingNowLine ? [existingNowLine] : []),
      ...(existingOverlay ? [existingOverlay] : []),
      ...slotElements
    );

    calendarTimes.style.gridTemplateRows = rowTemplate;
    calendarGrid.style.gridTemplateRows = rowTemplate;
    appointmentsOverlay.style.gridTemplateRows = rowTemplate;
    calendarBoard.style.setProperty('--calendar-slot-count', String(calendarTimeSlots.length));
  };

  const getDashboardServices = () => {
    const services = dashboardPayload?.client?.services;
    return Array.isArray(services) ? services : [];
  };

  const getDashboardProducts = () => {
    const products = dashboardPayload?.client?.products;
    return Array.isArray(products) ? products : [];
  };

  const getDashboardProductSales = () => {
    const productSales = dashboardPayload?.client?.productSales;
    return Array.isArray(productSales) ? productSales : [];
  };

  const getDashboardPackagePlans = () => {
    const packagePlans = dashboardPayload?.client?.packagePlans;
    return Array.isArray(packagePlans) ? packagePlans : [];
  };

  const getDashboardLoyaltyProgram = () => {
    const loyaltyProgram = dashboardPayload?.client?.loyaltyProgram;
    return loyaltyProgram && typeof loyaltyProgram === 'object' ? loyaltyProgram : null;
  };

  const getDashboardCommerce = () => {
    const commerce = dashboardPayload?.dashboard?.commerce;

    if (!commerce || typeof commerce !== 'object') {
      return {
        activePackagePlans: 0,
        packagesSold: 0,
        activePackageBalances: 0,
        availableLoyaltyRewards: 0,
        loyaltyProgramEnabled: false,
        activeProducts: 0,
        productsSold: 0,
        productUnitsSold: 0,
        lowStockProducts: 0
      };
    }

    return commerce;
  };

  const getPaymentsSummary = () => {
    const summary = paymentsPayload?.summary;

    if (!summary || typeof summary !== 'object') {
      return {
        currencyCode: '',
        expectedAmountValue: 0,
        collectedAmountValue: 0,
        pendingAmountValue: 0,
        overpaidAmountValue: 0,
        recordedPaymentsCount: 0,
        outstandingAppointmentsCount: 0
      };
    }

    return summary;
  };

  const getPaymentBalances = () => {
    const balances = paymentsPayload?.balances;
    return Array.isArray(balances) ? balances : [];
  };

  const getPaymentRecords = () => {
    const payments = paymentsPayload?.payments;
    return Array.isArray(payments) ? payments : [];
  };

  const getDashboardTeamMembers = () => {
    const teamMembers = dashboardPayload?.client?.teamMembers;
    return Array.isArray(teamMembers) ? teamMembers : [];
  };

  const getDashboardCustomerProfiles = () => {
    const customerProfiles = dashboardPayload?.client?.customerProfiles;
    return Array.isArray(customerProfiles) ? customerProfiles : [];
  };

  const formatRoleLabelDisplay = (value) =>
    String(value)
      .split(' ')
      .filter(Boolean)
      .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
      .join(' ');

  const getServiceUiCopy = () => ({
    singular:
      typeof currentPublicConfig?.serviceLabelSingular === 'string'
        ? currentPublicConfig.serviceLabelSingular.trim()
        : '',
    plural:
      typeof currentPublicConfig?.serviceLabelPlural === 'string'
        ? currentPublicConfig.serviceLabelPlural.trim()
        : '',
    menuTitle:
      typeof currentPublicConfig?.serviceMenuTitle === 'string'
        ? currentPublicConfig.serviceMenuTitle.trim()
        : '',
    menuDescription:
      typeof currentPublicConfig?.serviceMenuDescription === 'string'
        ? currentPublicConfig.serviceMenuDescription.trim()
        : '',
    coverageLabel:
      typeof currentPublicConfig?.serviceCoverageLabel === 'string'
        ? currentPublicConfig.serviceCoverageLabel.trim()
        : '',
    emptyTitle:
      typeof currentPublicConfig?.serviceEmptyTitle === 'string'
        ? currentPublicConfig.serviceEmptyTitle.trim()
        : '',
    emptyDescription:
      typeof currentPublicConfig?.serviceEmptyDescription === 'string'
        ? currentPublicConfig.serviceEmptyDescription.trim()
        : '',
    actionAdd:
      typeof currentPublicConfig?.serviceActionAdd === 'string'
        ? currentPublicConfig.serviceActionAdd.trim()
        : '',
    actionEdit:
      typeof currentPublicConfig?.serviceActionEdit === 'string'
        ? currentPublicConfig.serviceActionEdit.trim()
        : '',
    actionRemove:
      typeof currentPublicConfig?.serviceActionRemove === 'string'
        ? currentPublicConfig.serviceActionRemove.trim()
        : '',
    actionSave:
      typeof currentPublicConfig?.serviceActionSave === 'string'
        ? currentPublicConfig.serviceActionSave.trim()
        : '',
    actionUpdate:
      typeof currentPublicConfig?.serviceActionUpdate === 'string'
        ? currentPublicConfig.serviceActionUpdate.trim()
        : '',
    actionOpenBooking:
      typeof currentPublicConfig?.serviceActionOpenBooking === 'string'
        ? currentPublicConfig.serviceActionOpenBooking.trim()
        : '',
    actionStayInCatalog:
      typeof currentPublicConfig?.serviceActionStayInCatalog === 'string'
        ? currentPublicConfig.serviceActionStayInCatalog.trim()
        : '',
    fieldName:
      typeof currentPublicConfig?.serviceFieldNameLabel === 'string'
        ? currentPublicConfig.serviceFieldNameLabel.trim()
        : '',
    fieldCategory:
      typeof currentPublicConfig?.serviceFieldCategoryLabel === 'string'
        ? currentPublicConfig.serviceFieldCategoryLabel.trim()
        : '',
    fieldDuration:
      typeof currentPublicConfig?.serviceFieldDurationLabel === 'string'
        ? currentPublicConfig.serviceFieldDurationLabel.trim()
        : '',
    fieldPrice:
      typeof currentPublicConfig?.serviceFieldPriceLabel === 'string'
        ? currentPublicConfig.serviceFieldPriceLabel.trim()
        : '',
    fieldDescription:
      typeof currentPublicConfig?.serviceFieldDescriptionLabel === 'string'
        ? currentPublicConfig.serviceFieldDescriptionLabel.trim()
        : '',
    formAddDescription:
      typeof currentPublicConfig?.serviceFormAddDescription === 'string'
        ? currentPublicConfig.serviceFormAddDescription.trim()
        : '',
    formEditDescription:
      typeof currentPublicConfig?.serviceFormEditDescription === 'string'
        ? currentPublicConfig.serviceFormEditDescription.trim()
        : '',
    validationRequired:
      typeof currentPublicConfig?.serviceValidationRequired === 'string'
        ? currentPublicConfig.serviceValidationRequired.trim()
        : '',
    validationDuration:
      typeof currentPublicConfig?.serviceValidationDuration === 'string'
        ? currentPublicConfig.serviceValidationDuration.trim()
        : '',
    errorAdd:
      typeof currentPublicConfig?.serviceErrorAdd === 'string'
        ? currentPublicConfig.serviceErrorAdd.trim()
        : '',
    errorUpdate:
      typeof currentPublicConfig?.serviceErrorUpdate === 'string'
        ? currentPublicConfig.serviceErrorUpdate.trim()
        : '',
    errorRemove:
      typeof currentPublicConfig?.serviceErrorRemove === 'string'
        ? currentPublicConfig.serviceErrorRemove.trim()
        : ''
  });

  const getPackageUiCopy = () => ({
    singular:
      typeof currentPublicConfig?.packageLabelSingular === 'string'
        ? currentPublicConfig.packageLabelSingular.trim()
        : '',
    plural:
      typeof currentPublicConfig?.packageLabelPlural === 'string'
        ? currentPublicConfig.packageLabelPlural.trim()
        : '',
    menuTitle:
      typeof currentPublicConfig?.packageMenuTitle === 'string'
        ? currentPublicConfig.packageMenuTitle.trim()
        : '',
    menuDescription:
      typeof currentPublicConfig?.packageMenuDescription === 'string'
        ? currentPublicConfig.packageMenuDescription.trim()
        : '',
    emptyTitle:
      typeof currentPublicConfig?.packageEmptyTitle === 'string'
        ? currentPublicConfig.packageEmptyTitle.trim()
        : '',
    emptyDescription:
      typeof currentPublicConfig?.packageEmptyDescription === 'string'
        ? currentPublicConfig.packageEmptyDescription.trim()
        : '',
    actionAdd:
      typeof currentPublicConfig?.packageActionAdd === 'string'
        ? currentPublicConfig.packageActionAdd.trim()
        : '',
    actionEdit:
      typeof currentPublicConfig?.packageActionEdit === 'string'
        ? currentPublicConfig.packageActionEdit.trim()
        : '',
    actionRemove:
      typeof currentPublicConfig?.packageActionRemove === 'string'
        ? currentPublicConfig.packageActionRemove.trim()
        : '',
    actionSave:
      typeof currentPublicConfig?.packageActionSave === 'string'
        ? currentPublicConfig.packageActionSave.trim()
        : '',
    actionUpdate:
      typeof currentPublicConfig?.packageActionUpdate === 'string'
        ? currentPublicConfig.packageActionUpdate.trim()
        : '',
    actionSell:
      typeof currentPublicConfig?.packageActionSell === 'string'
        ? currentPublicConfig.packageActionSell.trim()
        : '',
    actionOpenReports:
      typeof currentPublicConfig?.packageActionOpenReports === 'string'
        ? currentPublicConfig.packageActionOpenReports.trim()
        : '',
    actionOpenCatalog:
      typeof currentPublicConfig?.packageActionOpenCatalog === 'string'
        ? currentPublicConfig.packageActionOpenCatalog.trim()
        : '',
    fieldName:
      typeof currentPublicConfig?.packageFieldNameLabel === 'string'
        ? currentPublicConfig.packageFieldNameLabel.trim()
        : '',
    fieldTotalUses:
      typeof currentPublicConfig?.packageFieldTotalUsesLabel === 'string'
        ? currentPublicConfig.packageFieldTotalUsesLabel.trim()
        : '',
    fieldPrice:
      typeof currentPublicConfig?.packageFieldPriceLabel === 'string'
        ? currentPublicConfig.packageFieldPriceLabel.trim()
        : '',
    fieldIncludedServices:
      typeof currentPublicConfig?.packageFieldIncludedServicesLabel === 'string'
        ? currentPublicConfig.packageFieldIncludedServicesLabel.trim()
        : '',
    formAddDescription:
      typeof currentPublicConfig?.packageFormAddDescription === 'string'
        ? currentPublicConfig.packageFormAddDescription.trim()
        : '',
    formEditDescription:
      typeof currentPublicConfig?.packageFormEditDescription === 'string'
        ? currentPublicConfig.packageFormEditDescription.trim()
        : '',
    validationRequired:
      typeof currentPublicConfig?.packageValidationRequired === 'string'
        ? currentPublicConfig.packageValidationRequired.trim()
        : '',
    errorAdd:
      typeof currentPublicConfig?.packageErrorAdd === 'string'
        ? currentPublicConfig.packageErrorAdd.trim()
        : '',
    errorUpdate:
      typeof currentPublicConfig?.packageErrorUpdate === 'string'
        ? currentPublicConfig.packageErrorUpdate.trim()
        : '',
    errorRemove:
      typeof currentPublicConfig?.packageErrorRemove === 'string'
        ? currentPublicConfig.packageErrorRemove.trim()
        : '',
    soldLabel:
      typeof currentPublicConfig?.packageSoldLabel === 'string'
        ? currentPublicConfig.packageSoldLabel.trim()
        : '',
    activeBalancesLabel:
      typeof currentPublicConfig?.packageActiveBalancesLabel === 'string'
        ? currentPublicConfig.packageActiveBalancesLabel.trim()
        : '',
    publishedLabel:
      typeof currentPublicConfig?.packagePublishedLabel === 'string'
        ? currentPublicConfig.packagePublishedLabel.trim()
        : ''
  });

  const getProductUiCopy = () => ({
    singular:
      typeof currentPublicConfig?.productLabelSingular === 'string'
        ? currentPublicConfig.productLabelSingular.trim()
        : '',
    plural:
      typeof currentPublicConfig?.productLabelPlural === 'string'
        ? currentPublicConfig.productLabelPlural.trim()
        : '',
    menuTitle:
      typeof currentPublicConfig?.productMenuTitle === 'string'
        ? currentPublicConfig.productMenuTitle.trim()
        : '',
    menuDescription:
      typeof currentPublicConfig?.productMenuDescription === 'string'
        ? currentPublicConfig.productMenuDescription.trim()
        : '',
    emptyTitle:
      typeof currentPublicConfig?.productEmptyTitle === 'string'
        ? currentPublicConfig.productEmptyTitle.trim()
        : '',
    emptyDescription:
      typeof currentPublicConfig?.productEmptyDescription === 'string'
        ? currentPublicConfig.productEmptyDescription.trim()
        : '',
    actionAdd:
      typeof currentPublicConfig?.productActionAdd === 'string'
        ? currentPublicConfig.productActionAdd.trim()
        : '',
    actionEdit:
      typeof currentPublicConfig?.productActionEdit === 'string'
        ? currentPublicConfig.productActionEdit.trim()
        : '',
    actionRemove:
      typeof currentPublicConfig?.productActionRemove === 'string'
        ? currentPublicConfig.productActionRemove.trim()
        : '',
    actionSave:
      typeof currentPublicConfig?.productActionSave === 'string'
        ? currentPublicConfig.productActionSave.trim()
        : '',
    actionUpdate:
      typeof currentPublicConfig?.productActionUpdate === 'string'
        ? currentPublicConfig.productActionUpdate.trim()
        : '',
    actionSell:
      typeof currentPublicConfig?.productActionSell === 'string'
        ? currentPublicConfig.productActionSell.trim()
        : '',
    actionViewRecords:
      typeof currentPublicConfig?.productActionViewRecords === 'string'
        ? currentPublicConfig.productActionViewRecords.trim()
        : '',
    actionOpenReports:
      typeof currentPublicConfig?.productActionOpenReports === 'string'
        ? currentPublicConfig.productActionOpenReports.trim()
        : '',
    fieldName:
      typeof currentPublicConfig?.productFieldNameLabel === 'string'
        ? currentPublicConfig.productFieldNameLabel.trim()
        : '',
    fieldCategory:
      typeof currentPublicConfig?.productFieldCategoryLabel === 'string'
        ? currentPublicConfig.productFieldCategoryLabel.trim()
        : '',
    fieldSku:
      typeof currentPublicConfig?.productFieldSkuLabel === 'string'
        ? currentPublicConfig.productFieldSkuLabel.trim()
        : '',
    fieldPrice:
      typeof currentPublicConfig?.productFieldPriceLabel === 'string'
        ? currentPublicConfig.productFieldPriceLabel.trim()
        : '',
    fieldStock:
      typeof currentPublicConfig?.productFieldStockLabel === 'string'
        ? currentPublicConfig.productFieldStockLabel.trim()
        : '',
    fieldDescription:
      typeof currentPublicConfig?.productFieldDescriptionLabel === 'string'
        ? currentPublicConfig.productFieldDescriptionLabel.trim()
        : '',
    fieldQuantity:
      typeof currentPublicConfig?.productFieldQuantityLabel === 'string'
        ? currentPublicConfig.productFieldQuantityLabel.trim()
        : '',
    fieldCustomerName:
      typeof currentPublicConfig?.productFieldCustomerNameLabel === 'string'
        ? currentPublicConfig.productFieldCustomerNameLabel.trim()
        : '',
    fieldCustomerPhone:
      typeof currentPublicConfig?.productFieldCustomerPhoneLabel === 'string'
        ? currentPublicConfig.productFieldCustomerPhoneLabel.trim()
        : '',
    fieldCustomerEmail:
      typeof currentPublicConfig?.productFieldCustomerEmailLabel === 'string'
        ? currentPublicConfig.productFieldCustomerEmailLabel.trim()
        : '',
    formAddDescription:
      typeof currentPublicConfig?.productFormAddDescription === 'string'
        ? currentPublicConfig.productFormAddDescription.trim()
        : '',
    formEditDescription:
      typeof currentPublicConfig?.productFormEditDescription === 'string'
        ? currentPublicConfig.productFormEditDescription.trim()
        : '',
    salesDescription:
      typeof currentPublicConfig?.productSalesDescription === 'string'
        ? currentPublicConfig.productSalesDescription.trim()
        : '',
    validationRequired:
      typeof currentPublicConfig?.productValidationRequired === 'string'
        ? currentPublicConfig.productValidationRequired.trim()
        : '',
    validationStock:
      typeof currentPublicConfig?.productValidationStock === 'string'
        ? currentPublicConfig.productValidationStock.trim()
        : '',
    errorAdd:
      typeof currentPublicConfig?.productErrorAdd === 'string'
        ? currentPublicConfig.productErrorAdd.trim()
        : '',
    errorUpdate:
      typeof currentPublicConfig?.productErrorUpdate === 'string'
        ? currentPublicConfig.productErrorUpdate.trim()
        : '',
    errorRemove:
      typeof currentPublicConfig?.productErrorRemove === 'string'
        ? currentPublicConfig.productErrorRemove.trim()
        : '',
    errorSell:
      typeof currentPublicConfig?.productErrorSell === 'string'
        ? currentPublicConfig.productErrorSell.trim()
        : '',
    metricActive:
      typeof currentPublicConfig?.productMetricActiveLabel === 'string'
        ? currentPublicConfig.productMetricActiveLabel.trim()
        : '',
    metricStock:
      typeof currentPublicConfig?.productMetricStockLabel === 'string'
        ? currentPublicConfig.productMetricStockLabel.trim()
        : '',
    metricSold:
      typeof currentPublicConfig?.productMetricSoldLabel === 'string'
        ? currentPublicConfig.productMetricSoldLabel.trim()
        : '',
    metricLowStock:
      typeof currentPublicConfig?.productMetricLowStockLabel === 'string'
        ? currentPublicConfig.productMetricLowStockLabel.trim()
        : ''
  });

  const getTeamMemberScheduleUiCopy = () => ({
    openingTimeLabel:
      typeof currentPublicConfig?.teamMemberFieldOpeningTimeLabel === 'string'
        ? currentPublicConfig.teamMemberFieldOpeningTimeLabel.trim()
        : '',
    closingTimeLabel:
      typeof currentPublicConfig?.teamMemberFieldClosingTimeLabel === 'string'
        ? currentPublicConfig.teamMemberFieldClosingTimeLabel.trim()
        : '',
    offDaysLabel:
      typeof currentPublicConfig?.teamMemberFieldOffDaysLabel === 'string'
        ? currentPublicConfig.teamMemberFieldOffDaysLabel.trim()
        : '',
    offDaysEmpty:
      typeof currentPublicConfig?.teamMemberFieldOffDaysEmpty === 'string'
        ? currentPublicConfig.teamMemberFieldOffDaysEmpty.trim()
        : ''
  });

  const getBusinessRoleLabels = () => {
    const configuredSingular =
      typeof currentPublicConfig?.teamMemberLabelSingular === 'string'
        ? currentPublicConfig.teamMemberLabelSingular.trim().toLowerCase()
        : '';
    const configuredPlural =
      typeof currentPublicConfig?.teamMemberLabelPlural === 'string'
        ? currentPublicConfig.teamMemberLabelPlural.trim().toLowerCase()
        : '';

    if (configuredSingular) {
      return {
        singular: configuredSingular,
        plural: configuredPlural || `${configuredSingular}s`
      };
    }

    const configuredRoleOptions = Array.isArray(currentPublicConfig?.teamMemberRoleOptions)
      ? currentPublicConfig.teamMemberRoleOptions
      : [];
    const firstConfiguredRole = configuredRoleOptions.find(
      (entry) => typeof entry === 'string' && entry.trim()
    );

    if (typeof firstConfiguredRole === 'string' && firstConfiguredRole.trim()) {
      const normalizedRole = firstConfiguredRole.trim().toLowerCase();
      return {
        singular: normalizedRole,
        plural: `${normalizedRole}s`
      };
    }

    const serviceTypes = Array.isArray(dashboardPayload?.client?.serviceTypes)
      ? dashboardPayload.client.serviceTypes
      : [];

    if (serviceTypes.includes('Barber')) {
      return { singular: 'barber', plural: 'barbers' };
    }

    return { singular: 'team member', plural: 'team members' };
  };

  const getBusinessRoleLabel = () => {
    return getBusinessRoleLabels().singular;
  };

  const getBusinessRoleLabelPlural = () => {
    return getBusinessRoleLabels().plural;
  };

  const getReportRangeDays = () => {
    const dayMap = {
      today: 1,
      '7d': 7,
      '30d': 30,
      '90d': 90
    };

    return dayMap[reportsDateRange] ?? 30;
  };

  const getReportsRangeLabel = () => {
    const reportsCopy = getDashboardUiCopy().reports ?? DEFAULT_DASHBOARD_UI_COPY.reports;
    if (reportsDateRange === 'today') {
      return reportsCopy.rangeToday;
    }

    return interpolateLabel(reportsCopy.lastDaysTemplate, {
      days: getReportRangeDays()
    });
  };

  const getAppointmentReportDateValue = (appointment) => {
    if (!appointment || typeof appointment !== 'object') {
      return '';
    }

    const createdDateValue =
      typeof appointment.createdAt === 'string' && appointment.createdAt.length >= 10
        ? appointment.createdAt.slice(0, 10)
        : '';
    const scheduledDateValue =
      typeof appointment.appointmentDate === 'string' ? appointment.appointmentDate : '';

    if (appointment.status === 'booked' && createdDateValue) {
      return createdDateValue;
    }

    return scheduledDateValue || createdDateValue;
  };

  const getAppointmentsInDateRange = (appointments, rangeKey = reportsDateRange) => {
    if (!Array.isArray(appointments)) {
      return [];
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days = rangeKey === 'today' ? 1 : {
      '7d': 7,
      '30d': 30,
      '90d': 90
    }[rangeKey] ?? 30;
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));

    return appointments.filter((appointment) => {
      const reportDateValue = getAppointmentReportDateValue(appointment);

      if (!reportDateValue) {
        return false;
      }

      const appointmentDate = new Date(`${reportDateValue}T00:00:00`);
      return appointmentDate >= start && appointmentDate <= today;
    });
  };

  const buildTrendPoints = (appointments, metric = 'count', days = getReportRangeDays()) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(start.getDate() - (days - 1));
    const servicePriceMap = new Map(
      getDashboardServices().map((service) => [service.name, parsePriceLabel(service.priceLabel)])
    );
    const values = [];

    for (let index = 0; index < days; index += 1) {
      const currentDate = new Date(start);
      currentDate.setDate(start.getDate() + index);
      const key = formatDateForApi(currentDate);
      const dayAppointments = appointments.filter(
        (appointment) => getAppointmentReportDateValue(appointment) === key
      );

      if (metric === 'revenue') {
        values.push(
          dayAppointments.reduce(
            (sum, appointment) =>
              sum +
              (appointment.status === 'cancelled'
                ? 0
                : servicePriceMap.get(appointment.serviceName) ?? 0),
            0
          )
        );
      } else {
        values.push(dayAppointments.length);
      }
    }

    return values;
  };

  const buildSparklineSvg = (values, stroke = '#1f335d') => {
    const width = 180;
    const height = 48;
    const safeValues = values.length > 0 ? values : [0];
    const max = Math.max(...safeValues, 1);
    const points = safeValues
      .map((value, index) => {
        const x = safeValues.length === 1 ? width / 2 : (index / (safeValues.length - 1)) * width;
        const y = height - (value / max) * (height - 8) - 4;
        return `${x},${y}`;
      })
      .join(' ');

    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true"><polyline fill="none" stroke="${stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" points="${points}"></polyline></svg>`;
  };

const createTrendCard = (
  title,
  valueLabel,
  subtitle,
  values,
  tone = 'blue',
  options = {}
) => {
  const tones = {
      blue: '#1f335d',
      green: '#116549',
      gold: '#a85e14',
      plum: '#6f4ab5'
    };
    const hasClickHandler = typeof options.onClick === 'function';
    const card = document.createElement(hasClickHandler ? 'button' : 'article');
    card.className = hasClickHandler
      ? 'calendar-reports-summary-card is-interactive'
      : 'calendar-reports-summary-card';

    if (hasClickHandler) {
      card.type = 'button';
      card.setAttribute('aria-label', options.ariaLabel ?? title);
      card.addEventListener('click', options.onClick);
    }

    const titleElement = document.createElement('span');
    titleElement.className = 'calendar-reports-summary-label';
    titleElement.textContent = title;

    const valueElement = document.createElement('strong');
    valueElement.className = 'calendar-reports-summary-value';
    valueElement.textContent = valueLabel;

    const metaElement = document.createElement('small');
    metaElement.className = 'calendar-reports-summary-meta';
    metaElement.textContent = subtitle;

    const chart = document.createElement('div');
    chart.className = 'calendar-reports-summary-chart';
    chart.innerHTML = buildSparklineSvg(values, tones[tone] ?? tones.blue);

    card.append(titleElement, valueElement, metaElement, chart);
    return card;
  };

  const getSalesInsights = (appointments = getDashboardAppointments()) => {
    const selectedDateValue = getSelectedDateValue();
    const servicePriceMap = new Map(
      getDashboardServices().map((service) => [service.name, parsePriceLabel(service.priceLabel)])
    );
    const revenueFor = (appointment) =>
      appointment.status === 'cancelled' ? 0 : servicePriceMap.get(appointment.serviceName) ?? 0;
    const selectedDayAppointments = appointments.filter(
      (appointment) => appointment.appointmentDate === selectedDateValue
    );
    const selectedDayRevenue = selectedDayAppointments.reduce(
      (sum, appointment) => sum + revenueFor(appointment),
      0
    );
    const totalRevenue = appointments.reduce((sum, appointment) => sum + revenueFor(appointment), 0);
    const collectedRevenue = appointments
      .filter((appointment) => appointment.status === 'completed')
      .reduce((sum, appointment) => sum + revenueFor(appointment), 0);
    const pendingRevenue = appointments
      .filter((appointment) => appointment.status === 'booked')
      .reduce((sum, appointment) => sum + revenueFor(appointment), 0);
    const serviceCounts = new Map();

    for (const appointment of appointments) {
      if (appointment.status === 'cancelled') {
        continue;
      }

      const current = serviceCounts.get(appointment.serviceName) ?? { count: 0, revenue: 0 };
      current.count += 1;
      current.revenue += revenueFor(appointment);
      serviceCounts.set(appointment.serviceName, current);
    }

    const topServices = [...serviceCounts.entries()]
      .sort((left, right) => right[1].revenue - left[1].revenue || right[1].count - left[1].count)
      .slice(0, 3)
      .map(([serviceName, value]) => ({
        serviceName,
        count: value.count,
        revenueLabel: formatCurrencyLabel(value.revenue)
      }));

    return {
      selectedDayLabel: formatDateForDisplay(selectedDateValue),
      selectedDayCount: selectedDayAppointments.length,
      selectedDayRevenue,
      totalAppointments: appointments.length,
      totalRevenue,
      collectedRevenue,
      pendingRevenue,
      topServices,
      giftCardsSold: 0,
      packagesSold: getDashboardCommerce().packagesSold
    };
  };

  const getPaymentInsights = () => {
    const summary = getPaymentsSummary();
    const balances = getPaymentBalances();
    const payments = getPaymentRecords();

    return {
      currencyCode: summary.currencyCode ?? '',
      expectedAmountValue: summary.expectedAmountValue ?? 0,
      collectedAmountValue: summary.collectedAmountValue ?? 0,
      pendingAmountValue: summary.pendingAmountValue ?? 0,
      overpaidAmountValue: summary.overpaidAmountValue ?? 0,
      recordedPaymentsCount: summary.recordedPaymentsCount ?? 0,
      outstandingAppointmentsCount: summary.outstandingAppointmentsCount ?? 0,
      balances,
      payments
    };
  };

  const getOutstandingPaymentBalances = () =>
    getPaymentBalances().filter((balance) => balance.outstandingAmountValue > 0);

  const buildPaymentBalanceLabel = (balance, fallbackCurrencyCode = '') =>
    [
      balance.customerName,
      getAppointmentServiceSummary(balance),
      formatDateTimeForDisplay(balance.appointmentDate, balance.appointmentTime),
      `Due ${formatMoneyValue(
        balance.outstandingAmountValue,
        balance.currencyCode || fallbackCurrencyCode
      )}`
    ].join(' | ');

  const buildPaymentRecordLabel = (payment, fallbackCurrencyCode = '') =>
    [
      `${payment.customerName} paid ${formatMoneyValue(
        payment.amountValue,
        payment.currencyCode || fallbackCurrencyCode
      )}`,
      `${payment.serviceName} via ${formatPaymentMethodLabel(payment.method)}`,
      formatDateTimeForDisplay(payment.appointmentDate, payment.appointmentTime)
    ].join(' | ');

  const getCatalogInsights = () => {
    const services = getDashboardServices();
    const products = getDashboardProducts();
    const activeServices = services.filter((service) => service.isActive !== false);
    const inactiveServices = services.filter((service) => service.isActive === false);
    const activeProducts = products.filter((product) => product.isActive !== false);
    const totalProductStock = activeProducts.reduce(
      (sum, product) => sum + Math.max(0, Number(product.stockQuantity) || 0),
      0
    );
    const lowStockProducts = activeProducts.filter(
      (product) => Math.max(0, Number(product.stockQuantity) || 0) <= 3
    );
    const categories = new Set(
      activeServices
        .map((service) => service.categoryName?.trim())
        .filter((categoryName) => typeof categoryName === 'string' && categoryName.length > 0)
    );
    const averagePrice =
      activeServices.length > 0
        ? activeServices.reduce((sum, service) => sum + parsePriceLabel(service.priceLabel), 0) /
          activeServices.length
        : 0;

    return {
      totalServices: services.length,
      activeServices: activeServices.length,
      inactiveServices: inactiveServices.length,
      totalProducts: products.length,
      activeProducts: activeProducts.length,
      totalProductStock,
      lowStockProducts: lowStockProducts.length,
      categoryCount: categories.size,
      averagePrice,
      featuredServices: activeServices.slice(0, 3),
      featuredProducts: activeProducts.slice(0, 3)
    };
  };

  const buildClientInsightsFromProfiles = (customerProfiles) => {
    const clients = [...customerProfiles]
      .map((customerProfile) => ({
        customerName: customerProfile.customerName ?? '',
        customerPhone: customerProfile.customerPhone ?? '',
        customerEmail: customerProfile.customerEmail ?? '',
        visits: Number(customerProfile.totalVisits ?? 0) || 0,
        lastService: customerProfile.lastService ?? '',
        lastDate: customerProfile.lastAppointmentDate ?? '',
        lastTime: customerProfile.lastAppointmentTime ?? '',
        bookedVisits: Number(customerProfile.bookedVisits ?? 0) || 0,
        completedVisits: Number(customerProfile.completedVisits ?? 0) || 0
      }))
      .sort((left, right) =>
        `${right.lastDate}T${right.lastTime}`.localeCompare(`${left.lastDate}T${left.lastTime}`)
      );
    const repeatClients = clients.filter((client) => client.visits > 1);

    return {
      totalClients: clients.length,
      repeatClients: repeatClients.length,
      loyaltyCandidates: clients.filter((client) => client.completedVisits >= 2).length,
      clients
    };
  };

  const getClientInsights = (appointments) => {
    if (!Array.isArray(appointments)) {
      return buildClientInsightsFromProfiles(getDashboardCustomerProfiles());
    }

    const clientMap = new Map();

    for (const appointment of [...appointments].sort((left, right) =>
      `${right.appointmentDate}T${right.appointmentTime}`.localeCompare(
        `${left.appointmentDate}T${left.appointmentTime}`
      )
    )) {
      const key =
        appointment.customerPhone ||
        appointment.customerEmail ||
        `${appointment.customerName}-${appointment.id}`;

      const current = clientMap.get(key) ?? {
        customerName: appointment.customerName,
        customerPhone: appointment.customerPhone ?? '',
        customerEmail: appointment.customerEmail ?? '',
        visits: 0,
        lastService: appointment.serviceName,
        lastDate: appointment.appointmentDate,
        lastTime: appointment.appointmentTime,
        bookedVisits: 0,
        completedVisits: 0
      };

      current.visits += 1;
      if (appointment.status === 'booked') {
        current.bookedVisits += 1;
      }
      if (appointment.status === 'completed') {
        current.completedVisits += 1;
      }

      clientMap.set(key, current);
    }

    const clients = [...clientMap.values()];
    const repeatClients = clients.filter((client) => client.visits > 1);

    return {
      totalClients: clients.length,
      repeatClients: repeatClients.length,
      loyaltyCandidates: clients.filter((client) => client.completedVisits >= 2).length,
      clients
    };
  };

  const persistReportsWorkspace = () => {
    const clientId = getClientId();
    setReportsWorkspaceState(clientId, reportsWorkspace);
  };

  const getReportsFolderIdsFor = (reportId) =>
    reportsWorkspace.folders
      .filter((folder) => Array.isArray(folder.reportIds) && folder.reportIds.includes(reportId))
      .map((folder) => folder.id);

  const buildReportsCatalog = () => {
    const rangeAppointments = getAppointmentsInDateRange(getDashboardAppointments());
    const salesInsights = getSalesInsights(rangeAppointments);
    const paymentInsights = getPaymentInsights();
    const catalogInsights = getCatalogInsights();
    const rangeClientInsights = getClientInsights(rangeAppointments);
    const clientInsights = getClientInsights();
    const loyaltyProgram = getDashboardLoyaltyProgram();
    const appointments = rangeAppointments;
    const teamMembers = getDashboardTeamMembers().filter((teamMember) => teamMember.isActive !== false);
    const bookedAppointments = appointments.filter((appointment) => appointment.status === 'booked');
    const completedAppointments = appointments.filter((appointment) => appointment.status === 'completed');
    const qrBookings = appointments.filter((appointment) => appointment.source === 'qr');
    const directBookings = appointments.filter((appointment) => appointment.source === 'direct');
    const socialBookings = appointments.filter((appointment) =>
      ['instagram', 'facebook', 'applemaps'].includes(appointment.source)
    );

    const baseReports = [
      {
        id: 'performance-dashboard',
        title: 'Performance dashboard',
        description: 'Executive view of booking activity, revenue, and current business momentum.',
        category: 'sales',
        categoryLabel: 'Sales',
        createdBy: 'platform',
        plan: 'premium',
        kind: 'dashboards',
        summary: `${salesInsights.totalAppointments} appointments â€¢ ${formatCurrencyLabel(salesInsights.totalRevenue)}`,
        detail: {
          eyebrow: 'Dashboard',
          description: 'High-level business performance across bookings, revenue, and next operational focus.',
          cards: [
            createToolInfoCard('Appointments tracked', String(salesInsights.totalAppointments)),
            createToolInfoCard('Estimated revenue', formatCurrencyLabel(salesInsights.totalRevenue)),
            createToolInfoCard('Pending value', formatCurrencyLabel(salesInsights.pendingRevenue))
          ],
          actions: [
            createToolActionButton('Open sales reports', () => {
              closeToolModal();
              activateReportsTab('Sales');
            }),
            createToolActionButton('View appointments', () => {
              closeToolModal();
              setMainView('calendar');
              setActiveDrawer('');
              appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            })
          ]
        }
      },
      {
        id: 'online-presence-dashboard',
        title: 'Online presence dashboard',
        description: 'Understand how your QR and social booking links contribute to bookings volume.',
        category: 'appointments',
        categoryLabel: 'Appointments',
        createdBy: 'platform',
        plan: 'standard',
        kind: 'dashboards',
        summary: `${appointments.length} tracked booking${appointments.length === 1 ? '' : 's'} recorded`,
        detail: {
          eyebrow: 'Dashboard',
          description: 'Tracks which public channels send clients into your booking flow.',
          cards: [
            createToolInfoCard('QR bookings', String(qrBookings.length)),
            createToolInfoCard('Social bookings', String(socialBookings.length)),
            createToolInfoCard('Direct bookings', String(directBookings.length))
          ],
          actions: [
            createToolActionButton('Open booking page', () => {
              closeToolModal();
              if (publicBookingPath) {
                window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
              }
            })
          ]
        }
      },
      {
        id: 'loyalty-dashboard',
        title: 'Loyalty dashboard',
        description: 'Review repeat clients and identify guests ready for retention campaigns.',
        category: 'clients',
        categoryLabel: 'Clients',
        createdBy: 'platform',
        plan: 'premium',
        kind: 'dashboards',
        summary: `${clientInsights.repeatClients} repeat client${clientInsights.repeatClients === 1 ? '' : 's'}`,
        detail: {
          eyebrow: 'Dashboard',
          description: 'Client retention view with loyalty performance, saved client profiles, and detailed guest history.',
          cards: [
            createToolInfoCard('Repeat clients', String(clientInsights.repeatClients)),
            createToolInfoCard('Loyalty-ready', String(clientInsights.loyaltyCandidates)),
            createToolInfoCard('Tracked clients', String(clientInsights.totalClients)),
            ...sortClientsForRetention(clientInsights.clients).map((client) =>
              createClientDetailCard(client, { loyaltyProgram })
            )
          ],
          actions: [
            createToolActionButton('Open loyalty view', () => {
              closeToolModal();
              openClientLoyaltyModal();
            }),
            createToolActionButton('Open clients view', () => {
              closeToolModal();
              setMainView('calendar');
              syncSideDrawerOffset();
              setActiveDrawer('clients');
            })
          ]
        }
      },
      {
        id: 'daily-sales-summary',
        title: 'Daily sales summary',
        description: 'Snapshot of bookings and estimated value for the currently selected day.',
        category: 'sales',
        categoryLabel: 'Sales',
        createdBy: 'platform',
        plan: 'standard',
        kind: 'standard',
        summary: `${salesInsights.selectedDayCount} bookings on ${salesInsights.selectedDayLabel}`,
        detail: {
          eyebrow: 'Sales',
          description: 'Day-level performance tied to the selected date in the calendar.',
          cards: [
            createToolInfoCard('Selected date', salesInsights.selectedDayLabel),
            createToolInfoCard('Day bookings', String(salesInsights.selectedDayCount)),
            createToolInfoCard('Day revenue', formatCurrencyLabel(salesInsights.selectedDayRevenue))
          ],
          actions: [
            createToolActionButton('Open sales summary', () => {
              closeToolModal();
              openSalesSummaryModal();
            })
          ]
        }
      },
      {
        id: 'payments-snapshot',
        title: 'Payments snapshot',
        description: 'Track collected payments, outstanding balances, and the current payment workload.',
        category: 'finance',
        categoryLabel: 'Finance',
        createdBy: 'platform',
        plan: 'standard',
        kind: 'standard',
        summary: `${formatMoneyValue(paymentInsights.collectedAmountValue, paymentInsights.currencyCode)} collected`,
        detail: {
          eyebrow: 'Finance',
          description: 'Payment overview based on recorded payment entries and appointment balances.',
          cards: [
            createToolInfoCard(
              'Collected value',
              formatMoneyValue(paymentInsights.collectedAmountValue, paymentInsights.currencyCode)
            ),
            createToolInfoCard(
              'Pending value',
              formatMoneyValue(paymentInsights.pendingAmountValue, paymentInsights.currencyCode)
            ),
            createToolInfoCard(
              'Expected total',
              formatMoneyValue(paymentInsights.expectedAmountValue, paymentInsights.currencyCode)
            )
          ],
          actions: [
            createToolActionButton('Open finance reports', () => {
              closeToolModal();
              activateReportsTab('Finance');
            }),
            createToolActionButton('Record payment', () => {
              closeToolModal();
              openRecordPaymentModal();
            })
          ]
        }
      },
      {
        id: 'appointments-pipeline',
        title: 'Appointments pipeline',
        description: 'Track booked versus completed appointments and booking throughput.',
        category: 'appointments',
        categoryLabel: 'Appointments',
        createdBy: 'platform',
        plan: 'standard',
        kind: 'standard',
        summary: `${bookedAppointments.length} booked â€¢ ${completedAppointments.length} completed`,
        detail: {
          eyebrow: 'Appointments',
          description: 'Operational throughput of appointments currently moving through the business.',
          cards: [
            createToolInfoCard('Booked', String(bookedAppointments.length)),
            createToolInfoCard('Completed', String(completedAppointments.length)),
            createToolInfoCard('Total tracked', String(appointments.length))
          ],
          actions: [
            createToolActionButton('View appointments', () => {
              closeToolModal();
              setMainView('calendar');
              setActiveDrawer('');
              appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            })
          ]
        }
      },
      {
        id: 'team-utilization',
        title: 'Team utilization',
        description: 'Understand whether the configured team matches current appointment demand.',
        category: 'team',
        categoryLabel: 'Team',
        createdBy: 'platform',
        plan: 'standard',
        kind: 'standard',
        summary: `${teamMembers.length} active team member${teamMembers.length === 1 ? '' : 's'}`,
        detail: {
          eyebrow: 'Team',
          description: 'Capacity snapshot based on saved team members and current bookings.',
          cards: [
            createToolInfoCard('Active team', String(teamMembers.length)),
            createToolInfoCard('Booked appointments', String(bookedAppointments.length)),
            createToolInfoCard(
              'Bookings per team member',
              teamMembers.length > 0
                ? (bookedAppointments.length / teamMembers.length).toFixed(1)
                : '0.0'
            )
          ],
          actions: [
            createToolActionButton('Open team panel', () => {
              closeToolModal();
              setMainView('calendar');
              syncSideDrawerOffset();
              setActiveDrawer('team');
            })
          ]
        }
      },
      {
        id: 'service-mix',
        title: 'Service mix',
        description: 'Review which services are active and where the revenue concentration sits.',
        category: 'sales',
        categoryLabel: 'Sales',
        createdBy: 'platform',
        plan: 'premium',
        kind: 'premium',
        summary: `${catalogInsights.activeServices} active services across ${catalogInsights.categoryCount} categories`,
        detail: {
          eyebrow: 'Catalog',
          description: 'Service assortment overview using the active service menu and booking value.',
          cards: [
            createToolInfoCard('Active services', String(catalogInsights.activeServices)),
            createToolInfoCard('Categories', String(catalogInsights.categoryCount)),
            createToolInfoCard('Average price', formatCurrencyLabel(catalogInsights.averagePrice))
          ],
          actions: [
            createToolActionButton('Open service menu', () => {
              closeToolModal();
              openServiceMenuModal();
            })
          ]
        }
      },
      {
        id: 'inventory-readiness',
        title: 'Inventory readiness',
        description: 'Keep catalog and supplier setup aligned before inventory workflows go live.',
        category: 'inventory',
        categoryLabel: 'Inventory',
        createdBy: 'platform',
        plan: 'target',
        kind: 'targets',
        summary: `${catalogInsights.totalServices} services configured`,
        detail: {
          eyebrow: 'Inventory',
          description: 'Operational setup view for suppliers, stocktakes, and order preparation.',
          cards: [
            createToolInfoCard('Configured services', String(catalogInsights.totalServices)),
            createToolInfoCard('Suppliers', '0'),
            createToolInfoCard('Stock orders', '0')
          ],
          actions: [
            createToolActionButton('Open suppliers', () => {
              closeToolModal();
              openSuppliersModal();
            })
          ]
        }
      }
    ];

    const customReports = reportsWorkspace.customReports.map((report, index) => ({
      id: report.id ?? `custom-report-${index + 1}`,
      title: report.title,
      description: report.description,
      category: report.category ?? 'sales',
      categoryLabel: report.categoryLabel ?? (report.category ?? 'sales').replace(/^\w/, (c) => c.toUpperCase()),
      createdBy: 'you',
      plan: 'custom',
      kind: 'custom',
      summary: report.summary ?? 'Custom report saved to your workspace.',
      detail: {
        eyebrow: 'Custom report',
        description: report.description,
        cards: [
          createToolInfoCard('Saved report', report.title),
          createToolInfoCard('Category', report.categoryLabel ?? report.category ?? 'Sales'),
          createToolInfoCard('Workspace status', 'Available in your custom reports library.')
        ],
        actions: [
          createToolActionButton('Open reports', () => {
            closeToolModal();
            setMainView('reports');
          })
        ]
      }
    }));

    return [...baseReports, ...customReports].map((report) => ({
      ...report,
      folderIds: getReportsFolderIdsFor(report.id),
      isFavourite: reportsWorkspace.favourites.includes(report.id)
    }));
  };

  const buildReportsMenuItems = (catalog) => {
    const menuConfig = [
      ['all reports', 'All reports', catalog.length],
      ['favourites', 'Favourites', catalog.filter((report) => report.isFavourite).length],
      ['dashboards', 'Dashboards', catalog.filter((report) => report.kind === 'dashboards').length],
      ['standard', 'Standard', catalog.filter((report) => report.kind === 'standard').length],
      ['premium', 'Premium', catalog.filter((report) => report.plan === 'premium').length],
      ['custom', 'Custom', catalog.filter((report) => report.kind === 'custom').length],
      ['targets', 'Targets', catalog.filter((report) => report.kind === 'targets').length]
    ];

    return menuConfig.map(([key, label, count]) => ({
      key,
      label,
      active: activeReportsMenu === key,
      meta: { type: 'count', value: String(count) }
    }));
  };

  const buildReportsTabs = () =>
    [
      ['all reports', 'All reports'],
      ['sales', 'Sales'],
      ['finance', 'Finance'],
      ['appointments', 'Appointments'],
      ['team', 'Team'],
      ['clients', 'Clients'],
      ['inventory', 'Inventory']
    ].map(([key, label]) => ({
      key,
      label,
      active: activeReportsTab === key
    }));

  const buildReportsFilters = () => {
    const createdBySequence = ['all', 'platform', 'you'];
    const categorySequence = ['all', 'sales', 'finance', 'appointments', 'team', 'clients', 'inventory'];

    return [
      {
        type: 'created-by',
        value: activeReportsFilters.createdBy,
        active: activeReportsFilters.createdBy !== 'all',
        sequence: createdBySequence,
        label: `Created by: ${activeReportsFilters.createdBy === 'all' ? 'All' : activeReportsFilters.createdBy === 'you' ? 'You' : 'Platform'}`
      },
      {
        type: 'category',
        value: activeReportsFilters.category,
        active: activeReportsFilters.category !== 'all',
        sequence: categorySequence,
        label: `Category: ${activeReportsFilters.category === 'all' ? 'All' : activeReportsFilters.category.replace(/^\w/, (c) => c.toUpperCase())}`
      }
    ];
  };

  const getVisibleReportsCatalog = () => {
    const catalog = buildReportsCatalog();
    const query =
      reportsSearchInput instanceof HTMLInputElement
        ? reportsSearchInput.value.trim().toLowerCase()
        : '';

    return catalog.filter((report) => {
      const matchesQuery =
        !query ||
        `${report.title} ${report.description} ${report.summary ?? ''}`.toLowerCase().includes(query);

      const matchesMenu =
        activeReportsMenu === 'all reports' ||
        (activeReportsMenu === 'favourites' && report.isFavourite) ||
        report.kind === activeReportsMenu ||
        report.plan === activeReportsMenu;

      const matchesTab =
        activeReportsTab === 'all reports' || report.category === activeReportsTab;

      const matchesCreatedBy =
        activeReportsFilters.createdBy === 'all' ||
        report.createdBy === activeReportsFilters.createdBy;

      const matchesCategory =
        activeReportsFilters.category === 'all' ||
        report.category === activeReportsFilters.category;

      const matchesFolder =
        !activeReportsFolderId ||
        (Array.isArray(report.folderIds) && report.folderIds.includes(activeReportsFolderId));

      return (
        matchesQuery &&
        matchesMenu &&
        matchesTab &&
        matchesCreatedBy &&
        matchesCategory &&
        matchesFolder
      );
    });
  };

  const renderReportsWorkspace = () => {
    if (!dashboardPayload?.dashboard?.reportsView) {
      return;
    }

    renderReportsSummary();
    renderReportsControls();

    const catalog = buildReportsCatalog();
    const visibleCatalog = getVisibleReportsCatalog();
    const folders = reportsWorkspace.folders.map((folder) => ({
      ...folder,
      active: activeReportsFolderId === folder.id,
      reportCount: buildReportsCatalog().filter((report) => folder.reportIds.includes(report.id)).length
    }));

    renderReportsView(
      {
        ...dashboardPayload.dashboard.reportsView,
        menu: buildReportsMenuItems(catalog),
        filters: buildReportsFilters(),
        tabs: buildReportsTabs(),
        cards: visibleCatalog,
        totalLabel: String(visibleCatalog.length),
        allFoldersActive: activeReportsFolderId === '',
        folders
      },
      {
        reportsSidebarTitle,
        reportsMenu,
        reportsFolderTitle,
        reportsFolderAction,
        reportsConnectorLabel,
        reportsTitle,
        reportsSubtitle,
        reportsTotal,
        reportsSearchInput,
        reportsFilters,
        reportsTabs,
        reportsCards
      }
    );
  };

  const downloadCsv = (filename, rows) => {
    const csvValue = rows
      .map((row) =>
        row
          .map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob([csvValue], { type: 'text/csv;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(url);
  };

  const exportVisibleReportsCsv = () => {
    const reports = getVisibleReportsCatalog();
    downloadCsv(
      `reports-${reportsDateRange}.csv`,
      [
        ['Title', 'Category', 'Created By', 'Plan', 'Summary'],
        ...reports.map((report) => [
          report.title,
          report.categoryLabel,
          report.createdBy,
          report.plan,
          report.summary ?? ''
        ])
      ]
    );
  };

  const openCreateCustomReportModal = () => {
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const titleField = document.createElement('label');
    titleField.className = 'calendar-tool-field';
    const titleLabel = document.createElement('span');
    titleLabel.textContent = 'Report title';
    const titleInput = document.createElement('input');
    titleInput.type = 'text';
    titleInput.placeholder = 'e.g. Weekly barber performance';
    titleInput.required = true;
    titleField.append(titleLabel, titleInput);

    const categoryField = document.createElement('label');
    categoryField.className = 'calendar-tool-field';
    const categoryLabel = document.createElement('span');
    categoryLabel.textContent = 'Category';
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.placeholder = 'sales, team, clients...';
    categoryInput.value = activeReportsTab === 'all reports' ? 'sales' : activeReportsTab;
    categoryField.append(categoryLabel, categoryInput);

    const descriptionField = document.createElement('label');
    descriptionField.className = 'calendar-tool-field';
    const descriptionLabel = document.createElement('span');
    descriptionLabel.textContent = 'Description';
    const descriptionInput = document.createElement('input');
    descriptionInput.type = 'text';
    descriptionInput.placeholder = 'Short note about what this report tracks';
    descriptionField.append(descriptionLabel, descriptionInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Save custom report';

    form.append(titleField, categoryField, descriptionField, submitButton);
    form.addEventListener('submit', (event) => {
      event.preventDefault();

      if (!titleInput.value.trim()) {
        safeAlert('Please enter a report title.');
        return;
      }

      const categoryValue = (categoryInput.value.trim().toLowerCase() || 'sales').replace(/\s+/g, '-');
      const categoryLabelValue = categoryValue.replace(/(^\w|-\w)/g, (chunk) =>
        chunk.replace('-', '').toUpperCase()
      );

      reportsWorkspace = {
        ...reportsWorkspace,
        customReports: [
          ...reportsWorkspace.customReports,
          {
            id: `custom-${Date.now()}`,
            title: titleInput.value.trim(),
            description: descriptionInput.value.trim() || 'Custom report saved to your workspace.',
            category: categoryValue,
            categoryLabel: categoryLabelValue,
            summary: `Saved for ${getReportsRangeLabel().toLowerCase()}.`
          }
        ]
      };
      persistReportsWorkspace();
      activeReportsMenu = 'custom';
      closeToolModal();
      renderReportsWorkspace();
    });

    openToolModal({
      eyebrow: 'Reports',
      title: 'Create custom report',
      description: 'Save a custom report tile for the views you review most often.',
      actions: [form]
    });
  };

  const renderReportsControls = () => {
    if (reportsRange instanceof HTMLElement) {
      reportsRange.replaceChildren();
      const reportsCopy = getDashboardUiCopy().reports ?? DEFAULT_DASHBOARD_UI_COPY.reports;
      const rangeOptions = [
        ['today', reportsCopy.rangeToday],
        ['7d', reportsCopy.range7Days],
        ['30d', reportsCopy.range30Days],
        ['90d', reportsCopy.range90Days]
      ];

      for (const [value, label] of rangeOptions) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className =
          reportsDateRange === value
            ? 'calendar-reports-range-chip is-active'
            : 'calendar-reports-range-chip';
        button.dataset.rangeValue = value;
        button.textContent = label;
        reportsRange.append(button);
      }
    }

    if (reportsActionsBar instanceof HTMLElement) {
      reportsActionsBar.replaceChildren();

      const exportButton = document.createElement('button');
      exportButton.type = 'button';
      exportButton.className = 'calendar-reports-workspace-action';
      exportButton.textContent =
        getDashboardUiCopy().reports?.exportCsv ?? DEFAULT_DASHBOARD_UI_COPY.reports.exportCsv;
      exportButton.addEventListener('click', exportVisibleReportsCsv);

      const printButton = document.createElement('button');
      printButton.type = 'button';
      printButton.className = 'calendar-reports-workspace-action';
      printButton.textContent =
        getDashboardUiCopy().reports?.print ?? DEFAULT_DASHBOARD_UI_COPY.reports.print;
      printButton.addEventListener('click', () => {
        window.print();
      });

      const customButton = document.createElement('button');
      customButton.type = 'button';
      customButton.className = 'calendar-reports-workspace-action is-primary';
      customButton.textContent =
        getDashboardUiCopy().reports?.newCustomReport ??
        DEFAULT_DASHBOARD_UI_COPY.reports.newCustomReport;
      customButton.addEventListener('click', openCreateCustomReportModal);

      reportsActionsBar.append(exportButton, printButton, customButton);
    }
  };

  const renderReportsSummary = () => {
    if (!(reportsSummary instanceof HTMLElement)) {
      return;
    }

    const rangeAppointments = getAppointmentsInDateRange(getDashboardAppointments());
    const salesInsights = getSalesInsights(rangeAppointments);
    const clientInsights = getClientInsights(rangeAppointments);
    const teamMembers = getDashboardTeamMembers().filter((teamMember) => teamMember.isActive !== false);
    const bookedAppointments = rangeAppointments.filter((appointment) => appointment.status === 'booked');
    const revenueTrend = buildTrendPoints(rangeAppointments, 'revenue');
    const bookingTrend = buildTrendPoints(rangeAppointments, 'count');
    const completedTrend = buildTrendPoints(
      rangeAppointments.filter((appointment) => appointment.status === 'completed'),
      'count'
    );
    const repeatTrend = buildTrendPoints(
      rangeAppointments.filter((appointment) => appointment.status === 'completed'),
      'count'
    );
    const reportsCopy = getDashboardUiCopy().reports ?? DEFAULT_DASHBOARD_UI_COPY.reports;

    reportsSummary.replaceChildren(
      createTrendCard(
        reportsCopy.revenue,
        formatCurrencyLabel(salesInsights.totalRevenue),
        getReportsRangeLabel(),
        revenueTrend,
        'blue'
      ),
      createTrendCard(
        reportsCopy.appointments,
        String(rangeAppointments.length),
        interpolateLabel(reportsCopy.bookedInRangeTemplate, {
          count: bookedAppointments.length
        }),
        bookingTrend,
        'plum'
      ),
      createTrendCard(
        reportsCopy.completed,
        String(rangeAppointments.filter((appointment) => appointment.status === 'completed').length),
        interpolateLabel(reportsCopy.completionFlowTemplate, {
          label: getReportsRangeLabel()
        }),
        completedTrend,
        'green'
      ),
      createTrendCard(
        reportsCopy.clients,
        String(clientInsights.totalClients),
        interpolateLabel(reportsCopy.repeatClientsTeamTemplate, {
          repeat: clientInsights.repeatClients,
          team: teamMembers.length
        }),
        repeatTrend,
        'gold',
        {
          onClick: () => {
            openClientsListModal();
          },
          ariaLabel: 'Open client directory'
        }
      )
    );
  };

  const toggleFavouriteReport = (reportId) => {
    const favourites = new Set(reportsWorkspace.favourites);

    if (favourites.has(reportId)) {
      favourites.delete(reportId);
    } else {
      favourites.add(reportId);
    }

    reportsWorkspace = {
      ...reportsWorkspace,
      favourites: [...favourites]
    };
    persistReportsWorkspace();
    renderReportsWorkspace();
  };

  const duplicateCustomReport = (report) => {
    const customReport = {
      id: `custom-${Date.now()}`,
      title: `${report.title} copy`,
      description: `Custom copy of ${report.title}.`,
      category: report.category,
      categoryLabel: report.categoryLabel,
      summary: report.summary
    };

    reportsWorkspace = {
      ...reportsWorkspace,
      customReports: [...reportsWorkspace.customReports, customReport]
    };
    persistReportsWorkspace();
    activeReportsMenu = 'custom';
    renderReportsWorkspace();
  };

  const openCreateReportFolderModal = (reportToAttach) => {
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = 'Folder name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'e.g. Weekly management';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Create folder';
    form.append(nameField, submitButton);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const folderName = nameInput.value.trim();

      if (!folderName) {
        safeAlert('Please enter a folder name.');
        return;
      }

      const nextFolder = {
        id: `folder-${Date.now()}`,
        name: folderName,
        reportIds: reportToAttach ? [reportToAttach.id] : []
      };

      reportsWorkspace = {
        ...reportsWorkspace,
        folders: [...reportsWorkspace.folders, nextFolder]
      };
      persistReportsWorkspace();
      activeReportsFolderId = nextFolder.id;
      closeToolModal();
      renderReportsWorkspace();
    });

    openToolModal({
      eyebrow: 'Reports',
      title: 'Create folder',
      description: 'Use folders to group the reports you review most often.',
      actions: [form]
    });
  };

  const openAssignReportFolderModal = (report) => {
    if (reportsWorkspace.folders.length === 0) {
      openCreateReportFolderModal(report);
      return;
    }

    const actions = reportsWorkspace.folders.map((folder) =>
      createToolActionButton(folder.name, () => {
        reportsWorkspace = {
          ...reportsWorkspace,
          folders: reportsWorkspace.folders.map((entry) =>
            entry.id === folder.id
              ? {
                  ...entry,
                  reportIds: entry.reportIds.includes(report.id)
                    ? entry.reportIds
                    : [...entry.reportIds, report.id]
                }
              : entry
          )
        };
        persistReportsWorkspace();
        closeToolModal();
        renderReportsWorkspace();
      })
    );

    actions.push(
      createToolActionButton('Create new folder', () => {
        openCreateReportFolderModal(report);
      })
    );

    openToolModal({
      eyebrow: 'Reports',
      title: `Add ${report.title} to folder`,
      description: 'Choose where this report should live in your workspace.',
      actions
    });
  };

  const openReportDetailModal = (reportId) => {
    const report = buildReportsCatalog().find((entry) => entry.id === reportId);

    if (!report) {
      return;
    }

    if (report.id === 'loyalty-dashboard') {
      openClientsListModal();
      return;
    }

    const exportReport = () => {
      downloadCsv(
        `${report.id}.csv`,
        [
          ['Field', 'Value'],
          ['Title', report.title],
          ['Category', report.categoryLabel],
          ['Created By', report.createdBy],
          ['Plan', report.plan],
          ['Summary', report.summary ?? '']
        ]
      );
    };

    openToolModal({
      eyebrow: report.detail?.eyebrow ?? report.categoryLabel ?? 'Reports',
      title: report.title,
      description: report.detail?.description ?? report.description,
      actions: [
        ...(report.detail?.cards ?? []),
        createToolActionButton('Export CSV', exportReport),
        createToolActionButton('Print report', () => {
          window.print();
        }),
        createToolActionButton(
          report.isFavourite ? 'Remove favourite' : 'Add favourite',
          () => {
            toggleFavouriteReport(report.id);
            openReportDetailModal(report.id);
          }
        ),
        ...(report.kind !== 'custom'
          ? [
              createToolActionButton('Duplicate as custom', () => {
                duplicateCustomReport(report);
                closeToolModal();
              })
            ]
          : []),
        createToolActionButton('Add to folder', () => {
          openAssignReportFolderModal(report);
        }),
        ...(report.detail?.actions ?? [])
      ]
    });
  };

  const activateReportsTab = (tabLabel) => {
    setActiveDrawer('');
    setMainView('reports');
    activeReportsTab = tabLabel.toLowerCase();
    activeReportsFolderId = '';
    renderReportsWorkspace();
  };

  const renderSalesDrawer = () => {
    if (!(salesTitle instanceof HTMLElement) || !(salesContent instanceof HTMLElement)) {
      return;
    }

    const salesDrawer = dashboardPayload?.dashboard?.sideDrawers?.sales;
    const commerce = getDashboardCommerce();
    const paymentInsights = getPaymentInsights();

    if (!salesDrawer) {
      return;
    }

    if ((getDashboardUiCopy().locale || '').startsWith('zh')) {
      renderDrawer(salesDrawer, salesTitle, salesContent);
      return;
    }

    const insights = getSalesInsights();
    const enhancedDrawer = {
      ...salesDrawer,
      sections: salesDrawer.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const label = item.label.toLowerCase();

          if (label === 'daily sales summary') {
            return {
              ...item,
              subtitle: `${insights.selectedDayCount} on ${insights.selectedDayLabel} â€¢ ${formatCurrencyLabel(insights.selectedDayRevenue)}`
            };
          }

          if (label === 'appointments') {
            return {
              ...item,
              subtitle: `${insights.totalAppointments} tracked booking${insights.totalAppointments === 1 ? '' : 's'}`
            };
          }

          if (label === 'sales') {
            return {
              ...item,
              subtitle: `${formatCurrencyLabel(insights.totalRevenue)} estimated value`
            };
          }

          if (label === 'payments') {
            return {
              ...item,
              subtitle:
                `${formatMoneyValue(paymentInsights.collectedAmountValue, paymentInsights.currencyCode)} collected â€¢ ` +
                `${formatMoneyValue(paymentInsights.pendingAmountValue, paymentInsights.currencyCode)} pending`
            };
          }

          if (label === 'payments') {
            return {
              ...item,
              subtitle: `${formatCurrencyLabel(insights.collectedRevenue)} completed â€¢ ${formatCurrencyLabel(insights.pendingRevenue)} pending`
            };
          }

          if (label === 'gift cards sold') {
            return {
              ...item,
              subtitle: '0 sold yet'
            };
          }

          if (label === 'packages sold' || label === 'memberships sold') {
            return {
              ...item,
              subtitle: `${commerce.packagesSold} sold - ${commerce.activePackageBalances} active balances`
            };
          }

          return item;
        })
      }))
    };

    renderDrawer(enhancedDrawer, salesTitle, salesContent);
  };

  const renderCatalogDrawer = () => {
    if (!(catalogTitle instanceof HTMLElement) || !(catalogContent instanceof HTMLElement)) {
      return;
    }

    const catalogDrawer = dashboardPayload?.dashboard?.sideDrawers?.catalog;
    const commerce = getDashboardCommerce();
    const productUiCopy = getProductUiCopy();
    const productLabelSingular = productUiCopy.singular || 'product';

    if (!catalogDrawer) {
      return;
    }

    if ((getDashboardUiCopy().locale || '').startsWith('zh')) {
      renderDrawer(catalogDrawer, catalogTitle, catalogContent);
      return;
    }

    const insights = getCatalogInsights();
    const enhancedDrawer = {
      ...catalogDrawer,
      sections: catalogDrawer.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const label = item.label.toLowerCase();

          if (label === 'service menu') {
            return {
              ...item,
              subtitle: `${insights.activeServices} active service${insights.activeServices === 1 ? '' : 's'} â€¢ ${insights.categoryCount} categor${insights.categoryCount === 1 ? 'y' : 'ies'}`
            };
          }

          if (label === 'packages' || label === 'memberships') {
            return {
              ...item,
              subtitle:
                commerce.activePackagePlans > 0
                  ? `${commerce.activePackagePlans} active package plan${commerce.activePackagePlans === 1 ? '' : 's'}`
                  : 'No package plans published yet'
            };
          }

          if (label === 'products') {
            return {
              ...item,
              subtitle:
                commerce.activeProducts > 0
                  ? `${commerce.activeProducts} active ${productLabelSingular}${commerce.activeProducts === 1 ? '' : 's'} | ${commerce.productUnitsSold} sold`
                  : `0 active products | ${insights.totalProductStock} in stock`
            };
          }

          if (label === 'stocktakes') {
            return {
              ...item,
              subtitle: 'Inventory counts are not started yet'
            };
          }

          if (label === 'stock orders') {
            return {
              ...item,
              subtitle: 'No supplier purchase orders yet'
            };
          }

          if (label === 'suppliers') {
            return {
              ...item,
              subtitle: 'Supplier management is ready for setup'
            };
          }

          return item;
        })
      }))
    };

    renderDrawer(enhancedDrawer, catalogTitle, catalogContent);
  };

  const renderClientsDrawer = () => {
    if (!(clientsTitle instanceof HTMLElement) || !(clientsContent instanceof HTMLElement)) {
      return;
    }

    const clientsDrawer = dashboardPayload?.dashboard?.sideDrawers?.clients;

    if (!clientsDrawer) {
      return;
    }

    if ((getDashboardUiCopy().locale || '').startsWith('zh')) {
      renderDrawer(clientsDrawer, clientsTitle, clientsContent);
      return;
    }

    const insights = getClientInsights();
    const enhancedDrawer = {
      ...clientsDrawer,
      sections: clientsDrawer.sections.map((section) => ({
        ...section,
        items: section.items.map((item) => {
          const label = item.label.toLowerCase();

          if (label === 'clients list') {
            return {
              ...item,
              subtitle: `${insights.totalClients} client${insights.totalClients === 1 ? '' : 's'} recorded`
            };
          }

          if (label === 'client loyalty') {
            return {
              ...item,
              subtitle: `${insights.loyaltyCandidates} ready for loyalty follow-up`
            };
          }

          return item;
        })
      }))
    };

    renderDrawer(enhancedDrawer, clientsTitle, clientsContent);
  };

  const openSalesSummaryModal = () => {
    const insights = getSalesInsights();
    const topService = insights.topServices[0];

    openToolModal({
      eyebrow: 'Sales',
      title: `Daily sales summary â€¢ ${insights.selectedDayLabel}`,
      description: 'Track the day view of bookings and estimated revenue from your active service prices.',
      actions: [
        createToolInfoCard(
          'Day bookings',
          `${insights.selectedDayCount} appointment${insights.selectedDayCount === 1 ? '' : 's'} worth ${formatCurrencyLabel(insights.selectedDayRevenue)}.`
        ),
        createToolInfoCard(
          'Top service',
          topService
            ? `${topService.serviceName} leads with ${topService.count} booking${topService.count === 1 ? '' : 's'} and ${topService.revenueLabel}.`
            : 'No services have been booked yet.'
        ),
        createToolActionButton('Open reports', () => {
          closeToolModal();
          activateReportsTab('Sales');
          reportsSearchInput?.focus();
        }),
        createToolActionButton('View appointments', () => {
          closeToolModal();
          setMainView('calendar');
          setActiveDrawer('');
          appointmentFilter = 'all';
          syncAppointmentsUi();
          appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      ]
    });
  };

  const openSalesOverviewModal = () => {
    const insights = getSalesInsights();

    openToolModal({
      eyebrow: 'Sales',
      title: 'Sales overview',
      description: 'This combines booked and completed appointments into an estimated revenue overview.',
      actions: [
        createToolInfoCard(
          'Estimated revenue',
          `${formatCurrencyLabel(insights.totalRevenue)} across ${insights.totalAppointments} appointment${insights.totalAppointments === 1 ? '' : 's'}.`
        ),
        createToolInfoCard(
          'Top services',
          insights.topServices.length > 0
            ? insights.topServices
                .map((service) => `${service.serviceName} (${service.count}, ${service.revenueLabel})`)
                .join(' â€¢ ')
            : 'Top services will appear after the first bookings come in.'
        ),
        createToolActionButton('Open sales reports', () => {
          closeToolModal();
          activateReportsTab('Sales');
        }),
        ...serviceCards,
        createToolActionButton('Add service', () => {
          closeToolModal();
          openServiceFormModal({ mode: 'add' });
        }),
        createToolActionButton('Open booking page', () => {
          closeToolModal();
          if (publicBookingPath) {
            window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
          }
        })
      ]
    });
  };

  const recordAppointmentPayment = async (appointmentId, values) => {
    if (!clientId) {
      return null;
    }

    const payload = await apiRequest(
      buildAdminAppointmentPath(clientId, appointmentId, '/payments'),
      {
        method: 'POST',
        body: JSON.stringify(values)
      }
    );

    await loadDashboard();
    return payload;
  };

  const openRecordPaymentModal = (preferredAppointmentId = '') => {
    if (!clientId) {
      return;
    }

    const paymentInsights = getPaymentInsights();
    const outstandingBalances = getOutstandingPaymentBalances();

    if (outstandingBalances.length === 0) {
      openToolModal({
        eyebrow: 'Payments',
        title: 'No outstanding balances',
        description: 'Every tracked appointment is already fully paid or does not need payment capture yet.',
        actions: [
          createToolInfoCard(
            'Outstanding appointments',
            '0 appointments currently require payment collection.'
          ),
          createToolActionButton('Open payments snapshot', () => {
            closeToolModal();
            openPaymentsModal();
          })
        ]
      });
      return;
    }

    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const appointmentField = document.createElement('label');
    appointmentField.className = 'calendar-tool-field';
    const appointmentLabel = document.createElement('span');
    appointmentLabel.textContent = 'Appointment';
    const appointmentSelect = document.createElement('select');
    appointmentSelect.name = 'appointmentId';
    appointmentSelect.required = true;
    appointmentField.append(appointmentLabel, appointmentSelect);

    const methodField = document.createElement('label');
    methodField.className = 'calendar-tool-field';
    const methodLabel = document.createElement('span');
    methodLabel.textContent = 'Payment method';
    const methodSelect = document.createElement('select');
    methodSelect.name = 'method';
    methodSelect.required = true;
    for (const optionConfig of PAYMENT_METHOD_OPTIONS) {
      const option = document.createElement('option');
      option.value = optionConfig.value;
      option.textContent = optionConfig.label;
      methodSelect.append(option);
    }
    methodField.append(methodLabel, methodSelect);

    const amountField = document.createElement('label');
    amountField.className = 'calendar-tool-field';
    const amountLabel = document.createElement('span');
    amountLabel.textContent = 'Amount paid';
    const amountInput = document.createElement('input');
    amountInput.type = 'number';
    amountInput.name = 'amountValue';
    amountInput.min = '0.01';
    amountInput.step = '0.01';
    amountInput.required = true;
    amountField.append(amountLabel, amountInput);

    const noteField = document.createElement('label');
    noteField.className = 'calendar-tool-field';
    const noteLabel = document.createElement('span');
    noteLabel.textContent = 'Note (optional)';
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.name = 'note';
    noteInput.maxLength = 240;
    noteInput.placeholder = 'Receipt number, split payment, or admin note';
    noteField.append(noteLabel, noteInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Record payment';

    form.append(appointmentField, methodField, amountField, noteField, submitButton);

    const balanceCard = createToolInfoCard('Outstanding balance', '');
    const balanceCopy = balanceCard.querySelector('p');
    const detailsCard = createToolInfoCard('Appointment details', '');
    const detailsCopy = detailsCard.querySelector('p');

    const updateSelectedBalance = () => {
      const selectedBalance =
        outstandingBalances.find((balance) => balance.appointmentId === appointmentSelect.value) ??
        outstandingBalances[0];

      if (!selectedBalance) {
        amountInput.value = '';
        amountInput.max = '';
        return null;
      }

      appointmentSelect.value = selectedBalance.appointmentId;
      amountInput.max = String(selectedBalance.outstandingAmountValue);
      amountInput.value = String(selectedBalance.outstandingAmountValue);

      if (balanceCopy instanceof HTMLElement) {
        balanceCopy.textContent =
          `${formatMoneyValue(selectedBalance.outstandingAmountValue, selectedBalance.currencyCode)} due ` +
          `after ${formatMoneyValue(selectedBalance.paidAmountValue, selectedBalance.currencyCode)} already recorded.`;
      }

      if (detailsCopy instanceof HTMLElement) {
        detailsCopy.textContent =
          `${selectedBalance.customerName} | ${selectedBalance.serviceName} | ` +
          `${formatDateTimeForDisplay(selectedBalance.appointmentDate, selectedBalance.appointmentTime)}`;
      }

      return selectedBalance;
    };

    for (const balance of outstandingBalances) {
      const option = document.createElement('option');
      option.value = balance.appointmentId;
      option.textContent = buildPaymentBalanceLabel(balance, paymentInsights.currencyCode);
      appointmentSelect.append(option);
    }

    appointmentSelect.value =
      outstandingBalances.some((balance) => balance.appointmentId === preferredAppointmentId)
        ? preferredAppointmentId
        : outstandingBalances[0].appointmentId;
    appointmentSelect.addEventListener('change', updateSelectedBalance);
    updateSelectedBalance();

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const selectedBalance = updateSelectedBalance();
      const amountValue = Number(amountInput.value);

      if (!selectedBalance) {
        safeAlert('Choose an appointment with an outstanding balance.');
        return;
      }

      if (!Number.isFinite(amountValue) || amountValue <= 0) {
        safeAlert('Enter a valid payment amount greater than zero.');
        return;
      }

      if (amountValue - selectedBalance.outstandingAmountValue > 0.0001) {
        safeAlert('Payment amount cannot exceed the outstanding balance.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Recording...';

      try {
        const payload = await recordAppointmentPayment(selectedBalance.appointmentId, {
          amountValue,
          method: methodSelect.value,
          note: noteInput.value.trim()
        });

        closeToolModal();
        openPaymentsModal();
        safeAlert(
          payload?.balance
            ? `Payment recorded. Remaining balance: ${formatMoneyValue(
                payload.balance.outstandingAmountValue,
                payload.balance.currencyCode
              )}.`
            : 'Payment recorded.'
        );
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Record payment';
        safeAlert(error instanceof Error ? error.message : 'Unable to record payment');
      }
    });

    openToolModal({
      eyebrow: 'Payments',
      title: 'Record payment',
      description: 'Capture a real payment entry against an appointment balance. This is stored separately from booking status.',
      actions: [balanceCard, detailsCard, form]
    });

    amountInput.focus();
    amountInput.select();
  };

  const openPaymentsModal = () => {
    const paymentInsights = getPaymentInsights();
    const outstandingBalances = [...getOutstandingPaymentBalances()]
      .sort((left, right) => right.outstandingAmountValue - left.outstandingAmountValue)
      .slice(0, 3);
    const recentPayments = [...paymentInsights.payments]
      .sort((left, right) => `${right.createdAt}`.localeCompare(`${left.createdAt}`))
      .slice(0, 3);
    const actions = [
      createToolInfoCard(
        'Collected value',
        formatMoneyValue(paymentInsights.collectedAmountValue, paymentInsights.currencyCode)
      ),
      createToolInfoCard(
        'Pending value',
        `${formatMoneyValue(paymentInsights.pendingAmountValue, paymentInsights.currencyCode)} across ` +
          `${paymentInsights.outstandingAppointmentsCount} appointment${paymentInsights.outstandingAppointmentsCount === 1 ? '' : 's'}.`
      ),
      createToolInfoCard(
        'Recorded payments',
        `${paymentInsights.recordedPaymentsCount} posted payment entr${paymentInsights.recordedPaymentsCount === 1 ? 'y' : 'ies'} tracked.`
      )
    ];

    if (outstandingBalances.length > 0) {
      actions.push(
        createToolInfoCard(
          'Next balances to collect',
          outstandingBalances
            .map((balance) => buildPaymentBalanceLabel(balance, paymentInsights.currencyCode))
            .join(' || ')
        )
      );
    } else {
      actions.push(
        createToolInfoCard(
          'Outstanding balances',
          'No unpaid appointment balances are pending right now.'
        )
      );
    }

    if (recentPayments.length > 0) {
      actions.push(
        createToolInfoCard(
          'Recent payments',
          recentPayments
            .map((payment) => buildPaymentRecordLabel(payment, paymentInsights.currencyCode))
            .join(' || ')
        )
      );
    } else {
      actions.push(
        createToolInfoCard(
          'Recent payments',
          'No payments have been recorded yet.'
        )
      );
    }

    actions.push(
      createToolActionButton('Record payment', () => {
        closeToolModal();
        openRecordPaymentModal();
      })
    );
    actions.push(
      createToolActionButton('Open finance reports', () => {
        closeToolModal();
        activateReportsTab('Finance');
      })
    );
    actions.push(
      createToolActionButton('View booked appointments', () => {
        closeToolModal();
        setMainView('calendar');
        setActiveDrawer('');
        appointmentFilter = 'booked';
        syncAppointmentsUi();
        appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );

    openToolModal({
      eyebrow: 'Payments',
      title: 'Payments snapshot',
      description: 'This finance view now uses recorded payment entries and live appointment balances instead of estimated completion totals.',
      actions
    });
  };

  const openGiftCardsModal = () => {
    openToolModal({
      eyebrow: 'Sales',
      title: 'Gift cards sold',
      description: 'Gift cards do not have checkout flows yet, but this entry now clearly shows the current state.',
      actions: [
        createToolInfoCard('Gift cards', '0 sold yet. Add gift-card setup when checkout products are introduced.'),
        createToolActionButton('Configure loyalty', () => {
          closeToolModal();
          openConfigureLoyaltyProgramModal();
        }),
        createToolActionButton('Open marketing tools', () => {
          closeToolModal();
          marketingAction?.click();
        }),
        createToolActionButton('Open sales reports', () => {
          closeToolModal();
          activateReportsTab('Sales');
        })
      ]
    });
  };

  const createMultiSelectField = (labelText, options, emptyCopy) => {
    const field = document.createElement('label');
    field.className = 'calendar-tool-field';

    const label = document.createElement('span');
    label.textContent = labelText;

    const select = document.createElement('select');
    select.multiple = true;
    select.size = Math.max(3, Math.min(6, options.length || 3));

    if (options.length === 0) {
      const option = document.createElement('option');
      option.value = '';
      option.textContent = emptyCopy;
      select.append(option);
      select.disabled = true;
    } else {
      for (const item of options) {
        const option = document.createElement('option');
        option.value = item.value;
        option.textContent = item.label;
        select.append(option);
      }
    }

    field.append(label, select);
    return { field, select };
  };

  const getSelectedValues = (select) =>
    [...select.selectedOptions]
      .map((option) => option.value)
      .filter((value) => typeof value === 'string' && value.trim().length > 0);

  const createPackagePlan = async ({ name, totalUses, priceLabel, includedServiceIds }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/packages`, {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        totalUses,
        priceLabel: priceLabel.trim(),
        includedServiceIds
      })
    });

    await loadDashboard();
  };

  const updatePackagePlan = async (packagePlanId, { name, totalUses, priceLabel, includedServiceIds }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/packages/${encodeURIComponent(packagePlanId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        totalUses,
        priceLabel: priceLabel.trim(),
        includedServiceIds
      })
    });

    await loadDashboard();
  };

  const removePackagePlan = async (packagePlanId) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/packages/${encodeURIComponent(packagePlanId)}`, {
      method: 'DELETE'
    });

    await loadDashboard();
  };

  const saveLoyaltyProgram = async ({ isEnabled, triggerCompletedVisits, rewardValue, includedServiceIds }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/loyalty-program`, {
      method: 'PUT',
      body: JSON.stringify({
        isEnabled,
        triggerCompletedVisits,
        rewardValue,
        includedServiceIds
      })
    });

    await loadDashboard();
  };

  const createPackageSale = async ({ packagePlanId, customerName, customerPhone, customerEmail }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/package-sales`, {
      method: 'POST',
      body: JSON.stringify({
        packagePlanId,
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim()
      })
    });

    await loadDashboard();
  };

  const createProduct = async ({ name, categoryName, sku, priceLabel, stockQuantity, description }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/products`, {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        categoryName: categoryName.trim(),
        sku: sku.trim(),
        priceLabel: priceLabel.trim(),
        stockQuantity: Math.max(0, Math.round(stockQuantity)),
        description: description.trim()
      })
    });

    await loadDashboard();
  };

  const updateProduct = async (
    productId,
    { name, categoryName, sku, priceLabel, stockQuantity, description }
  ) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/products/${encodeURIComponent(productId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        categoryName: categoryName.trim(),
        sku: sku.trim(),
        priceLabel: priceLabel.trim(),
        stockQuantity: Math.max(0, Math.round(stockQuantity)),
        description: description.trim()
      })
    });

    await loadDashboard();
  };

  const removeProduct = async (productId) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/products/${encodeURIComponent(productId)}`, {
      method: 'DELETE'
    });

    await loadDashboard();
  };

  const createProductSale = async ({ productId, quantity, customerName, customerPhone, customerEmail }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/product-sales`, {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity: Math.max(1, Math.round(quantity)),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        customerEmail: customerEmail.trim()
      })
    });

    await loadDashboard();
  };

  const openPackagePlanFormModal = ({ mode = 'add', packagePlan = null } = {}) => {
    const packageUiCopy = getPackageUiCopy();
    const packageLabelSingular = packageUiCopy.singular || 'package';
    const packageLabelPlural = packageUiCopy.plural || `${packageLabelSingular}s`;
    const packageLabelDisplay = formatRoleLabelDisplay(packageLabelSingular);
    const saveActionLabel = packageUiCopy.actionSave || `Save ${packageLabelSingular}`;
    const updateActionLabel = packageUiCopy.actionUpdate || `Update ${packageLabelSingular}`;
    const addActionLabel = packageUiCopy.actionAdd || `Add ${packageLabelSingular}`;
    const editActionLabel = packageUiCopy.actionEdit || 'Edit';
    const services = getDashboardServices();
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = packageUiCopy.fieldName || `${packageLabelDisplay} name`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Enter ${packageLabelSingular} name`;
    nameInput.value = packagePlan?.name ?? '';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const usesField = document.createElement('label');
    usesField.className = 'calendar-tool-field';
    const usesLabel = document.createElement('span');
    usesLabel.textContent = packageUiCopy.fieldTotalUses || 'Total uses';
    const usesInput = document.createElement('input');
    usesInput.type = 'number';
    usesInput.min = '1';
    usesInput.max = '100';
    usesInput.value = String(packagePlan?.totalUses ?? 5);
    usesInput.required = true;
    usesField.append(usesLabel, usesInput);

    const priceField = document.createElement('label');
    priceField.className = 'calendar-tool-field';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = packageUiCopy.fieldPrice || `${packageLabelDisplay} price`;
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.placeholder = `e.g. ${formatCurrencyExampleLabel(4500)}`;
    priceInput.value = packagePlan?.priceLabel ?? '';
    priceInput.required = true;
    priceField.append(priceLabel, priceInput);

    const servicesFieldConfig = createMultiSelectField(
      packageUiCopy.fieldIncludedServices || 'Included services',
      services.map((service) => ({
        value: service.id,
        label: `${service.name} - ${service.priceLabel}`
      })),
      'Add services first'
    );

    if (packagePlan?.includedServiceIds?.length) {
      for (const option of servicesFieldConfig.select.options) {
        option.selected = packagePlan.includedServiceIds.includes(option.value);
      }
    }

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;

    form.append(nameField, usesField, priceField, servicesFieldConfig.field, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!nameInput.value.trim() || !priceInput.value.trim()) {
        safeAlert(
          packageUiCopy.validationRequired ||
            `Please enter a ${packageLabelSingular} name and price.`
        );
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = `${mode === 'edit' ? updateActionLabel : saveActionLabel}...`;

      try {
        if (mode === 'edit' && packagePlan?.id) {
          await updatePackagePlan(packagePlan.id, {
            name: nameInput.value,
            totalUses: Number(usesInput.value),
            priceLabel: priceInput.value,
            includedServiceIds: getSelectedValues(servicesFieldConfig.select)
          });
        } else {
          await createPackagePlan({
            name: nameInput.value,
            totalUses: Number(usesInput.value),
            priceLabel: priceInput.value,
            includedServiceIds: getSelectedValues(servicesFieldConfig.select)
          });
        }
        closeToolModal();
        openCatalogMembershipsModal();
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : mode === 'edit'
              ? packageUiCopy.errorUpdate || `Unable to update ${packageLabelSingular}`
              : packageUiCopy.errorAdd || `Unable to add ${packageLabelSingular}`
        );
      }
    });

    openToolModal({
      eyebrow: 'Catalog',
      title: mode === 'edit' ? `${editActionLabel} ${packagePlan?.name || packageLabelSingular}` : addActionLabel,
      description:
        mode === 'edit'
          ? packageUiCopy.formEditDescription ||
            `Update the ${packageLabelSingular} details used for prepaid balances and redemption.`
          : packageUiCopy.formAddDescription ||
            `Create a new ${packageLabelSingular} and add it to your live ${packageLabelPlural} list.`,
      actions: [form]
    });
  };

  const openConfigureLoyaltyProgramModal = () => {
    const services = getDashboardServices();
    const loyaltyProgram = getDashboardLoyaltyProgram();
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const enabledField = document.createElement('label');
    enabledField.className = 'calendar-tool-field';
    const enabledLabel = document.createElement('span');
    enabledLabel.textContent = 'Program status';
    const enabledSelect = document.createElement('select');
    for (const [value, labelText] of [
      ['true', 'Enabled'],
      ['false', 'Disabled']
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = labelText;
      enabledSelect.append(option);
    }
    enabledSelect.value = loyaltyProgram?.isEnabled === false ? 'false' : 'true';
    enabledField.append(enabledLabel, enabledSelect);

    const visitsField = document.createElement('label');
    visitsField.className = 'calendar-tool-field';
    const visitsLabel = document.createElement('span');
    visitsLabel.textContent = 'Reward after completed visits';
    const visitsInput = document.createElement('input');
    visitsInput.type = 'number';
    visitsInput.min = '1';
    visitsInput.max = '50';
    visitsInput.value = String(loyaltyProgram?.triggerCompletedVisits ?? 5);
    visitsInput.required = true;
    visitsField.append(visitsLabel, visitsInput);

    const rewardField = document.createElement('label');
    rewardField.className = 'calendar-tool-field';
    const rewardLabel = document.createElement('span');
    rewardLabel.textContent = 'Reward percent';
    const rewardInput = document.createElement('input');
    rewardInput.type = 'number';
    rewardInput.min = '1';
    rewardInput.max = '100';
    rewardInput.value = String(loyaltyProgram?.rewardValue ?? 10);
    rewardInput.required = true;
    rewardField.append(rewardLabel, rewardInput);

    const servicesFieldConfig = createMultiSelectField(
      'Eligible services',
      services.map((service) => ({
        value: service.id,
        label: `${service.name} - ${service.priceLabel}`
      })),
      'Add services first'
    );

    if (loyaltyProgram?.includedServiceIds?.length) {
      for (const option of servicesFieldConfig.select.options) {
        option.selected = loyaltyProgram.includedServiceIds.includes(option.value);
      }
    }

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Save loyalty';

    form.append(enabledField, visitsField, rewardField, servicesFieldConfig.field, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';

      try {
        await saveLoyaltyProgram({
          isEnabled: enabledSelect.value === 'true',
          triggerCompletedVisits: Number(visitsInput.value),
          rewardValue: Number(rewardInput.value),
          includedServiceIds: getSelectedValues(servicesFieldConfig.select)
        });
        closeToolModal();
        openClientLoyaltyModal();
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save loyalty';
        safeAlert(error instanceof Error ? error.message : 'Unable to save loyalty');
      }
    });

    openToolModal({
      eyebrow: 'Clients',
      title: 'Configure loyalty',
      description: 'Reward repeat clients automatically after a chosen number of completed visits.',
      actions: [form]
    });
  };

  const openSellPackageModal = () => {
    const packageUiCopy = getPackageUiCopy();
    const packageLabelSingular = packageUiCopy.singular || 'package';
    const packageLabelPlural = packageUiCopy.plural || `${packageLabelSingular}s`;
    const sellActionLabel = packageUiCopy.actionSell || `Sell ${packageLabelSingular}`;
    const packagePlans = getDashboardPackagePlans().filter((packagePlan) => packagePlan.isActive !== false);

    if (packagePlans.length === 0) {
      safeAlert(packageUiCopy.emptyDescription || `Add your first ${packageLabelSingular} before selling it.`);
      openCatalogMembershipsModal();
      return;
    }

    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const packageField = document.createElement('label');
    packageField.className = 'calendar-tool-field';
    const packageLabel = document.createElement('span');
    packageLabel.textContent = `${formatRoleLabelDisplay(packageLabelSingular)} plan`;
    const packageSelect = document.createElement('select');
    for (const packagePlan of packagePlans) {
      const option = document.createElement('option');
      option.value = packagePlan.id;
      option.textContent = `${packagePlan.name} - ${packagePlan.priceLabel}`;
      packageSelect.append(option);
    }
    packageField.append(packageLabel, packageSelect);

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = 'Customer name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter customer name';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const phoneField = document.createElement('label');
    phoneField.className = 'calendar-tool-field';
    const phoneLabel = document.createElement('span');
    phoneLabel.textContent = 'Customer phone';
    const phoneInput = document.createElement('input');
    phoneInput.type = 'text';
    phoneInput.placeholder = DEFAULT_PHONE_PLACEHOLDER;
    phoneInput.required = true;
    phoneField.append(phoneLabel, phoneInput);

    const emailField = document.createElement('label');
    emailField.className = 'calendar-tool-field';
    const emailLabel = document.createElement('span');
    emailLabel.textContent = 'Customer email';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'name@example.com';
    emailField.append(emailLabel, emailInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = sellActionLabel;

    form.append(packageField, nameField, phoneField, emailField, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      submitButton.disabled = true;
      submitButton.textContent = `${sellActionLabel}...`;

      try {
        await createPackageSale({
          packagePlanId: packageSelect.value,
          customerName: nameInput.value,
          customerPhone: phoneInput.value,
          customerEmail: emailInput.value
        });
        closeToolModal();
        openMembershipsModal();
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = sellActionLabel;
        safeAlert(error instanceof Error ? error.message : `Unable to sell ${packageLabelSingular}`);
      }
    });

    openToolModal({
      eyebrow: 'Sales',
      title: sellActionLabel,
      description: `Assign a prepaid ${packageLabelSingular} balance to a customer so it can be redeemed during booking.`,
      actions: [form]
    });
  };

  const openMembershipsModal = () => {
    const packageUiCopy = getPackageUiCopy();
    const packageLabelSingular = packageUiCopy.singular || 'package';
    const packageLabelPlural = packageUiCopy.plural || `${packageLabelSingular}s`;
    const sellActionLabel = packageUiCopy.actionSell || `Sell ${packageLabelSingular}`;
    const openCatalogActionLabel = packageUiCopy.actionOpenCatalog || `Open ${packageLabelPlural}`;
    const openReportsActionLabel = packageUiCopy.actionOpenReports || 'Open finance reports';
    const commerce = getDashboardCommerce();
    const packagePlans = getDashboardPackagePlans().filter((packagePlan) => packagePlan.isActive !== false);

    openToolModal({
      eyebrow: 'Sales',
      title: packageUiCopy.soldLabel || `${formatRoleLabelDisplay(packageLabelPlural)} sold`,
      description: `Sell prepaid ${packageLabelPlural}, track remaining balances, and connect them directly to bookings.`,
      actions: [
        createToolInfoCard(
          packageUiCopy.soldLabel || `${formatRoleLabelDisplay(packageLabelPlural)} sold`,
          String(commerce.packagesSold)
        ),
        createToolInfoCard(
          packageUiCopy.activeBalancesLabel || 'Active balances',
          String(commerce.activePackageBalances)
        ),
        createToolInfoCard(
          packageUiCopy.publishedLabel || 'Published plans',
          packagePlans.length > 0
            ? packagePlans.map((packagePlan) => packagePlan.name).join(' | ')
            : packageUiCopy.emptyDescription || `No ${packageLabelPlural} published yet.`
        ),
        createToolActionButton(sellActionLabel, () => {
          closeToolModal();
          openSellPackageModal();
        }),
        createToolActionButton(openCatalogActionLabel, () => {
          closeToolModal();
          openCatalogMembershipsModal();
        }),
        createToolActionButton(openReportsActionLabel, () => {
          closeToolModal();
          activateReportsTab('Finance');
        })
      ]
    });
  };

  const getDefaultTeamMemberRole = () => {
    const roleLabel = getBusinessRoleLabel();
    return roleLabel.charAt(0).toUpperCase() + roleLabel.slice(1);
  };

  const getTeamRoleOptions = async (teamMember = null) => {
    const roleOptions = [];
    const seenRoleOptions = new Set();
    const appendRoleOption = (value) => {
      const normalizedValue = typeof value === 'string' ? value.trim() : '';

      if (!normalizedValue) {
        return;
      }

      const dedupeKey = normalizedValue.toLowerCase();

      if (seenRoleOptions.has(dedupeKey)) {
        return;
      }

      seenRoleOptions.add(dedupeKey);
      roleOptions.push(normalizedValue);
    };

    try {
      const config = await loadPublicConfig();

      if (Array.isArray(config?.teamMemberRoleOptions)) {
        for (const roleOption of config.teamMemberRoleOptions) {
          appendRoleOption(roleOption);
        }
      }
    } catch (_error) {
      // Fall back to existing saved roles when public config is unavailable.
    }

    for (const savedTeamMember of getDashboardTeamMembers()) {
      appendRoleOption(savedTeamMember?.role);
    }

    appendRoleOption(teamMember?.role);
    appendRoleOption(getDefaultTeamMemberRole());

    return roleOptions;
  };

  const getTeamExpertiseOptions = (teamMember = null) => {
    const expertiseOptions = new Set();

    for (const savedTeamMember of getDashboardTeamMembers()) {
      if (typeof savedTeamMember?.expertise === 'string' && savedTeamMember.expertise.trim()) {
        expertiseOptions.add(savedTeamMember.expertise.trim());
      }
    }

    for (const service of getDashboardServices()) {
      if (typeof service?.name === 'string' && service.name.trim()) {
        expertiseOptions.add(service.name.trim());
      }

      if (typeof service?.categoryName === 'string' && service.categoryName.trim()) {
        expertiseOptions.add(service.categoryName.trim());
      }
    }

    const serviceTypes = Array.isArray(dashboardPayload?.client?.serviceTypes)
      ? dashboardPayload.client.serviceTypes
      : [];

    for (const serviceType of serviceTypes) {
      if (typeof serviceType === 'string' && serviceType.trim()) {
        expertiseOptions.add(serviceType.trim());
      }
    }

    if (typeof teamMember?.expertise === 'string' && teamMember.expertise.trim()) {
      expertiseOptions.add(teamMember.expertise.trim());
    }

    return [...expertiseOptions].sort((left, right) => left.localeCompare(right));
  };

  const formatTeamMemberScheduleSummary = (teamMember) => {
    const weekdayLabels = new Map(getWeekdayDisplayOptions().map((option) => [option.value, option.label]));
    const openingTimeLabel = formatTimeForDisplay(teamMember?.openingTime);
    const closingTimeLabel = formatTimeForDisplay(teamMember?.closingTime);
    const offDays = Array.isArray(teamMember?.offDays) ? teamMember.offDays : [];
    const offDayLabels = offDays.map((offDay) => weekdayLabels.get(offDay) || offDay).filter(Boolean);
    const scheduleParts = [];

    if (openingTimeLabel && closingTimeLabel) {
      scheduleParts.push(`${openingTimeLabel} - ${closingTimeLabel}`);
    }

    if (offDayLabels.length > 0) {
      scheduleParts.push(offDayLabels.join(', '));
    }

    return scheduleParts.join(' | ');
  };

  const refreshTeamMembersView = async () => {
    await loadDashboard();
    setMainView('calendar');
    syncSideDrawerOffset();
    setActiveDrawer('team');
    openTeamMembersModal();
  };

  const addTeamMember = async ({
    name,
    role,
    phone,
    expertise,
    openingTime,
    closingTime,
    offDays,
    isActive
  }) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/team-members`, {
      method: 'POST',
      body: JSON.stringify({
        name: name.trim(),
        role: role.trim(),
        phone: phone.trim(),
        expertise: expertise.trim(),
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
        offDays,
        isActive
      })
    });

    await refreshTeamMembersView();
  };

  const updateTeamMember = async (
    teamMemberId,
    { name, role, phone, expertise, openingTime, closingTime, offDays, isActive }
  ) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/team-members/${encodeURIComponent(teamMemberId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        role: role.trim(),
        phone: phone.trim(),
        expertise: expertise.trim(),
        openingTime: openingTime.trim(),
        closingTime: closingTime.trim(),
        offDays,
        isActive
      })
    });

    await refreshTeamMembersView();
  };

  const removeTeamMember = async (teamMemberId) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/team-members/${encodeURIComponent(teamMemberId)}`, {
      method: 'DELETE'
    });

    await refreshTeamMembersView();
  };

  const openTeamMemberFormModal = async ({ mode = 'add', teamMember = null } = {}) => {
    const roleLabel = getBusinessRoleLabel();
    const roleLabelDisplay = formatRoleLabelDisplay(roleLabel);
    const scheduleUiCopy = getTeamMemberScheduleUiCopy();
    const defaultRole = teamMember?.role || getDefaultTeamMemberRole();
    const roleOptions = await getTeamRoleOptions(teamMember);
    const expertiseOptions = getTeamExpertiseOptions(teamMember);
    const weekdayOptions = getWeekdayDisplayOptions();
    const currentExpertise =
      typeof teamMember?.expertise === 'string' ? teamMember.expertise.trim() : '';
    const hasPresetExpertise = currentExpertise && expertiseOptions.includes(currentExpertise);
    const currentOffDays = new Set(Array.isArray(teamMember?.offDays) ? teamMember.offDays : []);
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = `${roleLabelDisplay} name`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.name = 'name';
    nameInput.placeholder = `Enter ${roleLabel} name`;
    nameInput.value = teamMember?.name ?? '';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const roleField = document.createElement('label');
    roleField.className = 'calendar-tool-field';
    const roleFieldLabel = document.createElement('span');
    roleFieldLabel.textContent = 'Role';
    const roleInput = document.createElement('input');
    roleInput.type = 'hidden';
    roleInput.name = 'role';
    roleInput.value = defaultRole;
    roleInput.required = true;
    const rolePicker = document.createElement('div');
    rolePicker.className = 'calendar-role-picker';
    const roleTrigger = document.createElement('button');
    roleTrigger.type = 'button';
    roleTrigger.className = 'calendar-role-picker-trigger';
    roleTrigger.setAttribute('aria-haspopup', 'listbox');
    roleTrigger.setAttribute('aria-expanded', 'false');
    const roleTriggerLabel = document.createElement('span');
    roleTriggerLabel.className = 'calendar-role-picker-trigger-label';
    const roleTriggerIcon = document.createElement('span');
    roleTriggerIcon.className = 'calendar-role-picker-trigger-icon';
    roleTriggerIcon.setAttribute('aria-hidden', 'true');
    roleTriggerIcon.innerHTML =
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M7 10l5 5 5-5"></path></svg>';
    roleTrigger.append(roleTriggerLabel, roleTriggerIcon);
    const roleMenu = document.createElement('div');
    roleMenu.className = 'calendar-role-picker-menu';
    roleMenu.setAttribute('role', 'listbox');

    const setRolePickerOpen = (isOpen) => {
      rolePicker.classList.toggle('is-open', isOpen);
      roleTrigger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    };

    const syncRoleSelection = (nextRole) => {
      roleInput.value = nextRole;
      roleTriggerLabel.textContent = nextRole;

      for (const optionButton of roleMenu.querySelectorAll('.calendar-role-picker-option')) {
        if (!(optionButton instanceof HTMLButtonElement)) {
          continue;
        }

        const isSelected = optionButton.dataset.roleValue === nextRole;
        optionButton.classList.toggle('is-selected', isSelected);
        optionButton.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      }
    };

    for (const roleOption of roleOptions) {
      const roleOptionButton = document.createElement('button');
      roleOptionButton.type = 'button';
      roleOptionButton.className = 'calendar-role-picker-option';
      roleOptionButton.dataset.roleValue = roleOption;
      roleOptionButton.setAttribute('role', 'option');
      roleOptionButton.textContent = roleOption;
      roleOptionButton.addEventListener('click', () => {
        syncRoleSelection(roleOption);
        setRolePickerOpen(false);
      });
      roleMenu.append(roleOptionButton);
    }

    roleTrigger.addEventListener('click', () => {
      setRolePickerOpen(!rolePicker.classList.contains('is-open'));
    });

    const closeRolePickerOnPointerDown = (event) => {
      if (!document.body.contains(rolePicker)) {
        document.removeEventListener('pointerdown', closeRolePickerOnPointerDown, true);
        return;
      }

      if (event.target instanceof Node && rolePicker.contains(event.target)) {
        return;
      }

      setRolePickerOpen(false);
    };

    document.addEventListener('pointerdown', closeRolePickerOnPointerDown, true);
    syncRoleSelection(roleInput.value || roleOptions[0] || defaultRole);
    rolePicker.append(roleTrigger, roleMenu);
    roleField.append(roleFieldLabel, roleInput, rolePicker);

    const phoneField = document.createElement('label');
    phoneField.className = 'calendar-tool-field';
    const phoneLabel = document.createElement('span');
    phoneLabel.textContent = 'Mobile number';
    const phoneInput = document.createElement('input');
    phoneInput.type = 'text';
    phoneInput.name = 'phone';
    phoneInput.placeholder = `e.g. ${DEFAULT_PHONE_PLACEHOLDER}`;
    phoneInput.value = teamMember?.phone ?? '';
    phoneField.append(phoneLabel, phoneInput);

    const openingTimeField = document.createElement('label');
    openingTimeField.className = 'calendar-tool-field';
    const openingTimeLabel = document.createElement('span');
    openingTimeLabel.textContent = scheduleUiCopy.openingTimeLabel || 'Opening time';
    const openingTimeInput = document.createElement('input');
    openingTimeInput.type = 'time';
    openingTimeInput.name = 'openingTime';
    openingTimeInput.value = teamMember?.openingTime ?? getCalendarTimeSlots()[0] ?? '09:00';
    openingTimeInput.required = true;
    openingTimeField.append(openingTimeLabel, openingTimeInput);

    const closingTimeField = document.createElement('label');
    closingTimeField.className = 'calendar-tool-field';
    const closingTimeLabel = document.createElement('span');
    closingTimeLabel.textContent = scheduleUiCopy.closingTimeLabel || 'Closing time';
    const closingTimeInput = document.createElement('input');
    closingTimeInput.type = 'time';
    closingTimeInput.name = 'closingTime';
    closingTimeInput.value =
      teamMember?.closingTime ??
      (() => {
        const slotTimes = getCalendarTimeSlots();
        const lastSlot = slotTimes[slotTimes.length - 1] ?? '17:00';
        return addMinutesToTimeValue(lastSlot, 60) || '18:00';
      })();
    closingTimeInput.required = true;
    closingTimeField.append(closingTimeLabel, closingTimeInput);

    const offDaysFieldConfig = createMultiSelectField(
      scheduleUiCopy.offDaysLabel || 'Off days',
      weekdayOptions,
      scheduleUiCopy.offDaysEmpty || 'No day options available'
    );

    for (const option of offDaysFieldConfig.select.options) {
      option.selected = currentOffDays.has(option.value);
    }

    const expertiseField = document.createElement('label');
    expertiseField.className = 'calendar-tool-field';
    const expertiseLabel = document.createElement('span');
    expertiseLabel.textContent = 'Expertise';
    const expertiseSelect = document.createElement('select');
    expertiseSelect.name = 'expertise';

    const expertisePlaceholder = document.createElement('option');
    expertisePlaceholder.value = '';
    expertisePlaceholder.textContent =
      expertiseOptions.length > 0 ? 'Select expertise' : 'No expertise suggestions yet';
    expertiseSelect.append(expertisePlaceholder);

    for (const expertiseOption of expertiseOptions) {
      const option = document.createElement('option');
      option.value = expertiseOption;
      option.textContent = expertiseOption;
      expertiseSelect.append(option);
    }

    const customExpertiseValue = '__custom__';
    const customExpertiseOption = document.createElement('option');
    customExpertiseOption.value = customExpertiseValue;
    customExpertiseOption.textContent = 'Custom expertise';
    expertiseSelect.append(customExpertiseOption);
    expertiseSelect.value = hasPresetExpertise ? currentExpertise : currentExpertise ? customExpertiseValue : '';

    const customExpertiseField = document.createElement('label');
    customExpertiseField.className = 'calendar-tool-field';
    const customExpertiseLabel = document.createElement('span');
    customExpertiseLabel.textContent = 'Custom expertise';
    const customExpertiseInput = document.createElement('input');
    customExpertiseInput.type = 'text';
    customExpertiseInput.name = 'custom-expertise';
    customExpertiseInput.placeholder = 'Enter expertise';
    customExpertiseInput.value = hasPresetExpertise ? '' : currentExpertise;
    customExpertiseField.append(customExpertiseLabel, customExpertiseInput);

    const statusField = document.createElement('div');
    statusField.className = 'calendar-tool-field';
    const statusLabel = document.createElement('span');
    statusLabel.textContent = `${roleLabelDisplay} status`;
    const statusInput = document.createElement('input');
    statusInput.type = 'hidden';
    statusInput.name = 'is-active';
    statusInput.value = teamMember?.isActive === false ? 'inactive' : 'active';
    const statusToggle = document.createElement('div');
    statusToggle.className = 'calendar-status-toggle';
    const activeStatusButton = document.createElement('button');
    activeStatusButton.type = 'button';
    activeStatusButton.className = 'calendar-status-toggle-option is-active-option';
    activeStatusButton.dataset.statusValue = 'active';
    activeStatusButton.textContent = 'Active';
    const inactiveStatusButton = document.createElement('button');
    inactiveStatusButton.type = 'button';
    inactiveStatusButton.className = 'calendar-status-toggle-option is-inactive-option';
    inactiveStatusButton.dataset.statusValue = 'inactive';
    inactiveStatusButton.textContent = 'Inactive';

    const syncStatusSelection = (nextStatus) => {
      statusInput.value = nextStatus;

      for (const optionButton of statusToggle.querySelectorAll('.calendar-status-toggle-option')) {
        if (!(optionButton instanceof HTMLButtonElement)) {
          continue;
        }

        const isSelected = optionButton.dataset.statusValue === nextStatus;
        optionButton.classList.toggle('is-selected', isSelected);
        optionButton.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
      }
    };

    for (const optionButton of [activeStatusButton, inactiveStatusButton]) {
      optionButton.addEventListener('click', () => {
        syncStatusSelection(optionButton.dataset.statusValue || 'active');
      });
      statusToggle.append(optionButton);
    }

    syncStatusSelection(statusInput.value);
    statusField.append(statusLabel, statusInput, statusToggle);

    const syncCustomExpertiseField = () => {
      const shouldShowCustomExpertise = expertiseSelect.value === customExpertiseValue;
      customExpertiseField.classList.toggle('is-hidden', !shouldShowCustomExpertise);

      if (!shouldShowCustomExpertise) {
        customExpertiseInput.value = '';
      }
    };

    expertiseSelect.addEventListener('change', syncCustomExpertiseField);
    syncCustomExpertiseField();
    expertiseField.append(expertiseLabel, expertiseSelect);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = mode === 'edit' ? 'Save changes' : `Save ${roleLabel}`;

    form.append(
      nameField,
      roleField,
      phoneField,
      statusField,
      openingTimeField,
      closingTimeField,
      offDaysFieldConfig.field,
      expertiseField,
      customExpertiseField,
      submitButton
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!nameInput.value.trim() || !roleInput.value.trim()) {
        safeAlert('Please fill name and role.');
        return;
      }

      if (openingTimeInput.value && closingTimeInput.value && openingTimeInput.value >= closingTimeInput.value) {
        safeAlert('Closing time must be later than opening time.');
        return;
      }

      const expertiseValue =
        expertiseSelect.value === customExpertiseValue
          ? customExpertiseInput.value.trim()
          : expertiseSelect.value.trim();
      const offDaysValue = getSelectedValues(offDaysFieldConfig.select);

      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';

      try {
        if (mode === 'edit' && teamMember?.id) {
          await updateTeamMember(teamMember.id, {
            name: nameInput.value,
            role: roleInput.value,
            phone: phoneInput.value,
            expertise: expertiseValue,
            openingTime: openingTimeInput.value,
            closingTime: closingTimeInput.value,
            offDays: offDaysValue,
            isActive: statusInput.value !== 'inactive'
          });
        } else {
          await addTeamMember({
            name: nameInput.value,
            role: roleInput.value,
            phone: phoneInput.value,
            expertise: expertiseValue,
            openingTime: openingTimeInput.value,
            closingTime: closingTimeInput.value,
            offDays: offDaysValue,
            isActive: statusInput.value !== 'inactive'
          });
        }
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = mode === 'edit' ? 'Save changes' : `Save ${roleLabel}`;
        safeAlert(
          error instanceof Error
            ? error.message
            : mode === 'edit'
              ? `Unable to update ${roleLabel}`
              : `Unable to add ${roleLabel}`
        );
      }
    });

    openToolModal({
      eyebrow: 'Team',
      title: mode === 'edit' ? `Edit ${teamMember?.name || roleLabelDisplay}` : `Add ${roleLabelDisplay}`,
      description:
        mode === 'edit'
          ? `Update this ${roleLabel}'s profile details.`
          : `Enter the ${roleLabel} details below to add this employee to your team.`,
      actions: [form]
    });

    nameInput.focus();
  };

  const openAddTeamMemberModal = () => {
    void openTeamMemberFormModal();
  };

  const openEditTeamMemberModal = (teamMember) => {
    void openTeamMemberFormModal({ mode: 'edit', teamMember });
  };

  const createTeamMemberCard = (teamMember) => {
    const roleLabel = getBusinessRoleLabel();
    const card = document.createElement('article');
    card.className = 'calendar-notification-item calendar-team-member-card';

    const header = document.createElement('div');
    header.className = 'calendar-team-member-card-header';
    const heading = document.createElement('strong');
    heading.textContent = teamMember.name;
    const statusBadge = document.createElement('span');
    statusBadge.className = `calendar-team-member-status${teamMember.isActive === false ? ' is-inactive' : ''}`;
    statusBadge.textContent = teamMember.isActive === false ? 'Inactive' : 'Online';
    header.append(heading, statusBadge);

    const copy = document.createElement('p');
    const scheduleSummary = formatTeamMemberScheduleSummary(teamMember);
    copy.textContent = [
      teamMember.role || getDefaultTeamMemberRole(),
      `Mobile: ${teamMember.phone || '-'}`,
      teamMember.expertise ? `Expertise: ${teamMember.expertise}` : null,
      scheduleSummary || null
    ]
      .filter(Boolean)
      .join(' | ');

    const actions = document.createElement('div');
    actions.className = 'calendar-tool-inline-actions';

    const editButton = createToolActionButton('Edit', () => {
      closeToolModal();
      openEditTeamMemberModal(teamMember);
    });
    const toggleStatusButton = createToolActionButton(
      teamMember.isActive === false ? 'Mark active' : 'Mark inactive',
      async () => {
        toggleStatusButton.disabled = true;
        toggleStatusButton.textContent =
          teamMember.isActive === false ? 'Activating...' : 'Updating...';

        try {
          await updateTeamMember(teamMember.id, {
            name: teamMember.name || '',
            role: teamMember.role || getDefaultTeamMemberRole(),
            phone: teamMember.phone || '',
            expertise: teamMember.expertise || '',
            openingTime: teamMember.openingTime || '',
            closingTime: teamMember.closingTime || '',
            offDays: Array.isArray(teamMember.offDays) ? teamMember.offDays : [],
            isActive: teamMember.isActive === false
          });
        } catch (error) {
          toggleStatusButton.disabled = false;
          toggleStatusButton.textContent =
            teamMember.isActive === false ? 'Mark active' : 'Mark inactive';
          safeAlert(
            error instanceof Error
              ? error.message
              : `Unable to update ${teamMember.name} status`
          );
        }
      }
    );
    const removeButton = createToolActionButton('Remove', async () => {
      const shouldRemove = window.confirm(
        `Remove ${teamMember.name} from the active ${roleLabel} list?`
      );

      if (!shouldRemove) {
        return;
      }

      removeButton.disabled = true;
      removeButton.textContent = 'Removing...';

      try {
        await removeTeamMember(teamMember.id);
      } catch (error) {
        removeButton.disabled = false;
        removeButton.textContent = 'Remove';
        safeAlert(error instanceof Error ? error.message : `Unable to remove ${teamMember.name}`);
      }
    });
    removeButton.classList.add('calendar-tool-action-danger');

    actions.append(editButton, toggleStatusButton, removeButton);
    card.append(header, copy, actions);
    return card;
  };

  const updateBusinessService = async (
    serviceId,
    { name, categoryName, durationMinutes, priceLabel, description }
  ) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/services/${encodeURIComponent(serviceId)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        name: name.trim(),
        categoryName: categoryName.trim(),
        durationMinutes: Math.round(durationMinutes),
        priceLabel: priceLabel.trim(),
        description: description.trim()
      })
    });

    await loadDashboard();
    setMainView('calendar');
    syncSideDrawerOffset();
    setActiveDrawer('catalog');
    openServiceMenuModal();
  };

  const removeBusinessService = async (serviceId) => {
    if (!clientId) {
      return;
    }

    await apiRequest(`/api/platform/clients/${clientId}/services/${encodeURIComponent(serviceId)}`, {
      method: 'DELETE'
    });

    await loadDashboard();
    setMainView('calendar');
    syncSideDrawerOffset();
    setActiveDrawer('catalog');
    openServiceMenuModal();
  };

  const openServiceFormModal = ({ mode = 'add', service = null } = {}) => {
    const serviceUiCopy = getServiceUiCopy();
    const serviceLabelSingular = serviceUiCopy.singular || 'service';
    const serviceLabelPlural = serviceUiCopy.plural || `${serviceLabelSingular}s`;
    const serviceLabelDisplay = formatRoleLabelDisplay(serviceLabelSingular);
    const saveActionLabel = serviceUiCopy.actionSave || `Save ${serviceLabelSingular}`;
    const updateActionLabel = serviceUiCopy.actionUpdate || `Update ${serviceLabelSingular}`;
    const addActionLabel = serviceUiCopy.actionAdd || `Add ${serviceLabelSingular}`;
    const editActionLabel = serviceUiCopy.actionEdit || 'Edit';
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const categoryOptions = [
      ...new Set(
        [
          ...(Array.isArray(dashboardPayload?.client?.serviceTypes) ? dashboardPayload.client.serviceTypes : []),
          ...getDashboardServices().map((item) => item.categoryName).filter(Boolean),
          service?.categoryName ?? ''
        ]
          .map((value) => (typeof value === 'string' ? value.trim() : ''))
          .filter(Boolean)
      )
    ];

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = serviceUiCopy.fieldName || `${serviceLabelDisplay} name`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Enter ${serviceLabelSingular} name`;
    nameInput.value = service?.name ?? '';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const categoryField = document.createElement('label');
    categoryField.className = 'calendar-tool-field';
    const categoryLabel = document.createElement('span');
    categoryLabel.textContent = serviceUiCopy.fieldCategory || 'Category';
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.setAttribute('list', 'service-category-options');
    categoryInput.placeholder = `Enter ${(serviceUiCopy.fieldCategory || 'category').toLowerCase()}`;
    categoryInput.value = service?.categoryName ?? categoryOptions[0] ?? '';
    const categoryList = document.createElement('datalist');
    categoryList.id = 'service-category-options';
    for (const categoryOption of categoryOptions) {
      const option = document.createElement('option');
      option.value = categoryOption;
      categoryList.append(option);
    }
    categoryField.append(categoryLabel, categoryInput, categoryList);

    const durationField = document.createElement('label');
    durationField.className = 'calendar-tool-field';
    const durationLabel = document.createElement('span');
    durationLabel.textContent = serviceUiCopy.fieldDuration || 'Duration in minutes';
    const durationInput = document.createElement('input');
    durationInput.type = 'number';
    durationInput.min = '15';
    durationInput.max = '480';
    durationInput.step = '15';
    durationInput.value = String(service?.durationMinutes ?? 30);
    durationInput.required = true;
    durationField.append(durationLabel, durationInput);

    const priceField = document.createElement('label');
    priceField.className = 'calendar-tool-field';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = serviceUiCopy.fieldPrice || 'Price';
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.placeholder = formatCurrencyExampleLabel(1200);
    priceInput.value = service?.priceLabel ?? formatCurrencyExampleLabel(1000);
    priceInput.required = true;
    priceField.append(priceLabel, priceInput);

    const descriptionField = document.createElement('label');
    descriptionField.className = 'calendar-tool-field';
    const descriptionLabel = document.createElement('span');
    descriptionLabel.textContent = serviceUiCopy.fieldDescription || 'Description';
    const descriptionInput = document.createElement('input');
    descriptionInput.type = 'text';
    descriptionInput.placeholder = `Short ${serviceLabelSingular} description`;
    descriptionInput.value = service?.description ?? '';
    descriptionField.append(descriptionLabel, descriptionInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;

    form.append(nameField, categoryField, durationField, priceField, descriptionField, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const durationMinutes = Number(durationInput.value);

      if (!nameInput.value.trim() || !priceInput.value.trim() || !categoryInput.value.trim()) {
        safeAlert(
          serviceUiCopy.validationRequired ||
            `Please fill ${serviceLabelSingular} name, ${(serviceUiCopy.fieldCategory || 'category').toLowerCase()}, and ${(serviceUiCopy.fieldPrice || 'price').toLowerCase()}.`
        );
        return;
      }

      if (!Number.isFinite(durationMinutes) || durationMinutes < 15) {
        safeAlert(serviceUiCopy.validationDuration || 'Please enter a valid duration of at least 15 minutes.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = `${mode === 'edit' ? updateActionLabel : saveActionLabel}...`;

      try {
        if (mode === 'edit' && service?.id) {
          await updateBusinessService(service.id, {
            name: nameInput.value,
            categoryName: categoryInput.value,
            durationMinutes,
            priceLabel: priceInput.value,
            description: descriptionInput.value
          });
        } else {
          await apiRequest(`/api/platform/clients/${clientId}/services`, {
            method: 'POST',
            body: JSON.stringify({
              name: nameInput.value.trim(),
              categoryName: categoryInput.value.trim(),
              durationMinutes: Math.round(durationMinutes),
              priceLabel: priceInput.value.trim(),
              description: descriptionInput.value.trim()
            })
          });

          await loadDashboard();
          setMainView('calendar');
          syncSideDrawerOffset();
          setActiveDrawer('catalog');
          openServiceMenuModal();
        }
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : mode === 'edit'
              ? serviceUiCopy.errorUpdate || `Unable to update ${serviceLabelSingular}`
              : serviceUiCopy.errorAdd || `Unable to add ${serviceLabelSingular}`
        );
      }
    });

    openToolModal({
      eyebrow: 'Catalog',
      title: mode === 'edit' ? `${editActionLabel} ${service?.name || serviceLabelSingular}` : addActionLabel,
      description:
        mode === 'edit'
          ? serviceUiCopy.formEditDescription ||
            `Update the ${serviceLabelSingular} details used in bookings and pricing.`
          : serviceUiCopy.formAddDescription ||
            `Create a new ${serviceLabelSingular} and add it to your live ${serviceLabelPlural} menu.`,
      actions: [form]
    });

    nameInput.focus();
  };

  const createServiceManagementCard = (service) => {
    const serviceUiCopy = getServiceUiCopy();
    const editActionLabel = serviceUiCopy.actionEdit || 'Edit';
    const removeActionLabel = serviceUiCopy.actionRemove || 'Remove';
    const serviceMenuTitle = serviceUiCopy.menuTitle || 'service menu';
    const card = document.createElement('article');
    card.className = 'calendar-notification-item calendar-service-card';

    const heading = document.createElement('strong');
    heading.textContent = service.name;

    const copy = document.createElement('p');
    copy.textContent = `${service.priceLabel} | ${service.durationMinutes} min | ${service.categoryName}${service.description ? ` | ${service.description}` : ''}`;

    const actions = document.createElement('div');
    actions.className = 'calendar-tool-inline-actions';

    const editButton = createToolActionButton(editActionLabel, () => {
      closeToolModal();
      openServiceFormModal({ mode: 'edit', service });
    });

    const removeButton = createToolActionButton(removeActionLabel, async () => {
      const shouldRemove = window.confirm(`Remove ${service.name} from ${serviceMenuTitle}?`);

      if (!shouldRemove) {
        return;
      }

      removeButton.disabled = true;
      removeButton.textContent = `${removeActionLabel}...`;

      try {
        await removeBusinessService(service.id);
      } catch (error) {
        removeButton.disabled = false;
        removeButton.textContent = removeActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : serviceUiCopy.errorRemove || `Unable to remove ${service.name}`
        );
      }
    });
    removeButton.classList.add('calendar-tool-action-danger');

    actions.append(editButton, removeButton);
    card.append(heading, copy, actions);
    return card;
  };

  const openTeamMembersModal = () => {
    const roleLabel = getBusinessRoleLabel();
    const roleLabelPlural = getBusinessRoleLabelPlural();
    const teamMembers = getDashboardTeamMembers().filter((teamMember) => teamMember.isActive !== false);
    const actions =
      teamMembers.length > 0
        ? teamMembers.map((teamMember) => createTeamMemberCard(teamMember))
        : [
            createToolInfoCard(
              `No ${roleLabelPlural} added`,
              `Use Add ${roleLabel} to create your first team member.`
            )
          ];

    actions.push(
      createToolActionButton(`Add ${roleLabel}`, async () => {
        closeToolModal();
        openAddTeamMemberModal();
      })
    );

    openToolModal({
      eyebrow: 'Team',
      title: formatRoleLabelDisplay(roleLabelPlural),
      description: `Manage the ${roleLabelPlural} available in your setup.`,
      actions
    });
  };

  const openProfileModal = () => {
    if (!clientId) {
      return;
    }

    const profileUiCopy = getProfileUiCopy();
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const businessField = document.createElement('label');
    businessField.className = 'calendar-tool-field';
    const businessLabel = document.createElement('span');
    businessLabel.textContent = profileUiCopy.fieldBusinessNameLabel || 'Business name';
    const businessInput = document.createElement('input');
    businessInput.type = 'text';
    businessInput.name = 'businessName';
    businessInput.value = dashboardPayload?.client?.businessName ?? '';
    businessInput.placeholder = profileUiCopy.fieldBusinessNamePlaceholder || 'Enter business name';
    businessInput.required = true;
    businessField.append(businessLabel, businessInput);

    const websiteField = document.createElement('label');
    websiteField.className = 'calendar-tool-field';
    const websiteLabel = document.createElement('span');
    websiteLabel.textContent = profileUiCopy.fieldWebsiteLabel || 'Website';
    const websiteInput = document.createElement('input');
    websiteInput.type = 'text';
    websiteInput.name = 'website';
    websiteInput.value = dashboardPayload?.client?.website ?? '';
    websiteInput.placeholder = profileUiCopy.fieldWebsitePlaceholder || 'Enter website';
    websiteField.append(websiteLabel, websiteInput);

    const phoneField = document.createElement('label');
    phoneField.className = 'calendar-tool-field';
    const phoneLabel = document.createElement('span');
    phoneLabel.textContent = profileUiCopy.fieldPhoneLabel || DEFAULT_BUSINESS_PHONE_LABEL;
    const phoneInput = document.createElement('input');
    phoneInput.type = 'tel';
    phoneInput.name = 'businessPhoneNumber';
    phoneInput.value = dashboardPayload?.client?.businessPhoneNumber ?? '';
    phoneInput.placeholder = profileUiCopy.fieldPhonePlaceholder || DEFAULT_PHONE_PLACEHOLDER;
    phoneField.append(phoneLabel, phoneInput);

    const addressField = document.createElement('label');
    addressField.className = 'calendar-tool-field';
    const addressLabel = document.createElement('span');
    addressLabel.textContent = profileUiCopy.fieldAddressLabel || 'Address';
    const addressInput = document.createElement('textarea');
    addressInput.name = 'venueAddress';
    addressInput.rows = 3;
    addressInput.value = dashboardPayload?.client?.venueAddress ?? '';
    addressInput.placeholder = profileUiCopy.fieldAddressPlaceholder || 'Enter address';
    addressField.append(addressLabel, addressInput);

    const imageField = document.createElement('label');
    imageField.className = 'calendar-tool-field';
    const imageLabel = document.createElement('span');
    imageLabel.textContent = profileUiCopy.fieldImageLabel || 'Profile image';
    const imageInput = document.createElement('input');
    imageInput.type = 'text';
    imageInput.name = 'profileImageUrl';
    imageInput.value = dashboardPayload?.client?.profileImageUrl ?? '';
    imageInput.placeholder = profileUiCopy.fieldImagePlaceholder || 'Paste image URL or upload from gallery';
    imageField.append(imageLabel, imageInput);

    const imagePreview = document.createElement('div');
    imagePreview.className = 'calendar-tool-image-preview';

    const imagePickerInput = document.createElement('input');
    imagePickerInput.type = 'file';
    imagePickerInput.accept = 'image/*';
    imagePickerInput.className = 'calendar-tool-file-input';

    const imageActions = document.createElement('div');
    imageActions.className = 'calendar-tool-inline-actions';

    const uploadButton = document.createElement('button');
    uploadButton.className = 'calendar-tool-action';
    uploadButton.type = 'button';
    uploadButton.textContent = profileUiCopy.actionUploadImage || 'Choose from PC';

    const removeImageButton = document.createElement('button');
    removeImageButton.className = 'calendar-tool-action';
    removeImageButton.type = 'button';
    removeImageButton.textContent = profileUiCopy.actionRemoveImage || 'Remove image';

    imageActions.append(uploadButton, removeImageButton);
    imageField.append(imagePreview, imageActions, imagePickerInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = profileUiCopy.actionSave || 'Update profile';

    const logoutButton = document.createElement('button');
    logoutButton.className = 'calendar-tool-action calendar-tool-action-danger';
    logoutButton.type = 'button';
    logoutButton.textContent = 'Log out';

    logoutButton.addEventListener('click', async () => {
      logoutButton.disabled = true;
      logoutButton.textContent = 'Logging out...';

      try {
        await logoutAdminSession(clientId);
      } catch (error) {
        logoutButton.disabled = false;
        logoutButton.textContent = 'Log out';
        safeAlert(error instanceof Error ? error.message : 'Unable to log out');
      }
    });

    form.append(businessField, websiteField, phoneField, addressField, imageField, submitButton, logoutButton);

    const syncProfilePreview = () => {
      renderCalendarAvatar(
        imagePreview,
        (businessInput.value.trim() || 'S').charAt(0).toLowerCase(),
        imageInput.value.trim()
      );
    };

    uploadButton.addEventListener('click', () => {
      imagePickerInput.click();
    });

    removeImageButton.addEventListener('click', () => {
      imageInput.value = '';
      imagePickerInput.value = '';
      syncProfilePreview();
    });

    imageInput.addEventListener('input', syncProfilePreview);
    businessInput.addEventListener('input', syncProfilePreview);

    imagePickerInput.addEventListener('change', () => {
      const file = imagePickerInput.files?.[0];

      if (!file) {
        return;
      }

      if (!file.type.startsWith('image/')) {
        safeAlert('Please choose an image file.');
        imagePickerInput.value = '';
        return;
      }

      if (file.size > 4 * 1024 * 1024) {
        safeAlert('Please choose an image smaller than 4 MB.');
        imagePickerInput.value = '';
        return;
      }

      const reader = new FileReader();

      reader.addEventListener('load', () => {
        imageInput.value = typeof reader.result === 'string' ? reader.result : '';
        syncProfilePreview();
      });

      reader.addEventListener('error', () => {
        safeAlert('Unable to read selected image.');
      });

      reader.readAsDataURL(file);
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!businessInput.value.trim()) {
        safeAlert(profileUiCopy.validationRequired || 'Please enter business name.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = `${profileUiCopy.actionSave || 'Update profile'}...`;

      try {
        await apiRequest(`/api/platform/clients/${clientId}/business-profile`, {
          method: 'PATCH',
          body: JSON.stringify({
            businessName: businessInput.value.trim(),
            website: websiteInput.value.trim(),
            businessPhoneNumber: phoneInput.value.trim(),
            venueAddress: addressInput.value.trim(),
            profileImageUrl: imageInput.value.trim()
          })
        });

        await loadDashboard();
        closeToolModal();
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = profileUiCopy.actionSave || 'Update profile';
        safeAlert(error instanceof Error ? error.message : profileUiCopy.errorUpdate || 'Unable to update profile');
      }
    });

    syncProfilePreview();

    openToolModal({
      eyebrow: 'Profile',
      title: `${staffName.textContent || 'Owner'} ${profileUiCopy.titleSuffix || 'profile'}`,
      description:
        profileUiCopy.description ||
        'Update your business name, address, profile image, and other business details here.',
      actions: [form]
    });

    businessInput.focus();
  };

  const openServiceMenuModal = () => {
    const serviceUiCopy = getServiceUiCopy();
    const serviceLabelSingular = serviceUiCopy.singular || 'service';
    const serviceLabelPlural = serviceUiCopy.plural || `${serviceLabelSingular}s`;
    const coverageLabel = serviceUiCopy.coverageLabel || `${formatRoleLabelDisplay(serviceLabelSingular)} coverage`;
    const addActionLabel = serviceUiCopy.actionAdd || `Add ${serviceLabelSingular}`;
    const openBookingActionLabel = serviceUiCopy.actionOpenBooking || 'Open booking page';
    const stayInCatalogActionLabel = serviceUiCopy.actionStayInCatalog || 'Stay in catalog';
    const insights = getCatalogInsights();
    const activeServices = getDashboardServices().filter((service) => service.isActive !== false);
    const serviceCards =
      activeServices.length > 0
        ? activeServices.map((service) => createServiceManagementCard(service))
        : [
            createToolInfoCard(
              serviceUiCopy.emptyTitle || `No ${serviceLabelPlural} yet`,
              serviceUiCopy.emptyDescription ||
                `Add your first ${serviceLabelSingular} to start building the ${serviceLabelPlural} menu.`
            )
          ];

    openToolModal({
      eyebrow: 'Catalog',
      title: serviceUiCopy.menuTitle || `${formatRoleLabelDisplay(serviceLabelPlural)} menu`,
      description:
        serviceUiCopy.menuDescription ||
        `Review, add, update, and remove the ${serviceLabelPlural} that drive booking availability and pricing.`,
      actions: [
        createToolInfoCard(
          coverageLabel,
          `${insights.activeServices} active ${serviceLabelSingular}${insights.activeServices === 1 ? '' : 's'} across ${insights.categoryCount} categor${insights.categoryCount === 1 ? 'y' : 'ies'}.`
        ),
        ...serviceCards,
        createToolActionButton(addActionLabel, () => {
          closeToolModal();
          openServiceFormModal({ mode: 'add' });
        }),
        createToolActionButton(openBookingActionLabel, () => {
          closeToolModal();
          if (publicBookingPath) {
            window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
          }
        }),
        createToolActionButton(stayInCatalogActionLabel, () => {
          closeToolModal();
          setMainView('calendar');
          syncSideDrawerOffset();
          setActiveDrawer('catalog');
        })
      ]
    });
  };

  const createPackageManagementCard = (packagePlan) => {
    const packageUiCopy = getPackageUiCopy();
    const editActionLabel = packageUiCopy.actionEdit || 'Edit';
    const removeActionLabel = packageUiCopy.actionRemove || 'Remove';
    const packageMenuTitle = packageUiCopy.menuTitle || 'package plans';
    const card = document.createElement('article');
    card.className = 'calendar-notification-item calendar-service-card';

    const heading = document.createElement('strong');
    heading.textContent = packagePlan.name;

    const copy = document.createElement('p');
    copy.textContent = `${packagePlan.priceLabel} | ${packagePlan.totalUses} uses`;

    const actions = document.createElement('div');
    actions.className = 'calendar-tool-inline-actions';

    const editButton = createToolActionButton(editActionLabel, () => {
      closeToolModal();
      openPackagePlanFormModal({ mode: 'edit', packagePlan });
    });

    const removeButton = createToolActionButton(removeActionLabel, async () => {
      const shouldRemove = window.confirm(`Remove ${packagePlan.name} from ${packageMenuTitle}?`);

      if (!shouldRemove) {
        return;
      }

      removeButton.disabled = true;
      removeButton.textContent = `${removeActionLabel}...`;

      try {
        await removePackagePlan(packagePlan.id);
        openCatalogMembershipsModal();
      } catch (error) {
        removeButton.disabled = false;
        removeButton.textContent = removeActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : packageUiCopy.errorRemove || `Unable to remove ${packagePlan.name}`
        );
      }
    });
    removeButton.classList.add('calendar-tool-action-danger');

    actions.append(editButton, removeButton);
    card.append(heading, copy, actions);
    return card;
  };

  const openCatalogMembershipsModal = () => {
    const packageUiCopy = getPackageUiCopy();
    const packageLabelSingular = packageUiCopy.singular || 'package';
    const packageLabelPlural = packageUiCopy.plural || `${packageLabelSingular}s`;
    const addActionLabel = packageUiCopy.actionAdd || `Add ${packageLabelSingular}`;
    const packagePlans = getDashboardPackagePlans().filter((packagePlan) => packagePlan.isActive !== false);
    const loyaltyProgram = getDashboardLoyaltyProgram();
    const packageCards =
      packagePlans.length > 0
        ? packagePlans.map((packagePlan) => createPackageManagementCard(packagePlan))
        : [
            createToolInfoCard(
              packageUiCopy.emptyTitle || `No ${packageLabelPlural} yet`,
              packageUiCopy.emptyDescription ||
                `Add your first ${packageLabelSingular} to start publishing prepaid plans.`
            )
          ];

    openToolModal({
      eyebrow: 'Catalog',
      title: packageUiCopy.menuTitle || `${formatRoleLabelDisplay(packageLabelPlural)} plans`,
      description:
        packageUiCopy.menuDescription ||
        `Create prepaid ${packageLabelPlural} from your live service menu and pair them with loyalty rewards for repeat guests.`,
      actions: [
        ...packageCards,
        createToolInfoCard(
          'Loyalty program',
          loyaltyProgram?.isEnabled
            ? `${loyaltyProgram.rewardValue}% reward after ${loyaltyProgram.triggerCompletedVisits} completed visits`
            : 'Loyalty is currently disabled.'
        ),
        createToolActionButton(addActionLabel, () => {
          closeToolModal();
          openPackagePlanFormModal({ mode: 'add' });
        }),
        createToolActionButton('Configure loyalty', () => {
          closeToolModal();
          openConfigureLoyaltyProgramModal();
        }),
        createToolActionButton('Open reports', () => {
          closeToolModal();
          activateReportsTab('Clients');
        })
      ]
    });
  };

  const refreshProductsView = async () => {
    await loadDashboard();
    setMainView('calendar');
    syncSideDrawerOffset();
    setActiveDrawer('catalog');
  };

  const createProductSalesRecordCard = (productSale) => {
    const card = document.createElement('article');
    card.className = 'calendar-team-card';

    const heading = document.createElement('strong');
    heading.textContent = productSale.productName;

    const copy = document.createElement('p');
    copy.textContent = [
      `${productSale.quantity} unit${productSale.quantity === 1 ? '' : 's'}`,
      productSale.totalPriceLabel || productSale.unitPriceLabel,
      productSale.customerName,
      formatDateForDisplay(productSale.soldAt)
    ]
      .filter(Boolean)
      .join(' | ');

    const detail = document.createElement('p');
    detail.className = 'calendar-team-card-copy';
    detail.textContent = [
      productSale.unitPriceLabel ? `Unit: ${productSale.unitPriceLabel}` : '',
      productSale.customerPhone,
      productSale.customerEmail,
      productSale.sku ? `SKU: ${productSale.sku}` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    card.append(heading, copy, detail);
    return card;
  };

  const openProductSalesRecordsModal = (selectedProductId = '') => {
    const productUiCopy = getProductUiCopy();
    const productLabelSingular = productUiCopy.singular || 'product';
    const productLabelPlural = productUiCopy.plural || `${productLabelSingular}s`;
    const viewRecordsActionLabel = productUiCopy.actionViewRecords || 'View records';
    const openReportsActionLabel = productUiCopy.actionOpenReports || 'Open sales reports';
    const productLookup = new Map(getDashboardProducts().map((product) => [product.id, product]));
    const allProductSales = getDashboardProductSales();
    const productSales = selectedProductId
      ? allProductSales.filter((productSale) => productSale.productId === selectedProductId)
      : allProductSales;
    const selectedProduct = selectedProductId ? productLookup.get(selectedProductId) : null;
    const titleTarget = selectedProduct?.name || formatRoleLabelDisplay(productLabelPlural);
    const salesCards =
      productSales.length > 0
        ? productSales.map((productSale) => createProductSalesRecordCard(productSale))
        : [
            createToolInfoCard(
              `No ${productLabelSingular} sales yet`,
              `Sell a ${productLabelSingular} to start building your sales record.`
            )
          ];

    openToolModal({
      eyebrow: 'Sales',
      title: selectedProduct ? `${titleTarget} records` : viewRecordsActionLabel,
      description:
        productUiCopy.salesDescription ||
        `Review sold ${productLabelPlural}, quantities, and customer records in one place.`,
      actions: [
        ...salesCards,
        createToolActionButton(productUiCopy.actionSell || `Sell ${productLabelSingular}`, () => {
          closeToolModal();
          openSellProductModal(selectedProduct ?? null);
        }),
        createToolActionButton(productUiCopy.menuTitle || formatRoleLabelDisplay(productLabelPlural), () => {
          closeToolModal();
          openProductsModal();
        }),
        createToolActionButton(openReportsActionLabel, () => {
          closeToolModal();
          activateReportsTab('Sales');
        })
      ]
    });
  };

  const openProductFormModal = ({ mode = 'add', product = null } = {}) => {
    const productUiCopy = getProductUiCopy();
    const productLabelSingular = productUiCopy.singular || 'product';
    const productLabelPlural = productUiCopy.plural || `${productLabelSingular}s`;
    const productLabelDisplay = formatRoleLabelDisplay(productLabelSingular);
    const saveActionLabel = productUiCopy.actionSave || `Save ${productLabelSingular}`;
    const updateActionLabel = productUiCopy.actionUpdate || `Update ${productLabelSingular}`;
    const addActionLabel = productUiCopy.actionAdd || `Add ${productLabelSingular}`;
    const editActionLabel = productUiCopy.actionEdit || 'Edit';
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = productUiCopy.fieldName || `${productLabelDisplay} name`;
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = `Enter ${productLabelSingular} name`;
    nameInput.value = product?.name ?? '';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const categoryField = document.createElement('label');
    categoryField.className = 'calendar-tool-field';
    const categoryLabel = document.createElement('span');
    categoryLabel.textContent = productUiCopy.fieldCategory || 'Category';
    const categoryInput = document.createElement('input');
    categoryInput.type = 'text';
    categoryInput.placeholder = 'Retail';
    categoryInput.value = product?.categoryName ?? '';
    categoryField.append(categoryLabel, categoryInput);

    const skuField = document.createElement('label');
    skuField.className = 'calendar-tool-field';
    const skuLabel = document.createElement('span');
    skuLabel.textContent = productUiCopy.fieldSku || 'SKU';
    const skuInput = document.createElement('input');
    skuInput.type = 'text';
    skuInput.placeholder = 'Optional SKU';
    skuInput.value = product?.sku ?? '';
    skuField.append(skuLabel, skuInput);

    const priceField = document.createElement('label');
    priceField.className = 'calendar-tool-field';
    const priceLabel = document.createElement('span');
    priceLabel.textContent = productUiCopy.fieldPrice || `${productLabelDisplay} price`;
    const priceInput = document.createElement('input');
    priceInput.type = 'text';
    priceInput.placeholder = formatCurrencyExampleLabel(1800);
    priceInput.value = product?.priceLabel ?? formatCurrencyExampleLabel(1000);
    priceInput.required = true;
    priceField.append(priceLabel, priceInput);

    const stockField = document.createElement('label');
    stockField.className = 'calendar-tool-field';
    const stockLabel = document.createElement('span');
    stockLabel.textContent = productUiCopy.fieldStock || 'Stock quantity';
    const stockInput = document.createElement('input');
    stockInput.type = 'number';
    stockInput.min = '0';
    stockInput.max = '100000';
    stockInput.value = String(product?.stockQuantity ?? 0);
    stockInput.required = true;
    stockField.append(stockLabel, stockInput);

    const descriptionField = document.createElement('label');
    descriptionField.className = 'calendar-tool-field';
    const descriptionLabel = document.createElement('span');
    descriptionLabel.textContent = productUiCopy.fieldDescription || 'Description';
    const descriptionInput = document.createElement('textarea');
    descriptionInput.rows = 3;
    descriptionInput.placeholder = `Add ${productLabelSingular} details`;
    descriptionInput.value = product?.description ?? '';
    descriptionField.append(descriptionLabel, descriptionInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;

    form.append(
      nameField,
      categoryField,
      skuField,
      priceField,
      stockField,
      descriptionField,
      submitButton
    );

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!nameInput.value.trim() || !priceInput.value.trim()) {
        safeAlert(
          productUiCopy.validationRequired ||
            `Please enter a ${productLabelSingular} name and price.`
        );
        return;
      }

      const stockQuantity = Number(stockInput.value);

      if (!Number.isFinite(stockQuantity) || stockQuantity < 0) {
        safeAlert(productUiCopy.validationStock || 'Please enter a valid stock quantity.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = `${mode === 'edit' ? updateActionLabel : saveActionLabel}...`;

      try {
        if (mode === 'edit' && product?.id) {
          await updateProduct(product.id, {
            name: nameInput.value,
            categoryName: categoryInput.value,
            sku: skuInput.value,
            priceLabel: priceInput.value,
            stockQuantity,
            description: descriptionInput.value
          });
        } else {
          await createProduct({
            name: nameInput.value,
            categoryName: categoryInput.value,
            sku: skuInput.value,
            priceLabel: priceInput.value,
            stockQuantity,
            description: descriptionInput.value
          });
        }
        closeToolModal();
        openProductsModal();
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = mode === 'edit' ? updateActionLabel : saveActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : mode === 'edit'
              ? productUiCopy.errorUpdate || `Unable to update ${productLabelSingular}`
              : productUiCopy.errorAdd || `Unable to add ${productLabelSingular}`
        );
      }
    });

    openToolModal({
      eyebrow: 'Catalog',
      title: mode === 'edit' ? `${editActionLabel} ${product?.name || productLabelSingular}` : addActionLabel,
      description:
        mode === 'edit'
          ? productUiCopy.formEditDescription ||
            `Update ${productLabelPlural} pricing, stock, and retail details.`
          : productUiCopy.formAddDescription ||
            `Create a new ${productLabelSingular} and add it to your live retail catalog.`,
      actions: [form]
    });
  };

  const openSellProductModal = (selectedProduct = null) => {
    const productUiCopy = getProductUiCopy();
    const productLabelSingular = productUiCopy.singular || 'product';
    const sellActionLabel = productUiCopy.actionSell || `Sell ${productLabelSingular}`;
    const products = getDashboardProducts().filter((product) => product.isActive !== false);

    if (products.length === 0) {
      safeAlert(
        productUiCopy.emptyDescription || `Add your first ${productLabelSingular} before selling it.`
      );
      openProductsModal();
      return;
    }

    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const productField = document.createElement('label');
    productField.className = 'calendar-tool-field';
    const productLabel = document.createElement('span');
    productLabel.textContent = formatRoleLabelDisplay(productLabelSingular);
    const productSelect = document.createElement('select');
    for (const product of products) {
      const option = document.createElement('option');
      option.value = product.id;
      option.textContent = `${product.name} - ${product.priceLabel}`;
      productSelect.append(option);
    }
    if (selectedProduct?.id) {
      productSelect.value = selectedProduct.id;
    }
    productField.append(productLabel, productSelect);

    const quantityField = document.createElement('label');
    quantityField.className = 'calendar-tool-field';
    const quantityLabel = document.createElement('span');
    quantityLabel.textContent = productUiCopy.fieldQuantity || 'Quantity';
    const quantityInput = document.createElement('input');
    quantityInput.type = 'number';
    quantityInput.min = '1';
    quantityInput.max = '1000';
    quantityInput.value = '1';
    quantityInput.required = true;
    quantityField.append(quantityLabel, quantityInput);

    const nameField = document.createElement('label');
    nameField.className = 'calendar-tool-field';
    const nameLabel = document.createElement('span');
    nameLabel.textContent = productUiCopy.fieldCustomerName || 'Customer name';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.placeholder = 'Enter customer name';
    nameInput.required = true;
    nameField.append(nameLabel, nameInput);

    const phoneField = document.createElement('label');
    phoneField.className = 'calendar-tool-field';
    const phoneLabel = document.createElement('span');
    phoneLabel.textContent = productUiCopy.fieldCustomerPhone || 'Customer phone';
    const phoneInput = document.createElement('input');
    phoneInput.type = 'text';
    phoneInput.placeholder = DEFAULT_PHONE_PLACEHOLDER;
    phoneInput.required = true;
    phoneField.append(phoneLabel, phoneInput);

    const emailField = document.createElement('label');
    emailField.className = 'calendar-tool-field';
    const emailLabel = document.createElement('span');
    emailLabel.textContent = productUiCopy.fieldCustomerEmail || 'Customer email';
    const emailInput = document.createElement('input');
    emailInput.type = 'email';
    emailInput.placeholder = 'name@example.com';
    emailField.append(emailLabel, emailInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = sellActionLabel;

    form.append(productField, quantityField, nameField, phoneField, emailField, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      submitButton.disabled = true;
      submitButton.textContent = `${sellActionLabel}...`;

      try {
        await createProductSale({
          productId: productSelect.value,
          quantity: Number(quantityInput.value),
          customerName: nameInput.value,
          customerPhone: phoneInput.value,
          customerEmail: emailInput.value
        });
        closeToolModal();
        openProductSalesRecordsModal(productSelect.value);
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = sellActionLabel;
        safeAlert(
          error instanceof Error ? error.message : productUiCopy.errorSell || `Unable to sell ${productLabelSingular}`
        );
      }
    });

    openToolModal({
      eyebrow: 'Sales',
      title: sellActionLabel,
      description:
        productUiCopy.salesDescription ||
        `Record a ${productLabelSingular} sale, update stock, and save the customer sale record.`,
      actions: [form]
    });
  };

  const createProductManagementCard = (product) => {
    const productUiCopy = getProductUiCopy();
    const productSales = getDashboardProductSales().filter((productSale) => productSale.productId === product.id);
    const soldUnits = productSales.reduce((sum, productSale) => sum + Number(productSale.quantity || 0), 0);
    const editActionLabel = productUiCopy.actionEdit || 'Edit';
    const removeActionLabel = productUiCopy.actionRemove || 'Remove';
    const sellActionLabel = productUiCopy.actionSell || 'Sell';
    const viewRecordsActionLabel = productUiCopy.actionViewRecords || 'View records';
    const menuTitle = productUiCopy.menuTitle || 'products';
    const card = document.createElement('article');
    card.className = 'calendar-team-card';

    const heading = document.createElement('strong');
    heading.textContent = product.name;

    const copy = document.createElement('p');
    copy.textContent = [
      product.categoryName,
      product.priceLabel,
      `${product.stockQuantity} in stock`,
      soldUnits > 0 ? `${soldUnits} sold` : ''
    ]
      .filter(Boolean)
      .join(' | ');

    const detail = document.createElement('p');
    detail.className = 'calendar-team-card-copy';
    detail.textContent = [product.sku ? `SKU: ${product.sku}` : '', product.description]
      .filter(Boolean)
      .join(' | ');

    const actions = document.createElement('div');
    actions.className = 'calendar-tool-inline-actions';

    const editButton = document.createElement('button');
    editButton.className = 'calendar-tool-action';
    editButton.type = 'button';
    editButton.textContent = editActionLabel;
    editButton.addEventListener('click', () => {
      openProductFormModal({ mode: 'edit', product });
    });

    const sellButton = document.createElement('button');
    sellButton.className = 'calendar-tool-action';
    sellButton.type = 'button';
    sellButton.textContent = sellActionLabel;
    sellButton.addEventListener('click', () => {
      openSellProductModal(product);
    });

    const recordsButton = document.createElement('button');
    recordsButton.className = 'calendar-tool-action';
    recordsButton.type = 'button';
    recordsButton.textContent = viewRecordsActionLabel;
    recordsButton.addEventListener('click', () => {
      openProductSalesRecordsModal(product.id);
    });

    const removeButton = document.createElement('button');
    removeButton.className = 'calendar-tool-action calendar-tool-action-danger';
    removeButton.type = 'button';
    removeButton.textContent = removeActionLabel;
    removeButton.addEventListener('click', async () => {
      const shouldRemove = window.confirm(`Remove ${product.name} from ${menuTitle}?`);

      if (!shouldRemove) {
        return;
      }

      removeButton.disabled = true;
      removeButton.textContent = `${removeActionLabel}...`;

      try {
        await removeProduct(product.id);
        closeToolModal();
        openProductsModal();
      } catch (error) {
        removeButton.disabled = false;
        removeButton.textContent = removeActionLabel;
        safeAlert(
          error instanceof Error
            ? error.message
            : productUiCopy.errorRemove || `Unable to remove ${product.name}`
        );
      }
    });

    actions.append(editButton, sellButton, recordsButton, removeButton);
    card.append(heading, copy, detail, actions);
    return card;
  };

  const openProductsModal = () => {
    const productUiCopy = getProductUiCopy();
    const productLabelSingular = productUiCopy.singular || 'product';
    const productLabelPlural = productUiCopy.plural || `${productLabelSingular}s`;
    const addActionLabel = productUiCopy.actionAdd || `Add ${productLabelSingular}`;
    const sellActionLabel = productUiCopy.actionSell || `Sell ${productLabelSingular}`;
    const viewRecordsActionLabel = productUiCopy.actionViewRecords || 'View records';
    const openReportsActionLabel = productUiCopy.actionOpenReports || 'Open sales reports';
    const commerce = getDashboardCommerce();
    const products = getDashboardProducts().filter((product) => product.isActive !== false);
    const insights = getCatalogInsights();
    const actions =
      products.length > 0
        ? products.map((product) => createProductManagementCard(product))
        : [
            createToolInfoCard(
              productUiCopy.emptyTitle || `No ${productLabelPlural} yet`,
              productUiCopy.emptyDescription ||
                `Add your first ${productLabelSingular} to start selling retail items.`
            )
          ];

    actions.unshift(
      createToolInfoCard(
        productUiCopy.metricActive || `Active ${productLabelPlural}`,
        String(commerce.activeProducts)
      ),
      createToolInfoCard(
        productUiCopy.metricStock || 'Units in stock',
        String(insights.totalProductStock)
      ),
      createToolInfoCard(
        productUiCopy.metricSold || 'Units sold',
        String(commerce.productUnitsSold)
      ),
      createToolInfoCard(
        productUiCopy.metricLowStock || 'Low stock',
        String(commerce.lowStockProducts)
      )
    );

    actions.push(
      createToolActionButton(addActionLabel, () => {
        closeToolModal();
        openProductFormModal({ mode: 'add' });
      }),
      createToolActionButton(sellActionLabel, () => {
        closeToolModal();
        openSellProductModal();
      }),
      createToolActionButton(viewRecordsActionLabel, () => {
        closeToolModal();
        openProductSalesRecordsModal();
      }),
      createToolActionButton(openReportsActionLabel, () => {
        closeToolModal();
        activateReportsTab('Sales');
      })
    );

    openToolModal({
      eyebrow: 'Catalog',
      title: productUiCopy.menuTitle || formatRoleLabelDisplay(productLabelPlural),
      description:
        productUiCopy.menuDescription ||
        `Manage retail ${productLabelPlural}, update pricing and stock, and record every sale.`,
      actions
    });
  };

  const openStocktakesModal = () => {
    openToolModal({
      eyebrow: 'Inventory',
      title: 'Stocktakes',
      description: 'Inventory counts are not persisted yet, but this is the right place to start stock control workflows.',
      actions: [
        createToolInfoCard('Stock status', 'No stocktakes recorded yet.'),
        createToolActionButton('Open products', () => {
          closeToolModal();
          openProductsModal();
        }),
        createToolActionButton('Open suppliers', () => {
          closeToolModal();
          openSuppliersModal();
        })
      ]
    });
  };

  const openStockOrdersModal = () => {
    openToolModal({
      eyebrow: 'Inventory',
      title: 'Stock orders',
      description: 'Purchase orders are not connected yet, but this modal now points to the next operational setup areas.',
      actions: [
        createToolInfoCard('Orders', 'No stock orders have been created yet.'),
        createToolActionButton('Open suppliers', () => {
          closeToolModal();
          openSuppliersModal();
        }),
        createToolActionButton('Open stocktakes', () => {
          closeToolModal();
          openStocktakesModal();
        })
      ]
    });
  };

  const openSuppliersModal = () => {
    openToolModal({
      eyebrow: 'Inventory',
      title: 'Suppliers',
      description: 'Supplier contacts are not saved yet, but this is where vendor setup and reorder preferences should live next.',
      actions: [
        createToolInfoCard('Suppliers', 'No suppliers added yet.'),
        createToolActionButton('Open stock orders', () => {
          closeToolModal();
          openStockOrdersModal();
        }),
        createToolActionButton('Open products', () => {
          closeToolModal();
          openProductsModal();
        })
      ]
    });
  };

  const openClientsListModal = () => {
    const insights = getClientInsights();
    const topClients = [];
    const rankedClients = sortClientsForRetention(insights.clients);
    const loyaltyProgram = getDashboardLoyaltyProgram();

    const directory = document.createElement('section');
    directory.className = 'calendar-client-directory';

    const metrics = document.createElement('div');
    metrics.className = 'calendar-client-directory-metrics';
    metrics.append(
      createMetricPill('Total clients', String(insights.totalClients)),
      createMetricPill('Repeat clients', String(insights.repeatClients)),
      createMetricPill('Loyalty-ready', String(insights.loyaltyCandidates))
    );

    const searchWrap = document.createElement('label');
    searchWrap.className = 'calendar-client-directory-search';

    const searchIcon = document.createElement('span');
    searchIcon.className = 'calendar-client-directory-search-icon';
    searchIcon.setAttribute('aria-hidden', 'true');
    searchIcon.innerHTML =
      '<svg viewBox="0 0 24 24" focusable="false"><circle cx="11" cy="11" r="6.5"></circle><path d="M16 16l5 5"></path></svg>';

    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Search client name, phone, email, or last service';
    searchWrap.append(searchIcon, searchInput);

    const helper = document.createElement('p');
    helper.className = 'calendar-client-directory-helper';
    helper.textContent =
      'Review every saved client profile with live visit history, recent activity, and loyalty progress.';

    const results = document.createElement('div');
    results.className = 'calendar-client-directory-results';

    const renderClientDirectory = () => {
      const query = normalizeSearchValue(searchInput.value);
      const filteredClients = rankedClients.filter((client) =>
        normalizeSearchValue(
          [
            client.customerName,
            client.customerPhone,
            client.customerEmail,
            client.lastService,
            client.lastDate,
            client.lastTime
          ]
            .filter(Boolean)
            .join(' ')
        ).includes(query)
      );

      results.replaceChildren();

      if (filteredClients.length === 0) {
        const emptyState = document.createElement('article');
        emptyState.className = 'calendar-client-directory-empty';

        const title = document.createElement('strong');
        title.textContent = query ? 'No matching clients' : 'No clients recorded yet';

        const copy = document.createElement('p');
        copy.textContent = query
          ? 'Try a different name, phone number, email, or service.'
          : 'Client profiles will appear here automatically as bookings are created and completed.';

        emptyState.append(title, copy);
        results.append(emptyState);
        return;
      }

      results.append(
        ...filteredClients.map((client) => createClientDirectoryCard(client, loyaltyProgram))
      );
    };

    searchInput.addEventListener('input', renderClientDirectory);

    directory.append(metrics, searchWrap, helper, results);
    renderClientDirectory();

    openToolModal({
      eyebrow: 'Clients',
      title: 'Client directory',
      description: `${insights.totalClients} client${insights.totalClients === 1 ? '' : 's'} recorded across your business.`,
      dialogClassName: 'wide',
      actions: [
        directory,
        createToolActionButton('Open appointments', () => {
          closeToolModal();
          setMainView('calendar');
          setActiveDrawer('');
          appointmentFilter = 'all';
          syncAppointmentsUi();
          appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      ]
    });

    return;

    openToolModal({
      eyebrow: 'Clients',
      title: 'Clients list',
      description: 'Review the full saved client list with contact details, visit history, and latest service activity.',
      actions: [
        createToolInfoCard(
          'Client total',
          `${insights.totalClients} client${insights.totalClients === 1 ? '' : 's'} recorded in this business.`
        ),
        ...topClients.map((client) =>
          createToolInfoCard(
            client.customerName,
            `${client.customerPhone || 'No phone'}${client.customerEmail ? ` â€¢ ${client.customerEmail}` : ''} â€¢ ${client.visits} visit${client.visits === 1 ? '' : 's'}`
          )
        ),
        ...rankedClients.map((client) => createClientDetailCard(client, { loyaltyProgram })),
        createToolActionButton('Open appointments', () => {
          closeToolModal();
          setMainView('calendar');
          setActiveDrawer('');
          appointmentFilter = 'all';
          syncAppointmentsUi();
          appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        })
      ]
    });
  };

  const openClientLoyaltyModal = () => {
    const insights = getClientInsights();
    const loyaltyClients = [];
    const rankedLoyaltyClients = sortClientsForRetention(
      insights.clients.filter((client) => client.completedVisits >= 1 || client.visits > 1)
    );
    const commerce = getDashboardCommerce();
    const loyaltyProgram = getDashboardLoyaltyProgram();

    openToolModal({
      eyebrow: 'Clients',
      title: 'Client loyalty',
      description: 'Professional retention view with repeat clients, loyalty readiness, available rewards, and full client details.',
      actions: [
        createToolInfoCard(
          'Repeat clients',
          `${insights.repeatClients} client${insights.repeatClients === 1 ? '' : 's'} have booked more than once.`
        ),
        createToolInfoCard(
          'Available rewards',
          `${commerce.availableLoyaltyRewards} reward${commerce.availableLoyaltyRewards === 1 ? '' : 's'} ready to use.`
        ),
        createToolInfoCard(
          'Loyalty-ready',
          `${insights.loyaltyCandidates} client${insights.loyaltyCandidates === 1 ? '' : 's'} have at least 2 completed visits.`
        ),
        createToolInfoCard(
          'Program',
          loyaltyProgram?.isEnabled
            ? `${loyaltyProgram.rewardValue}% reward after ${loyaltyProgram.triggerCompletedVisits} completed visits`
            : 'Loyalty is disabled.'
        ),
        ...loyaltyClients.map((client) =>
          createToolInfoCard(
            client.customerName,
            `${client.completedVisits} completed visits â€¢ Last service: ${client.lastService}`
          )
        ),
        ...(rankedLoyaltyClients.length > 0
          ? rankedLoyaltyClients.map((client) => createClientDetailCard(client, { loyaltyProgram }))
          : [createToolInfoCard('Client loyalty', 'No repeat or loyalty-tracked clients yet.')]),
        createToolActionButton('Configure loyalty', () => {
          closeToolModal();
          openConfigureLoyaltyProgramModal();
        }),
        createToolActionButton('Open marketing tools', () => {
          closeToolModal();
          marketingAction?.click();
        })
      ]
    });
  };

  const openBookedClientModal = (button) => {
    const copy = button.querySelector('.calendar-drawer-link-copy');
    const title = copy?.querySelector('strong')?.textContent?.trim() ?? button.dataset.drawerLabel ?? 'Client';
    const subtitle = copy?.querySelector('small')?.textContent?.trim() ?? 'Recent booked client';

    openToolModal({
      eyebrow: 'Clients',
      title,
      description: subtitle,
      actions: [
        createToolActionButton('Open appointments', () => {
          closeToolModal();
          setMainView('calendar');
          setActiveDrawer('');
          appointmentFilter = 'all';
          syncAppointmentsUi();
          appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }),
        createToolActionButton('Open booking page', () => {
          closeToolModal();
          if (publicBookingPath) {
            window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
          }
        })
      ]
    });
  };

  const openCalendarSearchModal = () => {
    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const searchField = document.createElement('label');
    searchField.className = 'calendar-tool-field';
    const searchLabel = document.createElement('span');
    searchLabel.textContent = 'Search the calendar';
    const searchInput = document.createElement('input');
    searchInput.type = 'search';
    searchInput.placeholder = 'Appointments, clients, services, team...';
    searchField.append(searchLabel, searchInput);

    const resultsContainer = document.createElement('div');
    resultsContainer.className = 'calendar-search-results';

    const renderSearchResults = () => {
      const query = normalizeSearchValue(searchInput.value);

      if (!query) {
        resultsContainer.replaceChildren(
          createToolInfoCard(
            'Search ready',
            'Type a client name, phone, service, team member, or appointment detail to search the calendar.'
          )
        );
        return;
      }

      const results = [];
      const pushResult = (result) => {
        if (results.length < 12) {
          results.push(result);
        }
      };

      for (const appointment of getDashboardAppointments()) {
        const searchText = normalizeSearchValue(
          [
            appointment.customerName,
            appointment.customerPhone,
            appointment.customerEmail,
            appointment.serviceName,
            appointment.teamMemberName,
            appointment.appointmentDate,
            appointment.appointmentTime,
            appointment.status
          ]
            .filter(Boolean)
            .join(' ')
        );

        if (!searchText.includes(query)) {
          continue;
        }

        pushResult({
          metaLabel: 'Appointment',
          title: `${appointment.customerName} | ${appointment.serviceName}`,
          description:
            `${formatDateTimeForDisplay(appointment.appointmentDate, appointment.appointmentTime)} | ` +
            `${getAppointmentStatusMeta(appointment.status).label}`,
          onSelect: () => {
            closeToolModal();
            setMainView('calendar');
            setActiveDrawer('');
            appointmentFilter = 'all';
            syncAppointmentsUi();
            appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      }

      for (const client of getClientInsights().clients) {
        const searchText = normalizeSearchValue(
          [
            client.customerName,
            client.customerPhone,
            client.customerEmail,
            client.lastService,
            client.lastDate,
            client.lastTime
          ]
            .filter(Boolean)
            .join(' ')
        );

        if (!searchText.includes(query)) {
          continue;
        }

        pushResult({
          metaLabel: 'Client',
          title: client.customerName || 'Client',
          description:
            `${formatClientContactLabel(client)} | ${client.visits} visit${client.visits === 1 ? '' : 's'}`,
          onSelect: () => {
            closeToolModal();
            openClientsListModal();
          }
        });
      }

      for (const service of getDashboardServices()) {
        const searchText = normalizeSearchValue(
          [service.name, service.categoryName, service.priceLabel, service.description]
            .filter(Boolean)
            .join(' ')
        );

        if (!searchText.includes(query)) {
          continue;
        }

        pushResult({
          metaLabel: 'Service',
          title: service.name,
          description:
            `${service.categoryName || 'Service'} | ${service.priceLabel || 'No price'} | ` +
            `${service.durationMinutes} mins`,
          onSelect: () => {
            closeToolModal();
            openServiceMenuModal();
          }
        });
      }

      for (const teamMember of getDashboardTeamMembers()) {
        const searchText = normalizeSearchValue(
          [teamMember.name, teamMember.role, teamMember.phone, teamMember.expertise]
            .filter(Boolean)
            .join(' ')
        );

        if (!searchText.includes(query)) {
          continue;
        }

        pushResult({
          metaLabel: 'Team',
          title: teamMember.name,
          description:
            `${teamMember.role || 'Team member'}${teamMember.phone ? ` | ${teamMember.phone}` : ''}` +
            `${teamMember.expertise ? ` | ${teamMember.expertise}` : ''}`,
          onSelect: () => {
            closeToolModal();
            openTeamMembersModal();
          }
        });
      }

      if (results.length === 0) {
        resultsContainer.replaceChildren(
          createToolInfoCard(
            'No matches',
            'No appointments, clients, services, or team records matched that search.'
          )
        );
        return;
      }

      resultsContainer.replaceChildren(...results.map((result) => createSearchResultButton(result)));
    };

    searchInput.addEventListener('input', renderSearchResults);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });
    form.append(searchField);

    openToolModal({
      eyebrow: 'Search',
      title: 'Calendar search',
      description: 'Search across appointments, clients, services, and team records without leaving the calendar.',
      actions: [form, resultsContainer]
    });

    renderSearchResults();
    searchInput.focus();
  };

  const loadEditableAppointmentSlots = async (
    appointmentDate,
    appointmentId,
    timeSelect,
    preferredTime = '',
    teamMemberId = '',
    serviceName = ''
  ) => {
    if (!(timeSelect instanceof HTMLSelectElement) || !clientId) {
      return;
    }

    const payload = await apiRequest(
      `/api/platform/clients/${clientId}/appointments/slots?date=${encodeURIComponent(appointmentDate)}&excludeAppointmentId=${encodeURIComponent(appointmentId)}${teamMemberId ? `&teamMemberId=${encodeURIComponent(teamMemberId)}` : ''}${serviceName ? `&serviceName=${encodeURIComponent(serviceName)}` : ''}`
    );

    timeSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = payload.slots.length > 0 ? 'Select a time' : 'No times available';
    timeSelect.append(placeholder);

    for (const slot of payload.slots) {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = formatTimeForDisplay(slot);
      timeSelect.append(option);
    }

    timeSelect.disabled = payload.slots.length === 0;
    timeSelect.value = payload.slots.includes(preferredTime) ? preferredTime : payload.slots[0] ?? '';
  };

  const refreshAppointmentsView = async () => {
    await loadDashboard();
    appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const saveDashboardAppointmentEdit = async (appointment, values) => {
    if (!clientId) {
      return;
    }

    await apiRequest(
      buildAdminAppointmentPath(clientId, appointment.id),
      {
        method: 'PATCH',
        body: JSON.stringify(values)
      }
    );

    closeToolModal();
    await refreshAppointmentsView();
  };

  const cancelDashboardAppointment = async (appointment) => {
    if (!clientId) {
      return;
    }

    const shouldCancel = window.confirm(
      `Cancel the appointment for ${appointment.customerName} on ${formatDateTimeForDisplay(appointment.appointmentDate, appointment.appointmentTime)}?`
    );

    if (!shouldCancel) {
      return;
    }

    await apiRequest(
      buildAdminAppointmentPath(clientId, appointment.id, '/cancel'),
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );

    closeToolModal();
    await refreshAppointmentsView();
  };

  const markDashboardAppointmentComplete = async (appointment) => {
    if (!clientId) {
      return;
    }

    const shouldComplete = window.confirm(
      `Mark the appointment for ${appointment.customerName} as completed?`
    );

    if (!shouldComplete) {
      return;
    }

    await apiRequest(
      buildAdminAppointmentPath(clientId, appointment.id, '/complete'),
      {
        method: 'POST',
        body: JSON.stringify({})
      }
    );

    closeToolModal();
    await refreshAppointmentsView();
  };

  const sendDashboardRunningLateNotification = async (appointment, values) => {
    if (!clientId) {
      return;
    }

    const payload = await apiRequest(
      buildAdminAppointmentPath(clientId, appointment.id, '/running-late'),
      {
        method: 'POST',
        body: JSON.stringify(values)
      }
    );

    closeToolModal();
    await refreshAppointmentsView();
    safeAlert(
      `Running-late update sent. SMS status: ${Array.isArray(payload.notifications) ? payload.notifications.map((entry) => `${entry.recipient} ${entry.status}`).join(', ') : 'updated'}.`
    );
  };

  const openEditAppointmentModal = (appointment) => {
    if (!clientId || appointment.status !== 'booked') {
      return;
    }

    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const dateField = document.createElement('label');
    dateField.className = 'calendar-tool-field';
    const dateLabel = document.createElement('span');
    dateLabel.textContent = 'Appointment date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.name = 'appointmentDate';
    dateInput.min = new Date().toISOString().slice(0, 10);
    dateInput.value = appointment.appointmentDate;
    dateInput.required = true;
    dateField.append(dateLabel, dateInput);

    const timeField = document.createElement('label');
    timeField.className = 'calendar-tool-field';
    const timeLabel = document.createElement('span');
    timeLabel.textContent = 'Appointment time';
    const timeSelect = document.createElement('select');
    timeSelect.name = 'appointmentTime';
    timeSelect.required = true;
    timeField.append(timeLabel, timeSelect);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Save appointment';

    form.append(dateField, timeField, submitButton);

    const loadSlots = async (preferredTime = appointment.appointmentTime) => {
      await loadEditableAppointmentSlots(
        dateInput.value,
        appointment.id,
        timeSelect,
        preferredTime,
        appointment.teamMemberId || '',
        appointment.serviceName || ''
      );
      submitButton.disabled = !timeSelect.value;
    };

    dateInput.addEventListener('change', async () => {
      try {
        await loadSlots('');
      } catch (error) {
        safeAlert(error instanceof Error ? error.message : 'Unable to load available times');
      }
    });

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!dateInput.value || !timeSelect.value) {
        safeAlert('Please choose a valid appointment date and time.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Saving...';

      try {
        await saveDashboardAppointmentEdit(appointment, {
          appointmentDate: dateInput.value,
          appointmentTime: timeSelect.value
        });
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Save appointment';
        safeAlert(error instanceof Error ? error.message : 'Unable to update appointment');
      }
    });

    openToolModal({
      eyebrow: 'Appointments',
      title: `Edit booking for ${appointment.customerName}`,
      description: `${getAppointmentServiceSummary(appointment)}. Update the booked date or time below.`,
      actions: [
        createToolInfoCard(
          'Current booking',
          `${formatDateTimeForDisplay(appointment.appointmentDate, appointment.appointmentTime)} â€¢ Ref: ${appointment.id.slice(0, 8)}`
        ),
        form
      ]
    });

    loadSlots().catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load appointment times');
    });
    dateInput.focus();
  };

  const openRunningLateModal = (appointment) => {
    if (!clientId || appointment.status !== 'booked') {
      return;
    }

    const form = document.createElement('form');
    form.className = 'calendar-tool-form';

    const delayField = document.createElement('label');
    delayField.className = 'calendar-tool-field';
    const delayLabel = document.createElement('span');
    delayLabel.textContent = 'Delay in minutes (optional)';
    const delayInput = document.createElement('input');
    delayInput.type = 'number';
    delayInput.name = 'delayMinutes';
    delayInput.min = '1';
    delayInput.max = '240';
    delayInput.placeholder = 'e.g. 10';
    delayField.append(delayLabel, delayInput);

    const noteField = document.createElement('label');
    noteField.className = 'calendar-tool-field';
    const noteLabel = document.createElement('span');
    noteLabel.textContent = 'Extra note (optional)';
    const noteInput = document.createElement('input');
    noteInput.type = 'text';
    noteInput.name = 'note';
    noteInput.maxLength = 240;
    noteInput.placeholder = 'e.g. Traffic is heavy, thank you for waiting';
    noteField.append(noteLabel, noteInput);

    const submitButton = document.createElement('button');
    submitButton.className = 'calendar-tool-action calendar-tool-submit';
    submitButton.type = 'submit';
    submitButton.textContent = 'Send update';

    form.append(delayField, noteField, submitButton);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      const delayMinutes = delayInput.value ? Number(delayInput.value) : undefined;

      if (delayInput.value && (!Number.isFinite(delayMinutes) || delayMinutes < 1 || delayMinutes > 240)) {
        safeAlert('Please enter a delay between 1 and 240 minutes.');
        return;
      }

      submitButton.disabled = true;
      submitButton.textContent = 'Sending...';

      try {
        await sendDashboardRunningLateNotification(appointment, {
          delayMinutes,
          note: noteInput.value.trim()
        });
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'Send update';
        safeAlert(error instanceof Error ? error.message : 'Unable to send running-late message');
      }
    });

    openToolModal({
      eyebrow: 'Appointments',
      title: `Send running-late update`,
      description: `Notify ${appointment.customerName} that ${getAppointmentServiceSummary(appointment)} is delayed.`,
      actions: [
        createToolInfoCard(
          'Appointment',
          `${formatDateTimeForDisplay(appointment.appointmentDate, appointment.appointmentTime)} â€¢ Ref: ${appointment.id.slice(0, 8)}`
        ),
        form
      ]
    });

    delayInput.focus();
  };

  const updateCalendarDateLabel = () => {
    const selectedDateValue = getSelectedDateValue();
    dateLabelText.textContent = formatDateForDisplay(selectedDateValue);
    dateInput.value = selectedDateValue;
  };

  const updateViewToggleLabel = () => {
    if (!(viewToggle instanceof HTMLButtonElement)) {
      return;
    }

    const calendarCopy = getDashboardUiCopy().calendar ?? DEFAULT_DASHBOARD_UI_COPY.calendar;
    viewToggle.textContent = currentView === 'day' ? calendarCopy.day : calendarCopy.agenda;
    calendarBoard.classList.toggle('calendar-board-agenda', currentView === 'agenda');
  };

  const updateFilterChips = () => {
    if (!(filterBar instanceof HTMLElement)) {
      return;
    }

    const filterMap = [
      [filterAll, 'all'],
      [filterBooked, 'booked'],
      [filterQr, 'qr']
    ];

    for (const [element, value] of filterMap) {
      if (!(element instanceof HTMLButtonElement)) {
        continue;
      }

      element.classList.toggle('is-active', appointmentFilter === value);
    }
  };

  const getNotificationAppointments = () => {
    const appointments = dashboardPayload?.dashboard?.appointments;

    if (!Array.isArray(appointments)) {
      return [];
    }

    return [...appointments]
      .filter((appointment) => appointment.status === 'booked')
      .sort((left, right) => {
        const leftValue = `${left.appointmentDate}T${left.appointmentTime}`;
        const rightValue = `${right.appointmentDate}T${right.appointmentTime}`;
        return rightValue.localeCompare(leftValue);
      });
  };

  const getUnreadNotificationAppointments = () => {
    const clientId = getClientId();
    const readNotificationIds = getReadNotificationIds(clientId);

    return getNotificationAppointments().filter((appointment) => !readNotificationIds.has(appointment.id));
  };

  const syncReadNotificationIds = () => {
    const clientId = getClientId();

    if (!clientId) {
      return;
    }

    const activeNotificationIds = new Set(
      getNotificationAppointments().map((appointment) => appointment.id)
    );
    const readNotificationIds = getReadNotificationIds(clientId);
    const nextReadNotificationIds = [...readNotificationIds].filter((id) =>
      activeNotificationIds.has(id)
    );

    setReadNotificationIds(clientId, nextReadNotificationIds);
  };

  const markNotificationsAsRead = (appointments = getNotificationAppointments()) => {
    const clientId = getClientId();

    if (!clientId || appointments.length === 0) {
      return;
    }

    const readNotificationIds = getReadNotificationIds(clientId);

    for (const appointment of appointments) {
      readNotificationIds.add(appointment.id);
    }

    const activeNotificationIds = new Set(
      getNotificationAppointments().map((appointment) => appointment.id)
    );
    const nextReadNotificationIds = [...readNotificationIds].filter((id) =>
      activeNotificationIds.has(id)
    );

    setReadNotificationIds(clientId, nextReadNotificationIds);
    updateNotificationsUi();
  };

  const updateNotificationsUi = () => {
    if (!(notificationsAction instanceof HTMLButtonElement)) {
      return;
    }

    syncReadNotificationIds();
    const count = getUnreadNotificationAppointments().length;
    notificationsAction.setAttribute(
      'aria-label',
      count > 0 ? `Notifications, ${count} unread bookings` : 'Notifications'
    );

    if (!(notificationsBadge instanceof HTMLElement)) {
      return;
    }

    notificationsBadge.textContent = count > 9 ? '9+' : String(count);
    notificationsBadge.classList.toggle('is-hidden', count === 0);
  };

  const updateOverviewUi = () => {
    const appointments = Array.isArray(dashboardPayload?.dashboard?.appointments)
      ? dashboardPayload.dashboard.appointments
      : [];
    const selectedDateValue = getSelectedDateValue();
    const selectedAppointments = appointments.filter(
      (appointment) => appointment.appointmentDate === selectedDateValue
    );
    const activeAppointments = appointments.filter((appointment) => appointment.status === 'booked');
    const nextAppointment = [...selectedAppointments]
      .filter((appointment) => appointment.status === 'booked')
      .sort((left, right) =>
        `${left.appointmentDate}T${left.appointmentTime}`.localeCompare(
          `${right.appointmentDate}T${right.appointmentTime}`
        )
      )[0];

    if (overviewDayCount instanceof HTMLElement) {
      overviewDayCount.textContent = String(selectedAppointments.length);
    }

    if (overviewBookedCount instanceof HTMLElement) {
      overviewBookedCount.textContent = String(activeAppointments.length);
    }

    if (overviewNextClient instanceof HTMLElement) {
      const calendarCopy = getDashboardUiCopy().calendar ?? DEFAULT_DASHBOARD_UI_COPY.calendar;
      overviewNextClient.textContent = nextAppointment
        ? `${nextAppointment.customerName} - ${formatTimeForDisplay(nextAppointment.appointmentTime)}`
        : calendarCopy.overviewNextClientEmpty;
    }
  };

  const createNotificationItem = (appointment) => {
    const item = document.createElement('article');
    item.className = 'calendar-notification-item';

    const title = document.createElement('strong');
    title.textContent = `${appointment.customerName} booked ${appointment.serviceName}`;

    const meta = document.createElement('p');
    meta.textContent = `${formatDateTimeForDisplay(
      appointment.appointmentDate,
      appointment.appointmentTime
    )} - ${formatBookingSourceLabel(appointment.source)}`;

    const actions = document.createElement('div');
    actions.className = 'calendar-tool-inline-actions';

    const markReadButton = createToolActionButton('Mark as read', () => {
      markNotificationsAsRead([appointment]);
      openNotificationsModal();
    });
    markReadButton.classList.add('calendar-notification-read-action');

    actions.append(markReadButton);
    item.append(title, meta, actions);
    return item;
  };

  const openNotificationsModal = (
    appointments = getUnreadNotificationAppointments(),
    options = {}
  ) => {
    const notificationAppointments = Array.isArray(appointments) ? appointments : [];
    const previewItems = notificationAppointments.map((appointment) =>
      createNotificationItem(appointment)
    );
    const actions = [];

    if (previewItems.length > 0) {
      actions.push(...previewItems);
    }

    actions.push(
      createToolActionButton('View appointments', () => {
        closeToolModal();
        setMainView('calendar');
        appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      })
    );

    openToolModal({
      eyebrow: 'Notifications',
      title: options.title ?? 'Appointment updates',
      description:
        options.description ??
        (notificationAppointments.length > 0
          ? `You have ${notificationAppointments.length} unread appointment notification${notificationAppointments.length === 1 ? '' : 's'}. Mark each booking as read after reviewing it.`
          : 'No unread appointment notifications.'),
      actions
    });
  };

  const refreshDashboardNotifications = async () => {
    if (isNotificationRefreshInFlight) {
      return;
    }

    isNotificationRefreshInFlight = true;

    try {
      const previousUnreadIds = new Set(
        getUnreadNotificationAppointments().map((appointment) => appointment.id)
      );

      await loadDashboard();

      const newUnreadAppointments = getUnreadNotificationAppointments().filter(
        (appointment) => !previousUnreadIds.has(appointment.id)
      );

      if (
        newUnreadAppointments.length === 0 ||
        document.visibilityState !== 'visible' ||
        !(toolModal instanceof HTMLDivElement) ||
        !toolModal.classList.contains('is-hidden')
      ) {
        return;
      }

      openNotificationsModal(newUnreadAppointments, {
        title:
          newUnreadAppointments.length === 1
            ? 'New appointment booking'
            : 'New appointment bookings',
        description:
          newUnreadAppointments.length === 1
            ? 'A new appointment has been booked. Review it below and mark it as read when done.'
            : `${newUnreadAppointments.length} new appointments have been booked. Review them below and mark each one as read when done.`
      });
    } catch (_error) {
      // Ignore polling failures so the dashboard stays usable.
    } finally {
      isNotificationRefreshInFlight = false;
    }
  };

  const getFilteredAppointments = () => {
    const appointments = dashboardPayload?.dashboard?.appointments;

    if (!Array.isArray(appointments)) {
      return [];
    }

    return appointments.filter((appointment) => {
      if (appointment.appointmentDate !== getSelectedDateValue()) {
        return false;
      }

      if (appointmentFilter === 'qr') {
        return appointment.source === 'qr';
      }

      if (appointmentFilter === 'booked') {
        return appointment.status === 'booked';
      }

      return true;
    });
  };

  const syncAppointmentsUi = () => {
    const appointments = getFilteredAppointments();
    renderDashboardAppointments(appointments, appointmentsList, {
      onEdit: openEditAppointmentModal,
      onRunningLate: openRunningLateModal,
      onComplete: (appointment) => {
        markDashboardAppointmentComplete(appointment).catch((error) => {
          safeAlert(error instanceof Error ? error.message : 'Unable to complete appointment');
        });
      },
      onCancel: (appointment) => {
        cancelDashboardAppointment(appointment).catch((error) => {
          safeAlert(error instanceof Error ? error.message : 'Unable to cancel appointment');
        });
      }
    });
    renderCalendarAppointments(appointments, appointmentsOverlay);
    updateCalendarDateLabel();
    updateFilterChips();
    updateNotificationsUi();
    updateOverviewUi();
    renderSalesDrawer();
  };

  const updateReportsCards = () => {
    renderReportsWorkspace();
  };

  const setupReportsInteractions = () => {
    if (reportsInteractionsBound) {
      updateReportsCards();
      return;
    }

    reportsInteractionsBound = true;

    if (reportsSearchInput instanceof HTMLInputElement) {
      reportsSearchInput.addEventListener('input', () => {
        updateReportsCards();
      });
    }

    if (reportsMenu instanceof HTMLElement) {
      reportsMenu.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('.calendar-reports-menu-item');

        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        activeReportsMenu = button.dataset.menuKey ?? 'all reports';
        activeReportsFolderId = '';
        updateReportsCards();
      });
    }

    if (reportsFilters instanceof HTMLElement) {
      reportsFilters.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('.calendar-reports-filter');

        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        const filterType = button.dataset.filterType;
        const filterConfigs = buildReportsFilters();
        const config = filterConfigs.find((entry) => entry.type === filterType);

        if (!config) {
          return;
        }

        const currentIndex = config.sequence.indexOf(config.value);
        const nextValue = config.sequence[(currentIndex + 1) % config.sequence.length];

        if (filterType === 'created-by') {
          activeReportsFilters.createdBy = nextValue;
        }

        if (filterType === 'category') {
          activeReportsFilters.category = nextValue;
        }

        updateReportsCards();
      });
    }

    if (reportsTabs instanceof HTMLElement) {
      reportsTabs.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('.calendar-reports-tab');

        if (!(button instanceof HTMLButtonElement)) {
          return;
        }
        activeReportsTab = button.dataset.tabKey ?? 'all reports';
        updateReportsCards();
      });
    }

    if (reportsRange instanceof HTMLElement) {
      reportsRange.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('.calendar-reports-range-chip');

        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        reportsDateRange = button.dataset.rangeValue ?? '30d';
        updateReportsCards();
      });
    }

    if (reportsFolderAction instanceof HTMLButtonElement) {
      reportsFolderAction.addEventListener('click', () => {
        openCreateReportFolderModal();
      });
    }

    if (reportsCards instanceof HTMLElement) {
      reportsCards.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const favouriteButton = target.closest('[data-report-action="favourite"]');

        if (favouriteButton instanceof HTMLButtonElement) {
          const reportId = favouriteButton.dataset.reportId;

          if (reportId) {
            toggleFavouriteReport(reportId);
          }
          return;
        }

        const card = target.closest('.calendar-report-card');

        if (card instanceof HTMLElement && card.dataset.reportId) {
          openReportDetailModal(card.dataset.reportId);
        }
      });

      reportsCards.addEventListener('keydown', (event) => {
        const target = event.target;

        if (
          (event.key === 'Enter' || event.key === ' ') &&
          target instanceof HTMLElement &&
          target.classList.contains('calendar-report-card') &&
          target.dataset.reportId
        ) {
          event.preventDefault();
          openReportDetailModal(target.dataset.reportId);
        }
      });
    }

    const reportsFolderBlock = reportsFolderAction?.parentElement;
    if (reportsFolderBlock instanceof HTMLElement) {
      reportsFolderBlock.addEventListener('click', (event) => {
        const target = event.target;

        if (!(target instanceof HTMLElement)) {
          return;
        }

        const button = target.closest('.calendar-reports-folder-item');

        if (!(button instanceof HTMLButtonElement)) {
          return;
        }

        activeReportsFolderId = button.dataset.folderId ?? '';
        activeReportsMenu = 'all reports';
        updateReportsCards();
      });
    }

    updateReportsCards();
  };

  const closeQrModal = () => {
    if (!(qrModal instanceof HTMLDivElement)) {
      return;
    }

    qrModal.classList.add('is-hidden');
    qrModal.setAttribute('aria-hidden', 'true');
  };

  const openQrModal = async () => {
    if (
      !(qrModal instanceof HTMLDivElement) ||
      !(qrImage instanceof HTMLImageElement) ||
      !(qrLink instanceof HTMLAnchorElement) ||
      !clientId ||
      !publicBookingPath ||
      !qrCodeImagePath
    ) {
      safeAlert('Booking QR code is not ready yet. Reload the dashboard and try again.');
      return;
    }

    try {
      const response = await fetch(qrCodeImagePath);

      if (!response.ok) {
        throw new Error('Unable to load QR code');
      }

      const svgMarkup = await response.text();
      qrImage.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkup)}`;
      qrLink.href = qrBookingPath || publicBookingPath;
      if (shareDirectLink instanceof HTMLAnchorElement) {
        shareDirectLink.href = publicBookingPath;
        shareDirectLink.textContent = `Direct: ${publicBookingPath}`;
      }
      if (shareInstagramLink instanceof HTMLAnchorElement) {
        shareInstagramLink.href = instagramBookingPath || publicBookingPath;
        shareInstagramLink.textContent = `Instagram: ${instagramBookingPath || publicBookingPath}`;
      }
      if (shareFacebookLink instanceof HTMLAnchorElement) {
        shareFacebookLink.href = facebookBookingPath || publicBookingPath;
        shareFacebookLink.textContent = `Facebook: ${facebookBookingPath || publicBookingPath}`;
      }
      if (shareAppleMapsLink instanceof HTMLAnchorElement) {
        shareAppleMapsLink.href = appleMapsBookingPath || publicBookingPath;
        shareAppleMapsLink.textContent = `Apple Maps: ${appleMapsBookingPath || publicBookingPath}`;
      }
      if (shareQrLink instanceof HTMLAnchorElement) {
        shareQrLink.href = qrBookingPath || publicBookingPath;
        shareQrLink.textContent = `QR: ${qrBookingPath || publicBookingPath}`;
      }
      qrModal.classList.remove('is-hidden');
      qrModal.setAttribute('aria-hidden', 'false');
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load QR code');
    }
  };

  const printQrCode = () => {
    if (!(qrImage instanceof HTMLImageElement) || !qrImage.src) {
      safeAlert('Load the QR code first, then try printing again.');
      return;
    }

    const printWindow = window.open('', '_blank', 'noopener,noreferrer,width=720,height=820');

    if (!printWindow) {
      safeAlert('Enable pop-ups to print the QR code.');
      return;
    }

    const businessName = dashboardPayload?.dashboard?.businessName ?? 'Booking QR';
    const bookingHref = qrLink instanceof HTMLAnchorElement ? qrLink.href : publicBookingPath;

    const escapedBusinessName = escapeHtml(businessName);
    const escapedBookingHref = escapeHtml(bookingHref);
    const escapedQrImageSrc = escapeHtml(qrImage.src);

    printWindow.document.write(`<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Print QR code</title>
    <style>
      body {
        margin: 0;
        font-family: Manrope, sans-serif;
        display: grid;
        place-items: center;
        min-height: 100vh;
        background: #ffffff;
        color: #1f1b18;
      }
      main {
        width: min(420px, 100%);
        padding: 32px;
        text-align: center;
      }
      img {
        width: 280px;
        height: 280px;
        padding: 16px;
        border: 1px solid rgba(18, 18, 18, 0.08);
        border-radius: 24px;
        background: #ffffff;
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.8rem;
      }
      p {
        margin: 12px 0 0;
        line-height: 1.6;
      }
      a {
        color: #1f1b18;
        word-break: break-word;
      }
      @media print {
        body {
          min-height: auto;
        }
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapedBusinessName}</h1>
      <img src="${escapedQrImageSrc}" alt="Booking QR code" />
      <p>Scan to book instantly.</p>
      <p><a href="${escapedBookingHref}">${escapedBookingHref}</a></p>
    </main>
    <script>
      window.addEventListener('load', () => {
        window.print();
        window.setTimeout(() => window.close(), 200);
      });
    </script>
  </body>
</html>`);
    printWindow.document.close();
  };

  const closeAddMenu = () => {
    if (!hasAddMenu) {
      return;
    }

    addMenu.classList.add('is-hidden');
    addButton.setAttribute('aria-expanded', 'false');
  };

  const openAddMenu = () => {
    if (!hasAddMenu) {
      return;
    }

    addMenu.classList.remove('is-hidden');
    addButton.setAttribute('aria-expanded', 'true');
  };

  const setActiveDrawer = (drawerName) => {
    if (!hasSideDrawers) {
      return;
    }

    if (drawerName) {
      calendarMain.dataset.sideDrawer = drawerName;
    } else {
      delete calendarMain.dataset.sideDrawer;
    }

    if (hasSalesDrawer) {
      const isSalesOpen = drawerName === 'sales';
      salesToggle.setAttribute('aria-expanded', String(isSalesOpen));
      saleAction.setAttribute('aria-expanded', String(isSalesOpen));
    }

    if (hasClientsDrawer) {
      const isClientsOpen = drawerName === 'clients';
      clientsToggle.setAttribute('aria-expanded', String(isClientsOpen));
    }

    if (hasCatalogDrawer) {
      const isCatalogOpen = drawerName === 'catalog';
      catalogToggle.setAttribute('aria-expanded', String(isCatalogOpen));
    }

    if (hasTeamDrawer) {
      const isTeamOpen = drawerName === 'team';
      teamToggle.setAttribute('aria-expanded', String(isTeamOpen));
    }
  };

  const getActiveDrawer = () => {
    return calendarMain.dataset.sideDrawer ?? '';
  };

  const setMainView = (viewName) => {
    if (viewName === 'reports') {
      calendarMain.dataset.mainView = 'reports';
      reportsToggle.classList.add('is-active');
      reportsToggle.setAttribute('aria-expanded', 'true');
      calendarNavCalendar.classList.remove('is-active');
      return;
    }

    delete calendarMain.dataset.mainView;
    reportsToggle.classList.remove('is-active');
    reportsToggle.setAttribute('aria-expanded', 'false');
    calendarNavCalendar.classList.add('is-active');
  };

  const getMainView = () => {
    return calendarMain.dataset.mainView ?? 'calendar';
  };

  const syncSideDrawerOffset = () => {
    if (!hasSideDrawers) {
      return;
    }

    const mainRect = calendarMain.getBoundingClientRect();
    const toolbarRect = calendarToolbar.getBoundingClientRect();
    const topOffset = Math.max(0, Math.round(toolbarRect.bottom - mainRect.top));

    calendarMain.style.setProperty('--calendar-side-drawer-top', `${topOffset}px`);
  };

  if (hasAddMenu) {
    addButton.addEventListener('click', () => {
      if (addMenu.classList.contains('is-hidden')) {
        setActiveDrawer('');
        setMainView('calendar');
        openAddMenu();
        return;
      }

      closeAddMenu();
    });

    for (const item of addMenuItems) {
      if (!(item instanceof HTMLButtonElement)) {
        continue;
      }

      item.addEventListener('click', () => {
        closeAddMenu();
      });
    }

    if (bookAppointmentAction instanceof HTMLButtonElement) {
      bookAppointmentAction.addEventListener('click', () => {
        if (!publicBookingPath) {
          return;
        }

        closeAddMenu();
        window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
      });
    }

    if (showQrAction instanceof HTMLButtonElement) {
      showQrAction.addEventListener('click', async () => {
        closeAddMenu();
        await openQrModal();
      });
    }

    if (groupAppointmentAction instanceof HTMLButtonElement) {
      groupAppointmentAction.addEventListener('click', () => {
        closeAddMenu();
        openToolModal({
          eyebrow: 'Add menu',
          title: 'Group appointments are planned',
          description:
            'Use the standard booking page for now. Group booking rules can be added once service capacity is defined.',
          actions: [
            createToolActionButton('Open booking page', () => {
              closeToolModal();
              if (publicBookingPath) {
                window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
              }
            })
          ]
        });
      });
    }

    if (blockedTimeAction instanceof HTMLButtonElement) {
      blockedTimeAction.addEventListener('click', () => {
        closeAddMenu();
        openToolModal({
          eyebrow: 'Add menu',
          title: 'Blocked time setup',
          description:
            'Blocked time is not saved yet. For now, use this to mark where staff availability rules should be added next.',
          actions: [
            createToolActionButton('Open team panel', () => {
              closeToolModal();
              setMainView('calendar');
              syncSideDrawerOffset();
              setActiveDrawer('team');
            })
          ]
        });
      });
    }

    if (quickPaymentAction instanceof HTMLButtonElement) {
      quickPaymentAction.addEventListener('click', () => {
        closeAddMenu();
        if (guardBillingFeature('payments')) {
          return;
        }

        setMainView('calendar');
        syncSideDrawerOffset();
        setActiveDrawer('sales');
        openRecordPaymentModal();
      });
    }
  }

  if (hasSalesDrawer) {
    saleAction.addEventListener('click', () => {
      if (guardBillingFeature('payments')) {
        return;
      }

      syncSideDrawerOffset();
      setMainView('calendar');
      setActiveDrawer('sales');
    });
  }

  if (hasSalesDrawer) {
    salesToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      closeAddMenu();

      if (guardBillingFeature('payments')) {
        return;
      }

      if (getActiveDrawer() !== 'sales') {
        syncSideDrawerOffset();
        setMainView('calendar');
        setActiveDrawer('sales');
        return;
      }

      setActiveDrawer('');
    });
  }

  if (salesContent instanceof HTMLElement) {
    salesContent.addEventListener('click', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('.calendar-drawer-link');

      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const actionLabel = button.dataset.drawerLabel?.trim().toLowerCase();

      if (actionLabel === 'appointments') {
        setMainView('calendar');
        setActiveDrawer('');
        appointmentFilter = 'all';
        setFilterBarVisibility(true);
        syncAppointmentsUi();
        appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }

      if (actionLabel === 'daily sales summary') {
        openSalesSummaryModal();
        return;
      }

      if (actionLabel === 'sales') {
        openSalesOverviewModal();
        return;
      }

      if (actionLabel === 'payments') {
        openPaymentsModal();
        return;
      }

      if (actionLabel === 'gift cards sold') {
        openGiftCardsModal();
        return;
      }

      if (actionLabel === 'memberships sold' || actionLabel === 'packages sold') {
        openMembershipsModal();
      }
    });
  }

  if (hasClientsDrawer) {
    clientsToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      closeAddMenu();

      if (getActiveDrawer() !== 'clients') {
        syncSideDrawerOffset();
        setMainView('calendar');
        setActiveDrawer('clients');
        return;
      }

      setActiveDrawer('');
    });
  }

  if (clientsContent instanceof HTMLElement) {
    clientsContent.addEventListener('click', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('.calendar-drawer-link');

      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const actionLabel = button.dataset.drawerLabel?.trim().toLowerCase();

      if (actionLabel === 'clients list') {
        openClientsListModal();
        return;
      }

      if (actionLabel === 'client loyalty') {
        openClientLoyaltyModal();
        return;
      }

      openBookedClientModal(button);
    });
  }

  if (hasCatalogDrawer) {
    catalogToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      closeAddMenu();

      if (getActiveDrawer() !== 'catalog') {
        syncSideDrawerOffset();
        setMainView('calendar');
        setActiveDrawer('catalog');
        return;
      }

      setActiveDrawer('');
    });
  }

  if (catalogContent instanceof HTMLElement) {
    catalogContent.addEventListener('click', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('.calendar-drawer-link');

      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const actionLabel = button.dataset.drawerLabel?.trim().toLowerCase();

      if (actionLabel === 'service menu') {
        openServiceMenuModal();
        return;
      }

      if (actionLabel === 'memberships' || actionLabel === 'packages') {
        openCatalogMembershipsModal();
        return;
      }

      if (actionLabel === 'products') {
        openProductsModal();
        return;
      }

      if (actionLabel === 'stocktakes') {
        openStocktakesModal();
        return;
      }

      if (actionLabel === 'stock orders') {
        openStockOrdersModal();
        return;
      }

      if (actionLabel === 'suppliers') {
        openSuppliersModal();
      }
    });
  }

  if (hasTeamDrawer) {
    teamToggle.addEventListener('click', (event) => {
      event.stopPropagation();
      closeAddMenu();

      if (guardBillingFeature('team_management')) {
        return;
      }

      if (getActiveDrawer() !== 'team') {
        syncSideDrawerOffset();
        setMainView('calendar');
        setActiveDrawer('team');
        return;
      }

      setActiveDrawer('');
    });
  }

  if (teamContent instanceof HTMLElement) {
    teamContent.addEventListener('click', (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const button = target.closest('.calendar-drawer-link');

      if (!(button instanceof HTMLButtonElement)) {
        return;
      }

      const actionLabel = button.dataset.drawerLabel?.trim().toLowerCase();

      if (actionLabel === 'team members') {
        openTeamMembersModal();
        return;
      }

      if (actionLabel === 'scheduled shifts') {
        openToolModal({
          eyebrow: 'Team',
          title: 'Scheduled shifts',
          description: 'Shift planning is not connected yet. Add your team first, then attach availability rules here.',
          actions: [
            createToolActionButton(`Add ${getBusinessRoleLabel()}`, async () => {
              closeToolModal();
              openAddTeamMemberModal();
            })
          ]
        });
        return;
      }

      if (actionLabel === 'timesheets' || actionLabel === 'pay runs') {
        openToolModal({
          eyebrow: 'Team',
          title: button.dataset.drawerLabel ?? 'Team tools',
          description: 'This team workflow is still a placeholder. Add barbers first so payroll and timesheets can be connected next.',
          actions: [
            createToolActionButton('Open team members', () => {
              closeToolModal();
              openTeamMembersModal();
            })
          ]
        });
        return;
      }

      openTeamMembersModal();
    });
  }

  if (hasSideDrawers) {
    syncSideDrawerOffset();
    window.addEventListener('resize', syncSideDrawerOffset);

    if ('ResizeObserver' in window) {
      const sideDrawerLayoutObserver = new ResizeObserver(() => {
        syncSideDrawerOffset();
      });

      sideDrawerLayoutObserver.observe(calendarMain);
      sideDrawerLayoutObserver.observe(calendarToolbar);
    }
  }

  reportsToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    closeAddMenu();
    setActiveDrawer('');

    if (guardBillingFeature('advanced_reports')) {
      return;
    }

    if (getMainView() !== 'reports') {
      setMainView('reports');
      return;
    }

    setMainView('calendar');
  });

  calendarNavCalendar.addEventListener('click', (event) => {
    if (getMainView() === 'reports') {
      event.preventDefault();
      setMainView('calendar');
    }
  });

  if (todayAction instanceof HTMLButtonElement) {
    todayAction.addEventListener('click', () => {
      selectedDate = new Date();
      setMainView('calendar');
      syncAppointmentsUi();
    });
  }

  if (prevDayAction instanceof HTMLButtonElement) {
    prevDayAction.addEventListener('click', () => {
      selectedDate = new Date(selectedDate);
      selectedDate.setDate(selectedDate.getDate() - 1);
      setMainView('calendar');
      syncAppointmentsUi();
    });
  }

  if (nextDayAction instanceof HTMLButtonElement) {
    nextDayAction.addEventListener('click', () => {
      selectedDate = new Date(selectedDate);
      selectedDate.setDate(selectedDate.getDate() + 1);
      setMainView('calendar');
      syncAppointmentsUi();
    });
  }

  dateLabel.addEventListener('click', () => {
    setMainView('calendar');
    dateInput.value = getSelectedDateValue();

    if (typeof dateInput.showPicker === 'function') {
      dateInput.showPicker();
      return;
    }

    dateInput.focus();
    dateInput.click();
  });

  dateInput.addEventListener('change', () => {
    if (!dateInput.value) {
      return;
    }

    selectedDate = new Date(`${dateInput.value}T00:00:00`);
    setMainView('calendar');
    syncAppointmentsUi();
  });

  if (teamShortcut instanceof HTMLButtonElement && hasTeamDrawer) {
    teamShortcut.addEventListener('click', () => {
      closeAddMenu();
      if (guardBillingFeature('team_management')) {
        return;
      }

      setMainView('calendar');

      if (getActiveDrawer() === 'team') {
        setActiveDrawer('');
        return;
      }

      syncSideDrawerOffset();
      setActiveDrawer('team');
    });
  }

  if (filtersAction instanceof HTMLButtonElement && filterBar instanceof HTMLElement) {
    filtersAction.addEventListener('click', () => {
      setMainView('calendar');
      setFilterBarVisibility(filterBar.classList.contains('is-hidden'));
    });
  }

  if (filterAll instanceof HTMLButtonElement) {
    filterAll.addEventListener('click', () => {
      appointmentFilter = 'all';
      setFilterBarVisibility(true);
      syncAppointmentsUi();
    });
  }

  if (filterBooked instanceof HTMLButtonElement) {
    filterBooked.addEventListener('click', () => {
      appointmentFilter = 'booked';
      setFilterBarVisibility(true);
      syncAppointmentsUi();
    });
  }

  if (filterQr instanceof HTMLButtonElement) {
    filterQr.addEventListener('click', () => {
      appointmentFilter = 'qr';
      setFilterBarVisibility(true);
      syncAppointmentsUi();
    });
  }

  if (settingsAction instanceof HTMLButtonElement) {
    settingsAction.addEventListener('click', () => {
      openToolModal({
        eyebrow: 'Calendar settings',
        title: 'Settings shortcuts',
        description:
          'Calendar preferences are not persisted yet, but these shortcuts now guide the admin to the active working areas.',
        actions: [
          createToolActionButton('Open team panel', () => {
            closeToolModal();
            setMainView('calendar');
            syncSideDrawerOffset();
            setActiveDrawer('team');
          }),
          createToolActionButton('Open reports', () => {
            closeToolModal();
            setActiveDrawer('');
            setMainView('reports');
          })
        ]
      });
    });
  }

  if (appointmentsAction instanceof HTMLButtonElement) {
    appointmentsAction.addEventListener('click', () => {
      setMainView('calendar');
      appointmentsList?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  if (viewToggle instanceof HTMLButtonElement) {
    viewToggle.addEventListener('click', () => {
      currentView = currentView === 'day' ? 'agenda' : 'day';
      setMainView('calendar');
      updateViewToggleLabel();
    });
  }

  if (searchAction instanceof HTMLButtonElement) {
    searchAction.addEventListener('click', () => {
      setMainView('calendar');
      setActiveDrawer('');
      openCalendarSearchModal();
    });
  }

  if (analyticsAction instanceof HTMLButtonElement) {
    analyticsAction.addEventListener('click', () => {
      if (guardBillingFeature('advanced_reports')) {
        return;
      }

      setActiveDrawer('');
      setMainView('reports');
      reportsSearchInput?.focus();
    });
  }

  if (notificationsAction instanceof HTMLButtonElement) {
    notificationsAction.addEventListener('click', () => {
      openNotificationsModal();
    });
  }

  if (homeAction instanceof HTMLButtonElement) {
    homeAction.addEventListener('click', () => {
      setActiveDrawer('');
      setMainView('calendar');
      selectedDate = new Date();
      appointmentFilter = 'all';
      setFilterBarVisibility(false);
      syncAppointmentsUi();
    });
  }

  if (profileAction instanceof HTMLButtonElement) {
    profileAction.addEventListener('click', () => {
      openProfileModal();
    });
  }

  if (userAvatar instanceof HTMLButtonElement) {
    userAvatar.addEventListener('click', () => {
      openProfileModal();
    });
  }

  planChip.addEventListener('click', () => {
    window.location.assign(getPricingPath());
  });

  if (marketingAction instanceof HTMLButtonElement) {
    marketingAction.addEventListener('click', () => {
      if (guardBillingFeature('marketing')) {
        return;
      }

      openToolModal({
        eyebrow: 'Marketing',
        title: 'Marketing tools',
        description:
          'Use the booking link and QR code to bring in traffic today. Campaign builders can be added here later.',
        actions: [
          createToolActionButton('Open booking page', () => {
            closeToolModal();
            if (publicBookingPath) {
              window.open(publicBookingPath, '_blank', 'noopener,noreferrer');
            }
          }),
          createToolActionButton('Show QR code', async () => {
            closeToolModal();
            await openQrModal();
          })
        ]
      });
    });
  }

  if (moreAction instanceof HTMLButtonElement) {
    moreAction.addEventListener('click', () => {
      openToolModal({
        eyebrow: 'More tools',
        title: 'Admin shortcuts',
        description:
          'The dashboard now exposes the most useful shortcuts here while the rest of the admin areas are still being built.',
        actions: [
          createToolActionButton('Open sales', () => {
            closeToolModal();
            if (guardBillingFeature('payments')) {
              return;
            }

            setMainView('calendar');
            syncSideDrawerOffset();
            setActiveDrawer('sales');
          }),
          createToolActionButton('Open clients', () => {
            closeToolModal();
            setMainView('calendar');
            syncSideDrawerOffset();
            setActiveDrawer('clients');
          }),
          createToolActionButton('Open catalog', () => {
            closeToolModal();
            setMainView('calendar');
            syncSideDrawerOffset();
            setActiveDrawer('catalog');
          })
        ]
      });
    });
  }

  const loadDashboard = async () => {
    const [payload, paymentPayload, billingOverviewPayload] = await Promise.all([
      apiRequest(`/api/platform/clients/${clientId}/dashboard`),
      apiRequest(`/api/platform/clients/${clientId}/payments`),
      apiRequest(`/api/platform/clients/${clientId}/billing`)
    ]);
    const launchLinks = payload.dashboard.launchLinks ?? {
      bookingPageLink: `${window.location.origin}${buildTrackedBookingPath(clientId, 'direct')}`,
      instagramBookingLink: `${window.location.origin}${buildTrackedBookingPath(clientId, 'instagram')}`,
      facebookBookingLink: `${window.location.origin}${buildTrackedBookingPath(clientId, 'facebook')}`,
      appleMapsBookingLink: `${window.location.origin}${buildTrackedBookingPath(clientId, 'applemaps')}`,
      qrBookingPageLink: `${window.location.origin}${buildTrackedBookingPath(clientId, 'qr')}`,
      qrCodeImageLink: `${window.location.origin}/api/public/book/${encodeURIComponent(clientId)}/qr`
    };

    dashboardPayload = payload;
    paymentsPayload = paymentPayload;
    billingPayload = billingOverviewPayload;
    setDashboardUiCopy(payload.dashboard.uiCopy);
    currentBusinessSettings = getDashboardBusinessSettings();
    reportsWorkspace = getReportsWorkspaceState(clientId);
    publicBookingPath = launchLinks.bookingPageLink;
    instagramBookingPath = launchLinks.instagramBookingLink;
    facebookBookingPath = launchLinks.facebookBookingLink;
    appleMapsBookingPath = launchLinks.appleMapsBookingLink;
    qrBookingPath = launchLinks.qrBookingPageLink;
    qrCodeImagePath = launchLinks.qrCodeImageLink;

    const calendarCopy = getDashboardUiCopy().calendar ?? DEFAULT_DASHBOARD_UI_COPY.calendar;
    const setupGuideProgress = getSetupGuideProgress(payload.client, payload.dashboard?.appointments);

    setupButton.classList.toggle('is-hidden', setupGuideProgress.isAllComplete);

    if (bookingLink instanceof HTMLAnchorElement) {
      bookingLink.href = publicBookingPath;
      bookingLink.textContent = calendarCopy.bookingLinkLabel;
    }

    if (qrLink instanceof HTMLAnchorElement) {
      qrLink.href = qrBookingPath;
      qrLink.textContent = calendarCopy.bookingLinkLabel;
    }

    if (todayAction instanceof HTMLButtonElement) {
      todayAction.textContent = calendarCopy.today;
    }

    if (addButtonLabel instanceof HTMLElement) {
      addButtonLabel.textContent = calendarCopy.add;
    }

    if (addMenu instanceof HTMLElement) {
      addMenu.setAttribute('aria-label', calendarCopy.addMenuAria);
    }

    if (bookAppointmentAction instanceof HTMLButtonElement) {
      bookAppointmentAction.lastElementChild.textContent = calendarCopy.bookAppointment;
    }

    if (showQrAction instanceof HTMLButtonElement) {
      showQrAction.lastElementChild.textContent = calendarCopy.showQrCode;
    }

    if (groupAppointmentAction instanceof HTMLButtonElement) {
      groupAppointmentAction.lastElementChild.textContent = calendarCopy.groupAppointment;
    }

    if (blockedTimeAction instanceof HTMLButtonElement) {
      blockedTimeAction.lastElementChild.textContent = calendarCopy.blockedTime;
    }

    if (saleAction instanceof HTMLButtonElement) {
      saleAction.lastElementChild.textContent = calendarCopy.sale;
    }

    if (quickPaymentAction instanceof HTMLButtonElement) {
      quickPaymentAction.lastElementChild.textContent = calendarCopy.quickPayment;
    }

    if (onlineBookingsTitle instanceof HTMLElement) {
      onlineBookingsTitle.textContent = calendarCopy.onlineBookingsTitle;
    }

    if (onlineBookingsDescription instanceof HTMLElement) {
      onlineBookingsDescription.textContent = calendarCopy.onlineBookingsDescription;
    }

    if (overviewSelectedDayLabel instanceof HTMLElement) {
      overviewSelectedDayLabel.textContent = calendarCopy.overviewSelectedDayLabel;
    }

    if (overviewSelectedDayMeta instanceof HTMLElement) {
      overviewSelectedDayMeta.textContent = calendarCopy.overviewSelectedDayMeta;
    }

    if (overviewComingAppointmentLabel instanceof HTMLElement) {
      overviewComingAppointmentLabel.textContent = calendarCopy.overviewComingAppointmentLabel;
    }

    if (overviewComingAppointmentMeta instanceof HTMLElement) {
      overviewComingAppointmentMeta.textContent = calendarCopy.overviewComingAppointmentMeta;
    }

    if (overviewNextClientLabel instanceof HTMLElement) {
      overviewNextClientLabel.textContent = calendarCopy.overviewNextClientLabel;
    }

    if (overviewNextClientMeta instanceof HTMLElement) {
      overviewNextClientMeta.textContent = calendarCopy.overviewNextClientMeta;
    }

    if (filterAll instanceof HTMLButtonElement) {
      filterAll.textContent = calendarCopy.filterAll;
    }

    if (filterBooked instanceof HTMLButtonElement) {
      filterBooked.textContent = calendarCopy.filterBooked;
    }

    if (filterQr instanceof HTMLButtonElement) {
      filterQr.textContent = calendarCopy.filterQr;
    }

    if (qrEyebrow instanceof HTMLElement) {
      qrEyebrow.textContent = calendarCopy.qrEyebrow;
    }

    if (qrTitle instanceof HTMLElement) {
      qrTitle.textContent = calendarCopy.qrTitle;
    }

    if (qrDescription instanceof HTMLElement) {
      qrDescription.textContent = calendarCopy.qrDescription;
    }

    if (qrPrint instanceof HTMLButtonElement) {
      qrPrint.textContent = calendarCopy.qrPrint;
    }

    brand.textContent = payload.dashboard.businessName;
    setupLabel.textContent = payload.dashboard.setupButtonLabel;
    setupButton.href = buildPathWithClientId(payload.dashboard.setupButtonPath, clientId);
    renderCalendarAvatar(
      userAvatar,
      payload.dashboard.avatarInitial,
      payload.dashboard.profileImageUrl
    );
    renderCalendarAvatar(
      staffAvatar,
      payload.dashboard.avatarInitial,
      payload.dashboard.profileImageUrl
    );
    staffName.textContent = payload.dashboard.ownerName;
    nowBadge.textContent = payload.dashboard.currentTimeLabel;
    renderBillingPlanChip();

    renderSalesDrawer();
    renderClientsDrawer();
    renderCatalogDrawer();
    renderDrawer(payload.dashboard.sideDrawers.team, teamTitle, teamContent);
    renderReportsWorkspace();

    if (!setupActionHandled) {
      const setupAction = getSetupAction();

      if (setupAction === 'team') {
        setupActionHandled = true;
        setMainView('calendar');
        syncSideDrawerOffset();
        setActiveDrawer('team');
        openAddTeamMemberModal();
        window.history.replaceState({}, '', buildPathWithClientId('/calendar', clientId));
      } else if (setupAction === 'services') {
        setupActionHandled = true;
        setMainView('calendar');
        syncSideDrawerOffset();
        setActiveDrawer('catalog');
        openServiceMenuModal();
        window.history.replaceState({}, '', buildPathWithClientId('/calendar', clientId));
      }
    }

    updateViewToggleLabel();
    syncCalendarTimeGrid();
    syncAppointmentsUi();
    setupReportsInteractions();
  };

  document.addEventListener('click', (event) => {
    const target = event.target;

    if (
      hasAddMenu &&
      target instanceof Node &&
      !addMenu.contains(target) &&
      !addButton.contains(target)
    ) {
      closeAddMenu();
    }

    if (
      hasSideDrawers &&
      target instanceof Node &&
      !(hasSalesDrawer &&
        (salesPanel.contains(target) ||
          saleAction.contains(target) ||
          salesToggle.contains(target))) &&
      !(hasClientsDrawer &&
        (clientsPanel.contains(target) || clientsToggle.contains(target))) &&
      !(hasCatalogDrawer &&
        (catalogPanel.contains(target) || catalogToggle.contains(target))) &&
      !(hasTeamDrawer && (teamPanel.contains(target) || teamToggle.contains(target)))
    ) {
      setActiveDrawer('');
    }

    if (
      toolModal instanceof HTMLDivElement &&
      target === toolModal
    ) {
      closeToolModal();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAddMenu();
      setActiveDrawer('');
      closeQrModal();
      closeToolModal();
    }
  });

  const clientId = getClientId();
  if (!clientId) {
    return;
  }

  setFilterBarVisibility(false);

  loadDashboard()
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load dashboard');
    });

  if (refreshAction instanceof HTMLButtonElement) {
    refreshAction.addEventListener('click', async () => {
      try {
        await loadDashboard();
      } catch (error) {
        safeAlert(error instanceof Error ? error.message : 'Unable to refresh dashboard');
      }
    });
  }

  window.setInterval(() => {
    refreshDashboardNotifications();
  }, DASHBOARD_NOTIFICATION_REFRESH_INTERVAL_MS);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      refreshDashboardNotifications();
    }
  });

  if (qrClose instanceof HTMLButtonElement) {
    qrClose.addEventListener('click', () => {
      closeQrModal();
    });
  }

  if (qrPrint instanceof HTMLButtonElement) {
    qrPrint.addEventListener('click', () => {
      printQrCode();
    });
  }

  if (qrModal instanceof HTMLDivElement) {
    qrModal.addEventListener('click', (event) => {
      if (event.target === qrModal) {
        closeQrModal();
      }
    });
  }

  if (toolClose instanceof HTMLButtonElement) {
    toolClose.addEventListener('click', () => {
      closeToolModal();
    });
  }

  if (toolModal instanceof HTMLDivElement) {
    toolModal.addEventListener('click', (event) => {
      if (event.target === toolModal) {
        closeToolModal();
      }
    });
  }
};

const initPublicBooking = () => {
  const bookingForm = document.querySelector('#public-booking-form');
  const businessName = document.querySelector('#booking-business-name');
  const businessCopy = document.querySelector('#booking-business-copy');
  const serviceTypes = document.querySelector('#booking-service-types');
  const teamMemberField = document.querySelector('#booking-team-member-field');
  const teamMemberSelect = document.querySelector('#booking-team-member-select');
  const serviceSelect = document.querySelector('#booking-service-select');
  const dateInput = document.querySelector('#booking-date-input');
  const timeSelect = document.querySelector('#booking-time-select');
  const customerNameInput = document.querySelector('#booking-customer-name');
  const customerPhoneLabel = document.querySelector('#booking-customer-phone-label');
  const customerPhoneCountryCodeInput = document.querySelector('#booking-customer-phone-country-code');
  const customerPhoneInput = document.querySelector('#booking-customer-phone');
  const customerPhoneHelp = document.querySelector('#booking-customer-phone-help');
  const customerEmailInput = document.querySelector('#booking-customer-email');
  const phoneHistoryPanel = document.querySelector('#booking-phone-history');
  const phoneHistoryList = document.querySelector('#booking-phone-history-list');
  const benefitsPanel = document.querySelector('#booking-benefits-panel');
  const benefitsList = document.querySelector('#booking-benefits-list');
  const benefitField = document.querySelector('#booking-benefit-field');
  const benefitSelect = document.querySelector('#booking-benefit-select');
  const serviceLocationField = document.querySelector('#booking-service-location-field');
  const serviceLocationLabel = document.querySelector('#booking-service-location-label');
  const serviceLocationSelect = document.querySelector('#booking-service-location-select');
  const customerAddressField = document.querySelector('#booking-customer-address-field');
  const customerAddressLabel = document.querySelector('#booking-customer-address-label');
  const customerAddressInput = document.querySelector('#booking-customer-address');
  const customerAddressHelp = document.querySelector('#booking-customer-address-help');
  const bookingFooterPhoneRow = document.querySelector('#booking-footer-phone-row');
  const bookingFooterPhoneLink = document.querySelector('#booking-footer-phone-link');
  const bookingFooterWebsiteRow = document.querySelector('#booking-footer-website-row');
  const bookingFooterWebsiteLink = document.querySelector('#booking-footer-website-link');
  const bookingFooterAddressRow = document.querySelector('#booking-footer-address-row');
  const bookingFooterAddressText = document.querySelector('#booking-footer-address-text');
  const waitlistPanel = document.querySelector('#booking-waitlist-panel');
  const waitlistCopy = document.querySelector('#booking-waitlist-copy');
  const waitlistButton = document.querySelector('#booking-waitlist-button');
  const summaryBusinessName = document.querySelector('#booking-summary-business-name');
  const summaryTitle = document.querySelector('#booking-summary-title');
  const summaryCopy = document.querySelector('#booking-summary-copy');
  const successPanel = document.querySelector('#booking-success');
  const successCopy = document.querySelector('#booking-success-copy');
  const reviewForm = document.querySelector('#booking-review-form');
  const reviewReferenceInput = document.querySelector('#booking-review-reference');
  const reviewRatingInput = document.querySelector('#booking-review-rating');
  const reviewStars = document.querySelector('#booking-review-stars');
  const reviewSuccessPanel = document.querySelector('#booking-review-success');
  const reviewSuccessCopy = document.querySelector('#booking-review-success-copy');
  const servicesByName = new Map();
  const teamMembersById = new Map();
  const benefitOptionsByValue = new Map();
  const bookingLocationLabelsByValue = new Map();
  let latestAppointmentReference = '';
  let phoneHistoryRequestCounter = 0;
  let benefitsRequestCounter = 0;
  let lastAutofilledPhone = '';
  let lastAutofilledName = '';
  let lastAutofilledEmail = '';
  let activeWaitlistOffer = null;
  let savedWaitlistSignature = '';
  let currentBusinessName = '';
  let currentBusinessPhoneNumber = '';
  let bookingHeadingFallback = '';
  let availableBookingLocations = [];
  let bookingUiCopy = {
    locationLabel: '',
    locationLabels: {},
    defaultLocationValue: '',
    addressLocationValue: '',
    addressLabel: '',
    addressPlaceholder: '',
    addressHelp: '',
    addressRequired: '',
    phoneLabel: '',
    phoneHelp: '',
    phoneCountryCodeLabel: '',
    phoneCountryCode: '',
    phoneNumberPlaceholder: ''
  };

  const syncBookingHero = () => {
    const bookingHeading = currentBusinessName || bookingHeadingFallback;
    businessName.textContent = bookingHeading;
    summaryBusinessName.textContent = bookingHeading;
    summaryBusinessName.classList.toggle('is-hidden', !bookingHeading);
    businessCopy.textContent = bookingHeading
      ? `Choose your service, pick a time, and book directly with ${bookingHeading}.`
      : '';

    if (bookingHeading) {
      document.title = `${bookingHeading} | Book appointment`;
    }
  };

  const syncBookingFooter = (payload = {}) => {
    const businessPhoneNumber =
      typeof payload.businessPhoneNumber === 'string' ? payload.businessPhoneNumber.trim() : '';
    const websiteValue = typeof payload.website === 'string' ? payload.website.trim() : '';
    const venueAddressValue =
      typeof payload.venueAddress === 'string' ? payload.venueAddress.trim() : '';
    const websiteUrl = normalizeExternalUrl(websiteValue);

    bookingFooterPhoneRow.classList.toggle('is-hidden', !businessPhoneNumber);
    bookingFooterWebsiteRow.classList.toggle('is-hidden', !websiteUrl);
    bookingFooterAddressRow.classList.toggle('is-hidden', !venueAddressValue);

    if (businessPhoneNumber) {
      bookingFooterPhoneLink.href = `tel:${businessPhoneNumber.replace(/\s+/g, '')}`;
      bookingFooterPhoneLink.textContent = businessPhoneNumber;
    } else {
      bookingFooterPhoneLink.removeAttribute('href');
      bookingFooterPhoneLink.textContent = '';
    }

    if (websiteUrl) {
      bookingFooterWebsiteLink.href = websiteUrl;
      bookingFooterWebsiteLink.textContent = websiteValue;
    } else {
      bookingFooterWebsiteLink.removeAttribute('href');
      bookingFooterWebsiteLink.textContent = '';
    }

    bookingFooterAddressText.textContent = venueAddressValue;
  };

  const syncBookingUiCopy = (config = {}) => {
    const locationLabels =
      typeof config.bookingLocationLabels === 'object' && config.bookingLocationLabels !== null
        ? Object.entries(config.bookingLocationLabels).reduce((labels, [value, label]) => {
            if (typeof value === 'string' && typeof label === 'string' && value.trim() && label.trim()) {
              labels[value.trim()] = label.trim();
            }

            return labels;
          }, {})
        : {};

    bookingUiCopy = {
      locationLabel: typeof config.bookingLocationLabel === 'string' ? config.bookingLocationLabel.trim() : '',
      locationLabels,
      defaultLocationValue:
        typeof config.bookingDefaultLocationValue === 'string'
          ? config.bookingDefaultLocationValue.trim()
          : '',
      addressLocationValue:
        typeof config.bookingAddressLocationValue === 'string'
          ? config.bookingAddressLocationValue.trim()
          : '',
      addressLabel: typeof config.bookingAddressLabel === 'string' ? config.bookingAddressLabel.trim() : '',
      addressPlaceholder:
        typeof config.bookingAddressPlaceholder === 'string'
          ? config.bookingAddressPlaceholder.trim()
          : '',
      addressHelp: typeof config.bookingAddressHelp === 'string' ? config.bookingAddressHelp.trim() : '',
      addressRequired:
        typeof config.bookingAddressRequired === 'string'
          ? config.bookingAddressRequired.trim()
          : '',
      phoneLabel:
        typeof config.bookingPhoneLabel === 'string' && config.bookingPhoneLabel.trim()
          ? config.bookingPhoneLabel.trim()
          : DEFAULT_BOOKING_PHONE_LABEL,
      phoneHelp:
        typeof config.bookingPhoneHelp === 'string' && config.bookingPhoneHelp.trim()
          ? config.bookingPhoneHelp.trim()
          : DEFAULT_BOOKING_PHONE_HELP,
      phoneCountryCodeLabel:
        typeof config.bookingPhoneCountryCodeLabel === 'string' &&
        config.bookingPhoneCountryCodeLabel.trim()
          ? config.bookingPhoneCountryCodeLabel.trim()
          : DEFAULT_PHONE_COUNTRY_CODE_LABEL,
      phoneCountryCode:
        typeof config.bookingPhoneCountryCode === 'string'
          ? normalizePhoneCountryCode(config.bookingPhoneCountryCode)
          : '',
      phoneNumberPlaceholder:
        typeof config.bookingPhoneNumberPlaceholder === 'string' &&
        config.bookingPhoneNumberPlaceholder.trim()
          ? config.bookingPhoneNumberPlaceholder.trim()
          : DEFAULT_BOOKING_PHONE_PLACEHOLDER
    };

    serviceLocationLabel.textContent = bookingUiCopy.locationLabel;
    customerAddressLabel.textContent = bookingUiCopy.addressLabel;
    customerAddressInput.placeholder = bookingUiCopy.addressPlaceholder;
    customerAddressHelp.textContent = bookingUiCopy.addressHelp;
    customerPhoneLabel.textContent = bookingUiCopy.phoneLabel;
    customerPhoneCountryCodeInput.setAttribute(
      'aria-label',
      bookingUiCopy.phoneCountryCodeLabel || bookingUiCopy.phoneLabel
    );
    customerPhoneCountryCodeInput.placeholder = bookingUiCopy.phoneCountryCode;
    if (!customerPhoneCountryCodeInput.value.trim()) {
      customerPhoneCountryCodeInput.value = bookingUiCopy.phoneCountryCode;
    }
    customerPhoneInput.placeholder = bookingUiCopy.phoneNumberPlaceholder;
    customerPhoneHelp.textContent = bookingUiCopy.phoneHelp;
  };

  const getBookingCustomerPhoneValue = () => {
    const countryCodeValue = normalizePhoneCountryCode(customerPhoneCountryCodeInput.value);
    const phoneNumberValue = customerPhoneInput.value.trim();

    if (!phoneNumberValue) {
      return '';
    }

    if (phoneNumberValue.startsWith('+')) {
      return phoneNumberValue.replace(/\s+/g, '');
    }

    const normalizedPhoneNumber = phoneNumberValue.replace(/\s+/g, '');
    return `${countryCodeValue}${normalizedPhoneNumber}`.trim();
  };

  const setBookingCustomerPhoneValue = (phoneValue) => {
    const phoneParts = splitPhoneNumberParts(phoneValue, bookingUiCopy.phoneCountryCode);
    customerPhoneCountryCodeInput.value = phoneParts.countryCode;
    customerPhoneInput.value = phoneParts.number;
  };

  const getSelectedBookingLocation = () =>
    serviceLocationSelect.value || availableBookingLocations[0] || '';

  const getSelectedBookingLocationLabel = () =>
    bookingLocationLabelsByValue.get(getSelectedBookingLocation()) ?? '';

  const syncCustomerAddressVisibility = () => {
    const selectedBookingLocation = getSelectedBookingLocation();
    const shouldShowAddress =
      bookingUiCopy.addressLocationValue &&
      selectedBookingLocation === bookingUiCopy.addressLocationValue;

    customerAddressField.classList.toggle('is-hidden', !shouldShowAddress);
    customerAddressInput.required = shouldShowAddress;

    if (!shouldShowAddress) {
      customerAddressInput.value = '';
    }
  };

  const populateBookingLocations = (serviceLocations = []) => {
    availableBookingLocations = Array.isArray(serviceLocations)
      ? serviceLocations.filter((value) => typeof value === 'string' && value.trim())
      : [];
    bookingLocationLabelsByValue.clear();
    serviceLocationSelect.replaceChildren();

    for (const serviceLocation of availableBookingLocations) {
      const option = document.createElement('option');
      option.value = serviceLocation;
      const optionLabel = bookingUiCopy.locationLabels[serviceLocation] || serviceLocation;

      option.textContent = optionLabel;
      bookingLocationLabelsByValue.set(serviceLocation, optionLabel);
      serviceLocationSelect.append(option);
    }

    const defaultBookingLocation = availableBookingLocations.includes(bookingUiCopy.defaultLocationValue)
      ? bookingUiCopy.defaultLocationValue
      : availableBookingLocations[0] ?? '';

    serviceLocationSelect.value = defaultBookingLocation;
    serviceLocationField.classList.toggle('is-hidden', availableBookingLocations.length <= 1);
    syncCustomerAddressVisibility();
  };

  if (
    !(bookingForm instanceof HTMLFormElement) ||
    !(businessName instanceof HTMLElement) ||
    !(businessCopy instanceof HTMLParagraphElement) ||
    !(serviceTypes instanceof HTMLElement) ||
    !(teamMemberField instanceof HTMLElement) ||
    !(teamMemberSelect instanceof HTMLSelectElement) ||
    !(serviceSelect instanceof HTMLSelectElement) ||
    !(dateInput instanceof HTMLInputElement) ||
    !(timeSelect instanceof HTMLSelectElement) ||
    !(customerNameInput instanceof HTMLInputElement) ||
    !(customerPhoneLabel instanceof HTMLElement) ||
    !(customerPhoneCountryCodeInput instanceof HTMLInputElement) ||
    !(customerPhoneInput instanceof HTMLInputElement) ||
    !(customerPhoneHelp instanceof HTMLElement) ||
    !(customerEmailInput instanceof HTMLInputElement) ||
    !(phoneHistoryPanel instanceof HTMLDivElement) ||
    !(phoneHistoryList instanceof HTMLDivElement) ||
    !(benefitsPanel instanceof HTMLDivElement) ||
    !(benefitsList instanceof HTMLDivElement) ||
    !(benefitField instanceof HTMLElement) ||
    !(benefitSelect instanceof HTMLSelectElement) ||
    !(serviceLocationField instanceof HTMLElement) ||
    !(serviceLocationLabel instanceof HTMLElement) ||
    !(serviceLocationSelect instanceof HTMLSelectElement) ||
    !(customerAddressField instanceof HTMLElement) ||
    !(customerAddressLabel instanceof HTMLElement) ||
    !(customerAddressInput instanceof HTMLTextAreaElement) ||
    !(customerAddressHelp instanceof HTMLElement) ||
    !(bookingFooterPhoneRow instanceof HTMLElement) ||
    !(bookingFooterPhoneLink instanceof HTMLAnchorElement) ||
    !(bookingFooterWebsiteRow instanceof HTMLElement) ||
    !(bookingFooterWebsiteLink instanceof HTMLAnchorElement) ||
    !(bookingFooterAddressRow instanceof HTMLElement) ||
    !(bookingFooterAddressText instanceof HTMLParagraphElement) ||
    !(waitlistPanel instanceof HTMLDivElement) ||
    !(waitlistCopy instanceof HTMLParagraphElement) ||
    !(waitlistButton instanceof HTMLButtonElement) ||
    !(summaryBusinessName instanceof HTMLParagraphElement) ||
    !(summaryTitle instanceof HTMLElement) ||
    !(summaryCopy instanceof HTMLParagraphElement) ||
    !(successPanel instanceof HTMLDivElement) ||
    !(successCopy instanceof HTMLParagraphElement) ||
    !(reviewForm instanceof HTMLFormElement) ||
    !(reviewReferenceInput instanceof HTMLInputElement) ||
    !(reviewRatingInput instanceof HTMLInputElement) ||
    !(reviewStars instanceof HTMLDivElement) ||
    !(reviewSuccessPanel instanceof HTMLDivElement) ||
    !(reviewSuccessCopy instanceof HTMLParagraphElement)
  ) {
    return;
  }

  const businessId = getBookingClientIdFromPath();

  if (!businessId) {
    safeAlert('Booking link is invalid');
    return;
  }

  const currentBookingSource = getPublicBookingSource();
  const currentWaitlistClaim = getPublicWaitlistClaim();
  const today = new Date();
  dateInput.value = today.toISOString().slice(0, 10);
  dateInput.min = today.toISOString().slice(0, 10);

  const buildWaitlistClaimQuery = () => {
    if (!currentWaitlistClaim.waitlistEntryId || !currentWaitlistClaim.waitlistOfferToken) {
      return '';
    }

    return `&waitlistEntryId=${encodeURIComponent(currentWaitlistClaim.waitlistEntryId)}&waitlistOfferToken=${encodeURIComponent(currentWaitlistClaim.waitlistOfferToken)}`;
  };

  const getWaitlistSignature = () =>
    [
      serviceSelect.value,
      teamMemberSelect.value,
      dateInput.value,
      timeSelect.value,
      normalizePhoneForLookup(getBookingCustomerPhoneValue())
    ].join('::');

  const populateTeamMembers = (teamMembers) => {
    teamMembersById.clear();
    teamMemberSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent =
      Array.isArray(teamMembers) && teamMembers.length > 0
        ? 'Any available team member'
        : 'Any available team member';
    teamMemberSelect.append(placeholder);

    if (!Array.isArray(teamMembers) || teamMembers.length === 0) {
      teamMemberField.classList.add('is-hidden');
      teamMemberSelect.required = false;
      teamMemberSelect.disabled = true;
      return;
    }

    teamMemberField.classList.remove('is-hidden');
    teamMemberSelect.required = false;
    teamMemberSelect.disabled = false;

    for (const teamMember of teamMembers) {
      teamMembersById.set(teamMember.id, teamMember);
      const option = document.createElement('option');
      option.value = teamMember.id;
      option.textContent = teamMember.role
        ? `${teamMember.name} - ${teamMember.role}`
        : teamMember.name;
      teamMemberSelect.append(option);
    }

    teamMemberSelect.value = '';
  };

  const applyCustomerHistoryAutofill = (normalizedPhone, latestHistoryItem) => {
    if (!latestHistoryItem) {
      return;
    }

    const shouldAutofillName =
      !customerNameInput.value.trim() ||
      (lastAutofilledPhone === normalizedPhone &&
        customerNameInput.value.trim() === lastAutofilledName);
    const shouldAutofillEmail =
      !customerEmailInput.value.trim() ||
      (lastAutofilledPhone === normalizedPhone &&
        customerEmailInput.value.trim() === lastAutofilledEmail);

    if (shouldAutofillName && latestHistoryItem.customerName) {
      customerNameInput.value = latestHistoryItem.customerName;
      lastAutofilledName = latestHistoryItem.customerName;
    }

    if (shouldAutofillEmail && latestHistoryItem.customerEmail) {
      customerEmailInput.value = latestHistoryItem.customerEmail;
      lastAutofilledEmail = latestHistoryItem.customerEmail;
    }

    lastAutofilledPhone = normalizedPhone;
  };

  const renderPhoneHistory = async (phoneValue) => {
    const normalizedPhone = normalizePhoneForLookup(phoneValue);
    phoneHistoryList.replaceChildren();

    if (!normalizedPhone) {
      phoneHistoryPanel.classList.add('is-hidden');
      lastAutofilledPhone = '';
      return;
    }

    const requestId = ++phoneHistoryRequestCounter;

    try {
      const payload = await apiRequest(
        `/api/public/book/${businessId}/history?phone=${encodeURIComponent(phoneValue.trim())}`
      );

      if (requestId !== phoneHistoryRequestCounter) {
        return;
      }

      const matchingHistory = Array.isArray(payload.history) ? payload.history : [];

      if (matchingHistory.length === 0) {
        phoneHistoryPanel.classList.add('is-hidden');
        return;
      }

      phoneHistoryPanel.classList.remove('is-hidden');
      applyCustomerHistoryAutofill(normalizedPhone, matchingHistory[0]);

      for (const entry of matchingHistory) {
        const item = document.createElement('article');
        item.className = 'booking-history-item';

        const title = document.createElement('strong');
        title.textContent = `${entry.serviceName} â€¢ ${entry.status}`;

        const meta = document.createElement('p');
        meta.textContent = `${formatDateTimeForDisplay(entry.appointmentDate, entry.appointmentTime)} â€¢ Ref: ${entry.reference}`;

        item.append(title, meta);
        phoneHistoryList.append(item);
      }
    } catch {
      if (requestId !== phoneHistoryRequestCounter) {
        return;
      }

      phoneHistoryPanel.classList.add('is-hidden');
    }
  };

  const getSelectedBenefit = () => benefitOptionsByValue.get(benefitSelect.value) ?? null;

  const renderBenefits = async (phoneValue) => {
    const normalizedPhone = normalizePhoneForLookup(phoneValue);
    benefitsList.replaceChildren();
    benefitOptionsByValue.clear();
    benefitSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = 'No saved benefit';
    benefitSelect.append(placeholder);

    if (!normalizedPhone) {
      benefitsPanel.classList.add('is-hidden');
      benefitField.classList.add('is-hidden');
      return;
    }

    const requestId = ++benefitsRequestCounter;

    try {
      const payload = await apiRequest(
        `/api/public/book/${businessId}/benefits?phone=${encodeURIComponent(phoneValue.trim())}`
      );

      if (requestId !== benefitsRequestCounter) {
        return;
      }

      const benefits = Array.isArray(payload.benefits) ? payload.benefits : [];

      if (benefits.length === 0) {
        benefitsPanel.classList.add('is-hidden');
        benefitField.classList.add('is-hidden');
        return;
      }

      benefitsPanel.classList.remove('is-hidden');
      benefitField.classList.remove('is-hidden');

      for (const benefit of benefits) {
        const benefitKey = `${benefit.type}:${benefit.id}`;
        benefitOptionsByValue.set(benefitKey, benefit);

        const option = document.createElement('option');
        option.value = benefitKey;
        option.textContent = `${benefit.title} - ${benefit.description}`;
        benefitSelect.append(option);

        const item = document.createElement('article');
        item.className = 'booking-history-item';

        const title = document.createElement('strong');
        title.textContent = benefit.title;

        const meta = document.createElement('p');
        meta.textContent = benefit.description;

        item.append(title, meta);
        benefitsList.append(item);
      }
    } catch {
      if (requestId !== benefitsRequestCounter) {
        return;
      }

      benefitsPanel.classList.add('is-hidden');
      benefitField.classList.add('is-hidden');
    }
  };

  const updateBookingSummary = () => {
    const selectedService = servicesByName.get(serviceSelect.value);
    const selectedTeamMember = teamMembersById.get(teamMemberSelect.value);
    const selectedBenefit = getSelectedBenefit();
    const serviceLabel = selectedService?.name || '';
    const teamMemberLabel = selectedTeamMember?.name || '';
    const salonLabel = currentBusinessName;
    const salonSummaryLabel = [salonLabel, currentBusinessPhoneNumber].filter(Boolean).join(' | ');
    const formattedDateTime = formatDateTimeForDisplay(dateInput.value, timeSelect.value);
    const selectedBookingLocation = getSelectedBookingLocation();
    const selectedBookingLocationLabel = getSelectedBookingLocationLabel();
    const customerAddressValue = customerAddressInput.value.trim();
    const bookingLocationSummary =
      bookingUiCopy.addressLocationValue &&
      selectedBookingLocation === bookingUiCopy.addressLocationValue &&
      customerAddressValue
        ? `${selectedBookingLocationLabel}: ${customerAddressValue}. `
        : selectedBookingLocationLabel
          ? `${selectedBookingLocationLabel}. `
          : '';

    if (!serviceLabel && !formattedDateTime) {
      summaryTitle.textContent = 'Choose a service to begin';
      summaryCopy.textContent =
        'Select a service, day, and time to see your appointment details here.';
      return;
    }

    if (serviceLabel && !formattedDateTime) {
      const summaryPriceLabel = selectedService?.priceLabel ?? '';
      summaryTitle.textContent = `${serviceLabel} â€¢ ${selectedService?.priceLabel ?? ''}`.trim();
      if (salonSummaryLabel) {
        summaryTitle.textContent = `${serviceLabel} at ${salonSummaryLabel}${summaryPriceLabel ? ` | ${summaryPriceLabel}` : ''}`.trim();
      }
      summaryCopy.textContent = selectedService
        ? `${selectedService.durationMinutes} min service${teamMemberLabel ? ` with ${teamMemberLabel}` : ''}${salonSummaryLabel ? ` at ${salonSummaryLabel}` : ''}. ${bookingLocationSummary}${selectedBenefit ? `Benefit selected: ${selectedBenefit.title}. ` : ''}Now choose the best day and time for your appointment.`
        : 'Now choose the best day and time for your appointment.';
      return;
    }

    summaryTitle.textContent =
      serviceLabel && selectedService?.priceLabel
        ? `${serviceLabel} â€¢ ${selectedService.priceLabel}`
        : serviceLabel || 'Appointment selected';
    if (salonSummaryLabel && serviceLabel) {
      summaryTitle.textContent = `${serviceLabel} at ${salonSummaryLabel}${selectedService?.priceLabel ? ` | ${selectedService.priceLabel}` : ''}`.trim();
    }
    summaryCopy.textContent = formattedDateTime
      ? `${selectedService?.durationMinutes ? `${selectedService.durationMinutes} min service${teamMemberLabel ? ` with ${teamMemberLabel}` : ''}${salonSummaryLabel ? ` at ${salonSummaryLabel}` : ''}. ` : ''}${bookingLocationSummary}${selectedBenefit ? `${selectedBenefit.title} will be applied. ` : ''}Your booking is planned for ${formattedDateTime}.`
      : 'Choose the best available time for your appointment.';
  };

  const renderWaitlistPanel = (slots = []) => {
    const selectedService = servicesByName.get(serviceSelect.value);
    const selectedTeamMember = teamMembersById.get(teamMemberSelect.value);
    const matchingSavedWaitlist = savedWaitlistSignature === getWaitlistSignature();

    if (activeWaitlistOffer) {
      waitlistPanel.classList.remove('is-hidden');
      waitlistButton.classList.add('is-hidden');
      waitlistCopy.textContent =
        `A waitlist slot is reserved for ${activeWaitlistOffer.serviceName} on ${formatDateTimeForDisplay(activeWaitlistOffer.appointmentDate, activeWaitlistOffer.appointmentTime)}.` +
        `${activeWaitlistOffer.teamMemberName ? ` Team member: ${activeWaitlistOffer.teamMemberName}.` : ''} ` +
        `Complete your booking before ${formatTimeForDisplay(new Date(activeWaitlistOffer.offerExpiresAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }))}.`;
      return;
    }

    if (matchingSavedWaitlist) {
      waitlistPanel.classList.remove('is-hidden');
      waitlistButton.classList.remove('is-hidden');
      waitlistButton.disabled = true;
      waitlistButton.textContent = 'Waitlist saved';
      waitlistCopy.textContent =
        `You are on the waitlist for ${selectedService?.name ?? 'this service'} on ${formatDateForDisplay(dateInput.value)}.` +
        `${selectedTeamMember?.name ? ` Preferred team member: ${selectedTeamMember.name}.` : ''}`;
      return;
    }

    if (!selectedService || !dateInput.value || slots.length > 0) {
      waitlistPanel.classList.add('is-hidden');
      waitlistButton.classList.remove('is-hidden');
      waitlistButton.disabled = false;
      waitlistButton.textContent = 'Join waitlist';
      return;
    }

    waitlistPanel.classList.remove('is-hidden');
    waitlistButton.classList.remove('is-hidden');
    waitlistButton.disabled =
      !customerNameInput.value.trim() || !normalizePhoneForLookup(getBookingCustomerPhoneValue());
    waitlistButton.textContent = 'Join waitlist';
    waitlistCopy.textContent =
      `No live slots are available for ${selectedService.name} on ${formatDateForDisplay(dateInput.value)}.` +
      `${selectedTeamMember?.name ? ` We will try to match ${selectedTeamMember.name} if that slot opens.` : ''} ` +
      'Join the waitlist to get a text message if a cancellation creates space.';
  };

  const setReviewRating = (rating) => {
    const normalizedRating = Number(rating) || 0;
    reviewRatingInput.value = normalizedRating > 0 ? String(normalizedRating) : '';

    for (const button of reviewStars.querySelectorAll('.booking-star-button')) {
      if (!(button instanceof HTMLButtonElement)) {
        continue;
      }

      const buttonRating = Number(button.dataset.rating);
      const isActive = buttonRating <= normalizedRating;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-checked', isActive ? 'true' : 'false');
    }
  };

  const populateSlots = async () => {
    if (!dateInput.value) {
      return;
    }

    try {
      const payload = await apiRequest(
        `/api/public/book/${businessId}/slots?date=${encodeURIComponent(dateInput.value)}${serviceSelect.value ? `&serviceName=${encodeURIComponent(serviceSelect.value)}` : ''}${teamMemberSelect.value ? `&teamMemberId=${encodeURIComponent(teamMemberSelect.value)}` : ''}${buildWaitlistClaimQuery()}`
      );

      timeSelect.replaceChildren();

      const placeholder = document.createElement('option');
      placeholder.value = '';
      placeholder.textContent = payload.slots.length > 0 ? 'Select a time' : 'No slots available';
      timeSelect.append(placeholder);

      for (const slot of payload.slots) {
        const option = document.createElement('option');
        option.value = slot;
        option.textContent = formatTimeForDisplay(slot);
        timeSelect.append(option);
      }

      if (payload.slots.length > 0) {
        timeSelect.value = payload.slots[0];
      }

      renderWaitlistPanel(payload.slots);
      updateBookingSummary();
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load available slots');
    }
  };

  loadPublicConfig()
    .then((config) => {
      syncBookingUiCopy(config ?? {});
      if (availableBookingLocations.length > 0) {
        populateBookingLocations(availableBookingLocations);
        updateBookingSummary();
      }
      bookingHeadingFallback =
        config?.supportPlatformName?.trim() || config?.supportCompanyName?.trim() || '';
      syncBookingHero();
    })
    .catch(() => {
      bookingHeadingFallback = '';
    });

  apiRequest(
    `/api/public/book/${businessId}${
      currentWaitlistClaim.waitlistEntryId && currentWaitlistClaim.waitlistOfferToken
        ? `?waitlistEntryId=${encodeURIComponent(currentWaitlistClaim.waitlistEntryId)}&waitlistOfferToken=${encodeURIComponent(currentWaitlistClaim.waitlistOfferToken)}`
        : ''
    }`
  )
    .then(async (payload) => {
      currentBusinessName =
        typeof payload.businessName === 'string' ? payload.businessName.trim() : '';
      currentBusinessPhoneNumber = typeof payload.businessPhoneNumber === 'string' ? payload.businessPhoneNumber.trim() : '';
      syncBookingHero();
      syncBookingFooter(payload);
      serviceTypes.textContent =
        payload.serviceTypes.length > 0 ? payload.serviceTypes.join(' | ') : 'Salon services';
      populateBookingLocations(payload.serviceLocations);
      populateTeamMembers(payload.teamMembers);

      for (const service of payload.services) {
        servicesByName.set(service.name, service);
        const option = document.createElement('option');
        option.value = service.name;
        option.textContent = `${service.name} - ${service.durationMinutes} min - ${service.priceLabel}`;
        serviceSelect.append(option);
      }

      if (payload.services.length > 0) {
        serviceSelect.value = payload.services[0].name;
      }

      activeWaitlistOffer = payload.waitlistOffer ?? null;

      if (activeWaitlistOffer) {
        serviceSelect.value = activeWaitlistOffer.serviceName;
        dateInput.value = activeWaitlistOffer.appointmentDate;

        if (activeWaitlistOffer.teamMemberId) {
          teamMemberSelect.value = activeWaitlistOffer.teamMemberId;
        }
      }

      await populateSlots();

      if (activeWaitlistOffer?.appointmentTime) {
        timeSelect.value = activeWaitlistOffer.appointmentTime;
      }

      updateBookingSummary();
      setReviewRating(0);
      await renderPhoneHistory(getBookingCustomerPhoneValue());
      await renderBenefits(getBookingCustomerPhoneValue());
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load booking page');
    });

  const refreshBookingPhoneDetails = () => {
    const bookingPhoneValue = getBookingCustomerPhoneValue();
    void renderPhoneHistory(bookingPhoneValue);
    void renderBenefits(bookingPhoneValue);
    renderWaitlistPanel(
      [...timeSelect.options]
        .map((option) => option.value)
        .filter(Boolean)
    );
  };

  dateInput.addEventListener('change', async () => {
    await populateSlots();
  });

  customerPhoneCountryCodeInput.addEventListener('input', refreshBookingPhoneDetails);

  customerPhoneInput.addEventListener('input', () => {
    refreshBookingPhoneDetails();
  });

  serviceSelect.addEventListener('change', async () => {
    try {
      await populateSlots();
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load available slots');
    }
  });

  teamMemberSelect.addEventListener('change', async () => {
    try {
      await populateSlots();
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load available slots');
    }
  });

  serviceLocationSelect.addEventListener('change', () => {
    syncCustomerAddressVisibility();
    updateBookingSummary();
  });

  customerAddressInput.addEventListener('input', () => {
    updateBookingSummary();
  });

  timeSelect.addEventListener('change', () => {
    renderWaitlistPanel(
      [...timeSelect.options]
        .map((option) => option.value)
        .filter(Boolean)
    );
    updateBookingSummary();
  });

  benefitSelect.addEventListener('change', () => {
    updateBookingSummary();
  });

  customerNameInput.addEventListener('input', () => {
    renderWaitlistPanel(
      [...timeSelect.options]
        .map((option) => option.value)
        .filter(Boolean)
    );
  });

  waitlistButton.addEventListener('click', async () => {
    try {
      const payload = await apiRequest(`/api/public/book/${businessId}/waitlist`, {
        method: 'POST',
        body: JSON.stringify({
          serviceName: serviceSelect.value,
          teamMemberId: teamMemberSelect.value,
          appointmentDate: dateInput.value,
          preferredTime: timeSelect.value,
          customerName: customerNameInput.value.trim(),
          customerPhone: getBookingCustomerPhoneValue(),
          customerEmail: customerEmailInput.value.trim(),
          source: currentBookingSource
        })
      });

      savedWaitlistSignature = getWaitlistSignature();
      successPanel.classList.remove('is-hidden');
      successCopy.textContent =
        `You joined the waitlist for ${payload.waitlistEntry.serviceName} on ${formatDateForDisplay(payload.waitlistEntry.appointmentDate)}.` +
        `${payload.waitlistEntry.teamMemberName ? ` Preferred team member: ${payload.waitlistEntry.teamMemberName}.` : ''} ` +
        'We will send you a booking link if a matching slot opens.';
      renderWaitlistPanel(
        [...timeSelect.options]
          .map((option) => option.value)
          .filter(Boolean)
      );
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to join the waitlist');
    }
  });

  bookingForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const selectedBookingLocation = getSelectedBookingLocation();
      const customerAddressValue = customerAddressInput.value.trim();
      const customerPhoneValue = getBookingCustomerPhoneValue();

      if (
        bookingUiCopy.addressLocationValue &&
        selectedBookingLocation === bookingUiCopy.addressLocationValue &&
        !customerAddressValue
      ) {
        safeAlert(bookingUiCopy.addressRequired);
        customerAddressInput.focus();
        return;
      }

      const selectedBenefit = getSelectedBenefit();
      const payload = await apiRequest(`/api/public/book/${businessId}/appointments`, {
        method: 'POST',
        body: JSON.stringify({
          serviceName: serviceSelect.value,
          teamMemberId: teamMemberSelect.value,
          serviceLocation: selectedBookingLocation,
          customerAddress: customerAddressValue,
          appointmentDate: dateInput.value,
          appointmentTime: timeSelect.value,
          customerName: customerNameInput.value.trim(),
          customerPhone: customerPhoneValue,
          customerEmail: customerEmailInput.value.trim(),
          source: currentBookingSource,
          packagePurchaseId: selectedBenefit?.type === 'package' ? selectedBenefit.id : '',
          loyaltyRewardId: selectedBenefit?.type === 'loyalty' ? selectedBenefit.id : '',
          waitlistEntryId: currentWaitlistClaim.waitlistEntryId,
          waitlistOfferToken: currentWaitlistClaim.waitlistOfferToken
        })
      });

      successPanel.classList.remove('is-hidden');
      latestAppointmentReference = payload.appointment.id;
      reviewReferenceInput.value = latestAppointmentReference;
      successCopy.textContent = `Booked ${payload.appointment.serviceName}${payload.appointment.teamMemberName ? ` with ${payload.appointment.teamMemberName}` : ''} for ${formatDateTimeForDisplay(payload.appointment.appointmentDate, payload.appointment.appointmentTime)}.${payload.appointment.serviceLocation ? ` Service location: ${getSelectedBookingLocationLabel()}${payload.appointment.customerAddress ? ` (${payload.appointment.customerAddress})` : ''}.` : ''}${payload.appointment.packageName ? ` Package used: ${payload.appointment.packageName}.` : ''}${payload.appointment.loyaltyRewardLabel ? ` Reward used: ${payload.appointment.loyaltyRewardLabel}.` : ''} Reference: ${payload.appointment.id.slice(0, 8)}. Source: ${formatBookingSourceLabel(payload.appointment.source)}. SMS status: ${payload.notifications.map((entry) => `${entry.recipient} ${entry.status}`).join(', ')}.`;
      const bookedPhone = payload.appointment.customerPhone;
      activeWaitlistOffer = null;
      savedWaitlistSignature = '';
      bookingForm.reset();
      dateInput.value = today.toISOString().slice(0, 10);
      setBookingCustomerPhoneValue(bookedPhone);
      serviceLocationSelect.value = availableBookingLocations.includes(bookingUiCopy.defaultLocationValue)
        ? bookingUiCopy.defaultLocationValue
        : availableBookingLocations[0] ?? '';
      syncCustomerAddressVisibility();
      if (!teamMemberSelect.disabled && teamMemberSelect.options.length > 1) {
        teamMemberSelect.value = teamMemberSelect.options[1].value;
      }
      await populateSlots();
      updateBookingSummary();
      await renderPhoneHistory(getBookingCustomerPhoneValue());
      await renderBenefits(getBookingCustomerPhoneValue());
      successPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to create appointment');
    }
  });

  for (const button of reviewStars.querySelectorAll('.booking-star-button')) {
    if (!(button instanceof HTMLButtonElement)) {
      continue;
    }

    button.addEventListener('click', () => {
      setReviewRating(button.dataset.rating);
      reviewForm.requestSubmit();
    });
  }

  reviewForm.addEventListener('submit', async (event) => {
    event.preventDefault();

    try {
      const rating = Number(reviewRatingInput.value);

      if (!rating) {
        safeAlert('Please select a star rating');
        return;
      }

      if (!reviewReferenceInput.value.trim()) {
        safeAlert('Please book an appointment first');
        return;
      }

      const payload = await apiRequest(`/api/public/book/${businessId}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          appointmentId: reviewReferenceInput.value.trim(),
          customerPhone: getBookingCustomerPhoneValue(),
          rating
        })
      });

      reviewSuccessPanel.classList.remove('is-hidden');
      reviewSuccessCopy.textContent = `Thanks. Your ${payload.review.rating}-star review is now visible on this salon page.`;
      reviewForm.reset();
      reviewReferenceInput.value = latestAppointmentReference;
      setReviewRating(0);
      reviewSuccessPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to submit review');
    }
  });
};

const initManageBooking = () => {
  const title = document.querySelector('#manage-booking-title');
  const copy = document.querySelector('#manage-booking-copy');
  const summaryTitle = document.querySelector('#manage-booking-summary-title');
  const summaryCopy = document.querySelector('#manage-booking-summary-copy');
  const countdownLabel = document.querySelector('#manage-booking-countdown-label');
  const countdownHeading = document.querySelector('#manage-booking-countdown-heading');
  const countdownCopy = document.querySelector('#manage-booking-countdown-copy');
  const countdownDays = document.querySelector('#manage-booking-countdown-days');
  const countdownHours = document.querySelector('#manage-booking-countdown-hours');
  const countdownMinutes = document.querySelector('#manage-booking-countdown-minutes');
  const countdownSeconds = document.querySelector('#manage-booking-countdown-seconds');
  const status = document.querySelector('#manage-booking-status');
  const form = document.querySelector('#manage-booking-form');
  const dateInput = document.querySelector('#manage-booking-date');
  const timeSelect = document.querySelector('#manage-booking-time');
  const cancelButton = document.querySelector('#manage-booking-cancel');
  const successPanel = document.querySelector('#manage-booking-success');
  const successCopy = document.querySelector('#manage-booking-success-copy');

  if (
    !(title instanceof HTMLElement) ||
    !(copy instanceof HTMLParagraphElement) ||
    !(summaryTitle instanceof HTMLElement) ||
    !(summaryCopy instanceof HTMLParagraphElement) ||
    !(countdownLabel instanceof HTMLElement) ||
    !(countdownHeading instanceof HTMLElement) ||
    !(countdownCopy instanceof HTMLParagraphElement) ||
    !(countdownDays instanceof HTMLElement) ||
    !(countdownHours instanceof HTMLElement) ||
    !(countdownMinutes instanceof HTMLElement) ||
    !(countdownSeconds instanceof HTMLElement) ||
    !(status instanceof HTMLDivElement) ||
    !(form instanceof HTMLFormElement) ||
    !(dateInput instanceof HTMLInputElement) ||
    !(timeSelect instanceof HTMLSelectElement) ||
    !(cancelButton instanceof HTMLButtonElement) ||
    !(successPanel instanceof HTMLDivElement) ||
    !(successCopy instanceof HTMLParagraphElement)
  ) {
    return;
  }

  const bookingRoute = getManagedBookingFromPath();

  if (!bookingRoute) {
    return;
  }

  const { businessId, appointmentId, accessToken } = bookingRoute;
  const today = new Date().toISOString().slice(0, 10);
  const requestedAction = new URLSearchParams(window.location.search).get('action');
  let appointmentDetails = null;
  let countdownIntervalId = null;

  dateInput.min = today;

  const setStatus = (message, variant = '') => {
    status.textContent = message;
    status.className = variant ? `manage-booking-status is-${variant}` : 'manage-booking-status';
  };

  const setFormDisabled = (disabled) => {
    dateInput.disabled = disabled;
    timeSelect.disabled = disabled;
    cancelButton.disabled = disabled;
  };

  const setCountdownValues = (days, hours, minutes, seconds) => {
    countdownDays.textContent = String(days).padStart(2, '0');
    countdownHours.textContent = String(hours).padStart(2, '0');
    countdownMinutes.textContent = String(minutes).padStart(2, '0');
    countdownSeconds.textContent = String(seconds).padStart(2, '0');
  };

  const stopCountdown = () => {
    if (countdownIntervalId) {
      window.clearInterval(countdownIntervalId);
      countdownIntervalId = null;
    }
  };

  const syncCountdown = () => {
    if (!appointmentDetails) {
      countdownLabel.textContent = 'Live appointment timer';
      countdownHeading.textContent = 'Loading countdown...';
      countdownCopy.textContent =
        'Open this link anytime to see how long is left before your appointment starts.';
      setCountdownValues(0, 0, 0, 0);
      return;
    }

    const appointmentStart = new Date(
      `${appointmentDetails.appointmentDate}T${appointmentDetails.appointmentTime}:00`
    );

    if (Number.isNaN(appointmentStart.getTime())) {
      countdownLabel.textContent = 'Live appointment timer';
      countdownHeading.textContent = 'Countdown unavailable';
      countdownCopy.textContent =
        'We could not calculate the appointment timer for this booking.';
      setCountdownValues(0, 0, 0, 0);
      return;
    }

    if (appointmentDetails.status === 'cancelled') {
      countdownLabel.textContent = 'Booking status';
      countdownHeading.textContent = 'This appointment was cancelled';
      countdownCopy.textContent =
        'The timer stops here because this booking is no longer active.';
      setCountdownValues(0, 0, 0, 0);
      return;
    }

    if (appointmentDetails.status === 'completed') {
      countdownLabel.textContent = 'Booking status';
      countdownHeading.textContent = 'This appointment is completed';
      countdownCopy.textContent =
        'Your visit has already been marked as finished by the business.';
      setCountdownValues(0, 0, 0, 0);
      return;
    }

    const diffMs = appointmentStart.getTime() - Date.now();

    if (diffMs <= 0) {
      countdownLabel.textContent = 'Appointment status';
      countdownHeading.textContent = 'It is time for your appointment';
      countdownCopy.textContent =
        'Your scheduled start time has arrived. If plans changed, you can still manage the booking below.';
      setCountdownValues(0, 0, 0, 0);
      return;
    }

    const totalSeconds = Math.floor(diffMs / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    countdownLabel.textContent = 'Live appointment timer';
    countdownHeading.textContent = `Starts in ${days > 0 ? `${days}d ` : ''}${hours}h ${minutes}m`;
    countdownCopy.textContent =
      `Counting down to ${formatDateTimeForDisplay(appointmentDetails.appointmentDate, appointmentDetails.appointmentTime)}.` +
      `${appointmentDetails.teamMemberName ? ` Appointment with ${appointmentDetails.teamMemberName}.` : ''}`;
    setCountdownValues(days, hours, minutes, seconds);
  };

  const startCountdown = () => {
    stopCountdown();
    syncCountdown();
    countdownIntervalId = window.setInterval(syncCountdown, 1000);
  };

  if (!accessToken) {
    setStatus('This booking link is no longer valid. Open the latest manage link you received.', 'warning');
    setFormDisabled(true);
    stopCountdown();
    syncCountdown();
    return;
  }

  const loadSlots = async (preferredTime = '') => {
    if (!dateInput.value) {
      return;
    }

    const payload = await apiRequest(
      `/api/public/book/${businessId}/slots?date=${encodeURIComponent(dateInput.value)}&excludeAppointmentId=${encodeURIComponent(appointmentId)}&accessToken=${encodeURIComponent(accessToken)}${appointmentDetails?.serviceName ? `&serviceName=${encodeURIComponent(appointmentDetails.serviceName)}` : ''}${appointmentDetails?.teamMemberId ? `&teamMemberId=${encodeURIComponent(appointmentDetails.teamMemberId)}` : ''}`
    );

    timeSelect.replaceChildren();

    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = payload.slots.length > 0 ? 'Select a time' : 'No slots available';
    timeSelect.append(placeholder);

    for (const slot of payload.slots) {
      const option = document.createElement('option');
      option.value = slot;
      option.textContent = formatTimeForDisplay(slot);
      timeSelect.append(option);
    }

    const nextTimeValue = payload.slots.includes(preferredTime)
      ? preferredTime
      : payload.slots[0] ?? '';
    timeSelect.value = nextTimeValue;
  };

  const hydrateAppointment = async () => {
    const payload = await apiRequest(
      `/api/public/book/${businessId}/appointments/${encodeURIComponent(appointmentId)}?accessToken=${encodeURIComponent(accessToken)}`
    );

    appointmentDetails = payload.appointment;
    title.textContent = `Manage your appointment at ${payload.appointment.businessName}`;
    copy.textContent = `Booking for ${payload.appointment.customerName}. You can reschedule or cancel it below.`;
    summaryTitle.textContent = `${payload.appointment.serviceName}${payload.appointment.teamMemberName ? ` with ${payload.appointment.teamMemberName}` : ''}`;
    summaryCopy.textContent = `Currently planned for ${formatDateTimeForDisplay(payload.appointment.appointmentDate, payload.appointment.appointmentTime)}. Reference: ${payload.appointment.id.slice(0, 8)}.`;
    dateInput.value = payload.appointment.appointmentDate;
    startCountdown();
    await loadSlots(payload.appointment.appointmentTime);

    if (payload.appointment.status !== 'booked') {
      setStatus(`This appointment is already ${payload.appointment.status}.`, 'muted');
      setFormDisabled(true);
      return;
    }

    setFormDisabled(false);
    setStatus(
      requestedAction === 'cancel'
        ? 'Cancel option is ready below. Review carefully before confirming.'
        : 'Choose a new date or time if you need to reschedule.',
      requestedAction === 'cancel' ? 'warning' : 'info'
    );
  };

  dateInput.addEventListener('change', async () => {
    try {
      await loadSlots(timeSelect.value);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to load available slots');
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!appointmentDetails || appointmentDetails.status !== 'booked') {
      return;
    }

    try {
      const payload = await apiRequest(
        `/api/public/book/${businessId}/appointments/${encodeURIComponent(appointmentId)}/reschedule`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            accessToken,
            appointmentDate: dateInput.value,
            appointmentTime: timeSelect.value
          })
        }
      );

      appointmentDetails = payload.appointment;
      summaryCopy.textContent = `Currently planned for ${formatDateTimeForDisplay(payload.appointment.appointmentDate, payload.appointment.appointmentTime)}. Reference: ${payload.appointment.id.slice(0, 8)}.`;
      successPanel.classList.remove('is-hidden');
      successCopy.textContent = `Your appointment has been moved to ${formatDateTimeForDisplay(payload.appointment.appointmentDate, payload.appointment.appointmentTime)}. SMS status: ${Array.isArray(payload.notifications) ? payload.notifications.map((entry) => `${entry.recipient} ${entry.status}`).join(', ') : 'updated'}.`;
      setStatus('Appointment rescheduled successfully.', 'success');
      startCountdown();
      await loadSlots(payload.appointment.appointmentTime);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to reschedule appointment');
    }
  });

  cancelButton.addEventListener('click', async () => {
    if (!appointmentDetails || appointmentDetails.status !== 'booked') {
      return;
    }

    try {
      const payload = await apiRequest(
        `/api/public/book/${businessId}/appointments/${encodeURIComponent(appointmentId)}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ accessToken })
        }
      );

      appointmentDetails = payload.appointment;
      setFormDisabled(true);
      successPanel.classList.remove('is-hidden');
      successCopy.textContent = 'Your appointment has been cancelled.';
      setStatus('Appointment cancelled.', 'warning');
      summaryCopy.textContent = `This appointment was cancelled. Reference: ${payload.appointment.id.slice(0, 8)}.`;
      syncCountdown();
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to cancel appointment');
    }
  });

  hydrateAppointment().catch((error) => {
    safeAlert(error instanceof Error ? error.message : 'Unable to load appointment');
  });
};

const initSetupGuide = () => {
  const backLink = document.querySelector('#setup-guide-back-link');
  const accountItem = document.querySelector('#setup-guide-account-item');
  const barberLink = document.querySelector('#setup-guide-barber-item');
  const serviceLink = document.querySelector('#setup-guide-service-item');
  const appointmentLink = document.querySelector('#setup-guide-booking-item');
  const checkoutLink = document.querySelector('#setup-guide-checkout-item');
  const skipLink = document.querySelector('#setup-guide-skip-link');

  if (
    !(backLink instanceof HTMLAnchorElement) ||
    !(accountItem instanceof HTMLElement) ||
    !(barberLink instanceof HTMLAnchorElement) ||
    !(serviceLink instanceof HTMLAnchorElement) ||
    !(appointmentLink instanceof HTMLAnchorElement) ||
    !(checkoutLink instanceof HTMLAnchorElement) ||
    !(skipLink instanceof HTMLAnchorElement)
  ) {
    return;
  }

  const clientId = getClientId();

  backLink.href = buildPathWithClientId('/calendar', clientId);
  barberLink.href = `${buildPathWithClientId('/calendar', clientId)}${clientId ? '&' : '?'}setup=team`;
  serviceLink.href = `${buildPathWithClientId('/calendar', clientId)}${clientId ? '&' : '?'}setup=services`;
  appointmentLink.href = buildPathWithClientId('/calendar', clientId);
  checkoutLink.href = buildPathWithClientId('/calendar', clientId);
  skipLink.href = buildPathWithClientId('/calendar', clientId);

  if (!clientId) {
    return;
  }

  const setSetupGuideItemState = (element, isComplete) => {
    element.classList.toggle('is-complete', isComplete);

    const end = element.querySelector('.setup-guide-item-end');

    if (!(end instanceof HTMLElement)) {
      return;
    }

    if (isComplete) {
      end.className = 'setup-guide-item-end is-success';
      end.innerHTML =
        '<svg viewBox="0 0 24 24" focusable="false"><path d="M5 12.5l4.2 4.2L19 7"></path></svg>';
      return;
    }

    end.className = 'setup-guide-item-end';
    end.innerHTML =
      '<svg viewBox="0 0 24 24" focusable="false"><path d="M9 6l6 6-6 6"></path></svg>';
  };

  apiRequest(`/api/platform/clients/${clientId}/dashboard`)
    .then((payload) => {
      const progress = getSetupGuideProgress(payload.client, payload.dashboard?.appointments);

      setSetupGuideItemState(accountItem, progress.account);
      setSetupGuideItemState(barberLink, progress.barber);
      setSetupGuideItemState(serviceLink, progress.services);
      setSetupGuideItemState(appointmentLink, progress.appointment);
      setSetupGuideItemState(checkoutLink, progress.checkout);
      skipLink.classList.toggle('is-hidden', progress.isAllComplete);
    })
    .catch(() => {});
};

const initOnboardingComplete = () => {
  const doneLink = document.querySelector('#onboarding-complete-done');

  if (!(doneLink instanceof HTMLAnchorElement)) {
    return;
  }

  doneLink.href = buildPathWithClientId('/calendar', getClientId());
};

const initPreferredLanguage = () => {
  const continueButton = document.querySelector('#preferred-language-continue');
  const grid = document.querySelector('#preferred-language-grid');

  if (!(continueButton instanceof HTMLAnchorElement) || !(grid instanceof HTMLElement)) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  let selectedPreferredLanguage = '';
  let cards = [];

  const buildPreferredLanguageCard = (languageOption) => {
    const card = document.createElement('button');
    card.className = 'account-type-card';
    card.type = 'button';
    card.dataset.preferredLanguage = languageOption.value;
    card.innerHTML = `
      <span class="account-type-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M4 12h16"></path>
          <path d="M12 4a12 12 0 000 16"></path>
          <path d="M12 4a12 12 0 010 16"></path>
        </svg>
      </span>
      <span>${escapeHtml(languageOption.label)}</span>
    `;

    card.addEventListener('click', () => {
      const preferredLanguage = card.dataset.preferredLanguage;

      if (preferredLanguage) {
        setSelectedCard(preferredLanguage);
      }
    });

    return card;
  };

  const updateContinue = () => {
    if (!selectedPreferredLanguage) {
      continueButton.classList.add('onboarding-continue-disabled');
      continueButton.setAttribute('aria-disabled', 'true');
      return;
    }

    continueButton.classList.remove('onboarding-continue-disabled');
    continueButton.setAttribute('aria-disabled', 'false');
  };

  const setSelectedCard = (preferredLanguage) => {
    selectedPreferredLanguage = preferredLanguage;

    for (const card of cards) {
      card.classList.toggle(
        'is-selected',
        card.dataset.preferredLanguage === preferredLanguage
      );
    }

    updateContinue();
  };

  continueButton.addEventListener('click', async (event) => {
    event.preventDefault();

    if (!selectedPreferredLanguage) {
      return;
    }

    try {
      await apiRequest(`/api/platform/clients/${clientId}/preferred-language`, {
        method: 'PATCH',
        body: JSON.stringify({ preferredLanguage: selectedPreferredLanguage })
      });

      await apiRequest(`/api/platform/clients/${clientId}/complete`, {
        method: 'POST',
        body: JSON.stringify({})
      });

      redirectTo('/onboarding/complete', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to save preferred language');
    }
  });

  Promise.all([
    loadPublicConfig(),
    apiRequest(`/api/platform/clients/${clientId}`)
  ])
    .then(([config, payload]) => {
      const preferredLanguages = Array.isArray(config?.preferredLanguages)
        ? config.preferredLanguages.filter(
            (languageOption) =>
              typeof languageOption?.value === 'string' &&
              languageOption.value.trim() &&
              typeof languageOption?.label === 'string' &&
              languageOption.label.trim()
          )
        : [];

      if (preferredLanguages.length === 0) {
        throw new Error('No preferred languages are configured');
      }

      grid.replaceChildren(
        ...preferredLanguages.map((languageOption) => buildPreferredLanguageCard(languageOption))
      );
      cards = Array.from(grid.querySelectorAll('[data-preferred-language]')).filter(
        (card) => card instanceof HTMLButtonElement
      );

      if (payload.client.preferredLanguage) {
        setSelectedCard(payload.client.preferredLanguage);
      } else {
        updateContinue();
      }
    })
    .catch((error) => {
      safeAlert(error instanceof Error ? error.message : 'Unable to load preferred language');
    });

  updateContinue();
};

const initOnboardingLaunchLinks = async () => {
  const dashboardLink = document.querySelector('#launch-dashboard-link');
  const bookingLink = document.querySelector('#launch-booking-link');
  const instagramLink = document.querySelector('#launch-instagram-link');
  const facebookLink = document.querySelector('#launch-facebook-link');
  const appleMapsLink = document.querySelector('#launch-applemaps-link');
  const qrLink = document.querySelector('#launch-qr-link');
  const qrImage = document.querySelector('#launch-qr-image');
  const continueButton = document.querySelector('#launch-links-continue');

  if (
    !(dashboardLink instanceof HTMLAnchorElement) ||
    !(bookingLink instanceof HTMLAnchorElement) ||
    !(instagramLink instanceof HTMLAnchorElement) ||
    !(facebookLink instanceof HTMLAnchorElement) ||
    !(appleMapsLink instanceof HTMLAnchorElement) ||
    !(qrLink instanceof HTMLAnchorElement) ||
    !(qrImage instanceof HTMLImageElement) ||
    !(continueButton instanceof HTMLButtonElement)
  ) {
    return;
  }

  const clientId = requireClientId();
  if (!clientId) {
    return;
  }

  try {
    const launchLinksResponse = await apiRequest(`/api/platform/clients/${clientId}/launch-links`);
    const launchLinks = launchLinksResponse.launchLinks;

    dashboardLink.href = launchLinks.dashboardLink;
    dashboardLink.textContent = launchLinks.dashboardLink;
    bookingLink.href = launchLinks.bookingPageLink;
    bookingLink.textContent = launchLinks.bookingPageLink;
    instagramLink.href = launchLinks.instagramBookingLink;
    instagramLink.textContent = launchLinks.instagramBookingLink;
    facebookLink.href = launchLinks.facebookBookingLink;
    facebookLink.textContent = launchLinks.facebookBookingLink;
    appleMapsLink.href = launchLinks.appleMapsBookingLink;
    appleMapsLink.textContent = launchLinks.appleMapsBookingLink;
    qrLink.href = launchLinks.qrBookingPageLink;
    qrLink.textContent = launchLinks.qrBookingPageLink;
    qrImage.src = launchLinks.qrCodeImageLink;
  } catch (error) {
    safeAlert(error instanceof Error ? error.message : 'Unable to load launch links');
    return;
  }

  continueButton.addEventListener('click', async () => {
    try {
      redirectTo('/onboarding/language', clientId);
    } catch (error) {
      safeAlert(error instanceof Error ? error.message : 'Unable to continue setup');
    }
  });
};

const formatSubscriptionPlanPrice = (plan) => {
  const amount = Number(plan?.amountCents ?? 0) / 100;
  const currencyCode = typeof plan?.currencyCode === 'string' ? plan.currencyCode : 'USD';

  try {
    return new Intl.NumberFormat('en-PK', {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: amount % 1 === 0 ? 0 : 2
    }).format(amount);
  } catch (_error) {
    return `${currencyCode} ${Math.round(amount).toLocaleString('en-US')}`;
  }
};

const getSubscriptionFeatureLabels = (plan) => {
  const entitlements = plan?.entitlements ?? {};
  const featureKeys = Array.isArray(entitlements.featureKeys) ? entitlements.featureKeys : [];
  const fallbackAppointmentCredits = {
    solo: 50,
    single: 150,
    team_premium: 500
  };
  const labels = [];

  if (Number.isFinite(Number(entitlements.maxTeamMembers))) {
    labels.push(`${entitlements.maxTeamMembers} team member limit`);
  }

  if (Number.isFinite(Number(entitlements.includedMessages))) {
    labels.push(`${entitlements.includedMessages} messages included`);
  }

  if (Number.isFinite(Number(entitlements.includedMarketingEmails))) {
    labels.push(`${entitlements.includedMarketingEmails} marketing emails`);
  }

  const includedAppointmentCredits = Number.isFinite(Number(entitlements.includedAppointmentCredits))
    ? Number(entitlements.includedAppointmentCredits)
    : fallbackAppointmentCredits[plan?.key] ?? 0;

  if (includedAppointmentCredits > 0) {
    labels.push(`${includedAppointmentCredits} appointment credits`);
  }

  if (featureKeys.includes('payments')) {
    labels.push('Payments and checkout');
  }

  if (featureKeys.includes('service_packages')) {
    labels.push('Prepaid service packages');
  }

  if (featureKeys.includes('team_management')) {
    labels.push('Team calendars');
  }

  if (featureKeys.includes('advanced_reports')) {
    labels.push('Advanced reports');
  }

  return labels.slice(0, 6);
};

const initPricingPage = () => {
  const pricingGrid = document.querySelector('#pricing-grid');
  const pricingCheckout = document.querySelector('#pricing-checkout');
  const pricingStatus = document.querySelector('#pricing-status');

  if (
    !(pricingGrid instanceof HTMLElement) ||
    !(pricingCheckout instanceof HTMLElement) ||
    !(pricingStatus instanceof HTMLElement)
  ) {
    return;
  }

  const clientId = getClientId();
  let plans = [];
  let selectedPlan = null;
  let billingOverview = null;
  const upgradeReason = window.sessionStorage.getItem('qr-platform-upgrade-reason') || '';
  window.sessionStorage.removeItem('qr-platform-upgrade-reason');

  const getCheckoutInputValue = (selector) => {
    const element = pricingCheckout.querySelector(selector);
    return element instanceof HTMLInputElement ? element.value : '';
  };

  const renderStatus = () => {
    const currentPlan = billingOverview?.currentPlan;
    const subscription = billingOverview?.subscription;
    const credits = billingOverview?.creditBalance ?? { granted: 0, remaining: 0, used: 0 };

    if (!clientId) {
      pricingStatus.innerHTML = `
        <p class="pricing-label">Subscription setup</p>
        <h1>Choose a plan for your business workspace</h1>
        <p>Sign up first, then come back here to attach demo card details and activate a plan.</p>
      `;
      return;
    }

    pricingStatus.innerHTML = `
      <p class="pricing-label">Subscription setup</p>
      <h1>${currentPlan ? `Using ${escapeHtml(currentPlan.name)}` : 'No plan selected'}</h1>
      <p>${
        upgradeReason
          ? escapeHtml(upgradeReason)
          : currentPlan
            ? `Status: ${escapeHtml(subscription?.status ?? 'active')}. Appointment credits: ${credits.remaining} of ${credits.granted} remaining. Select another plan below to add more credits.`
            : 'Choose Solo, Single, or Team Premium to unlock the disabled dashboard functions.'
      }</p>
    `;
  };

  const renderCheckout = () => {
    if (!selectedPlan) {
      pricingCheckout.classList.add('is-hidden');
      pricingCheckout.replaceChildren();
      return;
    }

    pricingCheckout.classList.remove('is-hidden');
    pricingCheckout.innerHTML = `
      <h2>Demo checkout for ${escapeHtml(selectedPlan.name)}</h2>
      <p>
        Use any test card number, for example 4242 4242 4242 4242. This demo stores only
        brand, last four digits, holder name, and expiry.
      </p>
      <form class="pricing-checkout-form" id="pricing-checkout-form">
        <label class="is-wide">
          <span>Cardholder name</span>
          <input id="pricing-cardholder-name" type="text" value="" required />
        </label>
        <label class="is-wide">
          <span>Card number</span>
          <input id="pricing-card-number" type="text" inputmode="numeric" placeholder="4242 4242 4242 4242" required />
        </label>
        <label>
          <span>Expiry month</span>
          <input id="pricing-exp-month" type="number" min="1" max="12" value="12" required />
        </label>
        <label>
          <span>Expiry year</span>
          <input id="pricing-exp-year" type="number" min="2026" max="2100" value="2030" required />
        </label>
        <label>
          <span>CVC</span>
          <input id="pricing-cvc" type="password" inputmode="numeric" maxlength="4" placeholder="123" required />
        </label>
        <label>
          <span>Billing email</span>
          <input id="pricing-billing-email" type="email" placeholder="owner@example.com" />
        </label>
        <div class="pricing-checkout-actions">
          <button class="pricing-cta" type="submit">Activate demo plan</button>
          <span class="pricing-note">No real payment is processed.</span>
        </div>
      </form>
    `;

    const form = pricingCheckout.querySelector('#pricing-checkout-form');

    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!clientId) {
        window.location.assign(`/signup?plan=${encodeURIComponent(selectedPlan.key)}`);
        return;
      }

      const submitButton = form.querySelector('button[type="submit"]');

      if (submitButton instanceof HTMLButtonElement) {
        submitButton.disabled = true;
        submitButton.textContent = 'Activating...';
      }

      try {
        const payload = await apiRequest(
          `/api/platform/clients/${encodeURIComponent(clientId)}/billing/demo-checkout`,
          {
            method: 'POST',
            body: JSON.stringify({
              planId: selectedPlan.id,
              cardholderName: getCheckoutInputValue('#pricing-cardholder-name'),
              cardNumber: getCheckoutInputValue('#pricing-card-number'),
              expMonth: getCheckoutInputValue('#pricing-exp-month'),
              expYear: getCheckoutInputValue('#pricing-exp-year'),
              cvc: getCheckoutInputValue('#pricing-cvc'),
              billingEmail: getCheckoutInputValue('#pricing-billing-email')
            })
          }
        );

        billingOverview = payload.overview;
        selectedPlan = null;
        renderStatus();
        renderPlans();
        pricingCheckout.classList.remove('is-hidden');
        pricingCheckout.innerHTML = `
          <h2>Plan activated</h2>
          <p>${escapeHtml(payload.overview.currentPlan?.name ?? 'Selected plan')} is now active for this demo workspace. Invoice ${escapeHtml(payload.invoice.id.slice(0, 8))} was stored.</p>
          <div class="pricing-checkout-actions">
            <a class="pricing-cta" href="${escapeHtml(buildPathWithClientId('/calendar', clientId))}">Return to dashboard</a>
          </div>
        `;
      } catch (error) {
        if (submitButton instanceof HTMLButtonElement) {
          submitButton.disabled = false;
          submitButton.textContent = 'Activate demo plan';
        }

        safeAlert(error instanceof Error ? error.message : 'Unable to activate plan');
      }
    });

    pricingCheckout.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const renderPlans = () => {
    const currentPlanId = billingOverview?.currentPlan?.id ?? '';
    const cards = plans.map((plan, index) => {
      const card = document.createElement('article');
      card.className = `pricing-card pricing-card-${String.fromCharCode(97 + index)}${
        plan.id === currentPlanId ? ' is-current' : ''
      }`;

      const top = document.createElement('div');
      top.className = 'pricing-top';
      const heading = document.createElement('h2');
      heading.textContent = plan.name;
      const badge = document.createElement('span');
      badge.className = 'trial-pill';
      badge.textContent = plan.badgeLabel || `${plan.trialDays} day trial`;
      top.append(heading, badge);

      const price = document.createElement('div');
      price.className = 'price-wrap';
      const amount = document.createElement('strong');
      amount.textContent = formatSubscriptionPlanPrice(plan);
      const interval = document.createElement('span');
      interval.textContent =
        plan.key === 'team_premium'
          ? 'per team member monthly'
          : `per ${plan.billingInterval}`;
      price.append(amount, interval);

      const copy = document.createElement('div');
      copy.className = 'pricing-copy';
      const summary = document.createElement('p');
      summary.textContent = plan.summary;
      copy.append(summary);

      const featureWrap = document.createElement('div');
      featureWrap.className = 'pricing-features';
      for (const label of getSubscriptionFeatureLabels(plan)) {
        const pill = document.createElement('span');
        pill.className = 'pricing-feature-pill';
        pill.textContent = label;
        featureWrap.append(pill);
      }

      const action = document.createElement('button');
      action.className = 'pricing-cta';
      action.type = 'button';
      action.textContent = plan.id === currentPlanId ? 'Current plan' : clientId ? 'Choose plan' : 'Sign up first';
      action.addEventListener('click', () => {
        if (!clientId) {
          window.location.assign(`/signup?plan=${encodeURIComponent(plan.key)}`);
          return;
        }

        selectedPlan = plan;
        renderCheckout();
      });

      card.append(top, price, copy, featureWrap, action);
      return card;
    });

    pricingGrid.replaceChildren(...cards);
  };

  Promise.all([
    apiRequest('/api/billing/subscription-plans'),
    clientId
      ? apiRequest(`/api/platform/clients/${encodeURIComponent(clientId)}/billing`).catch(() => null)
      : Promise.resolve(null)
  ])
    .then(([plansPayload, overviewPayload]) => {
      plans = Array.isArray(plansPayload?.plans) ? plansPayload.plans : [];
      billingOverview = overviewPayload;
      renderStatus();
      renderPlans();
    })
    .catch((error) => {
      pricingGrid.innerHTML = '<article class="pricing-card"><h2>Unable to load plans</h2></article>';
      safeAlert(error instanceof Error ? error.message : 'Unable to load pricing plans');
    });
};

syncClientIdFromQuery();

if (guardAdminPages()) {
  initSignup();
  initBusinessProfile();
  initServiceTypes();
  initAccountType();
  initServiceLocation();
  initVenueLocation();
  initCalendar();
  initSetupGuide();
  initOnboardingLaunchLinks().catch((error) => {
    safeAlert(error instanceof Error ? error.message : 'Unable to load launch links');
  });
  initPreferredLanguage();
  initOnboardingComplete();
}

initPricingPage();
initHomeSalonSearch();
initPublicBooking();
initManageBooking();

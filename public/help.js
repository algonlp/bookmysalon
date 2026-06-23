const setText = (id, value) => {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.textContent = value;
};

const toggleRow = (id, shouldShow) => {
  const element = document.getElementById(id);

  if (!element) {
    return;
  }

  element.hidden = !shouldShow;
};

const buildSummary = ({ supportCompanyName, supportPlatformName }) => {
  if (supportCompanyName && supportPlatformName) {
    return `${supportPlatformName} is supported by ${supportCompanyName}.`;
  }

  if (supportCompanyName) {
    return `${supportCompanyName} is the configured company for this platform.`;
  }

  if (supportPlatformName) {
    return `${supportPlatformName} is the configured platform for this support page.`;
  }

  return 'This page shows the company details configured for the platform.';
};

const buildSupportCopy = ({ supportCompanyName, supportFocusText }) => {
  if (supportCompanyName && supportFocusText) {
    return `${supportCompanyName} supports ${supportFocusText}.`;
  }

  if (supportFocusText) {
    return supportFocusText;
  }

  return 'Use the main platform to continue with customer booking or business onboarding.';
};

const formatWebsiteLabel = (url) => {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const normalizePhoneHref = (phoneValue) => {
  const digits = typeof phoneValue === 'string' ? phoneValue.replace(/[^\d+]/g, '') : '';
  return digits ? `tel:${digits}` : '#';
};

const applyPublicConfig = (config) => {
  const supportCompanyName = config.supportCompanyName?.trim() || 'Algonlp';
  const supportPlatformName = config.supportPlatformName?.trim() ?? '';
  const supportWebsiteUrl = config.supportWebsiteUrl?.trim() ?? '';
  const supportEmail = config.supportEmail?.trim() ?? '';
  const supportPhone = config.supportPhone?.trim() ?? '';
  const supportFocusText = config.supportFocusText?.trim() ?? '';

  const heading =
    supportCompanyName.length > 0 ? `${supportCompanyName} company details` : 'Company details';

  document.title = supportCompanyName.length > 0 ? `${supportCompanyName} | Help and support` : 'Help and support';

  setText('help-company-heading', heading);
  setText('help-company-summary', buildSummary({ supportCompanyName, supportPlatformName }));
  setText('help-company-name', supportCompanyName);
  setText('help-platform-name', supportPlatformName);
  setText('help-focus-text', supportFocusText);
  setText('help-support-copy', buildSupportCopy({ supportCompanyName, supportFocusText }));

  toggleRow('help-company-row', supportCompanyName.length > 0);
  toggleRow('help-platform-row', supportPlatformName.length > 0);
  toggleRow('help-focus-row', supportFocusText.length > 0);

  const websiteLink = document.getElementById('help-website-link');
  const emailLink = document.getElementById('help-email-link');
  const phoneLink = document.getElementById('help-phone-link');
  const hasWebsite = supportWebsiteUrl.length > 0;
  const hasEmail = supportEmail.length > 0;
  const hasPhone = supportPhone.length > 0;

  toggleRow('help-website-row', hasWebsite);
  toggleRow('help-email-row', hasEmail);
  toggleRow('help-phone-row', hasPhone);

  if (websiteLink && hasWebsite) {
    websiteLink.textContent = formatWebsiteLabel(supportWebsiteUrl);
    websiteLink.setAttribute('href', supportWebsiteUrl);
  }

  if (emailLink && hasEmail) {
    emailLink.textContent = supportEmail;
    emailLink.setAttribute('href', `mailto:${supportEmail}`);
  }

  if (phoneLink && hasPhone) {
    phoneLink.textContent = supportPhone;
    phoneLink.setAttribute('href', normalizePhoneHref(supportPhone));
  }
};

const loadPublicConfig = async () => {
  try {
    const response = await fetch('/api/public-config');

    if (!response.ok) {
      return;
    }

    const config = await response.json();
    applyPublicConfig(config);
  } catch {
    // Keep generic fallback copy when config is unavailable.
  }
};

void loadPublicConfig();

const footerYear = document.getElementById('site-footer-year');
const footerCompany = document.getElementById('site-footer-company');

if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

const applyFooterCompanyName = (config) => {
  if (!footerCompany) {
    return;
  }

  const supportCompanyName = config.supportCompanyName?.trim() ?? '';
  footerCompany.textContent =
    supportCompanyName.length > 0 ? supportCompanyName : 'the configured company';
};

const loadFooterCompanyName = async () => {
  try {
    const response = await fetch('/api/public-config');

    if (!response.ok) {
      return;
    }

    const config = await response.json();
    applyFooterCompanyName(config);
  } catch {
    // Keep the generic fallback label if public config is unavailable.
  }
};

void loadFooterCompanyName();

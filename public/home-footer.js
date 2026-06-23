const footerYear = document.getElementById('site-footer-year');
const footerCompany = document.getElementById('site-footer-company');
const footerCountryTabs = Array.from(document.querySelectorAll('[data-footer-country]'));
const footerCityGrid = document.getElementById('footer-city-grid');

const footerServices = [
  'Hair Salons',
  'Nail Salons',
  'Eyebrows & Lashes',
  'Beauty Salons',
  'Barbers',
  'Massages',
  'Spas & Saunas',
  'Waxing Salons'
];

const footerCountryCities = {
  lahore: ['Lahore', 'Gulberg, Lahore', 'DHA, Lahore', 'Johar Town, Lahore', 'Model Town, Lahore'],
  karachi: ['Karachi', 'Clifton, Karachi', 'DHA, Karachi', 'Gulshan-e-Iqbal, Karachi', 'Bahadurabad, Karachi'],
  islamabad: ['Islamabad', 'Blue Area, Islamabad', 'F-7, Islamabad', 'F-8, Islamabad', 'G-9, Islamabad'],
  rawalpindi: ['Rawalpindi', 'Saddar, Rawalpindi', 'Commercial Market, Rawalpindi', 'Satellite Town, Rawalpindi', 'Bahria Town, Rawalpindi'],
  faisalabad: ['Faisalabad', 'D Ground, Faisalabad', 'Madina Town, Faisalabad', 'Peoples Colony, Faisalabad', 'Canal Road, Faisalabad'],
  multan: ['Multan', 'Gulgasht Colony, Multan', 'Cantt, Multan', 'Model Town, Multan', 'Bosan Road, Multan'],
  peshawar: ['Peshawar', 'University Road, Peshawar', 'Saddar, Peshawar', 'Hayatabad, Peshawar', 'Ring Road, Peshawar'],
  quetta: ['Quetta', 'Jinnah Town, Quetta', 'Cantt, Quetta', 'Satellite Town, Quetta', 'Airport Road, Quetta'],
  sialkot: ['Sialkot', 'Cantt, Sialkot', 'Paris Road, Sialkot', 'Daska Road, Sialkot', 'Kashmir Road, Sialkot'],
  gujranwala: ['Gujranwala', 'Satellite Town, Gujranwala', 'DC Road, Gujranwala', 'Model Town, Gujranwala', 'Wapda Town, Gujranwala']
};

if (footerYear) {
  footerYear.textContent = String(new Date().getFullYear());
}

const applyFooterCompanyName = (config) => {
  if (!footerCompany) {
    return;
  }

  const supportCompanyName = config.supportCompanyName?.trim() ?? '';
  footerCompany.textContent = supportCompanyName.length > 0 ? supportCompanyName : 'Algonlp';
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
    if (footerCompany) {
      footerCompany.textContent = 'Algonlp';
    }
  }
};

void loadFooterCompanyName();

const buildFooterSearchPath = (service, city) =>
  `/?service=${encodeURIComponent(service)}&city=${encodeURIComponent(city)}`;

const renderFooterCityBrowser = (countryKey) => {
  if (!footerCityGrid) {
    return;
  }

  const cities = footerCountryCities[countryKey] ?? footerCountryCities.lahore;
  footerCityGrid.dataset.activeCountry = countryKey;
  footerCityGrid.replaceChildren();

  for (const city of cities) {
    const column = document.createElement('section');
    column.className = 'footer-city-column';

    const heading = document.createElement('h3');
    heading.textContent = city;
    column.append(heading);

    for (const service of footerServices) {
      const link = document.createElement('a');
      link.href = buildFooterSearchPath(service, city);
      link.textContent = `${service} in ${city}`;
      column.append(link);
    }

    footerCityGrid.append(column);
  }
};

footerCountryTabs.forEach((tab) => {
  tab.addEventListener('click', (event) => {
    const countryKey = tab.dataset.footerCountry;

    if (!countryKey || !footerCountryCities[countryKey]) {
      return;
    }

    event.preventDefault();

    footerCountryTabs.forEach((countryTab) => {
      const isActive = countryTab === tab;
      countryTab.classList.toggle('is-active', isActive);
      countryTab.setAttribute('aria-current', isActive ? 'true' : 'false');
    });

    renderFooterCityBrowser(countryKey);
  });
});

const activeCountryTab = footerCountryTabs.find((tab) => tab.classList.contains('is-active'));
if (activeCountryTab) {
  activeCountryTab.setAttribute('aria-current', 'true');
}

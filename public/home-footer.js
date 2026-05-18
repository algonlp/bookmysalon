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
  australia: ['Sydney', 'Melbourne', 'Perth', 'Brisbane', 'Gold Coast'],
  bahrain: ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Isa Town'],
  barbados: ['Bridgetown', 'Holetown', 'Speightstown', 'Oistins', 'Bathsheba'],
  belgium: ['Brussels', 'Antwerp', 'Ghent', 'Bruges', 'Liege'],
  brazil: ['Sao Paulo', 'Rio de Janeiro', 'Brasilia', 'Salvador', 'Fortaleza'],
  canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa'],
  denmark: ['Copenhagen', 'Aarhus', 'Odense', 'Aalborg', 'Esbjerg'],
  france: ['Paris', 'Lyon', 'Marseille', 'Nice', 'Toulouse'],
  germany: ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt'],
  greece: ['Athens', 'Thessaloniki', 'Patras', 'Heraklion', 'Larissa']
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

  const cities = footerCountryCities[countryKey] ?? footerCountryCities.australia;
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

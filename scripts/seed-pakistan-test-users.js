const { readFileSync, writeFileSync } = require('node:fs');
const { resolve } = require('node:path');

const storagePath = resolve(process.cwd(), 'data', 'client-platform.json');
const state = JSON.parse(readFileSync(storagePath, 'utf8'));

const cities = [
  ['Karachi', 'Sindh', 'Clifton Block 5'],
  ['Lahore', 'Punjab', 'MM Alam Road Gulberg'],
  ['Islamabad', 'Islamabad Capital Territory', 'F-7 Markaz'],
  ['Rawalpindi', 'Punjab', 'Saddar'],
  ['Faisalabad', 'Punjab', 'D Ground'],
  ['Multan', 'Punjab', 'Gulgasht Colony'],
  ['Peshawar', 'Khyber Pakhtunkhwa', 'University Road'],
  ['Quetta', 'Balochistan', 'Jinnah Road'],
  ['Sialkot', 'Punjab', 'Cantt'],
  ['Gujranwala', 'Punjab', 'Satellite Town'],
  ['Hyderabad', 'Sindh', 'Latifabad'],
  ['Sukkur', 'Sindh', 'Military Road'],
  ['Bahawalpur', 'Punjab', 'Model Town A'],
  ['Sargodha', 'Punjab', 'University Road'],
  ['Abbottabad', 'Khyber Pakhtunkhwa', 'Jinnahabad'],
  ['Mardan', 'Khyber Pakhtunkhwa', 'Bank Road'],
  ['Rahim Yar Khan', 'Punjab', 'City Centre'],
  ['Okara', 'Punjab', 'M.A. Jinnah Road'],
  ['Sahiwal', 'Punjab', 'High Street'],
  ['Gujrat', 'Punjab', 'Service Mor'],
  ['Jhelum', 'Punjab', 'Civil Lines'],
  ['Mingora', 'Khyber Pakhtunkhwa', 'Saidu Sharif Road'],
  ['Nawabshah', 'Sindh', 'Masjid Road'],
  ['Larkana', 'Sindh', 'Station Road'],
  ['Mirpur Khas', 'Sindh', 'Hyderabad Road'],
  ['Kasur', 'Punjab', 'Kot Murad Khan'],
  ['Sheikhupura', 'Punjab', 'Lahore Road'],
  ['Mandi Bahauddin', 'Punjab', 'Phalia Road'],
  ['Dera Ghazi Khan', 'Punjab', 'Block 17'],
  ['Muzaffargarh', 'Punjab', 'Main Bazaar'],
  ['Chiniot', 'Punjab', 'Sargodha Road'],
  ['Jhang', 'Punjab', 'Civil Lines'],
  ['Vehari', 'Punjab', 'Club Road'],
  ['Khanewal', 'Punjab', 'Railway Road'],
  ['Haripur', 'Khyber Pakhtunkhwa', 'GT Road'],
  ['Mansehra', 'Khyber Pakhtunkhwa', 'Karakoram Highway'],
  ['Swabi', 'Khyber Pakhtunkhwa', 'Topi Road'],
  ['Kohat', 'Khyber Pakhtunkhwa', 'KDA Town'],
  ['Bannu', 'Khyber Pakhtunkhwa', 'Circular Road'],
  ['Gwadar', 'Balochistan', 'Marine Drive'],
  ['Turbat', 'Balochistan', 'Airport Road'],
  ['Khuzdar', 'Balochistan', 'Jinnah Road'],
  ['Gilgit', 'Gilgit-Baltistan', 'River View Road'],
  ['Skardu', 'Gilgit-Baltistan', 'Hussainabad Road'],
  ['Muzaffarabad', 'Azad Kashmir', 'Upper Adda'],
  ['Mirpur', 'Azad Kashmir', 'Allama Iqbal Road'],
  ['Kotli', 'Azad Kashmir', 'Main Kotli Road'],
  ['Attock', 'Punjab', 'Kamra Road'],
  ['Wah Cantt', 'Punjab', 'The Mall'],
  ['Taxila', 'Punjab', 'Museum Road']
];

const imageSets = [
  [
    'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1400&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1400&q=80'
  ],
  [
    'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1400&q=80',
    'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1400&q=80'
  ]
];

const serviceTemplates = [
  {
    serviceTypes: ['Hair salon', 'Beauty salon'],
    services: [
      ['cut-and-style', 'Cut and style', 'Hair salon', 60, 'Rs 2,200', 'Signature haircut with wash, blow-dry, and styling.'],
      ['blow-dry', 'Blow dry', 'Hair salon', 45, 'Rs 1,500', 'Smooth professional blow-dry for everyday or event styling.'],
      ['facial-treatment', 'Facial treatment', 'Beauty salon', 60, 'Rs 2,700', 'Glow facial with cleanse, exfoliation, and mask.']
    ]
  },
  {
    serviceTypes: ['Barber', 'Hair salon'],
    services: [
      ['haircut', 'Haircut', 'Barber', 45, 'Rs 1,200', 'Classic haircut with clipper and scissor finishing.'],
      ['beard-trim', 'Beard trim', 'Barber', 30, 'Rs 800', 'Beard shape, line-up, and tidy finish.'],
      ['hair-wash-style', 'Hair wash and style', 'Hair salon', 45, 'Rs 1,400', 'Wash and quick style for a fresh look.']
    ]
  },
  {
    serviceTypes: ['Nails', 'Eyebrows & lashes', 'Waxing salon'],
    services: [
      ['manicure', 'Manicure', 'Nails', 45, 'Rs 1,600', 'Nail shaping, cuticle care, and polish.'],
      ['brow-shaping', 'Brow shaping', 'Eyebrows & lashes', 30, 'Rs 900', 'Clean brow shaping with a natural finish.'],
      ['full-arm-waxing', 'Full arm waxing', 'Waxing salon', 45, 'Rs 1,700', 'Smooth full arm waxing service.']
    ]
  }
];

const barberServices = [
  ['barber-haircut', 'Haircut', 'Barber', 45, 'Rs 1,200', 'Classic barber haircut with clipper and scissor finishing.'],
  ['barber-beard-trim', 'Beard trim', 'Barber', 30, 'Rs 800', 'Beard shape, line-up, and tidy finish.']
];

const names = [
  'Areeba', 'Hina', 'Sana', 'Maham', 'Zainab', 'Nida', 'Iqra', 'Laiba', 'Kiran', 'Mina',
  'Ali', 'Hamza', 'Usman', 'Bilal', 'Danish', 'Tariq', 'Sara', 'Mariam', 'Noor', 'Ayesha'
];

const now = '2026-05-18T07:45:00.000Z';

const buildClient = ([city, province, area], index) => {
  const number = String(index + 1).padStart(3, '0');
  const template = serviceTemplates[index % serviceTemplates.length];
  const serviceTypes = [...new Set([...template.serviceTypes, 'Barber'])];
  const galleryImageUrls = imageSets[index % imageSets.length];
  const businessSlug = `pk-${city.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${number}`;
  const ownerName = names[index % names.length];
  const barberName = names[(index + 10) % names.length];
  const services = [
    ...template.services,
    ...barberServices.filter(([barberServiceId]) => !template.services.some(([serviceId]) => serviceId === barberServiceId))
  ].map(([id, name, categoryName, durationMinutes, priceLabel, description]) => ({
    id: `${businessSlug}-${id}`,
    name,
    durationMinutes,
    categoryName,
    priceLabel,
    description,
    isActive: true
  }));
  const haircutServiceId = `${businessSlug}-barber-haircut`;
  const beardTrimServiceId = `${businessSlug}-barber-beard-trim`;

  return {
    id: `test-${businessSlug}`,
    adminToken: `test-admin-${businessSlug}`,
    email: `pk.salon.${number}@bookmysalon.test`,
    mobileNumber: `+92310${String(7000000 + index).padStart(7, '0')}`,
    businessPhoneNumber: `+92321${String(8000000 + index).padStart(7, '0')}`,
    provider: 'email',
    businessName: `${city} Glow Studio ${number}`,
    website: `https://${businessSlug}.example.com`,
    profileImageUrl: galleryImageUrls[0],
    galleryImageUrls,
    serviceTypes,
    services,
    products: [],
    productSales: [],
    packagePlans: [
      {
        id: `${businessSlug}-package-haircut-duo`,
        name: 'Haircut Duo',
        includedServiceIds: [haircutServiceId],
        totalUses: 2,
        priceLabel: 'Rs 2,000',
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: `${businessSlug}-package-beard-refresh`,
        name: 'Beard Refresh Pack',
        includedServiceIds: [beardTrimServiceId],
        totalUses: 3,
        priceLabel: 'Rs 2,100',
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    loyaltyProgram: null,
    businessSettings: {
      currencyCode: 'PKR',
      currencyLocale: 'en-PK',
      slotTimes: ['10:00', '11:00', '12:00', '14:00', '15:00', '16:00', '17:00', '18:00'],
      useServiceTemplates: true,
      reportMetadata: {
        pageTitle: 'Reporting and analytics',
        pageSubtitle: 'Access all of your business reports in one workspace.'
      }
    },
    customerProfiles: [],
    teamMembers: [
      {
        id: `${businessSlug}-team-1`,
        name: ownerName,
        role: template.serviceTypes.includes('Barber') ? 'Lead Barber' : 'Stylist',
        phone: `+92300${String(9000000 + index).padStart(7, '0')}`,
        expertise: template.serviceTypes[0],
        openingTime: '10:30',
        closingTime: '22:00',
        offDays: [],
        isActive: true,
        createdAt: now,
        updatedAt: now
      },
      {
        id: `${businessSlug}-team-barber`,
        name: barberName,
        role: 'Barber',
        phone: `+92302${String(9100000 + index).padStart(7, '0')}`,
        expertise: 'Haircut and beard grooming',
        openingTime: '10:30',
        closingTime: '22:00',
        offDays: [],
        isActive: true,
        createdAt: now,
        updatedAt: now
      }
    ],
    accountType: 'team',
    serviceLocation: ['physical'],
    venueAddress: `${area}, ${city}, ${province}, Pakistan`,
    preferredLanguage: 'english',
    onboardingCompleted: true,
    createdAt: now,
    updatedAt: now
  };
};

const testClients = cities.map(buildClient);
const testIds = new Set(testClients.map((client) => client.id));

state.clients = [
  ...state.clients.filter((client) => !testIds.has(client.id) && !String(client.id).startsWith('test-pk-')),
  ...testClients
];

writeFileSync(storagePath, `${JSON.stringify(state, null, 2)}\n`);

console.log(`Seeded ${testClients.length} Pakistan test salon users.`);

import { randomUUID } from 'node:crypto';
import { clientPlatformRepository } from '../src/platform/clientPlatform.repository';
import { appointmentRepository } from '../src/appointments/appointment.repository';
import { hashAdminToken } from '../src/shared/hashToken';
import type { ClientRecord, TeamMemberRecord, PackagePlanRecord } from '../src/platform/clientPlatform.types';
import type { AppointmentRecord } from '../src/appointments/appointment.types';

const now = new Date().toISOString();

const cities: Array<{ name: string; province: string; areas: string[] }> = [
  {
    name: 'Faisalabad',
    province: 'Punjab',
    areas: [
      'D Ground',
      'Susan Road',
      'Peoples Colony',
      'Madina Town',
      'Jaranwala Road',
      'Kohinoor Town',
      'Gulistan Colony',
      'Samanabad',
      'Batala Colony',
      'Millat Road'
    ]
  },
  {
    name: 'Karachi',
    province: 'Sindh',
    areas: [
      'Clifton',
      'DHA Phase 5',
      'Gulshan-e-Iqbal',
      'North Nazimabad',
      'Bahadurabad',
      'Tariq Road',
      'PECHS',
      'Gulistan-e-Johar',
      'Malir Cantt',
      'Saddar'
    ]
  },
  {
    name: 'Lahore',
    province: 'Punjab',
    areas: [
      'Gulberg',
      'DHA Phase 6',
      'Model Town',
      'Johar Town',
      'Bahria Town',
      'Wapda Town',
      'Cavalry Ground',
      'Iqbal Town',
      'Faisal Town',
      'Garden Town'
    ]
  },
  {
    name: 'Sukkur',
    province: 'Sindh',
    areas: [
      'Military Road',
      'Shikarpur Road',
      'Minara Road',
      'New Sukkur',
      'Station Road',
      'Barrage Colony',
      'Clock Tower',
      'Pakistan Colony',
      'Airport Road',
      'Wireless Colony'
    ]
  },
  {
    name: 'Islamabad',
    province: 'Islamabad Capital Territory',
    areas: [
      'F-7 Markaz',
      'F-10 Markaz',
      'G-9 Markaz',
      'Blue Area',
      'E-11',
      'Bahria Town Phase 4',
      'DHA Phase 2',
      'I-8 Markaz',
      'F-6 Super Market',
      'G-11 Markaz'
    ]
  }
];

const imagePool = [
  'https://images.unsplash.com/photo-1560066984-138dadb4c035?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1522337660859-02fbefca4702?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1516975080664-ed2fc6a32937?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1527799820374-dcf8d9d4a388?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1580618672591-eb180b1a973f?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1600334129128-685c5582fd35?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1605497788044-5a32c7078486?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1519415387722-a1c3bbef716c?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1519699047748-de8e457a634e?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1560869713-7d0a29430803?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1493256338651-d82f7acb2b38?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1470259078422-826894b933aa?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1552693673-1bf958298935?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?auto=format&fit=crop&w=1400&q=80'
];

const nameAdjectives = [
  'Blush',
  'Radiance',
  'Serenity',
  'Elegance',
  'Luxe',
  'Glow',
  'Aura',
  'Velvet',
  'Charisma',
  'Opal'
];

const nameNouns = [
  'Salon',
  'Beauty Lounge',
  'Studio',
  'Grooming Lounge',
  'Hair & Beauty',
  'Style Bar'
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
] as const;

const teamNames = [
  'Areeba', 'Hina', 'Sana', 'Maham', 'Zainab', 'Nida', 'Iqra', 'Laiba', 'Kiran', 'Mina',
  'Ali', 'Hamza', 'Usman', 'Bilal', 'Danish', 'Tariq', 'Sara', 'Mariam', 'Noor', 'Ayesha',
  'Fatima', 'Rabia', 'Adeel', 'Shahzad', 'Wajiha', 'Komal', 'Faizan', 'Waqas', 'Sadia', 'Amber'
];

const customerNames = ['Ahmed Raza', 'Sadia Khan', 'Bilal Aslam', 'Mehwish Tariq', 'Osama Farooq'];
const customerPhones = ['+923011234567', '+923021234568', '+923031234569', '+923041234570', '+923051234571'];

const slugify = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

const buildTeamMember = (name: string, role: string, expertise: string, phoneSeed: number): TeamMemberRecord => ({
  id: randomUUID(),
  name,
  role,
  phone: `+92300${String(9000000 + phoneSeed).padStart(7, '0')}`,
  expertise,
  openingTime: '10:30',
  closingTime: '22:00',
  offDays: [],
  isActive: true,
  createdAt: now,
  updatedAt: now
});

const buildPackagePlans = (businessSlug: string, haircutServiceId: string, beardTrimServiceId: string): PackagePlanRecord[] => [
  {
    id: `${businessSlug}-package-duo`,
    name: 'Signature Duo',
    includedServiceIds: [haircutServiceId],
    totalUses: 2,
    priceLabel: 'Rs 2,000',
    isActive: true,
    createdAt: now,
    updatedAt: now
  },
  {
    id: `${businessSlug}-package-refresh`,
    name: 'Refresh Pack',
    includedServiceIds: [beardTrimServiceId],
    totalUses: 3,
    priceLabel: 'Rs 2,100',
    isActive: true,
    createdAt: now,
    updatedAt: now
  }
];

interface BuiltSalon {
  client: ClientRecord;
  city: string;
}

let globalIndex = 0;

const buildSalon = (cityName: string, province: string, area: string): BuiltSalon => {
  const index = globalIndex;
  globalIndex += 1;

  const number = String(index + 1).padStart(3, '0');
  const template = serviceTemplates[index % serviceTemplates.length];
  const adjective = nameAdjectives[index % nameAdjectives.length];
  const noun = nameNouns[(index + 2) % nameNouns.length];
  const businessName = `${adjective} ${noun}`;
  const businessSlug = `seed-${slugify(cityName)}-${slugify(businessName)}-${number}`;

  const galleryImageUrls = [
    imagePool[index % imagePool.length],
    imagePool[(index + 6) % imagePool.length],
    imagePool[(index + 12) % imagePool.length]
  ];

  const ownerName = teamNames[index % teamNames.length];
  const assistantName = teamNames[(index + 15) % teamNames.length];

  const services = template.services.map(([id, name, categoryName, durationMinutes, priceLabel, description]) => ({
    id: `${businessSlug}-${id}`,
    name,
    durationMinutes,
    categoryName,
    priceLabel,
    description,
    isActive: true,
    isSpecialService: false
  }));

  const haircutLikeService = services[0];
  const secondService = services[1] ?? services[0];

  const client: ClientRecord = {
    id: randomUUID(),
    adminToken: hashAdminToken(randomUUID()),
    email: `seed.${slugify(cityName)}-${number}@bookmysalon.internal`,
    mobileNumber: `+92345${String(1000000 + index).padStart(7, '0')}`,
    businessPhoneNumber: `+92346${String(2000000 + index).padStart(7, '0')}`,
    provider: 'email',
    businessName,
    website: '',
    profileImageUrl: galleryImageUrls[0],
    galleryImageUrls,
    serviceTypes: [...template.serviceTypes],
    services,
    products: [],
    productSales: [],
    packagePlans: buildPackagePlans(businessSlug, haircutLikeService.id, secondService.id),
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
      buildTeamMember(ownerName, template.serviceTypes.includes('Barber') ? 'Lead Barber' : 'Stylist', template.serviceTypes[0], index),
      buildTeamMember(assistantName, 'Assistant', template.serviceTypes[template.serviceTypes.length - 1], index + 500)
    ],
    accountType: 'team',
    serviceLocation: ['physical'],
    venueAddress: `${area}, ${cityName}, ${province}, Pakistan`,
    preferredLanguage: 'english',
    onboardingCompleted: true,
    linkedBusinessIds: [],
    createdAt: now,
    updatedAt: now
  };

  return { client, city: cityName };
};

const buildBranch = (parent: ClientRecord, cityName: string, province: string, area: string): ClientRecord => {
  const branchNumber = String(globalIndex + 1).padStart(3, '0');
  globalIndex += 1;

  const businessSlug = `seed-branch-${slugify(cityName)}-${branchNumber}`;
  const galleryImageUrls = [
    imagePool[(globalIndex + 3) % imagePool.length],
    imagePool[(globalIndex + 9) % imagePool.length],
    imagePool[(globalIndex + 15) % imagePool.length]
  ];

  return {
    ...parent,
    id: randomUUID(),
    adminToken: hashAdminToken(randomUUID()),
    email: `seed.${slugify(cityName)}-branch-${branchNumber}@bookmysalon.internal`,
    mobileNumber: `+92345${String(5000000 + globalIndex).padStart(7, '0')}`,
    businessPhoneNumber: `+92346${String(6000000 + globalIndex).padStart(7, '0')}`,
    businessName: `${parent.businessName} - ${area}`,
    profileImageUrl: galleryImageUrls[0],
    galleryImageUrls,
    teamMembers: parent.teamMembers.map((member) => ({ ...member, id: randomUUID() })),
    venueAddress: `${area}, ${cityName}, ${province}, Pakistan`,
    linkedBusinessIds: [],
    createdAt: now,
    updatedAt: now
  };
};

const buildAppointment = (
  salon: ClientRecord,
  customerIndex: number,
  daysOffset: number,
  time: string,
  status: 'booked' | 'completed'
): AppointmentRecord => {
  const service = salon.services[0];
  const teamMember = salon.teamMembers[0];
  const appointmentDate = new Date(Date.parse('2026-07-23T00:00:00+05:00'));
  appointmentDate.setUTCDate(appointmentDate.getUTCDate() + daysOffset);
  const dateStr = appointmentDate.toISOString().slice(0, 10);
  const startAt = new Date(`${dateStr}T${time}:00+05:00`);
  const endAt = new Date(startAt.getTime() + service.durationMinutes * 60000);

  return {
    id: randomUUID(),
    businessId: salon.id,
    businessName: salon.businessName,
    serviceId: service.id,
    categoryName: service.categoryName,
    serviceName: service.name,
    teamMemberId: teamMember.id,
    teamMemberName: teamMember.name,
    customerName: customerNames[customerIndex],
    customerPhone: customerPhones[customerIndex],
    customerEmail: '',
    serviceLocation: 'physical',
    customerAddress: '',
    appointmentDate: dateStr,
    appointmentTime: time,
    servicePriceLabel: service.priceLabel,
    currencyCode: 'PKR',
    startAt: startAt.toISOString(),
    endAt: endAt.toISOString(),
    status,
    source: 'direct',
    createdAt: now,
    updatedAt: now
  };
};

const run = async (): Promise<void> => {
  const builtSalons: BuiltSalon[] = [];
  const branchPairs: Array<{ parent: ClientRecord; branch: ClientRecord }> = [];

  for (const city of cities) {
    const citySalons: ClientRecord[] = [];

    for (let areaIndex = 0; areaIndex < 10; areaIndex += 1) {
      const { client } = buildSalon(city.name, city.province, city.areas[areaIndex]);
      citySalons.push(client);
      builtSalons.push({ client, city: city.name });
    }

    const parent = citySalons[0];
    const branch = buildBranch(parent, city.name, city.province, `${city.areas[1]} (2nd Location)`);

    parent.linkedBusinessIds = [branch.id];
    branch.linkedBusinessIds = [parent.id];

    branchPairs.push({ parent, branch });
  }

  for (const { client } of builtSalons) {
    await clientPlatformRepository.saveClient(client);
  }

  for (const { branch } of branchPairs) {
    await clientPlatformRepository.saveClient(branch);
  }

  const appointmentPlans: Array<{ cityIndex: number; daysOffset: number; time: string; status: 'booked' | 'completed' }> = [
    { cityIndex: 0, daysOffset: 3, time: '11:00', status: 'booked' },
    { cityIndex: 1, daysOffset: 5, time: '15:00', status: 'booked' },
    { cityIndex: 2, daysOffset: 7, time: '17:00', status: 'booked' },
    { cityIndex: 3, daysOffset: -6, time: '12:00', status: 'completed' },
    { cityIndex: 4, daysOffset: -14, time: '16:00', status: 'completed' }
  ];

  const appointments: AppointmentRecord[] = appointmentPlans.map((plan, planIndex) => {
    const salon = builtSalons[plan.cityIndex * 10].client;
    return buildAppointment(salon, planIndex, plan.daysOffset, plan.time, plan.status);
  });

  for (const appointment of appointments) {
    await appointmentRepository.saveAppointment(appointment);
  }

  console.log(`Seeded ${builtSalons.length} salons across ${cities.length} cities.`);
  console.log(`Seeded ${branchPairs.length} branch locations (one per city).`);
  for (const { parent, branch } of branchPairs) {
    console.log(`  Branch pair: "${parent.businessName}" (${parent.id}) <-> "${branch.businessName}" (${branch.id})`);
  }
  console.log(`Seeded ${appointments.length} appointments:`);
  for (const appointment of appointments) {
    console.log(`  ${appointment.customerName} -> ${appointment.businessName} on ${appointment.appointmentDate} ${appointment.appointmentTime} (${appointment.status})`);
  }
};

run().catch((error) => {
  console.error('Failed to seed city salons:', error);
  process.exit(1);
});

import type { AppointmentServiceOption, BusinessService } from '../appointments/appointment.types';
import { env } from '../config/env';

type BusinessServiceSeed = Omit<BusinessService, 'id' | 'isActive'>;

interface ServiceTemplateOptions {
  currencyCode?: string;
  currencyLocale?: string;
  useServiceTemplates?: boolean;
}

const DEFAULT_SERVICE_CATALOG: Record<string, BusinessServiceSeed[]> = {
  'Hair salon': [
    {
      name: 'Cut and style',
      durationMinutes: 60,
      categoryName: 'Hair salon',
      priceLabel: '2200',
      description: 'Signature haircut finished with a professional blow-dry.'
    },
    {
      name: 'Blow dry',
      durationMinutes: 45,
      categoryName: 'Hair salon',
      priceLabel: '1500',
      description: 'Smooth blow-dry with styling tailored to the guest.'
    }
  ],
  Barber: [
    {
      name: 'Haircut',
      durationMinutes: 45,
      categoryName: 'Barber',
      priceLabel: '1200',
      description: 'Classic barber haircut with clipper and scissor finishing.'
    },
    {
      name: 'Beard trim',
      durationMinutes: 30,
      categoryName: 'Barber',
      priceLabel: '800',
      description: 'Shape, line-up, and beard tidy-up for a clean finish.'
    }
  ],
  Nails: [
    {
      name: 'Manicure',
      durationMinutes: 45,
      categoryName: 'Nails',
      priceLabel: '1600',
      description: 'Nail shaping, cuticle care, and polish refresh.'
    },
    {
      name: 'Pedicure',
      durationMinutes: 60,
      categoryName: 'Nails',
      priceLabel: '2100',
      description: 'Foot soak, nail care, exfoliation, and polish refresh.'
    }
  ],
  Massage: [
    {
      name: 'Deep tissue massage',
      durationMinutes: 60,
      categoryName: 'Massage',
      priceLabel: '3200',
      description: 'Targeted pressure massage designed for muscle recovery.'
    },
    {
      name: 'Relaxation massage',
      durationMinutes: 60,
      categoryName: 'Massage',
      priceLabel: '2900',
      description: 'Full-body relaxation massage to reduce stress and tension.'
    }
  ],
  'Beauty salon': [
    {
      name: 'Facial treatment',
      durationMinutes: 60,
      categoryName: 'Beauty salon',
      priceLabel: '2700',
      description: 'Glow-focused facial treatment with cleanse, exfoliation, and mask.'
    }
  ],
  'Eyebrows & lashes': [
    {
      name: 'Brow shaping',
      durationMinutes: 30,
      categoryName: 'Eyebrows & lashes',
      priceLabel: '900',
      description: 'Precision brow shaping to suit the guest’s natural features.'
    },
    {
      name: 'Lash lift',
      durationMinutes: 45,
      categoryName: 'Eyebrows & lashes',
      priceLabel: '1800',
      description: 'Lift and curl natural lashes for a brighter eye look.'
    }
  ],
  Medspa: [
    {
      name: 'Skin consultation',
      durationMinutes: 45,
      categoryName: 'Medspa',
      priceLabel: '2400',
      description: 'Professional consultation to recommend the right skin treatments.'
    }
  ],
  'Spa & sauna': [
    {
      name: 'Spa session',
      durationMinutes: 60,
      categoryName: 'Spa & sauna',
      priceLabel: '3500',
      description: 'Unwind with a restorative spa session in a calm setting.'
    }
  ],
  'Waxing salon': [
    {
      name: 'Full arm waxing',
      durationMinutes: 45,
      categoryName: 'Waxing salon',
      priceLabel: '1700',
      description: 'Full arm waxing service for a smooth, polished result.'
    }
  ]
};

const DEFAULT_TEMPLATE_PRICE_LABEL = '1000';

const buildServiceKey = (categoryName: string, serviceName: string): string =>
  `${categoryName.trim().toLowerCase()}::${serviceName.trim().toLowerCase()}`;

const buildServiceId = (categoryName: string, serviceName: string, fallbackIndex: number): string => {
  const slugSource = `${categoryName}-${serviceName}`.trim().toLowerCase();
  const slug = slugSource.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || `service-${fallbackIndex + 1}`;
};

const formatTemplatePriceLabel = (
  priceLabel: string,
  currencyCode = env.DEFAULT_BUSINESS_CURRENCY_CODE,
  currencyLocale = env.DEFAULT_BUSINESS_CURRENCY_LOCALE
): string => {
  const normalizedValue = Number(priceLabel.replace(/[^\d.]/g, ''));

  if (!Number.isFinite(normalizedValue)) {
    return priceLabel;
  }

  return new Intl.NumberFormat(currencyLocale, {
    style: 'currency',
    currency: currencyCode,
    maximumFractionDigits: 0
  }).format(normalizedValue);
};

const sanitizeService = (
  service: BusinessService,
  index: number,
  options: ServiceTemplateOptions = {}
): BusinessService | undefined => {
  const name = typeof service.name === 'string' ? service.name.trim() : '';

  if (!name) {
    return undefined;
  }

  const categoryName =
    typeof service.categoryName === 'string' && service.categoryName.trim().length > 0
      ? service.categoryName.trim()
      : 'General';
  const priceLabel =
    typeof service.priceLabel === 'string' && service.priceLabel.trim().length > 0
      ? service.priceLabel.trim()
      : formatTemplatePriceLabel(
          DEFAULT_TEMPLATE_PRICE_LABEL,
          options.currencyCode,
          options.currencyLocale
        );
  const durationMinutes =
    typeof service.durationMinutes === 'number' && Number.isFinite(service.durationMinutes)
      ? Math.max(15, Math.round(service.durationMinutes))
      : 30;

  return {
    id:
      typeof service.id === 'string' && service.id.trim().length > 0
        ? service.id.trim()
        : buildServiceId(categoryName, name, index),
    name,
    durationMinutes,
    categoryName,
    priceLabel,
    description: typeof service.description === 'string' ? service.description.trim() : '',
    isActive: service.isActive !== false
  };
};

const dedupeServices = (services: BusinessService[]): BusinessService[] => {
  const seen = new Set<string>();

  return services.filter((service) => {
    const key = buildServiceKey(service.categoryName, service.name);

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
};

const createServicesFromSeeds = (
  seeds: BusinessServiceSeed[],
  options: ServiceTemplateOptions = {}
): BusinessService[] =>
  dedupeServices(
    seeds.map((service, index) => ({
      id: buildServiceId(service.categoryName, service.name, index),
      name: service.name,
      durationMinutes: service.durationMinutes,
      categoryName: service.categoryName,
      priceLabel: formatTemplatePriceLabel(
        service.priceLabel,
        options.currencyCode,
        options.currencyLocale
      ),
      description: service.description,
      isActive: true
    }))
  );

export const createSeededBusinessServices = (
  serviceTypes: string[],
  options: ServiceTemplateOptions = {}
): BusinessService[] =>
  createServicesFromSeeds(serviceTypes.flatMap((type) => DEFAULT_SERVICE_CATALOG[type] ?? []), options);

export const normalizeBusinessServices = (
  serviceTypes: string[],
  services: BusinessService[] = [],
  options: ServiceTemplateOptions = {}
): BusinessService[] => {
  const normalizedExisting = dedupeServices(
    services
      .map((service, index) => sanitizeService(service, index, options))
      .filter((service): service is BusinessService => !!service)
  );

  if (normalizedExisting.length > 0) {
    return normalizedExisting;
  }

  if (options.useServiceTemplates === false) {
    return [];
  }

  return createSeededBusinessServices(serviceTypes, options);
};

export const syncBusinessServicesWithTypes = (
  serviceTypes: string[],
  services: BusinessService[] = [],
  options: ServiceTemplateOptions = {}
): BusinessService[] => {
  const normalizedExisting = dedupeServices(
    services
      .map((service, index) => sanitizeService(service, index, options))
      .filter((service): service is BusinessService => !!service)
  );

  if (normalizedExisting.length === 0) {
    if (options.useServiceTemplates === false) {
      return [];
    }

    return createSeededBusinessServices(serviceTypes, options);
  }

  const selectedTypes = new Set(serviceTypes);
  const preservedServices = normalizedExisting.filter(
    (service) => service.categoryName === 'General' || selectedTypes.has(service.categoryName)
  );
  const existingKeys = new Set(
    preservedServices.map((service) => buildServiceKey(service.categoryName, service.name))
  );
  if (options.useServiceTemplates === false) {
    return preservedServices;
  }

  const missingDefaults = createSeededBusinessServices(serviceTypes, options).filter(
    (service) => !existingKeys.has(buildServiceKey(service.categoryName, service.name))
  );

  return [...preservedServices, ...missingDefaults];
};

export const toAppointmentServiceOptions = (
  services: BusinessService[]
): AppointmentServiceOption[] =>
  services
    .filter((service) => service.isActive)
    .map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.durationMinutes,
      categoryName: service.categoryName,
      priceLabel: service.priceLabel,
      description: service.description
    }));

export const createFallbackAppointmentService = (
  primaryServiceType?: string,
  options: ServiceTemplateOptions = {}
): AppointmentServiceOption => ({
  id: 'consultation',
  name: 'Consultation',
  durationMinutes: 30,
  categoryName: primaryServiceType?.trim() || 'General',
  priceLabel: formatTemplatePriceLabel(
    DEFAULT_TEMPLATE_PRICE_LABEL,
    options.currencyCode,
    options.currencyLocale
  ),
  description: 'Start with a quick consultation to confirm the right treatment.'
});

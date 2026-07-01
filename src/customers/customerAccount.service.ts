import { randomBytes, randomUUID } from 'crypto';
import { HttpError } from '../shared/errors/httpError';
import { customerAccountRepository } from './customerAccount.repository';
import type {
  CustomerAccount,
  CustomerNotificationSettings,
  CustomerPublicProfile,
  CustomerSocialLoginSettings
} from './customerAccount.types';

export interface UpsertCustomerInput {
  phone: string;
  name?: string;
  email?: string;
}

export interface UpsertEmailCustomerInput {
  email: string;
  name?: string;
}

export interface UpdateCustomerProfileInput {
  name?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
}

const normalizePhone = (phone: string): string => phone.trim().replace(/[^\d+]/g, '');

const createSessionToken = (): string => randomBytes(32).toString('hex');

const defaultNotifications = (): CustomerNotificationSettings => ({
  appointmentTextMessage: true,
  appointmentWhatsapp: true,
  marketingEmail: true,
  marketingTextMessage: true,
  marketingWhatsapp: true
});

const defaultSocialLogins = (): CustomerSocialLoginSettings => ({
  facebookConnected: false,
  googleConnected: false
});

const serializeCustomer = (customer: CustomerAccount): CustomerPublicProfile => ({
  id: customer.id,
  phone: customer.phone,
  name: customer.name,
  email: customer.email,
  dateOfBirth: customer.dateOfBirth,
  gender: customer.gender,
  addresses: customer.addresses,
  favoriteSalonIds: customer.favoriteSalonIds,
  wallet: customer.wallet,
  notifications: customer.notifications,
  socialLogins: customer.socialLogins
});

const createCustomer = (input: UpsertCustomerInput): CustomerAccount => {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    phone: normalizePhone(input.phone),
    name: input.name?.trim() ?? '',
    email: input.email?.trim() ?? '',
    dateOfBirth: '',
    gender: '',
    addresses: [],
    favoriteSalonIds: [],
    wallet: {
      balanceMinor: 0,
      currencyCode: 'USD',
      giftCards: [],
      cards: []
    },
    notifications: defaultNotifications(),
    socialLogins: defaultSocialLogins(),
    sessionToken: createSessionToken(),
    createdAt: now,
    updatedAt: now
  };
};

export const customerAccountService = {
  serializeCustomer,

  async upsertVerifiedCustomerByEmail(input: UpsertEmailCustomerInput): Promise<CustomerAccount> {
    const normalizedEmail = input.email.trim().toLowerCase();
    const existingCustomer = await customerAccountRepository.getCustomerByEmail(normalizedEmail);
    const now = new Date().toISOString();

    if (!existingCustomer) {
      const newCustomer: CustomerAccount = {
        id: randomUUID(),
        phone: '',
        name: input.name?.trim() ?? '',
        email: normalizedEmail,
        dateOfBirth: '',
        gender: '',
        addresses: [],
        favoriteSalonIds: [],
        wallet: { balanceMinor: 0, currencyCode: 'USD', giftCards: [], cards: [] },
        notifications: defaultNotifications(),
        socialLogins: defaultSocialLogins(),
        sessionToken: createSessionToken(),
        createdAt: now,
        updatedAt: now
      };
      return customerAccountRepository.saveCustomer(newCustomer);
    }

    return customerAccountRepository.saveCustomer({
      ...existingCustomer,
      name: input.name?.trim() || existingCustomer.name,
      sessionToken: createSessionToken(),
      updatedAt: now
    });
  },

  async upsertVerifiedCustomer(input: UpsertCustomerInput): Promise<CustomerAccount> {
    const phone = normalizePhone(input.phone);
    const existingCustomer = await customerAccountRepository.getCustomerByPhone(phone);
    const now = new Date().toISOString();

    if (!existingCustomer) {
      return customerAccountRepository.saveCustomer(createCustomer({ ...input, phone }));
    }

    const updatedCustomer: CustomerAccount = {
      ...existingCustomer,
      name: input.name?.trim() || existingCustomer.name,
      email: input.email?.trim() || existingCustomer.email,
      sessionToken: createSessionToken(),
      updatedAt: now
    };

    return customerAccountRepository.saveCustomer(updatedCustomer);
  },

  async getCustomerBySessionToken(sessionToken: string): Promise<CustomerAccount> {
    const customer = await customerAccountRepository.getCustomerBySessionToken(sessionToken.trim());

    if (!customer) {
      throw new HttpError(401, 'Customer login is required');
    }

    return customer;
  },

  async updateProfile(
    sessionToken: string,
    input: UpdateCustomerProfileInput
  ): Promise<CustomerAccount> {
    const customer = await this.getCustomerBySessionToken(sessionToken);
    const phone = input.phone?.trim() ? normalizePhone(input.phone) : customer.phone;

    const updatedCustomer: CustomerAccount = {
      ...customer,
      name: input.name?.trim() ?? customer.name,
      email: input.email?.trim() ?? customer.email,
      phone,
      dateOfBirth: input.dateOfBirth?.trim() ?? customer.dateOfBirth,
      gender: input.gender?.trim() ?? customer.gender,
      updatedAt: new Date().toISOString()
    };

    return customerAccountRepository.saveCustomer(updatedCustomer);
  },

  async addFavorite(sessionToken: string, salonId: string): Promise<CustomerAccount> {
    const customer = await this.getCustomerBySessionToken(sessionToken);
    const favoriteSalonIds = new Set(customer.favoriteSalonIds);
    favoriteSalonIds.add(salonId);

    return customerAccountRepository.saveCustomer({
      ...customer,
      favoriteSalonIds: [...favoriteSalonIds],
      updatedAt: new Date().toISOString()
    });
  },

  async removeFavorite(sessionToken: string, salonId: string): Promise<CustomerAccount> {
    const customer = await this.getCustomerBySessionToken(sessionToken);
    const favoriteSalonIds = customer.favoriteSalonIds.filter((id) => id !== salonId);

    return customerAccountRepository.saveCustomer({
      ...customer,
      favoriteSalonIds,
      updatedAt: new Date().toISOString()
    });
  },

  async updateSettings(
    sessionToken: string,
    notifications: CustomerNotificationSettings,
    socialLogins: CustomerSocialLoginSettings
  ): Promise<CustomerAccount> {
    const customer = await this.getCustomerBySessionToken(sessionToken);

    return customerAccountRepository.saveCustomer({
      ...customer,
      notifications,
      socialLogins,
      updatedAt: new Date().toISOString()
    });
  }
};

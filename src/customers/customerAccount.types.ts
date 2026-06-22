export interface CustomerAddress {
  id: string;
  label: 'home' | 'work' | 'other';
  address: string;
}

export interface CustomerNotificationSettings {
  appointmentTextMessage: boolean;
  appointmentWhatsapp: boolean;
  marketingEmail: boolean;
  marketingTextMessage: boolean;
  marketingWhatsapp: boolean;
}

export interface CustomerSocialLoginSettings {
  facebookConnected: boolean;
  googleConnected: boolean;
}

export interface CustomerWallet {
  balanceMinor: number;
  currencyCode: string;
  giftCards: string[];
  cards: string[];
}

export interface CustomerAccount {
  id: string;
  phone: string;
  name: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  addresses: CustomerAddress[];
  favoriteSalonIds: string[];
  wallet: CustomerWallet;
  notifications: CustomerNotificationSettings;
  socialLogins: CustomerSocialLoginSettings;
  sessionToken: string;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerPublicProfile {
  id: string;
  phone: string;
  name: string;
  email: string;
  dateOfBirth: string;
  gender: string;
  addresses: CustomerAddress[];
  favoriteSalonIds: string[];
  wallet: CustomerWallet;
  notifications: CustomerNotificationSettings;
  socialLogins: CustomerSocialLoginSettings;
}

export type AppointmentStatus = 'booked' | 'cancelled' | 'completed';

export type AppointmentSource =
  | 'qr'
  | 'direct'
  | 'instagram'
  | 'facebook'
  | 'applemaps';

export type PackagePurchaseStatus = 'active' | 'expired' | 'fully_used';

export type LoyaltyRewardStatus = 'available' | 'reserved' | 'redeemed' | 'expired';

export type WaitlistStatus = 'active' | 'offered' | 'claimed' | 'expired' | 'removed';

export type PaymentMethod = 'cash' | 'card' | 'bank_transfer' | 'wallet' | 'other';

export type PaymentEntryType = 'payment' | 'refund';

export type PaymentStatus = 'posted' | 'voided';

export interface BusinessService {
  id: string;
  name: string;
  durationMinutes: number;
  categoryName: string;
  priceLabel: string;
  description: string;
  isActive: boolean;
}

export interface AppointmentRecord {
  id: string;
  businessId: string;
  businessName: string;
  publicAccessToken?: string;
  serviceId?: string;
  categoryName: string;
  serviceName: string;
  teamMemberId?: string;
  teamMemberName?: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  appointmentDate: string;
  appointmentTime: string;
  servicePriceLabel?: string;
  serviceAmountValue?: number;
  currencyCode?: string;
  startAt: string;
  endAt: string;
  status: AppointmentStatus;
  source: AppointmentSource;
  packagePurchaseId?: string;
  packageName?: string;
  loyaltyRewardId?: string;
  loyaltyRewardLabel?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentServiceOption {
  id: string;
  name: string;
  durationMinutes: number;
  categoryName: string;
  priceLabel: string;
  description: string;
}

export interface AppointmentTeamMemberOption {
  id: string;
  name: string;
  role: string;
  openingTime: string;
  closingTime: string;
  offDays: string[];
}

export interface PublicBookingHistoryItem {
  reference: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  customerName: string;
  customerEmail: string;
  packageName?: string;
  loyaltyRewardLabel?: string;
  createdAt: string;
}

export interface ReviewRecord {
  id: string;
  appointmentId: string;
  businessId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface ReviewSummary {
  averageRating: number | null;
  totalReviews: number;
}

export interface CreateAppointmentInput {
  serviceName: string;
  teamMemberId?: string;
  appointmentDate: string;
  appointmentTime: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source?: AppointmentSource;
  packagePurchaseId?: string;
  loyaltyRewardId?: string;
  waitlistEntryId?: string;
  waitlistOfferToken?: string;
}

export interface PublicManagedAppointment {
  id: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  teamMemberName?: string;
  customerName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  bookingLink: string;
}

export interface RescheduleAppointmentInput {
  appointmentDate: string;
  appointmentTime: string;
}

export interface AppointmentRunningLateInput {
  delayMinutes?: number;
  note?: string;
}

export interface CreateAppointmentPaymentInput {
  amountValue: number;
  method: PaymentMethod;
  note?: string;
}

export interface PaymentRecord {
  id: string;
  businessId: string;
  appointmentId: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  currencyCode: string;
  amountValue: number;
  entryType: PaymentEntryType;
  method: PaymentMethod;
  status: PaymentStatus;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface AppointmentPaymentBalance {
  appointmentId: string;
  customerName: string;
  serviceName: string;
  appointmentDate: string;
  appointmentTime: string;
  status: AppointmentStatus;
  currencyCode: string;
  expectedAmountValue: number;
  paidAmountValue: number;
  outstandingAmountValue: number;
}

export interface PaymentSnapshot {
  currencyCode: string;
  expectedAmountValue: number;
  collectedAmountValue: number;
  pendingAmountValue: number;
  overpaidAmountValue: number;
  recordedPaymentsCount: number;
  outstandingAppointmentsCount: number;
}

export interface NotificationDispatchResult {
  recipient: 'customer' | 'admin';
  channel: 'sms';
  status: 'sent' | 'failed' | 'skipped';
  messageId?: string;
  reason?: string;
}

export interface CreateReviewInput {
  appointmentId: string;
  customerPhone: string;
  reviewerName?: string;
  rating: number;
  comment?: string;
}

export interface PackagePurchaseRecord {
  id: string;
  businessId: string;
  packagePlanId: string;
  packageName: string;
  includedServiceIds: string[];
  customerKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  totalUses: number;
  remainingUses: number;
  priceLabel: string;
  status: PackagePurchaseStatus;
  purchasedAt: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LoyaltyRewardRecord {
  id: string;
  businessId: string;
  customerKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  rewardType: 'discount_percent';
  rewardValue: number;
  includedServiceIds: string[];
  label: string;
  status: LoyaltyRewardStatus;
  earnedFromAppointmentId?: string;
  reservedForAppointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PublicBenefitOption {
  type: 'package' | 'loyalty';
  id: string;
  title: string;
  description: string;
}

export interface SellPackageInput {
  packagePlanId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
}

export interface WaitlistRecord {
  id: string;
  businessId: string;
  serviceId?: string;
  serviceName: string;
  teamMemberId?: string;
  teamMemberName?: string;
  appointmentDate: string;
  preferredTime?: string;
  customerKey: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  source: AppointmentSource;
  status: WaitlistStatus;
  offeredAppointmentDate?: string;
  offeredAppointmentTime?: string;
  offerSentAt?: string;
  offerExpiresAt?: string;
  offerClaimToken?: string;
  claimedAppointmentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWaitlistInput {
  serviceName: string;
  teamMemberId?: string;
  appointmentDate: string;
  preferredTime?: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  source?: AppointmentSource;
}

export interface PublicWaitlistOffer {
  waitlistEntryId: string;
  serviceName: string;
  teamMemberId?: string;
  teamMemberName?: string;
  appointmentDate: string;
  appointmentTime: string;
  offerExpiresAt: string;
}

// Template names must exactly match the Meta-approved templates submitted
// per docs/whatsapp-templates.md. Renaming a template here without also
// renaming (and re-approving) it in WhatsApp Manager will make sends fail.
export const whatsappTemplates = {
  otpVerification: 'otp_verification',
  waitlistSlotOpened: 'waitlist_slot_opened',
  appointmentConfirmed: 'appointment_confirmed',
  appointmentRescheduled: 'appointment_rescheduled',
  appointmentRunningLate: 'appointment_running_late',
  promoPercentOff: 'promo_percent_off',
  promoFlatAmountOff: 'promo_flat_amount_off',
  promoFreeService: 'promo_free_service',
  promoCustomOffer: 'promo_custom_offer',
  promoHappyHour: 'promo_happy_hour',
  promoLastMinuteFill: 'promo_last_minute_fill'
} as const;

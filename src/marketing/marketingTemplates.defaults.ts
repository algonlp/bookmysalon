import type { CampaignTemplateType } from './marketing.types';

export interface CampaignTemplateSeed {
  smsBody: string;
  emailSubject: string;
  emailBodyText: string;
}

// Placeholders substituted per-recipient at send time: {{customerName}},
// {{businessName}}, {{discountLabel}}, {{serviceName}}, {{bookingLink}}.
// happy_hour additionally supports {{startTime}}, {{endTime}}, {{offerName}},
// {{originalPrice}}, {{discountedPrice}}. last_minute_fill additionally
// supports {{slotTime}}, {{seatsLeft}}.
export const defaultCampaignTemplates: Record<CampaignTemplateType, CampaignTemplateSeed> = {
  percent_off: {
    smsBody:
      'Hi {{customerName}}! {{businessName}} has {{discountLabel}} off {{serviceName}} this week. Book now: {{bookingLink}}',
    emailSubject: '{{discountLabel}} off at {{businessName}}',
    emailBodyText:
      'Hi {{customerName}},\n\n{{businessName}} is offering {{discountLabel}} off {{serviceName}} this week. Book your slot before it fills up: {{bookingLink}}\n\nSee you soon!'
  },
  flat_amount_off: {
    smsBody:
      'Hi {{customerName}}! Save {{discountLabel}} on {{serviceName}} at {{businessName}} this week. Book now: {{bookingLink}}',
    emailSubject: 'Save {{discountLabel}} at {{businessName}}',
    emailBodyText:
      'Hi {{customerName}},\n\n{{businessName}} is offering {{discountLabel}} off {{serviceName}} this week. Book your slot before it fills up: {{bookingLink}}\n\nSee you soon!'
  },
  free_service: {
    smsBody:
      'Hi {{customerName}}! Book with {{businessName}} this week and get {{serviceName}} free. Book now: {{bookingLink}}',
    emailSubject: 'A free {{serviceName}} is waiting for you at {{businessName}}',
    emailBodyText:
      'Hi {{customerName}},\n\n{{businessName}} is offering a free {{serviceName}} with your next booking this week: {{bookingLink}}\n\nSee you soon!'
  },
  happy_hour: {
    smsBody:
      '{{startTime}}-{{endTime}}: {{offerName}}! {{serviceName}} now {{discountedPrice}} (was {{originalPrice}}) at {{businessName}}. Book instantly: {{bookingLink}}',
    emailSubject: '{{offerName}}: {{serviceName}} for {{discountedPrice}} ({{startTime}}-{{endTime}})',
    emailBodyText:
      'Hi {{customerName}},\n\n{{businessName}} is running {{offerName}} from {{startTime}} to {{endTime}}: {{serviceName}} for just {{discountedPrice}} (was {{originalPrice}}).\n\nBook instantly: {{bookingLink}}\n\nSee you soon!'
  },
  last_minute_fill: {
    smsBody:
      '{{slotTime}} slot just opened at {{businessName}}! {{discountLabel}} off {{serviceName}}. Book now: {{bookingLink}} (only {{seatsLeft}} left)',
    emailSubject: 'Last-minute opening at {{businessName}} - {{discountLabel}} off',
    emailBodyText:
      'Hi {{customerName}},\n\nA {{slotTime}} slot just opened up at {{businessName}} for {{serviceName}}, and it comes with {{discountLabel}} off.\n\nBook instantly before it is gone: {{bookingLink}}\n\nOnly {{seatsLeft}} spots being offered this round.'
  }
};

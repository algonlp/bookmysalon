import type { NotificationDispatchResult } from '../appointments/appointment.types';

export type EmailLogSource =
  | 'appointment_confirmation'
  | 'appointment_rescheduled'
  | 'welcome'
  | 'marketing_campaign'
  | 'unknown';

export interface EmailLogRecord {
  id: string;
  businessId: string;
  appointmentId?: string;
  recipient: NotificationDispatchResult['recipient'];
  destination: string;
  status: NotificationDispatchResult['status'];
  source: EmailLogSource;
  subject: string;
  reason?: string;
  createdAt: string;
}

export interface EmailDispatchContext {
  businessId: string;
  appointmentId?: string;
  source?: EmailLogSource;
}

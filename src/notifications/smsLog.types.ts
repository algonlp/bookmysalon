import type { NotificationDispatchResult } from '../appointments/appointment.types';

export type SmsLogSource =
  | 'appointment_confirmation'
  | 'appointment_rescheduled'
  | 'running_late'
  | 'waitlist_offer'
  | 'unknown';

export interface SmsLogRecord {
  id: string;
  businessId: string;
  appointmentId?: string;
  waitlistEntryId?: string;
  recipient: NotificationDispatchResult['recipient'];
  channel: NotificationDispatchResult['channel'];
  destination: string;
  status: NotificationDispatchResult['status'];
  source: SmsLogSource;
  body: string;
  messageId?: string;
  reason?: string;
  createdAt: string;
}

export interface SmsDispatchContext {
  businessId: string;
  appointmentId?: string;
  waitlistEntryId?: string;
  source?: SmsLogSource;
}

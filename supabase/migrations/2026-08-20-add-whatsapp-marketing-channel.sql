-- Adds WhatsApp as a first-class marketing campaign channel, alongside the
-- existing SMS and email channels. Run this once against your live Supabase
-- database (SQL Editor) before deploying the WhatsApp campaign code.
--
-- Safe to run more than once (every statement is idempotent).
-- See docs/whatsapp-templates.md for the WhatsApp templates this depends on.

-- 1. Two new channel choices: WhatsApp-only, and "all three channels".
alter type marketing_channel add value if not exists 'whatsapp';
alter type marketing_channel add value if not exists 'all';

-- 2. Per-recipient WhatsApp delivery tracking, matching the existing
--    sms_status/sms_reason/sms_message_id columns.
alter table marketing_campaign_recipients
  add column if not exists whatsapp_status marketing_dispatch_status not null default 'pending';
alter table marketing_campaign_recipients
  add column if not exists whatsapp_reason text not null default '';
alter table marketing_campaign_recipients
  add column if not exists whatsapp_message_id text not null default '';

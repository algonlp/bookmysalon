create table if not exists client_platform_clients (
  id text primary key,
  email text not null default '',
  business_name text not null default '',
  mobile_number text not null default '',
  payload jsonb not null
);

create index if not exists client_platform_clients_email_idx
  on client_platform_clients (email);

create table if not exists subscription_plan_records (
  id text primary key,
  plan_key text not null unique,
  is_active boolean not null default true,
  display_order integer not null default 0,
  payload jsonb not null
);

create index if not exists subscription_plan_records_active_idx
  on subscription_plan_records (is_active, display_order);

create table if not exists business_subscription_records (
  id text primary key,
  business_id text not null default '',
  plan_id text not null default '',
  status text not null default '',
  payload jsonb not null
);

create index if not exists business_subscription_records_business_id_idx
  on business_subscription_records (business_id);

create index if not exists business_subscription_records_status_idx
  on business_subscription_records (status);

create table if not exists billing_invoice_records (
  id text primary key,
  business_id text not null default '',
  subscription_id text not null default '',
  status text not null default '',
  payload jsonb not null
);

create index if not exists billing_invoice_records_business_id_idx
  on billing_invoice_records (business_id);

create index if not exists billing_invoice_records_subscription_id_idx
  on billing_invoice_records (subscription_id);

insert into subscription_plan_records (id, plan_key, is_active, display_order, payload)
values
  (
    'plan_solo',
    'solo',
    true,
    10,
    '{"id":"plan_solo","key":"solo","name":"Solo","summary":"For one independent professional starting with online bookings and QR links.","amountCents":126000,"currencyCode":"PKR","billingInterval":"month","trialDays":7,"badgeLabel":"7 day trial","isActive":true,"displayOrder":10,"entitlements":{"maxTeamMembers":1,"includedMessages":20,"includedMarketingEmails":50,"includedAppointmentCredits":50,"featureKeys":["online_booking","qr_booking"]},"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_single',
    'single',
    true,
    20,
    '{"id":"plan_single","key":"single","name":"Single","summary":"For a growing business that needs checkout, packages, clients, and reports.","amountCents":249000,"currencyCode":"PKR","billingInterval":"month","trialDays":7,"badgeLabel":"Popular","isActive":true,"displayOrder":20,"entitlements":{"maxTeamMembers":3,"includedMessages":100,"includedMarketingEmails":500,"includedAppointmentCredits":150,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports"]},"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_team_premium',
    'team_premium',
    true,
    30,
    '{"id":"plan_team_premium","key":"team_premium","name":"Team Premium","summary":"For teams that need staff calendars, marketing, premium support, and more limits.","amountCents":84000,"currencyCode":"PKR","billingInterval":"month","trialDays":7,"badgeLabel":"Per team member","isActive":true,"displayOrder":30,"entitlements":{"maxTeamMembers":20,"includedMessages":20,"includedMarketingEmails":50,"includedAppointmentCredits":500,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports","team_management","marketing","premium_support"]},"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb
  )
on conflict (id) do update set
  plan_key = excluded.plan_key,
  is_active = excluded.is_active,
  display_order = excluded.display_order,
  payload = excluded.payload;

create table if not exists product_sale_records (
  id text primary key,
  business_id text not null default '',
  product_id text not null default '',
  customer_phone text not null default '',
  sold_at text not null default '',
  payload jsonb not null
);

create index if not exists product_sale_records_business_id_idx
  on product_sale_records (business_id);

create index if not exists product_sale_records_product_id_idx
  on product_sale_records (product_id);

create index if not exists product_sale_records_customer_phone_idx
  on product_sale_records (customer_phone);

create index if not exists product_sale_records_sold_at_idx
  on product_sale_records (sold_at);

create table if not exists appointment_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  appointment_date text not null default '',
  payload jsonb not null
);

create index if not exists appointment_records_business_id_idx
  on appointment_records (business_id);

create index if not exists appointment_records_customer_phone_idx
  on appointment_records (customer_phone);

create table if not exists payment_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  payload jsonb not null
);

create index if not exists payment_records_business_id_idx
  on payment_records (business_id);

create index if not exists payment_records_appointment_id_idx
  on payment_records (appointment_id);

create table if not exists review_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  payload jsonb not null
);

create index if not exists review_records_business_id_idx
  on review_records (business_id);

create index if not exists review_records_appointment_id_idx
  on review_records (appointment_id);

create table if not exists package_purchase_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  payload jsonb not null
);

create index if not exists package_purchase_records_business_id_idx
  on package_purchase_records (business_id);

create table if not exists loyalty_reward_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  payload jsonb not null
);

create index if not exists loyalty_reward_records_business_id_idx
  on loyalty_reward_records (business_id);

create table if not exists waitlist_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  appointment_date text not null default '',
  payload jsonb not null
);

create index if not exists waitlist_records_business_id_idx
  on waitlist_records (business_id);

create index if not exists waitlist_records_customer_phone_idx
  on waitlist_records (customer_phone);

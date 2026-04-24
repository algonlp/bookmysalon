-- Complete Supabase schema for BookMySalon.
--
-- Important:
-- 1. This file is safe to run directly in the Supabase SQL editor.
-- 2. It creates both the current JSONB sync tables and the normalized relational tables.
-- 3. `create table if not exists` and `create index if not exists` keep it re-runnable.
-- 4. Back up production data before applying schema changes.

create extension if not exists pgcrypto;

-- JSONB sync tables used by the current application storage layer.

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

-- Normalized relational tables used by the relational mirror layer.

do $$
begin
  create type auth_provider as enum ('email', 'facebook', 'google', 'apple');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type account_type as enum ('independent', 'team');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type preferred_language as enum (
    'english',
    'urdu',
    'arabic',
    'hindi',
    'spanish',
    'french',
    'german',
    'turkish',
    'portuguese',
    'chinese'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type weekday_id as enum (
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday'
  );
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type service_location as enum ('physical', 'mobile', 'virtual');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type appointment_status as enum ('booked', 'cancelled', 'completed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type appointment_source as enum ('qr', 'direct', 'instagram', 'facebook', 'applemaps');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type package_purchase_status as enum ('active', 'expired', 'fully_used');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type loyalty_reward_status as enum ('available', 'reserved', 'redeemed', 'expired');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type waitlist_status as enum ('active', 'offered', 'claimed', 'expired', 'removed');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type payment_method as enum ('cash', 'card', 'bank_transfer', 'wallet', 'other');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type payment_entry_type as enum ('payment', 'refund');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type payment_status as enum ('posted', 'voided');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type loyalty_reward_type as enum ('discount_percent');
exception
  when duplicate_object then null;
end $$;

create table if not exists businesses (
  id text primary key,
  admin_token text not null,
  email text not null default '',
  mobile_number text not null default '',
  business_phone_number text not null default '',
  provider auth_provider not null,
  business_name text not null default '',
  website text not null default '',
  profile_image_url text not null default '',
  account_type account_type null,
  venue_address text not null default '',
  preferred_language preferred_language null,
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists businesses_email_idx on businesses (email);
create index if not exists businesses_mobile_number_idx on businesses (mobile_number);
create index if not exists businesses_business_name_idx on businesses (business_name);

create table if not exists business_settings (
  business_id text primary key references businesses (id) on delete cascade,
  currency_code text not null default 'PKR',
  currency_locale text not null default 'en-PK',
  slot_times text[] not null default '{}'::text[],
  use_service_templates boolean not null default true,
  report_page_title text not null default '',
  report_page_subtitle text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists business_service_types (
  business_id text not null references businesses (id) on delete cascade,
  service_type text not null,
  created_at timestamptz not null default now(),
  primary key (business_id, service_type)
);

create table if not exists business_service_locations (
  business_id text not null references businesses (id) on delete cascade,
  service_location service_location not null,
  created_at timestamptz not null default now(),
  primary key (business_id, service_location)
);

create table if not exists team_members (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  role text not null default '',
  phone text not null default '',
  expertise text not null default '',
  opening_time time not null default '09:00',
  closing_time time not null default '18:00',
  off_days weekday_id[] not null default '{}'::weekday_id[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists team_members_business_id_idx on team_members (business_id);
create index if not exists team_members_business_active_idx on team_members (business_id, is_active);

create table if not exists services (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  category_name text not null default '',
  price_label text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists services_business_id_idx on services (business_id);
create index if not exists services_business_active_idx on services (business_id, is_active);

create table if not exists products (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  category_name text not null default '',
  sku text not null default '',
  price_label text not null default '',
  stock_quantity integer not null default 0,
  description text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_business_id_idx on products (business_id);
create index if not exists products_business_active_idx on products (business_id, is_active);
create index if not exists products_business_sku_idx on products (business_id, sku);

create table if not exists product_sales (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  product_id text not null references products (id) on delete restrict,
  product_name text not null default '',
  sku text not null default '',
  quantity integer not null check (quantity > 0),
  unit_price_label text not null default '',
  total_price_label text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  sold_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists product_sales_business_id_idx on product_sales (business_id);
create index if not exists product_sales_product_id_idx on product_sales (product_id);
create index if not exists product_sales_customer_phone_idx on product_sales (customer_phone);

create table if not exists package_plans (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  total_uses integer not null check (total_uses > 0),
  price_label text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_plans_business_id_idx on package_plans (business_id);
create index if not exists package_plans_business_active_idx on package_plans (business_id, is_active);

create table if not exists package_plan_services (
  package_plan_id text not null references package_plans (id) on delete cascade,
  service_id text not null references services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (package_plan_id, service_id)
);

create table if not exists loyalty_programs (
  id text primary key,
  business_id text not null unique references businesses (id) on delete cascade,
  is_enabled boolean not null default false,
  trigger_completed_visits integer not null default 0 check (trigger_completed_visits >= 0),
  reward_type loyalty_reward_type not null default 'discount_percent',
  reward_value integer not null default 0 check (reward_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists loyalty_program_services (
  loyalty_program_id text not null references loyalty_programs (id) on delete cascade,
  service_id text not null references services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (loyalty_program_id, service_id)
);

create table if not exists customer_profiles (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  total_visits integer not null default 0,
  booked_visits integer not null default 0,
  completed_visits integer not null default 0,
  cancelled_visits integer not null default 0,
  last_service text not null default '',
  last_appointment_date date null,
  last_appointment_time time null,
  first_seen_at timestamptz not null,
  last_seen_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_profiles_business_id_idx on customer_profiles (business_id);
create index if not exists customer_profiles_customer_phone_idx on customer_profiles (customer_phone);
create index if not exists customer_profiles_customer_email_idx on customer_profiles (customer_email);

create table if not exists package_purchases (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  package_plan_id text not null references package_plans (id) on delete restrict,
  package_name text not null default '',
  customer_key text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  total_uses integer not null check (total_uses >= 0),
  remaining_uses integer not null check (remaining_uses >= 0),
  price_label text not null default '',
  status package_purchase_status not null,
  purchased_at timestamptz not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists package_purchases_business_id_idx on package_purchases (business_id);
create index if not exists package_purchases_customer_phone_idx on package_purchases (customer_phone);
create index if not exists package_purchases_status_idx on package_purchases (status);

create table if not exists package_purchase_services (
  package_purchase_id text not null references package_purchases (id) on delete cascade,
  service_id text not null references services (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (package_purchase_id, service_id)
);

create table if not exists loyalty_rewards (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  customer_key text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  reward_type loyalty_reward_type not null,
  reward_value integer not null check (reward_value >= 0),
  label text not null default '',
  status loyalty_reward_status not null,
  earned_from_appointment_id text null,
  reserved_for_appointment_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_rewards_business_id_idx on loyalty_rewards (business_id);
create index if not exists loyalty_rewards_customer_phone_idx on loyalty_rewards (customer_phone);
create index if not exists loyalty_rewards_status_idx on loyalty_rewards (status);

create table if not exists loyalty_reward_services (
  loyalty_reward_id text not null references loyalty_rewards (id) on delete cascade,
  service_id text not null references services (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (loyalty_reward_id, service_id)
);

create table if not exists appointments (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  business_name text not null default '',
  public_access_token text null,
  service_id text null references services (id) on delete set null,
  category_name text not null default '',
  service_name text not null default '',
  team_member_id text null references team_members (id) on delete set null,
  team_member_name text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  service_location service_location not null,
  customer_address text not null default '',
  appointment_date date not null,
  appointment_time time not null,
  service_price_label text not null default '',
  service_amount_value numeric(12, 2) null,
  currency_code text null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  status appointment_status not null,
  source appointment_source not null,
  package_purchase_id text null references package_purchases (id) on delete set null,
  package_name text not null default '',
  loyalty_reward_id text null references loyalty_rewards (id) on delete set null,
  loyalty_reward_label text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists appointments_business_id_idx on appointments (business_id);
create index if not exists appointments_customer_phone_idx on appointments (customer_phone);
create index if not exists appointments_date_idx on appointments (appointment_date);
create index if not exists appointments_status_idx on appointments (status);
create index if not exists appointments_team_member_id_idx on appointments (team_member_id);

create table if not exists reviews (
  id text primary key,
  appointment_id text not null references appointments (id) on delete cascade,
  business_id text not null references businesses (id) on delete cascade,
  customer_name text not null default '',
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists reviews_business_id_idx on reviews (business_id);
create index if not exists reviews_appointment_id_idx on reviews (appointment_id);

create table if not exists payments (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  appointment_id text not null references appointments (id) on delete cascade,
  customer_name text not null default '',
  service_name text not null default '',
  appointment_date date not null,
  appointment_time time not null,
  currency_code text not null default '',
  amount_value numeric(12, 2) not null,
  entry_type payment_entry_type not null,
  method payment_method not null,
  status payment_status not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payments_business_id_idx on payments (business_id);
create index if not exists payments_appointment_id_idx on payments (appointment_id);
create index if not exists payments_status_idx on payments (status);

create table if not exists waitlist_entries (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  service_id text null references services (id) on delete set null,
  service_name text not null default '',
  team_member_id text null references team_members (id) on delete set null,
  team_member_name text not null default '',
  appointment_date date not null,
  preferred_time time null,
  customer_key text not null default '',
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  source appointment_source not null,
  status waitlist_status not null,
  offered_appointment_date date null,
  offered_appointment_time time null,
  offer_sent_at timestamptz null,
  offer_expires_at timestamptz null,
  offer_claim_token text null,
  claimed_appointment_id text null references appointments (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists waitlist_entries_business_id_idx on waitlist_entries (business_id);
create index if not exists waitlist_entries_customer_phone_idx on waitlist_entries (customer_phone);
create index if not exists waitlist_entries_date_idx on waitlist_entries (appointment_date);
create index if not exists waitlist_entries_status_idx on waitlist_entries (status);

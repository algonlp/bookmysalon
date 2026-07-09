-- Canonical Supabase schema for BookMySalon.
--
-- Important:
-- 1. This file is safe to run directly in the Supabase SQL editor.
-- 2. It creates both the current JSONB sync tables and the normalized relational tables.
-- 3. `create table if not exists` and `create index if not exists` keep it re-runnable.
-- 4. This is the single schema file you should run in Supabase.
-- 5. Back up production data before applying schema changes.

create extension if not exists pgcrypto;

-- ============================================================================
-- JSONB sync tables used by the current application storage layer.
-- ============================================================================

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
    '{"id":"plan_solo","key":"solo","name":"Solo","summary":"For one independent professional with full workspace access until appointment credits run out.","amountCents":126000,"currencyCode":"PKR","billingInterval":"month","trialDays":7,"badgeLabel":"7 day trial","isActive":true,"displayOrder":10,"entitlements":{"maxTeamMembers":1,"includedMessages":20,"includedMarketingEmails":50,"includedAppointmentCredits":50,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports","team_management","marketing","premium_support"]},"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_single',
    'single',
    true,
    20,
    '{"id":"plan_single","key":"single","name":"Single","summary":"For a growing business that needs checkout, packages, clients, and reports.","amountCents":249000,"currencyCode":"PKR","billingInterval":"month","trialDays":7,"badgeLabel":"Popular","isActive":true,"displayOrder":20,"entitlements":{"maxTeamMembers":3,"includedMessages":100,"includedMarketingEmails":500,"includedAppointmentCredits":150,"featureKeys":["online_booking","qr_booking","team_management","payments","service_packages","products","client_crm","advanced_reports"]},"createdAt":"2026-01-01T00:00:00.000Z","updatedAt":"2026-01-01T00:00:00.000Z"}'::jsonb
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

-- ============================================================================
-- Normalized relational tables used by the relational mirror layer.
-- ============================================================================

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
  create type appointment_status as enum ('booked', 'cancelled', 'completed', 'pending_deposit');
exception
  when duplicate_object then null;
end $$;

alter type appointment_status add value if not exists 'pending_deposit';

do $$
begin
  create type appointment_source as enum ('qr', 'direct', 'instagram', 'facebook', 'applemaps');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type package_purchase_status as enum ('pending_payment', 'active', 'expired', 'fully_used', 'payment_failed');
exception
  when duplicate_object then null;
end $$;

alter type package_purchase_status add value if not exists 'pending_payment';
alter type package_purchase_status add value if not exists 'payment_failed';

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

-- Backfill businesses from JSONB client records.
insert into businesses (
  id, admin_token, email, mobile_number, business_phone_number, provider,
  business_name, website, profile_image_url, account_type, venue_address,
  preferred_language, onboarding_completed, created_at, updated_at
)
select
  client.id,
  coalesce(nullif(client.payload->>'adminToken', ''), 'missing-admin-token'),
  coalesce(client.payload->>'email', client.email, ''),
  coalesce(client.payload->>'mobileNumber', client.mobile_number, ''),
  coalesce(client.payload->>'businessPhoneNumber', ''),
  case
    when client.payload->>'provider' in ('email', 'facebook', 'google', 'apple')
      then (client.payload->>'provider')::auth_provider
    else 'email'::auth_provider
  end,
  coalesce(client.payload->>'businessName', client.business_name, ''),
  coalesce(client.payload->>'website', ''),
  coalesce(client.payload->>'profileImageUrl', ''),
  case
    when client.payload->>'accountType' in ('independent', 'team')
      then (client.payload->>'accountType')::account_type
    else null
  end,
  coalesce(client.payload->>'venueAddress', ''),
  case
    when client.payload->>'preferredLanguage' in (
      'english','urdu','arabic','hindi','spanish','french','german','turkish','portuguese','chinese'
    )
      then (client.payload->>'preferredLanguage')::preferred_language
    else null
  end,
  coalesce((client.payload->>'onboardingCompleted')::boolean, false),
  coalesce((client.payload->>'createdAt')::timestamptz, now()),
  coalesce((client.payload->>'updatedAt')::timestamptz, now())
from client_platform_clients as client
on conflict (id) do update set
  admin_token = excluded.admin_token,
  email = excluded.email,
  mobile_number = excluded.mobile_number,
  business_phone_number = excluded.business_phone_number,
  provider = excluded.provider,
  business_name = excluded.business_name,
  website = excluded.website,
  profile_image_url = excluded.profile_image_url,
  account_type = excluded.account_type,
  venue_address = excluded.venue_address,
  preferred_language = excluded.preferred_language,
  onboarding_completed = excluded.onboarding_completed,
  updated_at = excluded.updated_at;

create table if not exists business_gallery_images (
  id text primary key default gen_random_uuid()::text,
  business_id text not null references businesses (id) on delete cascade,
  image_url text not null,
  storage_path text not null default '',
  display_order integer not null default 0,
  is_cover boolean not null default false,
  mime_type text not null default '',
  file_size_bytes integer null check (file_size_bytes is null or file_size_bytes >= 0),
  alt_text text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists business_gallery_images_business_id_idx
  on business_gallery_images (business_id);

create index if not exists business_gallery_images_business_order_idx
  on business_gallery_images (business_id, display_order);

create unique index if not exists business_gallery_images_one_cover_idx
  on business_gallery_images (business_id)
  where is_cover = true;

-- Backfill gallery images from JSONB client records.
insert into business_gallery_images (
  business_id, image_url, display_order, is_cover, created_at, updated_at
)
select
  client.id,
  image.value,
  (image.ordinality - 1)::integer,
  image.ordinality = 1,
  now(),
  now()
from client_platform_clients as client
cross join lateral jsonb_array_elements_text(
  coalesce(client.payload->'galleryImageUrls', '[]'::jsonb)
) with ordinality as image(value, ordinality)
where image.value <> ''
  and exists (
    select 1 from businesses as business where business.id = client.id
  )
on conflict do nothing;

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

create table if not exists business_stripe_connect_accounts (
  business_id text primary key references businesses (id) on delete cascade,
  stripe_account_id text not null unique,
  charges_enabled boolean not null default false,
  payouts_enabled boolean not null default false,
  details_submitted boolean not null default false,
  requirements_due text[] not null default '{}'::text[],
  disabled_reason text not null default '',
  country text not null default '',
  default_currency text not null default '',
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
  email text null,
  expertise text not null default '',
  opening_time time not null default '09:00',
  closing_time time not null default '18:00',
  off_days weekday_id[] not null default '{}'::weekday_id[],
  is_active boolean not null default true,
  username text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table team_members add column if not exists email text null;
alter table team_members add column if not exists username text null;

create index if not exists team_members_business_id_idx on team_members (business_id);
create index if not exists team_members_business_active_idx on team_members (business_id, is_active);
create unique index if not exists team_members_username_idx on team_members (lower(username)) where username is not null;

create table if not exists services (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  duration_minutes integer not null check (duration_minutes > 0),
  category_name text not null default '',
  price_label text not null default '',
  description text not null default '',
  is_active boolean not null default true,
  is_special_service boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table services add column if not exists is_special_service boolean not null default false;

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
  amount_cents integer null check (amount_cents is null or amount_cents > 0),
  currency_code text not null default '',
  expires_at timestamptz null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table package_plans add column if not exists expires_at timestamptz null;
alter table package_plans add column if not exists amount_cents integer null;
alter table package_plans add column if not exists currency_code text not null default '';

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
  amount_cents integer null check (amount_cents is null or amount_cents > 0),
  currency_code text not null default '',
  payment_provider text not null default '',
  provider_checkout_session_id text not null default '',
  provider_payment_intent_id text not null default '',
  status package_purchase_status not null,
  purchased_at timestamptz not null,
  expires_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table package_purchases add column if not exists amount_cents integer null;
alter table package_purchases add column if not exists currency_code text not null default '';
alter table package_purchases add column if not exists payment_provider text not null default '';
alter table package_purchases add column if not exists provider_checkout_session_id text not null default '';
alter table package_purchases add column if not exists provider_payment_intent_id text not null default '';

create index if not exists package_purchases_business_id_idx on package_purchases (business_id);
create index if not exists package_purchases_customer_phone_idx on package_purchases (customer_phone);
create index if not exists package_purchases_status_idx on package_purchases (status);
create index if not exists package_purchases_provider_checkout_session_id_idx
  on package_purchases (provider_checkout_session_id);

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
  package_plan_id text null,
  package_purchase_id text null references package_purchases (id) on delete set null,
  package_name text not null default '',
  package_price_label text not null default '',
  package_total_uses integer null check (package_total_uses is null or package_total_uses >= 0),
  loyalty_reward_id text null references loyalty_rewards (id) on delete set null,
  loyalty_reward_label text not null default '',
  deposit_amount_value numeric(12, 2) null,
  deposit_currency_code text null,
  deposit_checkout_session_id text null,
  deposit_paid_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table appointments add column if not exists package_plan_id text null;
alter table appointments add column if not exists package_price_label text not null default '';
alter table appointments add column if not exists package_total_uses integer null;
alter table appointments add column if not exists deposit_amount_value numeric(12, 2) null;
alter table appointments add column if not exists deposit_currency_code text null;
alter table appointments add column if not exists deposit_checkout_session_id text null;
alter table appointments add column if not exists deposit_paid_at timestamptz null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_package_plan_id_fkey'
  ) then
    alter table appointments
      add constraint appointments_package_plan_id_fkey
      foreign key (package_plan_id) references package_plans (id) on delete set null;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_package_total_uses_check'
  ) then
    alter table appointments
      add constraint appointments_package_total_uses_check
      check (package_total_uses is null or package_total_uses >= 0);
  end if;
end $$;

create index if not exists appointments_business_id_idx on appointments (business_id);
create index if not exists appointments_customer_phone_idx on appointments (customer_phone);
create index if not exists appointments_date_idx on appointments (appointment_date);
create index if not exists appointments_status_idx on appointments (status);
create index if not exists appointments_team_member_id_idx on appointments (team_member_id);
create index if not exists appointments_package_plan_id_idx on appointments (package_plan_id);

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
  service_amount_value numeric(12, 2) null,
  tip_amount_value numeric(12, 2) not null default 0,
  tip_recipient_name text not null default '',
  entry_type payment_entry_type not null,
  method payment_method not null,
  status payment_status not null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table payments add column if not exists service_amount_value numeric(12, 2) null;
alter table payments add column if not exists tip_amount_value numeric(12, 2) not null default 0;
alter table payments add column if not exists tip_recipient_name text not null default '';

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

-- ============================================================================
-- Marketing campaigns: idle-time discount blasts (SMS/email) to a business's
-- existing clients and/or an uploaded CSV contact list, with booking
-- attribution back to the campaign that drove it.
-- ============================================================================

do $$
begin
  create type marketing_template_type as enum (
    'percent_off',
    'flat_amount_off',
    'free_service',
    'happy_hour',
    'last_minute_fill'
  );
exception
  when duplicate_object then null;
end $$;

alter type marketing_template_type add value if not exists 'happy_hour';
alter type marketing_template_type add value if not exists 'last_minute_fill';

do $$
begin
  create type marketing_channel as enum ('sms', 'email', 'both');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type marketing_recipient_source as enum ('existing_clients', 'csv_upload', 'both', 'random_batch');
exception
  when duplicate_object then null;
end $$;

alter type marketing_recipient_source add value if not exists 'random_batch';

do $$
begin
  create type marketing_campaign_status as enum ('draft', 'sending', 'sent', 'failed', 'partially_sent');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type marketing_dispatch_status as enum ('pending', 'sent', 'failed', 'skipped', 'not_applicable');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type marketing_recipient_origin as enum ('existing_client', 'csv_upload');
exception
  when duplicate_object then null;
end $$;

create table if not exists marketing_campaign_templates (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  template_type marketing_template_type not null,
  sms_body text not null default '',
  email_subject text not null default '',
  email_body_text text not null default '',
  default_discount_percent numeric(5, 2) null check (default_discount_percent is null or (default_discount_percent > 0 and default_discount_percent <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, template_type)
);

alter table marketing_campaign_templates add column if not exists default_discount_percent numeric(5, 2) null;

create index if not exists marketing_campaign_templates_business_id_idx
  on marketing_campaign_templates (business_id);

create table if not exists marketing_campaigns (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null default '',
  template_type marketing_template_type not null,
  discount_percent numeric(5, 2) null check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
  discount_amount_cents integer null check (discount_amount_cents is null or discount_amount_cents > 0),
  currency_code text not null default '',
  target_service_id text null references services (id) on delete set null,
  target_service_name text not null default '',
  free_service_id text null references services (id) on delete set null,
  free_service_name text not null default '',
  happy_hour_start_time time null,
  happy_hour_end_time time null,
  offer_name text not null default '',
  original_price_cents integer null check (original_price_cents is null or original_price_cents > 0),
  discounted_price_cents integer null check (discounted_price_cents is null or discounted_price_cents > 0),
  fill_slot_date date null,
  fill_slot_time time null,
  is_auto_generated boolean not null default false,
  sms_body text not null default '',
  email_subject text not null default '',
  email_body_text text not null default '',
  channel marketing_channel not null,
  recipient_source marketing_recipient_source not null,
  status marketing_campaign_status not null default 'draft',
  recipients_total integer not null default 0,
  recipients_sent integer not null default 0,
  recipients_failed integer not null default 0,
  recipients_skipped integer not null default 0,
  link_opens_count integer not null default 0,
  booking_link text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null
);

alter table marketing_campaigns add column if not exists link_opens_count integer not null default 0;
alter table marketing_campaigns add column if not exists happy_hour_start_time time null;
alter table marketing_campaigns add column if not exists happy_hour_end_time time null;
alter table marketing_campaigns add column if not exists offer_name text not null default '';
alter table marketing_campaigns add column if not exists original_price_cents integer null;
alter table marketing_campaigns add column if not exists discounted_price_cents integer null;
alter table marketing_campaigns add column if not exists fill_slot_date date null;
alter table marketing_campaigns add column if not exists fill_slot_time time null;
alter table marketing_campaigns add column if not exists is_auto_generated boolean not null default false;

create index if not exists marketing_campaigns_business_id_idx on marketing_campaigns (business_id);
create index if not exists marketing_campaigns_status_idx on marketing_campaigns (status);

create table if not exists marketing_campaign_recipients (
  id text primary key,
  campaign_id text not null references marketing_campaigns (id) on delete cascade,
  business_id text not null references businesses (id) on delete cascade,
  origin marketing_recipient_origin not null,
  customer_profile_id text null references customer_profiles (id) on delete set null,
  customer_name text not null default '',
  customer_phone text not null default '',
  customer_email text not null default '',
  dedupe_key text not null default '',
  sms_status marketing_dispatch_status not null default 'pending',
  sms_reason text not null default '',
  sms_message_id text not null default '',
  email_status marketing_dispatch_status not null default 'pending',
  email_reason text not null default '',
  converted_appointment_id text null references appointments (id) on delete set null,
  converted_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, dedupe_key)
);

create index if not exists marketing_campaign_recipients_campaign_id_idx
  on marketing_campaign_recipients (campaign_id);
create index if not exists marketing_campaign_recipients_business_id_idx
  on marketing_campaign_recipients (business_id);
create index if not exists marketing_campaign_recipients_phone_idx
  on marketing_campaign_recipients (customer_phone);
create index if not exists marketing_campaign_recipients_email_idx
  on marketing_campaign_recipients (customer_email);
create index if not exists marketing_campaign_recipients_converted_appointment_idx
  on marketing_campaign_recipients (converted_appointment_id);

alter table appointments add column if not exists campaign_id text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_campaign_id_fkey'
  ) then
    alter table appointments
      add constraint appointments_campaign_id_fkey
      foreign key (campaign_id) references marketing_campaigns (id) on delete set null;
  end if;
end $$;

create index if not exists appointments_campaign_id_idx on appointments (campaign_id);

-- ============================================================================
-- Row Level Security: deny all access via anon/publishable key.
-- The service role key (used by the app server) bypasses RLS automatically.
-- ============================================================================

alter table client_platform_clients enable row level security;
alter table subscription_plan_records enable row level security;
alter table business_subscription_records enable row level security;
alter table billing_invoice_records enable row level security;
alter table product_sale_records enable row level security;
alter table appointment_records enable row level security;
alter table payment_records enable row level security;
alter table review_records enable row level security;
alter table package_purchase_records enable row level security;
alter table loyalty_reward_records enable row level security;
alter table waitlist_records enable row level security;

alter table businesses enable row level security;
alter table business_gallery_images enable row level security;
alter table business_settings enable row level security;
alter table business_stripe_connect_accounts enable row level security;
alter table business_service_types enable row level security;
alter table business_service_locations enable row level security;
alter table team_members enable row level security;
alter table services enable row level security;
alter table products enable row level security;
alter table product_sales enable row level security;
alter table package_plans enable row level security;
alter table package_plan_services enable row level security;
alter table loyalty_programs enable row level security;
alter table loyalty_program_services enable row level security;
alter table customer_profiles enable row level security;
alter table package_purchases enable row level security;
alter table package_purchase_services enable row level security;
alter table loyalty_rewards enable row level security;
alter table loyalty_reward_services enable row level security;
alter table appointments enable row level security;
alter table reviews enable row level security;
alter table payments enable row level security;
alter table waitlist_entries enable row level security;
alter table marketing_campaign_templates enable row level security;
alter table marketing_campaigns enable row level security;
alter table marketing_campaign_recipients enable row level security;

-- ============================================================================
-- Auto-update updated_at on row modification.
-- ============================================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_updated_at on businesses;
create trigger set_updated_at before update on businesses for each row execute function set_updated_at();

drop trigger if exists set_updated_at on business_gallery_images;
create trigger set_updated_at before update on business_gallery_images for each row execute function set_updated_at();

drop trigger if exists set_updated_at on business_settings;
create trigger set_updated_at before update on business_settings for each row execute function set_updated_at();

drop trigger if exists set_updated_at on business_stripe_connect_accounts;
create trigger set_updated_at before update on business_stripe_connect_accounts for each row execute function set_updated_at();

drop trigger if exists set_updated_at on team_members;
create trigger set_updated_at before update on team_members for each row execute function set_updated_at();

drop trigger if exists set_updated_at on services;
create trigger set_updated_at before update on services for each row execute function set_updated_at();

drop trigger if exists set_updated_at on products;
create trigger set_updated_at before update on products for each row execute function set_updated_at();

drop trigger if exists set_updated_at on product_sales;
create trigger set_updated_at before update on product_sales for each row execute function set_updated_at();

drop trigger if exists set_updated_at on package_plans;
create trigger set_updated_at before update on package_plans for each row execute function set_updated_at();

drop trigger if exists set_updated_at on loyalty_programs;
create trigger set_updated_at before update on loyalty_programs for each row execute function set_updated_at();

drop trigger if exists set_updated_at on customer_profiles;
create trigger set_updated_at before update on customer_profiles for each row execute function set_updated_at();

drop trigger if exists set_updated_at on package_purchases;
create trigger set_updated_at before update on package_purchases for each row execute function set_updated_at();

drop trigger if exists set_updated_at on loyalty_rewards;
create trigger set_updated_at before update on loyalty_rewards for each row execute function set_updated_at();

drop trigger if exists set_updated_at on appointments;
create trigger set_updated_at before update on appointments for each row execute function set_updated_at();

drop trigger if exists set_updated_at on payments;
create trigger set_updated_at before update on payments for each row execute function set_updated_at();

drop trigger if exists set_updated_at on waitlist_entries;
create trigger set_updated_at before update on waitlist_entries for each row execute function set_updated_at();

drop trigger if exists set_updated_at on marketing_campaign_templates;
create trigger set_updated_at before update on marketing_campaign_templates for each row execute function set_updated_at();

drop trigger if exists set_updated_at on marketing_campaigns;
create trigger set_updated_at before update on marketing_campaigns for each row execute function set_updated_at();

drop trigger if exists set_updated_at on marketing_campaign_recipients;
create trigger set_updated_at before update on marketing_campaign_recipients for each row execute function set_updated_at();

-- ============================================================================
-- Foreign key constraints for billing JSONB tables.
-- ============================================================================

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'business_subscription_records_business_id_fkey'
  ) then
    alter table business_subscription_records
      add constraint business_subscription_records_business_id_fkey
      foreign key (business_id) references businesses (id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'billing_invoice_records_business_id_fkey'
  ) then
    alter table billing_invoice_records
      add constraint billing_invoice_records_business_id_fkey
      foreign key (business_id) references businesses (id) on delete cascade;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'billing_invoice_records_subscription_id_fkey'
  ) then
    alter table billing_invoice_records
      add constraint billing_invoice_records_subscription_id_fkey
      foreign key (subscription_id) references business_subscription_records (id) on delete cascade;
  end if;
end $$;

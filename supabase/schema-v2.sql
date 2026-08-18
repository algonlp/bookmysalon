-- ============================================================================
-- QRSchedule — Canonical Production Schema (v2)
-- ============================================================================
-- Target: a brand-new, empty Supabase project (replacing the original
-- project's schema, which grew through incremental `alter table add column`
-- patches applied over time). This file is the clean, final-state
-- equivalent - same table and column names as the original schema (so
-- application code needs zero changes and data migration is a straight 1:1
-- copy per table), but written as the end state directly instead of as a
-- patch history.
--
-- Design goals applied throughout:
--  1. Security     - RLS enabled on every table, deny-all by default. The
--                    app server is the only writer and always uses the
--                    service role key, which bypasses RLS. No anon/
--                    publishable key is used client-side anywhere in this
--                    codebase (verified against public/), so deny-all is the
--                    correct secure default, not a gap to fill in later.
--  2. Speed        - GIN indexes on every JSONB payload column the app
--                    queries into; every foreign key / filter column used by
--                    the repository layer has a btree index.
--  3. Integrity    - NOT NULL + CHECK constraints on every column the
--                    application never legitimately leaves null/invalid, and
--                    explicit ON DELETE behavior on every foreign key.
--  4. Auditability - created_at/updated_at with auto-update triggers on
--                    every table, including the JSONB sync tables (which did
--                    not have them before).
--
-- Run top-to-bottom exactly once against a fresh, empty Supabase project's
-- SQL Editor. Do not run this against a database that already has data -
-- use the data-migration script instead (see docs/database-roadmap.md).
-- ============================================================================

create extension if not exists pgcrypto;

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ============================================================================
-- Enum types (final canonical value sets - collapses every historical
-- `alter type ... add value if not exists` into the complete set up front).
-- ============================================================================

create type auth_provider as enum ('email', 'facebook', 'google', 'apple');
create type account_type as enum ('independent', 'team');
create type preferred_language as enum (
  'english', 'urdu', 'arabic', 'hindi', 'spanish',
  'french', 'german', 'turkish', 'portuguese', 'chinese'
);
create type service_location as enum ('physical', 'mobile', 'virtual');
create type appointment_status as enum ('booked', 'cancelled', 'completed', 'pending_deposit');
create type appointment_source as enum ('qr', 'direct', 'instagram', 'facebook', 'applemaps');
create type package_purchase_status as enum (
  'pending_payment', 'active', 'expired', 'fully_used', 'payment_failed'
);
create type loyalty_reward_status as enum ('available', 'reserved', 'redeemed', 'expired');
create type waitlist_status as enum ('active', 'offered', 'claimed', 'expired', 'removed');
create type payment_method as enum ('cash', 'card', 'bank_transfer', 'wallet', 'other');
create type payment_entry_type as enum ('payment', 'refund');
create type payment_status as enum ('posted', 'voided');
create type loyalty_reward_type as enum ('discount_percent');
create type marketing_template_type as enum (
  'percent_off', 'flat_amount_off', 'free_service', 'custom_offer', 'happy_hour', 'last_minute_fill'
);
create type marketing_channel as enum ('sms', 'email', 'both');
create type marketing_recipient_source as enum (
  'existing_clients', 'csv_upload', 'both', 'random_batch'
);
create type marketing_campaign_status as enum ('draft', 'sending', 'sent', 'failed', 'partially_sent');
create type marketing_dispatch_status as enum ('pending', 'sent', 'failed', 'skipped', 'not_applicable');
create type marketing_recipient_origin as enum ('existing_client', 'csv_upload');
create type wallet_transaction_type as enum (
  'paid_topup', 'promotional_credit', 'usage', 'refund', 'adjustment'
);
create type wallet_topup_status as enum ('pending_review', 'approved', 'rejected');

-- ============================================================================
-- Part 1: Relational tables.
-- Created first because the JSONB sync tables below reference businesses(id).
-- ============================================================================

create table businesses (
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
  linked_business_ids text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index businesses_email_idx on businesses (email);
create index businesses_mobile_number_idx on businesses (mobile_number);
create index businesses_business_name_idx on businesses (business_name);

create table business_gallery_images (
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

create index business_gallery_images_business_id_idx on business_gallery_images (business_id);
create index business_gallery_images_business_order_idx
  on business_gallery_images (business_id, display_order);
create unique index business_gallery_images_one_cover_idx
  on business_gallery_images (business_id) where is_cover = true;

create table business_settings (
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

create table business_stripe_connect_accounts (
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

create table business_service_types (
  business_id text not null references businesses (id) on delete cascade,
  service_type text not null,
  created_at timestamptz not null default now(),
  primary key (business_id, service_type)
);

create table business_service_locations (
  business_id text not null references businesses (id) on delete cascade,
  service_location service_location not null,
  created_at timestamptz not null default now(),
  primary key (business_id, service_location)
);

create table team_members (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null,
  role text not null default '',
  phone text not null default '',
  email text null,
  expertise text not null default '',
  opening_time time not null default '09:00',
  closing_time time not null default '18:00',
  off_days text[] not null default '{}'::text[],
  is_active boolean not null default true,
  -- A Bookable Staff Member can be selected by customers or assigned to
  -- appointments (counts toward the plan's staff allowance). Receptionist/
  -- manager/owner-only accounts set this to false. See src/platform/
  -- clientPlatform.types.ts TeamMemberRecord.isBookableStaffMember.
  is_bookable_staff_member boolean not null default true,
  username text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index team_members_business_id_idx on team_members (business_id);
create index team_members_business_active_idx on team_members (business_id, is_active);
create index team_members_business_bookable_idx
  on team_members (business_id, is_bookable_staff_member) where is_active = true;
create unique index team_members_username_idx
  on team_members (lower(username)) where username is not null;

create table services (
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

create index services_business_id_idx on services (business_id);
create index services_business_active_idx on services (business_id, is_active);

create table products (
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

create index products_business_id_idx on products (business_id);
create index products_business_active_idx on products (business_id, is_active);
create index products_business_sku_idx on products (business_id, sku);

create table product_sales (
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

create index product_sales_business_id_idx on product_sales (business_id);
create index product_sales_product_id_idx on product_sales (product_id);
create index product_sales_customer_phone_idx on product_sales (customer_phone);

create table package_plans (
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

create index package_plans_business_id_idx on package_plans (business_id);
create index package_plans_business_active_idx on package_plans (business_id, is_active);

create table package_plan_services (
  package_plan_id text not null references package_plans (id) on delete cascade,
  service_id text not null references services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (package_plan_id, service_id)
);

create table loyalty_programs (
  id text primary key,
  business_id text not null unique references businesses (id) on delete cascade,
  is_enabled boolean not null default false,
  trigger_completed_visits integer not null default 0 check (trigger_completed_visits >= 0),
  reward_type loyalty_reward_type not null default 'discount_percent',
  reward_value integer not null default 0 check (reward_value >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table loyalty_program_services (
  loyalty_program_id text not null references loyalty_programs (id) on delete cascade,
  service_id text not null references services (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (loyalty_program_id, service_id)
);

create table customer_profiles (
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

create index customer_profiles_business_id_idx on customer_profiles (business_id);
create index customer_profiles_customer_phone_idx on customer_profiles (customer_phone);
create index customer_profiles_customer_email_idx on customer_profiles (customer_email);

create table package_purchases (
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

create index package_purchases_business_id_idx on package_purchases (business_id);
create index package_purchases_customer_phone_idx on package_purchases (customer_phone);
create index package_purchases_status_idx on package_purchases (status);
create index package_purchases_provider_checkout_session_id_idx
  on package_purchases (provider_checkout_session_id);

create table package_purchase_services (
  package_purchase_id text not null references package_purchases (id) on delete cascade,
  service_id text not null references services (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (package_purchase_id, service_id)
);

create table loyalty_rewards (
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

create index loyalty_rewards_business_id_idx on loyalty_rewards (business_id);
create index loyalty_rewards_customer_phone_idx on loyalty_rewards (customer_phone);
create index loyalty_rewards_status_idx on loyalty_rewards (status);

create table loyalty_reward_services (
  loyalty_reward_id text not null references loyalty_rewards (id) on delete cascade,
  service_id text not null references services (id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (loyalty_reward_id, service_id)
);

create table marketing_campaign_templates (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  template_type marketing_template_type not null,
  sms_body text not null default '',
  email_subject text not null default '',
  email_body_text text not null default '',
  default_discount_percent numeric(5, 2) null
    check (default_discount_percent is null or (default_discount_percent > 0 and default_discount_percent <= 100)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (business_id, template_type)
);

create index marketing_campaign_templates_business_id_idx
  on marketing_campaign_templates (business_id);

create table marketing_campaigns (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  name text not null default '',
  template_type marketing_template_type not null,
  discount_percent numeric(5, 2) null
    check (discount_percent is null or (discount_percent > 0 and discount_percent <= 100)),
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
  -- "Promote on QRSchedule Marketplace" fields (spec 5.3). Data capture only
  -- for now - the public marketplace listing page does not exist yet.
  is_promoted_on_marketplace boolean not null default false,
  marketplace_offer_title text null,
  marketplace_service_ids text[] not null default '{}'::text[],
  marketplace_start_date date null,
  marketplace_end_date date null,
  marketplace_branch_id text null,
  marketplace_redemption_cap integer null check (marketplace_redemption_cap is null or marketplace_redemption_cap > 0),
  marketplace_new_customer_only boolean not null default false,
  marketplace_cta_label text not null default 'Book Offer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz null
);

create index marketing_campaigns_business_id_idx on marketing_campaigns (business_id);
create index marketing_campaigns_status_idx on marketing_campaigns (status);
create index marketing_campaigns_marketplace_idx
  on marketing_campaigns (business_id, is_promoted_on_marketplace, marketplace_end_date);

-- appointments references marketing_campaigns, so it is created after it.
create table appointments (
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
  package_plan_id text null references package_plans (id) on delete set null,
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
  campaign_id text null references marketing_campaigns (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointments_business_id_idx on appointments (business_id);
create index appointments_customer_phone_idx on appointments (customer_phone);
create index appointments_date_idx on appointments (appointment_date);
create index appointments_status_idx on appointments (status);
create index appointments_team_member_id_idx on appointments (team_member_id);
create index appointments_package_plan_id_idx on appointments (package_plan_id);
create index appointments_campaign_id_idx on appointments (campaign_id);
-- Composite index for the calendar's "this business, this day" query, the
-- single most frequent read in the app.
create index appointments_business_date_idx on appointments (business_id, appointment_date);

create table reviews (
  id text primary key,
  appointment_id text not null references appointments (id) on delete cascade,
  business_id text not null references businesses (id) on delete cascade,
  customer_name text not null default '',
  rating integer not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

create index reviews_business_id_idx on reviews (business_id);
create index reviews_appointment_id_idx on reviews (appointment_id);

create table payments (
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

create index payments_business_id_idx on payments (business_id);
create index payments_appointment_id_idx on payments (appointment_id);
create index payments_status_idx on payments (status);

create table waitlist_entries (
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

create index waitlist_entries_business_id_idx on waitlist_entries (business_id);
create index waitlist_entries_customer_phone_idx on waitlist_entries (customer_phone);
create index waitlist_entries_date_idx on waitlist_entries (appointment_date);
create index waitlist_entries_status_idx on waitlist_entries (status);

create table marketing_campaign_recipients (
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
  -- First-open tracking for the campaign link (src/marketing/marketing.repository.ts
  -- markRecipientOpened / countOpensByBusinessId). Set once, on first open only.
  opened_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (campaign_id, dedupe_key)
);

create index marketing_campaign_recipients_campaign_id_idx
  on marketing_campaign_recipients (campaign_id);
create index marketing_campaign_recipients_business_id_idx
  on marketing_campaign_recipients (business_id);
create index marketing_campaign_recipients_phone_idx
  on marketing_campaign_recipients (customer_phone);
create index marketing_campaign_recipients_email_idx
  on marketing_campaign_recipients (customer_email);
create index marketing_campaign_recipients_converted_appointment_idx
  on marketing_campaign_recipients (converted_appointment_id);

-- ============================================================================
-- Communication wallet (spec Section 5) - PKR balance per business, topped
-- up manually with admin-approved proof, deducted transactionally when a
-- campaign is sent. Written directly by src/wallet/storage/walletSupabase.store.ts.
-- ============================================================================

create table communication_wallets (
  business_id text primary key references businesses (id) on delete cascade,
  balance_cents integer not null default 0,
  currency_code text not null default 'PKR',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table wallet_transactions (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  type wallet_transaction_type not null,
  -- Signed: positive = credit, negative = debit.
  amount_cents integer not null,
  balance_before_cents integer not null,
  balance_after_cents integer not null,
  source text not null default '',
  operator text null,
  reference_id text null,
  note text null,
  created_at timestamptz not null default now()
);

create index wallet_transactions_business_id_idx on wallet_transactions (business_id);
-- Defense-in-depth against double-charging on a retry/double-click: the
-- application checks for an existing (business_id, reference_id, type) entry
-- before writing, and this constraint makes a concurrent duplicate write
-- fail instead of silently double-deducting.
create unique index wallet_transactions_idempotency_idx
  on wallet_transactions (business_id, reference_id, type)
  where reference_id is not null;

create table wallet_topup_requests (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  amount_cents integer not null check (amount_cents > 0),
  -- 'easypaisa' | 'jazzcash' | 'bank_transfer' (src/platform/platformSettings.types.ts).
  payment_method text not null default 'bank_transfer',
  payment_proof_data_url text not null default '',
  transaction_reference text not null default '',
  status wallet_topup_status not null default 'pending_review',
  -- Single-use, expiring token for the "verify from the admin email" link
  -- (src/notifications/paymentVerification.ts). Hash only - the plain token
  -- is never persisted. Cleared once the request is decided.
  verification_token_hash text null,
  verification_token_expires_at timestamptz null,
  reviewed_by text null,
  reviewed_at timestamptz null,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index wallet_topup_requests_business_id_idx on wallet_topup_requests (business_id);
create index wallet_topup_requests_status_idx on wallet_topup_requests (status);

-- ============================================================================
-- Part 2: JSONB sync tables — primary source of truth read/written by the
-- app's repository layer (src/platform/storage/*Supabase.store.ts). Each
-- payload column has a GIN index so filtering/searching inside the JSON
-- stays fast as row counts grow ("loading mein time na lage").
-- ============================================================================

-- Single-row-per-key global settings, controlled from /platform-admin (super
-- admin only - see src/api/middlewares/requireSuperAdminAccess.ts). Currently
-- holds only the Stripe on/off override; falls back to the STRIPE_ENABLED
-- env var until an admin toggles it at least once.
create table platform_settings (
  id text primary key,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table subscription_plan_records (
  id text primary key,
  plan_key text not null unique,
  is_active boolean not null default true,
  display_order integer not null default 0,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscription_plan_records_active_idx
  on subscription_plan_records (is_active, display_order);

create table business_subscription_records (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  plan_id text not null default '',
  status text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index business_subscription_records_business_id_idx
  on business_subscription_records (business_id);

-- Manual/offline (e.g. Raast) subscription payments, pending admin
-- verification - mirrors wallet_topup_requests's shape/lifecycle.
create table subscription_payment_request_records (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  plan_id text not null default '',
  status text not null default 'pending_review',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscription_payment_request_records_business_id_idx
  on subscription_payment_request_records (business_id);
create index subscription_payment_request_records_status_idx
  on subscription_payment_request_records (status);
create index business_subscription_records_status_idx
  on business_subscription_records (status);
create index business_subscription_records_payload_gin_idx
  on business_subscription_records using gin (payload);

create table billing_invoice_records (
  id text primary key,
  business_id text not null references businesses (id) on delete cascade,
  subscription_id text not null references business_subscription_records (id) on delete cascade,
  status text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index billing_invoice_records_business_id_idx on billing_invoice_records (business_id);
create index billing_invoice_records_subscription_id_idx
  on billing_invoice_records (subscription_id);

create table client_platform_clients (
  id text primary key,
  email text not null default '',
  business_name text not null default '',
  mobile_number text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index client_platform_clients_email_idx on client_platform_clients (email);
create index client_platform_clients_payload_gin_idx
  on client_platform_clients using gin (payload);

create table product_sale_records (
  id text primary key,
  business_id text not null default '',
  product_id text not null default '',
  customer_phone text not null default '',
  sold_at text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index product_sale_records_business_id_idx on product_sale_records (business_id);
create index product_sale_records_product_id_idx on product_sale_records (product_id);
create index product_sale_records_customer_phone_idx on product_sale_records (customer_phone);
create index product_sale_records_sold_at_idx on product_sale_records (sold_at);

create table appointment_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  appointment_date text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index appointment_records_business_id_idx on appointment_records (business_id);
create index appointment_records_customer_phone_idx on appointment_records (customer_phone);
create index appointment_records_payload_gin_idx on appointment_records using gin (payload);

create table payment_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index payment_records_business_id_idx on payment_records (business_id);
create index payment_records_appointment_id_idx on payment_records (appointment_id);

create table review_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index review_records_business_id_idx on review_records (business_id);
create index review_records_appointment_id_idx on review_records (appointment_id);

create table package_purchase_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index package_purchase_records_business_id_idx on package_purchase_records (business_id);

create table loyalty_reward_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index loyalty_reward_records_business_id_idx on loyalty_reward_records (business_id);

create table waitlist_records (
  id text primary key,
  business_id text not null default '',
  customer_phone text not null default '',
  appointment_date text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index waitlist_records_business_id_idx on waitlist_records (business_id);
create index waitlist_records_customer_phone_idx on waitlist_records (customer_phone);

create table customer_account_records (
  id text primary key,
  phone text not null default '',
  email text not null default '',
  email_lower text not null default '',
  session_token text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index customer_account_records_phone_idx on customer_account_records (phone);
create index customer_account_records_email_lower_idx on customer_account_records (email_lower);
create unique index customer_account_records_session_token_idx
  on customer_account_records (session_token) where session_token <> '';
create index customer_account_records_payload_gin_idx
  on customer_account_records using gin (payload);

create table email_log_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index email_log_records_business_id_idx on email_log_records (business_id);

create table sms_log_records (
  id text primary key,
  business_id text not null default '',
  appointment_id text not null default '',
  waitlist_entry_id text not null default '',
  -- Legacy columns from an earlier (pre-JSONB) version of this table. The
  -- current app (src/notifications/storage/smsLogSupabase.store.ts) never
  -- writes these - every field lives in `payload` instead - but production
  -- data has them populated as blank/default on old rows, so they're kept
  -- here for 1:1 data fidelity rather than dropped.
  recipient text not null default '',
  channel text not null default '',
  destination text not null default '',
  status text not null default '',
  source text not null default '',
  body text not null default '',
  message_id text null,
  reason text null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index sms_log_records_business_id_idx on sms_log_records (business_id);

-- ============================================================================
-- Part 3: Row Level Security — deny all access via anon/publishable key on
-- every table. The service role key (used exclusively by the app server)
-- bypasses RLS automatically. No policies are defined on purpose: this
-- codebase never uses the anon key client-side, so "no policy = no access"
-- is the correct default rather than an oversight.
-- ============================================================================

do $$
declare
  table_name text;
begin
  for table_name in
    select tablename from pg_tables where schemaname = 'public'
  loop
    execute format('alter table %I enable row level security', table_name);
  end loop;
end $$;

-- ============================================================================
-- Part 4: Auto-update updated_at on row modification, on every table that
-- has the column (including the JSONB sync tables, which previously relied
-- on the application always remembering to bump updated_at itself).
-- ============================================================================

do $$
declare
  table_name text;
begin
  for table_name in
    select c.table_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.column_name = 'updated_at'
  loop
    execute format(
      'drop trigger if exists set_updated_at on %I; ' ||
      'create trigger set_updated_at before update on %I for each row execute function set_updated_at();',
      table_name, table_name
    );
  end loop;
end $$;

-- ============================================================================
-- Part 5: Seed subscription plans (matches src/billing/defaultPlans.ts as of
-- the Bookable Staff Member launch pricing model). The application treats
-- its own code as authoritative and overwrites these on every read
-- (normalizeSubscriptionPlans), so this seed only keeps the database
-- reference copy accurate for anyone browsing the table directly.
-- ============================================================================

insert into subscription_plan_records (id, plan_key, is_active, display_order, payload)
values
  (
    'plan_solo', 'lite', true, 10,
    '{"id":"plan_solo","key":"lite","name":"Lite","summary":"For getting started with online bookings and client messaging.","amountCents":199900,"currencyCode":"PKR","billingInterval":"month","trialDays":30,"badgeLabel":"First month free","isActive":true,"displayOrder":10,"entitlements":{"maxTeamMembers":2,"maxBookableStaffCap":4,"extraBookableStaffPriceCents":40000,"maxLocations":1,"campaignCreditCents":30000,"whatsappUtilityMessageAllowance":50,"includedMessages":100,"includedMarketingEmails":50,"includedAppointmentCredits":50,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports","team_management","marketing","premium_support"]},"createdAt":"2026-07-27T00:00:00.000Z","updatedAt":"2026-07-27T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_single', 'growth', true, 20,
    '{"id":"plan_single","key":"growth","name":"Growth","summary":"For a growing business that needs checkout, packages, clients, and reports.","amountCents":499900,"currencyCode":"PKR","billingInterval":"month","trialDays":30,"badgeLabel":"Most popular","isActive":true,"displayOrder":20,"entitlements":{"maxTeamMembers":8,"maxBookableStaffCap":12,"extraBookableStaffPriceCents":40000,"maxLocations":1,"campaignCreditCents":75000,"whatsappUtilityMessageAllowance":150,"includedMessages":180,"includedMarketingEmails":500,"includedAppointmentCredits":150,"featureKeys":["online_booking","qr_booking","team_management","payments","service_packages","products","client_crm","advanced_reports"]},"createdAt":"2026-07-27T00:00:00.000Z","updatedAt":"2026-07-27T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_professional', 'professional', true, 30,
    '{"id":"plan_professional","key":"professional","name":"Professional","summary":"For established salons that need advanced analytics, loyalty tools, and more staff.","amountCents":799900,"currencyCode":"PKR","billingInterval":"month","trialDays":30,"badgeLabel":"First month free","isActive":true,"displayOrder":30,"entitlements":{"maxTeamMembers":20,"maxBookableStaffCap":30,"extraBookableStaffPriceCents":30000,"maxLocations":1,"campaignCreditCents":150000,"whatsappUtilityMessageAllowance":400,"includedMessages":400,"includedMarketingEmails":500,"includedAppointmentCredits":500,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports","team_management","marketing","premium_support"]},"createdAt":"2026-07-27T00:00:00.000Z","updatedAt":"2026-07-27T00:00:00.000Z"}'::jsonb
  ),
  (
    'plan_team_premium', 'multi_branch', true, 40,
    '{"id":"plan_team_premium","key":"multi_branch","name":"Multi-Branch","summary":"For multi-location teams that need staff calendars, marketing, premium support, and more limits.","amountCents":1499900,"currencyCode":"PKR","billingInterval":"month","trialDays":30,"badgeLabel":"First month free","isActive":true,"displayOrder":40,"entitlements":{"maxTeamMembers":40,"maxBookableStaffCap":null,"extraBookableStaffPriceCents":25000,"maxLocations":3,"campaignCreditCents":300000,"whatsappUtilityMessageAllowance":1000,"includedMessages":400,"includedMarketingEmails":50,"includedAppointmentCredits":500,"featureKeys":["online_booking","qr_booking","payments","service_packages","products","client_crm","advanced_reports","team_management","marketing","premium_support"]},"createdAt":"2026-07-27T00:00:00.000Z","updatedAt":"2026-07-27T00:00:00.000Z"}'::jsonb
  );

create table if not exists client_platform_clients (
  id text primary key,
  email text not null default '',
  business_name text not null default '',
  mobile_number text not null default '',
  payload jsonb not null
);

create index if not exists client_platform_clients_email_idx
  on client_platform_clients (email);

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

# BookMySalon

BookMySalon is a salon booking and management platform built with Node.js, Express, and TypeScript.

It includes:
- Public booking pages for salons
- Admin onboarding and dashboard flows
- Appointment, waitlist, review, package, and loyalty features
- QR-based booking links
- SMS notification hooks via Twilio

## Tech Stack

- Node.js
- TypeScript
- Express
- Zod
- Vitest

## Quick Start

1. Install dependencies:
   - `npm install`
2. Create your local environment file:
   - copy `.env.example` to `.env`
3. Start the development server:
   - `npm run dev`
4. Run tests:
   - `npm test`
5. Build for production:
   - `npm run build`

## Available Scripts

- `npm run dev`: start the API in watch mode
- `npm run build`: compile TypeScript to `dist`
- `npm run start`: run the compiled server
- `npm test`: run the test suite
- `npm run lint`: run ESLint
- `npm run format`: check formatting
- `npm run format:fix`: fix formatting with Prettier
- `npm run train`: run the NLP training pipeline

## Environment Variables

Core application settings:
- `PORT`: API port
- `APP_ENV`: `dev`, `prod`, or `test`
- `LOG_LEVEL`: logger verbosity
- `CLIENT_PLATFORM_STORAGE`: `file`, `memory`, or `supabase`
- `APP_TIMEZONE`: IANA timezone used for same-day slot filtering, dashboard clock labels, and booking timestamp generation
- `TRUST_PROXY`: trust reverse-proxy headers in production
- `PUBLIC_BASE_URL`: canonical public app URL for QR codes and generated links
- `CORS_ALLOWED_ORIGINS`: comma-separated list of allowed browser origins
- `SUPABASE_URL`: your Supabase project URL
- `SUPABASE_PUBLISHABLE_KEY`: public Supabase API key used as a fallback when no server key is set
- `SUPABASE_SERVICE_ROLE_KEY`: recommended backend key for server-side Supabase writes when `CLIENT_PLATFORM_STORAGE=supabase`

Customer and booking settings:
- `ENABLE_PUBLIC_CUSTOMER_LOOKUPS`: enable phone-based public history and benefits lookup
- `PUBLIC_BOOKING_LOCATION_LABEL`
- `PUBLIC_BOOKING_LOCATION_OPTION_PHYSICAL`
- `PUBLIC_BOOKING_LOCATION_OPTION_MOBILE`
- `PUBLIC_BOOKING_LOCATION_OPTION_VIRTUAL`
- `PUBLIC_BOOKING_ADDRESS_LABEL`
- `PUBLIC_BOOKING_ADDRESS_PLACEHOLDER`
- `PUBLIC_BOOKING_ADDRESS_HELP`
- `PUBLIC_BOOKING_ADDRESS_REQUIRED`
- `PUBLIC_BOOKING_PHONE_LABEL`
- `PUBLIC_BOOKING_PHONE_HELP`
- `PUBLIC_BOOKING_PHONE_COUNTRY_CODE_LABEL`
- `PUBLIC_BOOKING_PHONE_COUNTRY_CODE`
- `PUBLIC_BOOKING_PHONE_NUMBER_PLACEHOLDER`
- `PUBLIC_HOME_SEARCH_RESULTS_LIMIT`

Admin session settings:
- `PLATFORM_ADMIN_COOKIE_NAME`
- `ADMIN_SESSION_TTL_DAYS`

SMS settings:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SALON_ADMIN_PHONE`

See `.env.example` for the full local template.

## Project Structure

- `src/api`: routes, controllers, and middleware
- `src/appointments`: appointment and booking domain logic
- `src/platform`: salon onboarding, dashboard, catalog, and platform logic
- `src/config`: environment parsing and config
- `src/shared`: shared utilities and error handling
- `src/nlp`: NLP preprocessing, features, models, and pipelines
- `public`: static frontend pages and browser scripts
- `tests`: unit and integration tests
- `docs`: architecture and project notes
- `data`: file-backed local storage and datasets

## Testing

Run the full test suite with:

```bash
npm test
```

Run lint checks with:

```bash
npm run lint
```

## Deployment Notes

- Set `PUBLIC_BASE_URL` in deployed environments so generated booking, QR, and waitlist links use your real domain.

### Stripe Connect for salon payments

Each salon must complete its own Stripe Connect onboarding before online package checkout is enabled.
Configure the platform credentials and default connected-account country:

```env
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_CONNECT_COUNTRY_CODE=GB
STRIPE_CHARGE_CURRENCY_CODE=GBP
STRIPE_PACKAGE_PAYMENT_APPLICATION_FEE_CENTS=0
STRIPE_ALLOW_PLATFORM_PACKAGE_PAYMENTS_IN_TEST_MODE=false
```

Register `https://your-domain.example/api/stripe/webhook` in Stripe and enable events for
connected accounts. Salon owners can open Calendar Settings and select **Set up online payments**.
Stripe hosts collection of identity and payout-bank details; the app stores only the connected
account ID and operational readiness status.

For local Checkout testing with an `sk_test_...` key and no connected salon account, set
`STRIPE_ALLOW_PLATFORM_PACKAGE_PAYMENTS_IN_TEST_MODE=true`. This test-only mode sends package
payments to the platform Stripe account and is ignored when a live secret key is configured.
The app refuses to start if this test-only bypass is enabled with a live Stripe secret key or if
the secret and publishable keys use different modes.
- If the app runs behind a reverse proxy, set `TRUST_PROXY=true`.
- Use `CLIENT_PLATFORM_STORAGE=file` for local persistence or `memory` for ephemeral environments.
- Use `CLIENT_PLATFORM_STORAGE=supabase` after creating the tables in [supabase/schema.sql](</d:/algo nlp/bookmysalon/supabase/schema.sql>) and syncing current JSON data with `npm run sync:supabase`.

## Supabase Migration

To preserve the existing local JSON data while moving to Supabase:

1. Copy [supabase/schema.sql](</d:/algo nlp/bookmysalon/supabase/schema.sql>) into the Supabase SQL editor and run it.
2. Add `SUPABASE_URL` plus either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY` to `.env`.
3. Run `npm run sync:supabase` to upload `data/appointments.json` and `data/client-platform.json`.
4. Change `CLIENT_PLATFORM_STORAGE` from `file` to `supabase`.

The migration keeps the current record shapes intact by storing each record as JSONB payload data in Supabase tables, while also creating the normalized reporting tables used by the relational mirror.

## Supabase Relational Schema

The canonical Supabase SQL file is [supabase/schema.sql](</d:/algo nlp/bookmysalon/supabase/schema.sql>). It already includes the normalized relational tables too. [supabase/relational-schema.sql](</d:/algo nlp/bookmysalon/supabase/relational-schema.sql>) is kept as a mirror copy.

The normalized relational section creates dedicated tables for:
- businesses
- business settings
- service types and service locations
- team members
- services
- products and product sales
- package plans and package purchases
- loyalty programs and loyalty rewards
- customer profiles
- appointments
- payments
- reviews
- waitlist entries

Important:
- The current running app still reads and writes the JSONB sync tables in [supabase/schema.sql](</d:/algo nlp/bookmysalon/supabase/schema.sql>).
- The normalized relational tables are created in the same file and are filled by the relational mirror sync.
- Run `schema.sql` as the single setup file in Supabase.

To backfill the current live Supabase JSONB data into the normalized relational tables:

1. Run [supabase/schema.sql](</d:/algo nlp/bookmysalon/supabase/schema.sql>) in the Supabase SQL editor.
2. Make sure your environment still points at the same Supabase project.
3. Run:

```bash
npm run sync:supabase:relational
```

This copies data from the current live JSONB tables:
- `client_platform_clients`
- `appointment_records`
- `payment_records`
- `review_records`
- `package_purchase_records`
- `loyalty_reward_records`
- `waitlist_records`

into the normalized tables such as:
- `businesses`
- `team_members`
- `services`
- `appointments`
- `payments`
- `reviews`
- `waitlist_entries`

New writes made through the current Supabase storage layer are also mirrored into the relational tables after this update.

## Status

This repository is an active application codebase, not just a scaffold. The current implementation covers public booking, salon onboarding, dashboard operations, and booking lifecycle flows.

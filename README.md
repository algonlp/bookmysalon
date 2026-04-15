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
- `CLIENT_PLATFORM_STORAGE`: `file` or `memory`
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
- If the app runs behind a reverse proxy, set `TRUST_PROXY=true`.
- Use `CLIENT_PLATFORM_STORAGE=file` for local persistence or `memory` for ephemeral environments.
- Use `CLIENT_PLATFORM_STORAGE=supabase` after creating the tables in [supabase/schema.sql](</d:/algo nlp/fresha project algonlp/supabase/schema.sql>) and syncing current JSON data with `npm run sync:supabase`.

## Supabase Migration

To preserve the existing local JSON data while moving to Supabase:

1. Copy [supabase/schema.sql](</d:/algo nlp/fresha project algonlp/supabase/schema.sql>) into the Supabase SQL editor and run it.
2. Add `SUPABASE_URL` plus either `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_PUBLISHABLE_KEY` to `.env`.
3. Run `npm run sync:supabase` to upload `data/appointments.json` and `data/client-platform.json`.
4. Change `CLIENT_PLATFORM_STORAGE` from `file` to `supabase`.

The migration keeps the current record shapes intact by storing each record as JSONB payload data in Supabase tables.

## Status

This repository is an active application codebase, not just a scaffold. The current implementation covers public booking, salon onboarding, dashboard operations, and booking lifecycle flows.

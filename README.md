# AlgoNLP Fresha Project (Node.js)

Node.js + TypeScript scaffold for NLP ingestion, preprocessing, modeling pipelines, and API serving.

## Quick Start

1. Install dependencies:
   - `npm install`
2. Run in development:
   - `npm run dev`
3. Run tests:
   - `npm test`
4. Run NLP training pipeline:
   - `npm run train`

## Configuration

- `PORT`: API port
- `APP_ENV`: `dev`, `prod`, or `test`
- `LOG_LEVEL`: logger verbosity
- `CLIENT_PLATFORM_STORAGE`: `file` or `memory`
- `TRUST_PROXY`: trust reverse-proxy headers when deployed behind Nginx/Caddy/Cloudflare
- `PUBLIC_BASE_URL`: canonical public origin used for QR, waitlist, and SMS links
- `CORS_ALLOWED_ORIGINS`: comma-separated origins allowed for cross-origin browser calls
- `ENABLE_PUBLIC_CUSTOMER_LOOKUPS`: enable phone-based public history/benefits lookup
- `PLATFORM_ADMIN_COOKIE_NAME`: admin session cookie name
- `ADMIN_SESSION_TTL_DAYS`: admin session cookie lifetime
- `TWILIO_ACCOUNT_SID`: Twilio account SID for SMS
- `TWILIO_AUTH_TOKEN`: Twilio auth token for SMS
- `TWILIO_PHONE_NUMBER`: Twilio sending number
- `SALON_ADMIN_PHONE`: salon/admin phone number to receive booking alerts

## Project Layout

- `src/api`: HTTP layer (routes, controllers, middleware)
- `src/config`: environment/config management
- `src/nlp`: NLP modules (preprocess, features, models, pipelines)
- `src/shared`: shared utilities and error classes
- `tests`: unit/integration tests
- `configs`: environment YAML configs
- `data`: raw/interim/processed datasets
- `models`: trained model artifacts
- `docs`: architecture and roadmap

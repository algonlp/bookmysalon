// Pin env vars the test suite depends on so a developer's local .env
// (which is gitignored and varies per machine) can never silently
// change test behavior. Must run before src/config/env.ts is first
// imported, since dotenv.config() does not override already-set vars.
process.env.APP_ENV = 'test';
process.env.APP_TIMEZONE = 'UTC';
process.env.ENABLE_PUBLIC_CUSTOMER_LOOKUPS = 'true';

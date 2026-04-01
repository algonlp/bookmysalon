# AlgoNLP Fresha Project

## Complete Project Documentation

- Project name: `algonlp-fresha`
- Version: `0.1.0`
- Documentation date: March 12, 2026
- Primary stack: Node.js, TypeScript, Express, vanilla HTML/CSS/JS, Vitest

---

## 1. Executive Summary

AlgoNLP Fresha Project is a service-booking and salon-management prototype inspired by the Fresha product experience. The application combines:

1. a public-facing marketing site,
2. a professional signup and onboarding flow,
3. a business dashboard/calendar experience,
4. a QR-based public appointment booking flow,
5. lightweight JSON-backed persistence,
6. Twilio-ready SMS notification hooks, and
7. an NLP starter scaffold for future AI-enabled features.

The current implementation is best described as a functional product prototype with working booking and onboarding APIs, working UI flows for the implemented features, and several admin/dashboard tools that intentionally act as guided placeholders for future expansion.

---

## 2. Project Goals

The current project is designed to demonstrate how a modern appointment platform can be structured across frontend UX, backend APIs, persistence, and future AI/NLP capability.

### Current goals achieved

- Provide branded marketing and entry pages.
- Allow a professional/business owner to create a client profile.
- Walk the owner through onboarding steps.
- Generate a working business dashboard.
- Expose a public booking page per client.
- Support QR code generation for the booking page.
- Let end customers book appointments against available slots.
- Persist client and appointment data locally.
- Prepare NLP modules for later machine-learning features.

### Strategic direction

The project is positioned as a foundation for a fuller booking SaaS product that can later include payments, availability rules, staff management, analytics, CRM, marketing automation, and AI-driven features.

---

## 3. Technology Stack

### Backend

- Node.js
- TypeScript
- Express
- Zod for request validation
- QRCode package for booking QR generation
- Native `fetch` for Twilio API calls

### Frontend

- Static HTML pages served by Express
- Shared `public/main.js` for frontend behavior
- Shared `public/styles.css` for theming
- No frontend framework; DOM is manipulated directly

### Testing

- Vitest
- Supertest

### Storage

- File-based JSON persistence in `data/`
- In-memory persistence for tests and optional local mode

### Documentation output tooling

- Markdown source

---

## 4. High-Level Architecture

The application follows a clean, simple layered design:

### HTTP Layer

- `src/app.ts` configures Express middleware, static file serving, page routes, and `/api` routes.
- `src/api/routes/*` defines API endpoints.
- `src/api/controllers/*` validates inputs and delegates to services.

### Service Layer

- `src/platform/clientPlatform.service.ts` contains client onboarding and dashboard logic.
- `src/appointments/appointment.service.ts` contains service catalog, slot availability, booking, and appointment lifecycle logic.
- `src/notifications/twilioSms.service.ts` manages optional SMS sending.

### Repository Layer

- `src/platform/clientPlatform.repository.ts`
- `src/appointments/appointment.repository.ts`

These repositories decide whether to use memory or file-backed storage.

### Storage Layer

- File stores persist JSON into `data/client-platform.json` and `data/appointments.json`.
- Memory stores are used in test mode and optional in runtime.

### Frontend Layer

- HTML files in `public/` define the page structure.
- `public/main.js` drives onboarding, dashboard behavior, menu interactions, public booking, and QR modal handling.

### NLP Layer

- `src/nlp/*` contains a basic but expandable NLP pipeline scaffold.

---

## 5. Folder and File Structure

### Core source folders

- `src/api` – routes, controllers, middleware
- `src/platform` – client onboarding and dashboard logic
- `src/appointments` – booking and appointment logic
- `src/notifications` – Twilio SMS integration
- `src/config` – environment variable parsing
- `src/shared` – logging and HTTP error utilities
- `src/nlp` – preprocessing, features, modeling, and training pipeline scaffold

### Frontend and assets

- `public/` – all pages, JavaScript, and CSS

### Data and models

- `data/` – JSON persistence for runtime records
- `models/` – placeholder location for trained NLP artifacts

### Tests

- `tests/integration` – route/page/API integration coverage
- `tests/unit` – unit tests for utility logic

### Documentation

- `docs/architecture.md`
- `docs/roadmap.md`
- `docs/project-documentation.md`

---

## 6. Public Pages and User Experience

The project serves multiple HTML pages directly through Express.

### 6.1 Landing Page (`/`)

Purpose:

- Present the brand
- Provide a customer-oriented first impression
- Offer a demo-style search interaction
- Link users into login and business areas

Current behavior:

- Search UI is interactive but currently acts as a demo/alert flow rather than a real search engine.
- Main business call-to-action routes users toward signup and business pages.

### 6.2 Login Page (`/login`)

Purpose:

- Offer split entry for customers and professionals

Current behavior:

- Static branded page used as an entry point.
- Does not implement real authentication.

### 6.3 Business Marketing Page (`/for-businesses`)

Purpose:

- Present the “software for salons and spas” value proposition
- Promote signup and pricing

Current behavior:

- Static marketing experience with responsive layout and product-preview visuals.

### 6.4 Pricing Page (`/pricing`)

Purpose:

- Show product tiers and pricing concepts

Current behavior:

- Marketing/presentation page only.
- Does not integrate with billing or subscriptions.

### 6.5 Signup Page (`/signup`)

Purpose:

- Start professional onboarding

Current behavior:

- Supports form submission and provider buttons.
- Creates a client record by calling `POST /api/platform/clients`.
- Stores the generated `clientId` in browser `localStorage`.

Important note:

- Provider options (`email`, `facebook`, `google`, `apple`) are currently labels for onboarding source selection, not full OAuth implementations.

---

## 7. Onboarding Flow

The onboarding process is the core admin setup journey.

### Step 1: Business Profile (`/onboarding/business-name`)

User enters:

- business name
- website

Backend endpoint:

- `PATCH /api/platform/clients/:clientId/business-profile`

### Step 2: Service Types (`/onboarding/service-types`)

User selects up to four business categories such as:

- Hair salon
- Barber
- Nails
- Massage
- Beauty salon
- Eyebrows & lashes
- Medspa
- Spa & sauna
- Waxing salon

Backend endpoint:

- `PATCH /api/platform/clients/:clientId/service-types`

### Step 3: Account Type (`/onboarding/account-type`)

Choices:

- independent
- team

Backend endpoint:

- `PATCH /api/platform/clients/:clientId/account-type`

### Step 4: Service Location (`/onboarding/service-location`)

Choices:

- physical
- mobile
- virtual

Backend endpoint:

- `PATCH /api/platform/clients/:clientId/service-location`

### Step 5: Venue Location (`/onboarding/venue-location`)

User selects or searches for a venue address.

Backend endpoint:

- `PATCH /api/platform/clients/:clientId/venue-location`

Important note:

- The venue search is currently a guided UI selection, not a live geocoding/maps integration.

### Step 6: Complete Onboarding

Backend endpoint:

- `POST /api/platform/clients/:clientId/complete`

Result:

- Sets `onboardingCompleted` to `true`
- Redirects to the completion page and then to the calendar/dashboard flow

### Step 7: Completion Page (`/onboarding/complete`)

Purpose:

- Celebrate setup completion
- Provide navigation toward the dashboard

---

## 8. Dashboard and Calendar Functionality

The dashboard is served at `/calendar` and populated dynamically through the client dashboard API.

### Working capabilities

- Loads current client dashboard data from the backend
- Displays business name and owner initials
- Shows appointments on the dashboard and calendar board
- Displays side drawers for:
  - Sales
  - Clients
  - Catalog
  - Team
- Displays a reports view with menu, filters, tabs, and report cards
- Supports date navigation:
  - Today
  - previous day
  - next day
- Supports appointment filtering:
  - all
  - booked
  - QR source
- Supports switching between “Day” and “Agenda” visual modes
- Supports QR modal display for the public booking page
- Supports booking-link sharing

### Drawer behavior

The side drawers are driven by the backend dashboard payload and rendered dynamically in the browser. This makes the dashboard content flexible without changing the HTML shell.

### Reports behavior

The reports section currently supports:

- menu activation
- client-side text filtering
- tab switching
- filter chip switching

This behavior is UI-driven using payload data from the backend.

### Notification behavior

The dashboard derives lightweight notifications from appointment data and shows them in a modal-style panel.

### Current limitations in dashboard tools

Some buttons intentionally open helper modals instead of saving data:

- blocked time
- quick payment
- profile editing
- some settings shortcuts
- marketing tools
- admin shortcuts
- group appointments

These are design placeholders for future implementation, not broken features.

---

## 9. Public Booking and QR Flow

Each client gets a public booking URL:

- `/book/:clientId`

### Implemented functionality

- Loads business name and service categories
- Loads available services based on selected service types
- Loads available appointment slots for the chosen date
- Prevents booking of unavailable or past slots
- Submits new bookings through the API
- Displays booking success feedback
- Refreshes slot availability after booking

### QR code support

Each business can generate an SVG QR code from:

- `GET /api/public/book/:clientId/qr`

The QR code points to the public booking page for the selected client.

### Booking slot rules

Available slots are currently:

- `09:00`
- `10:00`
- `11:00`
- `12:00`
- `14:00`
- `15:00`
- `16:00`
- `17:00`

Rules applied:

- past calendar dates are blocked
- same-day past time slots are blocked
- already booked active slots are blocked
- completed historical appointments no longer reserve future availability

---

## 10. Appointment Lifecycle

Appointments are stored as records containing:

- business identity
- service/category details
- customer details
- appointment date and time
- start/end timestamps
- booking source
- status

### Current statuses

- `booked`
- `cancelled`
- `completed`

### Automatic lifecycle update

The system automatically converts old `booked` appointments to `completed` when their `endAt` time has passed.

This normalization occurs while listing appointments and while computing availability. As a result:

- finished appointments do not continue blocking future slot availability
- the dashboard reflects more realistic appointment status data

### Appointment source

Currently supported source:

- `qr`

This indicates the appointment came through the public QR/booking page flow.

---

## 11. Service Catalog Logic

The service catalog is derived from the selected business categories.

Examples:

- `Barber` → Haircut, Beard trim
- `Hair salon` → Cut and style, Blow dry
- `Massage` → Deep tissue massage, Relaxation massage
- `Nails` → Manicure, Pedicure

If no mapped services are found, the backend returns a fallback:

- `Consultation`

This ensures the booking flow still works even when the business configuration is incomplete or unmapped.

---

## 12. Notifications and Twilio Integration

The booking flow is prepared to send SMS notifications to:

- the customer
- the salon admin

### Twilio behavior

SMS sending is enabled only when all of the following are true:

- `TWILIO_ACCOUNT_SID` exists
- `TWILIO_AUTH_TOKEN` exists
- `TWILIO_PHONE_NUMBER` exists
- `APP_ENV` is not `test`

### Fallback behavior

If Twilio is not configured or the recipient phone is missing, the system returns a structured `skipped` result instead of crashing.

This makes the booking flow safe for development, demo, and test environments.

---

## 13. Persistence and Data Management

The project uses a repository/store pattern with interchangeable storage backends.

### File-backed runtime storage

By default, production-like local runs use JSON files:

- `data/client-platform.json`
- `data/appointments.json`

### In-memory storage

Used when:

- running tests
- or when `CLIENT_PLATFORM_STORAGE=memory`

### Benefits of current storage design

- simple to understand
- easy to inspect manually
- no database setup required
- good for demos and prototyping

### Current limitations

- no concurrency protection
- no indexing
- no query optimization
- no user/session isolation
- not suitable for multi-instance production deployment

---

## 14. API Reference

### Health

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Basic service health response |

### Client platform and onboarding

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/api/platform/clients` | Create a new client/business owner record |
| GET | `/api/platform/clients/:clientId` | Fetch a client record |
| PATCH | `/api/platform/clients/:clientId/business-profile` | Save business name and website |
| PATCH | `/api/platform/clients/:clientId/service-types` | Save selected business categories |
| PATCH | `/api/platform/clients/:clientId/account-type` | Save account type |
| PATCH | `/api/platform/clients/:clientId/service-location` | Save service delivery type |
| PATCH | `/api/platform/clients/:clientId/venue-location` | Save venue address |
| POST | `/api/platform/clients/:clientId/complete` | Mark onboarding complete |
| GET | `/api/platform/clients/:clientId/dashboard` | Fetch dashboard payload |
| GET | `/api/platform/clients/:clientId/appointments` | List business appointments |

### Public booking

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/public/book/:clientId` | Fetch booking page payload and service catalog |
| GET | `/api/public/book/:clientId/slots?date=YYYY-MM-DD` | Fetch available slots for a date |
| POST | `/api/public/book/:clientId/appointments` | Create a booking |
| GET | `/api/public/book/:clientId/qr` | Generate SVG QR code |

### Validation and error response patterns

- Invalid payloads return `400`
- Missing resources return `404`
- conflicting appointment slot selections return `409`
- unexpected server errors return `500`

---

## 15. Frontend Logic Overview

All major frontend behavior lives in `public/main.js`.

### Shared browser responsibilities

- manage client ID in `localStorage`
- read `clientId` from query string
- make API requests
- render dashboard drawers and reports
- manage modals and menus
- handle onboarding page actions
- handle public booking interactions

### Important implementation detail

This project intentionally centralizes most page logic into one shared JavaScript file. That keeps the prototype simple, but future scaling would benefit from modularizing that file by feature area.

---

## 16. Validation, Error Handling, and Reliability

### Request validation

The backend uses Zod to validate:

- signup payloads
- business profile data
- service types
- account type
- service location
- venue address
- booking payloads
- booking date format

### Error middleware

The error handler converts exceptions into consistent JSON responses:

- `HttpError` → explicit status/message
- `ZodError` → `400` with first validation issue
- unknown errors → `500 Internal server error`

### Route-not-found behavior

Unknown routes return:

- `404`
- `{ "error": "Route not found" }`

---

## 17. Testing and Quality Assurance

The project includes both integration and unit tests.

### Integration tests currently verify

- health endpoint
- marketing and onboarding pages are served correctly
- removed routes correctly return `404`
- client creation and onboarding updates
- dashboard payload shape and content
- service-type validation rules
- QR booking flow
- duplicate slot prevention
- appointment listing
- automatic completion of past appointments

### Unit tests currently verify

- text cleaning behavior in the NLP preprocessing layer

### Current quality posture

The app has strong coverage for the currently implemented product flows, especially onboarding and booking. The NLP module has only starter coverage because it is still scaffold-level.

---

## 18. NLP Module Status

The repository includes an NLP scaffold under `src/nlp/`.

### Implemented pieces

- record loading
- text cleaning
- whitespace tokenization
- term-frequency calculation
- placeholder train/predict/evaluate functions
- a runnable training pipeline script

### Current maturity

This part of the project is not yet productized. It is a starter framework intended for later AI features such as:

- customer intent classification
- review sentiment analysis
- search/query understanding
- appointment note tagging
- marketing or CRM automation

---

## 19. Environment Variables

### Required or supported variables

- `PORT`
- `APP_ENV`
- `LOG_LEVEL`
- `CLIENT_PLATFORM_STORAGE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER`
- `SALON_ADMIN_PHONE`

### Behavior notes

- Default port is `8000`
- Test environment uses memory-backed storage
- Twilio credentials are optional

---

## 20. Run, Build, and Test Commands

### Install

`npm install`

### Development server

`npm run dev`

### Build

`npm run build`

### Production-style start

`npm start`

### Test suite

`npm test`

### NLP training pipeline

`npm run train`

---

## 21. Current Limitations

This section is important because the project includes both fully working features and intentional placeholders.

### Fully working core flows

- client creation
- onboarding persistence
- dashboard payload generation
- appointment booking
- QR generation
- slot validation
- appointment status normalization
- basic file persistence

### Not yet fully implemented

- real user authentication and sessions
- provider-based OAuth login
- payment processing
- blocked-time persistence
- true team scheduling rules
- real inventory workflows
- real reporting backend
- live maps/geocoding for venue selection
- customer search engine on landing page
- appointment cancellation/reschedule APIs
- database-backed production persistence
- role-based access control

---

## 22. Future Goals

The following roadmap items would provide the highest product value.

### Product goals

1. Add real authentication and protected business sessions.
2. Add staff/team management with working shift and availability rules.
3. Add recurring schedules, breaks, blocked time, and service capacity logic.
4. Add appointment cancellation, rescheduling, and no-show tracking.
5. Add payment checkout, invoices, and subscription billing.
6. Add CRM features such as client profiles, notes, loyalty, and visit history.
7. Add live analytics based on real transaction and appointment data.
8. Add marketing campaigns for SMS, email, and QR promotions.

### Technical goals

1. Replace JSON-file persistence with PostgreSQL or another production database.
2. Split `public/main.js` into feature modules.
3. Add API versioning and stronger contract documentation.
4. Add structured logging and observability.
5. Add CI automation for tests, linting, formatting, and PDF doc generation.
6. Add security hardening such as rate limiting, CSRF/session strategy, and input abuse protection.

### AI / NLP goals

1. Build intent classification for customer requests and support queries.
2. Add smart search suggestions for services and providers.
3. Analyze review sentiment and highlight quality trends.
4. Summarize dashboard insights in plain language for business owners.
5. Detect booking patterns and recommend staffing or promotional actions.

---

## 23. Recommended Next Milestones

If this project continues, the most sensible next implementation order is:

1. authentication and session management
2. relational database migration
3. real availability rules for staff and services
4. appointment editing/cancellation workflows
5. payments and checkout
6. reporting backend
7. AI/NLP features layered on real business data

---

## 24. Conclusion

AlgoNLP Fresha Project already provides a strong interactive prototype for a salon/spa booking platform. The onboarding flow, dashboard payload generation, QR-based booking flow, and appointment slot logic are implemented and tested. The project is also structured well enough to grow into a fuller SaaS platform.

Its strongest qualities today are:

- clear separation of API, service, repository, and storage layers
- practical working booking flow
- good integration test coverage for important user paths
- straightforward local setup
- a clean path to future AI/NLP expansion

The best next step is to turn the prototype into a real multi-user product by adding authentication, database persistence, richer scheduling rules, and production-grade admin features.

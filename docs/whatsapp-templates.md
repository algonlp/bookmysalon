# WhatsApp Message Templates — Meta Submission Set

**Status: the sending code is now wired in** (`src/notifications/whatsapp.service.ts`,
Meta Cloud API). Every flow below already calls it alongside the existing SMS/email send.
**Nothing will actually send until you do two things:**
1. Set `WHATSAPP_ACCESS_TOKEN` and `WHATSAPP_PHONE_NUMBER_ID` in your environment
   (`.env.example` has the full list, including optional `WHATSAPP_BUSINESS_ACCOUNT_ID`,
   `WHATSAPP_API_VERSION`, `WHATSAPP_TEMPLATE_LANGUAGE`). Until both are set, sends are
   skipped (not an error) — same behavior as Twilio SMS today when unconfigured.
2. Submit and get **every template below approved in Meta Business Manager → WhatsApp
   Manager → Message Templates**, using the exact template names in this doc — the code
   sends by name and Meta rejects sends to unapproved/misnamed templates.

The templates are adapted from the existing SMS/email wording so they're ready to paste
into Meta's template composer.

General notes before submitting:
- All variables use Meta's numbered placeholder syntax `{{1}}`, `{{2}}`, … — a variable
  can't be the first/last token or sit next to another variable, so long links are moved
  into a **dynamic URL button** instead of inline text.
- Language: English (`en_US`) everywhere, matching current app copy. Say the word if you
  also want Roman Urdu / Urdu versions — same variables, different wording.
- Business name (`{{businessName}}` in code) is a variable in every template because one
  WhatsApp number serves all salons on the platform — the WABA display name itself should
  just be your platform brand (e.g. "BookMySalon"), not any one salon.
- Every sample value below is required by Meta's submission form (Content → Samples).

---

## 1. Authentication — OTP

**otp_verification** · Category: `AUTHENTICATION` · Language: `en_US`

Meta's authentication template editor doesn't allow free-form body text — it locks the
body to the code line and lets you toggle two add-ons. Use these settings:
- Body (fixed by Meta): `{{1}} is your verification code.`
- ✅ Add security recommendation → appends "For your security, do not share this code."
- ✅ Add expiry time → set to **10 minutes** (matches current OTP expiry in
  [customerAuth.controller.ts:53](../src/api/controllers/customerAuth.controller.ts#L53) and
  [clientPlatform.controller.ts:496](../src/api/controllers/clientPlatform.controller.ts#L496))
- Button: **Copy code** (One-tap autofill needs a registered Android package + signature
  hash, which doesn't apply to a web app — use Copy code)

Sample: `{{1}}` = `482913`

---

## 2. Utility templates

### waitlist_slot_opened
Category: `UTILITY`

> Good news! A slot just opened up for {{1}} on {{2}}. It's reserved for you for the next
> {{3}} minutes.

Button: **Visit Website (Dynamic)** — label "Claim this slot", base URL = your
`PUBLIC_BASE_URL` + `/`, dynamic suffix = business ID + claim token query string. (No
business-name variable — the waitlist record doesn't carry one; the WABA display name
covers that context.)

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | Service (+ team member if assigned) | Haircut with Ayesha |
| {{2}} | Appointment date/time | Wed, 20 Aug, 4:30 PM |
| {{3}} | Minutes before offer expires | 15 |

Button suffix sample: `book/9f21b7?waitlistEntryId=abc123&waitlistOfferToken=tok456`

---

### appointment_confirmed
Category: `UTILITY`

> Hi! Your appointment at {{1}} is confirmed for {{2}}. Service: {{3}}. Booking reference
> #{{4}}.

Button: **Visit Website (Dynamic)** — label "View booking", base URL + `/b/`, dynamic
suffix = the appointment's public access token.

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | Business name | Glow Salon |
| {{2}} | Appointment date/time | Wed, 20 Aug, 4:30 PM |
| {{3}} | Service (+ package, if any) | Haircut & Beard Trim |
| {{4}} | Short booking reference | 8f3a9c2d |

---

### appointment_rescheduled
Category: `UTILITY`

> Hi! Your appointment at {{1}} has been rescheduled to {{2}}. Service: {{3}}. Booking
> reference #{{4}}.

Same button/variables as `appointment_confirmed`, submitted as a separate template because
Meta reviews fixed wording per template rather than a dynamic status word.

---

### appointment_running_late
Category: `UTILITY`

> Update from {{1}}: your {{2}} appointment on {{3}} is running late. {{4}}

Button: **Visit Website (Dynamic)** — label "View booking", same link pattern as above.

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | Business name | Glow Salon |
| {{2}} | Service | Haircut |
| {{3}} | Original appointment date/time | Wed, 20 Aug, 4:30 PM |
| {{4}} | Delay note (auto-composed, e.g. "We expect to be about 15 minutes late.") | We expect to be about 15 minutes late. |

---

### staff_account_ready
Category: `UTILITY`

⚠️ **Not wired into the code yet — this is the one exception.** The current staff
invite ([clientPlatform.controller.ts:113-121](../src/api/controllers/clientPlatform.controller.ts#L113-L121))
sends the plaintext password by SMS/email — Meta rejects any template that contains a
password or full login credential. Recommended replacement wording, paired with a
"set your password" link instead of sending the password itself:

> Hi {{1}}! Your staff account at {{2}} is ready. Your login username is {{3}}. Tap below
> to set your password and get started.

Button: **Visit Website (Dynamic)** — label "Set password", suffix = a one-time
set-password token.

| Var | Meaning | Sample |
|---|---|---|
| {{1}} | Staff member's name | Ayesha |
| {{2}} | Business name | Glow Salon |
| {{3}} | Username | ayesha.glow |

Let me know if you want me to build the set-password-link flow — right now only the
plaintext-password version exists in code.

---

## 3. Marketing templates

All six map to the offer types already defined in
[marketingTemplates.defaults.ts](../src/marketing/marketingTemplates.defaults.ts) and are
wired into [marketing.service.ts](../src/marketing/marketing.service.ts). The campaign
builder's "Send via" dropdown now has two more choices — **WhatsApp only** and **SMS,
email and WhatsApp** — alongside the original three, backed by a real `whatsapp` status
column on each recipient (same as SMS/email get). This requires running
[supabase/migrations/2026-08-20-add-whatsapp-marketing-channel.sql](../supabase/migrations/2026-08-20-add-whatsapp-marketing-channel.sql)
against your Supabase database once, before deploying — it adds two enum values and three
columns, all additive and safe to re-run. Sends are gated by the existing
`marketingWhatsapp` customer preference (Settings → Notifications) and billed against the
same monthly message-credit pool SMS uses (`consumeMessageCredit`). Meta requires marketing
templates to be opt-in (covered by that preference toggle) and strongly recommends an
opt-out path, so every template below adds a footer + quick-reply button for that.

Shared components for all six:
- Button 1: **Visit Website (Dynamic)** — label "Book now", suffix = the booking link
- Button 2: **Quick Reply** — text "Stop promotions" (wire this to flip the customer's
  `marketingWhatsapp` flag off)
- Footer (static, max 60 chars): `Reply STOP to unsubscribe`

### promo_percent_off
> Hi {{1}}! {{2}} has {{3}} off {{4}} this week. Tap below to book your spot.

{{1}} customer name → Amina · {{2}} business name → Glow Salon · {{3}} discount label →
20% · {{4}} service → Hair Spa

### promo_flat_amount_off
> Hi {{1}}! Save {{2}} on {{3}} at {{4}} this week. Tap below to book your spot.

{{1}} Amina · {{2}} Rs. 500 · {{3}} Facial · {{4}} Glow Salon

### promo_free_service
> Hi {{1}}! Book with {{2}} this week and get {{3}} free. Tap below to book your spot.

{{1}} Amina · {{2}} Glow Salon · {{3}} Eyebrow Threading

### promo_custom_offer
> Hi {{1}}! {{2}} has {{3}} for {{4}}. Tap below to book your spot.

{{1}} Amina · {{2}} Glow Salon · {{3}} Eid Special · {{4}} Bridal Makeup

### promo_happy_hour
> {{1}}-{{2}}: {{3}}! {{4}} now {{5}} (was {{6}}) at {{7}}. Tap below to book instantly.

{{1}} 4 PM · {{2}} 6 PM · {{3}} Happy Hour Special · {{4}} Manicure · {{5}} Rs. 1,200 ·
{{6}} Rs. 1,800 · {{7}} Glow Salon

*(7 variables is dense — worth trimming if Meta pushes back on approval; e.g. drop the
business name since the WABA display name already shows it.)*

### promo_last_minute_fill
> {{1}} slot just opened at {{2}}! {{3}} off {{4}}. Only {{5}} left — tap below to grab
> it.

{{1}} 5:30 PM · {{2}} Glow Salon · {{3}} 15% · {{4}} Pedicure · {{5}} 2

---

## What's wired vs. what's still manual
| Flow | Code | Templates approved? |
|---|---|---|
| Customer / owner OTP (all 3 login & signup paths) | ✅ wired | ⬜ your job |
| Appointment confirmed | ✅ wired | ⬜ your job |
| Appointment rescheduled | ✅ wired | ⬜ your job |
| Running late | ✅ wired | ⬜ your job |
| Waitlist slot opened | ✅ wired | ⬜ your job |
| Marketing campaigns (all 6 offer types) | ✅ wired | ⬜ your job |
| Staff invite (`staff_account_ready`) | ⬜ not wired — needs a set-password-link flow first | ⬜ your job |

## Submission checklist
1. WhatsApp Business Account (WABA) verified in Meta Business Manager, with a phone
   number registered under **Meta Cloud API** directly (not a BSP) — get the permanent
   access token and phone number ID from WhatsApp Manager → API Setup, and put them in
   `WHATSAPP_ACCESS_TOKEN` / `WHATSAPP_PHONE_NUMBER_ID`.
2. Submit each template above one at a time under the matching category, using the exact
   template name shown — Authentication and Marketing templates get extra Meta review
   scrutiny, budget a few days.
3. Build the set-password-link flow and wire `staff_account_ready` before submitting it —
   everything else is ready to go live the moment its template is approved.

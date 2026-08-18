# QRSchedule Database Redesign — Production Launch Roadmap

**Status:** New project live with full data (2,104/2,104 rows migrated). Cutover (Phase 5) pending.
**Owner:** ALGONLP
**Related files:** `supabase/schema-v2.sql`, `scripts/migrate-to-new-supabase.ts`

## 1. Why this redesign

The current Supabase project's schema grew incrementally over many changes —
`alter table add column if not exists` patches layered on top of the original
`create table` statements. That pattern is why the `off_days` production
incident happened: a column type (`weekday_id[]`, a custom Postgres enum
array) was chosen early on, and every team member with no days off set threw
`malformed array literal` on save, silently blocking logins for affected
salons until it was patched.

Before a production launch, the goal is a schema that is:

- **Secure** — Row Level Security denies all access by default; only the
  server's service-role key (never exposed to the browser) can read or write.
- **Fast** — every column the app filters or searches by has an index,
  including GIN indexes on the JSONB payload columns, which had none before.
- **Correct** — NOT NULL / CHECK constraints wherever the app never
  legitimately writes null or an invalid value; foreign keys with explicit
  `ON DELETE` behavior everywhere one table references another.
- **Auditable** — every table has `created_at` / `updated_at`, auto-maintained
  by a trigger, including the JSONB tables (which relied on the application
  code remembering to set `updatedAt` itself).

## 2. What changed vs. the current schema

| Area | Before | After |
|---|---|---|
| Schema history | ~30 `alter table add column if not exists` patches mixed into `create table` | Clean, final-state `create table` statements — same columns, no patch history |
| `team_members.off_days` | `weekday_id[]` (custom enum array — caused the production bug) | `text[]` (enum membership still validated in app code) |
| Bookable Staff Member | Not tracked in the relational mirror at all | `team_members.is_bookable_staff_member` column + index, matching the app's `TeamMemberRecord.isBookableStaffMember` field |
| JSONB payload search | No index — `payload jsonb not null` only | GIN index on every payload column that's queried into |
| JSONB table timestamps | None (`client_platform_clients`, `sms_log_records`, etc. had no `created_at`/`updated_at`) | Full timestamps + auto-update trigger on every table |
| Calendar's "today's appointments" query | Single-column index on `business_id` only | Added composite `(business_id, appointment_date)` index |
| Subscription plan seed data | Stale (old Solo/Single/Team Premium pricing) | Matches current Lite/Growth/Professional/Multi-Branch pricing |

Table names, column names, and types are otherwise **identical** to the
current schema on purpose — the application's repository layer
(`src/platform/storage/*Supabase.store.ts`, `src/shared/supabase/
relationalMirror.ts`) needs **zero code changes** to run against the new
database. This keeps the pre-launch change surface to "database only,"
not "rewrite the persistence layer," which would be a much bigger and
riskier project to do right before launch.

## 3. Phased execution plan

### Phase 0 — Design (done)
- [x] Full audit of the current schema (`supabase/schema.sql`, 1,222 lines)
- [x] New schema written: `supabase/schema-v2.sql`
- [x] Migration script written: `scripts/migrate-to-new-supabase.ts`
- [x] This roadmap

### Phase 1 — Create the new Supabase project (done)
- [x] New Supabase project created (Free tier).
- [x] Project URL / anon key / service role key stored as `NEW_SUPABASE_URL`
  / `NEW_SUPABASE_PUBLISHABLE_KEY` / `NEW_SUPABASE_SERVICE_ROLE_KEY` in
  `.env` (the *live* `SUPABASE_*` vars were deliberately left pointing at the
  old project until cutover in Phase 5).

### Phase 2 — Apply the schema (done)
- [x] `supabase/schema-v2.sql` run against the new project.
- [x] Verified via `scripts/verify-new-schema.ts` — all core tables present,
  4 subscription plans seeded correctly (lite/growth/professional/multi_branch).
- [x] Schema drift found and fixed: production had two columns not present
  in the original `schema.sql` (`marketing_campaign_recipients.opened_at` —
  an active campaign-open-tracking feature — and eight legacy, always-empty
  columns on `sms_log_records` from an old pre-JSONB version of that table).
  Both are now in `schema-v2.sql` and were added to the new project.

### Phase 3 — Dry-run the data migration (done)
- [x] `npx tsx scripts/migrate-to-new-supabase.ts` (no `--apply`) confirmed
  connectivity and previewed 2,104 total rows across 38 tables.

### Phase 4 — Apply the data migration (done)
- [x] `npx tsx scripts/migrate-to-new-supabase.ts --apply` — **2,104 / 2,104
  rows migrated, zero discrepancies.** Table-by-table breakdown: 70
  businesses, 117 team members, 187 services, 59 appointments, 100 package
  plans, 27 customer profiles, 15 marketing campaigns, 45 campaign
  recipients, 95 email logs, 85 SMS logs, plus supporting tables.
- [x] Re-run was needed once (stopped on the `opened_at` schema drift above,
  fixed, then re-run — upsert-by-primary-key made the re-run safe and it
  picked up exactly where it left off).

### Phase 5 — Cutover
- Update `.env` (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`,
  `SUPABASE_PUBLISHABLE_KEY`) to point at the new project.
- Restart the app (`npm run dev` locally, then the real deploy).
- Smoke test the golden paths before calling it done: business login,
  viewing the calendar/appointments, adding a team member (confirms the
  `off_days` fix + new `is_bookable_staff_member` field both work), creating
  a public booking, checking billing overview.

### Phase 6 — Monitoring window
- Keep the **old** project alive and untouched (no new writes will land
  there once the app is cut over) for an agreed window — recommend at least
  1–2 weeks post-launch — purely as a read-only safety net.
- If anything looks wrong in the new project, the old project still has the
  complete, untouched pre-migration data.

### Phase 7 — Decommission the old project
- Only after the monitoring window, and only with your explicit go-ahead —
  deleting a Supabase project is **irreversible**. This step will not happen
  automatically; it needs a deliberate confirmation when you're ready.

## 4. Rollback plan

If something is wrong after cutover (Phase 5) and before decommissioning
(Phase 7): the old project still has every row exactly as it was before
migration (the migration script only reads from it, never writes to it).
Rolling back is just pointing `.env` back at the old project's URL/keys and
restarting the app. Any bookings/changes made against the *new* project
during the failed cutover window would need to be manually reconciled — this
is the reason for testing thoroughly in Phase 5 before telling real users
the cutover is complete.

## 5. Explicitly out of scope for this pass

Kept out to avoid stacking a second high-risk project on top of a database
migration right before launch:

- **Consolidating the dual JSONB + relational-mirror architecture** into a
  single relational source of truth. Right now every write happens twice
  (once to a JSONB "sync" table, once mirrored into normalized relational
  tables) — this is what produced the rollback-failure pattern seen in the
  `off_days` incident. It's a legitimate long-term simplification, but
  requires rewriting the repository layer, not just the schema. Recommended
  as a post-launch project once the new database is stable.
- **Moving profile/gallery images out of inline `text` URLs into real
  Supabase Storage buckets.** Some images are currently stored as base64
  data URIs, which bloats row size and slows queries as the image library
  grows. No evidence this is causing problems yet at current scale; flagged
  for later.
- **Per-row RLS policies.** Not needed today (verified: the browser never
  uses the anon key, only the server's service-role key touches Supabase),
  so deny-all is correct. Would only become necessary if a future feature
  calls Supabase directly from the browser.

# Multi-Tenant Build Plan — Cambodia Event Ticketing System

Turning the current single-event app into a **multi-tenant platform** that hosts
events for different third-party organizers. This plan covers the data model,
tenant isolation, roles, routing, and a phased build order.

Decisions locked in with the product owner (2026-08-04):

- **Tenant = Organizer** (an organization that owns many events).
- **Onboarding:** invite-only — the **platform admin creates** each organizer
  and their first organizer-admin. No public organizer signup.
- **Public site:** a **combined marketplace** — one public site lists published
  events across all organizers (the Eventbrite/Ticketmaster model).
- **Payments:** unchanged. A **single PayWay merchant** (platform is
  merchant-of-record); organizer payouts are done **manually, off-system** for
  now. No Payout/Funds-Route integration. See `docs/security.md` and the scope
  notes.
- **Platform fee:** none for v1 — the settlement report shows gross / refunds /
  net owed only; a fee model can be added later without reshaping the schema.

Not splitting into separate frontend/backend services (see the architecture
discussion) — this stays a Next.js monolith with a clean service-layer boundary.

---

## 1. Core model — the Organizer tenant

Introduce an `organizers` table (the tenant). Everything tenant-owned traces to
an `organizer_id`:

- **`organizers`** — `id`, `name`, `slug`, `status` (ACTIVE/SUSPENDED),
  `contact_email`, `payout_notes` (free text: bank/account for the manual
  transfer), timestamps.
- **`events.organizer_id`** (FK → organizers) — an organizer owns many events.
- **Denormalized `organizer_id` on `orders` and `tickets`** — set once at
  creation, immutable. These two tables carry the heaviest admin/reporting
  queries; a single indexed tenant column avoids a mandatory join to `events`
  on every scoped query and acts as defense-in-depth. Trade-off: a little
  denormalization, guarded by "set at insert, never updated."
- `zones` / `seats` / `order_items` / `payments` / `check_in_logs` stay scoped
  **through their parent** (`event_id` / `order_id`) — no extra column needed;
  they're always reached via an already-scoped parent.

Slugs: keep `events.slug` globally unique (marketplace routing is `/events/[slug]`).
`organizers.slug` unique too (future per-organizer pages / filtering).

---

## 2. Roles & staff scoping

Today `staff_users` has one global `role` (ADMIN / MANAGER / CHECK_IN_STAFF) and
the single admin is effectively the platform operator.

Changes (as implemented in Phase A — refined from the original draft to avoid a
risky enum rename):

- **`staff_users.organizer_id`** (nullable). `NULL` = **platform-level** staff
  (you). Non-null = belongs to that organizer. **This column — not a new role —
  is what distinguishes platform from organizer.**
- **Roles are unchanged** (`ADMIN` / `MANAGER` / `CHECK_IN_STAFF`) and are now
  interpreted *within scope*: an `ADMIN` with `organizer_id` NULL is the
  **platform admin**; an `ADMIN` with an `organizer_id` is that **organizer's
  admin**; likewise `MANAGER` / `CHECK_IN_STAFF` are organizer-scoped when
  `organizer_id` is set. This keeps existing auth code working — no enum
  migration, no churn across every role reference.
- Gate helpers (`src/lib/api-auth.ts`): added `getPlatformAdmin()` (ADMIN +
  organizer_id NULL, for platform-only surfaces like managing organizers) and
  `getScopedAdminStaff()` (admin + resolved `TenantScope`). `getSuperAdmin`
  (role ADMIN) still gates staff-management / refunds for both platform and
  organizer admins.
- Scope resolution lives in `src/lib/tenant.ts`
  (`getTenantScope` / `resolveOrganizerFilter`) — see §3.

Backfill: existing staff stay platform-level (organizer_id NULL); the sole
existing ADMIN remains the platform admin.

---

## 3. Tenant isolation (the security-critical part)

A missed filter = one organizer sees another's attendees/revenue. Enforce it in
**one choke point**, not per-query hope.

- **Resolve scope once per request** from the session:
  `getTenantScope(staff) → { isPlatform, organizerId }`.
- **Scoped service layer:** admin service functions accept a scope and always
  apply `WHERE organizer_id = :organizerId` for organizer-scoped users. A
  platform admin either sees all or acts within a chosen organizer (explicit
  `organizerId`, never implicit).
- **Scoped guards:** add `getOrganizerStaff()` (returns staff + resolved
  `organizerId`) and require it in every `/api/admin/*` route. A platform admin
  hitting an organizer-scoped resource must name the organizer.
- **Public routes** (`/order/[token]`, `/ticket/[token]`) stay token-based and
  need no tenant scoping — the unguessable token is the capability.
- **Tests are part of this phase, not optional:** cross-tenant access tests
  (organizer A's staff cannot read/modify organizer B's orders, tickets,
  attendees, staff, settlement) must pass before the portal ships.

---

## 4. Routing & app structure

Keep one `/admin` tree; the layout resolves scope and shows the right nav.

**Public (combined marketplace):**
- `/` — marketplace landing: lists all PUBLISHED events across organizers
  (replaces the current single `getPrimaryEvent` landing).
- `/events/[slug]` — event detail + buy (today's landing content, per event).
- `checkout` / `order/[token]` / `ticket/[token]` — largely unchanged; they
  already work off an event or a token, not "the primary event." Main work is
  starting checkout from an event page rather than the single event.

**Admin:**
- **Platform admin** (extra nav): **Organizers** (create organizer + its first
  organizer-admin, suspend/enable), platform-wide dashboard, cross-organizer
  settlement/payouts.
- **Organizer admin/manager:** the current admin screens
  (dashboard, events, zones, orders, attendees, staff, audit) — auto-scoped to
  their `organizer_id`. Because an organizer now has **many** events, "the
  event" becomes an **event list + selector** everywhere that currently assumes
  one (the 7 files using `getPrimaryEvent`: event, attendees, orders,
  dashboard, zones pages + the attendees export route + `event.service`).

**Check-in:** `/check-in` scoped to the staff member's organizer; the QR token
already carries `eventId`, so validation additionally checks the ticket's event
belongs to the staff's organizer.

---

## 5. Settlement & manual payouts (no platform fee for v1)

- **Per-organizer settlement report:** gross (sum of PAID order totals) −
  refunds/voids (REFUNDED) = **net owed**, filterable by date range. Reuses the
  `admin-stats.service` query patterns, scoped by `organizer_id`.
- **`payouts` table:** `id`, `organizer_id`, `period_start`, `period_end`,
  `amount`, `currency`, `status` (PENDING/PAID), `paid_at`, `note`,
  `created_by`. Lets you record "transferred $X to organizer Y on date Z" so
  manual transfers are accurate and never double-paid.
- **Platform view:** owed-vs-paid per organizer.
- Automating later via PayWay's Payout API just replaces the manual step; this
  schema (settlement math + payout records) stays the same.

---

## 6. Migrations (timestamps after 1754010000000)

1. **Organizers + tenancy:** create `organizers`; add `organizer_id` to
   `events` (FK), `staff_users` (nullable), `orders` + `tickets` (denormalized,
   indexed). Backfill: create one **default organizer**, assign the existing
   event and all its orders/tickets to it; leave the existing admin as
   `PLATFORM_ADMIN` (organizer_id NULL). Remap `StaffRole` values.
2. **Payouts:** create `payouts`.

Both follow the project's TypeORM conventions (no runtime migrations,
name-based repos, `varchar` + CHECK for enums, UUID PKs).

---

## 7. Phased build order

Ordered to land the risky isolation plumbing first and keep each phase
shippable/testable.

- **Phase A — Tenant foundation. ✅ DONE.** Organizer entity + `OrganizerStatus`
  enum; `organizer_id` on events / staff_users / orders / tickets; migration
  `1754020000000-OrganizerTenancy` (creates organizers, backfills a default
  organizer + tags existing event/orders/tickets, sets NOT NULL, indexes);
  `src/lib/tenant.ts` scope helpers; `getPlatformAdmin` / `getScopedAdminStaff`
  guards; `organizer.service`; new events/orders/tickets are tagged with
  `organizer_id` at creation. No user-visible change — platform admin still sees
  everything. **Requires `yarn migration:run` locally.**
- **Phase B — Platform admin. ✅ DONE.** `/admin/organizers` (platform-admin
  only): list with per-organizer counts (events, paid orders), create an
  organizer together with its first organizer-admin in one transaction
  (`createOrganizerWithAdmin`), and `/admin/organizers/[id]` to edit
  name/contact/payout-notes and suspend/re-activate. APIs `POST
  /api/admin/organizers` + `PATCH /api/admin/organizers/[id]`, gated by
  `getPlatformAdmin`. Nav shows "Organizers" only to platform admins. Suspending
  an organizer immediately blocks its staff from authenticating (enforced in
  `getCurrentStaff`). Audit: `ORGANIZER_CREATED/UPDATED/STATUS_CHANGED`.
- **Phase C — Organizer portal. ✅ DONE.** Introduced an **active-event context**
  (`src/lib/admin-context.ts` + a header `EventSelector`, cookie-remembered and
  re-validated against scope) so admin pages work on one selected event.
  `/admin/events` (list + create) and `/admin/events/[id]` (edit + publish)
  replace the single-event page (`/admin/event` now redirects). Dashboard,
  orders, attendees and zones read the active event instead of
  `getPrimaryEvent`. Isolation: event / event-status / zones-create /
  attendees-export routes verify the event is in the caller's scope; order and
  ticket mutation routes (cancel/refund/resend/void) and the order-detail page
  verify the target's `organizer_id` is in scope; staff list/create/mutate are
  organizer-scoped (organizer admins only see/manage their own staff; new staff
  inherit the creator's organizer). Audit log is **restricted to platform
  admins** for now (see Phase G — needs an `organizer_id` column to be
  per-organizer). Deferred to Phase D: the public site still shows a single
  published event and doesn't yet filter out suspended organizers.
- **Phase D — Public marketplace. ✅ DONE.** `/` is now a marketplace grid of
  all PUBLISHED events owned by ACTIVE organizers
  (`listPublishedEventsForMarketplace`); `/events/[slug]` is the per-event detail
  (hero + zones + buy, via `getPublishedEventBySlug`, which 404s for unpublished
  events or suspended organizers). Checkout starts from the event page and its
  back-link returns there. **Suspended-organizer gap closed**: the marketplace,
  the slug page, the checkout page, and `createReservation` all refuse a
  suspended organizer, so a stale link can't complete a purchase.
- **Phase E — Check-in scoping. ✅ DONE.** Every check-in entry point now
  carries the scanning staff member's organizer (`staff.organizerId`; NULL =
  platform, unrestricted): `validateToken`, `checkInByToken`,
  `checkInByTicketId`, `undoCheckIn`, `searchTickets`, `getRecentActivity`. A
  ticket from another organizer is treated as **not found** (no info leak, no
  state change); search/history only return the caller's organizer. A check-in
  staff scoped to an organizer can scan any of that organizer's events (scoping
  is by organizer, not a single event).
- **Phase F — Settlement & payouts. ✅ DONE.** `payouts` ledger (migration
  `1754030000000-Payouts`, **needs `yarn migration:run`**) + `settlement.service`
  computing, **per currency**, collected (PAID orders), refunded (informational),
  paid-out (PAID payouts) and outstanding = collected − paid-out. `/admin/settlement`
  is scope-aware: platform admins see every organizer with an outstanding
  balance and can **record a payout** (logging a manual transfer) at
  `/admin/settlement/[organizerId]`; organizer admins see their own balance +
  payout history (read-only — payouts are a platform action). API `POST
  /api/admin/payouts` (platform only), audited `PAYOUT_RECORDED`. No platform fee
  (net = collected); a fee model can be subtracted later without schema change.
- **Phase G — Hardening, tests & docs.** Cross-tenant isolation tests; scope
  `audit_logs` / `check_in_logs` and their viewers; update `security.md`
  (new "Multi-tenancy & isolation" section), the implementation plan, and the
  runbook.

Rough effort: Phase A is the largest single chunk (foundation + backfill +
isolation); B–F are moderate and mostly reuse existing screens/queries; G is
small but non-negotiable.

---

## 8. Key risks

- **Isolation leaks** — mitigated by the central scoping choke point (§3) and
  mandatory cross-tenant tests in Phase G.
- **Single-event assumptions** — every `getPrimaryEvent` caller and any "the
  event" UI must become event-aware; enumerated in §4.
- **Backfill correctness** — the default-organizer backfill must assign *all*
  existing orders/tickets, or scoped queries will hide live data. Verify counts
  before/after.
- **Merchant-of-record reality** — unchanged by this plan, but worth
  re-noting: the platform legally collects and remits all funds (refund/tax
  exposure) even though payouts are manual.

---

## 9. Explicitly out of scope for v1

Public organizer signup; per-organizer subdomains/white-label theming; platform
fee/commission automation; automated PayWay payouts; per-organizer PayWay
merchants. All are additive on top of this foundation.

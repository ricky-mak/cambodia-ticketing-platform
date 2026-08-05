# Cambodia Event Ticketing System

A single-event ticketing system: public ticket sales, ABA PayWay payments,
signed QR-code tickets by email, and a mobile check-in PWA for staff. Built as
a modular monolith on Next.js (App Router) + TypeORM + PostgreSQL, deployed to
Google Cloud Run.

> **Status: Phase 10 (in progress) — Production hardening.** All features
> (Phases 1–8) are complete. Added: in-memory rate limiting on login/checkout/
> QR endpoints, and security headers + a Content-Security-Policy. Remaining
> Phase 10 items (load test, backup verification, real Cloud Tasks/Scheduler)
> are deploy-time and covered in `docs/gcp-deployment.md` + the event-day
> runbook. See `cambodia-ticketing-implementation-plan.md` (§6 has the zone/seat
> amendment).

## Stack

- Next.js (App Router) + TypeScript, Yarn
- Tailwind CSS + shadcn/ui, React Hook Form + Zod
- TypeORM + PostgreSQL (migrations only; `synchronize` disabled everywhere)
- Vitest for unit tests
- Docker image targeting Cloud Run

## Prerequisites (Windows 11)

- [Node.js 24](https://nodejs.org/) (`node -v` → v24.x)
- Yarn 1.x — enable via Corepack: `corepack enable`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL)

## Getting started (PowerShell)

```powershell
# 1. Install dependencies (generates yarn.lock — commit it)
yarn install

# 2. Create your local env file, then edit if needed
Copy-Item .env.example .env

# 3. Start local PostgreSQL
docker compose up -d

# 4. Run the dev server
yarn dev
```

Open http://localhost:3000 and http://localhost:3000/api/health.

Expected health response when the database is reachable:

```json
{ "status": "ok", "database": "connected", "timestamp": "2026-07-30T00:00:00.000Z" }
```

## Common commands

```powershell
yarn dev          # start the dev server (http://localhost:3000)
yarn build        # production build (Next.js standalone output)
yarn start        # run the production build locally
yarn lint         # ESLint
yarn typecheck    # tsc --noEmit
yarn test         # run unit tests (Vitest)
yarn test:watch   # unit tests in watch mode
```

## Database migrations

Schema changes are applied through TypeORM migrations only — never
auto-synchronize. The CLI uses `src/data-source.ts` and reads `DATABASE_URL`
from `.env`.

```powershell
# After adding/altering an entity, generate a migration:
yarn migration:generate src/migrations/DescriptiveName

# Apply pending migrations:
yarn migration:run

# Roll back the most recent migration:
yarn migration:revert
```

The Phase 2 schema is the hand-written `InitAuth` migration
(`src/migrations/1753920000000-InitAuth.ts`). Apply it with `yarn migration:run`.
It requires PostgreSQL 13+ (uses `gen_random_uuid()`).

## Authentication & admin (Phase 2)

Staff sign in at `/admin/login`. Sessions are stored server-side in the
`sessions` table; the browser only holds an opaque HttpOnly cookie, and the
stored token is SHA-256 hashed so a DB leak can't be replayed. Disabling an
account or logging out revokes the session immediately. Passwords use Argon2id
via `@node-rs/argon2` (prebuilt binaries — no native build step).

Roles: `ADMIN` and `MANAGER` can reach the admin dashboard; `CHECK_IN_STAFF` is
reserved for the Phase 7 check-in app.

### First-time setup

```powershell
# 1. Apply the schema
yarn migration:run

# 2. Create the first admin (set strong values; min 12-char password)
$env:ADMIN_EMAIL="you@example.com"
$env:ADMIN_PASSWORD="your-strong-password"
$env:ADMIN_NAME="Your Name"
yarn create-admin

# 3. Start the app and sign in
yarn dev   # then open http://localhost:3000/admin/login
```

Auth API: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

## Event, zones & seats (Phase 3)

Apply the Phase 3 migration, then configure from the admin area:

```powershell
yarn migration:run   # creates events, zones, seats
```

- **Admin → Event** (`/admin/event`): create the event, then **Publish** it.
- **Admin → Zones** (`/admin/zones`): add zones (one price each). Seats are
  generated immediately as `rows × seatsPerRow`, labelled by row (A, B, …) and
  seat number. The table shows live total/available/held/sold counts.
- **Public page** (`/`): shows the PUBLISHED event and its active zones with
  live availability. The Buy button is stubbed until Phase 4 (checkout).

A zone is the sellable unit; on purchase the system auto-assigns contiguous
available seats via `FOR UPDATE SKIP LOCKED`.

## Orders & seat reservation (Phase 4)

Apply the migration, then customers can reserve seats end to end:

```powershell
yarn migration:run   # creates orders, order_items; links seats; adds reservation window
```

- **Public flow**: on `/`, a **Buy tickets** button appears for each active zone
  while sales are open → `/checkout/<zoneId>` (choose quantity + enter name /
  email / phone) → creates a PENDING order, assigns seats, and redirects to
  `/order/<token>` (a public, unguessable URL) showing the held seats and a
  live countdown.
- **Overselling prevention**: reservation happens in one transaction that locks
  candidate seats with `SELECT … FOR UPDATE SKIP LOCKED`, so two buyers can
  never get the same seat. Seats are assigned contiguously within a row when
  possible, otherwise scattered.
- **Hold window**: configurable per event (Admin → Event → "Seat hold
  (minutes)", default 10).
- **Expiration**: expired holds are reclaimed by the **timed sweep**
  (`releaseExpiredHolds`), not inline during checkout — an event-wide cleanup on
  every checkout contends under load. Run it on a schedule (Cloud Scheduler
  ~every minute in production; `yarn sweep-expired` or
  `POST /api/internal/orders/sweep-expired` locally). A single order can be
  expired via `POST /api/internal/orders/<id>/expire`. Internal routes accept an
  `x-internal-secret` header matching `INTERNAL_API_SECRET` (required in
  production; optional in dev). Reclaimed seats reappear on the next sweep, so
  in local dev run `yarn sweep-expired` to free abandoned holds.

Reserving seats then hands off to the payment step (Phase 5).

## Payments — ABA PayWay (Phase 5)

Apply the migration, then choose a provider via `PAYMENT_PROVIDER`:

```powershell
yarn migration:run   # creates payments
```

**Local testing (default, `PAYMENT_PROVIDER=fake`)** — no gateway needed:

1. Reserve seats on `/checkout/<zoneId>` → you're redirected to a dev
   "Simulate payment" page (`/dev/pay/<orderNumber>`).
2. Click **Pay now (simulate success)** → the same callback path runs, the
   order flips to PAID and its seats to SOLD, and you land on the order page.
3. Idempotency: the callback can fire repeatedly without double-applying.

**Real PayWay sandbox (`PAYMENT_PROVIDER=payway`)** — set `PAYWAY_MERCHANT_ID`,
`PAYWAY_API_KEY`, `PAYWAY_BASE_URL=https://checkout-sandbox.payway.com.kh` in
`.env`. Checkout now auto-submits a signed form to PayWay's hosted
checkout. Because PayWay's pushback is unsigned and omits the amount, the
callback handler re-verifies via the signed check-transaction API before
confirming. Note: PayWay's server-to-server pushback can't reach `localhost` —
either expose the app with a tunnel (e.g. ngrok) and whitelist that domain, or
reconcile manually via `POST /api/internal/payments/reconcile`
`{ "merchantTransactionId": "ORD-…" }`.

Payment is verified server-side only — a browser redirect back from PayWay is
never treated as proof of payment.

## Tickets, QR & email (Phase 6)

Install the new deps and apply the migration:

```powershell
yarn install          # adds qrcode
yarn migration:run    # creates tickets
```

Set a signing secret in `.env` (required — the QR endpoints throw without it):

```
TICKET_SIGNING_SECRET=<a long random string>
EMAIL_PROVIDER=fake   # dev default; writes previews to ./.emails
```

When an order is confirmed PAID, the same transaction issues **one ticket per
sold seat**:

- **QR token** — `base64url(payload).base64url(HMAC-SHA256)` over
  `{version, ticketId, eventId, tokenId}` (`src/lib/qr-signing.ts`). No customer
  data is in the QR; the DB stays the source of truth at check-in.
- **Ticket page** — `/ticket/<token>` shows the event, zone, seat, attendee,
  ticket number, and the scannable QR (`GET /api/tickets/<token>/qr` renders the
  PNG). The paid order page also lists links to each ticket.
- **Confirmation email** — sent once on the transition to PAID. In dev the
  **fake** provider writes an `.html` preview to `./.emails/` (open it in a
  browser); set `EMAIL_PROVIDER=resend` with `EMAIL_API_KEY` + a verified
  `EMAIL_FROM` for real delivery. The email embeds each seat's QR (served from
  `APPLICATION_BASE_URL`, so it must be publicly reachable for images to load in
  a real inbox) and a link to each ticket.

Email failure never fails payment confirmation — tickets already exist and the
email can be resent.

## Check-in PWA (Phase 7)

Install the scanner dependency and apply the migration:

```powershell
yarn install          # adds html5-qrcode
yarn migration:run    # creates check_in_logs
```

Staff sign in at **`/check-in/login`** (your ADMIN account works — dedicated
`CHECK_IN_STAFF` accounts come with staff management in Phase 8). Then:

- **`/check-in/scan`** — the camera scans ticket QR codes. A scan validates the
  ticket and shows a large colour-coded result: **green** valid (with a
  **Check in** button), **orange** already checked in, **red** invalid /
  cancelled / wrong event. On check-in the scanner re-arms for the next person,
  with sound + vibration feedback and an optional flashlight toggle.
- **`/check-in/search`** — manual lookup by name, email, ticket, or order
  number, with a check-in button per result.
- **`/check-in/history`** — the latest check-in activity.

Check-in is a single atomic `UPDATE tickets SET status='CHECKED_IN' WHERE
id=? AND status='VALID'`, so two devices scanning the same ticket can never both
succeed. The QR signature is verified server-side and the DB is the source of
truth. Undo-check-in is restricted to ADMIN/MANAGER. All activity is written to
`check_in_logs`.

> **Camera needs a secure context.** It works on `localhost` on a desktop; on a
> phone, open the app over HTTPS (your ngrok URL or the deployed domain). The
> app is installable as a PWA (manifest included); icons/offline support are
> deferred to production hardening.

## Admin operations (Phase 8)

No migration needed. In the admin area (nav: Dashboard, Orders, Attendees,
Event, Zones, Staff, Audit):

- **Dashboard** — live metrics: gross revenue, tickets sold, checked-in %,
  seats remaining/held/sold, pending orders, failed payments.
- **Orders** — search (order #, name, email, phone) and filter by status; open
  an order to see items, payment, and seats/tickets. Actions: **cancel** an
  unpaid order (releases held seats), **refund** a paid order (record-only:
  voids tickets, releases seats, marks REFUNDED — refund the money in ABA),
  **resend** the confirmation email.
- **Attendees** — search and filter by zone / check-in status; **void** a
  ticket (releases its seat), **undo check-in**, **resend**, and **Export CSV**.
- **Staff** (ADMIN only) — create accounts (including `CHECK_IN_STAFF` for the
  scanner), change role, disable/enable, reset password.
- **Audit** — recent sensitive actions (refunds, cancellations, voids, staff
  changes, event/zone edits) with the actor and time.

Refunds are **record-only** in v1 — the money is returned manually via ABA;
the schema is structured so the real PayWay refund API can be wired in later.

## Security hardening (Phase 10)

Run `yarn migration:run`. The hardening migrations add: login-lockout columns
to `staff_users`; an `ip_address` column + indexes to `orders`; the per-event
pending-order caps (`events.max_pending_per_email` / `max_pending_per_ip`); and
the `pg_trgm` extension + GIN trigram indexes that back the check-in/attendee
search. (The `pg_trgm` step needs create-extension rights on the DB role — see
`docs/gcp-deployment.md` §9.) Added in code:

- **Rate limiting** (`src/lib/rate-limit.ts`) on `POST /api/auth/login` (brute
  force), `/api/checkout` (abuse), `/api/tickets/validate` + `/check-in`
  (generous), and `/api/orders/[token]/refresh-status` (poller). Over-limit
  callers get HTTP 429 + `Retry-After`.
  - **Caveat:** the IP limiter is in-memory (no Redis per plan), so it's *per
    Cloud Run instance*. For a global per-IP limit + WAF/DDoS, use Cloud Armor
    at the load balancer (see `docs/gcp-deployment.md`).
- **Login account lockout** — 5 failed passwords lock a staff account for 15
  minutes (DB-backed, so global regardless of instances; returns HTTP 423). An
  admin can reset the password or re-enable the account to clear it early. This
  is the primary brute-force defense, alongside Argon2id's slow hashing.
- **Pending-order cap** — concurrent unpaid holds are capped per email and per
  IP (event-scoped) so no one can tie up seat inventory for free (HTTP 429). The
  caps are **per-event** (Admin → Event; defaults 3 / 20, IP generous for shared
  NAT). This is the real inventory-lockup control; the rate limit and Cloud
  Armor cover the rest.
- **Security headers + CSP** (`next.config.mjs → headers()`): CSP, HSTS (prod
  only), `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`, and
  `Permissions-Policy: camera=(self)` (needed by the scanner). The CSP allows
  `form-action` to the PayWay checkout domains (so payment redirect works) and
  `blob:`/`data:` for QR + the camera worker. It uses `'unsafe-inline'` for
  Next's hydration; tightening to a nonce-based CSP is a future improvement.

Deploy-time hardening (load test, backup verification, real Cloud
Tasks/Scheduler for order expiry) lives in `docs/gcp-deployment.md` and
`docs/event-day-runbook.md`.

## Local PostgreSQL

`docker compose up -d` starts PostgreSQL 16 with:

- user `ticketing`, password `ticketing`, database `ticketing`
- exposed on `localhost:5432`
- data persisted in the `ticketing_pgdata` volume

Stop it with `docker compose down` (add `-v` to also delete the data volume).

## Docker image (Cloud Run)

The `Dockerfile` produces a slim standalone image listening on `PORT`
(default 8080, which Cloud Run sets automatically).

```powershell
docker build -t ticketing-app .
docker run --rm -p 8080:8080 --env-file .env ticketing-app
```

## Environment variables

See `.env.example`. Phase 1 uses:

| Variable               | Required | Notes                                        |
| ---------------------- | -------- | -------------------------------------------- |
| `NODE_ENV`             | no       | `development` / `test` / `production`        |
| `DATABASE_URL`         | yes      | `postgres://user:pass@host:5432/db`          |
| `APPLICATION_BASE_URL` | no       | Public base URL of the app                   |

Secrets are validated lazily at runtime (`src/lib/env.ts`) so builds don't
require them. In production they come from Google Secret Manager, never from
`NEXT_PUBLIC_*` variables.

## Project layout

```text
src/
  app/
    page.tsx, layout.tsx, globals.css   # public event landing
    checkout/                 # reserve seats -> create order
    order/[token]/            # order status + pay (public_token URL)
    ticket/[token]/           # scannable ticket page
    dev/                      # dev-only fake-pay helper
    admin/
      login/page.tsx          # staff sign-in
      (protected)/            # requires ADMIN/MANAGER (guarded in layout)
        layout.tsx            # server-side auth guard + shell
        dashboard/ orders/ attendees/ staff/ event/ zones/ audit/
    check-in/
      login/page.tsx
      (protected)/            # scanner PWA (adds CHECK_IN_STAFF)
        scan/ search/ history/
    api/
      health/                 # GET /api/health
      auth/                   # login, logout, me
      checkout/               # POST reservation
      orders/[token]/refresh-status/   # payment status poller
      payments/payway/callback/        # PayWay pushback
      tickets/                # validate, check-in, undo-check-in, search, [token]/qr
      admin/                  # event, zones, orders, staff, attendees export, ticket void/resend
      internal/               # orders/[id]/expire, orders/sweep-expired, payments/reconcile
  components/
    ui/                       # shadcn-style primitives (themed via design tokens)
    brand/                    # sail-prow motif + brand bits (see docs/design-system.md)
    admin/                    # event/zone/staff/order/attendee forms + actions
    check-in/ dev/            # scanner + dev helpers
    checkout-form, order-status-poller, reservation-countdown,
    lockout-message, logout-button
  entities/                   # Event, Zone, Seat, Order, OrderItem, Payment,
                              # Ticket, StaffUser, Session, AuditLog, CheckInLog,
                              # Organizer, Payout (multi-tenant)
  migrations/                 # 13 migrations, timestamp-ordered (InitAuth -> EventHeroImageFull)
  services/                   # auth, event, zone, order, payment, ticket, check-in,
                              # staff, audit, admin-stats/-order/-attendee, cloud-task,
                              # email, organizer, settlement (multi-tenant)
    payments/                 # provider abstraction: fake + payway
    email/                    # provider abstraction: fake + resend
  lib/
    env, logging, database, money, utils, datetime, http
    password (Argon2id), session + session-cookie (DB sessions), authz, api-auth
    rate-limit, internal-auth (timing-safe secret), qr-signing, payway-hash
    order-codes, sales, seat-allocation, seat-labels
  types/enums.ts              # roles, statuses, audit + check-in actions
  data-source.ts              # DataSource for the TypeORM CLI
  middleware.ts               # cookie-presence redirect for /admin + /check-in
scripts/
  create-admin.ts             # seed the first admin
  sweep-expired.ts            # dev order-expiry sweep (`yarn sweep-expired`)
tests/
  money.test.ts
```

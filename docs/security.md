# Security Features

A reference of the security measures already built into the Cambodia Event
Ticketing System, where they live in the code, and known limitations / future
hardening. (Rate limiting and security headers are §3 and §4.)

---

## 1. Authentication (staff)

- **Server-side sessions**, DB-backed (`sessions` table). The browser only holds
  an opaque random token in an **HttpOnly** cookie; we store the **SHA-256 hash**
  of that token, so a database leak can't be replayed as a login.
  `src/lib/session.ts`.
- Cookie flags: `HttpOnly`, `SameSite=Lax`, `Secure` in production, 12-hour
  expiry.
- **Revocable**: `getCurrentStaff()` re-checks the session and the account status
  on every request, so disabling a staff account (or logout) takes effect
  immediately.
- **Passwords** hashed with **Argon2id** (`@node-rs/argon2`), OWASP-tuned
  parameters. `src/lib/password.ts`. Plaintext passwords are never stored or
  logged.

## 2. Authorization (RBAC)

- Roles: `ADMIN`, `MANAGER`, `CHECK_IN_STAFF` (`src/lib/authz.ts`).
- Gate helpers (`src/lib/api-auth.ts`): `getAdminStaff` (ADMIN/MANAGER),
  `getCheckInStaff` (adds CHECK_IN_STAFF), `getSuperAdmin` (ADMIN only — staff
  management, refunds-page access).
- Admin/check-in areas are enforced in the server layouts **and** in each API
  route (not just the UI). Undo-check-in is restricted to ADMIN/MANAGER.
- **Internal task endpoints** (`/api/internal/*`) require an
  `x-internal-secret` header matching `INTERNAL_API_SECRET`
  (`src/lib/internal-auth.ts`); rejected in production if unset.

## 3. Rate limiting

`src/lib/rate-limit.ts` — a fixed-window limiter returning **HTTP 429** with a
`Retry-After` header when exceeded. Applied to:

| Endpoint                              | Limit          | Purpose               |
| ------------------------------------- | -------------- | --------------------- |
| `POST /api/auth/login`                | 10 / 5 min     | brute-force login     |
| `POST /api/checkout`                  | 15 / min       | reservation abuse     |
| `POST /api/tickets/validate`          | 600 / min      | QR validation abuse   |
| `POST /api/tickets/check-in`          | 600 / min      | check-in abuse        |
| `POST /api/orders/[token]/refresh-status` | 60 / min   | status poller abuse   |

Keyed by client IP (from `x-forwarded-for`, which Cloud Run sets).

**Login account lockout** (`src/services/auth.service.ts`) — independent of the
IP limiter and **global** (tracked per account in the DB, so instance count
doesn't matter): after **5 consecutive failed passwords**, the account is locked
for **15 minutes** (returns HTTP 423). Counters reset on a successful login; an
ADMIN can clear a lock early by resetting the password or re-enabling the
account (both also clear the lock), and it auto-expires. This is the primary
brute-force defense — combined with Argon2id's deliberately slow hashing,
password guessing is impractical. (Trade-off: a known email can be locked by an
attacker; the 15-min window and admin recovery path keep this low-impact.)

> **Limitation:** the *IP* limiter is **in-memory / per-instance** (no Redis, per
> project constraints). On Cloud Run with N instances the effective per-IP limit
> is ~limit × N. It's a solid basic guard; the account lockout above is the
> global brute-force control. For global *per-IP* limiting + WAF/DDoS in
> production, front Cloud Run with an external HTTPS Load Balancer and a
> **Cloud Armor** rate-limit policy (see `docs/gcp-deployment.md`). A Redis/
> Memorystore-backed limiter is another option if you later need strict global
> app-level limits.

## 4. Security headers & Content-Security-Policy

Set for all routes in `next.config.mjs → headers()`:

| Header                     | Value / purpose                                             |
| -------------------------- | ----------------------------------------------------------- |
| `Content-Security-Policy`  | Allowlists what can load/run (see below)                    |
| `Strict-Transport-Security`| `max-age=31536000; includeSubDomains` — **production only** |
| `X-Content-Type-Options`   | `nosniff`                                                   |
| `X-Frame-Options`          | `DENY` (+ CSP `frame-ancestors 'none'`) — anti-clickjacking |
| `Referrer-Policy`          | `strict-origin-when-cross-origin`                           |
| `Permissions-Policy`       | `camera=(self)` (check-in scanner), microphone/geolocation denied |

**CSP directives** (why each matters):

- `default-src 'self'`, `base-uri 'self'`, `object-src 'none'` — baseline lockdown.
- `frame-ancestors 'none'` — the site can't be embedded in an iframe.
- `img-src 'self' data: blob: https:` — QR PNGs, inline data URIs, camera frames.
- `script-src 'self' 'unsafe-inline' blob:` (+ `'unsafe-eval'` in dev only) —
  runs only our JS; `blob:` for the QR-scanner worker.
- `style-src 'self' 'unsafe-inline'`, `font-src 'self' data:`.
- `connect-src 'self'` (+ `ws:`/`wss:` in dev for HMR).
- `worker-src 'self' blob:` — the html5-qrcode scanner worker.
- **`form-action 'self' https://checkout.payway.com.kh https://checkout-sandbox.payway.com.kh`**
  — lets the checkout form POST to PayWay; nothing else can be a form target.

> **Limitation:** `'unsafe-inline'` is allowed for scripts/styles to support
> Next.js hydration. Tightening to a **nonce-based CSP** is a future improvement.

## 5. CSRF protection

- State-changing POSTs check the request **Origin** against the host
  (`isSameOrigin`, `src/lib/http.ts`), combined with `SameSite=Lax` session
  cookies.

> **Future:** the plan also mentions double-submit CSRF tokens for
> cookie-authenticated form actions; not yet added (Origin check + SameSite is
> the current mechanism).

## 6. Input validation

- All request bodies are validated with **Zod** before use (login, checkout,
  admin/staff actions, etc.). Invalid input → 400.

## 7. Payment integrity (ABA PayWay)

- **Server-side confirmation only** — a browser redirect back from PayWay is
  never treated as proof of payment.
- The unsigned pushback is treated as a "check now" trigger; the real status is
  fetched via the **signed check-transaction API** (HMAC-SHA512), and the
  **amount + currency are verified** against our record before marking PAID.
  `src/services/payments/payway-provider.ts`, `src/lib/payway-hash.ts`.
- **Idempotent** confirmation: unique `(provider, merchant_transaction_id)` and
  a `FOR UPDATE`-locked order transition, so duplicate callbacks can't
  double-issue tickets or double-count inventory.
- No card data ever touches the app (all card entry happens on PayWay's page).

## 8. QR ticket security

- QR encodes a **signed token**: `base64url(payload).base64url(HMAC-SHA256)` over
  `{version, ticketId, eventId, tokenId}` using `TICKET_SIGNING_SECRET`.
  `src/lib/qr-signing.ts`.
- Verification uses **timing-safe comparison**; the payload holds only opaque
  ids (no customer data); the **database is the source of truth** for validity
  at check-in.

## 9. Overselling & double-check-in prevention

- Seat reservation locks candidate seats with `SELECT … FOR UPDATE SKIP LOCKED`
  in a single transaction — two buyers can never get the same seat
  (`src/services/order.service.ts`). The number of rows locked per checkout is a
  bounded, tunable window (`seatLockLimit`) to avoid falsely rejecting concurrent
  buyers — see the concurrency-tuning note in `docs/gcp-deployment.md` §15.
- Check-in is an atomic `UPDATE … WHERE status='VALID'` verified via
  `UpdateResult.affected`, so a ticket can be admitted only once
  (`src/services/check-in.service.ts`).

## 10. Data exposure & secrets

- **Public URLs use random unguessable tokens** (`orders.public_token`,
  `tickets.public_token`) — internal database IDs are never exposed in URLs.
- Secrets come from env / Secret Manager, never `NEXT_PUBLIC_*`; `.env` is
  gitignored. Secrets, card data, session tokens, and the ticket signing secret
  are never written to logs.
- Structured JSON logging (`src/lib/logging.ts`) for auditability without
  leaking sensitive values.

## 11. Auditing

- Security-sensitive admin actions (refunds, cancellations, ticket voids, staff
  changes, event/zone edits, logins/failures) are recorded in `audit_logs`
  (viewable at **Admin → Audit**). Check-in activity is recorded in
  `check_in_logs`.

## 12. SQL safety

- All database access uses **parameterized queries** (TypeORM repositories or
  `$1`-style parameters) — no string interpolation of user input.

---

## Summary of known limitations (candidates for future hardening)

- IP rate limiter is per-instance (no Redis); use Cloud Armor for global per-IP
  limiting at the edge. (Login brute-force is already covered globally by the
  DB-backed account lockout.)
- CSP allows `'unsafe-inline'` scripts — nonce-based CSP would be stricter.
- CSRF is Origin-check + SameSite, not double-submit tokens.
- Refunds are record-only (no automated PayWay refund yet).
- Deploy-time items (load test, backup verification, protected task scheduling)
  are covered in `docs/gcp-deployment.md` and `docs/event-day-runbook.md`.

# Google Cloud Deployment Spec — Cambodia Event Ticketing System

Handoff document for the DevOps engineer. It describes exactly what to provision
on Google Cloud to run this application. It is a specification, not a script —
adapt names/IDs to your conventions. `gcloud` commands are illustrative.

The app is a single Next.js (App Router) service (Node 24) backed by
PostgreSQL. It is stateless except for the database; scale it horizontally on
Cloud Run.

---

## 1. Architecture

```
Customer / staff browser
        │  HTTPS
        ▼
   Cloud Run  ── Next.js app (Docker, port 8080, node server.js)
        │
        ├── Cloud SQL for PostgreSQL   (all application data)
        ├── Secret Manager             (all secrets/config)
        ├── Cloud Scheduler            (order-expiry + reconcile sweeps → internal endpoints)
        ├── Cloud Storage (optional)   (not required for v1 — see §16)
        └── outbound: ABA PayWay API, Resend (email)
```

- **Region:** `asia-southeast1` (Singapore) for all resources.
- **Two projects** (see §3): `ticketing-development` and `ticketing-production`.

---

## 2. Enable APIs (per project)

```
run.googleapis.com
sqladmin.googleapis.com
secretmanager.googleapis.com
artifactregistry.googleapis.com
cloudbuild.googleapis.com
cloudscheduler.googleapis.com
logging.googleapis.com
monitoring.googleapis.com
# optional: cloudtasks.googleapis.com, storage.googleapis.com
```

---

## 3. Environment separation

Provision **two independent projects** with identical infrastructure:

| Project                 | PayWay creds     | Purpose                    |
| ----------------------- | ---------------- | -------------------------- |
| `ticketing-development` | PayWay **sandbox** | staging / testing        |
| `ticketing-production`  | PayWay **live**    | real ticket sales        |

Never allow sandbox PayWay callbacks to reach production. Secrets, database,
domain, and email sender differ per project.

---

## 4. Application runtime facts (do not change)

| Item                 | Value                                                        |
| -------------------- | ------------------------------------------------------------ |
| Container port       | `8080` (Dockerfile sets `PORT=8080`, `HOSTNAME=0.0.0.0`)     |
| Start command        | `node server.js` (Next.js standalone; already in Dockerfile) |
| Node version         | 24.x                                                         |
| Health check         | `GET /api/health` → `{ "status":"ok","database":"connected" }` (200) |
| DB migrations        | `yarn migration:run` (TypeORM; **never** auto-synchronize)   |
| Seed first admin     | `yarn create-admin` (reads `ADMIN_*` env, one-off)           |
| Expiry/reconcile     | scheduled POSTs to internal endpoints (see §10)              |

A production `Dockerfile` already exists in the repo (multi-stage, standalone
output, non-root user). Build it as-is.

---

## 5. Secrets & configuration (Secret Manager)

Create these as Secret Manager secrets in **each** project and inject them into
Cloud Run (see §8). Do **not** bake them into the image or use `NEXT_PUBLIC_`
prefixes.

| Env var                | Required | Source / notes                                                                 |
| ---------------------- | -------- | ------------------------------------------------------------------------------ |
| `NODE_ENV`             | yes      | `production` (plain env var, not a secret)                                     |
| `DATABASE_URL`         | yes      | Postgres connection string (see §6). Secret.                                   |
| `APPLICATION_BASE_URL` | yes      | Public HTTPS base URL, e.g. `https://tickets.example.com` (see §12). No trailing slash. |
| `TICKET_SIGNING_SECRET`| yes      | Long random string (≥32 bytes). Signs QR tokens. Secret. **Never rotate after tickets are issued** or existing QR codes stop validating. |
| `INTERNAL_API_SECRET`  | yes (prod) | Long random string. Guards `/api/internal/*`. Cloud Scheduler must send it (see §10). Secret. |
| `PAYMENT_PROVIDER`     | yes      | `payway` in prod (`fake` only for non-prod smoke tests).                        |
| `PAYWAY_MERCHANT_ID`   | yes      | From ABA. Secret. Sandbox vs live per project.                                  |
| `PAYWAY_API_KEY`       | yes      | From ABA. Secret.                                                               |
| `PAYWAY_BASE_URL`      | yes      | Sandbox: `https://checkout-sandbox.payway.com.kh` · Prod: `https://checkout.payway.com.kh` |
| `EMAIL_PROVIDER`       | yes      | `resend` in prod.                                                               |
| `EMAIL_API_KEY`        | yes      | Resend API key. Secret.                                                         |
| `EMAIL_FROM`           | yes      | Verified sender, e.g. `Tickets <tickets@example.com>`.                          |
| `ADMIN_EMAIL` / `ADMIN_NAME` / `ADMIN_PASSWORD` | one-off | Only needed transiently to seed the first admin (§9). Do not keep on the service. |

Generate strong secrets, e.g. `openssl rand -base64 48`.

---

## 6. Cloud SQL for PostgreSQL

- **Engine:** PostgreSQL **16** (must be ≥13 — the schema uses `gen_random_uuid()`).
- **Tier:** start small (e.g. `db-custom-1-3840` or a shared-core tier); size up
  before the sales window. Enable **HA** for production if downtime during
  sales is costly.
- **Storage:** 10–20 GB SSD, automatic increase on.
- **Backups:** automated daily backups **and** point-in-time recovery enabled.
- **Deletion protection:** ON in production.
- Create a database (e.g. `ticketing`) and a dedicated app user (e.g. `ticketing_app`) — not the `postgres` superuser.

### Connecting from Cloud Run

Use the built-in Cloud SQL connection (`--add-cloudsql-instances`), which mounts
a unix socket at `/cloudsql/PROJECT:REGION:INSTANCE`. Set:

```
DATABASE_URL=postgresql://ticketing_app:PASSWORD@/ticketing?host=/cloudsql/PROJECT:REGION:INSTANCE
```

> **Verify this URL form parses** with node-postgres/TypeORM during the first
> deploy. If the socket form is problematic, run the **Cloud SQL Auth Proxy as a
> sidecar** (TCP on `127.0.0.1:5432`) and use a normal TCP URL:
> `postgresql://ticketing_app:PASSWORD@127.0.0.1:5432/ticketing`.

### Connection-pool math (important)

The app caps its TypeORM pool at **5 connections per instance**. Ensure:

```
Cloud Run max instances  ×  5  ≤  Cloud SQL max_connections
```

With max 10 instances that's ~50 connections — confirm the chosen Cloud SQL
tier allows it (raise the tier or `max_connections`, or lower Cloud Run max
instances, otherwise the final-tickets rush will exhaust connections).

---

## 7. Artifact Registry

Create a Docker repository in `asia-southeast1`, e.g.:

```
gcloud artifacts repositories create ticketing \
  --repository-format=docker --location=asia-southeast1
```

Images: `asia-southeast1-docker.pkg.dev/PROJECT/ticketing/app:TAG`.

---

## 8. Cloud Run service

Initial configuration (tune for load in §15):

| Setting            | Value                                    |
| ------------------ | ---------------------------------------- |
| CPU / Memory       | 1 vCPU / 1 GiB                            |
| Min instances      | 1 during the sales window (0 off-window) |
| Max instances      | 10 (see §15 for high-demand on-sales)    |
| Concurrency        | 40                                       |
| Request timeout    | 60s                                      |
| Ingress            | All (public); or via HTTPS LB (§12)      |
| Service account    | dedicated runtime SA (§11)               |

Wire config + secrets (illustrative):

```
gcloud run deploy ticketing \
  --image asia-southeast1-docker.pkg.dev/PROJECT/ticketing/app:TAG \
  --region asia-southeast1 \
  --service-account ticketing-run@PROJECT.iam.gserviceaccount.com \
  --add-cloudsql-instances PROJECT:asia-southeast1:INSTANCE \
  --set-env-vars NODE_ENV=production,PAYMENT_PROVIDER=payway,EMAIL_PROVIDER=resend,PAYWAY_BASE_URL=https://checkout.payway.com.kh,APPLICATION_BASE_URL=https://tickets.example.com \
  --set-secrets DATABASE_URL=DATABASE_URL:latest,TICKET_SIGNING_SECRET=TICKET_SIGNING_SECRET:latest,INTERNAL_API_SECRET=INTERNAL_API_SECRET:latest,PAYWAY_MERCHANT_ID=PAYWAY_MERCHANT_ID:latest,PAYWAY_API_KEY=PAYWAY_API_KEY:latest,EMAIL_API_KEY=EMAIL_API_KEY:latest,EMAIL_FROM=EMAIL_FROM:latest \
  --min-instances 1 --max-instances 10 --concurrency 40 --timeout 60 --port 8080
```

Confirm liveness by hitting `/api/health`.

---

## 9. Database migrations & first admin

Migrations are **not** run by the app at startup. Run them explicitly against
the production database, either as a step in the Cloud Build pipeline (§13) or a
one-off Cloud Run **Job** using the same image. The command needs dev
dependencies (TypeORM CLI + ts-node), so run it from the source/build stage, not
the slim runtime image:

```
yarn install --frozen-lockfile
yarn migration:run          # applies all migrations in src/migrations
```

Then seed the first admin **once** (one-off job with ADMIN_* env set), then
remove those env vars:

```
ADMIN_EMAIL=... ADMIN_NAME="..." ADMIN_PASSWORD="<12+ chars>" yarn create-admin
```

Additional staff (including check-in staff) are created afterwards in the app's
Admin → Staff screen.

---

## 10. Scheduled jobs — order expiry & payment reconcile

The app exposes protected internal endpoints (POST):

| Endpoint                               | Purpose                                              |
| -------------------------------------- | ---------------------------------------------------- |
| `/api/internal/orders/sweep-expired`   | Release seats of expired unpaid orders (run ~every 1 min) |
| `/api/internal/orders/{id}/expire`     | Expire one order (used by per-order Cloud Tasks, optional) |
| `/api/internal/payments/reconcile`     | Re-check a payment's status with PayWay (body `{ merchantTransactionId }`) |

**Recommended (works with current code): Cloud Scheduler → sweep endpoint.**
Create a Cloud Scheduler job that POSTs to `/api/internal/orders/sweep-expired`
every minute. Authentication: these endpoints currently authorize via a shared
secret header — the job must send:

```
Header:  x-internal-secret: <INTERNAL_API_SECRET value>
```

> If you prefer OIDC-based auth (Scheduler/Tasks with an invoker service account
> instead of a shared header), that requires a small code change to validate the
> OIDC token — flag it to the app developer. For v1 the shared-secret header is
> the supported mechanism.

Per-order Cloud Tasks (`/orders/{id}/expire`) are optional and currently a
no-op in code; the minute-ly sweep fully covers expiry, so Cloud Tasks is not
required for v1.

---

## 11. Service accounts & IAM

**Runtime service account** (attached to Cloud Run), least privilege:

| Role                                   | Why                          |
| -------------------------------------- | ---------------------------- |
| `roles/cloudsql.client`                | connect to Cloud SQL         |
| `roles/secretmanager.secretAccessor`   | read injected secrets        |
| `roles/logging.logWriter`              | structured logs              |
| `roles/storage.objectAdmin` (optional) | only if Cloud Storage is used (§16) |

Do **not** grant Owner/Editor. 

**Scheduler invoker:** if the Cloud Run service is not public, give the Cloud
Scheduler job's service account `roles/run.invoker`. (With the shared-secret
header approach the endpoint still validates the header regardless.)

**Cloud Build:** the build service account needs Artifact Registry write, Cloud
Run deploy (`roles/run.admin` + `roles/iam.serviceAccountUser`), and Cloud SQL
client (if running migrations in the pipeline).

---

## 12. Domain, HTTPS & base URL

- Map a custom domain to the Cloud Run service (Cloud Run domain mapping or an
  external HTTPS Load Balancer + serverless NEG). TLS is required — the check-in
  camera and secure cookies need HTTPS.
- Set `APPLICATION_BASE_URL` to the final public URL (e.g.
  `https://tickets.example.com`). It is used to build PayWay `return_url`,
  ticket links, and QR image URLs in emails, so it **must** be the public HTTPS
  domain.

### Global rate limiting & WAF (Cloud Armor)

The app's built-in IP rate limiter is in-memory / per-instance (see
`docs/security.md` §3). For a **global** per-IP limit plus DDoS/WAF protection,
front Cloud Run with an **external HTTPS Load Balancer** (serverless NEG) and
attach a **Cloud Armor** security policy with a rate-based-ban rule — e.g.
throttle/ban a source IP that exceeds N requests/min, optionally allowlist
office IPs and block known-bad ranges. It runs at the edge, before requests
reach Cloud Run, and needs no app change. This is the recommended production
control for abuse/DDoS.

Note: brute-force on a specific staff login is already covered globally by the
app's DB-backed **account lockout** (5 failed attempts → 15-min lock), so Cloud
Armor is about edge/IP-level abuse, not login protection.

---

## 13. ABA PayWay production configuration

- Use **live** `PAYWAY_MERCHANT_ID` / `PAYWAY_API_KEY` and
  `PAYWAY_BASE_URL=https://checkout.payway.com.kh`.
- **Whitelist the production domain** in the ABA PayWay merchant profile — both
  the `return_url` domain (the app posts the pushback to
  `{APPLICATION_BASE_URL}/api/payments/payway/callback`) and the request domain.
  ABA rejects non-whitelisted domains (`error 6: wrong domain`).
- The app already forces the hosted-checkout service (`payment_gate=0`). No
  change needed.
- Payment confirmation is verified server-side via PayWay's signed
  check-transaction API; the pushback alone is never trusted.

---

## 14. Email (Resend)

- Set `EMAIL_PROVIDER=resend`, `EMAIL_API_KEY`, and a **verified**
  `EMAIL_FROM` (verify the sending domain in Resend, incl. SPF/DKIM).
- Confirmation-email QR images are served from `APPLICATION_BASE_URL`, so that
  domain must be publicly reachable for images to render in inboxes.
- (Postmark/SendGrid can be swapped in behind the same interface with a small
  code change if preferred.)

---

## 15. Scale considerations (event is ~60,000 seats)

- Sales are **rolling/steady** (no single hyped drop), so the standard config is
  fine. Still, before the sales window:
  - Load-test concurrent checkout + payment callback + check-in (Phase 10).
  - Verify the connection-pool math in §6 against the chosen Cloud SQL tier.
  - Consider `min-instances ≥ 1` and a higher `max-instances` during sales.
- If the plan ever changes to a **single high-demand on-sale**, a virtual
  waiting room / queue would be needed — not built, flag to the developer.

### Concurrency tuning knobs (validate under load test)

- **Seat-lock window** — `src/services/order.service.ts` (`seatLockLimit`,
  `SEAT_LOCK_MIN` / `SEAT_LOCK_MAX`). Each checkout locks this many available
  seat rows with `FOR UPDATE SKIP LOCKED`. Default is `quantity × 4`, clamped
  40–200. Trade-off: **smaller** = more concurrent buyers per zone; **larger** =
  better chance of seating a group contiguously. If the load test shows false
  "not enough seats" under concurrency on a hot/small zone (e.g. VIP), lower it;
  if groups rarely get adjacent seats, raise it.
- **Pending-order caps** — **per-event settings** (`events.max_pending_per_email`
  default 3, `events.max_pending_per_ip` default 20), editable in Admin → Event;
  code fallback in `src/services/order.service.ts`. Cap concurrent unpaid holds
  (event-scoped) to prevent inventory lockup. Keep the **per-IP** cap generous:
  shared NAT (office/venue wifi, mobile carriers) puts many legitimate buyers
  behind one IP, so too low a value would block real customers. If real buyers
  on shared networks get blocked, raise the IP cap for that event (or rely on
  the email cap + Cloud Armor).

---

## 16. Cloud Storage (optional — not required for v1)

The app does **not** currently write to Cloud Storage. CSV attendee exports are
streamed directly from the app; tickets are links + inline QR (no stored PDFs).
Provision a **private** bucket only if/when PDF tickets or stored exports are
added later. If added: private bucket, signed URLs for downloads, random object
names, grant the runtime SA `roles/storage.objectAdmin` on that bucket only.

---

## 17. CI/CD — Cloud Build pipeline

Recommended pipeline (mirrors repo scripts):

1. `yarn install --frozen-lockfile`
2. `yarn lint`
3. `yarn typecheck`
4. `yarn test`
5. `yarn build`
6. `docker build` → tag with commit SHA
7. push image to Artifact Registry
8. `yarn migration:run` against Cloud SQL (via Auth Proxy in the build step)
9. `gcloud run deploy` new revision
10. smoke test: `curl -f https://.../api/health`

Keep `synchronize: false` everywhere (it already is) — migrations only.

---

## 18. Logging, monitoring & alerts

- App logs are **structured JSON** with a `severity` field → parsed by Cloud
  Logging automatically.
- Suggested alerts (detailed in Phase 10):
  - Cloud Run 5xx error-rate spike
  - Cloud SQL connection count near limit
  - PayWay callback failures / reconcile errors
  - Cloud Scheduler job failures (expiry sweep)
  - Email send failures
- Never log secrets, card data, session tokens, or the ticket signing secret
  (the app already avoids this).

---

## 19. Go-live checklist

- [ ] Prod project, APIs enabled, region `asia-southeast1`
- [ ] Cloud SQL (PG16) created, backups + PITR + deletion protection on
- [ ] All secrets in Secret Manager
- [ ] Artifact Registry repo created
- [ ] Runtime service account with least-privilege roles
- [ ] Image built & pushed; migrations run; `/api/health` green
- [ ] First admin seeded (`create-admin`), then ADMIN_* removed
- [ ] Custom domain + HTTPS; `APPLICATION_BASE_URL` set to it
- [ ] Live PayWay creds; production domain whitelisted with ABA
- [ ] Resend domain verified; `EMAIL_FROM` set
- [ ] Cloud Scheduler minute-ly sweep with `x-internal-secret` header
- [ ] Connection-pool math validated against Cloud SQL tier
- [ ] (Recommended) HTTPS LB + Cloud Armor rate-limit/WAF policy for edge abuse
- [ ] Load test passed (Phase 10) before the sales window
```

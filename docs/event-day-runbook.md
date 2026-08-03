# Event-Day Operational Runbook — Cambodia Event Ticketing System

Practical playbook for the people running ticket sales and door check-in.
Assumes the app is deployed (see `docs/gcp-deployment.md`) with PayWay live
credentials, a verified email domain, and Cloud Scheduler running the expiry
sweep.

Fill in the blanks (`<…>`) for your event before the day.

- **Public site:** `<https://tickets.example.com>`
- **Admin:** `<…>/admin` · **Check-in:** `<…>/check-in`
- **On-call / escalation:** `<name, phone>`
- **ABA PayWay merchant support:** `digitalsupport@ababank.com` / merchant hotline
- **DevOps (infra/GCP):** `<name, phone>`

---

## Roles

| Role             | Can do                                                        |
| ---------------- | ------------------------------------------------------------ |
| ADMIN            | Everything: dashboard, orders, refunds, staff, audit         |
| MANAGER          | Orders/attendees, resend, undo check-in (no staff/refund mgmt via staff page) |
| CHECK_IN_STAFF   | Scan, search, check in only                                  |

Create door staff accounts in **Admin → Staff** as `CHECK_IN_STAFF` **before**
the event. Each scanner device signs in at `/check-in/login`.

---

## 1. Before sales open (T‑1 day)

- [ ] `GET /api/health` returns `{"status":"ok","database":"connected"}`.
- [ ] **Admin → Event**: details correct; **Sales start/end** window is right
      (remember these are **UTC**); status is **PUBLISHED**.
- [ ] **Admin → Zones**: every zone's price and seat counts are correct; totals
      add up to the expected capacity.
- [ ] Do one **end-to-end test purchase** with a real card (small/refundable if
      possible, or a low-price zone): reserve → pay on PayWay → order shows
      **PAID**, seats **SOLD**, confirmation email received with a scannable QR.
- [ ] Confirm the **expiry sweep** is running (Cloud Scheduler job green) and a
      test unpaid order expires and releases its seats within ~1–2 min.
- [ ] Confirm door staff can log in to `/check-in` on the actual devices over
      **HTTPS** and the **camera** works.
- [ ] Note the current dashboard baseline (should be near zero).

## 2. When sales open

- [ ] Flip **Admin → Event** status to **PUBLISHED** (if not already) and/or the
      sales-start time passes. The public **Buy tickets** buttons activate.
- [ ] Watch the **Dashboard** for the first few real orders completing (PAID +
      email).
- [ ] Keep an eye on **Failed payments** — a few are normal (customers abandon);
      a sudden spike means investigate PayWay (see incidents).

## 3. During sales — monitor

Check the **Admin → Dashboard** periodically:

- **Gross revenue / Tickets sold** climbing as expected.
- **Pending orders** — some at any moment is normal (people mid-checkout); a
  large and growing number with few PAID suggests payment problems.
- **Held seats** — should churn (held → sold, or released on expiry). A large
  stuck "held" count means the expiry sweep may not be running.
- **Seats remaining** approaching 0 → nearly sold out.

Infra to watch (with DevOps): Cloud Run error rate, **Cloud SQL connection
count** (the app pools 5/instance — see deploy doc §6), and Cloud Scheduler job
success.

---

## Incident playbooks

### A. Customer paid but order still shows PENDING
Cause: PayWay's callback didn't reach us (network, whitelist, downtime). The
money is captured at ABA; we just haven't confirmed it.
1. In **Admin → Orders**, open the order; confirm with the customer they were
   charged.
2. Reconcile it (server re-checks PayWay authoritatively):
   `POST /api/internal/payments/reconcile` with header `x-internal-secret: <INTERNAL_API_SECRET>` and body `{"merchantTransactionId":"ORD-…"}`.
   (The order page also auto-reconciles while open.)
3. It should flip to **PAID**, seats **SOLD**, and send the ticket email. If
   PayWay reports it *not* approved, the customer was not charged — ask them to
   retry.

### B. Suspected overbooking / seat conflict
Overselling is prevented in code (atomic seat locking), so a true double-sell
shouldn't happen. If a seat looks doubly assigned:
1. **Admin → Attendees**, filter by that zone; look for duplicate seat labels.
2. Check **Admin → Audit** and `check_in_logs` for the history.
3. If a genuine conflict exists, **void** one ticket (Attendees → Void, releases
   the seat) and reissue/seat the customer manually. Escalate to DevOps to
   capture data before any DB change.

### C. Confirmation emails not arriving
1. Check the email provider dashboard (Resend → **Logs**) for sends/bounces.
2. Verify the sending **domain is still verified** and the API key valid.
3. Individual order: **Admin → Orders → open → Resend email** (now shows the
   real error if it fails).
4. Attendees can always access tickets via their **order/ticket link**; the QR
   is also embedded in the email. Direct them there if email is delayed.

### D. Payments failing broadly (many PAYMENT_FAILED / callback errors)
1. Confirm PayWay isn't down and your **domain is whitelisted** in the ABA
   merchant profile (`error 6: wrong domain`).
2. Check Cloud Run logs for callback errors.
3. Contact ABA PayWay merchant support. Meanwhile, reservations still hold seats
   for the configured window; customers can retry.

### E. Cloud SQL connections exhausted / DB errors
1. Symptom: 5xx spikes, "too many connections".
2. With DevOps: raise the Cloud SQL tier / `max_connections`, or lower Cloud Run
   **max instances** so `instances × 5 ≤ max_connections` (deploy doc §6).

### F. App is down / bad deploy
1. `GET /api/health` failing.
2. With DevOps: **roll back** Cloud Run to the previous revision (instant), then
   diagnose. Never run `synchronize` — schema changes are migrations only.

### G. Refund request
Refunds are **record-only** in this system:
1. **Admin → Orders → open → Refund (record only)** — this voids the tickets,
   releases the seats for resale, and marks the order REFUNDED (audited).
2. **Then actually return the money in the ABA/PayWay portal manually.** The app
   does not move funds.

---

## 4. Check-in day (at the door)

- [ ] Each device: sign in at `/check-in/login`, allow camera, open
      **`/check-in/scan`**.
- [ ] Flow: scan → review the attendee/zone/seat → tap **Check in** (green) →
      scanner re-arms for the next person. Orange = already checked in;
      red = invalid/cancelled/refunded — send to the help desk.
- [ ] **No ticket / dead phone:** **`/check-in/search`** by name, email, ticket
      number, or order number, then check in from the result.
- [ ] Requires **internet** (online validation — no offline mode in v1). Ensure
      solid Wi-Fi/data at the gate. If connectivity drops, pause and use a single
      stable connection; do not improvise offline check-in (risks duplicates).
- [ ] Wrong check-in? An ADMIN/MANAGER can **undo** it (Attendees → Undo, or the
      check-in was logged in **History**).
- [ ] Monitor **Admin → Dashboard** check-in % and **`/check-in/history`**.

## 5. After the event

- [ ] **Admin → Attendees → Export CSV** for the final attendance record.
- [ ] Note final numbers from the Dashboard.
- [ ] With DevOps: scale Cloud Run min instances back to 0, verify a database
      backup exists, and rotate any secrets if required.

---

## Quick reference — where things live

| Need to…                         | Go to                                              |
| -------------------------------- | -------------------------------------------------- |
| See sales/check-in numbers       | Admin → Dashboard                                  |
| Find/refund/cancel/resend order  | Admin → Orders                                     |
| Find attendee / void / undo / CSV| Admin → Attendees                                  |
| Add door staff                   | Admin → Staff (ADMIN only)                         |
| See who did what                 | Admin → Audit                                      |
| Reconcile a stuck payment        | `POST /api/internal/payments/reconcile` (x-internal-secret) |
| Force-release expired holds      | `POST /api/internal/orders/sweep-expired` (x-internal-secret) |
| Scan / manual check-in           | /check-in                                          |
| App health                       | `GET /api/health`                                  |

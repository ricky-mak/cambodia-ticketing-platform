# Cambodia Event Ticketing System — Implementation Plan

## 1. Project Goal

Build a small production-ready ticketing system for a single event in Cambodia.

The system must allow customers to:

- View event information
- Select a ticket type
- Reserve tickets temporarily
- Pay through ABA PayWay
- Receive a QR-code ticket by email
- Present the QR code at the event entrance

Event staff must be able to:

- Log in securely
- Scan ticket QR codes from a mobile browser
- Validate tickets
- Check attendees in
- Detect duplicate or invalid tickets
- Search attendees manually
- View sales and check-in statistics

The system will be deployed entirely on Google Cloud.

---

## 2. Technical Stack

Use the following technologies.

### Application

- Next.js with App Router
- TypeScript
- Yarn
- Tailwind CSS
- shadcn/ui
- React Hook Form
- Zod

### Backend

- Next.js Route Handlers
- TypeORM
- PostgreSQL
- Server-side session authentication
- REST-style internal API endpoints

### Google Cloud

- Cloud Run for application hosting
- Cloud SQL for PostgreSQL
- Cloud Tasks for delayed and asynchronous jobs
- Cloud Storage for generated files and exports
- Secret Manager for secrets
- Artifact Registry for Docker images
- Cloud Build for deployment
- Cloud Logging and Cloud Monitoring

### External Services

- ABA PayWay hosted checkout
- Resend, Postmark, or SendGrid for transactional email

### Ticketing

- Signed QR-code tokens
- Browser-based Progressive Web App for check-in
- Online ticket validation

Do not use:

- Kubernetes
- GKE
- Redis
- Firestore
- Microservices
- Native mobile applications
- Separate frontend and backend repositories

---

## 3. Application Architecture

Build the system as a single Next.js application.

The application must contain:

```text
Public website
Admin dashboard
Staff check-in PWA
Backend API
Payment callback handlers
Background task handlers
```

High-level architecture:

```text
Customer Browser
      |
      v
Cloud Run
Next.js Application
      |
      +---- Cloud SQL PostgreSQL
      |
      +---- Cloud Tasks
      |
      +---- Cloud Storage
      |
      +---- Secret Manager
      |
      +---- ABA PayWay
      |
      +---- Email Provider
```

Keep the application as a modular monolith.

Business logic must live in service classes rather than directly inside route handlers or React components.

---

## 4. Main User Flows

### 4.1 Customer Purchase Flow

1. Customer opens the event page.
2. Customer views available ticket types.
3. Customer selects a quantity.
4. Customer enters:
   - Full name
   - Email
   - Phone number
5. The backend validates availability.
6. The backend creates a pending order.
7. The backend reserves the requested inventory.
8. The backend sets a reservation expiration time.
9. The backend schedules a Cloud Task to expire the order.
10. The backend creates an ABA PayWay checkout transaction.
11. The customer is redirected to PayWay.
12. The customer pays using an enabled method such as:
    - ABA KHQR
    - Visa
    - Mastercard
13. ABA PayWay sends a server-to-server payment callback.
14. The backend validates the callback.
15. The backend verifies:
    - Merchant transaction ID
    - Payment amount
    - Currency
    - Payment status
    - Callback signature or hash
16. The backend marks the order as paid.
17. The backend creates ticket records.
18. The backend creates signed QR tokens.
19. The backend queues a confirmation email.
20. The customer receives the ticket by email.
21. The confirmation page displays the successful order.

The system must never create tickets based only on the customer returning from the PayWay website.

Tickets may only be issued after trusted server-side payment confirmation.

### 4.2 Reservation Expiration Flow

When a pending order is created:

1. Reserve the inventory.
2. Set `reservationExpiresAt`.
3. Create a Cloud Task scheduled for the expiration time.
4. The Cloud Task calls an internal protected endpoint.
5. The endpoint checks whether the order is still pending.
6. If the reservation has expired:
   - Mark the order as expired
   - Release the reserved inventory
7. If the order is already paid:
   - Return successfully
   - Make no changes

The expiration handler must be idempotent.

### 4.3 Check-In Flow

1. Staff logs in from a phone or tablet.
2. Staff opens the check-in scanner page.
3. The browser requests camera permission.
4. Staff scans a ticket QR code.
5. The application sends the signed token to the validation API.
6. The backend verifies:
   - QR signature
   - Ticket existence
   - Correct event
   - Ticket status
   - Check-in status
7. The UI displays:
   - Green for valid tickets
   - Red for invalid or cancelled tickets
   - Orange for already-used tickets
8. Staff confirms entry.
9. The backend atomically marks the ticket as checked in.
10. The response shows:
    - Attendee name
    - Ticket type
    - Ticket number
    - Check-in time

The check-in operation must prevent two devices from checking in the same ticket simultaneously.

---

## 5. Project Structure

Use this folder structure:

```text
ticketing-app/
├── src/
│   ├── app/
│   │   ├── (public)/
│   │   │   ├── page.tsx
│   │   │   ├── tickets/
│   │   │   ├── checkout/
│   │   │   ├── order/
│   │   │   └── ticket/
│   │   ├── admin/
│   │   │   ├── login/
│   │   │   ├── dashboard/
│   │   │   ├── orders/
│   │   │   ├── attendees/
│   │   │   ├── tickets/
│   │   │   ├── staff/
│   │   │   └── settings/
│   │   ├── check-in/
│   │   │   ├── login/
│   │   │   ├── scan/
│   │   │   ├── search/
│   │   │   └── history/
│   │   └── api/
│   │       ├── orders/
│   │       ├── checkout/
│   │       ├── payments/
│   │       │   └── payway/
│   │       │       ├── callback/
│   │       │       └── status/
│   │       ├── tickets/
│   │       │   ├── validate/
│   │       │   └── check-in/
│   │       ├── admin/
│   │       └── internal/
│   │           ├── expire-order/
│   │           ├── send-ticket-email/
│   │           └── generate-ticket/
│   ├── entities/
│   ├── migrations/
│   ├── repositories/
│   ├── services/
│   │   ├── order.service.ts
│   │   ├── inventory.service.ts
│   │   ├── payment.service.ts
│   │   ├── payway.service.ts
│   │   ├── ticket.service.ts
│   │   ├── check-in.service.ts
│   │   ├── email.service.ts
│   │   ├── cloud-task.service.ts
│   │   └── storage.service.ts
│   ├── lib/
│   │   ├── database.ts
│   │   ├── env.ts
│   │   ├── auth.ts
│   │   ├── session.ts
│   │   ├── qr-signing.ts
│   │   ├── money.ts
│   │   ├── logging.ts
│   │   └── validation.ts
│   ├── components/
│   ├── emails/
│   ├── types/
│   └── middleware.ts
├── public/
├── scripts/
├── tests/
├── Dockerfile
├── cloudbuild.yaml
├── package.json
├── tsconfig.json
└── README.md
```

---

## 6. Database Design

> **AMENDMENT (zone + seat model).** This event uses **auto-assigned reserved
> seating**, which supersedes the counter-based `ticket_types` design in §6.2
> and the counter logic in §7. Customers pick a **zone** and a quantity; the
> system automatically assigns specific numbered seats. Concretely:
>
> - **`events`** — unchanged (see §6.1).
> - **`zones`** replace `ticket_types` as the priced, sellable unit: one price
>   per zone (`price_minor`, `currency`), `total_seats`, `max_per_order`,
>   `display_order`, `status` (ACTIVE/HIDDEN/SOLD_OUT/DISABLED). A zone has many
>   seats.
> - **`seats`** are the inventory source of truth (one row per physical seat):
>   `event_id`, `zone_id`, `row_label`, `seat_number`, `status`
>   (AVAILABLE/HELD/SOLD/BLOCKED), `order_id` (nullable), `held_until`. Unique
>   on `(zone_id, row_label, seat_number)`; indexed on
>   `(zone_id, status, row_label, seat_number)`.
> - **Availability** is `count(seats WHERE status='AVAILABLE')` per zone — no
>   `reserved_quantity`/`sold_quantity` counters to drift.
> - **Allocation (Phase 4)** locks candidate seats with
>   `SELECT ... FOR UPDATE SKIP LOCKED`, preferring **contiguous** seats in one
>   row (same `row_label`, consecutive `seat_number`) and falling back to
>   scattered seats. This scales for rolling sales without a single hot counter
>   row.
> - Everywhere the original plan says `ticket_type_id`, read `zone_id`; each
>   issued ticket also carries its assigned `seat_id` / seat label.

Use PostgreSQL and TypeORM migrations.

Use UUIDs or ULIDs as primary keys.

Never use floating-point values for money.

Store monetary amounts as integer minor units.

Example:

```ts
amountMinor: 2500
currency: "USD"
```

This represents `$25.00`.

### 6.1 Event

```text
events
- id
- name
- slug
- description
- venue_name
- venue_address
- starts_at
- ends_at
- sales_start_at
- sales_end_at
- status
- currency
- created_at
- updated_at
```

Event statuses:

```text
DRAFT
PUBLISHED
SALES_CLOSED
COMPLETED
CANCELLED
```

### 6.2 Ticket Type

```text
ticket_types
- id
- event_id
- name
- description
- price_minor
- currency
- total_quantity
- reserved_quantity
- sold_quantity
- max_per_order
- sales_start_at
- sales_end_at
- status
- created_at
- updated_at
```

Ticket type statuses:

```text
ACTIVE
HIDDEN
SOLD_OUT
DISABLED
```

Availability:

```text
available =
total_quantity
- reserved_quantity
- sold_quantity
```

### 6.3 Order

```text
orders
- id
- event_id
- order_number
- customer_name
- customer_email
- customer_phone
- currency
- subtotal_minor
- total_minor
- status
- reservation_expires_at
- paid_at
- cancelled_at
- refunded_at
- created_at
- updated_at
```

Order statuses:

```text
PENDING
PAYMENT_PROCESSING
PAID
EXPIRED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED
PAYMENT_FAILED
```

Add a unique constraint to:

```text
order_number
```

### 6.4 Order Item

```text
order_items
- id
- order_id
- ticket_type_id
- ticket_type_name
- quantity
- unit_price_minor
- total_price_minor
- created_at
```

Store the ticket type name and price as snapshots so historical orders are not changed when ticket configuration changes.

### 6.5 Payment

```text
payments
- id
- order_id
- provider
- merchant_transaction_id
- provider_transaction_id
- amount_minor
- currency
- status
- payment_method
- raw_request
- raw_callback
- failure_reason
- paid_at
- created_at
- updated_at
```

Payment statuses:

```text
PENDING
SUCCESS
FAILED
CANCELLED
REFUNDED
PARTIALLY_REFUNDED
```

Add unique constraints:

```text
(provider, merchant_transaction_id)
(provider, provider_transaction_id)
```

Allow `provider_transaction_id` to be nullable until received.

### 6.6 Ticket

```text
tickets
- id
- event_id
- order_id
- order_item_id
- ticket_type_id
- ticket_number
- attendee_name
- attendee_email
- qr_token_id
- status
- checked_in_at
- checked_in_by
- created_at
- updated_at
```

Ticket statuses:

```text
VALID
CHECKED_IN
CANCELLED
REFUNDED
VOID
```

Add unique constraints:

```text
ticket_number
qr_token_id
```

### 6.7 Staff User

```text
staff_users
- id
- name
- email
- password_hash
- role
- status
- last_login_at
- created_at
- updated_at
```

Roles:

```text
ADMIN
MANAGER
CHECK_IN_STAFF
```

Statuses:

```text
ACTIVE
DISABLED
```

### 6.8 Check-In Log

```text
check_in_logs
- id
- ticket_id
- staff_user_id
- action
- device_info
- ip_address
- created_at
```

Actions:

```text
CHECK_IN
UNDO_CHECK_IN
VALIDATION_FAILED
MANUAL_LOOKUP
```

### 6.9 Audit Log

```text
audit_logs
- id
- staff_user_id
- action
- entity_type
- entity_id
- previous_data
- new_data
- metadata
- created_at
```

Record sensitive admin actions, including:

- Refund
- Cancellation
- Ticket void
- Ticket reissue
- Manual check-in
- Undo check-in
- Staff account changes
- Event configuration changes

---

## 7. Inventory Logic

Inventory updates must use PostgreSQL transactions.

When creating an order:

1. Begin a database transaction.
2. Lock the requested ticket type rows using `FOR UPDATE`.
3. Verify sales are open.
4. Verify the requested quantity does not exceed the per-order limit.
5. Verify enough inventory remains.
6. Increment `reserved_quantity`.
7. Create the order.
8. Create order items.
9. Commit.

Conceptual SQL:

```sql
BEGIN;

SELECT *
FROM ticket_types
WHERE id = $1
FOR UPDATE;

-- Validate availability

UPDATE ticket_types
SET reserved_quantity = reserved_quantity + $2
WHERE id = $1;

-- Create order and order items

COMMIT;
```

When an order expires:

```text
reserved_quantity decreases
sold_quantity remains unchanged
```

When payment succeeds:

```text
reserved_quantity decreases
sold_quantity increases
```

Inventory updates and order status updates must happen in the same transaction.

Never rely on frontend availability calculations.

---

## 8. ABA PayWay Integration

Create a payment provider abstraction.

Example:

```ts
interface PaymentProvider {
  createCheckout(input: CreateCheckoutInput): Promise<CreateCheckoutResult>;
  verifyCallback(input: VerifyCallbackInput): Promise<VerifiedPaymentResult>;
  queryPaymentStatus(transactionId: string): Promise<PaymentStatusResult>;
  refundPayment?(input: RefundPaymentInput): Promise<RefundPaymentResult>;
}
```

Implement:

```text
PayWayPaymentProvider
```

### 8.1 Creating a Checkout

The backend should:

1. Generate a unique merchant transaction ID.
2. Create a local payment row with `PENDING` status.
3. Send the transaction details to PayWay.
4. Return the hosted checkout URL or checkout parameters.
5. Redirect the customer to PayWay.

The PayWay secret must never be exposed to the browser.

### 8.2 Callback Processing

Create:

```text
POST /api/payments/payway/callback
```

The callback handler must:

1. Preserve the raw callback payload.
2. Verify the PayWay signature or hash.
3. Find the payment by merchant transaction ID.
4. Confirm the payment is not already processed.
5. Verify:
   - Amount
   - Currency
   - Merchant ID
   - Transaction ID
   - Payment result
6. Begin a database transaction.
7. Lock the payment and order rows.
8. Mark the payment as successful.
9. Mark the order as paid.
10. Convert reserved inventory into sold inventory.
11. Create ticket records.
12. Commit the transaction.
13. Queue the confirmation email.
14. Return an HTTP success response.

The callback must be idempotent.

If PayWay sends the same callback multiple times, the system must not:

- Create duplicate tickets
- Increment sold inventory twice
- Send multiple confirmation emails unnecessarily

### 8.3 Payment Reconciliation

Create an internal reconciliation mechanism for uncertain payment states.

Cases include:

- Customer paid but callback was not received
- Callback timed out
- Cloud Run returned an error
- Payment status is unknown

Create:

```text
POST /api/internal/payments/reconcile
```

This endpoint should query PayWay using the merchant transaction ID and update the local payment status.

Protect this endpoint with Cloud Run IAM or OIDC authentication.

---

## 9. QR Ticket Security

Do not place a plain ticket database ID in the QR code.

Use a signed payload.

Example payload:

```json
{
  "version": 1,
  "ticketId": "ticket_uuid",
  "eventId": "event_uuid",
  "tokenId": "random_uuid"
}
```

Sign the serialized payload using HMAC-SHA256.

Use:

```text
TICKET_SIGNING_SECRET
```

The final QR token may use this format:

```text
base64url(payload).base64url(signature)
```

Validation must:

1. Split the token.
2. Recalculate the signature.
3. Use timing-safe signature comparison.
4. Parse the payload.
5. Validate the version.
6. Look up the ticket.
7. Confirm the ticket matches the event and token ID.

Do not include customer-sensitive information inside the QR payload.

The database remains the source of truth for ticket validity.

---

## 10. Check-In API

Create:

```text
POST /api/tickets/validate
POST /api/tickets/check-in
POST /api/tickets/undo-check-in
GET /api/tickets/search
```

### Validate Response

Example:

```json
{
  "valid": true,
  "ticket": {
    "ticketNumber": "EVT-000123",
    "attendeeName": "Sok Dara",
    "ticketType": "VIP",
    "status": "VALID",
    "checkedInAt": null
  }
}
```

### Invalid Response

Example:

```json
{
  "valid": false,
  "reason": "ALREADY_CHECKED_IN",
  "ticket": {
    "ticketNumber": "EVT-000123",
    "checkedInAt": "2026-09-12T10:43:00Z"
  }
}
```

Possible failure reasons:

```text
INVALID_SIGNATURE
TICKET_NOT_FOUND
WRONG_EVENT
CANCELLED
REFUNDED
VOID
ALREADY_CHECKED_IN
```

### Atomic Check-In

Use an atomic database update.

Conceptual SQL:

```sql
UPDATE tickets
SET
  status = 'CHECKED_IN',
  checked_in_at = NOW(),
  checked_in_by = $2
WHERE id = $1
  AND status = 'VALID'
RETURNING *;
```

If no row is returned, reload the ticket and return the appropriate failure state.

---

## 11. Authentication and Authorization

Use secure server-side sessions.

Do not use local storage for authentication tokens.

Session cookies must be:

```text
HttpOnly
Secure
SameSite=Lax or Strict
```

Passwords must be hashed using:

- Argon2id, preferred
- bcrypt, acceptable fallback

Implement role-based authorization.

### Admin

Can:

- View dashboard
- Manage ticket types
- View orders
- Cancel orders
- Process refunds
- Resend ticket emails
- Manage staff
- Export attendees
- Undo check-ins
- View audit logs

### Manager

Can:

- View orders
- View attendees
- Resend tickets
- Export attendees
- View check-in information
- Undo check-ins

### Check-In Staff

Can:

- Scan tickets
- Search attendees
- Check attendees in
- View recent check-ins

Cannot:

- Access payment details
- Refund orders
- Change event settings
- Manage users

---

## 12. Customer Pages

Build these public pages.

### Event Landing Page

Include:

- Event name
- Date and time
- Venue
- Event description
- Hero image
- Ticket types
- Price
- Remaining availability indicator
- Buy Tickets button
- Contact information
- Refund policy
- Terms and conditions

### Ticket Selection Page

Include:

- Ticket type cards
- Quantity selector
- Maximum per order
- Price summary
- Availability state
- Continue button

### Checkout Page

Collect:

- Full name
- Email
- Phone number
- Agreement to terms

Display:

- Order summary
- Reservation countdown
- Total amount
- Currency
- Pay button

### Payment Pending Page

Display:

- Order number
- Payment status
- Refresh status button
- Expiration countdown
- Instructions not to close the payment page unnecessarily

### Payment Success Page

Display:

- Successful payment message
- Order number
- Ticket summary
- Email delivery confirmation
- View-ticket link

### Ticket Page

Display:

- Event name
- Ticket type
- Attendee name
- Ticket number
- QR code
- Event date
- Venue
- Entry instructions

Do not expose database IDs in public URLs.

Use random public access tokens for ticket links.

---

## 13. Admin Dashboard

### Dashboard Metrics

Show:

- Total tickets sold
- Gross revenue
- Paid orders
- Pending orders
- Failed payments
- Remaining inventory
- Total attendees
- Total checked in
- Check-in percentage

### Orders Page

Support:

- Search by order number
- Search by customer name
- Search by email
- Search by phone
- Filter by status
- View order details
- View payment details
- Resend confirmation email
- Cancel pending order
- Process refund
- Download receipt if implemented

### Attendee Page

Support:

- Search
- Filter by ticket type
- Filter by check-in status
- Export CSV
- View ticket
- Resend ticket
- Void ticket
- Undo check-in for authorized roles

### Staff Page

Support:

- Create staff account
- Disable staff account
- Assign role
- Reset password
- View last login

### Settings Page

Support:

- Event information
- Sales start and end time
- Ticket types
- Reservation duration
- Purchase limits
- Email sender configuration
- Refund policy
- Event contact information

---

## 14. Check-In PWA

Create a mobile-first check-in interface.

Routes:

```text
/check-in/login
/check-in/scan
/check-in/search
/check-in/history
```

Required features:

- Camera QR scanning
- Large scan target
- Flashlight toggle when supported
- Sound feedback
- Vibration feedback
- Large green valid screen
- Large orange duplicate screen
- Large red invalid screen
- Manual ticket search
- Recent check-in history
- Staff logout
- Device-friendly layout

Use a maintained browser QR scanning library.

The scanner must work on:

- Android Chrome
- iPhone Safari

The application should be installable as a PWA, but installation must not be required.

The first version should require an internet connection.

Do not implement offline check-in synchronization initially.

---

## 15. Email Delivery

Send transactional emails for:

- Successful payment
- Ticket delivery
- Ticket resend
- Refund confirmation
- Event cancellation if needed

The purchase confirmation email must include:

- Event information
- Customer name
- Order number
- Ticket count
- Total paid
- Ticket links
- QR codes or attached ticket PDF
- Venue information
- Entry instructions
- Support contact

Prefer including a secure ticket link in addition to an embedded QR image.

Queue email sending through Cloud Tasks.

Email task processing must be idempotent.

Store email delivery attempts if practical.

---

## 16. Cloud Tasks

Create queues for:

```text
order-expiration
email-delivery
payment-reconciliation
file-generation
```

For a small first release, these may share one queue, but code should separate task types logically.

Each task must call a protected internal Cloud Run endpoint using OIDC.

Internal endpoints must not be publicly usable without valid service identity.

Examples:

```text
POST /api/internal/orders/{orderId}/expire
POST /api/internal/orders/{orderId}/send-confirmation
POST /api/internal/payments/{paymentId}/reconcile
```

Every task handler must be safe to retry.

Return a `2xx` response when:

- The work succeeds
- The work has already been completed
- No action is necessary

Return a non-`2xx` response only for retryable or genuine processing failures.

---

## 17. Google Cloud Deployment

Use:

```text
Region: asia-southeast1
```

Keep Cloud Run, Cloud SQL, Artifact Registry, Cloud Tasks, and Cloud Storage in the same region where possible.

### Cloud Run Initial Configuration

```text
CPU: 1 vCPU
Memory: 1 GiB
Minimum instances: 1 during sales
Maximum instances: 10
Concurrency: 40
Request timeout: 60 seconds
```

Set the minimum instances back to `0` after the active sales period if cost reduction is preferred.

### Cloud SQL Initial Configuration

Use:

```text
PostgreSQL
10–20 GB SSD storage
Automated backups enabled
Point-in-time recovery enabled
Deletion protection enabled in production
```

High availability is optional for a low-risk event, but recommended when downtime during the sales window would be costly.

### Database Connection Pool

Limit the TypeORM pool.

Example:

```ts
extra: {
  max: 5,
  min: 0,
  connectionTimeoutMillis: 10_000,
  idleTimeoutMillis: 30_000,
}
```

Ensure:

```text
Cloud Run maximum instances
×
maximum pool size
```

does not exceed the Cloud SQL connection limit.

---

## 18. Secret Manager

Store these values in Secret Manager:

```text
DATABASE_URL
DATABASE_PASSWORD
PAYWAY_MERCHANT_ID
PAYWAY_API_KEY
PAYWAY_PUBLIC_KEY
PAYWAY_BASE_URL
PAYWAY_CALLBACK_SECRET
TICKET_SIGNING_SECRET
SESSION_SECRET
EMAIL_API_KEY
EMAIL_FROM
APPLICATION_BASE_URL
CLOUD_TASKS_SERVICE_ACCOUNT
CLOUD_TASKS_AUDIENCE
```

Do not commit secrets to source control.

Do not expose secrets through variables prefixed with:

```text
NEXT_PUBLIC_
```

Use a dedicated Cloud Run runtime service account.

Grant only the permissions required for:

- Cloud SQL access
- Secret access
- Cloud Tasks creation
- Cloud Storage object access
- Logging

Do not grant Owner or Editor roles to the runtime service account.

---

## 19. Cloud Storage

Create a private bucket for:

- Ticket PDFs
- CSV exports
- Event assets
- Generated reports

Do not make the bucket public.

Use signed URLs for temporary downloads.

Use random storage object names.

Do not use customer email addresses as object names.

---

## 20. Logging and Monitoring

Use structured JSON logging.

Every request should include or generate a correlation ID.

Log:

- Order creation
- Payment initiation
- Payment callback received
- Payment verification result
- Ticket creation
- Reservation expiration
- Email delivery result
- Ticket validation
- Check-in
- Refund
- Admin actions

Never log:

- Card numbers
- CVVs
- Full PayWay secrets
- Session tokens
- Passwords
- Ticket signing secrets

Configure alerts for:

- Elevated Cloud Run error rate
- PayWay callback failures
- Cloud SQL connection exhaustion
- Cloud Task retry spikes
- Email delivery failures
- Low remaining inventory if useful

---

## 21. Security Requirements

Implement the following:

- Validate all request payloads with Zod
- Apply server-side authorization
- Protect admin and check-in routes
- Use CSRF protection for sensitive cookie-authenticated actions
- Rate-limit login attempts
- Rate-limit checkout creation
- Rate-limit QR validation endpoints
- Use idempotency for payment processing
- Verify PayWay callback signatures
- Use timing-safe signature comparison
- Use secure HTTP headers
- Sanitize user-controlled output
- Avoid raw SQL where TypeORM parameters can be used
- Use database constraints as well as application validation
- Do not store payment-card details
- Keep Cloud Storage private
- Keep internal task endpoints protected
- Record security-sensitive admin activity

Add a Content Security Policy that permits only the required application and payment domains.

---

## 22. Testing Strategy

### Unit Tests

Test:

- Money calculations
- Ticket availability calculation
- QR token signing
- QR token verification
- PayWay callback verification
- Order status transitions
- Reservation expiration
- Role authorization

### Integration Tests

Test with a real PostgreSQL test database:

- Concurrent ticket reservation
- Overselling prevention
- Payment callback idempotency
- Duplicate provider transaction IDs
- Expiration versus payment race conditions
- Ticket creation
- Atomic check-in
- Duplicate check-in prevention

### End-to-End Tests

Use Playwright.

Test:

1. Customer opens event page.
2. Customer selects tickets.
3. Customer creates an order.
4. Customer reaches payment stage.
5. Simulated callback marks payment successful.
6. Ticket is created.
7. Customer views ticket.
8. Staff logs in.
9. Staff validates ticket.
10. Staff checks ticket in.
11. Second check-in attempt is rejected.

### Load Tests

Test at least:

- Concurrent event page traffic
- Concurrent order creation
- Multiple users attempting to buy the final tickets
- Burst PayWay callbacks
- Concurrent check-in scans

The most important load test is preventing overselling under concurrent checkout attempts.

---

## 23. Development Phases

### Phase 1 — Project Foundation

Implement:

- Next.js project
- TypeScript
- Yarn
- Tailwind
- shadcn/ui
- Environment validation
- Logging
- TypeORM
- PostgreSQL connection
- Dockerfile
- Basic health endpoint

Deliverable:

```text
GET /api/health
```

The endpoint should verify application health and optionally basic database connectivity.

### Phase 2 — Authentication and Admin Setup

Implement:

- Staff user entity
- Password hashing
- Login
- Logout
- Secure sessions
- Role-based authorization
- Initial admin creation script
- Protected admin layout
- Audit logging foundation

Deliverable:

An administrator can log in and access the admin dashboard.

### Phase 3 — Event and Ticket Configuration

Implement:

- Event entity
- Ticket type entity
- Event settings UI
- Ticket type management
- Sales dates
- Inventory display
- Public event page

Deliverable:

An administrator can configure the event and publish ticket types.

### Phase 4 — Order and Inventory System

Implement:

- Order entity
- Order item entity
- Customer checkout form
- Availability validation
- Transactional inventory reservation
- Reservation expiration
- Order status pages
- Cloud Task scheduling

Deliverable:

Customers can reserve tickets without overselling.

### Phase 5 — ABA PayWay Sandbox

Implement:

- Payment provider interface
- PayWay provider
- Checkout creation
- Redirect flow
- Callback endpoint
- Signature verification
- Payment persistence
- Idempotent processing
- Payment reconciliation endpoint

Deliverable:

A sandbox PayWay transaction can move an order from pending to paid.

### Phase 6 — Ticket Generation

Implement:

- Ticket entity
- Ticket number generation
- Signed QR token
- Ticket page
- QR rendering
- Confirmation email
- Email task queue
- Ticket resend

Deliverable:

A paid order produces valid QR tickets and sends them by email.

### Phase 7 — Check-In PWA

Implement:

- Check-in staff login
- QR scanner
- Ticket validation
- Atomic check-in
- Duplicate detection
- Manual attendee search
- Recent check-in history
- Check-in audit logs
- Undo check-in for authorized roles

Deliverable:

Staff can scan and check in attendees from a mobile browser.

### Phase 8 — Admin Operations

Implement:

- Dashboard metrics
- Order search
- Attendee search
- CSV export
- Ticket resend
- Cancellation flow
- Refund placeholders or PayWay refund integration
- Staff management
- Audit log viewer

Deliverable:

Event operators can manage orders and attendees from the dashboard.

### Phase 9 — Google Cloud Deployment

Implement:

- Artifact Registry repository
- Cloud SQL instance
- Cloud Storage bucket
- Secret Manager entries
- Runtime service account
- Task invoker service account
- Cloud Tasks queues
- Cloud Run service
- Cloud Build configuration
- Domain and HTTPS
- Production environment variables
- Database migration deployment step

Deliverable:

The application runs in the production Google Cloud project.

### Phase 10 — Production Hardening

Implement:

- Error monitoring
- Logging dashboards
- Alerts
- Rate limiting
- Security headers
- Backup verification
- Payment reconciliation job
- Load testing
- Recovery procedures
- Event-day operational checklist

Deliverable:

The system is ready for production ticket sales and event check-in.

---

## 24. Required Environment Separation

Use separate Google Cloud projects:

```text
ticketing-development
ticketing-production
```

Development must use:

- PayWay sandbox credentials
- Development Cloud SQL
- Development secrets
- Development email configuration

Production must use:

- PayWay production credentials
- Production Cloud SQL
- Production secrets
- Production domain
- Production email sender

Never allow sandbox callbacks to modify production data.

---

## 25. Deployment Pipeline

Use Cloud Build.

Pipeline:

```text
1. Install dependencies with Yarn
2. Run linting
3. Run TypeScript checks
4. Run unit tests
5. Build Next.js
6. Build Docker image
7. Push image to Artifact Registry
8. Run database migrations
9. Deploy a new Cloud Run revision
10. Run smoke test
```

Do not run TypeORM automatic schema synchronization in production.

Use migrations only.

Set:

```ts
synchronize: false
```

in all deployed environments.

---

## 26. Acceptance Criteria

The project is complete when all of the following are true.

### Customer

- Customer can view event details.
- Customer can select ticket quantities.
- Customer cannot buy more than available inventory.
- Customer can create a temporary reservation.
- Reservation expires automatically.
- Customer can pay through ABA PayWay.
- Successful payment creates tickets exactly once.
- Customer receives ticket email.
- Customer can open a secure ticket page.
- Ticket contains a scannable QR code.

### Staff

- Staff can log in from a phone.
- Staff can scan a ticket.
- Valid ticket can be checked in.
- Duplicate check-in is rejected.
- Cancelled or refunded ticket is rejected.
- Staff can search for an attendee manually.
- Check-in activity is logged.

### Admin

- Admin can view sales statistics.
- Admin can search orders.
- Admin can search attendees.
- Admin can resend tickets.
- Admin can export attendees.
- Admin can manage staff accounts.
- Sensitive actions are written to the audit log.

### Payment

- Callback signatures are verified.
- Amount and currency are verified.
- Duplicate callbacks do not create duplicate tickets.
- Browser redirects are not considered payment proof.
- Unknown payments can be reconciled.

### Infrastructure

- Application runs on Cloud Run.
- PostgreSQL runs on Cloud SQL.
- Secrets are stored in Secret Manager.
- Delayed tasks use Cloud Tasks.
- Generated files use private Cloud Storage.
- Logs appear in Cloud Logging.
- Automated backups are enabled.
- Production does not use TypeORM schema synchronization.

---

## 27. Claude Code Execution Instructions

Work in small, reviewable stages.

For each phase:

1. Inspect the existing repository before modifying files.
2. Create or update a task checklist.
3. Implement one logical feature at a time.
4. Run linting and type checking after meaningful changes.
5. Add tests for critical business logic.
6. Do not silently change the architecture.
7. Do not introduce additional infrastructure without justification.
8. Do not use mock payment success in production routes.
9. Keep payment-provider code isolated behind an interface.
10. Use database transactions for inventory, payment completion, and check-in.
11. Use migrations for every schema change.
12. Update the README with setup and deployment instructions.
13. Document required environment variables.
14. Stop and report clearly when PayWay-specific documentation or credentials are required.

Prioritize correctness in this order:

```text
1. Payment verification
2. Overselling prevention
3. Ticket uniqueness
4. Duplicate check-in prevention
5. Security
6. Operational simplicity
7. UI polish
```

When ABA PayWay field names, signature algorithms, callback schemas, or endpoint URLs are unknown, do not invent them.

Create a typed adapter with clearly marked placeholders and request the official PayWay merchant integration documentation before completing those portions.

---

## 28. Initial Claude Code Task

Start by completing Phase 1 only.

Create the project foundation with:

- Next.js
- TypeScript
- Yarn
- Tailwind CSS
- shadcn/ui initialization
- TypeORM
- PostgreSQL configuration
- Environment-variable validation with Zod
- Structured logging
- Dockerfile for Cloud Run
- Health endpoint
- Initial README
- ESLint
- Type checking
- Unit test setup

Use this initial database configuration:

```text
Database: PostgreSQL
ORM: TypeORM
Production schema synchronization: disabled
Migration directory: src/migrations
```

Create:

```text
GET /api/health
```

Expected response:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "ISO-8601 timestamp"
}
```

Provide:

- The resulting file structure
- Commands to run locally on Windows 11 PowerShell
- A Docker-based PostgreSQL development setup
- Commands for linting, type checking, tests, migrations, and local development

Do not begin payment integration until the project foundation and database connectivity are working.

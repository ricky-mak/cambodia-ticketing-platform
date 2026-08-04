/**
 * Shared domain enums. Stored as varchar + CHECK constraint in the database
 * (rather than native Postgres enum types) so values are easy to evolve
 * through migrations.
 */

export enum StaffRole {
  ADMIN = "ADMIN",
  MANAGER = "MANAGER",
  CHECK_IN_STAFF = "CHECK_IN_STAFF",
}

export const STAFF_ROLES = Object.values(StaffRole);

export enum OrganizerStatus {
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export const ORGANIZER_STATUSES = Object.values(OrganizerStatus);

export enum StaffStatus {
  ACTIVE = "ACTIVE",
  DISABLED = "DISABLED",
}

export const STAFF_STATUSES = Object.values(StaffStatus);

export enum EventStatus {
  DRAFT = "DRAFT",
  PUBLISHED = "PUBLISHED",
  SALES_CLOSED = "SALES_CLOSED",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export const EVENT_STATUSES = Object.values(EventStatus);

export enum ZoneStatus {
  ACTIVE = "ACTIVE",
  HIDDEN = "HIDDEN",
  SOLD_OUT = "SOLD_OUT",
  DISABLED = "DISABLED",
}

export const ZONE_STATUSES = Object.values(ZoneStatus);

export enum OrderStatus {
  PENDING = "PENDING",
  PAYMENT_PROCESSING = "PAYMENT_PROCESSING",
  PAID = "PAID",
  EXPIRED = "EXPIRED",
  CANCELLED = "CANCELLED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
  REFUNDED = "REFUNDED",
  PAYMENT_FAILED = "PAYMENT_FAILED",
}

export const ORDER_STATUSES = Object.values(OrderStatus);

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  PARTIALLY_REFUNDED = "PARTIALLY_REFUNDED",
}

export const PAYMENT_STATUSES = Object.values(PaymentStatus);

export enum SeatStatus {
  AVAILABLE = "AVAILABLE",
  HELD = "HELD", // reserved by a pending order
  SOLD = "SOLD",
  BLOCKED = "BLOCKED", // administratively removed from sale
}

export const SEAT_STATUSES = Object.values(SeatStatus);

export enum TicketStatus {
  VALID = "VALID",
  CHECKED_IN = "CHECKED_IN",
  CANCELLED = "CANCELLED",
  REFUNDED = "REFUNDED",
  VOID = "VOID",
}

export const TICKET_STATUSES = Object.values(TicketStatus);

export enum CheckInAction {
  CHECK_IN = "CHECK_IN",
  UNDO_CHECK_IN = "UNDO_CHECK_IN",
  VALIDATION_FAILED = "VALIDATION_FAILED",
  MANUAL_LOOKUP = "MANUAL_LOOKUP",
}

export enum AuditAction {
  LOGIN = "LOGIN",
  LOGIN_FAILED = "LOGIN_FAILED",
  LOGOUT = "LOGOUT",
  STAFF_CREATED = "STAFF_CREATED",
  STAFF_UPDATED = "STAFF_UPDATED",
  STAFF_DISABLED = "STAFF_DISABLED",
  STAFF_PASSWORD_RESET = "STAFF_PASSWORD_RESET",
  ORGANIZER_CREATED = "ORGANIZER_CREATED",
  ORGANIZER_UPDATED = "ORGANIZER_UPDATED",
  ORGANIZER_STATUS_CHANGED = "ORGANIZER_STATUS_CHANGED",
  EVENT_CREATED = "EVENT_CREATED",
  EVENT_UPDATED = "EVENT_UPDATED",
  EVENT_STATUS_CHANGED = "EVENT_STATUS_CHANGED",
  ZONE_CREATED = "ZONE_CREATED",
  ZONE_UPDATED = "ZONE_UPDATED",
  ORDER_CANCELLED = "ORDER_CANCELLED",
  ORDER_REFUNDED = "ORDER_REFUNDED",
  TICKET_VOIDED = "TICKET_VOIDED",
  TICKET_EMAIL_RESENT = "TICKET_EMAIL_RESENT",
}

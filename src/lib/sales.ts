import { EventStatus } from "@/types/enums";

export interface SalesWindow {
  status: EventStatus | string;
  salesStartAt: Date | null;
  salesEndAt: Date | null;
}

export type SalesState =
  | "OPEN"
  | "NOT_PUBLISHED"
  | "BEFORE_START"
  | "AFTER_END"
  | "CLOSED";

export function salesState(event: SalesWindow, now: Date = new Date()): SalesState {
  if (event.status === EventStatus.SALES_CLOSED) return "CLOSED";
  if (event.status !== EventStatus.PUBLISHED) return "NOT_PUBLISHED";
  if (event.salesStartAt && now < event.salesStartAt) return "BEFORE_START";
  if (event.salesEndAt && now > event.salesEndAt) return "AFTER_END";
  return "OPEN";
}

export function isSalesOpen(event: SalesWindow, now: Date = new Date()): boolean {
  return salesState(event, now) === "OPEN";
}

/**
 * Helpers for HTML datetime-local inputs. For simplicity in the admin tool,
 * times are handled in UTC (the input value is the UTC wall-clock time). Label
 * such fields "(UTC)" in the UI.
 */

/** Date -> "YYYY-MM-DDTHH:mm" for a datetime-local input value. */
export function toDateTimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toISOString().slice(0, 16);
}

/** datetime-local string -> Date (UTC), or null if empty/invalid. */
export function fromDateTimeLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Append :00Z so the value is parsed as UTC rather than local time.
  const iso = value.length === 16 ? `${value}:00Z` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

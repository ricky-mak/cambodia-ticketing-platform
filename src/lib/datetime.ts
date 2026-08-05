/**
 * Date/time helpers. This is a Cambodia platform, so all human-facing times are
 * **Indochina Time (ICT, UTC+7)** — a fixed offset with no daylight saving.
 * Instants are still stored as UTC in the database (timezone-agnostic); only
 * input interpretation and display use ICT.
 */

export const APP_TZ = "Asia/Phnom_Penh";
export const APP_TZ_LABEL = "ICT";

const ICT_OFFSET_MS = 7 * 60 * 60 * 1000;

/** Date (UTC instant) -> "YYYY-MM-DDTHH:mm" ICT wall-clock for a datetime-local input. */
export function toDateTimeLocal(date: Date | null | undefined): string {
  if (!date) return "";
  // Shift the instant into ICT so the input shows Phnom Penh local time.
  return new Date(date.getTime() + ICT_OFFSET_MS).toISOString().slice(0, 16);
}

/** datetime-local string (interpreted as ICT) -> Date (UTC instant), or null. */
export function fromDateTimeLocal(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Append the +07:00 offset so the wall-clock value is read as Phnom Penh time.
  const iso = value.length === 16 ? `${value}:00+07:00` : value;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Format an instant in ICT, e.g. "Sat, Aug 30, 2026, 8:54 PM ICT". */
export function formatIct(
  date: Date | null | undefined,
  opts: Intl.DateTimeFormatOptions = { dateStyle: "full", timeStyle: "short" },
): string | null {
  if (!date) return null;
  return (
    new Intl.DateTimeFormat("en-US", { ...opts, timeZone: APP_TZ }).format(
      date,
    ) + ` ${APP_TZ_LABEL}`
  );
}

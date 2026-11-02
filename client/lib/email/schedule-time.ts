/*
 * Picking a send time for a scheduled email, in the user's own time zone. Dates are "YYYY-MM-DD" (as DatePicker uses)
 * and times "HH:MM"; the server gets an ISO 8601 instant.
 */

const pad = (n: number) => String(n).padStart(2, "0");

/** A local date as "YYYY-MM-DD". */
export const localDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** Tomorrow, the default day to schedule for. */
export function tomorrow(now = new Date()) {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  return localDate(next);
}

/** A local date and time as an ISO instant, or null when invalid. */
export function toSendAt(date: string, time: string): string | null {
  const parsed = new Date(`${date}T${time}:00`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** "Tue 3 Nov, 9:00 AM" in the user's locale and time zone. */
export function formatSendAt(iso: string) {
  return new Intl.DateTimeFormat(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    .format(new Date(iso));
}

/** The user's time zone name for labels, e.g. "Asia/Kolkata". */
export const timeZoneName = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

/** At least a minute from now, as the server requires. Call from event handlers, not while rendering. */
export const isFarEnoughAhead = (iso: string | null): iso is string => !!iso && Date.parse(iso) - Date.now() >= 60_000;

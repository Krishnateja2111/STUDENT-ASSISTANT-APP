/**
 * The UI's concept of "today" — used only by Dashboard/Calendar/due-label
 * for display and day-filtering. Independent of the scheduling engine: the
 * engine derives its own referenceTimeMs from the availability data passed
 * to it (see generateSchedule.ts), never from this file, so nothing here
 * touches engine behavior or its deterministic tests.
 *
 * Was previously a hardcoded 2026-08-21 anchor matching the seed data's
 * "today" — that drifted stale the moment real time passed it. Now derived
 * from the real device clock on every call.
 */

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The real current moment. */
export function getNow(): Date {
  return new Date();
}

/** Today's date as a bare YYYY-MM-DD, derived from the real device clock. */
export function getToday(): string {
  return dayKeyOf(getNow());
}

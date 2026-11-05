function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/**
 * Every "YYYY-MM-DD" from startDate to endDate (both inclusive) whose
 * weekday (0 Sun – 6 Sat, matching Date.getDay()) is in `weekdays`. Returns
 * an empty array for an invalid or inverted range rather than throwing —
 * callers treat "no dates" as a normal, handleable outcome.
 */
export function enumerateRecurringDates(startDate: string, endDate: string, weekdays: number[]): string[] {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate);
  if (!start || !end || start > end || weekdays.length === 0) return [];

  const weekdaySet = new Set(weekdays);
  const dates: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (weekdaySet.has(d.getDay())) dates.push(toDateKey(d));
  }
  return dates;
}

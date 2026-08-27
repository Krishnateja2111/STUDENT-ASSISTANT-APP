/**
 * Fixed "today" the whole UI treats as the current moment — matches the seed
 * data's anchor date (2026-08-21, see state/seed-data.ts) rather than the
 * real device clock, so relative labels ("Due tomorrow", countdowns, the
 * Calendar's default day) line up with what's actually on the schedule.
 */
export const REFERENCE_TODAY = '2026-08-21';
export const REFERENCE_NOW = new Date('2026-08-21T13:41:00');

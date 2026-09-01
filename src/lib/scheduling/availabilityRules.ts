/**
 * Phase 3F-A — pure availability domain types. No React, no state, no
 * persistence, no UI, no orchestration — just data shapes, exactly like
 * AvailabilityBlock itself (src/lib/scheduling/types.ts, untouched).
 *
 * Category 4 (one-time extra availability) is deliberately NOT redefined
 * here — it's the existing AvailabilityBlock, used as-is.
 */

/** Category 1 — weekly recurring availability. */
export interface AvailabilityRule {
  id: string;
  weekday: number; // 0 (Sun) – 6 (Sat), matching Date.getDay()
  startTime: string; // "HH:mm", local time-of-day
  endTime: string; // "HH:mm"
  label?: string;
}

/** Category 2 — fixed commitments, recurring or one-time (discriminated union). */
export type FixedCommitment =
  | {
      id: string;
      kind: 'recurring';
      weekday: number; // 0 (Sun) – 6 (Sat)
      startTime: string; // "HH:mm"
      endTime: string; // "HH:mm"
      label?: string;
    }
  | {
      id: string;
      kind: 'one-time';
      date: string; // "YYYY-MM-DD"
      startTime: string; // "HH:mm"
      endTime: string; // "HH:mm"
      label?: string;
    };

/** Category 3 — temporary unavailable period. A concrete datetime range, may span multiple days. */
export interface TemporaryUnavailablePeriod {
  id: string;
  start: string; // full local ISO datetime, e.g. "2026-09-10T12:00:00"
  end: string; // full local ISO datetime
  label?: string;
}

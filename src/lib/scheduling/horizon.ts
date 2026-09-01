import type { Task } from './types';

const DAYS_PER_WEEK = 7;

export interface Horizon {
  /** Local ISO datetime — inclusive lower bound. */
  start: string;
  /** Local ISO datetime — EXCLUSIVE upper bound. An instance starting exactly at `end` is outside the horizon. */
  end: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Adds `days` using calendar-based stepping (Date's own setDate, which
 * natively and correctly handles month/year boundaries and leap years —
 * see expandAvailability.ts's identical convention), NOT raw millisecond
 * arithmetic. A day is not always exactly 24h of wall-clock time across a
 * DST transition; `date.getTime() + days * MS_PER_DAY` silently drifts by
 * an hour whenever the added interval crosses one. Local-time arithmetic
 * throughout this app already means DST isn't a solved problem in general
 * (see the Phase 3F audit), but a horizon boundary landing exactly on the
 * requested wall-clock date is a correctness requirement this function can
 * and does guarantee cheaply, so it does.
 */
function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Phase 3F-B — determines how far forward the availability expansion window
 * (see expandAvailability.ts) should reach.
 *
 * horizonEnd = clamp(furthestActiveDeadline + 1 week, referenceDate + minWeeks, referenceDate + maxWeeks)
 *
 * - A brand-new user with no active deadlines still gets the `minWeeks`
 *   floor, so Dashboard/Calendar always have a reasonable planning window.
 * - A distant or erroneous deadline (a typo'd year, a far-future project)
 *   can never expand past the `maxWeeks` ceiling — bounding cost.
 * - `minWeeks`/`maxWeeks` are explicit parameters (not hardcoded) so this
 *   stays reusable and independently testable, per the Phase 3F-B brief.
 *
 * "Active" here means status !== 'completed' && status !== 'missed' — the
 * same convention src/lib/scheduling/availabilityImpact.ts (Phase 3D,
 * unprotected) already established: a missed task's recovery is that
 * phase's own dedicated flow, not a scheduling-horizon concern. Completed
 * tasks are obviously irrelevant to future planning.
 *
 * Deliberately takes `referenceDate` as a parameter rather than calling
 * Date.now() internally — the whole point is a pure, deterministic function
 * a test can call with a fixed date and get a fixed, repeatable answer.
 * Task.dueDate remains required (see types.ts, unmodified) — there is no
 * "task without a deadline" concept in this codebase to account for.
 */
export function computeHorizon(
  activeTasks: Task[],
  minWeeks: number,
  maxWeeks: number,
  referenceDate: Date
): Horizon {
  const minEnd = addDays(referenceDate, minWeeks * DAYS_PER_WEEK);
  const maxEnd = addDays(referenceDate, maxWeeks * DAYS_PER_WEEK);

  let furthestDeadlineMs = -Infinity;
  for (const task of activeTasks) {
    if (task.status === 'completed' || task.status === 'missed') continue;
    const dueMs = new Date(task.dueDate).getTime();
    if (Number.isNaN(dueMs)) continue;
    if (dueMs > furthestDeadlineMs) furthestDeadlineMs = dueMs;
  }

  const end =
    furthestDeadlineMs === -Infinity
      ? minEnd
      : new Date(
          Math.min(
            Math.max(addDays(new Date(furthestDeadlineMs), DAYS_PER_WEEK).getTime(), minEnd.getTime()),
            maxEnd.getTime()
          )
        );

  return { start: isoFromDate(referenceDate), end: isoFromDate(end) };
}

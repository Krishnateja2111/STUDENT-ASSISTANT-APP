import type { AvailabilityRule, FixedCommitment, TemporaryUnavailablePeriod } from './availabilityRules';
import type { AvailabilityBlock } from './types';

/**
 * Phase 3F-C — pure, deterministic expansion of the four availability
 * source categories into a plain, concrete AvailabilityBlock[] the existing
 * (protected, untouched) scheduling engine already knows how to consume.
 *
 *   effectiveAvailability =
 *     subtract(
 *       union(expand(rules), oneTimeBlocks),
 *       union(expand(commitments), unavailablePeriods)
 *     )
 *
 * Availability sources are combined first; unavailable sources are
 * subtracted afterward — UNAVAILABLE ALWAYS WINS, unconditionally.
 *
 * No React, no state, no persistence, no storage, no side effects. Nothing
 * here is ever persisted (see the Phase 3F audit) — this is derived data,
 * recomputed on demand.
 */

// A day-by-day rule/commitment expansion loop is naturally bounded by the
// horizon in real usage (max 12 weeks, per horizon.ts), but this function
// is independently callable with any horizon — this cap is a defensive
// safeguard against a pathological/malformed horizon in a test or future
// caller, not a functional requirement.
const MAX_EXPANSION_DAYS = 400;

interface MsSegment {
  start: number;
  end: number;
  label?: string;
  /**
   * Set only while this segment still represents exactly one original,
   * unmodified source object (a generated rule instance, or a pass-through
   * one-time AvailabilityBlock). Cleared the moment a merge or subtraction
   * actually changes its bounds — see mergeOverlapping/subtractSegments.
   * This is what lets untouched one-time blocks keep their original ID
   * ("do not change their IDs") while genuinely new fragments get a fresh,
   * deterministic one.
   */
  sourceId?: string;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function dayKeyOf(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

/** "HH:mm", strictly two-digit hour 00-23 and minute 00-59. */
function parseTime(value: string): { hours: number; minutes: number } | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return { hours, minutes };
}

/** Valid, same-day, non-zero-length. Rejects overnight (end <= start) and zero-length ranges alike — MVP explicitly does not support overnight availability (see Phase 3F brief §3): 22:00–02:00 must be represented as two same-day rules instead, not auto-split across midnight. */
function parseValidTimeRange(startTime: string, endTime: string): { startMinutes: number; endMinutes: number } | null {
  const start = parseTime(startTime);
  const end = parseTime(endTime);
  if (!start || !end) return null;
  const startMinutes = start.hours * 60 + start.minutes;
  const endMinutes = end.hours * 60 + end.minutes;
  if (endMinutes <= startMinutes) return null;
  return { startMinutes, endMinutes };
}

function isValidWeekday(weekday: number): boolean {
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6;
}

function isValidDateString(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const [y, m, d] = date.split('-').map(Number);
  const parsed = new Date(y, m - 1, d);
  return parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d;
}

/**
 * Expands a single weekday+time-of-day window (an AvailabilityRule, or a
 * recurring FixedCommitment — both share this exact shape) into concrete
 * instances across [horizonStartMs, horizonEndMs). Invalid weekday/time
 * input is safely ignored (empty result), never thrown — a malformed
 * source entry must never take down the whole expansion.
 */
function expandWeekly(
  weekday: number,
  startTime: string,
  endTime: string,
  idPrefix: string,
  label: string | undefined,
  horizonStartMs: number,
  horizonEndMs: number
): MsSegment[] {
  if (!isValidWeekday(weekday)) return [];
  const range = parseValidTimeRange(startTime, endTime);
  if (!range) return [];
  if (horizonEndMs <= horizonStartMs) return [];

  const segments: MsSegment[] = [];
  const cursor = new Date(horizonStartMs);
  cursor.setHours(0, 0, 0, 0);

  for (let i = 0; i < MAX_EXPANSION_DAYS && cursor.getTime() < horizonEndMs; i++) {
    if (cursor.getDay() === weekday) {
      const y = cursor.getFullYear();
      const m = cursor.getMonth();
      const d = cursor.getDate();
      const segStart = new Date(y, m, d, 0, range.startMinutes, 0).getTime();
      const segEnd = new Date(y, m, d, 0, range.endMinutes, 0).getTime();
      if (segEnd > horizonStartMs && segStart < horizonEndMs) {
        segments.push({
          start: Math.max(segStart, horizonStartMs),
          end: Math.min(segEnd, horizonEndMs),
          label,
          sourceId: `${idPrefix}-${dayKeyOf(y, m + 1, d)}`,
        });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return segments;
}

/** A one-time FixedCommitment: exactly one concrete unavailable interval, only if it overlaps the horizon. */
function expandOneTimeCommitment(
  commitment: Extract<FixedCommitment, { kind: 'one-time' }>,
  horizonStartMs: number,
  horizonEndMs: number
): MsSegment | null {
  if (!isValidDateString(commitment.date)) return null;
  const range = parseValidTimeRange(commitment.startTime, commitment.endTime);
  if (!range) return null;

  const [y, m, d] = commitment.date.split('-').map(Number);
  const start = new Date(y, m - 1, d, 0, range.startMinutes, 0).getTime();
  const end = new Date(y, m - 1, d, 0, range.endMinutes, 0).getTime();
  if (end <= horizonStartMs || start >= horizonEndMs) return null;

  return { start: Math.max(start, horizonStartMs), end: Math.min(end, horizonEndMs) };
}

/** A concrete already-ISO datetime range (a TemporaryUnavailablePeriod, or the raw start/end of a one-time AvailabilityBlock), clipped to the horizon if it overlaps at all. */
function clipConcreteRange(
  startIso: string,
  endIso: string,
  horizonStartMs: number,
  horizonEndMs: number
): { start: number; end: number } | null {
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
  if (end <= horizonStartMs || start >= horizonEndMs) return null;
  return { start: Math.max(start, horizonStartMs), end: Math.min(end, horizonEndMs) };
}

/**
 * Merges overlapping segments (sorted, then combined) so overlapping
 * availability never produces duplicate/overlapping output blocks —
 * e.g. two rules covering 09:00–13:00 and 12:00–17:00 on the same day
 * become one 09:00–17:00 segment. Segments that merely TOUCH (one ends
 * exactly where the next starts) are deliberately NOT merged — that's a
 * real, if minor, distinction the Phase 3F brief calls out explicitly.
 *
 * Label/identity strategy: first-wins. A segment keeps its label/sourceId
 * as long as nothing actually extends its bounds; the moment a later
 * segment forces it to grow, both are cleared (see the MsSegment doc
 * comment) since the merged range no longer represents a single original
 * source object.
 */
function mergeOverlapping(segments: MsSegment[]): MsSegment[] {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: MsSegment[] = [{ ...sorted[0] }];

  for (let i = 1; i < sorted.length; i++) {
    const seg = sorted[i];
    const last = merged[merged.length - 1];
    if (seg.start < last.end) {
      if (seg.end > last.end) {
        last.end = seg.end;
        last.sourceId = undefined;
      }
      // else: seg fully contained within last — last is genuinely
      // unchanged, keep its label/sourceId as-is.
    } else {
      merged.push({ ...seg });
    }
  }

  return merged;
}

/**
 * Removes every `unavailable` range from `available`, using the same
 * segment-splitting technique already proven in replanTasks.ts's private
 * subtractBlocks — deliberately duplicated here (not imported) rather than
 * shared, per the Phase 3F brief's explicit instruction to avoid any
 * regression risk to already-shipped Phase 3C scheduling code. Applying
 * unavailable ranges one at a time, each against the current result,
 * correctly handles overlapping unavailable ranges too (they behave like
 * their union) without needing a separate pre-merge step.
 */
function subtractSegments(available: MsSegment[], unavailable: MsSegment[]): MsSegment[] {
  let result = available.map((s) => ({ ...s }));

  for (const block of unavailable) {
    const next: MsSegment[] = [];
    for (const seg of result) {
      if (block.end <= seg.start || block.start >= seg.end) {
        next.push(seg);
        continue;
      }
      if (seg.start < block.start) {
        next.push({ start: seg.start, end: block.start, label: seg.label });
      }
      if (block.end < seg.end) {
        next.push({ start: block.end, end: seg.end, label: seg.label });
      }
    }
    result = next;
  }

  return result;
}

/**
 * Expands all four availability source categories into a plain, concrete
 * AvailabilityBlock[] over [horizonStart, horizonEnd) — `horizonEnd` is an
 * EXCLUSIVE upper bound (matches horizon.ts's own documented convention):
 * an instance starting exactly at `horizonEnd` is outside the window.
 *
 * Pure, deterministic, synchronous. Given identical inputs (including the
 * same horizon), produces byte-identical output, in the same order, every
 * time — no Date.now() anywhere in this file.
 */
export function expandAvailability(
  rules: AvailabilityRule[],
  oneTimeBlocks: AvailabilityBlock[],
  commitments: FixedCommitment[],
  unavailablePeriods: TemporaryUnavailablePeriod[],
  horizonStart: string,
  horizonEnd: string
): AvailabilityBlock[] {
  const horizonStartMs = new Date(horizonStart).getTime();
  const horizonEndMs = new Date(horizonEnd).getTime();
  if (Number.isNaN(horizonStartMs) || Number.isNaN(horizonEndMs) || horizonEndMs <= horizonStartMs) {
    return [];
  }

  const availableRaw: MsSegment[] = [];
  for (const rule of rules) {
    availableRaw.push(
      ...expandWeekly(rule.weekday, rule.startTime, rule.endTime, `rule-${rule.id}`, rule.label, horizonStartMs, horizonEndMs)
    );
  }
  for (const block of oneTimeBlocks) {
    const clipped = clipConcreteRange(block.start, block.end, horizonStartMs, horizonEndMs);
    if (clipped) {
      availableRaw.push({ ...clipped, label: block.label, sourceId: block.id });
    }
  }
  const mergedAvailable = mergeOverlapping(availableRaw);

  const unavailableRaw: MsSegment[] = [];
  for (const commitment of commitments) {
    if (commitment.kind === 'recurring') {
      unavailableRaw.push(
        ...expandWeekly(
          commitment.weekday,
          commitment.startTime,
          commitment.endTime,
          `commitment-${commitment.id}`,
          undefined,
          horizonStartMs,
          horizonEndMs
        )
      );
    } else {
      const seg = expandOneTimeCommitment(commitment, horizonStartMs, horizonEndMs);
      if (seg) unavailableRaw.push(seg);
    }
  }
  for (const period of unavailablePeriods) {
    const clipped = clipConcreteRange(period.start, period.end, horizonStartMs, horizonEndMs);
    if (clipped) unavailableRaw.push(clipped);
  }

  const effective = subtractSegments(mergedAvailable, unavailableRaw);

  return effective
    .filter((s) => s.end > s.start)
    .sort((a, b) => a.start - b.start || a.end - b.end)
    .map((s) => {
      const block: AvailabilityBlock = {
        id: s.sourceId ?? `effective-${isoFromMs(s.start)}-${isoFromMs(s.end)}`,
        start: isoFromMs(s.start),
        end: isoFromMs(s.end),
      };
      if (s.label) block.label = s.label;
      return block;
    });
}

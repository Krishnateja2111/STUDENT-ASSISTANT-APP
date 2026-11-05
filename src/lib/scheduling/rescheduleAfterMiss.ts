import { priorityScore } from './priority';
import { scheduleTasksByPriority } from './generateSchedule';
import { allocateFromSegments, type TimeSegment } from './timeSlots';
import { ReasonCode } from './types';
import type { AvailabilityBlock, RescheduleResult, ScheduledBlock, Task } from './types';

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Inverse of subtracting a block from segments — merges `blocks`' time back into `segments`, coalescing any now-adjacent/overlapping segments. Used only to give a bumped candidate's time back to the free-time pool. */
function addBackBlocks(segments: TimeSegment[], blocks: ScheduledBlock[]): TimeSegment[] {
  const additions = blocks.map((b) => ({ start: new Date(b.start).getTime(), end: new Date(b.end).getTime() }));
  const merged = [...segments, ...additions].sort((a, b) => a.start - b.start);
  const result: TimeSegment[] = [];
  for (const seg of merged) {
    const last = result[result.length - 1];
    if (last && seg.start <= last.end) {
      last.end = Math.max(last.end, seg.end);
    } else {
      result.push({ ...seg });
    }
  }
  return result;
}

/** Tries `segments` respecting the deadline first, then falls back to no deadline at all. Shared by the missed task's own placement and the bump search below. */
function tryPlace(segments: TimeSegment[], durationMs: number, earliestStart: number, deadlineMs: number) {
  return (
    allocateFromSegments(segments, durationMs, earliestStart, deadlineMs) ??
    allocateFromSegments(segments, durationMs, earliestStart, Infinity)
  );
}

/**
 * Critical constraint (see brief): a missed task must not disrupt
 * higher-priority tasks elsewhere in the schedule. Guaranteed structurally,
 * not incidentally — every other task's placement is taken verbatim from a
 * fresh full-priority schedule and held fixed; only the missed task (and, as
 * of the addition below, a strictly lower-priority task or two it may bump)
 * is ever re-placed.
 *
 * Placement prefers to respect the missed task's own deadline. If that's
 * genuinely impossible (the deadline has already passed relative to the
 * available slack, or there simply isn't enough slack before it), it falls
 * back to the earliest slot available at all, on the reasoning that a missed
 * task needs remediation rather than permanent abandonment. Only if no slot
 * exists anywhere does it go to overflow.
 *
 * Bug fix (reproduced live): a "reschedule" must search for a genuinely
 * DIFFERENT time, never the missed task's own original slot back again —
 * that's not a reschedule, it's a no-op wearing one. previous.remainingSegments
 * already excludes every block from the fresh full-priority run above,
 * INCLUDING the missed task's own — using it directly means the old slot is
 * correctly off the table as a candidate for its own replacement.
 *
 * Feature addition (approved after a live walkthrough of exactly this
 * tradeoff): previously, if every open slot before the missed task's
 * deadline happened to be occupied by lower-priority work, the missed task
 * simply overflowed — even a genuinely urgent exam-prep task could go
 * unscheduled while an "other"-type task sat in the only room available,
 * because nothing was ever allowed to move except the missed task itself.
 * Now, only once placing the missed task into genuinely free time has
 * already failed, the engine looks at currently-scheduled tasks with a
 * STRICTLY LOWER priority score (same priorityScore the rest of the engine
 * uses) and frees them up one at a time, weakest first, retrying the missed
 * task's placement after each. Same-or-higher-priority tasks are never
 * considered — that part of the guarantee is unchanged. If freeing every
 * lower-priority candidate still isn't enough, nothing is disturbed and the
 * missed task overflows exactly as before (proven by the existing "truly no
 * slot anywhere" test, where the only occupying task outranks the missed
 * one, so there are no candidates and this new branch never runs).
 *
 * Every task actually bumped this way gets its own placement attempt
 * afterward (strongest-bumped first), respecting its own deadline — no
 * "ignore the deadline" fallback, since unlike the missed task it hasn't
 * missed anything, so an honest overflow is the fairer outcome if it no
 * longer fits. Each surfaces as its own ReasonCode.DEADLINE_PROXIMITY change
 * (icon/label/message already exist in reschedule.tsx and explainChanges.ts,
 * defined but never previously emitted by anything).
 */
export function rescheduleAfterMiss(
  missedTask: Task,
  currentTasks: Task[],
  availability: AvailabilityBlock[]
): RescheduleResult {
  const previous = scheduleTasksByPriority(currentTasks, availability);
  const previousBlockForMissed = previous.scheduled.find((b) => b.taskId === missedTask.id);
  const otherBlocks = previous.scheduled.filter((b) => b.taskId !== missedTask.id);

  const durationMs = missedTask.estimatedMinutes * 60_000;
  const deadlineMs = new Date(missedTask.dueDate).getTime();
  const referenceTimeMs = previous.referenceTimeMs;

  let freeSegments = previous.remainingSegments;
  let allocation = tryPlace(freeSegments, durationMs, referenceTimeMs, deadlineMs);

  let survivingOtherBlocks = otherBlocks;
  const bumpedTaskIds: string[] = [];

  if (!allocation) {
    const missedScore = priorityScore(missedTask, referenceTimeMs);
    const taskById = new Map(currentTasks.map((t) => [t.id, t]));
    const candidateIds = new Set(otherBlocks.map((b) => b.taskId));
    const candidates = [...candidateIds]
      .map((id) => taskById.get(id))
      .filter((t): t is Task => t !== undefined && priorityScore(t, referenceTimeMs) < missedScore)
      .sort((a, b) => priorityScore(a, referenceTimeMs) - priorityScore(b, referenceTimeMs));

    for (const candidate of candidates) {
      const candidateBlocks = survivingOtherBlocks.filter((b) => b.taskId === candidate.id);
      freeSegments = addBackBlocks(freeSegments, candidateBlocks);
      survivingOtherBlocks = survivingOtherBlocks.filter((b) => b.taskId !== candidate.id);
      bumpedTaskIds.push(candidate.id);

      allocation = tryPlace(freeSegments, durationMs, referenceTimeMs, deadlineMs);
      if (allocation) break;
    }

    if (!allocation) {
      // Freeing every eligible lower-priority task still wasn't enough —
      // nothing was actually gained, so don't disturb anyone.
      return {
        scheduledBlocks: otherBlocks,
        overflow: [missedTask],
        changes: [
          {
            taskId: missedTask.id,
            reasonCode: ReasonCode.OVERFLOW_DEFERRED,
            previousBlock: previousBlockForMissed,
          },
        ],
      };
    }
  }

  const newBlocks: ScheduledBlock[] = allocation.pieces.map((piece, i) => ({
    id: `sb-${missedTask.id}-reinserted-${i}`,
    taskId: missedTask.id,
    start: isoFromMs(piece.start),
    end: isoFromMs(piece.end),
  }));

  const overflow: Task[] = [];
  const bumpedChanges: RescheduleResult['changes'] = [];
  let remainingFree = allocation.remainingSegments;

  const taskById = new Map(currentTasks.map((t) => [t.id, t]));
  const bumpedTasksStrongestFirst = bumpedTaskIds
    .map((id) => taskById.get(id))
    .filter((t): t is Task => t !== undefined)
    .sort((a, b) => priorityScore(b, referenceTimeMs) - priorityScore(a, referenceTimeMs));

  for (const bumped of bumpedTasksStrongestFirst) {
    const bumpedPreviousBlock = otherBlocks.find((b) => b.taskId === bumped.id);
    const bumpedDurationMs = bumped.estimatedMinutes * 60_000;
    const bumpedDeadlineMs = new Date(bumped.dueDate).getTime();

    const bumpedAllocation = allocateFromSegments(remainingFree, bumpedDurationMs, referenceTimeMs, bumpedDeadlineMs);
    if (!bumpedAllocation) {
      overflow.push(bumped);
      bumpedChanges.push({
        taskId: bumped.id,
        reasonCode: ReasonCode.DEADLINE_PROXIMITY,
        previousBlock: bumpedPreviousBlock,
      });
      continue;
    }

    remainingFree = bumpedAllocation.remainingSegments;
    const bumpedNewBlocks: ScheduledBlock[] = bumpedAllocation.pieces.map((piece, i) => ({
      id: `sb-${bumped.id}-bumped-${i}`,
      taskId: bumped.id,
      start: isoFromMs(piece.start),
      end: isoFromMs(piece.end),
    }));
    survivingOtherBlocks = [...survivingOtherBlocks, ...bumpedNewBlocks];
    bumpedChanges.push({
      taskId: bumped.id,
      reasonCode: ReasonCode.DEADLINE_PROXIMITY,
      previousBlock: bumpedPreviousBlock,
      newBlock: bumpedNewBlocks[0],
    });
  }

  return {
    scheduledBlocks: [...survivingOtherBlocks, ...newBlocks],
    overflow,
    changes: [
      {
        taskId: missedTask.id,
        reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
        previousBlock: previousBlockForMissed,
        newBlock: newBlocks[0],
      },
      ...bumpedChanges,
    ],
  };
}

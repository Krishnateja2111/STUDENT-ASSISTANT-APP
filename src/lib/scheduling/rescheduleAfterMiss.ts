import { scheduleTasksByPriority } from './generateSchedule';
import { allocateFromSegments } from './timeSlots';
import { ReasonCode } from './types';
import type { AvailabilityBlock, RescheduleResult, ScheduledBlock, Task } from './types';

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Critical constraint (see brief): a missed task must not disrupt
 * higher-priority tasks elsewhere in the schedule. Guaranteed structurally,
 * not incidentally — every other task's placement is taken verbatim from a
 * fresh full-priority schedule and held fixed; only the missed task is ever
 * re-placed, into whatever time that leaves over. This function never moves
 * any task other than the one passed in as `missedTask`.
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
 * that's not a reschedule, it's a no-op wearing one. The free-time search
 * space used to be reconstructed from full availability minus only the
 * OTHER tasks' blocks specifically so the missed task's own old slot came
 * back into play as a candidate — meaning any task marked missed before its
 * scheduled time actually arrived (nothing stops that; there's no time gate
 * on the "Missed" action) would find its own still-untouched, still-free
 * old slot as the earliest opening and simply get handed it right back,
 * unchanged. previous.remainingSegments already excludes every block from
 * the fresh full-priority run above, INCLUDING the missed task's own —
 * using it directly means the old slot is correctly off the table as a
 * candidate for its own replacement, regardless of whether marking it
 * missed happened before or after that time actually passed.
 */
export function rescheduleAfterMiss(
  missedTask: Task,
  currentTasks: Task[],
  availability: AvailabilityBlock[]
): RescheduleResult {
  const previous = scheduleTasksByPriority(currentTasks, availability);
  const previousBlockForMissed = previous.scheduled.find((b) => b.taskId === missedTask.id);
  const otherBlocks = previous.scheduled.filter((b) => b.taskId !== missedTask.id);

  const freeSegments = previous.remainingSegments;

  const durationMs = missedTask.estimatedMinutes * 60_000;
  const deadlineMs = new Date(missedTask.dueDate).getTime();
  const referenceTimeMs = previous.referenceTimeMs;

  let allocation = allocateFromSegments(freeSegments, durationMs, referenceTimeMs, deadlineMs);
  if (!allocation) {
    // Deadline can't be honored — try again without it, since a missed task
    // still needs a slot rather than being silently abandoned.
    allocation = allocateFromSegments(freeSegments, durationMs, referenceTimeMs, Infinity);
  }

  if (!allocation) {
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

  const newBlocks: ScheduledBlock[] = allocation.pieces.map((piece, i) => ({
    id: `sb-${missedTask.id}-reinserted-${i}`,
    taskId: missedTask.id,
    start: isoFromMs(piece.start),
    end: isoFromMs(piece.end),
  }));

  return {
    scheduledBlocks: [...otherBlocks, ...newBlocks],
    overflow: [],
    changes: [
      {
        taskId: missedTask.id,
        reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
        previousBlock: previousBlockForMissed,
        newBlock: newBlocks[0],
      },
    ],
  };
}

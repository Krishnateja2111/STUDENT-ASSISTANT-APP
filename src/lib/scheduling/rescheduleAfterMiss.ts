import { scheduleTasksByPriority } from './generateSchedule';
import { allocateFromSegments, toSegments, type TimeSegment } from './timeSlots';
import { ReasonCode } from './types';
import type { AvailabilityBlock, RescheduleResult, ScheduledBlock, Task } from './types';

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Removes `blocks` worth of time from `segments`, producing the free time
 * left over. Used to derive "whatever's left after everyone else's fixed
 * placements" for the missed task to search within.
 */
function subtractBlocks(segments: TimeSegment[], blocks: ScheduledBlock[]): TimeSegment[] {
  let result = segments;
  for (const block of blocks) {
    const blockStart = new Date(block.start).getTime();
    const blockEnd = new Date(block.end).getTime();
    const next: TimeSegment[] = [];
    for (const seg of result) {
      if (blockEnd <= seg.start || blockStart >= seg.end) {
        next.push(seg);
        continue;
      }
      if (seg.start < blockStart) next.push({ start: seg.start, end: blockStart });
      if (blockEnd < seg.end) next.push({ start: blockEnd, end: seg.end });
    }
    result = next;
  }
  return result.sort((a, b) => a.start - b.start);
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
 */
export function rescheduleAfterMiss(
  missedTask: Task,
  currentTasks: Task[],
  availability: AvailabilityBlock[]
): RescheduleResult {
  const previous = scheduleTasksByPriority(currentTasks, availability);
  const previousBlockForMissed = previous.scheduled.find((b) => b.taskId === missedTask.id);
  const otherBlocks = previous.scheduled.filter((b) => b.taskId !== missedTask.id);

  const freeSegments = subtractBlocks(
    // Start from full availability (not previous.remainingSegments) so that
    // the missed task's own old slot is also back in play as free time.
    toSegments(availability),
    otherBlocks
  );

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

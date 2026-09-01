import { toSegments } from './timeSlots';
import type { AvailabilityBlock, ScheduledBlock, Task } from './types';

export interface AvailabilityImpact {
  /** Tasks with an existing block that's no longer fully covered by the new availability — every piece is checked, not just the first. */
  affected: Task[];
  /** Tasks with no current block at all — candidates that might now fit. */
  unscheduled: Task[];
}

/**
 * Phase 3D — pure classification of what an availability change means for
 * the current schedule. Makes no scheduling decision itself (that's
 * replanTasks's job) — just answers "which tasks does this change actually
 * touch," so the caller knows exactly what to hand to replanTasks and
 * everything else can stay structurally protected.
 *
 * A ScheduledBlock is valid under `newAvailability` if it's fully contained
 * within a single availability segment (segments are never merged across a
 * gap, and allocateFromSegments never carves a piece spanning two segments,
 * so checking "fully within some one segment" is exactly the right test —
 * not "does new availability's total duration still add up").
 *
 * A task can have multiple pieces (see allocateFromSegments) — it's only
 * still valid if EVERY piece remains valid; if any one piece falls outside
 * availability, the whole task is affected, mirroring the same full-piece-
 * set discipline diffSchedule.ts already uses.
 *
 * Completed and missed tasks are excluded deliberately: a completed task's
 * freed time is never reconsidered (no auto-repack — see Phase 3C), and a
 * missed task's recovery is Phase 3A/3C's dedicated flow, not this one.
 */
export function findAvailabilityImpact(
  tasks: Task[],
  scheduledBlocks: ScheduledBlock[],
  newAvailability: AvailabilityBlock[]
): AvailabilityImpact {
  const newSegments = toSegments(newAvailability);

  const isPieceValid = (block: ScheduledBlock): boolean => {
    const blockStart = new Date(block.start).getTime();
    const blockEnd = new Date(block.end).getTime();
    return newSegments.some((seg) => seg.start <= blockStart && blockEnd <= seg.end);
  };

  const blocksByTask = new Map<string, ScheduledBlock[]>();
  for (const block of scheduledBlocks) {
    const list = blocksByTask.get(block.taskId);
    if (list) list.push(block);
    else blocksByTask.set(block.taskId, [block]);
  }

  const affected: Task[] = [];
  const unscheduled: Task[] = [];

  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'missed') continue;

    const blocks = blocksByTask.get(task.id);
    if (!blocks || blocks.length === 0) {
      unscheduled.push(task);
    } else if (!blocks.every(isPieceValid)) {
      affected.push(task);
    }
  }

  return { affected, unscheduled };
}

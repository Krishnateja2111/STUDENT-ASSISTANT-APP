import { priorityScore } from './priority';
import { allocateFromSegments, toSegments, type TimeSegment } from './timeSlots';
import type { AvailabilityBlock, GenerateScheduleResult, ScheduledBlock, Task } from './types';

/** Formats a ms epoch as a local-time datetime string (no trailing Z), matching
 *  the convention used throughout this app — see calendar.tsx's formatDay for
 *  why bare-date strings are UTC-parsed but full datetime strings are not. */
function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface PriorityScheduleResult {
  scheduled: ScheduledBlock[];
  overflow: Task[];
  /** Segments left unused after scheduling — reused by rescheduleAfterMiss and getScheduleHealth. */
  remainingSegments: TimeSegment[];
  referenceTimeMs: number;
}

/**
 * Core greedy scheduler shared by generateSchedule and rescheduleAfterMiss.
 * Processes tasks in priority order (deadline proximity weighted most
 * heavily, task-type weight as a tiebreaker — see priority.ts), respecting
 * dependsOn as a hard ordering constraint: a task only becomes eligible once
 * every dependency in this same task list has itself been scheduled. A task
 * is either fully placed (one or more blocks summing to its full
 * estimatedMinutes, all ending by its deadline) or entirely deferred to
 * overflow — never partially scheduled.
 */
export function scheduleTasksByPriority(tasks: Task[], availability: AvailabilityBlock[]): PriorityScheduleResult {
  const segments = toSegments(availability);
  const referenceTimeMs = segments.length > 0 ? segments[0].start : Date.now();

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const remaining = new Set(tasks.map((t) => t.id));
  const scheduledEndByTaskId = new Map<string, number>();
  const failedIds = new Set<string>();
  const scheduled: ScheduledBlock[] = [];
  const overflow: Task[] = [];
  let workingSegments = segments;
  let blockCounter = 0;

  while (remaining.size > 0) {
    // Cascade: a task whose dependency already failed can never be scheduled.
    let cascaded = false;
    for (const id of [...remaining]) {
      const t = taskById.get(id)!;
      if ((t.dependsOn ?? []).some((dep) => failedIds.has(dep))) {
        failedIds.add(id);
        overflow.push(t);
        remaining.delete(id);
        cascaded = true;
      }
    }
    if (remaining.size === 0) break;
    if (cascaded) continue;

    const eligible = [...remaining]
      .map((id) => taskById.get(id)!)
      .filter((t) => (t.dependsOn ?? []).every((dep) => scheduledEndByTaskId.has(dep) || !taskById.has(dep)));

    if (eligible.length === 0) {
      // Circular dependency among the remaining tasks — no valid order exists.
      for (const id of remaining) {
        overflow.push(taskById.get(id)!);
        failedIds.add(id);
      }
      break;
    }

    eligible.sort((a, b) => priorityScore(b, referenceTimeMs) - priorityScore(a, referenceTimeMs));
    const task = eligible[0];
    remaining.delete(task.id);

    const earliestStart = Math.max(
      referenceTimeMs,
      ...(task.dependsOn ?? []).map((dep) => scheduledEndByTaskId.get(dep) ?? -Infinity)
    );
    const deadlineMs = new Date(task.dueDate).getTime();
    const durationMs = task.estimatedMinutes * 60_000;

    const allocation = allocateFromSegments(workingSegments, durationMs, earliestStart, deadlineMs);
    if (allocation) {
      for (const piece of allocation.pieces) {
        scheduled.push({
          id: `sb-${task.id}-${blockCounter++}`,
          taskId: task.id,
          start: isoFromMs(piece.start),
          end: isoFromMs(piece.end),
        });
      }
      workingSegments = allocation.remainingSegments;
      scheduledEndByTaskId.set(task.id, allocation.pieces[allocation.pieces.length - 1].end);
    } else {
      overflow.push(task);
      failedIds.add(task.id);
    }
  }

  return { scheduled, overflow, remainingSegments: workingSegments, referenceTimeMs };
}

export function generateSchedule(tasks: Task[], availability: AvailabilityBlock[]): GenerateScheduleResult {
  const { scheduled, overflow } = scheduleTasksByPriority(tasks, availability);
  return { scheduled, overflow };
}

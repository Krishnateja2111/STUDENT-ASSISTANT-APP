import { allocateFromSegments, toSegments, type TimeSegment } from './timeSlots';
import { priorityScore } from './priority';
import type { AvailabilityBlock, ScheduledBlock, Task } from './types';

/**
 * Phase 3C — general single-task re-planning primitive.
 *
 * Deliberately duplicated (not imported) from rescheduleAfterMiss.ts's
 * private subtractBlocks (~15 lines) rather than exporting it from that
 * protected file — see the Phase 3C brief's explicit instruction to prefer
 * a clean additive implementation over touching protected engine files.
 * Removes `blocks` worth of time from `segments`.
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

function isoFromMs(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export interface ReplanResult {
  /** The full proposed scheduledBlocks — every protected block, unchanged, plus any newly placed piece(s) for tasksToReplan. */
  scheduledBlocks: ScheduledBlock[];
  /** Whichever of tasksToReplan could not be placed at all. */
  overflow: Task[];
}

/**
 * Re-places ONLY `tasksToReplan`, holding every block belonging to any other
 * task exactly fixed ("protected"). Generalizes rescheduleAfterMiss's
 * single-task technique (subtract protected blocks from availability, then
 * allocate the remaining task(s) into what's left) to an arbitrary small
 * task set, without modifying that protected file. Uses the same
 * `allocateFromSegments`/`toSegments` primitives the rest of the engine
 * already relies on — no new scheduling heuristic is introduced.
 *
 * Structural guarantee: a task not present in `tasksToReplan` can never
 * appear with a different block in the result — its old block(s) are
 * carried through in `protectedBlocks` untouched. This is the Phase 3C
 * trust guarantee, enforced by construction rather than by convention.
 *
 * Note: does not consider `dependsOn` ordering — out of scope for Phase 3C
 * (no UI exposes dependency editing, and the trigger matrix this phase
 * implements never involves it). See the Phase 3C report for this
 * limitation.
 */
export function replanTasks(
  tasksToReplan: Task[],
  allTasks: Task[],
  availability: AvailabilityBlock[],
  currentScheduledBlocks: ScheduledBlock[]
): ReplanResult {
  const replanIds = new Set(tasksToReplan.map((t) => t.id));
  const protectedBlocks = currentScheduledBlocks.filter((b) => !replanIds.has(b.taskId));

  const allSegments = toSegments(availability);
  const referenceTimeMs = allSegments.length > 0 ? allSegments[0].start : Date.now();

  let freeSegments = subtractBlocks(allSegments, protectedBlocks);
  const overflow: Task[] = [];
  const newBlocks: ScheduledBlock[] = [];
  let blockCounter = 0;

  // Ordered by the same priority scoring the rest of the engine already
  // uses, so that if tasksToReplan ever contains more than one task (a
  // future-phase possibility — Phase 3C itself only ever calls this with
  // exactly one), they compete for the freed-up time the same way the rest
  // of the engine already does.
  const ordered = [...tasksToReplan].sort(
    (a, b) => priorityScore(b, referenceTimeMs) - priorityScore(a, referenceTimeMs)
  );

  for (const task of ordered) {
    const durationMs = task.estimatedMinutes * 60_000;
    const deadlineMs = new Date(task.dueDate).getTime();

    // Bug fix: this used to retry without the deadline when it couldn't be
    // honored, mirroring rescheduleAfterMiss's "give a missed task some
    // slot rather than none" reasoning. That reasoning doesn't transfer to
    // this function's actual callers (addTask/updateTask, via
    // planTaskChange in app-state.tsx) — a brand-new or just-edited task
    // has no "already missed, needs remediation" excuse; its deadline is
    // literally what the student just told the app matters. Reproduced
    // live: a task due Sept 3 was silently placed across Sept 7-9 with no
    // warning at all -- exactly the "app schedules past my deadline
    // without telling me" failure a scheduling app cannot have. A task
    // that genuinely can't fit before its deadline now overflows instead,
    // which planTaskChange already turns into a real, clear message
    // ("X couldn't be fit into your schedule...") via the existing review
    // flow -- that path already existed, it just could never trigger
    // while this silently succeeded instead. rescheduleAfterMiss.ts
    // itself (fully protected, missed-task recovery only) is unchanged.
    const allocation = allocateFromSegments(freeSegments, durationMs, referenceTimeMs, deadlineMs);

    if (!allocation) {
      overflow.push(task);
      continue;
    }

    for (const piece of allocation.pieces) {
      newBlocks.push({
        id: `sb-${task.id}-replan-${blockCounter++}`,
        taskId: task.id,
        start: isoFromMs(piece.start),
        end: isoFromMs(piece.end),
      });
    }
    freeSegments = allocation.remainingSegments;
  }

  return { scheduledBlocks: [...protectedBlocks, ...newBlocks], overflow };
}

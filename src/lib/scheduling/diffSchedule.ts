import type { ReasonCode, ScheduleChange, ScheduledBlock } from './types';

function blocksForTask(blocks: ScheduledBlock[], taskId: string): ScheduledBlock[] {
  return blocks.filter((b) => b.taskId === taskId).sort((a, b) => a.start.localeCompare(b.start));
}

function sameBlock(a: ScheduledBlock, b: ScheduledBlock): boolean {
  return a.start === b.start && a.end === b.end;
}

/** True only if every piece matches, in order — a task can have multiple pieces (see allocateFromSegments), so comparing just the first would miss a change to a later piece. */
function samePlacement(prev: ScheduledBlock[], next: ScheduledBlock[]): boolean {
  if (prev.length !== next.length) return false;
  return prev.every((block, i) => sameBlock(block, next[i]));
}

/**
 * Pure comparison between two ScheduledBlock sets, restricted to
 * `relevantTaskIds`. Classifies each relevant task's placement as unchanged
 * (omitted from the result — no ScheduleChange entry), newly scheduled,
 * moved, or now-unscheduled, using the existing ScheduledBlock/ScheduleChange
 * types as-is.
 *
 * This function only detects WHAT changed, not WHY — `reasonCode` is
 * supplied by the caller (the orchestration layer knows why it triggered a
 * replan: a task was added, a deadline changed, etc.) and is applied to
 * every entry this call produces. Restricting the comparison to
 * `relevantTaskIds` — rather than diffing every task in both arrays — is
 * what guarantees a protected task that didn't change can never produce a
 * spurious ScheduleChange: it's never even considered.
 *
 * Like rescheduleAfterMiss's own change-building, a ScheduleChange entry
 * carries only a single previousBlock/newBlock (that's the existing,
 * protected type's shape) — for a multi-piece task that changed, this
 * reports its first piece, matching that same existing precedent.
 */
export function diffSchedules(
  previousBlocks: ScheduledBlock[],
  proposedBlocks: ScheduledBlock[],
  relevantTaskIds: Iterable<string>,
  reasonCode: ReasonCode
): ScheduleChange[] {
  const changes: ScheduleChange[] = [];

  for (const taskId of relevantTaskIds) {
    const prev = blocksForTask(previousBlocks, taskId);
    const next = blocksForTask(proposedBlocks, taskId);

    if (samePlacement(prev, next)) continue;

    changes.push({
      taskId,
      reasonCode,
      previousBlock: prev[0],
      newBlock: next[0],
    });
  }

  return changes;
}

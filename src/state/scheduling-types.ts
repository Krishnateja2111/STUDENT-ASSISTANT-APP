import type { RescheduleResult } from '@/lib/scheduling';

/**
 * Phase 3E — orchestration-level wrapper around a pending schedule proposal.
 * Reuses RescheduleResult as-is (never duplicated) and adds only the
 * bookkeeping needed to know whether the proposal is still safe to accept.
 *
 * This is deliberately a state/orchestration-layer concept, not an engine
 * concept — it does NOT belong in src/lib/scheduling/types.ts. That module
 * is documented (see its own header comment) as imported BY the app and
 * never the reverse; a proposal wrapper is exactly the kind of app-side
 * bookkeeping that must stay out of it to preserve that one-way dependency.
 *
 * Never persisted — see app-state.tsx's persistence effect, which only ever
 * writes {courses, tasks, availability, scheduledBlocks}.
 */
export interface ScheduleProposal {
  result: RescheduleResult;
  /** The scheduling revision this proposal was computed against — the sole correctness check for whether it may still be accepted. */
  basisRevision: number;
  /** Diagnostics/future-UX only. Never part of the correctness check — see isProposalCurrent. */
  generatedAt: number;
}

/**
 * The one correctness check for whether a pending proposal may still be
 * applied: it must have been generated against exactly the current
 * scheduling revision. Deliberately simple (revision-level, not a
 * dependency graph of which specific task/availability IDs a proposal
 * "actually" depends on) — any committed scheduling-relevant mutation
 * advances the revision and makes every older proposal stale, full stop.
 */
export function isProposalCurrent(proposal: ScheduleProposal | null, currentRevision: number): boolean {
  return proposal !== null && proposal.basisRevision === currentRevision;
}

/** Wraps a freshly-computed RescheduleResult with the revision it was computed against. */
export function createScheduleProposal(result: RescheduleResult, revision: number): ScheduleProposal {
  return { result, basisRevision: revision, generatedAt: Date.now() };
}

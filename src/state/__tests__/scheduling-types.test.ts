import { createScheduleProposal, isProposalCurrent, type ScheduleProposal } from '../scheduling-types';
import type { RescheduleResult } from '@/lib/scheduling';

function result(overrides: Partial<RescheduleResult> = {}): RescheduleResult {
  return { scheduledBlocks: [], overflow: [], changes: [], ...overrides };
}

describe('createScheduleProposal', () => {
  test('wraps a RescheduleResult with the given revision and a generatedAt timestamp', () => {
    const r = result();
    const proposal = createScheduleProposal(r, 3);

    expect(proposal.result).toBe(r);
    expect(proposal.basisRevision).toBe(3);
    expect(typeof proposal.generatedAt).toBe('number');
  });
});

describe('isProposalCurrent', () => {
  test('a null proposal is never current', () => {
    expect(isProposalCurrent(null, 0)).toBe(false);
    expect(isProposalCurrent(null, 5)).toBe(false);
  });

  test('a proposal generated at the current revision is current', () => {
    const proposal: ScheduleProposal = createScheduleProposal(result(), 4);
    expect(isProposalCurrent(proposal, 4)).toBe(true);
  });

  test('a proposal generated at an OLDER revision than the current one is stale', () => {
    const proposal: ScheduleProposal = createScheduleProposal(result(), 4);
    expect(isProposalCurrent(proposal, 5)).toBe(false);
  });

  test('a proposal is stale even if the current revision somehow moved backward (defensive: exact match only)', () => {
    const proposal: ScheduleProposal = createScheduleProposal(result(), 4);
    expect(isProposalCurrent(proposal, 3)).toBe(false);
  });
});

import { diffSchedules } from '../diffSchedule';
import { ReasonCode, type ScheduledBlock } from '../types';

function block(id: string, taskId: string, start: string, end: string): ScheduledBlock {
  return { id, taskId, start, end };
}

describe('diffSchedules', () => {
  test('unchanged schedule produces no change for a relevant task', () => {
    const previous = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];
    const proposed = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];

    const changes = diffSchedules(previous, proposed, ['t1'], ReasonCode.AVAILABILITY_FREED);

    expect(changes).toEqual([]);
  });

  test('newly scheduled task (no previous block) produces a change with only newBlock set', () => {
    const previous: ScheduledBlock[] = [];
    const proposed = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];

    const changes = diffSchedules(previous, proposed, ['t1'], ReasonCode.AVAILABILITY_FREED);

    expect(changes).toHaveLength(1);
    expect(changes[0].taskId).toBe('t1');
    expect(changes[0].previousBlock).toBeUndefined();
    expect(changes[0].newBlock).toEqual(proposed[0]);
  });

  test('moved task produces a change with both previousBlock and newBlock set', () => {
    const previous = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];
    const proposed = [block('sb-2', 't1', '2026-08-25T14:00:00', '2026-08-25T15:00:00')];

    const changes = diffSchedules(previous, proposed, ['t1'], ReasonCode.AVAILABILITY_FREED);

    expect(changes).toHaveLength(1);
    expect(changes[0].previousBlock).toEqual(previous[0]);
    expect(changes[0].newBlock).toEqual(proposed[0]);
  });

  test('previously scheduled task becoming unscheduled produces a change with only previousBlock set', () => {
    const previous = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];
    const proposed: ScheduledBlock[] = [];

    const changes = diffSchedules(previous, proposed, ['t1'], ReasonCode.OVERFLOW_DEFERRED);

    expect(changes).toHaveLength(1);
    expect(changes[0].previousBlock).toEqual(previous[0]);
    expect(changes[0].newBlock).toBeUndefined();
  });

  test('a task with multiple pieces is only "unchanged" if every piece matches, not just the first', () => {
    const previous = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T09:30:00'),
      block('sb-2', 't1', '2026-08-24T14:00:00', '2026-08-24T14:30:00'),
    ];
    // First piece identical, second piece moved — must still be detected as changed.
    const proposedMoved = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T09:30:00'),
      block('sb-3', 't1', '2026-08-24T16:00:00', '2026-08-24T16:30:00'),
    ];
    const proposedIdentical = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T09:30:00'),
      block('sb-2', 't1', '2026-08-24T14:00:00', '2026-08-24T14:30:00'),
    ];

    expect(diffSchedules(previous, proposedMoved, ['t1'], ReasonCode.AVAILABILITY_FREED)).toHaveLength(1);
    expect(diffSchedules(previous, proposedIdentical, ['t1'], ReasonCode.AVAILABILITY_FREED)).toEqual([]);
  });

  test('protected (irrelevant) tasks are never compared, even if their blocks differ', () => {
    const previous = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00'),
      block('sb-2', 't2', '2026-08-24T11:00:00', '2026-08-24T12:00:00'),
    ];
    // t2's block "changed" in the raw data, but it's not in relevantTaskIds.
    const proposed = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00'),
      block('sb-3', 't2', '2026-08-25T11:00:00', '2026-08-25T12:00:00'),
    ];

    const changes = diffSchedules(previous, proposed, ['t1'], ReasonCode.AVAILABILITY_FREED);

    expect(changes).toEqual([]);
  });
});

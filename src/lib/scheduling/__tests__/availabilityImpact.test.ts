import { findAvailabilityImpact } from '../availabilityImpact';
import type { AvailabilityBlock, ScheduledBlock, Task } from '../types';

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: `Task ${overrides.id}`,
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-08-30T23:59:00',
    estimatedMinutes: 60,
    status: 'pending',
    ...overrides,
  };
}

function block(id: string, taskId: string, start: string, end: string): ScheduledBlock {
  return { id, taskId, start, end };
}

describe('findAvailabilityImpact', () => {
  test('a scheduled task whose block still fits is neither affected nor unscheduled', () => {
    const t1 = task({ id: 't1' });
    const blocks = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T12:00:00' },
    ];

    const { affected, unscheduled } = findAvailabilityImpact([t1], blocks, availability);

    expect(affected).toEqual([]);
    expect(unscheduled).toEqual([]);
  });

  test('a task with no block at all is classified as unscheduled', () => {
    const t1 = task({ id: 't1' });

    const { affected, unscheduled } = findAvailabilityImpact([t1], [], []);

    expect(affected).toEqual([]);
    expect(unscheduled).toEqual([t1]);
  });

  test('a task whose block no longer fits any segment is affected', () => {
    const t1 = task({ id: 't1' });
    const blocks = [block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00')];
    // Availability shrunk to only 10-12, no longer covering the 9-10 block.
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T10:00:00', end: '2026-08-24T12:00:00' },
    ];

    const { affected, unscheduled } = findAvailabilityImpact([t1], blocks, availability);

    expect(affected).toEqual([t1]);
    expect(unscheduled).toEqual([]);
  });

  test('multi-piece task: affected if ANY piece falls outside availability, not just the first', () => {
    const t1 = task({ id: 't1' });
    const blocks = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00'),
      block('sb-2', 't1', '2026-08-24T14:00:00', '2026-08-24T15:00:00'),
    ];
    // First piece's window still exists; second piece's window (14-15) was removed.
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
    ];

    const { affected } = findAvailabilityImpact([t1], blocks, availability);

    expect(affected).toEqual([t1]);
  });

  test('multi-piece task: NOT affected only if every piece still fits', () => {
    const t1 = task({ id: 't1' });
    const blocks = [
      block('sb-1', 't1', '2026-08-24T09:00:00', '2026-08-24T10:00:00'),
      block('sb-2', 't1', '2026-08-24T14:00:00', '2026-08-24T15:00:00'),
    ];
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
      { id: 'a2', start: '2026-08-24T14:00:00', end: '2026-08-24T15:00:00' },
    ];

    const { affected } = findAvailabilityImpact([t1], blocks, availability);

    expect(affected).toEqual([]);
  });

  test('completed and missed tasks are excluded from both lists', () => {
    const completed = task({ id: 'c1', status: 'completed' });
    const missed = task({ id: 'm1', status: 'missed' });
    // Neither has a block, and neither's placement is invalid — but they
    // must not appear as "unscheduled" candidates for a fresh placement.
    const { affected, unscheduled } = findAvailabilityImpact([completed, missed], [], []);

    expect(affected).toEqual([]);
    expect(unscheduled).toEqual([]);
  });

  test('a block spanning a segment boundary that was split is affected, not silently treated as valid', () => {
    const t1 = task({ id: 't1' });
    // Original block was carved from a single 9-12 segment.
    const blocks = [block('sb-1', 't1', '2026-08-24T10:00:00', '2026-08-24T11:00:00')];
    // The window was split into two, with a gap right where the block sits.
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
      { id: 'a2', start: '2026-08-24T11:00:00', end: '2026-08-24T12:00:00' },
    ];

    const { affected } = findAvailabilityImpact([t1], blocks, availability);

    expect(affected).toEqual([t1]);
  });
});

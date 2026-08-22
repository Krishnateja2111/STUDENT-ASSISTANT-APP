import { explainChanges } from '../explainChanges';
import { ReasonCode } from '../types';
import type { RescheduleResult, Task } from '../types';

function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'dueDate' | 'estimatedMinutes'>): Task {
  return {
    title: overrides.title ?? overrides.id,
    courseId: 'c1',
    taskType: 'graded_assignment',
    status: 'pending',
    ...overrides,
  };
}

describe('explainChanges', () => {
  it('MISSED_TASK_REINSERTED, placed after its own deadline: says it is overdue', () => {
    const task = makeTask({ id: 't2', title: 'Problem Set 4', dueDate: '2026-08-20T23:59:00', estimatedMinutes: 90 });
    const result: RescheduleResult = {
      scheduledBlocks: [],
      overflow: [],
      changes: [
        {
          taskId: 't2',
          reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
          newBlock: { id: 'sb1', taskId: 't2', start: '2026-08-23T11:00:00', end: '2026-08-23T12:30:00' },
        },
      ],
    };

    const entries = explainChanges(result, [task]);

    expect(entries).toHaveLength(1);
    expect(entries[0].taskId).toBe('t2');
    expect(entries[0].message).toContain('Problem Set 4');
    expect(entries[0].message).toContain('overdue');
  });

  it('MISSED_TASK_REINSERTED, still before its deadline: does not say overdue', () => {
    const task = makeTask({ id: 'A', title: 'Reading', taskType: 'reading', dueDate: '2026-03-11T00:00:00', estimatedMinutes: 60 });
    const result: RescheduleResult = {
      scheduledBlocks: [],
      overflow: [],
      changes: [
        {
          taskId: 'A',
          reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
          newBlock: { id: 'sb1', taskId: 'A', start: '2026-03-02T12:00:00', end: '2026-03-02T13:00:00' },
        },
      ],
    };

    const entries = explainChanges(result, [task]);

    expect(entries[0].message).toContain('Reading');
    expect(entries[0].message).not.toContain('overdue');
  });

  it('OVERFLOW_DEFERRED: explains the task could not be fit in', () => {
    const task = makeTask({ id: 'Y', title: 'Missed Thing', dueDate: '2026-03-05T00:00:00', estimatedMinutes: 30 });
    const result: RescheduleResult = {
      scheduledBlocks: [],
      overflow: [task],
      changes: [{ taskId: 'Y', reasonCode: ReasonCode.OVERFLOW_DEFERRED }],
    };

    const entries = explainChanges(result, [task]);

    expect(entries[0].message).toContain('Missed Thing');
    expect(entries[0].message.toLowerCase()).toContain('unscheduled');
  });

  it('produces a non-empty message for every reasonCode without crashing', () => {
    const task = makeTask({ id: 'z', title: 'Some Task', dueDate: '2026-03-05T00:00:00', estimatedMinutes: 30 });
    for (const reasonCode of Object.values(ReasonCode)) {
      const result: RescheduleResult = {
        scheduledBlocks: [],
        overflow: [],
        changes: [{ taskId: 'z', reasonCode }],
      };
      const entries = explainChanges(result, [task]);
      expect(entries[0].message.length).toBeGreaterThan(0);
    }
  });
});

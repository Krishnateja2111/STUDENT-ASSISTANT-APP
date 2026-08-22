import { getScheduleHealth } from '../getScheduleHealth';
import type { AvailabilityBlock, Task } from '../types';

function makeTask(overrides: Partial<Task> & Pick<Task, 'id' | 'dueDate' | 'estimatedMinutes'>): Task {
  return {
    title: overrides.title ?? overrides.id,
    courseId: 'c1',
    taskType: 'other',
    status: 'pending',
    ...overrides,
  };
}

describe('getScheduleHealth', () => {
  it('green: light workload relative to available time', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T19:00:00' }]; // 600 min
    const tasks = [makeTask({ id: 't1', dueDate: '2026-01-10T00:00:00', estimatedMinutes: 60 })];

    const health = getScheduleHealth(tasks, availability);

    expect(health.status).toBe('green');
    expect(health.suggestedDeferrals).toHaveLength(1); // retention-hook nudge still present
  });

  it('yellow: fits, but required/available ratio is high', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T15:40:00' }]; // 400 min
    const tasks = [makeTask({ id: 't1', dueDate: '2026-01-10T00:00:00', estimatedMinutes: 300 })]; // ratio 0.75

    const health = getScheduleHealth(tasks, availability);

    expect(health.status).toBe('yellow');
    expect(health.suggestedDeferrals).toHaveLength(1);
  });

  it('red: workload does not fit before its deadline; suggests the correct (lowest-priority) task(s) to defer', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T11:00:00' }]; // 120 min
    const highPriority = makeTask({ id: 'hi', taskType: 'exam_prep', dueDate: '2026-01-06T00:00:00', estimatedMinutes: 90 });
    const lowPriority = makeTask({ id: 'lo', taskType: 'reading', dueDate: '2026-01-06T00:00:00', estimatedMinutes: 90 });

    const health = getScheduleHealth([highPriority, lowPriority], availability);

    expect(health.status).toBe('red');
    expect(health.suggestedDeferrals.map((t) => t.id)).toEqual(['lo']);
  });

  it('green with no tasks at all', () => {
    const health = getScheduleHealth([], [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T11:00:00' }]);
    expect(health.status).toBe('green');
    expect(health.suggestedDeferrals).toHaveLength(0);
  });
});

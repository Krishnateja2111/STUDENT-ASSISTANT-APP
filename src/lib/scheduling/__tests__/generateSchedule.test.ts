import { generateSchedule } from '../generateSchedule';
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

function durationMinutes(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
}

describe('generateSchedule', () => {
  it('clean fit: places every task with no overflow, respecting deadlines', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T17:00:00' }];
    const tasks: Task[] = [
      makeTask({ id: 'x', taskType: 'reading', dueDate: '2026-01-10T00:00:00', estimatedMinutes: 60 }),
      makeTask({ id: 'y', taskType: 'graded_assignment', dueDate: '2026-01-06T00:00:00', estimatedMinutes: 90 }),
    ];

    const result = generateSchedule(tasks, availability);

    expect(result.overflow).toHaveLength(0);

    const byTask = (id: string) => result.scheduled.filter((b) => b.taskId === id);
    expect(byTask('x').reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)).toBe(60);
    expect(byTask('y').reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)).toBe(90);

    for (const task of tasks) {
      const blocks = byTask(task.id);
      for (const b of blocks) {
        expect(new Date(b.end).getTime()).toBeLessThanOrEqual(new Date(task.dueDate).getTime());
        expect(new Date(b.start).getTime()).toBeGreaterThanOrEqual(new Date(availability[0].start).getTime());
        expect(new Date(b.end).getTime()).toBeLessThanOrEqual(new Date(availability[0].end).getTime());
      }
    }

    // No overlapping blocks anywhere in the result.
    const sorted = [...result.scheduled].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    for (let i = 1; i < sorted.length; i++) {
      expect(new Date(sorted[i].start).getTime()).toBeGreaterThanOrEqual(new Date(sorted[i - 1].end).getTime());
    }
  });

  it('overflow: when work exceeds available time, the lowest-priority task is deferred, not dropped', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T11:00:00' }]; // 120 min
    const highPriority = makeTask({ id: 'a', taskType: 'exam_prep', dueDate: '2026-01-06T00:00:00', estimatedMinutes: 90 });
    const lowPriority = makeTask({ id: 'b', taskType: 'reading', dueDate: '2026-01-06T00:00:00', estimatedMinutes: 90 });

    const result = generateSchedule([highPriority, lowPriority], availability);

    expect(result.overflow.map((t) => t.id)).toEqual(['b']);
    const aBlocks = result.scheduled.filter((b) => b.taskId === 'a');
    expect(aBlocks.reduce((sum, b) => sum + durationMinutes(b.start, b.end), 0)).toBe(90);
    expect(result.scheduled.some((b) => b.taskId === 'b')).toBe(false);
  });

  it('dependency ordering: a task never starts before its dependency ends, even if it would otherwise score higher priority', () => {
    const availability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-01-05T09:00:00', end: '2026-01-05T11:00:00' }]; // exactly 120 min
    const dependency = makeTask({ id: 'p1', taskType: 'reading', dueDate: '2026-01-15T00:00:00', estimatedMinutes: 60 });
    const dependent = makeTask({
      id: 'q1',
      taskType: 'exam_prep', // much higher raw priority than the dependency
      dueDate: '2026-01-06T00:00:00',
      estimatedMinutes: 60,
      dependsOn: ['p1'],
    });

    const result = generateSchedule([dependent, dependency], availability);

    expect(result.overflow).toHaveLength(0);
    const depBlock = result.scheduled.find((b) => b.taskId === 'p1')!;
    const dependentBlock = result.scheduled.find((b) => b.taskId === 'q1')!;
    expect(depBlock).toBeDefined();
    expect(dependentBlock).toBeDefined();
    expect(new Date(dependentBlock.start).getTime()).toBeGreaterThanOrEqual(new Date(depBlock.end).getTime());
  });

  it('minimum session length: a task is never split into an awkward sub-20-minute non-final piece', () => {
    // Reproduces the exact real-data bug: a 15-minute leftover slot right
    // before a much bigger block should be skipped, not used as a fragment.
    const availability: AvailabilityBlock[] = [
      { id: 'sliver', start: '2026-01-05T15:45:00', end: '2026-01-05T16:00:00' }, // 15 min
      { id: 'main', start: '2026-01-05T19:00:00', end: '2026-01-05T22:00:00' }, // 180 min
    ];
    const task = makeTask({ id: 'exam', taskType: 'exam_prep', dueDate: '2026-01-10T00:00:00', estimatedMinutes: 180 });

    const result = generateSchedule([task], availability);

    expect(result.overflow).toHaveLength(0);
    const blocks = result.scheduled.filter((b) => b.taskId === 'exam');
    expect(blocks).toHaveLength(1);
    expect(durationMinutes(blocks[0].start, blocks[0].end)).toBe(180);
    // The 15-minute sliver was left completely untouched.
    expect(blocks[0].start).toBe('2026-01-05T19:00:00');
  });
});

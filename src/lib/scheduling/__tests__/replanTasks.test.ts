import { replanTasks } from '../replanTasks';
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

describe('replanTasks', () => {
  test('places a new task into open time without touching protected blocks', () => {
    const protectedTask = task({ id: 'p1' });
    const newTask = task({ id: 'n1', estimatedMinutes: 60 });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T12:00:00' },
    ];
    const currentBlocks: ScheduledBlock[] = [
      { id: 'sb-p1', taskId: 'p1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
    ];

    const result = replanTasks([newTask], [protectedTask, newTask], availability, currentBlocks);

    // Protected block untouched, byte-for-byte.
    expect(result.scheduledBlocks).toContainEqual(currentBlocks[0]);
    // New task placed somewhere in the remaining free time (10:00-12:00).
    const newTaskBlock = result.scheduledBlocks.find((b) => b.taskId === 'n1');
    expect(newTaskBlock).toBeDefined();
    expect(new Date(newTaskBlock!.start).getTime()).toBeGreaterThanOrEqual(new Date('2026-08-24T10:00:00').getTime());
    expect(result.overflow).toEqual([]);
  });

  test('existing scheduled (protected) task remains fixed when a different task is replanned', () => {
    const protectedTask = task({ id: 'p1', estimatedMinutes: 60 });
    const editedTask = task({ id: 'e1', estimatedMinutes: 60, dueDate: '2026-08-24T23:59:00' });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T11:00:00' },
    ];
    const currentBlocks: ScheduledBlock[] = [
      { id: 'sb-p1', taskId: 'p1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
      { id: 'sb-e1-old', taskId: 'e1', start: '2026-08-24T10:00:00', end: '2026-08-24T11:00:00' },
    ];

    const result = replanTasks([editedTask], [protectedTask, editedTask], availability, currentBlocks);

    const protectedBlock = result.scheduledBlocks.find((b) => b.taskId === 'p1');
    expect(protectedBlock).toEqual(currentBlocks[0]);
  });

  test('target task can move to a different time without moving protected tasks', () => {
    const protectedTask = task({ id: 'p1' });
    const editedTask = task({ id: 'e1', estimatedMinutes: 30 });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T13:00:00' },
    ];
    // e1 used to sit at 09:00-09:30; p1 occupies 09:30-10:30. Re-planning e1
    // should leave p1 exactly where it is, and e1 can land anywhere free.
    const currentBlocks: ScheduledBlock[] = [
      { id: 'sb-e1-old', taskId: 'e1', start: '2026-08-24T09:00:00', end: '2026-08-24T09:30:00' },
      { id: 'sb-p1', taskId: 'p1', start: '2026-08-24T09:30:00', end: '2026-08-24T10:30:00' },
    ];

    const result = replanTasks([editedTask], [protectedTask, editedTask], availability, currentBlocks);

    expect(result.scheduledBlocks.find((b) => b.taskId === 'p1')).toEqual(currentBlocks[1]);
    const newE1Block = result.scheduledBlocks.find((b) => b.taskId === 'e1');
    expect(newE1Block).toBeDefined();
    // Must not overlap p1's protected 09:30-10:30 slot.
    expect(new Date(newE1Block!.end).getTime()).toBeLessThanOrEqual(new Date('2026-08-24T09:30:00').getTime());
  });

  test('target task overflows when no suitable time exists anywhere', () => {
    const bigTask = task({ id: 'n1', estimatedMinutes: 600, dueDate: '2026-08-24T23:59:00' });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T09:30:00' }, // only 30 free minutes
    ];

    const result = replanTasks([bigTask], [bigTask], availability, []);

    expect(result.overflow).toEqual([bigTask]);
    expect(result.scheduledBlocks.some((b) => b.taskId === 'n1')).toBe(false);
  });

  test('bug fix: overflows rather than being placed after its own deadline when free time exists only later', () => {
    // 30 free minutes before the deadline (not enough for this 60-minute
    // task), but a second, larger window well after it -- reproduces the
    // live-confirmed bug where a task due Sept 3 was silently scheduled
    // across Sept 7-9 instead of correctly overflowing.
    const tightTask = task({ id: 'n1', estimatedMinutes: 60, dueDate: '2026-08-24T09:30:00' });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T09:30:00' }, // before deadline: only 30 min
      { id: 'a2', start: '2026-08-30T09:00:00', end: '2026-08-30T12:00:00' }, // after deadline: plenty of room
    ];

    const result = replanTasks([tightTask], [tightTask], availability, []);

    expect(result.overflow).toEqual([tightTask]);
    expect(result.scheduledBlocks.some((b) => b.taskId === 'n1')).toBe(false);
  });

  test('re-planning the same task twice never leaves duplicate blocks for it', () => {
    const editedTask = task({ id: 'e1', estimatedMinutes: 60 });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T12:00:00' },
    ];

    const firstPass = replanTasks([editedTask], [editedTask], availability, []);
    expect(firstPass.scheduledBlocks.filter((b) => b.taskId === 'e1')).toHaveLength(1);

    // Simulate an edit that changes duration, replanned again from the
    // result of the first pass — must still end up with exactly one block.
    const editedAgain = { ...editedTask, estimatedMinutes: 90 };
    const secondPass = replanTasks([editedAgain], [editedAgain], availability, firstPass.scheduledBlocks);

    expect(secondPass.scheduledBlocks.filter((b) => b.taskId === 'e1')).toHaveLength(1);
  });

  test('multiple existing protected blocks all remain unchanged', () => {
    const p1 = task({ id: 'p1' });
    const p2 = task({ id: 'p2' });
    const newTask = task({ id: 'n1', estimatedMinutes: 30 });
    const availability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-08-24T09:00:00', end: '2026-08-24T13:00:00' },
    ];
    const currentBlocks: ScheduledBlock[] = [
      { id: 'sb-p1', taskId: 'p1', start: '2026-08-24T09:00:00', end: '2026-08-24T10:00:00' },
      { id: 'sb-p2', taskId: 'p2', start: '2026-08-24T10:00:00', end: '2026-08-24T11:00:00' },
    ];

    const result = replanTasks([newTask], [p1, p2, newTask], availability, currentBlocks);

    expect(result.scheduledBlocks.find((b) => b.taskId === 'p1')).toEqual(currentBlocks[0]);
    expect(result.scheduledBlocks.find((b) => b.taskId === 'p2')).toEqual(currentBlocks[1]);
  });
});

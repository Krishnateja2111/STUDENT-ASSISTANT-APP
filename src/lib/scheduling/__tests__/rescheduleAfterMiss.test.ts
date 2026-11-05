import { rescheduleAfterMiss } from '../rescheduleAfterMiss';
import { scheduleTasksByPriority } from '../generateSchedule';
import { ReasonCode } from '../types';
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

describe('rescheduleAfterMiss', () => {
  // Task A: Reading, due in 10 days, 1 hour
  // Task B: Assignment, due tomorrow, 3 hours
  // Task C: Exam prep, due in 3 days, 4 hours
  const taskA = makeTask({ id: 'A', title: 'Reading', taskType: 'reading', dueDate: '2026-03-11T00:00:00', estimatedMinutes: 60 });
  const taskB = makeTask({ id: 'B', title: 'Assignment', taskType: 'graded_assignment', dueDate: '2026-03-02T00:00:00', estimatedMinutes: 180 });
  const taskC = makeTask({ id: 'C', title: 'Exam prep', taskType: 'exam_prep', dueDate: '2026-03-04T00:00:00', estimatedMinutes: 240 });

  const availability: AvailabilityBlock[] = [
    { id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T13:00:00' }, // 240 min
    { id: 'a2', start: '2026-03-02T09:00:00', end: '2026-03-02T13:00:00' }, // 240 min
    { id: 'a3', start: '2026-03-03T09:00:00', end: '2026-03-03T11:00:00' }, // 120 min
  ];
  const currentTasks = [taskA, taskB, taskC];

  it('leaves B and C exactly where they were, and reschedules A into the remaining slack', () => {
    const before = scheduleTasksByPriority(currentTasks, availability);
    const beforeB = before.scheduled.filter((b) => b.taskId === 'B');
    const beforeC = before.scheduled.filter((b) => b.taskId === 'C');
    expect(before.overflow).toHaveLength(0);

    const result = rescheduleAfterMiss(taskA, currentTasks, availability);

    const afterB = result.scheduledBlocks.filter((b) => b.taskId === 'B');
    const afterC = result.scheduledBlocks.filter((b) => b.taskId === 'C');
    expect(afterB).toEqual(beforeB);
    expect(afterC).toEqual(beforeC);

    // Only A appears in `changes` — B and C were never touched, so they never
    // generate a change entry.
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].taskId).toBe('A');
    expect(result.changes[0].reasonCode).toBe(ReasonCode.MISSED_TASK_REINSERTED);
    expect(result.changes[0].newBlock).toBeDefined();

    const aBlocks = result.scheduledBlocks.filter((b) => b.taskId === 'A');
    const aMinutes = aBlocks.reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000, 0);
    expect(aMinutes).toBe(60);
    expect(result.overflow).toHaveLength(0);
  });

  it('still finds a slot for a task whose original deadline has already passed, rather than dropping it', () => {
    const overdueTask = makeTask({
      id: 'M',
      title: 'Overdue Quiz',
      taskType: 'graded_assignment',
      dueDate: '2026-02-25T00:00:00', // before the availability window even starts
      estimatedMinutes: 60,
    });
    const localAvailability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T11:00:00' }];

    const result = rescheduleAfterMiss(overdueTask, [overdueTask], localAvailability);

    expect(result.overflow).toHaveLength(0);
    expect(result.changes[0].reasonCode).toBe(ReasonCode.MISSED_TASK_REINSERTED);
    expect(result.scheduledBlocks).toHaveLength(1);
    expect(result.scheduledBlocks[0].taskId).toBe('M');
  });

  it('never hands the missed task its own original slot back as the "new" placement', () => {
    // Z is the only task, and window 1 exactly fits it -- under the old
    // (buggy) logic, the missed task's own old slot was added back into the
    // free-time search space, so it was trivially the earliest opening and
    // got handed right back unchanged. A real reschedule must land somewhere
    // else: window 2, the only other real option.
    const z = makeTask({ id: 'Z', title: 'Missed early', dueDate: '2026-03-10T00:00:00', estimatedMinutes: 60 });
    const twoWindowAvailability: AvailabilityBlock[] = [
      { id: 'w1', start: '2026-03-01T09:00:00', end: '2026-03-01T10:00:00' }, // exactly 60 min -- Z's original slot
      { id: 'w2', start: '2026-03-02T09:00:00', end: '2026-03-02T11:00:00' }, // 120 min, the only other option
    ];

    const before = scheduleTasksByPriority([z], twoWindowAvailability);
    expect(before.scheduled).toHaveLength(1);
    expect(before.scheduled[0].start).toBe('2026-03-01T09:00:00'); // confirms Z's real original slot is window 1

    const result = rescheduleAfterMiss(z, [z], twoWindowAvailability);

    expect(result.overflow).toHaveLength(0);
    expect(result.changes[0].reasonCode).toBe(ReasonCode.MISSED_TASK_REINSERTED);
    const newBlock = result.changes[0].newBlock!;
    expect(newBlock).toBeDefined();
    // Must NOT be window 1 (its own old slot) -- must be window 2.
    expect(newBlock.start).not.toBe('2026-03-01T09:00:00');
    expect(newBlock.start).toBe('2026-03-02T09:00:00');
  });

  it('reports overflow when there is truly no slot left anywhere for the missed task', () => {
    const saturating = makeTask({ id: 'X', title: 'Filler', taskType: 'graded_assignment', dueDate: '2026-03-01T11:00:00', estimatedMinutes: 120 });
    const missed = makeTask({ id: 'Y', title: 'Missed Thing', taskType: 'reading', dueDate: '2026-03-05T00:00:00', estimatedMinutes: 30 });
    const localAvailability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T11:00:00' }]; // exactly saturated by X

    const result = rescheduleAfterMiss(missed, [saturating, missed], localAvailability);

    expect(result.overflow.map((t) => t.id)).toEqual(['Y']);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].reasonCode).toBe(ReasonCode.OVERFLOW_DEFERRED);
    expect(result.changes[0].newBlock).toBeUndefined();
    // X (the other task) is still there, untouched.
    expect(result.scheduledBlocks.some((b) => b.taskId === 'X')).toBe(true);
  });

  it('bumps a strictly lower-priority task to make room for a missed higher-priority task', () => {
    // Filler: reading, due in 10 days -- low urgency, low task-type weight.
    // Missed: exam prep, due tomorrow -- outranks Filler on both axes, so in
    // the fresh full-priority run Missed claims window 1 (earliest) and
    // Filler gets window 2 (the only time left). Both windows are sized to
    // exactly match their occupant, so nothing is left over anywhere.
    const filler = makeTask({ id: 'F', title: 'Filler', taskType: 'reading', dueDate: '2026-03-11T00:00:00', estimatedMinutes: 90 });
    const missed = makeTask({ id: 'M', title: 'Exam Prep', taskType: 'exam_prep', dueDate: '2026-03-02T00:00:00', estimatedMinutes: 90 });
    const localAvailability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T10:30:00' }, // Missed's own slot in the fresh run
      { id: 'a2', start: '2026-03-01T11:00:00', end: '2026-03-01T12:30:00' }, // Filler's slot in the fresh run
    ];

    const before = scheduleTasksByPriority([filler, missed], localAvailability);
    expect(before.overflow).toHaveLength(0);
    expect(before.remainingSegments).toHaveLength(0); // both windows exactly consumed -- confirms there's genuinely no slack anywhere

    const result = rescheduleAfterMiss(missed, [filler, missed], localAvailability);

    // The missed (higher-priority) task must be placed, not overflowed.
    expect(result.overflow.map((t) => t.id)).not.toContain('M');
    const missedChange = result.changes.find((c) => c.taskId === 'M')!;
    expect(missedChange.reasonCode).toBe(ReasonCode.MISSED_TASK_REINSERTED);
    expect(missedChange.newBlock).toBeDefined();
    // The missed task's own change is always first (app-state.tsx's
    // "which task gets the toast" logic depends on this ordering).
    expect(result.changes[0].taskId).toBe('M');

    // Filler was bumped -- there's nowhere else for it to go in this fixture
    // (only one availability window, now fully claimed by the missed task),
    // so it honestly overflows rather than being silently dropped.
    expect(result.overflow.map((t) => t.id)).toContain('F');
    const fillerChange = result.changes.find((c) => c.taskId === 'F')!;
    expect(fillerChange).toBeDefined();
    expect(fillerChange.reasonCode).toBe(ReasonCode.DEADLINE_PROXIMITY);
    expect(fillerChange.newBlock).toBeUndefined();
  });

  it('never bumps a same-or-higher-priority task even when it is the only thing in the way', () => {
    // Both tasks are exam prep due the same day -- identical priority score.
    // The one occupying the slot must never be treated as bumpable.
    const occupying = makeTask({ id: 'O', title: 'Occupying', taskType: 'exam_prep', dueDate: '2026-03-01T11:00:00', estimatedMinutes: 120 });
    const missed = makeTask({ id: 'M', title: 'Missed Exam Prep', taskType: 'exam_prep', dueDate: '2026-03-01T11:00:00', estimatedMinutes: 30 });
    const localAvailability: AvailabilityBlock[] = [{ id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T11:00:00' }]; // exactly saturated

    const result = rescheduleAfterMiss(missed, [occupying, missed], localAvailability);

    // Missed task overflows -- nothing lower-priority existed to bump.
    expect(result.overflow.map((t) => t.id)).toEqual(['M']);
    expect(result.changes).toHaveLength(1);
    expect(result.changes[0].reasonCode).toBe(ReasonCode.OVERFLOW_DEFERRED);
    // Occupying is completely untouched -- same block, no change entry.
    expect(result.scheduledBlocks.some((b) => b.taskId === 'O')).toBe(true);
    expect(result.changes.some((c) => c.taskId === 'O')).toBe(false);
  });

  it('bumps only the weakest lower-priority task needed, leaving a stronger (but still lower-priority) one untouched', () => {
    // Three tasks competing for three exactly-sized windows: Missed (highest,
    // exam prep due soonest) claims window 1. Of the two remaining, Stronger
    // (a graded assignment, due moderately soon) still outranks Weaker (a
    // reading, due far out), so Stronger claims window 2 (earlier) and Weaker
    // gets window 3 -- all three windows exactly consumed, nothing left over.
    const missed = makeTask({ id: 'M', title: 'Exam Prep', taskType: 'exam_prep', dueDate: '2026-03-02T00:00:00', estimatedMinutes: 60 });
    const stronger = makeTask({ id: 'S', title: 'Stronger Filler', taskType: 'graded_assignment', dueDate: '2026-03-05T00:00:00', estimatedMinutes: 60 });
    const weaker = makeTask({ id: 'W', title: 'Weaker Filler', taskType: 'reading', dueDate: '2026-03-11T00:00:00', estimatedMinutes: 60 });
    const localAvailability: AvailabilityBlock[] = [
      { id: 'a1', start: '2026-03-01T09:00:00', end: '2026-03-01T10:00:00' }, // Missed's own slot
      { id: 'a2', start: '2026-03-01T11:00:00', end: '2026-03-01T12:00:00' }, // Stronger's slot
      { id: 'a3', start: '2026-03-01T13:00:00', end: '2026-03-01T14:00:00' }, // Weaker's slot -- big enough alone for Missed
    ];

    const before = scheduleTasksByPriority([missed, stronger, weaker], localAvailability);
    expect(before.remainingSegments).toHaveLength(0);

    const result = rescheduleAfterMiss(missed, [missed, stronger, weaker], localAvailability);

    // Missed placed into Weaker's old slot -- the only candidate that needed
    // to move; bumping Weaker alone was already enough.
    const missedChange = result.changes.find((c) => c.taskId === 'M')!;
    expect(missedChange.newBlock?.start).toBe('2026-03-01T13:00:00');

    // Weaker was bumped and, with nowhere left to go, honestly overflows.
    expect(result.overflow.map((t) => t.id)).toEqual(['W']);
    const weakerChange = result.changes.find((c) => c.taskId === 'W')!;
    expect(weakerChange.reasonCode).toBe(ReasonCode.DEADLINE_PROXIMITY);
    expect(weakerChange.newBlock).toBeUndefined();

    // Stronger -- still lower-priority than Missed, but never needed --
    // stays completely untouched: same block, no change entry at all.
    expect(result.changes.some((c) => c.taskId === 'S')).toBe(false);
    expect(result.scheduledBlocks.some((b) => b.taskId === 'S' && b.start === '2026-03-01T11:00:00')).toBe(true);
  });
});

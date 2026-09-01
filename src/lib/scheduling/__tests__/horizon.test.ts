import { computeHorizon } from '../horizon';
import type { Task } from '../types';

const REFERENCE_DATE = new Date(2026, 7, 24, 0, 0, 0); // 2026-08-24T00:00:00, local
const MIN_WEEKS = 4;
const MAX_WEEKS = 12;

function task(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
  return {
    title: `Task ${overrides.id}`,
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-09-01T23:59:00',
    estimatedMinutes: 60,
    status: 'pending',
    ...overrides,
  };
}

describe('computeHorizon', () => {
  test('A. no active tasks uses the minimum horizon', () => {
    const horizon = computeHorizon([], MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon).toEqual({ start: '2026-08-24T00:00:00', end: '2026-09-21T00:00:00' }); // +4 weeks
  });

  test('B. deadline inside the minimum horizon still yields the minimum horizon', () => {
    const tasks = [task({ id: 't1', dueDate: '2026-08-30T23:59:00' })]; // well within 4 weeks
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-09-21T00:00:00');
  });

  test('C. deadline beyond minimum but below maximum extends the horizon to deadline + 1 week', () => {
    // 6 weeks out — beyond the 4-week floor, well under the 12-week ceiling.
    const tasks = [task({ id: 't1', dueDate: '2026-10-05T23:59:00' })];
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    // deadline (2026-10-05) + 7 days = 2026-10-12
    expect(horizon.end).toBe('2026-10-12T23:59:00');
  });

  test('D. deadline beyond the maximum is clamped to the maximum', () => {
    const tasks = [task({ id: 't1', dueDate: '2027-06-01T23:59:00' })]; // far beyond 12 weeks
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-11-16T00:00:00'); // referenceDate + 12 weeks exactly
  });

  test('E. completed tasks are ignored', () => {
    const tasks = [task({ id: 't1', dueDate: '2027-06-01T23:59:00', status: 'completed' })];
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-09-21T00:00:00'); // falls back to the floor — no active deadline
  });

  test('F. missed tasks are ignored (recovery is a separate, dedicated flow — see availabilityImpact.ts precedent)', () => {
    const tasks = [task({ id: 't1', dueDate: '2027-06-01T23:59:00', status: 'missed' })];
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-09-21T00:00:00');
  });

  test('G. multiple deadlines — the furthest relevant one controls the horizon', () => {
    const tasks = [
      task({ id: 't1', dueDate: '2026-09-01T23:59:00' }),
      task({ id: 't2', dueDate: '2026-10-05T23:59:00' }), // furthest
      task({ id: 't3', dueDate: '2026-08-26T23:59:00' }),
      task({ id: 't4', dueDate: '2027-01-01T23:59:00', status: 'completed' }), // ignored — furthest but excluded
    ];
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-10-12T23:59:00');
  });

  test('H. fixed reference date — identical inputs always produce identical output', () => {
    const tasks = [task({ id: 't1', dueDate: '2026-10-05T23:59:00' })];
    const h1 = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    const h2 = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(h1).toEqual(h2);
  });

  test('I. leap-year / date-boundary behavior — reference date near a leap-year Feb 29 rolls forward correctly', () => {
    const leapReference = new Date(2028, 1, 20, 0, 0, 0); // 2028-02-20, 2028 is a leap year
    const horizon = computeHorizon([], MIN_WEEKS, MAX_WEEKS, leapReference);
    // +4 weeks (28 days) from Feb 20 2028 correctly crosses Feb 29 into March.
    expect(horizon.end).toBe('2028-03-19T00:00:00');
  });

  test('J. exact horizon boundaries — a deadline exactly on the minimum floor does not extend it', () => {
    // Deadline exactly 3 weeks out; +1 week buffer = exactly the 4-week floor.
    const tasks = [task({ id: 't1', dueDate: '2026-09-14T00:00:00' })];
    const horizon = computeHorizon(tasks, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.end).toBe('2026-09-21T00:00:00');

    // A deadline close enough to the ceiling that its +1-week buffer would
    // overshoot it is correctly clamped, not allowed to exceed the maximum.
    const tasksAtCeiling = [task({ id: 't2', dueDate: '2026-11-14T00:00:00' })]; // ~82 days out; +7d would reach day 89, past the 84-day ceiling
    const horizonAtCeiling = computeHorizon(tasksAtCeiling, MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizonAtCeiling.end).toBe('2026-11-16T00:00:00'); // clamped to referenceDate + 12 weeks
  });

  test('horizon.start always equals the reference date, unclamped', () => {
    const horizon = computeHorizon([], MIN_WEEKS, MAX_WEEKS, REFERENCE_DATE);
    expect(horizon.start).toBe('2026-08-24T00:00:00');
  });
});

import { mockRescheduleResult } from './mockData';
import type { AvailabilityBlock, RescheduleResult, Task } from './types';

/**
 * TODO(scheduling-engine): replace with the real reschedule logic. Critical
 * constraint from the brief: a missed LOW-priority task must not disrupt
 * higher-priority tasks elsewhere in the schedule. Before this replaces the
 * mock, add a test fixture with three tasks of clearly different
 * priority/deadline where missing the lowest-priority one leaves the other
 * two essentially untouched — this is the one behavior the whole product
 * concept depends on.
 */
export function rescheduleAfterMiss(
  _missedTask: Task,
  _currentTasks: Task[],
  _availability: AvailabilityBlock[]
): RescheduleResult {
  return mockRescheduleResult;
}

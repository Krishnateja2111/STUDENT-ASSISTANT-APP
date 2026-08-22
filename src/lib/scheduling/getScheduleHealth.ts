import { mockScheduleHealth } from './mockData';
import type { AvailabilityBlock, ScheduleHealth, Task } from './types';

/**
 * TODO(scheduling-engine): replace with the real health calculation, using
 * available-vs-required time ratio before the earliest hard deadline, with
 * a suggestion of which low-priority task(s) to defer if the status comes
 * out red.
 */
export function getScheduleHealth(_tasks: Task[], _availability: AvailabilityBlock[]): ScheduleHealth {
  return mockScheduleHealth;
}

import { mockScheduledBlocks } from './mockData';
import type { AvailabilityBlock, ScheduledBlock, Task } from './types';

/**
 * TODO(scheduling-engine): replace with the real greedy priority scheduler.
 * Priority derives from deadline proximity, task-type weight (exam prep >
 * graded assignment > reading), and dependency order. Never schedule a task
 * to start after its deadline. If total required work exceeds available
 * time before the earliest deadline, the caller (rescheduleAfterMiss /
 * getScheduleHealth) must surface an explicit overflow list rather than
 * silently dropping tasks — this function itself only returns placed
 * blocks, so overflow handling lives one level up.
 *
 * Needs unit tests before any screen depends on real output, per the
 * build-order constraint in the brief.
 */
export function generateSchedule(_tasks: Task[], _availability: AvailabilityBlock[]): ScheduledBlock[] {
  return mockScheduledBlocks;
}

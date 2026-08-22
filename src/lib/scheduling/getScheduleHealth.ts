import { scheduleTasksByPriority } from './generateSchedule';
import { priorityScore } from './priority';
import { toSegments, totalSegmentMs } from './timeSlots';
import type { AvailabilityBlock, HealthStatus, ScheduleHealth, Task } from './types';

/** Above this required/available ratio, flag yellow even though everything still fits. */
const YELLOW_RATIO_THRESHOLD = 0.7;

function hours(ms: number): number {
  return Math.round((ms / (1000 * 60 * 60)) * 10) / 10;
}

function lowestPriority(tasks: Task[], referenceTimeMs: number): Task[] {
  return [...tasks].sort((a, b) => priorityScore(a, referenceTimeMs) - priorityScore(b, referenceTimeMs));
}

/**
 * Runs the same greedy scheduler as generateSchedule to determine actual
 * feasibility (an overflow means red, not just a heuristic ratio), then
 * layers a "getting tight" yellow threshold on top for schedules that still
 * fit but are close to saturated.
 *
 * suggestedDeferrals is populated whenever there's any active task, even on
 * green — the Dashboard's retention hook ("never feel fully done") surfaces
 * it as a small next action regardless of health status; only red uses the
 * actual overflowed tasks, since those are the ones that must move.
 */
export function getScheduleHealth(tasks: Task[], availability: AvailabilityBlock[]): ScheduleHealth {
  const activeTasks = tasks.filter((t) => t.status !== 'completed');
  if (activeTasks.length === 0) {
    return { status: 'green', message: "Nothing on your plate right now — you're all caught up.", suggestedDeferrals: [] };
  }

  const result = scheduleTasksByPriority(activeTasks, availability);
  const referenceTimeMs = result.referenceTimeMs;
  const requiredMs = activeTasks.reduce((sum, t) => sum + t.estimatedMinutes * 60_000, 0);
  const availableMs = totalSegmentMs(toSegments(availability));
  const ranked = lowestPriority(activeTasks, referenceTimeMs);

  const nearestDeadline = activeTasks.reduce((min, t) => {
    const due = new Date(t.dueDate).getTime();
    return due < min ? due : min;
  }, Infinity);
  const nearestDeadlineLabel = new Date(nearestDeadline).toLocaleDateString('en-US', { weekday: 'long' });

  if (result.overflow.length > 0) {
    const deferrals = lowestPriority(result.overflow, referenceTimeMs);
    const deferTitles = deferrals.map((t) => t.title).join(', ');
    const status: HealthStatus = 'red';
    return {
      status,
      message: `You have ${hours(requiredMs)}h of work due before ${nearestDeadlineLabel} but only ${hours(availableMs)}h scheduled. Consider deferring ${deferTitles}.`,
      suggestedDeferrals: deferrals,
    };
  }

  const ratio = availableMs > 0 ? requiredMs / availableMs : Infinity;
  if (ratio > YELLOW_RATIO_THRESHOLD) {
    const status: HealthStatus = 'yellow';
    return {
      status,
      message: `You have ${hours(requiredMs)}h of work due before ${nearestDeadlineLabel} and ${hours(availableMs)}h of free time scheduled. Consider deferring one task.`,
      suggestedDeferrals: ranked.slice(0, 1),
    };
  }

  const status: HealthStatus = 'green';
  return {
    status,
    message: `You have ${hours(requiredMs)}h of work and ${hours(availableMs)}h of free time scheduled. You're on track.`,
    suggestedDeferrals: ranked.slice(0, 1),
  };
}

import type { Task, TaskType } from './types';

/** exam prep > graded assignment > reading > other, per the brief. */
export const TASK_TYPE_WEIGHT: Record<TaskType, number> = {
  exam_prep: 3,
  graded_assignment: 2,
  reading: 1,
  other: 0,
};

export const TASK_TYPE_LABEL: Record<TaskType, string> = {
  exam_prep: 'exam prep',
  graded_assignment: 'graded assignment',
  reading: 'reading',
  other: 'task',
};

/**
 * Higher score schedules first. Deadline proximity dominates (urgency is
 * inverse-hours-until-due, scaled up by 10x); task-type weight acts as a
 * tiebreaker among tasks with comparable urgency — matches the brief's
 * "deadline proximity weighted most heavily, task-type weight second."
 *
 * referenceTimeMs must be caller-supplied (not Date.now()) so scoring stays
 * deterministic and testable — see scheduleTasksByPriority, which derives it
 * from the earliest availability block.
 */
export function priorityScore(task: Task, referenceTimeMs: number): number {
  const dueMs = new Date(task.dueDate).getTime();
  const hoursUntilDue = Math.max((dueMs - referenceTimeMs) / (1000 * 60 * 60), 0.01);
  const urgency = 1000 / hoursUntilDue;
  return urgency * 10 + TASK_TYPE_WEIGHT[task.taskType];
}

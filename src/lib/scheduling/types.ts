/**
 * Core types for the scheduling engine. This module is pure TypeScript —
 * no UI, no network, no AI. See brief: /lib/scheduling is imported by the
 * app, never the other way around.
 */

export type TaskType = 'exam_prep' | 'graded_assignment' | 'reading' | 'other';

export type TaskStatus = 'pending' | 'scheduled' | 'completed' | 'missed';

export interface Course {
  id: string;
  name: string;
  colorTag?: string;
}

export interface Task {
  id: string;
  title: string;
  courseId: string;
  taskType: TaskType;
  dueDate: string; // ISO 8601
  estimatedMinutes: number;
  status: TaskStatus;
  /** Task ids that must be completed/scheduled before this one. */
  dependsOn?: string[];
}

export interface AvailabilityBlock {
  id: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
  label?: string;
}

export interface ScheduledBlock {
  id: string;
  taskId: string;
  start: string; // ISO 8601
  end: string; // ISO 8601
}

export interface GenerateScheduleResult {
  scheduled: ScheduledBlock[];
  /** Tasks that could not be fully placed before their deadline given available time. */
  overflow: Task[];
}

/**
 * Why a change happened, as data — never free text. Human-readable text is
 * generated deterministically from this + task data in explainChanges().
 */
export enum ReasonCode {
  DEADLINE_PROXIMITY = 'DEADLINE_PROXIMITY',
  HIGH_PRIORITY_TASK_TYPE = 'HIGH_PRIORITY_TASK_TYPE',
  AVAILABILITY_FREED = 'AVAILABILITY_FREED',
  DEPENDENCY_ORDER = 'DEPENDENCY_ORDER',
  MISSED_TASK_REINSERTED = 'MISSED_TASK_REINSERTED',
  OVERFLOW_DEFERRED = 'OVERFLOW_DEFERRED',
}

export interface ScheduleChange {
  taskId: string;
  reasonCode: ReasonCode;
  previousBlock?: ScheduledBlock;
  newBlock?: ScheduledBlock;
}

export interface RescheduleResult {
  scheduledBlocks: ScheduledBlock[];
  /** Tasks that could not be placed before their deadline given available time. */
  overflow: Task[];
  changes: ScheduleChange[];
}

export interface ExplanationEntry {
  taskId: string;
  reasonCode: ReasonCode;
  message: string;
}

export type HealthStatus = 'green' | 'yellow' | 'red';

export interface ScheduleHealth {
  status: HealthStatus;
  message: string;
  /** Low-priority tasks worth deferring if status is yellow/red. */
  suggestedDeferrals: Task[];
}

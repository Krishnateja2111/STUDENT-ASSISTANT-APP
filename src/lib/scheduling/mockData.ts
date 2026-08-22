/**
 * Hardcoded fixture data for the UI-validation pass. Every scheduling
 * function currently returns data from this file regardless of its real
 * inputs — see the TODO in each function. Dates are anchored around
 * 2026-08-21 so "today" reads sensibly on the Dashboard.
 *
 * TODO(scheduling-engine): delete this file once generateSchedule,
 * rescheduleAfterMiss, getScheduleHealth, and explainChanges have real
 * implementations backed by unit tests; replace with test fixtures instead.
 */

import { ReasonCode } from './types';
import type {
  AvailabilityBlock,
  Course,
  ExplanationEntry,
  RescheduleResult,
  ScheduledBlock,
  ScheduleHealth,
  Task,
} from './types';

export const mockCourses: Course[] = [
  { id: 'c1', name: 'CS 301 – Algorithms', colorTag: '#3C87F7' },
  { id: 'c2', name: 'ENG 210 – Rhetoric & Composition', colorTag: '#E0A93C' },
  { id: 'c3', name: 'MATH 220 – Linear Algebra', colorTag: '#4CAF7D' },
];

export const mockTasks: Task[] = [
  {
    id: 't1',
    title: 'Algorithms Exam Prep',
    courseId: 'c1',
    taskType: 'exam_prep',
    dueDate: '2026-08-24T09:00:00',
    estimatedMinutes: 180,
    status: 'scheduled',
  },
  {
    id: 't2',
    title: 'Problem Set 4',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-08-20T23:59:00',
    estimatedMinutes: 90,
    status: 'missed',
  },
  {
    id: 't3',
    title: 'Reading: Ch. 7 Rhetorical Devices',
    courseId: 'c2',
    taskType: 'reading',
    dueDate: '2026-08-23T23:59:00',
    estimatedMinutes: 45,
    status: 'scheduled',
  },
  {
    id: 't4',
    title: 'Linear Algebra Homework 5',
    courseId: 'c3',
    taskType: 'graded_assignment',
    dueDate: '2026-08-22T23:59:00',
    estimatedMinutes: 60,
    status: 'scheduled',
  },
  {
    id: 't5',
    title: 'Essay Draft 2',
    courseId: 'c2',
    taskType: 'graded_assignment',
    dueDate: '2026-08-25T23:59:00',
    estimatedMinutes: 120,
    status: 'scheduled',
  },
];

export const mockAvailability: AvailabilityBlock[] = [
  { id: 'a1', start: '2026-08-21T14:00:00', end: '2026-08-21T16:00:00', label: 'Afternoon study block' },
  { id: 'a2', start: '2026-08-21T19:00:00', end: '2026-08-21T20:30:00', label: 'Evening' },
  { id: 'a3', start: '2026-08-22T10:00:00', end: '2026-08-22T12:00:00', label: 'Morning' },
  { id: 'a4', start: '2026-08-22T15:00:00', end: '2026-08-22T17:00:00', label: 'Afternoon' },
  { id: 'a5', start: '2026-08-23T09:00:00', end: '2026-08-23T13:00:00', label: 'Weekend morning' },
];

export const mockScheduledBlocks: ScheduledBlock[] = [
  { id: 'sb1', taskId: 't4', start: '2026-08-21T14:00:00', end: '2026-08-21T15:00:00' },
  { id: 'sb2', taskId: 't1', start: '2026-08-21T15:00:00', end: '2026-08-21T16:00:00' },
  { id: 'sb3', taskId: 't1', start: '2026-08-22T10:00:00', end: '2026-08-22T12:00:00' },
  { id: 'sb4', taskId: 't5', start: '2026-08-22T15:00:00', end: '2026-08-22T17:00:00' },
  { id: 'sb5', taskId: 't3', start: '2026-08-23T09:00:00', end: '2026-08-23T09:45:00' },
];

export const mockScheduleHealth: ScheduleHealth = {
  status: 'yellow',
  message: 'You have 4.5 hours of work due before Monday and 4 hours of free time scheduled. Consider deferring one task.',
  suggestedDeferrals: [mockTasks.find((t) => t.id === 't3')!],
};

const reinsertedBlock: ScheduledBlock = {
  id: 'sb6',
  taskId: 't2',
  start: '2026-08-23T11:00:00',
  end: '2026-08-23T12:30:00',
};

const shiftedReadingBlock: ScheduledBlock = {
  id: 'sb5b',
  taskId: 't3',
  start: '2026-08-23T12:30:00',
  end: '2026-08-23T13:15:00',
};

export const mockRescheduleResult: RescheduleResult = {
  scheduledBlocks: [
    mockScheduledBlocks[0],
    mockScheduledBlocks[1],
    mockScheduledBlocks[2],
    mockScheduledBlocks[3],
    reinsertedBlock,
    shiftedReadingBlock,
  ],
  overflow: [],
  changes: [
    {
      taskId: 't2',
      reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
      newBlock: reinsertedBlock,
    },
    {
      taskId: 't3',
      reasonCode: ReasonCode.DEADLINE_PROXIMITY,
      previousBlock: mockScheduledBlocks[4],
      newBlock: shiftedReadingBlock,
    },
  ],
};

export const mockExplanationEntries: ExplanationEntry[] = [
  {
    taskId: 't2',
    reasonCode: ReasonCode.MISSED_TASK_REINSERTED,
    message:
      "Problem Set 4 was moved to Sunday 11:00–12:30. It's a graded assignment that's now overdue, so it jumped ahead of lower-priority work to get rescheduled first.",
  },
  {
    taskId: 't3',
    reasonCode: ReasonCode.DEADLINE_PROXIMITY,
    message:
      "Reading: Ch. 7 Rhetorical Devices shifted to 12:30–1:15pm on Sunday to make room. Your Algorithms exam prep on Monday wasn't touched.",
  },
];

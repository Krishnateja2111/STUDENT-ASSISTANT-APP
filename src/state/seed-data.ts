/**
 * Seed/fixture data standing in for a backend (Supabase/etc. — explicitly
 * undecided, see app-state.tsx). This is input data for the real scheduling
 * engine, not a stub of its output — lib/scheduling/ itself contains no
 * mock data or hardcoded results. Dates are anchored around 2026-08-21 to
 * match the "today" the Dashboard filters on.
 */

import type { AvailabilityBlock, Course, Task } from '@/lib/scheduling';

export const seedCourses: Course[] = [
  { id: 'c1', name: 'CS 301 – Algorithms', colorTag: '#3C87F7' },
  { id: 'c2', name: 'ENG 210 – Rhetoric & Composition', colorTag: '#E0A93C' },
  { id: 'c3', name: 'MATH 220 – Linear Algebra', colorTag: '#4CAF7D' },
];

export const seedTasks: Task[] = [
  {
    id: 't1',
    title: 'Algorithms Exam Prep',
    courseId: 'c1',
    taskType: 'exam_prep',
    dueDate: '2026-08-24T09:00:00',
    estimatedMinutes: 180,
    status: 'pending',
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
    status: 'pending',
  },
  {
    id: 't4',
    title: 'Linear Algebra Homework 5',
    courseId: 'c3',
    taskType: 'graded_assignment',
    dueDate: '2026-08-22T23:59:00',
    estimatedMinutes: 60,
    status: 'pending',
  },
  {
    id: 't5',
    title: 'Essay Draft 2',
    courseId: 'c2',
    taskType: 'graded_assignment',
    dueDate: '2026-08-25T23:59:00',
    estimatedMinutes: 120,
    status: 'pending',
  },
];

export const seedAvailability: AvailabilityBlock[] = [
  { id: 'a1', start: '2026-08-21T14:00:00', end: '2026-08-21T16:00:00', label: 'Afternoon study block' },
  { id: 'a2', start: '2026-08-21T19:00:00', end: '2026-08-21T20:30:00', label: 'Evening' },
  { id: 'a3', start: '2026-08-22T10:00:00', end: '2026-08-22T12:00:00', label: 'Morning' },
  { id: 'a4', start: '2026-08-22T15:00:00', end: '2026-08-22T17:00:00', label: 'Afternoon' },
  { id: 'a5', start: '2026-08-23T09:00:00', end: '2026-08-23T13:00:00', label: 'Weekend morning' },
];

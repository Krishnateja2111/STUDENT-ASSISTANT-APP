/**
 * Seed/fixture data standing in for a backend (Supabase/etc. — explicitly
 * undecided, see app-state.tsx). This is input data for the real scheduling
 * engine, not a stub of its output — lib/scheduling/ itself contains no
 * mock data or hardcoded results.
 *
 * The original fixtures (t1–t5, a1–a5) are anchored around 2026-08-21 —
 * left as-is since they still exercise history (a completed/missed task,
 * course-detail content) and nothing depends on them being "current."
 * t6–t9/a6–a12 are additive, anchored to the real current week instead, now
 * that reference-date.ts derives "today" from the device clock rather than
 * a fixed string — so Dashboard/Calendar have something real to show today.
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
  {
    id: 't6',
    title: 'Recursion & Dynamic Programming Set',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-08-29T23:59:00',
    estimatedMinutes: 90,
    status: 'pending',
  },
  {
    id: 't7',
    title: 'Peer Review Draft',
    courseId: 'c2',
    taskType: 'other',
    dueDate: '2026-08-28T17:00:00',
    estimatedMinutes: 45,
    status: 'pending',
  },
  {
    id: 't8',
    title: 'Midterm Exam Prep',
    courseId: 'c3',
    taskType: 'exam_prep',
    dueDate: '2026-09-01T09:00:00',
    estimatedMinutes: 150,
    status: 'pending',
  },
  {
    id: 't9',
    title: 'Reading: Ch. 9 Argument Structures',
    courseId: 'c2',
    taskType: 'reading',
    dueDate: '2026-08-30T23:59:00',
    estimatedMinutes: 40,
    status: 'pending',
  },
  {
    id: 't10',
    title: 'Discussion Post: Week 6',
    courseId: 'c2',
    taskType: 'other',
    dueDate: '2026-08-30T20:00:00',
    estimatedMinutes: 30,
    status: 'pending',
  },
  {
    id: 't11',
    title: 'Practice Problems Set 6',
    courseId: 'c3',
    taskType: 'graded_assignment',
    dueDate: '2026-08-31T23:59:00',
    estimatedMinutes: 60,
    status: 'pending',
  },
  {
    id: 't12',
    title: 'Group Project Proposal',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-09-02T23:59:00',
    estimatedMinutes: 90,
    status: 'pending',
  },
  {
    id: 't13',
    title: 'Lab Report: Sorting Algorithms',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: '2026-09-01T23:59:00',
    estimatedMinutes: 75,
    status: 'pending',
  },
  {
    id: 't14',
    title: 'Vocabulary Quiz Review',
    courseId: 'c2',
    taskType: 'reading',
    dueDate: '2026-09-02T12:00:00',
    estimatedMinutes: 30,
    status: 'pending',
  },
];

export const seedAvailability: AvailabilityBlock[] = [
  // a1-a5 sized to what t1/t3/t4/t5 actually need (405min) plus a small
  // buffer — previously 690min against 405min needed, and that unused
  // surplus was invisible until t6-t9 were added: the greedy scheduler
  // (earliest-segment-first, see generateSchedule.ts) was then free to
  // poach it in small fragments before ever reaching this week's
  // availability. Trimmed here, not in the algorithm — old task placement
  // is unaffected, only the previously-dormant slack is gone.
  { id: 'a1', start: '2026-08-21T14:00:00', end: '2026-08-21T16:00:00', label: 'Afternoon study block' },
  { id: 'a2', start: '2026-08-21T19:00:00', end: '2026-08-21T20:00:00', label: 'Evening' },
  { id: 'a3', start: '2026-08-22T10:00:00', end: '2026-08-22T11:00:00', label: 'Morning' },
  { id: 'a4', start: '2026-08-22T15:00:00', end: '2026-08-22T16:00:00', label: 'Afternoon' },
  { id: 'a5', start: '2026-08-23T09:00:00', end: '2026-08-23T11:30:00', label: 'Weekend morning' },
  { id: 'a6', start: '2026-08-27T14:00:00', end: '2026-08-27T15:30:00', label: 'Afternoon study block' },
  { id: 'a7', start: '2026-08-27T19:00:00', end: '2026-08-27T20:00:00', label: 'Evening' },
  { id: 'a8', start: '2026-08-28T10:00:00', end: '2026-08-28T11:30:00', label: 'Morning' },
  { id: 'a9', start: '2026-08-28T15:00:00', end: '2026-08-28T16:00:00', label: 'Afternoon' },
  { id: 'a10', start: '2026-08-29T09:00:00', end: '2026-08-29T10:30:00', label: 'Weekend morning' },
  { id: 'a11', start: '2026-08-30T14:00:00', end: '2026-08-30T17:00:00', label: 'Weekend afternoon' },
  { id: 'a12', start: '2026-08-31T16:00:00', end: '2026-08-31T18:00:00', label: 'Evening' },
  { id: 'a13', start: '2026-09-01T10:00:00', end: '2026-09-01T12:00:00', label: 'Morning' },
  { id: 'a14', start: '2026-09-02T15:00:00', end: '2026-09-02T17:00:00', label: 'Afternoon' },
];

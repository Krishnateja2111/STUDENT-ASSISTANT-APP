/**
 * Seed/fixture data standing in for a backend (Supabase/etc. — explicitly
 * undecided, see app-state.tsx). This is input data for the real scheduling
 * engine, not a stub of its output — lib/scheduling/ itself contains no
 * mock data or hardcoded results.
 *
 * This is Krishna's week: 4 courses, 8 real tasks spread across the coming
 * week plus one already-missed task (to demo recovery without extra setup),
 * and a Mon–Sun weekly availability rhythm — built and verified live via the
 * actual app UI (course creation, task creation with the visual date/time
 * picker, weekly availability), then adopted as the standing seed data.
 *
 * Every date is computed relative to the real moment this module loads (see
 * `daysFromNow` below), not hardcoded to a fixed calendar date — see the
 * earlier version's staleness problem: fixed dates silently drift into the
 * past as real time moves on, which the engine's horizon correctly excludes
 * (see computeHorizon/expandAvailability), so a stale fixed-date seed could
 * make a fresh install look unschedulable for no reason a new user could
 * see. Deriving everything from "now" keeps this a reasonable, honest
 * first-run demo no matter which day someone actually installs the app.
 */

import type { AvailabilityBlock, AvailabilityRule, Course, Task } from '@/lib/scheduling';

/** Local ISO datetime `days` from today (may be negative), at the given local hour:minute. */
function daysFromNow(days: number, hour: number, minute = 0): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
}

export const seedCourses: Course[] = [
  { id: 'c1', name: 'CS 401 – Machine Learning', colorTag: '#3C87F7' },
  { id: 'c2', name: 'MATH 301 – Statistics', colorTag: '#E0A93C' },
  { id: 'c3', name: 'ENG 150 – Technical Writing', colorTag: '#4CAF7D' },
  { id: 'c4', name: 'PHY 210 – Modern Physics', colorTag: '#B37FEB' },
];

export const seedTasks: Task[] = [
  {
    id: 't0',
    title: 'Homework 2',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: daysFromNow(-1, 23, 59),
    estimatedMinutes: 60,
    status: 'missed',
  },
  {
    id: 't1',
    title: 'Read Article for Discussion',
    courseId: 'c3',
    taskType: 'reading',
    dueDate: daysFromNow(0, 20, 0),
    estimatedMinutes: 30,
    status: 'pending',
  },
  {
    id: 't2',
    title: 'Read Ch. 5: Regression',
    courseId: 'c1',
    taskType: 'reading',
    dueDate: daysFromNow(1, 21, 0),
    estimatedMinutes: 45,
    status: 'pending',
  },
  {
    id: 't3',
    title: 'ML Assignment 3',
    courseId: 'c1',
    taskType: 'graded_assignment',
    dueDate: daysFromNow(2, 21, 0),
    estimatedMinutes: 120,
    status: 'pending',
  },
  {
    id: 't4',
    title: 'Stats Problem Set 2',
    courseId: 'c2',
    taskType: 'graded_assignment',
    dueDate: daysFromNow(3, 21, 0),
    estimatedMinutes: 90,
    status: 'pending',
  },
  {
    id: 't5',
    title: 'Essay Outline',
    courseId: 'c3',
    taskType: 'other',
    dueDate: daysFromNow(4, 21, 0),
    estimatedMinutes: 60,
    status: 'pending',
  },
  {
    id: 't6',
    title: 'Midterm Prep',
    courseId: 'c2',
    taskType: 'exam_prep',
    dueDate: daysFromNow(5, 18, 0),
    estimatedMinutes: 180,
    status: 'pending',
  },
  {
    id: 't7',
    title: 'Physics Lab Report',
    courseId: 'c4',
    taskType: 'graded_assignment',
    dueDate: daysFromNow(6, 20, 0),
    estimatedMinutes: 100,
    status: 'pending',
  },
  {
    id: 't8',
    title: 'Physics Exam Review',
    courseId: 'c4',
    taskType: 'exam_prep',
    dueDate: daysFromNow(6, 21, 0),
    estimatedMinutes: 150,
    status: 'pending',
  },
];

/**
 * Krishna's weekly rhythm — real recurring availability (Category 1, see
 * availabilityRules.ts), not a finite list of one-time entries. This was
 * originally seeded as 14 discrete dated blocks (two weeks' worth); the
 * problem with that: a one-time block is exactly that — once its day
 * passes, it's gone for good (correctly excluded from scheduling, see
 * expandAvailability's horizon-clipping), and nothing ever added more, so
 * a fresh install would silently run out of availability after two weeks.
 * A weekly RULE has no such expiry — "every Monday 6-8pm" keeps producing
 * a fresh instance every week, forever, which is what "recurring
 * availability" actually means and is what a real student setting up a
 * standing weekly schedule would expect.
 */
export const seedAvailabilityRules: AvailabilityRule[] = [
  { id: 'rule1', weekday: 1, startTime: '18:00', endTime: '20:00', label: 'Monday' },
  { id: 'rule2', weekday: 2, startTime: '14:00', endTime: '16:00', label: 'Tuesday' },
  { id: 'rule3', weekday: 3, startTime: '19:00', endTime: '21:00', label: 'Wednesday' },
  { id: 'rule4', weekday: 4, startTime: '10:00', endTime: '12:00', label: 'Thursday' },
  { id: 'rule5', weekday: 5, startTime: '15:00', endTime: '17:00', label: 'Friday' },
  { id: 'rule6', weekday: 6, startTime: '10:00', endTime: '13:00', label: 'Saturday' },
  { id: 'rule0', weekday: 0, startTime: '14:00', endTime: '17:00', label: 'Sunday' },
];

/** Category 4 (one-time extra availability) — none by default; Krishna's whole rhythm is the recurring rules above. */
export const seedAvailability: AvailabilityBlock[] = [];

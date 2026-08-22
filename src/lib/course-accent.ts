import { CourseAccentPalette, StatusColors } from '@/constants/theme';
import type { Course } from '@/lib/scheduling';

/** Resolves a course's accent color, falling back to a palette slot by list position. */
export function getCourseAccent(courseId: string | undefined, courses: Course[]): string {
  const index = courses.findIndex((c) => c.id === courseId);
  const course = courses[index];
  if (course?.colorTag) return course.colorTag;
  if (index < 0) return StatusColors.brand;
  return CourseAccentPalette[index % CourseAccentPalette.length] ?? StatusColors.brand;
}

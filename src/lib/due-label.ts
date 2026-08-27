import { StatusColors } from '@/constants/theme';
import { REFERENCE_NOW } from '@/lib/reference-date';

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** A short relative-day label + color for a due date, e.g. "Overdue" / "Due tomorrow" / "Due Aug 25". */
export function dueLabel(dueDateIso: string): { label: string; color: string } {
  const due = new Date(dueDateIso);
  const dayDiff = Math.round(
    (startOfDay(due).getTime() - startOfDay(REFERENCE_NOW).getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDiff < 0) return { label: 'Overdue', color: StatusColors.danger };
  if (dayDiff === 0) return { label: 'Due today', color: StatusColors.danger };
  if (dayDiff === 1) return { label: 'Due tomorrow', color: StatusColors.warning };
  if (dayDiff <= 6) return { label: `Due in ${dayDiff}d`, color: StatusColors.brand };
  return {
    label: `Due ${due.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
    color: StatusColors.brand,
  };
}

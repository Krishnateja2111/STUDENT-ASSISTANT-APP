import type { ScheduledBlock, Task } from '@/lib/scheduling';

/**
 * Web stand-in — Expo's local-notification scheduling isn't reliably
 * supported in a browser tab the way it is on a native build (no OS-level
 * scheduler to hand a future trigger to), and this app's web target is a
 * dev-testing surface, not a real delivery platform for this feature. Every
 * export mirrors notifications.ts's signature so callers need no platform
 * branching; permission is always reported as not granted, and syncing is a
 * safe no-op rather than silently pretending to schedule something that
 * will never fire.
 */

export const DEADLINE_REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;
export const DAILY_SUMMARY_HOUR = 8;

export async function getNotificationPermissionGranted(): Promise<boolean> {
  return false;
}

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function syncDeadlineReminders(_tasks: Task[], _enabled: boolean): Promise<void> {
  // no-op on web — see module doc comment
}

export async function syncDailySummary(_scheduledBlocks: ScheduledBlock[], _enabled: boolean): Promise<void> {
  // no-op on web — see module doc comment
}

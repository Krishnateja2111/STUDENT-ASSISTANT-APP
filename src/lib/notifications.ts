import * as Notifications from 'expo-notifications';

import { formatMinutes } from '@/lib/format-duration';
import { getNow } from '@/lib/reference-date';
import type { ScheduledBlock, Task } from '@/lib/scheduling';

/** Foreground behavior — without this, a notification fired while the app is open shows nothing at all. */
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Tags every notification this feature schedules, so syncDeadlineReminders can find and cancel exactly its own — never anything else (e.g. a future daily-recap notification). */
const DEADLINE_REMINDER_TYPE = 'deadline-reminder';

/** How long before a task's own deadline its one reminder fires. */
export const DEADLINE_REMINDER_LEAD_MS = 3 * 60 * 60 * 1000;

function formatDueTime(dueMs: number): string {
  const due = new Date(dueMs);
  const day = due.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = due.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} at ${time}`;
}

export async function getNotificationPermissionGranted(): Promise<boolean> {
  const { status } = await Notifications.getPermissionsAsync();
  return status === 'granted';
}

/** Prompts only if not already decided — re-requesting after a real denial just returns false again without re-prompting (standard OS behavior). */
export async function requestNotificationPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.status === 'granted') return true;
  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === 'granted';
}

/**
 * Cancels every deadline reminder this app previously scheduled (identified
 * by content.data.type — querying the OS's own pending list rather than
 * tracking identifiers ourselves means this can never drift out of sync with
 * what's actually still scheduled) and, if enabled, schedules a fresh one
 * per eligible task. Safe to call on every relevant change (task added,
 * edited, completed, deleted; the preference toggled) — local-only and
 * cheap, no network involved.
 *
 * One reminder per task, fired DEADLINE_REMINDER_LEAD_MS before its own
 * dueDate — never a scheduled study block's start time, which is a
 * different (and for an overflowed task, sometimes nonexistent) concept.
 * A task already completed or missed, or whose reminder time has already
 * passed, is silently skipped rather than firing something stale.
 */
export async function syncDeadlineReminders(tasks: Task[], enabled: boolean): Promise<void> {
  const alreadyScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = alreadyScheduled.filter((n) => n.content.data?.type === DEADLINE_REMINDER_TYPE);
  await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  if (!enabled) return;
  if (!(await getNotificationPermissionGranted())) return;

  const nowMs = getNow().getTime();
  for (const task of tasks) {
    if (task.status === 'completed' || task.status === 'missed') continue;
    const dueMs = new Date(task.dueDate).getTime();
    const triggerMs = dueMs - DEADLINE_REMINDER_LEAD_MS;
    if (triggerMs <= nowMs) continue;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Deadline coming up',
        body: `${task.title} is due ${formatDueTime(dueMs)}`,
        data: { type: DEADLINE_REMINDER_TYPE, taskId: task.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(triggerMs),
      },
    });
  }
}

const DAILY_SUMMARY_TYPE = 'daily-summary';

/** The local hour the morning recap fires at. */
export const DAILY_SUMMARY_HOUR = 8;

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** The next upcoming DAILY_SUMMARY_HOUR:00 — today's, if it hasn't happened yet, otherwise tomorrow's. */
function nextSummaryTriggerMs(nowMs: number): number {
  const d = new Date(nowMs);
  d.setHours(DAILY_SUMMARY_HOUR, 0, 0, 0);
  if (d.getTime() <= nowMs) d.setDate(d.getDate() + 1);
  return d.getTime();
}

function summaryBody(blockCount: number, plannedMinutes: number): string {
  if (blockCount === 0) return "Nothing's scheduled today — a good day to get ahead on something.";
  return `${blockCount} ${blockCount === 1 ? 'task' : 'tasks'} planned today, ${formatMinutes(plannedMinutes)} total.`;
}

/**
 * Schedules ONE notification for the next upcoming 8am, describing THAT
 * day's actual plan — deliberately not a true repeating daily trigger.
 * expo-notifications fixes a notification's content at schedule time; a
 * genuinely repeating trigger would fire the same "N tasks today" text every
 * morning regardless of what's actually scheduled, going stale the moment
 * anything changes. Re-syncing (cancel + reschedule, same pattern as
 * syncDeadlineReminders) on every relevant change AND on app foreground (see
 * _layout.tsx's NotificationSync) keeps this accurate for as long as the
 * student opens the app at least once between recaps. The honest tradeoff:
 * go several days without opening the app at all, and the recaps stop
 * rather than quietly showing yesterday's numbers.
 */
export async function syncDailySummary(scheduledBlocks: ScheduledBlock[], enabled: boolean): Promise<void> {
  const alreadyScheduled = await Notifications.getAllScheduledNotificationsAsync();
  const ours = alreadyScheduled.filter((n) => n.content.data?.type === DAILY_SUMMARY_TYPE);
  await Promise.all(ours.map((n) => Notifications.cancelScheduledNotificationAsync(n.identifier)));

  if (!enabled) return;
  if (!(await getNotificationPermissionGranted())) return;

  const nowMs = getNow().getTime();
  const triggerMs = nextSummaryTriggerMs(nowMs);
  const targetDayKey = dayKeyOf(new Date(triggerMs));

  const targetBlocks = scheduledBlocks.filter((b) => b.start.startsWith(targetDayKey));
  const plannedMinutes = targetBlocks.reduce(
    (sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000,
    0
  );

  await Notifications.scheduleNotificationAsync({
    content: {
      title: "Today's plan",
      body: summaryBody(targetBlocks.length, plannedMinutes),
      data: { type: DAILY_SUMMARY_TYPE },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(triggerMs),
    },
  });
}

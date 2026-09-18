import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { NavMenu } from '@/components/nav-menu';
import { ProgressBar } from '@/components/progress-bar';
import { ScheduledTaskCard } from '@/components/scheduled-task-card';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { IconColors, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatMinutes } from '@/lib/format-duration';
import { getNow, getToday } from '@/lib/reference-date';
import type { HealthStatus, ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

const HEALTH_META: Record<HealthStatus, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  green: { color: StatusColors.success, icon: 'checkmark-circle', label: 'On track' },
  yellow: { color: StatusColors.warning, icon: 'alert-circle', label: 'Getting tight' },
  red: { color: StatusColors.danger, icon: 'warning', label: 'Overloaded' },
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDayHeading(dateStr: string) {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatCountdown(fromMs: number, toIso: string): string {
  const diffMinutes = Math.round((new Date(toIso).getTime() - fromMs) / 60_000);
  if (diffMinutes <= 0) return 'Now';
  if (diffMinutes < 60) return `In ${diffMinutes}m`;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;
  return minutes === 0 ? `In ${hours}h` : `In ${hours}h ${minutes}m`;
}

function greeting(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

export default function DashboardScreen() {
  const {
    tasks,
    courses,
    scheduledBlocks,
    effectiveAvailability,
    health,
    nearTermWorkload,
    markTaskCompleted,
    reopenTask,
    rescheduleTask,
    lastAcceptedChange,
  } = useAppState();
  const { profile } = useContentState();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [dismissedNudgeTaskId, setDismissedNudgeTaskId] = useState<string | null>(null);
  const [showNavMenu, setShowNavMenu] = useState(false);
  const TODAY = getToday();
  const NOW = getNow();

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const courseAccent = (courseId: string) => getCourseAccent(courseId, courses);
  const taskForBlock = (block: ScheduledBlock) => tasks.find((t) => t.id === block.taskId);

  const todaysBlocks = scheduledBlocks
    .filter((b) => b.start.startsWith(TODAY))
    .sort((a, b) => a.start.localeCompare(b.start));

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  // Phase 3G — a task only counts as "scheduled" if it actually has a
  // ScheduledBlock, never merely because it exists in `tasks` (see the
  // Phase 3G audit's core distinction). Missed tasks are deliberately
  // excluded from "unscheduled work" — they already have their own,
  // more specific banner below, and shouldn't also show up as generic
  // "still needs scheduling" noise.
  const scheduledTaskIds = new Set(scheduledBlocks.map((b) => b.taskId));
  const unscheduledPendingTasks = tasks.filter((t) => t.status === 'pending' && !scheduledTaskIds.has(t.id));
  // health.suggestedDeferrals can include a missed task (getScheduleHealth's
  // own "active" set is status !== 'completed', which includes 'missed') —
  // but a missed task already has its own dedicated recovery banner, so it's
  // filtered out here rather than also surfacing in the generic nudge below.
  const needsInputTask = health.suggestedDeferrals.find((t) => t.status !== 'missed');
  const healthMeta = HEALTH_META[health.status];

  const plannedMinutes = todaysBlocks.reduce(
    (sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000,
    0
  );
  // What the engine actually considers available today — the real,
  // horizon-clipped effective availability (see app-state.tsx), not the raw
  // one-time blocks Settings edits directly. Shown alongside "Planned" so
  // it's obvious at a glance whether today's plan is using the time that's
  // really there, or whether there's room left over.
  const availableMinutesToday = effectiveAvailability
    .filter((b) => b.start.startsWith(TODAY))
    .reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000, 0);
  const completedToday = todaysBlocks.filter((b) => taskForBlock(b)?.status === 'completed').length;
  const todayProgressPct = todaysBlocks.length > 0 ? (completedToday / todaysBlocks.length) * 100 : 0;
  // What's left to actually do today — completed work no longer competes
  // for today's availability, so the "does this fit" comparison below uses
  // this instead of the raw planned total: marking a task complete should
  // visibly move this number, not leave an unchanging warning in place.
  const remainingMinutesToday = todaysBlocks
    .filter((b) => taskForBlock(b)?.status !== 'completed')
    .reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000, 0);

  // Bug fix: this used to be a pure time filter (block.end > now), so a task
  // completed early via the "Complete" button in Today's Plan kept showing
  // here — unchanged, still counting down — until its original scheduled
  // end time finally passed. "Next up" is meant to answer "what should I do
  // next," which a completed task never is, regardless of its clock time.
  const nextBlock = todaysBlocks.find(
    (b) => new Date(b.end).getTime() > NOW.getTime() && taskForBlock(b)?.status !== 'completed'
  );
  const nextTask = nextBlock ? taskForBlock(nextBlock) : undefined;

  const handleMarkMissed = (taskId: string) => {
    router.push(`/recovery/${taskId}`);
  };

  return (
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
      <ScreenHeader
        title={`${greeting(NOW.getHours())}, ${profile.name.split(' ')[0]}`}
        subtitle={formatDayHeading(TODAY)}
        onMenuPress={() => setShowNavMenu(true)}
        right={
          <>
            <Pressable
              onPress={() => router.push('/notifications')}
              hitSlop={8}
              style={styles.iconButton}
              accessibilityRole="button"
              accessibilityLabel="Notifications">
              <Ionicons name="notifications" size={22} color={IconColors.pumpkin} />
              {missedTasks.length > 0 && <View style={[styles.badgeDot, { borderColor: theme.background }]} />}
            </Pressable>
            <Pressable
              onPress={() => router.push('/(tabs)/profile')}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Open profile">
              <Avatar name={profile.name} size={36} />
            </Pressable>
          </>
        }
      />

      {/*
        Phase 3G fix: "today's workload" and "overall workload outlook" used
        to be crammed into one card, which is exactly why removing every
        scheduled block for today could still show "Overloaded" — that
        badge was never actually about today, it's getScheduleHealth's
        all-active-tasks-vs-total-availability feasibility read (unchanged,
        protected file, correct on its own terms). Splitting them into two
        clearly-labeled cards fixes the semantic mismatch without touching
        or hiding that underlying calculation.
      */}
      {todaysBlocks.length > 0 && (
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryStat}>
              <ThemedText type="keyNumber">{formatMinutes(plannedMinutes)}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Planned
              </ThemedText>
            </View>
            <View style={styles.summaryStat}>
              <ThemedText type="keyNumber">{todaysBlocks.length}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {todaysBlocks.length === 1 ? 'Task' : 'Tasks'}
              </ThemedText>
            </View>
            <View style={styles.summaryStat}>
              <ThemedText type="keyNumber">{formatMinutes(availableMinutesToday)}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Available
              </ThemedText>
            </View>
          </View>
          <ProgressBar value={todayProgressPct} color={StatusColors.success} style={styles.summaryProgress} />
          {/* Remaining can legitimately exceed available if a commitment /
              unavailable period was added after today's plan was set
              (nothing auto-repacks on its own) — this surfaces it. */}
          {remainingMinutesToday > availableMinutesToday && (
            <ThemedText type="small" style={styles.overbookedNote}>
              Today&apos;s plan runs over your free time.
            </ThemedText>
          )}
        </Card>
      )}

      {/*
        Bug fix: this used to be a single vague banner that opened the
        blank "New Task" creation form on tap -- unrelated to what it
        claimed ("N tasks still need scheduling"), and confusing for
        exactly that reason (reported live: it read as a form for
        creating a new task, not a way to see which existing tasks need
        attention). It now lists the actual unscheduled tasks, each
        opening its own Task Detail (real course, type, duration, and an
        Edit action to actually help it get scheduled).
      */}
      {unscheduledPendingTasks.length > 0 && (
        <View style={styles.section}>
          <SectionHeader
            title={`${unscheduledPendingTasks.length} task${unscheduledPendingTasks.length > 1 ? 's' : ''} to schedule`}
          />
          {unscheduledPendingTasks.map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}`)}>
              <Card accentColor={courseAccent(task.courseId)} style={styles.unscheduledCard}>
                <Ionicons name="calendar-clear-outline" size={18} color={theme.textSecondary} />
                <View style={styles.unscheduledText}>
                  <ThemedText type="cardTitle">{task.title}</ThemedText>
                  <ThemedText type="meta" themeColor="textMuted">
                    {courseName(task.courseId)}
                  </ThemedText>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <View style={styles.section}>
        <SectionHeader title="Workload outlook" />
        <Card accentColor={healthMeta.color} style={styles.workloadCard}>
          <View style={styles.summaryHealthRow}>
            <Ionicons name={healthMeta.icon} size={16} color={healthMeta.color} />
            <ThemedText type="cardTitle" style={{ color: healthMeta.color }}>
              {healthMeta.label}
            </ThemedText>
          </View>
          {/* Trimmed to one line. The red/yellow/green label above is
              getScheduleHealth's own whole-horizon feasibility read
              (protected, authoritative); these numbers are the same
              tasks/effectiveAvailability data, summed — from nearTermWorkload
              in app-state.tsx, not the protected file's misleading
              "before X" sentence. */}
          {nearTermWorkload && (
            <ThemedText type="meta" themeColor="textSecondary">
              {formatMinutes(nearTermWorkload.neededMinutesTotal)} to do ·{' '}
              {formatMinutes(nearTermWorkload.availableMinutesTotal)} available
            </ThemedText>
          )}
          {health.suggestedDeferrals[0] && (health.status === 'red' || health.status === 'yellow') && (
            <ThemedText type="small" themeColor="textMuted">
              Could defer: {health.suggestedDeferrals[0].title}
            </ThemedText>
          )}
        </Card>
      </View>

      {nextTask && nextBlock && (
        <View style={styles.section}>
          <SectionHeader title="Next up" />
          <Pressable onPress={() => router.push(`/task/${nextTask.id}`)}>
          <Card accentColor={courseAccent(nextTask.courseId)} style={styles.nextUpCard}>
            <View style={styles.nextUpMain}>
              <ThemedText type="meta" themeColor="textSecondary">
                {formatTime(nextBlock.start)}
              </ThemedText>
              <ThemedText type="cardTitle">{nextTask.title}</ThemedText>
              <ThemedText type="meta" themeColor="textMuted">
                {courseName(nextTask.courseId)} · {formatMinutes((new Date(nextBlock.end).getTime() - new Date(nextBlock.start).getTime()) / 60_000)}
              </ThemedText>
            </View>
            <StatusBadge label={formatCountdown(NOW.getTime(), nextBlock.start)} color={StatusColors.brand} />
          </Card>
          </Pressable>
        </View>
      )}

      {missedTasks.length > 0 && (
        <Pressable onPress={() => router.push(`/recovery/${missedTasks[0].id}`)}>
          <Card style={styles.missedCard}>
            <Ionicons name="alert-circle-outline" size={20} color={StatusColors.danger} />
            <View style={styles.missedTextGroup}>
              <ThemedText type="cardTitle">
                {missedTasks.length} task{missedTasks.length > 1 ? 's' : ''} missed
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {missedTasks[0].title}
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Card>
        </Pressable>
      )}

      <View style={styles.section}>
        <SectionHeader title="Today's plan" />
        {todaysBlocks.length === 0 && (
          <ThemedText themeColor="textSecondary">Nothing scheduled for today.</ThemedText>
        )}
        {todaysBlocks.map((block) => {
          const task = taskForBlock(block);
          if (!task) return null;
          const isActive = task.status !== 'missed' && task.status !== 'completed';
          // Bug fix (per product decision): "Missed" is a backward-looking
          // claim -- you can't have missed something that hasn't happened
          // yet -- but nothing previously stopped tapping it on a task
          // scheduled hours or days from now. That's also what let a missed
          // task get rescheduled right back into its own still-upcoming,
          // still-untouched slot (see rescheduleAfterMiss.ts's own fix): the
          // engine now excludes that slot regardless, but the real fix is
          // this button shouldn't have been available before the time
          // actually passed in the first place. "Complete" stays available
          // early on purpose -- finishing something ahead of schedule is a
          // real, legitimate action; claiming to have missed it isn't.
          const canMarkMissed = isActive && new Date(block.end).getTime() <= NOW.getTime();
          return (
            <ScheduledTaskCard
              key={block.id}
              time={`${formatTime(block.start)} – ${formatTime(block.end)}`}
              title={task.title}
              courseName={courseName(task.courseId)}
              accentColor={courseAccent(task.courseId)}
              onPress={() => router.push(`/task/${task.id}`)}
              trailing={
                isActive ? (
                  <View style={styles.taskActions}>
                    <Button
                      label="Complete"
                      variant="outlined"
                      color={StatusColors.success}
                      onPress={() => markTaskCompleted(task.id)}
                      style={styles.actionButton}
                    />
                    {canMarkMissed ? (
                      <Button
                        label="Missed"
                        variant="outlined"
                        color={StatusColors.danger}
                        onPress={() => handleMarkMissed(task.id)}
                        style={styles.actionButton}
                      />
                    ) : (
                      <Button
                        label="Reschedule"
                        variant="outlined"
                        onPress={() => {
                          rescheduleTask(task.id);
                          router.push('/reschedule');
                        }}
                        style={styles.actionButton}
                      />
                    )}
                  </View>
                ) : task.status === 'completed' ? (
                  <View style={styles.taskActions}>
                    <StatusBadge label="Completed" color={StatusColors.success} />
                    <Button
                      label="Reopen"
                      variant="outlined"
                      onPress={() => reopenTask(task.id)}
                      style={styles.actionButton}
                    />
                  </View>
                ) : (
                  <StatusBadge label="Missed" color={StatusColors.danger} />
                )
              }
            />
          );
        })}
      </View>

      {lastAcceptedChange && (
        <Pressable onPress={() => router.push('/(tabs)/calendar')}>
          <Card style={styles.adjustedCard}>
            <Ionicons name="refresh-circle-outline" size={18} color={StatusColors.brand} />
            <ThemedText type="meta" themeColor="textSecondary" style={styles.adjustedText}>
              <ThemedText type="smallBold">{lastAcceptedChange.taskTitle}</ThemedText> was moved to{' '}
              {formatTime(lastAcceptedChange.newBlock.start)}
            </ThemedText>
            <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
          </Card>
        </Pressable>
      )}

      {needsInputTask && needsInputTask.id !== dismissedNudgeTaskId && (() => {
        // Phase 3G fix: this card must never claim a task "still fits" or
        // send the student to Calendar unless it's actually scheduled —
        // health.suggestedDeferrals is the lowest-priority ACTIVE task,
        // scheduled or not (see the Phase 3G audit).
        //
        // Follow-up fix: the scheduled branch used to send the student to
        // the generic Calendar tab, which opens on TODAY — if this task
        // isn't scheduled today, there's nothing there to find, a dead end.
        // Task Detail (built this phase) always shows exactly when this
        // task is scheduled, real actions included, regardless of which
        // day that is — so both branches go there now.
        //
        // Dismiss: this card is a standing "if you need to cut something,
        // this is the first candidate" indicator, not a one-time todo — a
        // task can legitimately keep being the genuine lowest-priority item
        // (a short reading task nearly always will be) even right after
        // you've already reviewed or rescheduled it, which read as "nagging
        // about the same thing" rather than new information. Dismiss
        // acknowledges THIS specific nomination for the rest of the
        // session; it comes back the moment a DIFFERENT task becomes the
        // lowest-priority one, so it never hides genuinely new information.
        const isScheduled = scheduledTaskIds.has(needsInputTask.id);
        return (
          <Card accentColor={StatusColors.brand} style={styles.nudgeCard}>
            <View style={styles.nudgeHeader}>
              <Ionicons name="sparkles-outline" size={20} color={StatusColors.brand} />
              <ThemedText type="cardTitle">Needs your input</ThemedText>
            </View>
            <ThemedText type="meta" themeColor="textSecondary">
              {needsInputTask.title} — lowest priority right now
              {isScheduled ? '' : ', not scheduled yet'}
            </ThemedText>
            <View style={styles.nudgeActions}>
              <Button
                label="Review task"
                variant="outlined"
                onPress={() => router.push(`/task/${needsInputTask.id}`)}
                style={styles.nudgeButton}
              />
              <Button
                label="Dismiss"
                variant="outlined"
                onPress={() => setDismissedNudgeTaskId(needsInputTask.id)}
                style={styles.nudgeButton}
              />
            </View>
          </Card>
        );
      })()}

      <Button
        label="+ Add task"
        variant="outlined"
        onPress={() => router.push('/task-entry')}
        style={styles.addButton}
      />

      <NavMenu visible={showNavMenu} onClose={() => setShowNavMenu(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  iconButton: {
    padding: 2,
  },
  badgeDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 1.5,
    backgroundColor: StatusColors.danger,
  },
  summaryCard: {
    gap: Spacing.three,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryStat: {
    flex: 1,
    gap: 2,
  },
  summaryHealthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  summaryProgress: {
    marginTop: 2,
  },
  overbookedNote: {
    color: StatusColors.warning,
  },
  unscheduledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  unscheduledText: {
    flex: 1,
  },
  workloadCard: {
    gap: Spacing.one,
  },
  section: {
    gap: Spacing.two,
  },
  nextUpCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nextUpMain: {
    flex: 1,
    gap: 2,
  },
  missedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  missedTextGroup: {
    flex: 1,
    gap: 2,
  },
  taskActions: {
    gap: Spacing.one,
    alignItems: 'flex-end',
  },
  actionButton: {
    paddingHorizontal: Spacing.three,
  },
  adjustedCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  adjustedText: {
    flex: 1,
  },
  nudgeCard: {
    gap: Spacing.two,
  },
  nudgeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  nudgeActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  nudgeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  addButton: {
    marginTop: Spacing.one,
  },
});

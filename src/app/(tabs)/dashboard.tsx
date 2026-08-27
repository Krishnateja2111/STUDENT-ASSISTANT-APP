import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ProgressBar } from '@/components/progress-bar';
import { ScheduledTaskCard } from '@/components/scheduled-task-card';
import { ScreenHeader } from '@/components/screen-header';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatMinutes } from '@/lib/format-duration';
import { REFERENCE_NOW, REFERENCE_TODAY } from '@/lib/reference-date';
import type { HealthStatus, ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

const HEALTH_META: Record<HealthStatus, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  green: { color: StatusColors.success, icon: 'checkmark-circle', label: 'On track' },
  yellow: { color: StatusColors.warning, icon: 'alert-circle', label: 'Getting tight' },
  red: { color: StatusColors.danger, icon: 'warning', label: 'Overloaded' },
};

const TODAY = REFERENCE_TODAY;
const NOW = REFERENCE_NOW;

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
  const { tasks, courses, scheduledBlocks, health, markMissed, lastAcceptedChange } = useAppState();
  const { profile } = useContentState();
  const theme = useTheme();

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const courseAccent = (courseId: string) => getCourseAccent(courseId, courses);
  const taskForBlock = (block: ScheduledBlock) => tasks.find((t) => t.id === block.taskId);

  const todaysBlocks = scheduledBlocks
    .filter((b) => b.start.startsWith(TODAY))
    .sort((a, b) => a.start.localeCompare(b.start));

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const needsInputTask = health.suggestedDeferrals[0];
  const healthMeta = HEALTH_META[health.status];

  const plannedMinutes = todaysBlocks.reduce(
    (sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000,
    0
  );
  const completedToday = todaysBlocks.filter((b) => taskForBlock(b)?.status === 'completed').length;
  const todayProgressPct = todaysBlocks.length > 0 ? (completedToday / todaysBlocks.length) * 100 : 0;

  const nextBlock = todaysBlocks.find((b) => new Date(b.end).getTime() > NOW.getTime());
  const nextTask = nextBlock ? taskForBlock(nextBlock) : undefined;

  const handleMarkMissed = (taskId: string) => {
    markMissed(taskId);
    router.push('/reschedule');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        title={`${greeting(NOW.getHours())}, ${profile.name.split(' ')[0]}`}
        subtitle={formatDayHeading(TODAY)}
        right={
          <>
            <Pressable onPress={() => router.push('/settings')} hitSlop={8} style={styles.iconButton}>
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {missedTasks.length > 0 && <View style={[styles.badgeDot, { borderColor: theme.background }]} />}
            </Pressable>
            <Pressable onPress={() => router.push('/(tabs)/profile')} hitSlop={4}>
              <Avatar name={profile.name} size={36} />
            </Pressable>
          </>
        }
      />

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
              Tasks
            </ThemedText>
          </View>
          <View style={styles.summaryStat}>
            <View style={styles.summaryHealthRow}>
              <Ionicons name={healthMeta.icon} size={16} color={healthMeta.color} />
              <ThemedText type="cardTitle" style={{ color: healthMeta.color }}>
                {healthMeta.label}
              </ThemedText>
            </View>
            <ThemedText type="meta" themeColor="textSecondary">
              Schedule health
            </ThemedText>
          </View>
        </View>
        {todaysBlocks.length > 0 && (
          <ProgressBar value={todayProgressPct} color={StatusColors.success} style={styles.summaryProgress} />
        )}
      </Card>

      {nextTask && nextBlock && (
        <View style={styles.section}>
          <SectionHeader title="Next up" />
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
        </View>
      )}

      {missedTasks.length > 0 && (
        <Pressable
          onPress={() => {
            markMissed(missedTasks[0].id);
            router.push('/reschedule');
          }}>
          <Card style={styles.missedCard}>
            <Ionicons name="alert-circle-outline" size={20} color={StatusColors.danger} />
            <View style={styles.missedTextGroup}>
              <ThemedText type="cardTitle">
                {missedTasks.length} task{missedTasks.length > 1 ? 's' : ''} missed
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {missedTasks[0].title} — tap to see the updated schedule
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
          const canMarkMissed = task.status !== 'missed' && task.status !== 'completed';
          return (
            <ScheduledTaskCard
              key={block.id}
              time={`${formatTime(block.start)} – ${formatTime(block.end)}`}
              title={task.title}
              courseName={courseName(task.courseId)}
              accentColor={courseAccent(task.courseId)}
              trailing={
                canMarkMissed ? (
                  <Button
                    label="Missed"
                    variant="outlined"
                    color={StatusColors.danger}
                    onPress={() => handleMarkMissed(task.id)}
                    style={styles.missedButton}
                  />
                ) : (
                  <StatusBadge
                    label={task.status === 'completed' ? 'Completed' : 'Missed'}
                    color={task.status === 'completed' ? StatusColors.success : StatusColors.danger}
                  />
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

      {needsInputTask && (
        <Card accentColor={StatusColors.brand} style={styles.nudgeCard}>
          <View style={styles.nudgeHeader}>
            <Ionicons name="sparkles-outline" size={20} color={StatusColors.brand} />
            <ThemedText type="cardTitle">Needs your input</ThemedText>
          </View>
          <ThemedText type="meta" themeColor="textSecondary">
            {needsInputTask.title} is your lowest-priority item this week — it still fits, but review it
            if your plans change.
          </ThemedText>
          <Button
            label="Review in Calendar"
            variant="outlined"
            onPress={() => router.push('/(tabs)/calendar')}
            style={styles.nudgeButton}
          />
        </Card>
      )}

      <Button
        label="+ Add task"
        variant="outlined"
        onPress={() => router.push('/task-entry')}
        style={styles.addButton}
      />
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
  missedButton: {
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
  nudgeButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.three,
  },
  addButton: {
    marginTop: Spacing.one,
  },
});

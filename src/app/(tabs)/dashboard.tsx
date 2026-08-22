import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { HealthStatus, ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const HEALTH_COLOR: Record<HealthStatus, string> = {
  green: '#4CAF7D',
  yellow: '#E0A93C',
  red: '#E0524A',
};

const TODAY = '2026-08-21';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DashboardScreen() {
  const { tasks, courses, scheduledBlocks, health, markMissed } = useAppState();

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';

  const todaysBlocks = scheduledBlocks
    .filter((b) => b.start.startsWith(TODAY))
    .sort((a, b) => a.start.localeCompare(b.start));

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const needsInputTask = health.suggestedDeferrals[0];

  const taskForBlock = (block: ScheduledBlock) => tasks.find((t) => t.id === block.taskId);

  const handleMarkMissed = (taskId: string) => {
    markMissed(taskId);
    router.push('/reschedule');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>
        Today
      </ThemedText>

      <ThemedView style={[styles.healthBadge, { backgroundColor: HEALTH_COLOR[health.status] }]}>
        <ThemedText style={styles.healthBadgeText}>{health.status.toUpperCase()}</ThemedText>
        <ThemedText style={styles.healthBadgeText}>{health.message}</ThemedText>
      </ThemedView>

      {missedTasks.length > 0 && (
        <Pressable
          style={styles.missedCard}
          onPress={() => {
            markMissed(missedTasks[0].id);
            router.push('/reschedule');
          }}>
          <ThemedText type="smallBold" themeColor="text">
            {missedTasks.length} task{missedTasks.length > 1 ? 's' : ''} missed
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {missedTasks[0].title} — tap to see the updated schedule
          </ThemedText>
        </Pressable>
      )}

      <ThemedText type="subtitle" style={styles.sectionTitle}>
        Today&apos;s plan
      </ThemedText>
      {todaysBlocks.length === 0 && (
        <ThemedText themeColor="textSecondary">Nothing scheduled for today.</ThemedText>
      )}
      {todaysBlocks.map((block) => {
        const task = taskForBlock(block);
        if (!task) return null;
        return (
          <ThemedView key={block.id} type="backgroundElement" style={styles.taskRow}>
            <ThemedView style={styles.taskRowMain}>
              <ThemedText type="smallBold">
                {formatTime(block.start)} – {formatTime(block.end)}
              </ThemedText>
              <ThemedText type="default">{task.title}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {courseName(task.courseId)}
              </ThemedText>
            </ThemedView>
            {task.status !== 'missed' && task.status !== 'completed' && (
              <Pressable onPress={() => handleMarkMissed(task.id)} style={styles.markMissedButton}>
                <ThemedText type="small" themeColor="textSecondary">
                  Mark missed
                </ThemedText>
              </Pressable>
            )}
          </ThemedView>
        );
      })}

      {needsInputTask && (
        <ThemedView type="backgroundElement" style={styles.nudgeCard}>
          <ThemedText type="smallBold">Needs your input</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {needsInputTask.title} is your lowest-priority item this week — it still fits, but review it
            if your plans change.
          </ThemedText>
          <Pressable onPress={() => router.push('/(tabs)/calendar')}>
            <ThemedText type="link" themeColor="text">
              Review in Calendar
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      <Pressable style={styles.addButton} onPress={() => router.push('/task-entry')}>
        <ThemedText style={styles.addButtonText}>+ Add task</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  healthBadge: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  healthBadgeText: {
    color: '#ffffff',
  },
  missedCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    backgroundColor: '#FBE4E2',
    gap: Spacing.half,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    marginTop: Spacing.two,
  },
  taskRow: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskRowMain: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  markMissedButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  nudgeCard: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  addButton: {
    backgroundColor: '#3C87F7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  addButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

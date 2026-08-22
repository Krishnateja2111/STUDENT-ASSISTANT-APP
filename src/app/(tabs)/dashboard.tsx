import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StatusColors } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import type { HealthStatus, ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const HEALTH_META: Record<HealthStatus, { color: string; icon: keyof typeof Ionicons.glyphMap; label: string }> = {
  green: { color: StatusColors.success, icon: 'checkmark-circle', label: 'On track' },
  yellow: { color: StatusColors.warning, icon: 'alert-circle', label: 'Getting tight' },
  red: { color: StatusColors.danger, icon: 'warning', label: 'Overloaded' },
};

const TODAY = '2026-08-21';

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function DashboardScreen() {
  const { tasks, courses, scheduledBlocks, health, markMissed } = useAppState();

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const courseAccent = (courseId: string) => getCourseAccent(courseId, courses);

  const todaysBlocks = scheduledBlocks
    .filter((b) => b.start.startsWith(TODAY))
    .sort((a, b) => a.start.localeCompare(b.start));

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const needsInputTask = health.suggestedDeferrals[0];
  const healthMeta = HEALTH_META[health.status];

  const taskForBlock = (block: ScheduledBlock) => tasks.find((t) => t.id === block.taskId);

  const handleMarkMissed = (taskId: string) => {
    markMissed(taskId);
    router.push('/reschedule');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="screenTitle">Today</ThemedText>

      <Card accentColor={healthMeta.color} style={styles.healthCard}>
        <Ionicons name={healthMeta.icon} size={22} color={healthMeta.color} />
        <ThemedView style={styles.healthTextGroup}>
          <ThemedText type="cardTitle">{healthMeta.label}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            {health.message}
          </ThemedText>
        </ThemedView>
      </Card>

      {missedTasks.length > 0 && (
        <Pressable
          onPress={() => {
            markMissed(missedTasks[0].id);
            router.push('/reschedule');
          }}>
          <Card accentColor={StatusColors.danger} style={styles.missedCard}>
            <Ionicons name="alert-circle" size={22} color={StatusColors.danger} />
            <ThemedView style={styles.healthTextGroup}>
              <ThemedText type="cardTitle">
                {missedTasks.length} task{missedTasks.length > 1 ? 's' : ''} missed
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {missedTasks[0].title} — tap to see the updated schedule
              </ThemedText>
            </ThemedView>
          </Card>
        </Pressable>
      )}

      <ThemedText type="sectionTitle" style={styles.sectionSpacing}>
        Today&apos;s plan
      </ThemedText>
      {todaysBlocks.length === 0 && (
        <ThemedText themeColor="textSecondary">Nothing scheduled for today.</ThemedText>
      )}
      {todaysBlocks.map((block) => {
        const task = taskForBlock(block);
        if (!task) return null;
        return (
          <Card key={block.id} accentColor={courseAccent(task.courseId)} style={styles.taskCard}>
            <ThemedView style={styles.taskCardMain}>
              <ThemedText type="meta" themeColor="textSecondary">
                {formatTime(block.start)} – {formatTime(block.end)}
              </ThemedText>
              <ThemedText type="cardTitle">{task.title}</ThemedText>
              <ThemedText type="meta" themeColor="textMuted">
                {courseName(task.courseId)}
              </ThemedText>
            </ThemedView>
            {task.status !== 'missed' && task.status !== 'completed' && (
              <Button
                label="Missed"
                variant="outlined"
                color={StatusColors.danger}
                onPress={() => handleMarkMissed(task.id)}
                style={styles.missedButton}
              />
            )}
          </Card>
        );
      })}

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

      <Button label="+ Add task" onPress={() => router.push('/task-entry')} style={styles.addButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  healthCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  missedCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  healthTextGroup: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  sectionSpacing: {
    marginTop: Spacing.two,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskCardMain: {
    flex: 1,
    gap: 2,
    backgroundColor: 'transparent',
  },
  missedButton: {
    paddingHorizontal: Spacing.three,
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
    marginTop: Spacing.two,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { dueLabel } from '@/lib/due-label';
import { formatMinutes } from '@/lib/format-duration';
import { getNow } from '@/lib/reference-date';
import { TASK_TYPE_LABEL } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

function formatBlockDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function formatBlockTimeRange(startIso: string, endIso: string) {
  const start = new Date(startIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const end = new Date(endIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${start} – ${end}`;
}

function formatDueDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Task Detail — a read-focused view of a single task (master spec §"Task
 * Detail"). task-entry.tsx stays the create/edit form; this screen is what
 * every other screen's "open this task" action should point at, and it's
 * the one place actions are offered strictly according to the task's real
 * state — never a status the task isn't actually in.
 */
export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, courses, scheduledBlocks, markTaskCompleted, reopenTask, rescheduleTask } = useAppState();
  const theme = useTheme();

  const task = tasks.find((t) => t.id === id);

  if (!task) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: 'Task' }} />
        <EmptyState icon="alert-circle-outline" message="This task couldn't be found — it may have been deleted." />
      </ScrollView>
    );
  }

  const course = courses.find((c) => c.id === task.courseId);
  const accent = getCourseAccent(task.courseId, courses);
  const blocks = scheduledBlocks
    .filter((b) => b.taskId === task.id)
    .sort((a, b) => a.start.localeCompare(b.start));
  const isScheduled = blocks.length > 0;
  // Bug fix (per product decision): "Missed" claims something already
  // happened and didn't -- it shouldn't be tappable on a task whose
  // scheduled time hasn't arrived yet (see the same fix on Dashboard's
  // Today's Plan, and the underlying rescheduleAfterMiss.ts fix this
  // motivated). Uses the LATEST block's end in case the task is split
  // across more than one piece -- the task's scheduled time isn't over
  // until all of them are.
  const canMarkMissed =
    isScheduled && Math.max(...blocks.map((b) => new Date(b.end).getTime())) <= getNow().getTime();
  const due = dueLabel(task.dueDate);
  const dependencies = (task.dependsOn ?? [])
    .map((depId) => tasks.find((t) => t.id === depId))
    .filter((t): t is NonNullable<typeof t> => Boolean(t));

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          // Explicit back control — the bare default arrow was reported
          // missing/unclear; this matches the "Done" pattern used on the
          // app's other pushed detail/settings screens, with the same
          // no-history fallback.
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/courses'))}
              hitSlop={8}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          ),
          headerRight: () => (
            <Pressable
              onPress={() => router.push(`/task-entry?id=${task.id}`)}
              hitSlop={8}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel="Edit task">
              <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
            </Pressable>
          ),
        }}
      />

      <Pressable
        onPress={() => course && router.push(`/course/${course.id}`)}
        style={styles.courseRow}
        disabled={!course}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <ThemedText type="meta" themeColor="textSecondary">
          {course?.name ?? 'Unknown course'}
        </ThemedText>
        {course && <Ionicons name="chevron-forward" size={14} color={theme.textMuted} />}
      </Pressable>

      <View style={styles.titleRow}>
        <ThemedText type="screenTitle" style={styles.titleText}>
          {task.title}
        </ThemedText>
        {task.status === 'completed' && <StatusBadge label="Completed" color={StatusColors.success} />}
        {task.status === 'missed' && <StatusBadge label="Missed" color={StatusColors.danger} />}
      </View>

      <Card style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.detailLabel}>
            Type
          </ThemedText>
          <ThemedText type="default" style={styles.detailValueText}>
            {capitalize(TASK_TYPE_LABEL[task.taskType])}
          </ThemedText>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.detailLabel}>
            Deadline
          </ThemedText>
          <View style={styles.detailValueRow}>
            <ThemedText type="default">{formatDueDate(task.dueDate)}</ThemedText>
            {task.status !== 'completed' && <StatusBadge label={due.label} color={due.color} />}
          </View>
        </View>
        <View style={styles.detailRow}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.detailLabel}>
            Duration
          </ThemedText>
          <ThemedText type="default" style={styles.detailValueText}>
            {formatMinutes(task.estimatedMinutes)}
          </ThemedText>
        </View>
        {dependencies.length > 0 && (
          <View style={styles.detailRow}>
            <ThemedText type="meta" themeColor="textMuted" style={styles.detailLabel}>
              Depends on
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.detailValueText}>
              {dependencies.map((d) => d.title).join(', ')}
            </ThemedText>
          </View>
        )}
      </Card>

      <View style={styles.section}>
        <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
          PLANNED STUDY TIME
        </ThemedText>
        {isScheduled ? (
          <Card accentColor={accent} style={styles.scheduleCard}>
            {blocks.map((block) => (
              <View key={block.id} style={styles.scheduleRow}>
                <Ionicons name="time-outline" size={16} color={theme.textSecondary} style={styles.scheduleIcon} />
                <View style={styles.scheduleTextGroup}>
                  <ThemedText type="cardTitle">{formatBlockDay(block.start)}</ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {formatBlockTimeRange(block.start, block.end)}
                  </ThemedText>
                </View>
              </View>
            ))}
          </Card>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            {task.status === 'missed'
              ? 'Not scheduled right now — it needs to go through recovery to get a new time.'
              : "Not scheduled yet — it hasn't been fit into your availability."}
          </ThemedText>
        )}
      </View>

      {/* Actions are strictly derived from the task's real status + real
          schedule membership — never offering something the task can't
          actually do (see master spec: "never expose impossible actions"). */}
      <View style={styles.actions}>
        {task.status === 'pending' && isScheduled && (
          <View style={styles.actionRow}>
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
                onPress={() => router.push(`/recovery/${task.id}`)}
                style={styles.actionButton}
              />
            ) : (
              // Time hasn't arrived yet — you can't have "missed" it. If
              // plans changed, move it to a different open slot instead.
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
        )}
        {task.status === 'pending' && !isScheduled && (
          <Button
            label="Edit task"
            variant="outlined"
            onPress={() => router.push(`/task-entry?id=${task.id}`)}
          />
        )}
        {task.status === 'completed' && (
          <Button label="Reopen" variant="outlined" onPress={() => reopenTask(task.id)} />
        )}
        {task.status === 'missed' && (
          <Button label="Review recovery" onPress={() => router.push(`/recovery/${task.id}`)} />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  titleText: {
    flex: 1,
  },
  detailsCard: {
    gap: Spacing.three,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.three,
  },
  detailLabel: {
    width: 76,
    paddingTop: 1,
  },
  detailValueRow: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: Spacing.two,
  },
  detailValueText: {
    flex: 1,
    textAlign: 'right',
  },
  headerAction: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    justifyContent: 'center',
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    letterSpacing: 0.6,
  },
  scheduleCard: {
    gap: Spacing.two,
  },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  scheduleIcon: {
    marginTop: 2,
  },
  scheduleTextGroup: {
    flex: 1,
    gap: 1,
  },
  actions: {
    marginTop: Spacing.one,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  actionButton: {
    flex: 1,
  },
});

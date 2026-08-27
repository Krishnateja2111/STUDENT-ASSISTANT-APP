import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing, StatusColors } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatMinutes } from '@/lib/format-duration';
import { ReasonCode, type ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const ANALYZE_DELAY_MS = 900;

const REASON_ICON: Record<ReasonCode, keyof typeof Ionicons.glyphMap> = {
  [ReasonCode.DEADLINE_PROXIMITY]: 'time-outline',
  [ReasonCode.HIGH_PRIORITY_TASK_TYPE]: 'flag-outline',
  [ReasonCode.AVAILABILITY_FREED]: 'calendar-outline',
  [ReasonCode.DEPENDENCY_ORDER]: 'git-branch-outline',
  [ReasonCode.MISSED_TASK_REINSERTED]: 'refresh-circle-outline',
  [ReasonCode.OVERFLOW_DEFERRED]: 'alert-circle-outline',
};

// What triggered the change, in the engine's own terms — not invented copy.
const REASON_LABEL: Record<ReasonCode, string> = {
  [ReasonCode.MISSED_TASK_REINSERTED]: 'MISSED',
  [ReasonCode.OVERFLOW_DEFERRED]: "COULDN'T FIT",
  [ReasonCode.DEADLINE_PROXIMITY]: 'MOVED',
  [ReasonCode.HIGH_PRIORITY_TASK_TYPE]: 'MOVED',
  [ReasonCode.AVAILABILITY_FREED]: 'MOVED',
  [ReasonCode.DEPENDENCY_ORDER]: 'MOVED',
};

function formatBlockTime(block?: ScheduledBlock) {
  if (!block) return 'Unscheduled';
  const day = new Date(block.start).toLocaleDateString('en-US', { weekday: 'short' });
  const time = new Date(block.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function formatDuration(block: ScheduledBlock): string {
  const minutes = (new Date(block.end).getTime() - new Date(block.start).getTime()) / 60_000;
  return formatMinutes(minutes);
}

export default function RescheduleScreen() {
  const { tasks, courses, pendingReschedule, pendingExplanations, acceptReschedule } = useAppState();
  const [analyzing, setAnalyzing] = useState(true);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setAnalyzing(false), ANALYZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const taskTitle = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? 'Task';
  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const courseAccent = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    return getCourseAccent(task?.courseId, courses);
  };
  const changeFor = (taskId: string) => pendingReschedule?.changes.find((c) => c.taskId === taskId);

  // Protected = everything currently on the calendar that this recovery
  // operation did NOT touch. Derived entirely from the existing result —
  // no new scheduling logic, just a set difference against `changes`.
  const changedTaskIds = new Set(pendingReschedule?.changes.map((c) => c.taskId) ?? []);
  const protectedBlocks = (pendingReschedule?.scheduledBlocks ?? [])
    .filter((block) => !changedTaskIds.has(block.taskId))
    .sort((a, b) => a.start.localeCompare(b.start));

  if (analyzing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" color={StatusColors.brand} />
        <ThemedText type="default" themeColor="textSecondary" style={styles.analyzingText}>
          Analyzing deadline / priority / availability...
        </ThemedText>
      </ThemedView>
    );
  }

  if (pendingExplanations.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="default" themeColor="textSecondary">
          No pending changes.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <ThemedText type="meta" themeColor="textMuted" style={styles.eyebrow}>
          SCHEDULE UPDATED
        </ThemedText>
        <ThemedText type="screenTitle" style={styles.heading}>
          Here&apos;s what changed
        </ThemedText>

        {pendingExplanations.map((entry) => {
          const accepted = acceptedIds.has(entry.taskId);
          const change = changeFor(entry.taskId);
          const wasScheduled = Boolean(change?.previousBlock);
          const hasNewTime = Boolean(change?.newBlock);
          return (
            <Card key={entry.taskId} accentColor={courseAccent(entry.taskId)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name={REASON_ICON[entry.reasonCode]} size={16} color={StatusColors.danger} />
                <ThemedText type="meta" themeColor="textMuted" style={styles.reasonLabel}>
                  {REASON_LABEL[entry.reasonCode]}
                </ThemedText>
              </View>
              <ThemedText type="cardTitle">{taskTitle(entry.taskId)}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {courseName(tasks.find((t) => t.id === entry.taskId)?.courseId ?? '')}
              </ThemedText>

              {hasNewTime ? (
                <View style={styles.movedColumn}>
                  <ThemedText
                    type="meta"
                    themeColor="textMuted"
                    style={wasScheduled ? styles.strike : undefined}>
                    {formatBlockTime(change?.previousBlock)}
                  </ThemedText>
                  <Ionicons name="arrow-down" size={16} color={StatusColors.brand} style={styles.movedArrow} />
                  <ThemedText type="screenTitle" style={styles.movedNewTime}>
                    {formatBlockTime(change?.newBlock)}
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.unresolvedBadge}>
                  <ThemedText type="small" themeColor="textSecondary">
                    Still needs a spot on your schedule
                  </ThemedText>
                </View>
              )}

              <ThemedText type="small" themeColor="textSecondary" style={styles.whyLabel}>
                WHY
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.message}
              </ThemedText>

              <View style={styles.actions}>
                <Button
                  label={accepted ? 'Accepted ✓' : 'Accept New Time'}
                  variant="filled"
                  color={accepted ? StatusColors.success : StatusColors.brand}
                  onPress={() => setAcceptedIds((prev) => new Set(prev).add(entry.taskId))}
                />
                <Button
                  label="Choose Another Time"
                  variant="outlined"
                  onPress={() => router.push('/(tabs)/calendar')}
                />
              </View>
            </Card>
          );
        })}

        <Card accentColor={StatusColors.success} style={styles.protectedCard}>
          <View style={styles.protectedHeader}>
            <Ionicons name="shield-checkmark-outline" size={18} color={StatusColors.success} />
            <ThemedText type="meta" themeColor="textMuted" style={styles.protectedTitle}>
              PROTECTED
            </ThemedText>
          </View>
          {protectedBlocks.length === 0 ? (
            <ThemedText type="small" themeColor="textSecondary">
              Nothing else was on your schedule to protect.
            </ThemedText>
          ) : (
            <>
              <ThemedText type="small" themeColor="textSecondary" style={styles.protectedNote}>
                These stayed exactly where they were.
              </ThemedText>
              {protectedBlocks.map((block) => {
                const task = tasks.find((t) => t.id === block.taskId);
                if (!task) return null;
                return (
                  <View key={block.id} style={styles.protectedRow}>
                    <Ionicons name="checkmark-circle" size={18} color={StatusColors.success} />
                    <View style={styles.protectedRowText}>
                      <ThemedText type="cardTitle">{task.title}</ThemedText>
                      <View style={styles.protectedMetaRow}>
                        <View style={[styles.courseDot, { backgroundColor: getCourseAccent(task.courseId, courses) }]} />
                        <ThemedText type="meta" themeColor="textSecondary">
                          {courseName(task.courseId)} · {formatBlockTime(block)} · {formatDuration(block)}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                );
              })}
            </>
          )}
        </Card>
      </ScrollView>

      <Button
        label="Done"
        onPress={() => {
          acceptReschedule();
          router.replace('/(tabs)/dashboard');
        }}
        style={styles.doneButton}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  analyzingText: {
    textAlign: 'center',
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  eyebrow: {
    letterSpacing: 0.8,
  },
  heading: {
    marginBottom: Spacing.one,
  },
  card: {
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  reasonLabel: {
    letterSpacing: 0.6,
    color: StatusColors.danger,
  },
  movedColumn: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: Spacing.two,
    gap: 2,
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  movedArrow: {
    marginVertical: 2,
  },
  movedNewTime: {
    fontSize: 22,
    lineHeight: 28,
  },
  unresolvedBadge: {
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  whyLabel: {
    letterSpacing: 0.6,
    marginTop: Spacing.one,
    fontWeight: '700',
  },
  actions: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
    marginTop: Spacing.two,
  },
  protectedCard: {
    gap: Spacing.two,
  },
  protectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  protectedTitle: {
    letterSpacing: 0.8,
    color: StatusColors.success,
    fontWeight: '700',
  },
  protectedNote: {
    marginTop: -Spacing.one,
  },
  protectedRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  protectedRowText: {
    flex: 1,
    gap: 2,
  },
  protectedMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  courseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  doneButton: {
    margin: Spacing.four,
  },
});

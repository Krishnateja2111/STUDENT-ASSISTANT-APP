import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CourseAccentPalette, Spacing, StatusColors } from '@/constants/theme';
import { ReasonCode, type ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const ANALYZE_DELAY_MS = 900;

const REASON_ICON: Record<ReasonCode, keyof typeof Ionicons.glyphMap> = {
  [ReasonCode.DEADLINE_PROXIMITY]: 'time-outline',
  [ReasonCode.HIGH_PRIORITY_TASK_TYPE]: 'flag-outline',
  [ReasonCode.AVAILABILITY_FREED]: 'calendar-outline',
  [ReasonCode.DEPENDENCY_ORDER]: 'git-branch-outline',
  [ReasonCode.MISSED_TASK_REINSERTED]: 'refresh-circle-outline',
  [ReasonCode.OVERFLOW_DEFERRED]: 'arrow-down-circle-outline',
};

function formatBlockTime(block?: ScheduledBlock) {
  if (!block) return 'Unscheduled';
  const day = new Date(block.start).toLocaleDateString('en-US', { weekday: 'short' });
  const time = new Date(block.start).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} ${time}`;
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
  const courseAccent = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    const courseIndex = courses.findIndex((c) => c.id === task?.courseId);
    const course = courses[courseIndex];
    return course?.colorTag ?? CourseAccentPalette[courseIndex % CourseAccentPalette.length] ?? StatusColors.brand;
  };
  const changeFor = (taskId: string) => pendingReschedule?.changes.find((c) => c.taskId === taskId);

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
        <ThemedText type="screenTitle" style={styles.heading}>
          Here&apos;s what changed
        </ThemedText>
        {pendingExplanations.map((entry) => {
          const accepted = acceptedIds.has(entry.taskId);
          const change = changeFor(entry.taskId);
          const wasScheduled = Boolean(change?.previousBlock);
          return (
            <Card key={entry.taskId} accentColor={courseAccent(entry.taskId)} style={styles.card}>
              <View style={styles.cardHeader}>
                <Ionicons name={REASON_ICON[entry.reasonCode]} size={18} color={StatusColors.brand} />
                <ThemedText type="cardTitle">{taskTitle(entry.taskId)}</ThemedText>
              </View>

              <View style={styles.movedRow}>
                <ThemedText
                  type="meta"
                  themeColor="textMuted"
                  style={wasScheduled ? styles.strike : undefined}>
                  {formatBlockTime(change?.previousBlock)}
                </ThemedText>
                <Ionicons name="arrow-forward" size={14} color={StatusColors.brand} style={styles.arrow} />
                <ThemedText type="meta" themeColor="text" style={styles.movedNewTime}>
                  {formatBlockTime(change?.newBlock)}
                </ThemedText>
              </View>

              <ThemedText type="small" themeColor="textSecondary">
                {entry.message}
              </ThemedText>

              <View style={styles.actions}>
                <Button
                  label={accepted ? 'Accepted ✓' : 'Accept'}
                  variant="filled"
                  color={accepted ? StatusColors.success : StatusColors.brand}
                  onPress={() => setAcceptedIds((prev) => new Set(prev).add(entry.taskId))}
                  style={styles.actionButton}
                />
                <Button
                  label="Change"
                  variant="outlined"
                  onPress={() => router.push('/(tabs)/calendar')}
                  style={styles.actionButton}
                />
              </View>
            </Card>
          );
        })}
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
  heading: {
    marginBottom: Spacing.one,
  },
  card: {
    gap: Spacing.two,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  movedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  strike: {
    textDecorationLine: 'line-through',
  },
  arrow: {
    marginHorizontal: Spacing.one,
  },
  movedNewTime: {
    fontWeight: '700',
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
    marginTop: Spacing.one,
  },
  actionButton: {
    flex: 1,
  },
  doneButton: {
    margin: Spacing.four,
  },
});

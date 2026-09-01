import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { dueLabel } from '@/lib/due-label';
import { formatMinutes } from '@/lib/format-duration';
import { rescheduleAfterMiss } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

function formatBlockTime(startIso: string, endIso: string) {
  const day = new Date(startIso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
  const start = new Date(startIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const end = new Date(endIso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day}, ${start} – ${end}`;
}

const NEXT_STEPS = [
  "We'll look for a new time for this task that still respects its deadline, if there's room.",
  "Nothing else on your schedule moves — every other task stays exactly where it is.",
  "You'll see exactly what changed before anything is applied, and can cancel if you don't want it.",
];

/**
 * Recovery / Impact — master spec's "What happened? → Impact → What happens
 * next? → Analyze Impact" step, inserted between tapping "Missed" and the
 * existing Reschedule Review screen (unchanged, protected-adjacent).
 *
 * Nothing here mutates state: rescheduleAfterMiss is a pure function (see
 * lib/scheduling), so the impact shown below is computed as a real preview,
 * not invented copy — but it isn't committed. markMissed (the actual
 * mutation) only runs when the student presses "Analyze Impact", and only
 * then does the task's status actually change and a review proposal exist.
 * Backing out of this screen leaves the task completely untouched.
 */
export default function RecoveryImpactScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, courses, scheduledBlocks, effectiveAvailability, markMissed } = useAppState();
  const theme = useTheme();

  const task = tasks.find((t) => t.id === id);
  const block = scheduledBlocks.find((b) => b.taskId === id);

  // Bug fix: router.back() is a silent no-op with no in-app navigation
  // history to go back to (a direct URL load, a page refresh while already
  // on this screen — reproduced live on Weekly Progress/Notifications).
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  if (!task || !block) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: 'Recovery' }} />
        <EmptyState
          icon="alert-circle-outline"
          message="This task doesn't have anything to recover — it may have already been rescheduled or removed."
        />
        <Button label="Back" variant="outlined" onPress={safeBack} />
      </ScrollView>
    );
  }

  const accent = getCourseAccent(task.courseId, courses);
  const courseName = courses.find((c) => c.id === task.courseId)?.name ?? 'Unknown course';
  const due = dueLabel(task.dueDate);

  // Pure preview — same function acceptReschedule's underlying flow uses,
  // called here read-only so "Impact" reflects reality without committing
  // anything yet.
  const preview = rescheduleAfterMiss(task, tasks, effectiveAvailability);
  const willOverflow = preview.overflow.some((t) => t.id === task.id);

  const handleAnalyze = () => {
    markMissed(task.id);
    router.push('/reschedule');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable onPress={safeBack} hitSlop={8} style={styles.headerAction}>
              <ThemedText type="default" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.eyebrow}>
        WHAT HAPPENED
      </ThemedText>
      <Card accentColor={accent} style={styles.whatHappenedCard}>
        <ThemedText type="cardTitle">{task.title}</ThemedText>
        <ThemedText type="meta" themeColor="textSecondary">
          {courseName}
        </ThemedText>
        <View style={styles.scheduledRow}>
          <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
          <ThemedText type="meta" themeColor="textSecondary">
            Was scheduled for {formatBlockTime(block.start, block.end)}
          </ThemedText>
        </View>
      </Card>

      <ThemedText type="meta" themeColor="textMuted" style={styles.eyebrow}>
        IMPACT
      </ThemedText>
      <Card style={styles.impactCard}>
        <View style={styles.impactRow}>
          <ThemedText type="meta" themeColor="textMuted">
            Time needed
          </ThemedText>
          <ThemedText type="default">{formatMinutes(task.estimatedMinutes)}</ThemedText>
        </View>
        <View style={styles.impactRow}>
          <ThemedText type="meta" themeColor="textMuted">
            Deadline risk
          </ThemedText>
          <StatusBadge
            label={willOverflow ? "May not fit" : due.label}
            color={willOverflow ? StatusColors.danger : due.color}
          />
        </View>
        <View style={styles.impactRow}>
          <ThemedText type="meta" themeColor="textMuted">
            Tasks affected
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.affectedValue}>
            Just this one
          </ThemedText>
        </View>
        {willOverflow && (
          <ThemedText type="small" style={styles.overflowWarning}>
            Given your current availability, this task may not fit before its deadline. You'll be able to see
            exactly what the engine could and couldn't place on the next screen.
          </ThemedText>
        )}
      </Card>

      <ThemedText type="meta" themeColor="textMuted" style={styles.eyebrow}>
        WHAT HAPPENS NEXT
      </ThemedText>
      <Card style={styles.stepsCard}>
        {NEXT_STEPS.map((step, i) => (
          <View key={step} style={styles.stepRow}>
            <View style={[styles.stepNumber, { backgroundColor: theme.backgroundSelected }]}>
              <ThemedText type="small" style={styles.stepNumberText}>
                {i + 1}
              </ThemedText>
            </View>
            <ThemedText type="default" themeColor="textSecondary" style={styles.stepText}>
              {step}
            </ThemedText>
          </View>
        ))}
      </Card>

      <Button label="Analyze Impact" onPress={handleAnalyze} style={styles.analyzeButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  headerAction: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  eyebrow: {
    letterSpacing: 0.6,
    marginTop: Spacing.two,
  },
  whatHappenedCard: {
    gap: 4,
  },
  scheduledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  impactCard: {
    gap: Spacing.two,
  },
  impactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  affectedValue: {
    fontWeight: '600',
  },
  overflowWarning: {
    color: StatusColors.danger,
    marginTop: Spacing.one,
  },
  stepsCard: {
    gap: Spacing.three,
  },
  stepRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stepNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontWeight: '700',
  },
  stepText: {
    flex: 1,
  },
  analyzeButton: {
    marginTop: Spacing.two,
  },
});

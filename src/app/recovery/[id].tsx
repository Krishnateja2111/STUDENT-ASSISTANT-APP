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

/**
 * Second step's wording depends on the actual preview (see `otherAffected`
 * below): almost always nothing else moves, but if this task is high enough
 * priority that the only way to fit it is to bump a lower-priority task out
 * of its slot, that's real and shouldn't be promised away. Same-or-higher
 * priority tasks are never affected either way — that guarantee doesn't change.
 */
function nextSteps(otherAffectedCount: number): string[] {
  return [
    "We'll look for a new time for this task that still respects its deadline, if there's room.",
    otherAffectedCount > 0
      ? `${otherAffectedCount === 1 ? 'One lower-priority task' : `${otherAffectedCount} lower-priority tasks`} may need to move to make room — nothing same-or-higher priority ever does.`
      : 'Nothing else on your schedule moves — every other task stays exactly where it is.',
    "You'll see exactly what changed before anything is applied, and can cancel if you don't want it.",
  ];
}

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

  // Bug fix: a missed task that a previous recovery attempt genuinely
  // couldn't fit anywhere (see acceptReschedule in app-state.tsx — it
  // correctly stays 'missed' with no block rather than fabricating a
  // placement) used to hit the exact same "nothing to recover" dead end as
  // a task that's ACTUALLY been resolved or deleted — even though it's
  // still sitting right there in the missed count on Dashboard/Weekly
  // Progress. Only a task that doesn't exist at all gets that message now;
  // a real, still-missed task always gets a real way to try again below,
  // regardless of whether it currently has a block.
  if (!task) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Stack.Screen options={{ title: 'Recovery' }} />
        <EmptyState icon="alert-circle-outline" message="This task couldn't be found — it may have been deleted." />
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
  // Almost always empty — see rescheduleAfterMiss's own doc comment. Only
  // non-empty when this task's priority was high enough that the only way
  // to fit it required bumping a strictly lower-priority task.
  const otherAffected = preview.changes.filter((c) => c.taskId !== task.id);
  // rescheduleAfterMiss (fully protected) deliberately falls back to the
  // earliest slot available at all when the task's own deadline can't be
  // honored, rather than leaving a missed task unscheduled forever — a
  // real, intentional design choice for recovery specifically, not a bug.
  // But reported live: that fallback can be invisible to the student,
  // reading as "the engine isn't keeping an eye on the deadline." Can't
  // change the protected engine's placement choice, but the review here
  // can and should say so plainly rather than silently offering it.
  const proposedBlock = preview.changes.find((c) => c.taskId === task.id)?.newBlock;
  const willBePastDeadline = proposedBlock
    ? new Date(proposedBlock.end).getTime() > new Date(task.dueDate).getTime()
    : false;

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
        {block ? (
          <View style={styles.scheduledRow}>
            <Ionicons name="time-outline" size={16} color={theme.textSecondary} />
            <ThemedText type="meta" themeColor="textSecondary">
              Was scheduled for {formatBlockTime(block.start, block.end)}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.scheduledRow}>
            <Ionicons name="alert-circle-outline" size={16} color={StatusColors.danger} />
            <ThemedText type="meta" themeColor="textSecondary">
              Not currently scheduled — an earlier attempt to fit this in couldn&apos;t find room.
            </ThemedText>
          </View>
        )}
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
            label={willOverflow ? 'May not fit' : willBePastDeadline ? 'Past deadline' : due.label}
            color={willOverflow || willBePastDeadline ? StatusColors.danger : due.color}
          />
        </View>
        <View style={styles.impactRow}>
          <ThemedText type="meta" themeColor="textMuted">
            Tasks affected
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.affectedValue}>
            {otherAffected.length === 0
              ? 'Just this one'
              : `This one + ${otherAffected.length} lower-priority ${otherAffected.length === 1 ? 'task' : 'tasks'}`}
          </ThemedText>
        </View>
        {willOverflow && (
          <ThemedText type="small" style={styles.overflowWarning}>
            Given your current availability, this task may not fit before its deadline. You'll be able to see
            exactly what the engine could and couldn't place on the next screen.
          </ThemedText>
        )}
        {willBePastDeadline && proposedBlock && (
          <ThemedText type="small" style={styles.overflowWarning}>
            There wasn&apos;t enough room before this task&apos;s deadline — the best time the engine found is{' '}
            {new Date(proposedBlock.end).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            , after the original deadline of {new Date(task.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}. You can accept it anyway, or free up time before the deadline and try again.
          </ThemedText>
        )}
      </Card>

      <ThemedText type="meta" themeColor="textMuted" style={styles.eyebrow}>
        WHAT HAPPENS NEXT
      </ThemedText>
      <Card style={styles.stepsCard}>
        {nextSteps(otherAffected.length).map((step, i) => (
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

      <Button label={block ? 'Analyze Impact' : 'Try Again'} onPress={handleAnalyze} style={styles.analyzeButton} />
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

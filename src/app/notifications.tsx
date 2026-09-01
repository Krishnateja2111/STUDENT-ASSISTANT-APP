import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';

const HEALTH_LABEL: Record<'yellow' | 'red', { label: string; color: string }> = {
  yellow: { label: 'Getting tight', color: StatusColors.warning },
  red: { label: 'Overloaded', color: StatusColors.danger },
};

/**
 * Notifications — what the bell icon actually opens now, instead of
 * jumping straight to Settings (a real point of confusion: tapping a bell
 * and landing on a settings screen with no notifications on it). Every row
 * here is a real, already-computed alert this app already tracks elsewhere
 * (missed tasks, the lowest-priority "needs input" task, an overloaded/
 * tight workload outlook, unscheduled pending work) — nothing invented,
 * and each one links to the screen that actually lets you act on it.
 */
export default function NotificationsScreen() {
  const { tasks, scheduledBlocks, health } = useAppState();
  const theme = useTheme();

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const scheduledTaskIds = new Set(scheduledBlocks.map((b) => b.taskId));
  const unscheduledPendingTasks = tasks.filter((t) => t.status === 'pending' && !scheduledTaskIds.has(t.id));
  const needsInputTask = health.suggestedDeferrals.find((t) => t.status !== 'missed');
  const healthAlert = health.status === 'yellow' || health.status === 'red' ? HEALTH_LABEL[health.status] : null;

  const hasAnything = missedTasks.length > 0 || unscheduledPendingTasks.length > 0 || Boolean(healthAlert);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          // Same fix as Weekly Progress: this screen is outside the
          // bottom-tab group (no tab bar visible here), so the default
          // icon-only back arrow is the only way out and easy to miss —
          // and router.back() alone is a silent no-op with no navigation
          // history (direct load / refresh), so this falls back to a real
          // destination instead of doing nothing.
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/dashboard'))}
              hitSlop={8}
              style={styles.headerAction}>
              <ThemedText type="default" style={{ color: StatusColors.brand, fontWeight: '600' }}>
                Done
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      {!hasAnything && (
        <EmptyState icon="checkmark-done-outline" message="Nothing needs your attention right now." />
      )}

      {missedTasks.map((task) => (
        <Pressable key={task.id} onPress={() => router.push(`/recovery/${task.id}`)}>
          <Card style={styles.row}>
            <Ionicons name="alert-circle-outline" size={20} color={StatusColors.danger} />
            <View style={styles.rowText}>
              <ThemedText type="cardTitle">Missed: {task.title}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Tap to review recovery
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Card>
        </Pressable>
      ))}

      {healthAlert && (
        <Card style={styles.row}>
          <Ionicons name="warning-outline" size={20} color={healthAlert.color} />
          <View style={styles.rowText}>
            <ThemedText type="cardTitle" style={{ color: healthAlert.color }}>
              Workload: {healthAlert.label}
            </ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {health.message}
            </ThemedText>
          </View>
        </Card>
      )}

      {needsInputTask && (
        <Pressable onPress={() => router.push(`/task/${needsInputTask.id}`)}>
          <Card style={styles.row}>
            <Ionicons name="sparkles-outline" size={20} color={StatusColors.brand} />
            <View style={styles.rowText}>
              <ThemedText type="cardTitle">Needs input: {needsInputTask.title}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Your lowest-priority item right now
              </ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </Card>
        </Pressable>
      )}

      {unscheduledPendingTasks.length > 0 && (
        <Pressable onPress={() => router.push('/task-entry')}>
          <Card style={styles.row}>
            <Ionicons name="calendar-clear-outline" size={20} color={theme.textSecondary} />
            <View style={styles.rowText}>
              <ThemedText type="cardTitle">
                {unscheduledPendingTasks.length} task{unscheduledPendingTasks.length > 1 ? 's' : ''} still need
                {unscheduledPendingTasks.length > 1 ? '' : 's'} scheduling
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Add more availability, or adjust their deadline/duration
              </ThemedText>
            </View>
          </Card>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerAction: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});

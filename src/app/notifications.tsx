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
 * and landing on a settings screen with no notifications on it).
 *
 * Deliberately limited to real events — a task got missed, or the workload
 * outlook crossed into yellow/red — rather than ambient state. The
 * lowest-priority "needs input" nudge and the unscheduled-task count are
 * always-somewhat-true summaries with no moment of origin (there's nearly
 * always *some* lowest-priority task the algorithm could name), so they
 * never resolve or feel new — they just look the same on every visit. Those
 * already live on the Dashboard as persistent cards; showing them here too
 * just restates the same standing state under a label that implies
 * something happened.
 */
export default function NotificationsScreen() {
  const { tasks, health } = useAppState();
  const theme = useTheme();

  const missedTasks = tasks.filter((t) => t.status === 'missed');
  const healthAlert = health.status === 'yellow' || health.status === 'red' ? HEALTH_LABEL[health.status] : null;

  const hasAnything = missedTasks.length > 0 || Boolean(healthAlert);

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

import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { SectionHeader } from '@/components/section-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Invalid time range';
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${startTime} – ${endTime}`;
}

export default function SettingsScreen() {
  const { availability, addAvailabilityBlock, updateAvailabilityBlock, removeAvailabilityBlock } = useAppState();
  const { notificationPrefs, updateNotificationPrefs } = useContentState();
  const theme = useTheme();

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <SectionHeader title="Study availability" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          This is the real availability the scheduling engine plans around — changes here affect your
          schedule health and future reschedules right away.
        </ThemedText>

        {availability.length === 0 && <EmptyState icon="time-outline" message="No availability set yet." />}

        {availability.map((block) => (
          <Card key={block.id} style={styles.availabilityCard}>
            <ThemedText type="cardTitle">{formatRange(block.start, block.end)}</ThemedText>
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              START
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={block.start}
              onChangeText={(text) => updateAvailabilityBlock(block.id, { start: text })}
            />
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              END
            </ThemedText>
            <TextInput
              style={inputStyle}
              value={block.end}
              onChangeText={(text) => updateAvailabilityBlock(block.id, { end: text })}
            />
            <Button
              label="Remove"
              variant="outlined"
              color={StatusColors.danger}
              onPress={() => removeAvailabilityBlock(block.id)}
              style={styles.removeButton}
            />
          </Card>
        ))}

        <Button
          label="+ Add availability block"
          variant="outlined"
          onPress={() => {
            const now = new Date();
            now.setMinutes(0, 0, 0);
            const start = now.toISOString().slice(0, 16);
            now.setHours(now.getHours() + 2);
            const end = now.toISOString().slice(0, 16);
            addAvailabilityBlock({ start, end });
          }}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        {/* TODO(notifications): UI-only — no real push notification wiring yet. */}
        <Card style={styles.notificationCard}>
          {/* Whole row is tappable, not just the Switch itself — the Switch's
              native size (~40x20) is well under the 44px touch-target minimum
              used everywhere else; resizing the control itself would look
              broken, so the row is the actual hit target instead. */}
          <Pressable
            style={styles.notificationRow}
            onPress={() => updateNotificationPrefs({ deadlineReminders: !notificationPrefs.deadlineReminders })}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Deadline reminders</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A nudge before a task is due
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.deadlineReminders}
              onValueChange={(value) => updateNotificationPrefs({ deadlineReminders: value })}
            />
          </Pressable>
          <Pressable
            style={styles.notificationRow}
            onPress={() => updateNotificationPrefs({ dailyPlanSummary: !notificationPrefs.dailyPlanSummary })}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Daily plan summary</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A morning recap of today&apos;s plan
              </ThemedText>
            </View>
            <Switch
              value={notificationPrefs.dailyPlanSummary}
              onValueChange={(value) => updateNotificationPrefs({ dailyPlanSummary: value })}
            />
          </Pressable>
        </Card>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionNote: {
    marginBottom: Spacing.one,
  },
  availabilityCard: {
    gap: Spacing.one,
  },
  label: {
    letterSpacing: 0.6,
    marginTop: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  removeButton: {
    marginTop: Spacing.one,
  },
  notificationCard: {
    gap: Spacing.three,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  notificationText: {
    flex: 1,
    gap: 2,
  },
});

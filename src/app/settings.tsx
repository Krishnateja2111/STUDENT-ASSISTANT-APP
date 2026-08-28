import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
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
  const { availability, addAvailabilityBlock, updateAvailabilityBlock, removeAvailabilityBlock, logout } =
    useAppState();
  const { profile } = useContentState();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const inputStyle = [
    styles.input,
    { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
  ];

  const appearanceLabel = colorScheme === 'dark' ? 'Dark' : 'Light';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () => {
    setShowSignOutConfirm(false);
    logout();
    router.replace('/auth');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <Card style={styles.accountCard}>
          <View style={styles.accountRow}>
            <Avatar name={profile.name} size={44} />
            <View style={styles.accountText}>
              <ThemedText type="cardTitle">{profile.name}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {profile.email || 'No email set'}
              </ThemedText>
            </View>
          </View>
          <ListRow
            icon="person-outline"
            label="Edit profile"
            description="Name and email"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Study preferences" />
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
              onPress={() => setPendingRemoveId(block.id)}
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
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          Not built yet — nothing below sends a real notification. Shown here so you know what&apos;s planned.
        </ThemedText>
        <Card style={styles.notificationCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Deadline reminders
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A nudge before a task is due
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Daily plan summary
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A morning recap of today&apos;s plan
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Appearance" />
        <Card style={styles.infoCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Theme</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Automatically follows your device&apos;s system setting
              </ThemedText>
            </View>
            <StatusBadge label={appearanceLabel} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Privacy & security" />
        <Card style={styles.infoCard}>
          <ThemedText type="cardTitle">Your data stays on this device</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Courses, tasks, documents, and your profile are stored locally and are never sent to a server.
          </ThemedText>
        </Card>
        <Card style={styles.infoCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Password & account security
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Sign-in is not backed by a real account system yet
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Card style={styles.infoCard}>
          <ThemedText type="cardTitle">Student Assistant</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Version {appVersion}
          </ThemedText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Account actions" />
        <Button
          label="Sign out"
          variant="outlined"
          color={StatusColors.danger}
          onPress={() => setShowSignOutConfirm(true)}
        />
      </View>

      <ConfirmDialog
        visible={pendingRemoveId !== null}
        title="Remove this availability?"
        description="This time will no longer be considered for scheduling — it can affect upcoming and future schedules."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (pendingRemoveId) removeAvailabilityBlock(pendingRemoveId);
          setPendingRemoveId(null);
        }}
        onCancel={() => setPendingRemoveId(null)}
      />
      <ConfirmDialog
        visible={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to sign back in to continue. This won't delete any of your courses, tasks, or documents."
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
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
  accountCard: {
    gap: Spacing.two,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  accountText: {
    flex: 1,
    gap: 1,
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
  infoCard: {
    gap: Spacing.one,
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

import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { StatusColors, Spacing } from '@/constants/theme';
import { DAILY_SUMMARY_HOUR, DEADLINE_REMINDER_LEAD_MS, requestNotificationPermission } from '@/lib/notifications';
import { useAppState } from '@/state/app-state';
import { type NotificationPrefs, useContentState } from '@/state/content-state';

function formatHour12(hour: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:00 ${period}`;
}

export default function SettingsScreen() {
  const { logout } = useAppState();
  const { profile, notificationPrefs, updateNotificationPrefs } = useContentState();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const DEADLINE_REMINDER_LEAD_HOURS = DEADLINE_REMINDER_LEAD_MS / (60 * 60 * 1000);

  // Both toggles gate on the same single OS-level notification permission --
  // one request/denial state genuinely covers either.
  const handleToggleNotificationPref = (key: keyof NotificationPrefs) => async (value: boolean) => {
    if (!value) {
      updateNotificationPrefs({ [key]: false });
      return;
    }
    // Web has no real notification delivery (see lib/notifications.web.ts)
    // -- let the preference turn on anyway so it's not stuck permanently
    // disabled for someone previewing on web; it'll actually start working
    // once they're on a native build with permission granted.
    if (Platform.OS === 'web') {
      updateNotificationPrefs({ [key]: true });
      return;
    }
    const granted = await requestNotificationPermission();
    setPermissionDenied(!granted);
    if (granted) updateNotificationPrefs({ [key]: true });
  };

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
            onPress={() => router.push('/(tabs)/profile?from=settings')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        <Card style={styles.notificationCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Deadline reminders</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A nudge {DEADLINE_REMINDER_LEAD_HOURS}h before a task is due
              </ThemedText>
              {permissionDenied && (
                <ThemedText type="small" style={styles.deniedText}>
                  Notifications are off for this app in your device settings — turn them on there first.
                </ThemedText>
              )}
            </View>
            <Switch
              value={notificationPrefs.deadlineReminders}
              onValueChange={handleToggleNotificationPref('deadlineReminders')}
              trackColor={{ true: StatusColors.brand }}
            />
          </View>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Daily plan summary</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A recap of today&apos;s plan around {formatHour12(DAILY_SUMMARY_HOUR)}
              </ThemedText>
              {permissionDenied && (
                <ThemedText type="small" style={styles.deniedText}>
                  Notifications are off for this app in your device settings — turn them on there first.
                </ThemedText>
              )}
            </View>
            <Switch
              value={notificationPrefs.dailyPlanSummary}
              onValueChange={handleToggleNotificationPref('dailyPlanSummary')}
              trackColor={{ true: StatusColors.brand }}
            />
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
  deniedText: {
    color: StatusColors.danger,
    marginTop: 2,
  },
});

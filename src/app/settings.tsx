import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

export default function SettingsScreen() {
  const { logout } = useAppState();
  const { profile } = useContentState();
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

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
            onPress={() => router.push('/(tabs)/profile?from=settings')}
          />
        </Card>
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
});

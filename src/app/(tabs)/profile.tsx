import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ListRow } from '@/components/list-row';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

export default function ProfileScreen() {
  const { courses, tasks, logout } = useAppState();
  const { profile, updateProfile } = useContentState();
  const theme = useTheme();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);

  const totalTasks = tasks.length;
  const activeTasks = tasks.filter((t) => t.status === 'pending' || t.status === 'scheduled').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const handleSaveProfile = () => {
    updateProfile({ name: name.trim() || 'Student', email: email.trim() });
    setEditing(false);
  };

  const handleSignOut = () => {
    logout();
    router.replace('/auth');
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Profile" />

      <Card style={styles.identityCard}>
        {editing ? (
          <>
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Name"
              placeholderTextColor={theme.textMuted}
              value={name}
              onChangeText={setName}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Email"
              placeholderTextColor={theme.textMuted}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />
            <View style={styles.editActions}>
              <Button label="Save" onPress={handleSaveProfile} style={styles.flexButton} />
              <Button label="Cancel" variant="outlined" onPress={() => setEditing(false)} style={styles.flexButton} />
            </View>
          </>
        ) : (
          <View style={styles.identityRow}>
            <Avatar name={profile.name} />
            <View style={styles.identityText}>
              <ThemedText type="cardTitle">{profile.name}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Student
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {profile.email || 'No email set'}
              </ThemedText>
            </View>
            <Button label="Edit" variant="outlined" onPress={() => setEditing(true)} style={styles.editButton} />
          </View>
        )}
      </Card>

      <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
        ACADEMIC OVERVIEW
      </ThemedText>
      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{courses.length}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Courses
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{activeTasks}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Active tasks
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{completionRate}%</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Completed
          </ThemedText>
        </Card>
      </View>

      <Card style={styles.settingsCard}>
        <ListRow icon="person-outline" label="Personal information" description="Name and email" onPress={() => setEditing(true)} />
        <ListRow icon="notifications-outline" label="Notifications" description="Reminders and summaries" onPress={() => router.push('/settings')} />
        <ListRow icon="time-outline" label="Study availability" description="When you can be scheduled" onPress={() => router.push('/settings')} />
      </Card>

      <Button label="Sign out" variant="outlined" color={StatusColors.danger} onPress={handleSignOut} style={styles.signOutButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  identityCard: {
    gap: Spacing.two,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  identityText: {
    flex: 1,
    gap: 1,
  },
  editButton: {
    paddingHorizontal: Spacing.three,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
  },
  editActions: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flexButton: {
    flex: 1,
  },
  sectionLabel: {
    letterSpacing: 0.6,
    marginTop: Spacing.one,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  statCard: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  settingsCard: {
    gap: Spacing.one,
  },
  signOutButton: {
    marginTop: Spacing.two,
  },
});

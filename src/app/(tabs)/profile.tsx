import { router } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
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
      <ThemedText type="screenTitle">Profile</ThemedText>

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
          <>
            <ThemedText type="cardTitle">{profile.name}</ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {profile.email || 'No email set'}
            </ThemedText>
            <Button
              label="Edit profile"
              variant="outlined"
              onPress={() => setEditing(true)}
              style={styles.editProfileButton}
            />
          </>
        )}
      </Card>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{courses.length}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Courses
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{totalTasks}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Tasks
          </ThemedText>
        </Card>
        <Card style={styles.statCard}>
          <ThemedText type="keyNumber">{completionRate}%</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Completed
          </ThemedText>
        </Card>
      </View>

      <Button
        label="App Settings"
        variant="outlined"
        onPress={() => router.push('/settings')}
        style={styles.settingsButton}
      />

      <Button label="Sign out" variant="outlined" color={StatusColors.danger} onPress={handleSignOut} />
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
  editProfileButton: {
    alignSelf: 'flex-start',
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
  settingsButton: {
    marginTop: Spacing.two,
  },
});

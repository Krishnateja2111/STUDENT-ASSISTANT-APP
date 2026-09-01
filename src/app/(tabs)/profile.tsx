import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ListRow } from '@/components/list-row';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAppState } from '@/state/app-state';
import { type AcademicYear, useContentState } from '@/state/content-state';

const ACADEMIC_YEARS: AcademicYear[] = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'];

export default function ProfileScreen() {
  const { courses, tasks, logout } = useAppState();
  const { profile, updateProfile } = useContentState();
  const theme = useTheme();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [school, setSchool] = useState(profile.school ?? '');
  const [major, setMajor] = useState(profile.major ?? '');
  const [academicYear, setAcademicYear] = useState<AcademicYear | undefined>(profile.academicYear);
  const [bio, setBio] = useState(profile.bio ?? '');
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDiscardProfileEdit, setShowDiscardProfileEdit] = useState(false);

  const hasProfileChanges =
    name !== profile.name ||
    email !== profile.email ||
    school !== (profile.school ?? '') ||
    major !== (profile.major ?? '') ||
    academicYear !== profile.academicYear ||
    bio !== (profile.bio ?? '');

  const totalTasks = tasks.length;
  // Phase 4 fix: 'scheduled' is never actually assigned anywhere in this
  // codebase (schedule placement is tracked separately via scheduledBlocks,
  // not via Task.status), and a missed task is still outstanding work, not
  // "not active" — this now matches the same definition Courses' "remaining"
  // and the scheduling engine's own "active" set already use.
  const activeTasks = tasks.filter((t) => t.status !== 'completed').length;
  const completedTasks = tasks.filter((t) => t.status === 'completed').length;
  const completionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const startEditing = () => {
    setName(profile.name);
    setEmail(profile.email);
    setSchool(profile.school ?? '');
    setMajor(profile.major ?? '');
    setAcademicYear(profile.academicYear);
    setBio(profile.bio ?? '');
    setEditing(true);
  };

  const handleSaveProfile = () => {
    updateProfile({
      name: name.trim() || 'Student',
      email: email.trim(),
      school: school.trim(),
      major: major.trim(),
      academicYear,
      bio: bio.trim(),
    });
    setEditing(false);
  };

  const handleCancelEdit = () => {
    if (hasProfileChanges) {
      setShowDiscardProfileEdit(true);
    } else {
      setEditing(false);
    }
  };

  const handleSignOut = () => {
    setShowSignOutConfirm(false);
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
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="School"
              placeholderTextColor={theme.textMuted}
              value={school}
              onChangeText={setSchool}
            />
            <TextInput
              style={[
                styles.input,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="Major / field of study"
              placeholderTextColor={theme.textMuted}
              value={major}
              onChangeText={setMajor}
            />

            <ThemedText type="meta" themeColor="textMuted" style={styles.fieldLabel}>
              YEAR
            </ThemedText>
            <View style={styles.chipRow}>
              {ACADEMIC_YEARS.map((year) => {
                const selected = academicYear === year;
                return (
                  <Pressable key={year} onPress={() => setAcademicYear(selected ? undefined : year)}>
                    <View
                      style={[
                        styles.chip,
                        selected
                          ? { backgroundColor: StatusColors.brand }
                          : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                      ]}>
                      <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                        {year}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <TextInput
              style={[
                styles.input,
                styles.bioInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder="A short bio (optional)"
              placeholderTextColor={theme.textMuted}
              value={bio}
              onChangeText={setBio}
              multiline
            />

            <View style={styles.editActions}>
              <Button label="Save" onPress={handleSaveProfile} style={styles.flexButton} />
              <Button label="Cancel" variant="outlined" onPress={handleCancelEdit} style={styles.flexButton} />
            </View>
          </>
        ) : (
          <View style={styles.identityRow}>
            <Avatar name={profile.name} />
            <View style={styles.identityText}>
              <ThemedText type="cardTitle">{profile.name}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {[profile.academicYear, profile.major].filter(Boolean).join(' · ') || 'Student'}
              </ThemedText>
              {profile.school ? (
                <ThemedText type="meta" themeColor="textSecondary">
                  {profile.school}
                </ThemedText>
              ) : null}
              <ThemedText type="meta" themeColor="textSecondary">
                {profile.email || 'No email set'}
              </ThemedText>
              {profile.bio ? (
                <ThemedText type="meta" themeColor="textMuted" style={styles.bioText}>
                  {profile.bio}
                </ThemedText>
              ) : null}
            </View>
            <Button label="Edit" variant="outlined" onPress={startEditing} style={styles.editButton} />
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
        <ListRow
          icon="person-outline"
          label="Personal information"
          description="Name, email, school, major, year, bio"
          onPress={startEditing}
        />
        <ListRow
          icon="bar-chart-outline"
          label="Weekly progress"
          description="Planned vs. completed, by week"
          onPress={() => router.push('/weekly-progress')}
        />
        <ListRow icon="notifications-outline" label="Notifications" description="Reminders and summaries" onPress={() => router.push('/settings')} />
        <ListRow icon="time-outline" label="Study availability" description="When you can be scheduled" onPress={() => router.push('/settings')} />
      </Card>

      <Button
        label="Sign out"
        variant="outlined"
        color={StatusColors.danger}
        onPress={() => setShowSignOutConfirm(true)}
        style={styles.signOutButton}
      />

      <ConfirmDialog
        visible={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to sign back in to continue. This won't delete any of your courses, tasks, or documents."
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
      <ConfirmDialog
        visible={showDiscardProfileEdit}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to leave?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard"
        destructive
        onConfirm={() => {
          setShowDiscardProfileEdit(false);
          setEditing(false);
        }}
        onCancel={() => setShowDiscardProfileEdit(false)}
      />
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
  fieldLabel: {
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: MinTouchTarget - 4,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  bioInput: {
    minHeight: 80,
    textAlignVertical: 'top',
    paddingTop: Spacing.two + 2,
  },
  bioText: {
    marginTop: 2,
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

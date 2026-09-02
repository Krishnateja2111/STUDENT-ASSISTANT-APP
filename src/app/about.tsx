import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing, StatusColors } from '@/constants/theme';

/**
 * About / data & privacy — a standalone, no-account-needed answer to "what
 * does this app do with my data?" reachable straight from the hamburger
 * menu, instead of only living buried inside Settings.
 */
export default function AboutScreen() {
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'About',
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

      <View style={styles.section}>
        <SectionHeader title="Privacy & security" />
        <Card style={styles.infoCard}>
          <ThemedText type="cardTitle">Your data stays on this device</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Courses, tasks, documents, and your profile are stored locally and are never sent to a server.
          </ThemedText>
        </Card>
        <Card style={styles.infoCard}>
          <View style={styles.row}>
            <View style={styles.rowText}>
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
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  infoCard: {
    gap: Spacing.one,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
});

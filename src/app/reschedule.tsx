import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useAppState } from '@/state/app-state';

const ANALYZE_DELAY_MS = 900;

export default function RescheduleScreen() {
  const { tasks, pendingExplanations, acceptReschedule } = useAppState();
  const [analyzing, setAnalyzing] = useState(true);
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const timer = setTimeout(() => setAnalyzing(false), ANALYZE_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const taskTitle = (taskId: string) => tasks.find((t) => t.id === taskId)?.title ?? 'Task';

  if (analyzing) {
    return (
      <ThemedView style={styles.centered}>
        <ActivityIndicator size="large" />
        <ThemedText type="default" themeColor="textSecondary" style={styles.analyzingText}>
          Analyzing deadline / priority / availability...
        </ThemedText>
      </ThemedView>
    );
  }

  if (pendingExplanations.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <ThemedText type="default" themeColor="textSecondary">
          No pending changes.
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.list}>
        <ThemedText type="subtitle" style={styles.heading}>
          Here&apos;s what changed
        </ThemedText>
        {pendingExplanations.map((entry) => {
          const accepted = acceptedIds.has(entry.taskId);
          return (
            <ThemedView key={entry.taskId} type="backgroundElement" style={styles.card}>
              <ThemedText type="smallBold">{taskTitle(entry.taskId)}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {entry.message}
              </ThemedText>
              <ThemedView style={styles.actions}>
                <Pressable
                  style={[styles.actionButton, accepted && styles.actionButtonAccepted]}
                  onPress={() => setAcceptedIds((prev) => new Set(prev).add(entry.taskId))}>
                  <ThemedText type="small" themeColor={accepted ? 'background' : 'text'}>
                    {accepted ? 'Accepted ✓' : 'Accept'}
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={styles.actionButton}
                  onPress={() => router.push('/(tabs)/calendar')}>
                  <ThemedText type="small">Change</ThemedText>
                </Pressable>
              </ThemedView>
            </ThemedView>
          );
        })}
      </ScrollView>

      <Pressable
        style={styles.doneButton}
        onPress={() => {
          acceptReschedule();
          router.replace('/(tabs)/dashboard');
        }}>
        <ThemedText style={styles.doneButtonText}>Done</ThemedText>
      </Pressable>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
  },
  analyzingText: {
    textAlign: 'center',
  },
  list: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  heading: {
    fontSize: 22,
    lineHeight: 28,
  },
  card: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  actionButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
    backgroundColor: '#E0E1E6',
  },
  actionButtonAccepted: {
    backgroundColor: '#4CAF7D',
  },
  doneButton: {
    backgroundColor: '#3C87F7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    margin: Spacing.four,
  },
  doneButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

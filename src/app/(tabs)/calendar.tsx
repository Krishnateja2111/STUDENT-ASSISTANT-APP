import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

function formatDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function groupByDay(blocks: ScheduledBlock[]): Record<string, ScheduledBlock[]> {
  const groups: Record<string, ScheduledBlock[]> = {};
  for (const block of [...blocks].sort((a, b) => a.start.localeCompare(b.start))) {
    const day = block.start.slice(0, 10);
    groups[day] = groups[day] ?? [];
    groups[day].push(block);
  }
  return groups;
}

export default function CalendarScreen() {
  const { tasks, courses, scheduledBlocks, removeScheduledBlock } = useAppState();
  const [expandedBlockId, setExpandedBlockId] = useState<string | null>(null);

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const groups = groupByDay(scheduledBlocks);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="title" style={styles.pageTitle}>
        Calendar
      </ThemedText>

      {Object.entries(groups).map(([day, blocks]) => (
        <ThemedView key={day} style={styles.dayGroup}>
          <ThemedText type="smallBold" themeColor="textSecondary">
            {formatDay(day)}
          </ThemedText>
          {blocks.map((block) => {
            const task = tasks.find((t) => t.id === block.taskId);
            if (!task) return null;
            const expanded = expandedBlockId === block.id;
            return (
              <Pressable
                key={block.id}
                onPress={() => setExpandedBlockId(expanded ? null : block.id)}>
                <ThemedView type="backgroundElement" style={styles.blockRow}>
                  <ThemedView style={styles.blockMain}>
                    <ThemedText type="smallBold">
                      {formatTime(block.start)} – {formatTime(block.end)}
                    </ThemedText>
                    <ThemedText type="default">{task.title}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {courseName(task.courseId)}
                    </ThemedText>
                  </ThemedView>
                  {expanded && (
                    <Pressable
                      style={styles.removeButton}
                      onPress={() => {
                        removeScheduledBlock(block.id);
                        setExpandedBlockId(null);
                      }}>
                      <ThemedText type="small" themeColor="text">
                        Remove
                      </ThemedText>
                    </Pressable>
                  )}
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  pageTitle: {
    fontSize: 28,
    lineHeight: 34,
  },
  dayGroup: {
    gap: Spacing.two,
    backgroundColor: 'transparent',
  },
  blockRow: {
    borderRadius: Spacing.two,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.two,
  },
  blockMain: {
    flex: 1,
    gap: Spacing.half,
    backgroundColor: 'transparent',
  },
  removeButton: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
    backgroundColor: '#FBE4E2',
  },
});

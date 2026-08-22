import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import type { ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

function formatDay(dayKey: string) {
  // dayKey is a bare YYYY-MM-DD (from block.start.slice(0, 10)). Parsing that
  // directly with `new Date()` reads it as UTC midnight, which rolls back a
  // day in timezones behind UTC — construct from local components instead.
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
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
      <ThemedText type="screenTitle">Calendar</ThemedText>

      {Object.entries(groups).map(([day, blocks]) => (
        <View key={day} style={styles.dayGroup}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.dayLabel}>
            {formatDay(day).toUpperCase()}
          </ThemedText>
          {blocks.map((block) => {
            const task = tasks.find((t) => t.id === block.taskId);
            if (!task) return null;
            const expanded = expandedBlockId === block.id;
            return (
              <Pressable
                key={block.id}
                onPress={() => setExpandedBlockId(expanded ? null : block.id)}>
                <Card accentColor={getCourseAccent(task.courseId, courses)} style={styles.blockCard}>
                  <View style={styles.blockRow}>
                    <View style={styles.blockMain}>
                      <ThemedText type="meta" themeColor="textSecondary">
                        {formatTime(block.start)} – {formatTime(block.end)}
                      </ThemedText>
                      <ThemedText type="cardTitle">{task.title}</ThemedText>
                      <ThemedText type="meta" themeColor="textMuted">
                        {courseName(task.courseId)}
                      </ThemedText>
                    </View>
                  </View>
                  {expanded && (
                    <Button
                      label="Remove from schedule"
                      variant="outlined"
                      color={StatusColors.danger}
                      onPress={() => {
                        removeScheduledBlock(block.id);
                        setExpandedBlockId(null);
                      }}
                      style={styles.removeButton}
                    />
                  )}
                </Card>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  dayGroup: {
    gap: Spacing.two,
  },
  dayLabel: {
    letterSpacing: 0.6,
    marginLeft: Spacing.one,
  },
  blockCard: {
    gap: Spacing.two,
  },
  blockRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  blockMain: {
    flex: 1,
    gap: 2,
  },
  removeButton: {
    alignSelf: 'flex-start',
  },
});

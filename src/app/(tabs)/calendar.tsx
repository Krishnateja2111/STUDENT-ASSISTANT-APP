import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { EmptyState } from '@/components/empty-state';
import { ScheduledTaskCard } from '@/components/scheduled-task-card';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { REFERENCE_TODAY } from '@/lib/reference-date';
import type { ScheduledBlock } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const TODAY = REFERENCE_TODAY;
const WEEK_LENGTH = 7;

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localDateFromKey(dayKey: string): Date {
  const [year, month, day] = dayKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

function formatDayHeading(dayKey: string) {
  return localDateFromKey(dayKey)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase();
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function buildWeekStrip(startKey: string) {
  const start = localDateFromKey(startKey);
  return Array.from({ length: WEEK_LENGTH }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return {
      key: dayKeyOf(date),
      weekday: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNum: date.getDate(),
    };
  });
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
  const [selectedDay, setSelectedDay] = useState(TODAY);
  const theme = useTheme();

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';
  const groups = groupByDay(scheduledBlocks);
  const weekStrip = buildWeekStrip(TODAY);
  const dayBlocks = groups[selectedDay] ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        title="Calendar"
        right={
          selectedDay !== TODAY ? (
            <Button label="Today" variant="outlined" onPress={() => setSelectedDay(TODAY)} style={styles.todayButton} />
          ) : undefined
        }
      />

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekStrip}>
        {weekStrip.map((day) => {
          const selected = day.key === selectedDay;
          const hasTasks = (groups[day.key]?.length ?? 0) > 0;
          return (
            <Pressable key={day.key} onPress={() => setSelectedDay(day.key)} style={styles.dayCellTarget}>
              <View
                style={[
                  styles.dayCell,
                  selected
                    ? { backgroundColor: StatusColors.brand }
                    : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="meta" style={selected ? styles.dayCellTextSelected : { color: theme.textMuted }}>
                  {day.weekday}
                </ThemedText>
                <ThemedText type="cardTitle" style={selected ? styles.dayCellTextSelected : undefined}>
                  {day.dayNum}
                </ThemedText>
                <View
                  style={[
                    styles.dayDot,
                    { backgroundColor: hasTasks ? (selected ? '#ffffff' : StatusColors.brand) : 'transparent' },
                  ]}
                />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.dayGroup}>
        <ThemedText type="meta" themeColor="textMuted" style={styles.dayLabel}>
          {formatDayHeading(selectedDay)}
        </ThemedText>
        {dayBlocks.length === 0 && <EmptyState icon="calendar-outline" message="Nothing scheduled this day." />}
        {dayBlocks.map((block) => {
          const task = tasks.find((t) => t.id === block.taskId);
          if (!task) return null;
          const expanded = expandedBlockId === block.id;
          return (
            <ScheduledTaskCard
              key={block.id}
              time={`${formatTime(block.start)} – ${formatTime(block.end)}`}
              title={task.title}
              courseName={courseName(task.courseId)}
              accentColor={getCourseAccent(task.courseId, courses)}
              onPress={() => setExpandedBlockId(expanded ? null : block.id)}>
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
            </ScheduledTaskCard>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  todayButton: {
    paddingHorizontal: Spacing.three,
  },
  weekStrip: {
    gap: Spacing.two,
    paddingVertical: 2,
  },
  dayCellTarget: {
    minWidth: 44,
  },
  dayCell: {
    width: 44,
    height: 64,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dayCellTextSelected: {
    color: '#ffffff',
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
  dayGroup: {
    gap: Spacing.two,
  },
  dayLabel: {
    letterSpacing: 0.6,
    marginLeft: Spacing.one,
  },
  removeButton: {
    alignSelf: 'flex-start',
    marginTop: Spacing.one,
  },
});

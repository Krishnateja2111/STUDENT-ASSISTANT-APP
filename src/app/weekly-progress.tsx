import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Card } from '@/components/card';
import { ProgressBar } from '@/components/progress-bar';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatMinutes } from '@/lib/format-duration';
import { getNow } from '@/lib/reference-date';
import { useAppState } from '@/state/app-state';

const DAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function startOfWeek(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function dayKeyOf(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatWeekRange(start: Date, end: Date): string {
  const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const endLabel = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${startLabel} – ${endLabel}`;
}

/**
 * Weekly Progress — master spec's deliberately SIMPLE version (explicitly
 * not the earlier, overly-complicated one this replaces): week nav, a
 * Planned/Completed/Completion% summary, a daily bar chart, and per-course
 * bars — every number derived directly from real scheduledBlocks/tasks for
 * the selected week, nothing invented. "Recovery" is a single honest
 * currently-missed count (there's no historical event log to report a real
 * weekly trend from — see the master spec's "no fabricated data" rule), not
 * a fabricated weekly stat.
 */
export default function WeeklyProgressScreen() {
  const { tasks, courses, scheduledBlocks } = useAppState();
  const theme = useTheme();
  const [weekOffset, setWeekOffset] = useState(0);

  const weekStart = addDays(startOfWeek(getNow()), weekOffset * 7);
  const weekEnd = addDays(weekStart, 7);
  const isCurrentWeek = weekOffset === 0;

  const weekBlocks = scheduledBlocks.filter((b) => {
    const start = new Date(b.start);
    return start >= weekStart && start < weekEnd;
  });

  const taskById = new Map(tasks.map((t) => [t.id, t]));
  const weekTaskIds = new Set(weekBlocks.map((b) => b.taskId));
  const plannedCount = weekTaskIds.size;
  const completedCount = [...weekTaskIds].filter((id) => taskById.get(id)?.status === 'completed').length;
  const completionPct = plannedCount > 0 ? (completedCount / plannedCount) * 100 : 0;
  const plannedMinutes = weekBlocks.reduce(
    (sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000,
    0
  );

  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const dailyMinutes = days.map((day) => {
    const key = dayKeyOf(day);
    const dayBlocks = weekBlocks.filter((b) => b.start.startsWith(key));
    const planned = dayBlocks.reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000, 0);
    const completed = dayBlocks
      .filter((b) => taskById.get(b.taskId)?.status === 'completed')
      .reduce((sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000, 0);
    return { planned, completed };
  });
  const maxDailyMinutes = Math.max(1, ...dailyMinutes.map((d) => d.planned));

  const courseStats = courses
    .map((course) => {
      const courseTaskIds = new Set(tasks.filter((t) => t.courseId === course.id).map((t) => t.id));
      const weekCourseTaskIds = [...weekTaskIds].filter((id) => courseTaskIds.has(id));
      const completed = weekCourseTaskIds.filter((id) => taskById.get(id)?.status === 'completed').length;
      return { course, planned: weekCourseTaskIds.length, completed };
    })
    .filter((s) => s.planned > 0);

  const missedCount = tasks.filter((t) => t.status === 'missed').length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: 'Weekly Progress',
          // This screen lives outside the bottom-tab group (so the tab bar
          // isn't visible here — see _layout.tsx), and the default back
          // arrow is a small unlabeled icon that's easy to miss with no
          // other way out on the page. An explicit, labeled "Done" removes
          // any doubt about how to leave.
          //
          // Bug fix: router.back() is a silent no-op when there's no
          // in-app navigation history to go back to (a direct URL load, a
          // page refresh while already here) — reproduced live: the button
          // did nothing at all. router.canGoBack() lets this fall back to
          // a real, known destination instead of leaving no way out.
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/profile'))}
              hitSlop={8}
              style={styles.headerAction}>
              <ThemedText type="default" style={{ color: StatusColors.brand, fontWeight: '600' }}>
                Done
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <View style={styles.weekNav}>
        <Pressable
          onPress={() => setWeekOffset((w) => w - 1)}
          hitSlop={8}
          style={styles.weekNavButton}
          accessibilityRole="button"
          accessibilityLabel="Previous week">
          <Ionicons name="chevron-back" size={22} color={theme.textSecondary} />
        </Pressable>
        <View style={styles.weekLabelGroup}>
          <ThemedText type="cardTitle">{formatWeekRange(weekStart, addDays(weekEnd, -1))}</ThemedText>
          {isCurrentWeek && (
            <ThemedText type="small" themeColor="textMuted">
              This week
            </ThemedText>
          )}
        </View>
        <Pressable
          onPress={() => setWeekOffset((w) => w + 1)}
          hitSlop={8}
          style={styles.weekNavButton}
          accessibilityRole="button"
          accessibilityLabel="Next week">
          <Ionicons name="chevron-forward" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      <Card style={styles.summaryCard}>
        {plannedCount === 0 ? (
          <ThemedText themeColor="textSecondary">Nothing was scheduled this week.</ThemedText>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <ThemedText type="keyNumber">{plannedCount}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  Planned
                </ThemedText>
              </View>
              <View style={styles.summaryStat}>
                <ThemedText type="keyNumber">{completedCount}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  Completed
                </ThemedText>
              </View>
              <View style={styles.summaryStat}>
                <ThemedText type="keyNumber">{Math.round(completionPct)}%</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  Completion
                </ThemedText>
              </View>
            </View>
            <ProgressBar value={completionPct} color={StatusColors.success} />
            <ThemedText type="small" themeColor="textMuted">
              {formatMinutes(plannedMinutes)} planned this week
            </ThemedText>
          </>
        )}
      </Card>

      <View style={styles.section}>
        <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
          DAILY
        </ThemedText>
        <Card style={styles.chartCard}>
          <View style={styles.chartRow}>
            {days.map((day, i) => {
              const { planned, completed } = dailyMinutes[i];
              const barHeight = 64 * (planned / maxDailyMinutes);
              const completedHeight = planned > 0 ? barHeight * (completed / planned) : 0;
              const isToday = dayKeyOf(day) === dayKeyOf(getNow());
              return (
                <View key={i} style={styles.chartColumn}>
                  {/*
                    Bug fix (reported: "bars are mixed up with colors"):
                    the outer fill used to be a translucent BRAND color
                    with a solid SUCCESS-green overlay for the completed
                    portion — two different hues on the same bar. Both are
                    green now (light green = planned, solid green =
                    completed within it) — one color family, easy to read
                    at a glance: how full and how green.
                  */}
                  <View style={[styles.barTrack, { backgroundColor: theme.backgroundSelected }]}>
                    {planned > 0 && (
                      <View style={[styles.barFill, { height: Math.max(barHeight, 3), backgroundColor: `${StatusColors.success}33` }]}>
                        {completed > 0 && (
                          <View
                            style={[
                              styles.barFillCompleted,
                              { height: Math.max(completedHeight, 3), backgroundColor: StatusColors.success },
                            ]}
                          />
                        )}
                      </View>
                    )}
                  </View>
                  <ThemedText
                    type="small"
                    themeColor={isToday ? 'text' : 'textMuted'}
                    style={isToday ? styles.todayLabel : undefined}>
                    {DAY_LABELS[i]}
                  </ThemedText>
                </View>
              );
            })}
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
          BY COURSE
        </ThemedText>
        {courseStats.length === 0 ? (
          <ThemedText themeColor="textSecondary">No course activity this week.</ThemedText>
        ) : (
          courseStats.map(({ course, planned, completed }) => {
            const accent = getCourseAccent(course.id, courses);
            const pct = planned > 0 ? (completed / planned) * 100 : 0;
            return (
              <Card key={course.id} accentColor={accent} style={styles.courseCard}>
                <View style={styles.courseRow}>
                  <ThemedText type="cardTitle" style={styles.courseTitle}>
                    {course.name}
                  </ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {completed}/{planned}
                  </ThemedText>
                </View>
                <ProgressBar value={pct} color={accent} />
              </Card>
            );
          })
        )}
      </View>

      {missedCount > 0 && (
        <Card style={styles.recoveryCard}>
          <Ionicons name="refresh-circle-outline" size={18} color={StatusColors.warning} />
          <ThemedText type="meta" themeColor="textSecondary" style={styles.recoveryText}>
            {missedCount} task{missedCount > 1 ? 's' : ''} currently missed and awaiting recovery.
          </ThemedText>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerAction: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekNavButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekLabelGroup: {
    alignItems: 'center',
    gap: 2,
  },
  summaryCard: {
    gap: Spacing.two,
  },
  summaryRow: {
    flexDirection: 'row',
  },
  summaryStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    letterSpacing: 0.6,
  },
  chartCard: {
    paddingVertical: Spacing.four,
  },
  chartRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  chartColumn: {
    alignItems: 'center',
    gap: Spacing.one,
    flex: 1,
  },
  barTrack: {
    width: 16,
    height: 64,
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    justifyContent: 'flex-end',
    overflow: 'hidden',
  },
  barFillCompleted: {
    width: '100%',
  },
  todayLabel: {
    fontWeight: '700',
  },
  courseCard: {
    gap: Spacing.one,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  courseTitle: {
    flex: 1,
  },
  recoveryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  recoveryText: {
    flex: 1,
  },
});

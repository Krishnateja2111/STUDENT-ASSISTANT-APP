import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { dueLabel } from '@/lib/due-label';
import { formatMinutes } from '@/lib/format-duration';
import { formatFileSize, pickDocuments } from '@/lib/pick-document';
import { TASK_TYPE_LABEL } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

type TabKey = 'overview' | 'tasks' | 'materials';
const TABS: { key: TabKey; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'tasks', label: 'Tasks' },
  { key: 'materials', label: 'Materials' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatDateOnly(dateKey: string) {
  const [y, m, d] = dateKey.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatWeekdays(weekdays: number[]): string {
  const sorted = [...weekdays].sort();
  if (sorted.length === 7) return 'every day';
  if (sorted.join(',') === '1,2,3,4,5') return 'weekdays';
  if (sorted.join(',') === '0,6') return 'weekends';
  return sorted.map((w) => WEEKDAY_ABBR[w]).join(', ');
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, tasks, removeCourse, reopenTask, recurringStudyGoals, cancelRecurringStudyGoal } = useAppState();
  const { documents, addDocument, removeDocumentsByCourse } = useContentState();
  const theme = useTheme();
  const [tab, setTab] = useState<TabKey>('overview');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [cancelGoalId, setCancelGoalId] = useState<string | null>(null);

  const course = courses.find((c) => c.id === id);
  const accent = getCourseAccent(id, courses);
  const courseTasks = tasks.filter((t) => t.courseId === id);
  const courseGoals = recurringStudyGoals.filter((g) => g.courseId === id);
  const upcomingTasks = courseTasks
    .filter((t) => t.status !== 'completed')
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const completedTasks = courseTasks.filter((t) => t.status === 'completed');
  const nextDeadline = upcomingTasks[0];
  const courseDocuments = documents.filter((d) => d.courseId === id);

  const handleUpload = async () => {
    setUploadError(null);
    setUploading(true);
    const result = await pickDocuments();
    setUploading(false);
    if (result.status === 'error') {
      setUploadError(result.message);
      return;
    }
    if (result.status === 'cancelled') return;
    const uploadedAt = new Date().toISOString();
    for (const file of result.files) {
      addDocument({ ...file, courseId: id, uploadedAt });
    }
    if (result.skipped.length > 0) {
      setUploadError(`Skipped ${result.skipped.map((s) => `${s.fileName} (${s.reason})`).join(', ')}`);
    }
  };

  const handleDeleteCourse = () => {
    removeCourse(id);
    removeDocumentsByCourse(id);
    setShowDeleteConfirm(false);
    // Bug fix: router.back() is a silent no-op with no in-app navigation
    // history (a direct URL load, a page refresh while already here) — and
    // even when it does have history, the course this screen was showing
    // no longer exists, so "back" isn't really meaningful here either way;
    // the course list is always the right destination after a delete.
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/courses');
  };

  if (!course) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText themeColor="textSecondary">Course not found.</ThemedText>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: '' }} />

      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <ThemedText type="screenTitle" style={styles.titleText}>
          {course.name}
        </ThemedText>
        <Pressable
          onPress={() => router.push(`/course-entry?id=${course.id}`)}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Edit course">
          <Ionicons name="create-outline" size={22} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={[styles.tabRow, { borderBottomColor: theme.border }]}>
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={styles.tabTarget}>
              <ThemedText type="cardTitle" themeColor={active ? 'text' : 'textMuted'}>
                {t.label}
              </ThemedText>
              <View style={[styles.tabUnderline, active && { backgroundColor: accent }]} />
            </Pressable>
          );
        })}
      </View>

      {tab === 'overview' && (
        <View style={styles.section}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
            NEXT DEADLINE
          </ThemedText>
          {nextDeadline ? (
            <Card accentColor={accent} style={styles.deadlineCard}>
              <View style={styles.deadlineMain}>
                <ThemedText type="cardTitle">{nextDeadline.title}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  {formatDate(nextDeadline.dueDate)}
                </ThemedText>
              </View>
              <StatusBadge label={dueLabel(nextDeadline.dueDate).label} color={dueLabel(nextDeadline.dueDate).color} />
            </Card>
          ) : (
            <ThemedText themeColor="textSecondary">Nothing due — you&apos;re all caught up.</ThemedText>
          )}

          <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
            UPCOMING TASKS
          </ThemedText>
          {upcomingTasks.length === 0 && <ThemedText themeColor="textSecondary">No upcoming tasks.</ThemedText>}
          {upcomingTasks.map((task) => (
            <Card key={task.id} accentColor={accent} style={styles.taskCard}>
              <ThemedText type="cardTitle">{task.title}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {TASK_TYPE_LABEL[task.taskType]} · {formatDate(task.dueDate)} · {formatMinutes(task.estimatedMinutes)}
              </ThemedText>
            </Card>
          ))}

          {completedTasks.length > 0 && (
            <>
              <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
                COMPLETED
              </ThemedText>
              {completedTasks.map((task) => (
                <View key={task.id} style={styles.completedRow}>
                  <Ionicons name="checkmark-circle" size={18} color={StatusColors.success} />
                  <ThemedText type="default" themeColor="textSecondary" style={styles.completedText}>
                    {task.title}
                  </ThemedText>
                  <ThemedText type="meta" themeColor="textMuted">
                    {formatDate(task.dueDate)}
                  </ThemedText>
                  <Pressable
                    onPress={() => reopenTask(task.id)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Reopen ${task.title}`}>
                    <ThemedText type="small" style={{ color: StatusColors.brand }}>
                      Reopen
                    </ThemedText>
                  </Pressable>
                </View>
              ))}
            </>
          )}
        </View>
      )}

      {tab === 'tasks' && (
        <View style={styles.section}>
          {courseGoals.length > 0 && (
            <>
              <ThemedText type="meta" themeColor="textMuted" style={styles.sectionLabel}>
                RECURRING GOALS
              </ThemedText>
              {courseGoals.map((goal) => (
                <Card key={goal.id} accentColor={accent} style={styles.goalCard}>
                  <View style={styles.taskRow}>
                    <ThemedText type="cardTitle" style={styles.taskRowTitle}>
                      {goal.title}
                    </ThemedText>
                    <Pressable
                      onPress={() => setCancelGoalId(goal.id)}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={`Cancel ${goal.title}`}>
                      <ThemedText type="small" style={{ color: StatusColors.danger }}>
                        Cancel
                      </ThemedText>
                    </Pressable>
                  </View>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {formatMinutes(goal.dailyMinutes)}/day, {formatWeekdays(goal.weekdays)}, through {formatDateOnly(goal.endDate)}
                  </ThemedText>
                </Card>
              ))}
            </>
          )}

          {courseTasks.length === 0 && <EmptyState icon="checkmark-done-outline" message="No tasks for this course yet." />}
          {courseTasks.map((task) => (
            <Pressable key={task.id} onPress={() => router.push(`/task/${task.id}`)}>
              <Card accentColor={accent} style={styles.taskCard}>
                <View style={styles.taskRow}>
                  <ThemedText type="cardTitle" style={styles.taskRowTitle}>
                    {task.title}
                  </ThemedText>
                  {task.status === 'completed' && <StatusBadge label="Completed" color={StatusColors.success} />}
                  {task.status === 'missed' && <StatusBadge label="Missed" color={StatusColors.danger} />}
                </View>
                <ThemedText type="meta" themeColor="textSecondary">
                  {TASK_TYPE_LABEL[task.taskType]} · due {formatDate(task.dueDate)}
                </ThemedText>
              </Card>
            </Pressable>
          ))}
          <Button
            label="+ Add task"
            onPress={() => router.push(`/task-entry?courseId=${course.id}`)}
            style={styles.addTaskButton}
          />
        </View>
      )}

      {tab === 'materials' && (
        <View style={styles.section}>
          {courseDocuments.length === 0 && <EmptyState icon="document-text-outline" message="No documents attached yet." />}
          {courseDocuments.map((doc) => (
            <Pressable key={doc.id} onPress={() => router.push(`/document/${doc.id}`)}>
              <Card accentColor={accent} style={styles.docCard}>
                <Ionicons name="document-text-outline" size={20} color={StatusColors.brand} />
                <View style={styles.docMain}>
                  <ThemedText type="cardTitle">{doc.fileName}</ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {formatDate(doc.uploadedAt)} · {formatFileSize(doc.sizeBytes)}
                  </ThemedText>
                </View>
              </Card>
            </Pressable>
          ))}
          <Button
            label={uploading ? 'Opening picker…' : 'Upload document'}
            variant="outlined"
            disabled={uploading}
            onPress={handleUpload}
            style={styles.uploadButton}
          />
          {uploadError && (
            <ThemedText type="small" style={{ color: StatusColors.danger }}>
              {uploadError}
            </ThemedText>
          )}
        </View>
      )}

      <Button
        label="Delete course"
        color={StatusColors.danger}
        onPress={() => setShowDeleteConfirm(true)}
        style={styles.deleteButton}
      />

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete course?"
        description={`This removes "${course.name}" and all of its tasks and documents. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDeleteCourse}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <ConfirmDialog
        visible={cancelGoalId !== null}
        title="Cancel this recurring goal?"
        description="Removes every not-yet-done day still ahead. Days already completed or missed stay exactly as they are."
        confirmLabel="Cancel Goal"
        destructive
        onConfirm={() => {
          if (cancelGoalId) cancelRecurringStudyGoal(cancelGoalId);
          setCancelGoalId(null);
        }}
        onCancel={() => setCancelGoalId(null)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  dot: {
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  titleText: {
    flex: 1,
  },
  tabRow: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabTarget: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    gap: Spacing.two,
  },
  tabUnderline: {
    height: 2,
    width: '100%',
    borderRadius: 1,
  },
  section: {
    gap: Spacing.two,
  },
  sectionLabel: {
    letterSpacing: 0.6,
    marginTop: Spacing.one,
  },
  deadlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  deadlineMain: {
    flex: 1,
    gap: 2,
  },
  taskCard: {
    gap: 2,
  },
  goalCard: {
    gap: 2,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  taskRowTitle: {
    flex: 1,
  },
  addTaskButton: {
    marginTop: Spacing.one,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.one,
  },
  completedText: {
    flex: 1,
    textDecorationLine: 'line-through',
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  docMain: {
    flex: 1,
    gap: 2,
  },
  uploadButton: {
    marginTop: Spacing.two,
  },
  deleteButton: {
    marginTop: Spacing.two,
  },
});

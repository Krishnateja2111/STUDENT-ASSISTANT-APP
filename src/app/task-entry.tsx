import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DateTimePicker } from '@/components/datetime-picker';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { getCourseAccent } from '@/lib/course-accent';
import type { TaskType } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'exam_prep', label: 'Exam prep' },
  { value: 'graded_assignment', label: 'Graded assignment' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

const MAX_DURATION_MINUTES = 480; // 8h — a sensible upper bound for a single task session

function isValidDeadline(value: string): boolean {
  // Seconds are optional: every dueDate already persisted by this app (seed
  // tasks, anything the scheduling engine's own isoFromMs helpers produce)
  // includes them, so requiring an exact no-seconds match here silently
  // blocked Save on ANY untouched existing task's deadline — a real,
  // reproduced bug (see this phase's picker-wiring verification), not a
  // hypothetical. DateTimePicker itself never emits seconds, so this stays
  // just as strict for anything the picker actually produces.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value.trim())) return false;
  return !Number.isNaN(new Date(value.trim()).getTime());
}

function isValidDuration(value: string): boolean {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 && n <= MAX_DURATION_MINUTES;
}

export default function TaskEntryScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const { courses, tasks, addTask, updateTask, removeTask } = useAppState();
  const theme = useTheme();

  const existing = id ? tasks.find((t) => t.id === id) : undefined;

  const [initial] = useState(() => ({
    title: existing?.title ?? '',
    courseId: existing?.courseId ?? courses[0]?.id ?? '',
    taskType: existing?.taskType ?? ('graded_assignment' as TaskType),
    dueDate: existing?.dueDate ?? '',
    estimatedMinutes: existing ? String(existing.estimatedMinutes) : '',
  }));

  const [title, setTitle] = useState(initial.title);
  const [courseId, setCourseId] = useState(initial.courseId);
  const [taskType, setTaskType] = useState(initial.taskType);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [estimatedMinutes, setEstimatedMinutes] = useState(initial.estimatedMinutes);
  const [attemptedSave, setAttemptedSave] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const hasChanges =
    title !== initial.title ||
    courseId !== initial.courseId ||
    taskType !== initial.taskType ||
    dueDate !== initial.dueDate ||
    estimatedMinutes !== initial.estimatedMinutes;

  const { showDiscardDialog, confirmDiscard, cancelDiscard, leaveWithoutPrompt } = useUnsavedChangesGuard(hasChanges);

  const deadlineValid = isValidDeadline(dueDate);
  const durationValid = isValidDuration(estimatedMinutes);
  const canSave = title.trim().length > 0 && Boolean(courseId) && deadlineValid && durationValid;
  const showDeadlineError = attemptedSave && !deadlineValid;
  const showDurationError = attemptedSave && !durationValid;

  // Bug fix: router.back() is a silent no-op with no in-app navigation
  // history to go back to (a direct URL load, a page refresh while already
  // on this screen — reproduced live on Weekly Progress/Notifications, see
  // those files) — Dashboard is always a safe, real destination.
  const safeBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/dashboard');
  };

  const handleSave = () => {
    setAttemptedSave(true);
    if (!canSave) return;
    const payload = {
      title: title.trim(),
      courseId,
      taskType,
      dueDate: dueDate.trim(),
      estimatedMinutes: Number(estimatedMinutes),
    };
    // addTask/updateTask attempt to place the task and return true when
    // that produced a meaningful schedule change worth reviewing (Phase
    // 3C) — in that case go straight to the same review screen the
    // missed-task flow already uses, instead of just going back.
    const reviewNeeded = existing ? updateTask(existing.id, payload) : addTask(payload);
    leaveWithoutPrompt();
    if (reviewNeeded) {
      router.replace('/reschedule');
    } else {
      safeBack();
    }
  };

  const handleDelete = () => {
    if (!existing) return;
    removeTask(existing.id);
    leaveWithoutPrompt();
    setShowDeleteConfirm(false);
    safeBack();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: existing ? 'Edit Task' : 'New Task',
          headerLeft: () => (
            <Pressable onPress={safeBack} hitSlop={8} style={styles.headerAction}>
              <ThemedText type="default" themeColor="textSecondary">
                Cancel
              </ThemedText>
            </Pressable>
          ),
          // Intentionally never `disabled`: when input is invalid, tapping Save
          // must still register so handleSave can reveal what needs fixing —
          // a disabled Pressable would swallow that tap and the errors could
          // never surface. The dimmed color is a visual hint only.
          headerRight: () => (
            <Pressable onPress={handleSave} hitSlop={8} style={styles.headerAction}>
              <ThemedText type="default" style={{ color: canSave ? StatusColors.brand : theme.textMuted, fontWeight: '700' }}>
                Save
              </ThemedText>
            </Pressable>
          ),
        }}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        TITLE
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="e.g. Problem Set 5"
        placeholderTextColor={theme.textMuted}
        value={title}
        onChangeText={setTitle}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        COURSE
      </ThemedText>
      <View style={styles.chipRow}>
        {courses.map((course) => {
          const selected = courseId === course.id;
          const accent = getCourseAccent(course.id, courses);
          return (
            <Pressable key={course.id} onPress={() => setCourseId(course.id)}>
              <View
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: accent }
                    : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                  {course.name}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        TASK TYPE
      </ThemedText>
      <View style={styles.chipRow}>
        {TASK_TYPES.map((t) => {
          const selected = taskType === t.value;
          return (
            <Pressable key={t.value} onPress={() => setTaskType(t.value)}>
              <View
                style={[
                  styles.chip,
                  selected
                    ? { backgroundColor: StatusColors.brand }
                    : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                  {t.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        DEADLINE
      </ThemedText>
      <DateTimePicker value={dueDate} onChange={setDueDate} />
      {showDeadlineError && (
        <ThemedText type="small" style={styles.errorText}>
          Choose a due date and time.
        </ThemedText>
      )}

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        ESTIMATED DURATION (MINUTES)
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: showDurationError ? StatusColors.danger : theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="60"
        placeholderTextColor={theme.textMuted}
        keyboardType="numeric"
        value={estimatedMinutes}
        onChangeText={setEstimatedMinutes}
      />
      {showDurationError && (
        <ThemedText type="small" style={styles.errorText}>
          Enter minutes between 1 and {MAX_DURATION_MINUTES} (8 hours)
        </ThemedText>
      )}

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        PRIORITY
      </ThemedText>
      <View style={[styles.priorityRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
        <Ionicons name="sparkles-outline" size={16} color={theme.textSecondary} />
        <ThemedText type="small" themeColor="textSecondary">
          Automatically calculated from deadline and task type
        </ThemedText>
      </View>

      {existing && (
        <Pressable onPress={() => setShowDeleteConfirm(true)} style={styles.deleteRow}>
          <ThemedText type="default" style={{ color: StatusColors.danger }}>
            Delete task
          </ThemedText>
        </Pressable>
      )}

      <ConfirmDialog
        visible={showDeleteConfirm}
        title="Delete task?"
        description={`"${existing?.title ?? 'This task'}" and its scheduled time will be removed. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={handleDelete}
        onCancel={() => setShowDeleteConfirm(false)}
      />
      <ConfirmDialog
        visible={showDiscardDialog}
        title="Discard changes?"
        description="You have unsaved changes. Are you sure you want to leave?"
        cancelLabel="Keep Editing"
        confirmLabel="Discard"
        destructive
        onConfirm={confirmDiscard}
        onCancel={cancelDiscard}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 0.6,
    marginTop: Spacing.two,
    marginBottom: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  errorText: {
    color: StatusColors.danger,
    marginTop: 4,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: MinTouchTarget,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  headerAction: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
  priorityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginBottom: Spacing.two,
  },
  deleteRow: {
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.two,
    marginBottom: Spacing.four,
  },
});

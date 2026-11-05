import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ConfirmDialog } from '@/components/confirm-dialog';
import { DateField } from '@/components/date-field';
import { DateTimePicker } from '@/components/datetime-picker';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useUnsavedChangesGuard } from '@/hooks/use-unsaved-changes-guard';
import { getCourseAccent } from '@/lib/course-accent';
import { enumerateRecurringDates } from '@/lib/recurring-dates';
import { getToday } from '@/lib/reference-date';
import type { TaskType } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'exam_prep', label: 'Exam prep' },
  { value: 'graded_assignment', label: 'Graded assignment' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6];
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

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

function isValidDateOnly(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return !Number.isNaN(new Date(value).getTime());
}

export default function TaskEntryScreen() {
  // courseId is an optional pre-fill for a brand-new task only (e.g. the
  // "+ Add task" button on a course's own detail page) — an existing task
  // being edited always keeps its own real courseId, never this param.
  const { id, courseId: presetCourseId } = useLocalSearchParams<{ id?: string; courseId?: string }>();
  const { courses, tasks, addTask, updateTask, removeTask, addRecurringStudyGoal } = useAppState();
  const theme = useTheme();

  const existing = id ? tasks.find((t) => t.id === id) : undefined;
  const presetCourseExists = Boolean(presetCourseId && courses.some((c) => c.id === presetCourseId));

  const [initial] = useState(() => ({
    title: existing?.title ?? '',
    courseId: existing?.courseId ?? (presetCourseExists ? presetCourseId! : courses[0]?.id ?? ''),
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

  // Recurring daily goal ("45 min of Exam Prep every day until Oct 10") —
  // only offered when creating a brand-new task; editing one day's already-
  // generated instance is just an ordinary single-task edit, never turns it
  // into a new series.
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurStartDate, setRecurStartDate] = useState(getToday());
  const [recurEndDate, setRecurEndDate] = useState('');
  const [recurWeekdays, setRecurWeekdays] = useState<number[]>(EVERY_DAY);

  const hasChanges =
    title !== initial.title ||
    courseId !== initial.courseId ||
    taskType !== initial.taskType ||
    dueDate !== initial.dueDate ||
    estimatedMinutes !== initial.estimatedMinutes ||
    isRecurring;

  const { showDiscardDialog, confirmDiscard, cancelDiscard, leaveWithoutPrompt } = useUnsavedChangesGuard(hasChanges);

  const deadlineValid = isValidDeadline(dueDate);
  const durationValid = isValidDuration(estimatedMinutes);
  const recurStartValid = isValidDateOnly(recurStartDate);
  const recurEndValid = isValidDateOnly(recurEndDate) && recurStartValid && recurEndDate >= recurStartDate;
  const recurDatesCount = recurStartValid && recurEndValid ? enumerateRecurringDates(recurStartDate, recurEndDate, recurWeekdays).length : 0;
  const recurValid = recurStartValid && recurEndValid && recurWeekdays.length > 0 && recurDatesCount > 0;

  const canSave = isRecurring
    ? title.trim().length > 0 && Boolean(courseId) && durationValid && recurValid
    : title.trim().length > 0 && Boolean(courseId) && deadlineValid && durationValid;
  const showDeadlineError = attemptedSave && !isRecurring && !deadlineValid;
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

    if (isRecurring) {
      // Bulk creation never routes through the review flow (see
      // addRecurringStudyGoal's own doc comment) -- reviewing a dozen+
      // individual placements one at a time isn't usable, and a single new
      // task landing in free time or honestly overflowing was already
      // silent, unreviewed behavior even for one addTask.
      addRecurringStudyGoal({
        courseId,
        title: title.trim(),
        taskType,
        dailyMinutes: Number(estimatedMinutes),
        startDate: recurStartDate,
        endDate: recurEndDate,
        weekdays: recurWeekdays,
      });
      leaveWithoutPrompt();
      safeBack();
      return;
    }

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

      {!existing && (
        <>
          <View style={[styles.recurringRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}>
            <View style={styles.recurringText}>
              <ThemedText type="cardTitle">Repeat daily until a target date</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A little time toward this every day, instead of one big block
              </ThemedText>
            </View>
            <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ true: StatusColors.brand }} />
          </View>
        </>
      )}

      {isRecurring ? (
        <>
          <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
            START DATE
          </ThemedText>
          <DateField value={recurStartDate} onChange={setRecurStartDate} placeholder="Choose a start date" minDate={getToday()} />

          <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
            TARGET DATE (DEADLINE)
          </ThemedText>
          <DateField value={recurEndDate} onChange={setRecurEndDate} placeholder="Choose a target date" minDate={recurStartDate} />
          {attemptedSave && !recurEndValid && (
            <ThemedText type="small" style={styles.errorText}>
              Choose a target date on or after the start date.
            </ThemedText>
          )}

          <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
            REPEAT ON
          </ThemedText>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setRecurWeekdays(EVERY_DAY)}>
              <View style={[styles.presetChip, { borderColor: theme.border }]}>
                <ThemedText type="small">Every day</ThemedText>
              </View>
            </Pressable>
            <Pressable onPress={() => setRecurWeekdays(WEEKDAYS_ONLY)}>
              <View style={[styles.presetChip, { borderColor: theme.border }]}>
                <ThemedText type="small">Weekdays</ThemedText>
              </View>
            </Pressable>
          </View>
          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, weekday) => {
              const selected = recurWeekdays.includes(weekday);
              return (
                <Pressable
                  key={weekday}
                  onPress={() =>
                    setRecurWeekdays((prev) =>
                      prev.includes(weekday) ? prev.filter((w) => w !== weekday) : [...prev, weekday].sort()
                    )
                  }
                  style={[
                    styles.weekdayChip,
                    selected
                      ? { backgroundColor: StatusColors.brand }
                      : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                  ]}>
                  <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                    {label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
          {attemptedSave && recurStartValid && recurEndValid && recurWeekdays.length === 0 && (
            <ThemedText type="small" style={styles.errorText}>
              Choose at least one day.
            </ThemedText>
          )}
          {recurStartValid && recurEndValid && recurWeekdays.length > 0 && (
            <ThemedText type="small" themeColor="textSecondary" style={styles.recurSummary}>
              {recurDatesCount === 0
                ? "That range doesn't include any of the selected days."
                : `Creates ${recurDatesCount} task${recurDatesCount === 1 ? '' : 's'}, one per day.`}
            </ThemedText>
          )}
        </>
      ) : (
        <>
          <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
            DEADLINE
          </ThemedText>
          <DateTimePicker value={dueDate} onChange={setDueDate} />
          {showDeadlineError && (
            <ThemedText type="small" style={styles.errorText}>
              Choose a due date and time.
            </ThemedText>
          )}
        </>
      )}

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        {isRecurring ? 'MINUTES PER DAY' : 'ESTIMATED DURATION (MINUTES)'}
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
  recurringRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    marginTop: Spacing.two,
  },
  recurringText: {
    flex: 1,
    gap: 2,
  },
  presetChip: {
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: Spacing.one,
    marginTop: Spacing.two,
  },
  weekdayChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  recurSummary: {
    marginTop: Spacing.two,
  },
});

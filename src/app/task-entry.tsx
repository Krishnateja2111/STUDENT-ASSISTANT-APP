import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import type { TaskType } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'exam_prep', label: 'Exam prep' },
  { value: 'graded_assignment', label: 'Graded assignment' },
  { value: 'reading', label: 'Reading' },
  { value: 'other', label: 'Other' },
];

export default function TaskEntryScreen() {
  const { courses, addTask } = useAppState();
  const theme = useTheme();

  const [title, setTitle] = useState('');
  const [courseId, setCourseId] = useState(courses[0]?.id ?? '');
  const [taskType, setTaskType] = useState<TaskType>('graded_assignment');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  const canSave = title.trim().length > 0 && courseId && dueDate.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    addTask({
      title: title.trim(),
      courseId,
      taskType,
      dueDate: dueDate.trim(),
      estimatedMinutes: Number(estimatedMinutes) || 30,
    });
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
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
      {/* TODO(ui): swap for a real date/time picker; kept as text input to
          avoid pulling in a native-only picker dependency during this
          UI-validation pass. */}
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={theme.textMuted}
        value={dueDate}
        onChangeText={setDueDate}
      />

      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        ESTIMATED DURATION (MINUTES)
      </ThemedText>
      <TextInput
        style={[
          styles.input,
          { color: theme.text, borderColor: theme.border, backgroundColor: theme.backgroundElement },
        ]}
        placeholder="60"
        placeholderTextColor={theme.textMuted}
        keyboardType="numeric"
        value={estimatedMinutes}
        onChangeText={setEstimatedMinutes}
      />

      <Button label="Save task" onPress={handleSave} disabled={!canSave} style={styles.saveButton} />
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
  saveButton: {
    marginTop: Spacing.four,
  },
});

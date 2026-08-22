import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
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
      <ThemedText type="smallBold" themeColor="textSecondary">
        Title
      </ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="e.g. Problem Set 5"
        placeholderTextColor={theme.textSecondary}
        value={title}
        onChangeText={setTitle}
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        Course
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {courses.map((course) => (
          <Pressable key={course.id} onPress={() => setCourseId(course.id)}>
            <ThemedView
              type={courseId === course.id ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small">{course.name}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedText type="smallBold" themeColor="textSecondary">
        Task type
      </ThemedText>
      <ThemedView style={styles.chipRow}>
        {TASK_TYPES.map((t) => (
          <Pressable key={t.value} onPress={() => setTaskType(t.value)}>
            <ThemedView
              type={taskType === t.value ? 'backgroundSelected' : 'backgroundElement'}
              style={styles.chip}>
              <ThemedText type="small">{t.label}</ThemedText>
            </ThemedView>
          </Pressable>
        ))}
      </ThemedView>

      <ThemedText type="smallBold" themeColor="textSecondary">
        Deadline
      </ThemedText>
      {/* TODO(ui): swap for a real date/time picker; kept as text input to
          avoid pulling in a native-only picker dependency during this
          UI-validation pass. */}
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="YYYY-MM-DDTHH:mm"
        placeholderTextColor={theme.textSecondary}
        value={dueDate}
        onChangeText={setDueDate}
      />

      <ThemedText type="smallBold" themeColor="textSecondary">
        Estimated duration (minutes)
      </ThemedText>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.backgroundSelected }]}
        placeholder="60"
        placeholderTextColor={theme.textSecondary}
        keyboardType="numeric"
        value={estimatedMinutes}
        onChangeText={setEstimatedMinutes}
      />

      <Pressable
        style={[styles.saveButton, !canSave && styles.saveButtonDisabled]}
        disabled={!canSave}
        onPress={handleSave}>
        <ThemedText style={styles.saveButtonText}>Save task</ThemedText>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two + 2,
    fontSize: 16,
    marginBottom: Spacing.two,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    marginBottom: Spacing.two,
    backgroundColor: 'transparent',
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  saveButton: {
    backgroundColor: '#3C87F7',
    borderRadius: Spacing.two,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    marginTop: Spacing.three,
  },
  saveButtonDisabled: {
    opacity: 0.5,
  },
  saveButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
});

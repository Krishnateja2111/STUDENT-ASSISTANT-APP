import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

export default function CoursesScreen() {
  const { courses, tasks } = useAppState();
  const { documents } = useContentState();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="screenTitle">Courses</ThemedText>

      {courses.map((course) => {
        const taskCount = tasks.filter((t) => t.courseId === course.id).length;
        const documentCount = documents.filter((d) => d.courseId === course.id).length;
        return (
          <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}`)}>
            <Card accentColor={getCourseAccent(course.id, courses)} style={styles.courseCard}>
              <ThemedText type="cardTitle">{course.name}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {taskCount} task{taskCount === 1 ? '' : 's'} · {documentCount} document
                {documentCount === 1 ? '' : 's'}
              </ThemedText>
            </Card>
          </Pressable>
        );
      })}

      {courses.length === 0 && (
        <ThemedView style={styles.emptyState}>
          <ThemedText themeColor="textSecondary">No courses yet.</ThemedText>
        </ThemedView>
      )}

      <Button label="+ Add course" onPress={() => router.push('/course-entry')} style={styles.addButton} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  courseCard: {
    gap: 2,
  },
  emptyState: {
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  addButton: {
    marginTop: Spacing.two,
  },
});

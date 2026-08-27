import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/progress-bar';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import { useAppState } from '@/state/app-state';

function courseCode(name: string): string {
  const firstToken = name.split(/[\s–-]+/).find(Boolean) ?? name;
  return firstToken.slice(0, 4).toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CoursesScreen() {
  const { courses, tasks } = useAppState();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader title="Courses" />

      {courses.map((course) => {
        const courseTasks = tasks.filter((t) => t.courseId === course.id);
        const completedTasks = courseTasks.filter((t) => t.status === 'completed');
        const progressPct = courseTasks.length > 0 ? (completedTasks.length / courseTasks.length) * 100 : 0;
        const upcoming = courseTasks
          .filter((t) => t.status !== 'completed')
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0];
        const accent = getCourseAccent(course.id, courses);

        return (
          <Pressable key={course.id} onPress={() => router.push(`/course/${course.id}`)}>
            <Card style={styles.courseCard}>
              <View style={styles.topRow}>
                <View style={[styles.badge, { backgroundColor: `${accent}1A` }]}>
                  <ThemedText type="smallBold" style={{ color: accent }}>
                    {courseCode(course.name)}
                  </ThemedText>
                </View>
                <View style={styles.titleGroup}>
                  <ThemedText type="cardTitle">{course.name}</ThemedText>
                  <ThemedText type="meta" themeColor="textSecondary">
                    {courseTasks.length} task{courseTasks.length === 1 ? '' : 's'}
                    {upcoming ? ` · Next: ${formatDate(upcoming.dueDate)}` : ''}
                  </ThemedText>
                </View>
                <ThemedText type="smallBold" themeColor="textSecondary">
                  {Math.round(progressPct)}%
                </ThemedText>
              </View>
              <ProgressBar value={progressPct} color={accent} />
            </Card>
          </Pressable>
        );
      })}

      {courses.length === 0 && <EmptyState icon="school-outline" message="No courses yet." />}

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
    gap: Spacing.two,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  badge: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleGroup: {
    flex: 1,
    gap: 2,
  },
  addButton: {
    marginTop: Spacing.two,
  },
});

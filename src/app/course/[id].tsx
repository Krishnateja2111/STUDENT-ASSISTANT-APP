import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatFileSize, pickDocument } from '@/lib/pick-document';
import { TASK_TYPE_LABEL } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CourseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses, tasks } = useAppState();
  const { documents, addDocument } = useContentState();

  const course = courses.find((c) => c.id === id);
  const accent = getCourseAccent(id, courses);
  const courseTasks = tasks.filter((t) => t.courseId === id);
  const courseDocuments = documents.filter((d) => d.courseId === id);

  const handleUpload = async () => {
    const file = await pickDocument();
    if (!file) return;
    addDocument({ ...file, courseId: id, uploadedAt: new Date().toISOString() });
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
      <Stack.Screen options={{ title: course.name }} />

      <View style={styles.header}>
        <View style={[styles.dot, { backgroundColor: accent }]} />
        <ThemedText type="screenTitle" style={styles.titleText}>
          {course.name}
        </ThemedText>
      </View>
      <Button
        label="Edit course"
        variant="outlined"
        onPress={() => router.push(`/course-entry?id=${course.id}`)}
        style={styles.editButton}
      />

      <ThemedText type="sectionTitle" style={styles.sectionSpacing}>
        Tasks
      </ThemedText>
      {courseTasks.length === 0 && <ThemedText themeColor="textSecondary">No tasks for this course yet.</ThemedText>}
      {courseTasks.map((task) => (
        <Card key={task.id} accentColor={accent} style={styles.taskCard}>
          <ThemedText type="cardTitle">{task.title}</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            {TASK_TYPE_LABEL[task.taskType]} · due {formatDate(task.dueDate)} · {task.status}
          </ThemedText>
        </Card>
      ))}

      <ThemedText type="sectionTitle" style={styles.sectionSpacing}>
        Documents
      </ThemedText>
      {courseDocuments.length === 0 && (
        <ThemedText themeColor="textSecondary">No documents attached yet.</ThemedText>
      )}
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
      <Button label="Upload document" variant="outlined" onPress={handleUpload} style={styles.uploadButton} />
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
  editButton: {
    alignSelf: 'flex-start',
  },
  sectionSpacing: {
    marginTop: Spacing.two,
  },
  taskCard: {
    gap: 2,
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
});

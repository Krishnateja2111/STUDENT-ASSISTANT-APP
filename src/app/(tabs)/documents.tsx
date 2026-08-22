import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ThemedText } from '@/components/themed-text';
import { Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { formatFileSize, pickDocument } from '@/lib/pick-document';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DocumentsScreen() {
  const { courses } = useAppState();
  const { documents, addDocument } = useContentState();
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [targetCourseId, setTargetCourseId] = useState(courses[0]?.id ?? '');

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';

  const handlePickFile = async () => {
    const file = await pickDocument();
    if (!file) return;
    addDocument({ ...file, courseId: targetCourseId, uploadedAt: new Date().toISOString() });
    setUploading(false);
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="screenTitle">Documents</ThemedText>

      {uploading ? (
        <Card style={styles.uploadCard}>
          <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
            COURSE
          </ThemedText>
          <View style={styles.chipRow}>
            {courses.map((course) => {
              const selected = targetCourseId === course.id;
              const accent = getCourseAccent(course.id, courses);
              return (
                <Pressable key={course.id} onPress={() => setTargetCourseId(course.id)}>
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
          <View style={styles.uploadActions}>
            <Button label="Choose file" onPress={handlePickFile} disabled={!targetCourseId} style={styles.flexButton} />
            <Button label="Cancel" variant="outlined" onPress={() => setUploading(false)} style={styles.flexButton} />
          </View>
        </Card>
      ) : (
        <Button label="+ Upload document" onPress={() => setUploading(true)} />
      )}

      {documents.length === 0 && (
        <ThemedText themeColor="textSecondary" style={styles.emptyState}>
          No documents uploaded yet.
        </ThemedText>
      )}

      {documents.map((doc) => (
        <Pressable key={doc.id} onPress={() => router.push(`/document/${doc.id}`)}>
          <Card accentColor={getCourseAccent(doc.courseId, courses)} style={styles.docCard}>
            <Ionicons name="document-text-outline" size={20} color={StatusColors.brand} />
            <View style={styles.docMain}>
              <ThemedText type="cardTitle">{doc.fileName}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {courseName(doc.courseId)} · {formatDate(doc.uploadedAt)} · {formatFileSize(doc.sizeBytes)}
              </ThemedText>
            </View>
          </Card>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  uploadCard: {
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 0.6,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.five,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '600',
  },
  uploadActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  flexButton: {
    flex: 1,
  },
  emptyState: {
    textAlign: 'center',
    marginTop: Spacing.four,
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
});

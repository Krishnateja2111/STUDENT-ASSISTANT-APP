import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { EmptyState } from '@/components/empty-state';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { fileTypeMeta, type DocumentFilter } from '@/lib/file-type-meta';
import { formatFileSize, pickDocument } from '@/lib/pick-document';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

const FILTERS: { key: DocumentFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pdf', label: 'PDF' },
  { key: 'image', label: 'Images' },
  { key: 'other', label: 'Other' },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function DocumentsScreen() {
  const { courses } = useAppState();
  const { documents, addDocument } = useContentState();
  const theme = useTheme();
  const [uploading, setUploading] = useState(false);
  const [targetCourseId, setTargetCourseId] = useState(courses[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>('all');

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';

  const handlePickFile = async () => {
    const file = await pickDocument();
    if (!file) return;
    addDocument({ ...file, courseId: targetCourseId, uploadedAt: new Date().toISOString() });
    setUploading(false);
  };

  const visibleDocuments = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents.filter((doc) => {
      const matchesFilter = filter === 'all' || fileTypeMeta(doc.mimeType).category === filter;
      const matchesQuery =
        q.length === 0 ||
        doc.fileName.toLowerCase().includes(q) ||
        (courses.find((c) => c.id === doc.courseId)?.name ?? '').toLowerCase().includes(q);
      return matchesFilter && matchesQuery;
    });
  }, [documents, query, filter, courses]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ScreenHeader
        title="Documents"
        right={
          <Pressable onPress={() => setUploading((v) => !v)} hitSlop={8}>
            <Ionicons name="cloud-upload-outline" size={24} color={theme.text} />
          </Pressable>
        }
      />

      <View style={[styles.searchBar, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
        <Ionicons name="search" size={16} color={theme.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: theme.text }]}
          placeholder="Search documents"
          placeholderTextColor={theme.textMuted}
          value={query}
          onChangeText={setQuery}
        />
      </View>

      <View style={styles.chipRow}>
        {FILTERS.map((f) => {
          const selected = filter === f.key;
          return (
            <Pressable key={f.key} onPress={() => setFilter(f.key)}>
              <View
                style={[
                  styles.filterChip,
                  selected
                    ? { backgroundColor: theme.text }
                    : { backgroundColor: theme.backgroundElement, borderWidth: 1, borderColor: theme.border },
                ]}>
                <ThemedText type="small" style={selected ? { color: theme.background, fontWeight: '600' } : undefined}>
                  {f.label}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>

      {uploading && (
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
      )}

      {visibleDocuments.length === 0 && (
        <EmptyState
          icon="document-text-outline"
          message={documents.length === 0 ? 'No documents uploaded yet.' : 'No documents match your search.'}
        />
      )}

      {visibleDocuments.map((doc) => {
        const meta = fileTypeMeta(doc.mimeType);
        return (
          <Pressable key={doc.id} onPress={() => router.push(`/document/${doc.id}`)}>
            <Card style={styles.docCard}>
              <View style={[styles.docIcon, { backgroundColor: `${meta.color}1A` }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={styles.docMain}>
                <ThemedText type="cardTitle">{doc.fileName}</ThemedText>
                <ThemedText type="meta" themeColor="textSecondary">
                  {courseName(doc.courseId)} · {formatDate(doc.uploadedAt)} · {formatFileSize(doc.sizeBytes)}
                </ThemedText>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </Card>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    height: '100%',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    minHeight: 32,
    justifyContent: 'center',
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  uploadCard: {
    gap: Spacing.two,
  },
  label: {
    letterSpacing: 0.6,
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
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  docIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  docMain: {
    flex: 1,
    gap: 2,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { EmptyState } from '@/components/empty-state';
import { NavMenu } from '@/components/nav-menu';
import { ScreenHeader } from '@/components/screen-header';
import { ThemedText } from '@/components/themed-text';
import { IconColors, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCourseAccent } from '@/lib/course-accent';
import { courseCode } from '@/lib/course-code';
import { fileTypeMeta, type DocumentFilter } from '@/lib/file-type-meta';
import { pickDocuments } from '@/lib/pick-document';
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
  const { documents, addDocument, removeDocuments } = useContentState();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [uploading, setUploading] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [targetCourseId, setTargetCourseId] = useState(courses[0]?.id ?? '');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<DocumentFilter>('all');
  const [showNavMenu, setShowNavMenu] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const courseName = (courseId: string) => courses.find((c) => c.id === courseId)?.name ?? 'Unknown course';

  const enterSelectMode = () => {
    setUploading(false);
    setSelectMode(true);
  };
  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePickFile = async () => {
    setPickerError(null);
    setPickerBusy(true);
    const result = await pickDocuments();
    setPickerBusy(false);
    if (result.status === 'error') {
      setPickerError(result.message);
      return;
    }
    if (result.status === 'cancelled') return;
    const uploadedAt = new Date().toISOString();
    for (const file of result.files) {
      addDocument({ ...file, courseId: targetCourseId, uploadedAt });
    }
    // Some files can be picked and others skipped (e.g. one was too large)
    // in the same batch -- report that instead of silently dropping them.
    if (result.skipped.length > 0) {
      setPickerError(`Skipped ${result.skipped.map((s) => `${s.fileName} (${s.reason})`).join(', ')}`);
    }
    if (result.files.length > 0) setUploading(false);
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
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
      <ScreenHeader
        title={selectMode ? `${selectedIds.size} selected` : 'Documents'}
        onMenuPress={selectMode ? undefined : () => setShowNavMenu(true)}
        right={
          selectMode ? (
            <Pressable
              onPress={exitSelectMode}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Cancel selection">
              <ThemedText type="default" style={{ color: StatusColors.brand, fontWeight: '600' }}>
                Cancel
              </ThemedText>
            </Pressable>
          ) : (
            <View style={styles.headerRight}>
              {documents.length > 0 && (
                <Pressable
                  onPress={enterSelectMode}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel="Select documents">
                  <Ionicons name="checkmark-circle" size={24} color={IconColors.oliveGold} />
                </Pressable>
              )}
              <Pressable
                onPress={() => setUploading((v) => !v)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Upload document">
                <Ionicons name="cloud-upload" size={24} color={StatusColors.brand} />
              </Pressable>
            </View>
          )
        }
      />

      {selectMode && (
        <View style={styles.selectBar}>
          <Button
            label={selectedIds.size === visibleDocuments.length ? 'Clear all' : 'Select all'}
            variant="outlined"
            onPress={() =>
              setSelectedIds(
                selectedIds.size === visibleDocuments.length
                  ? new Set()
                  : new Set(visibleDocuments.map((d) => d.id))
              )
            }
            style={styles.flexButton}
          />
          <Button
            label={selectedIds.size > 0 ? `Delete (${selectedIds.size})` : 'Delete'}
            color={StatusColors.danger}
            disabled={selectedIds.size === 0}
            onPress={() => setShowDeleteConfirm(true)}
            style={styles.flexButton}
          />
        </View>
      )}

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
            <Button
              label={pickerBusy ? 'Opening picker…' : 'Choose files'}
              onPress={handlePickFile}
              disabled={!targetCourseId || pickerBusy}
              style={styles.flexButton}
            />
            <Button
              label="Cancel"
              variant="outlined"
              onPress={() => {
                setUploading(false);
                setPickerError(null);
              }}
              style={styles.flexButton}
            />
          </View>
          {pickerError && (
            <ThemedText type="small" style={styles.errorText}>
              {pickerError}
            </ThemedText>
          )}
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
        const checked = selectedIds.has(doc.id);
        return (
          <Pressable
            key={doc.id}
            onPress={() => (selectMode ? toggleSelected(doc.id) : router.push(`/document/${doc.id}`))}
            onLongPress={() => {
              if (!selectMode) {
                enterSelectMode();
                toggleSelected(doc.id);
              }
            }}>
            <Card style={[styles.docCard, selectMode && checked && styles.docCardSelected]}>
              {selectMode && (
                <Ionicons
                  name={checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={checked ? StatusColors.brand : theme.textMuted}
                />
              )}
              <View style={[styles.docIcon, { backgroundColor: `${meta.color}1A` }]}>
                <Ionicons name={meta.icon} size={20} color={meta.color} />
              </View>
              <View style={styles.docMain}>
                <ThemedText type="cardTitle" numberOfLines={1}>
                  {doc.fileName}
                </ThemedText>
                <ThemedText type="meta" themeColor="textSecondary" numberOfLines={1}>
                  {courseCode(courseName(doc.courseId))} · {formatDate(doc.uploadedAt)}
                </ThemedText>
              </View>
              {!selectMode && <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}
            </Card>
          </Pressable>
        );
      })}

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={`Delete ${selectedIds.size} ${selectedIds.size === 1 ? 'document' : 'documents'}?`}
        description="They'll be permanently removed. This can't be undone."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          removeDocuments([...selectedIds]);
          setShowDeleteConfirm(false);
          exitSelectMode();
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />

      <NavMenu visible={showNavMenu} onClose={() => setShowNavMenu(false)} />
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
  errorText: {
    color: StatusColors.danger,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  selectBar: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  docCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  docCardSelected: {
    borderWidth: 1,
    borderColor: StatusColors.brand,
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

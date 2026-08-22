import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatFileSize } from '@/lib/pick-document';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { courses } = useAppState();
  const { documents } = useContentState();
  const theme = useTheme();

  const doc = documents.find((d) => d.id === id);
  const courseName = doc ? (courses.find((c) => c.id === doc.courseId)?.name ?? 'Unknown course') : '';
  const isImage = doc?.mimeType.startsWith('image/');

  if (!doc) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText themeColor="textSecondary">Document not found.</ThemedText>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen options={{ title: doc.fileName }} />

      {isImage ? (
        <Image source={{ uri: doc.uri }} style={styles.previewImage} contentFit="contain" />
      ) : (
        <View style={[styles.previewPlaceholder, { backgroundColor: theme.backgroundSelected }]}>
          <Ionicons name="document-text-outline" size={64} color={StatusColors.brand} />
        </View>
      )}

      <ThemedText type="screenTitle">{doc.fileName}</ThemedText>

      <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
        <ThemedText type="meta" themeColor="textMuted">
          Course
        </ThemedText>
        <ThemedText type="default">{courseName}</ThemedText>
      </View>
      <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
        <ThemedText type="meta" themeColor="textMuted">
          Uploaded
        </ThemedText>
        <ThemedText type="default">{new Date(doc.uploadedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</ThemedText>
      </View>
      <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
        <ThemedText type="meta" themeColor="textMuted">
          Size
        </ThemedText>
        <ThemedText type="default">{formatFileSize(doc.sizeBytes)}</ThemedText>
      </View>
      <View style={[styles.metaRow, { borderBottomColor: theme.border }]}>
        <ThemedText type="meta" themeColor="textMuted">
          Type
        </ThemedText>
        <ThemedText type="default">{doc.mimeType}</ThemedText>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.two,
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderRadius: Radius.md,
    marginBottom: Spacing.two,
  },
  previewPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
    backgroundColor: '#E4EBF1',
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.two,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

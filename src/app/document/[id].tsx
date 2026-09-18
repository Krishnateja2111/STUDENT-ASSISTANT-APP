import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/button';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { ImageViewerModal } from '@/components/image-viewer-modal';
import { PdfViewer } from '@/components/pdf-viewer';
import { PdfViewerModal } from '@/components/pdf-viewer-modal';
import { ThemedText } from '@/components/themed-text';
import { MinTouchTarget, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { fileTypeMeta } from '@/lib/file-type-meta';
import { openFileExternally } from '@/lib/open-file';
import { useContentState } from '@/state/content-state';

const PREVIEW_HEIGHT = 320;

export default function DocumentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { documents, removeDocument } = useContentState();
  const theme = useTheme();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [openError, setOpenError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  const doc = documents.find((d) => d.id === id);
  const category = doc ? fileTypeMeta(doc.mimeType).category : 'other';
  const noun = category === 'image' ? 'image' : 'document';

  const handleOpen = async () => {
    if (!doc) return;
    setOpenError(null);
    setOpening(true);
    const result = await openFileExternally(doc.uri, doc.fileName, doc.mimeType);
    setOpening(false);
    if (!result.ok) setOpenError(result.message);
  };

  if (!doc) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ThemedText themeColor="textSecondary">Document not found.</ThemedText>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Stack.Screen
        options={{
          title: '',
          headerLeft: () => (
            <Pressable
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/documents'))}
              hitSlop={8}
              style={styles.headerAction}
              accessibilityRole="button"
              accessibilityLabel="Go back">
              <Ionicons name="chevron-back" size={24} color={theme.text} />
            </Pressable>
          ),
        }}
      />

      {category === 'image' && (
        <>
          <Pressable onPress={() => setShowImageViewer(true)}>
            <Image source={{ uri: doc.uri }} style={{ width: '100%', height: PREVIEW_HEIGHT }} contentFit="contain" />
          </Pressable>
          <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
            Tap to open full screen
          </ThemedText>
          <ImageViewerModal visible={showImageViewer} uri={doc.uri} onClose={() => setShowImageViewer(false)} />
        </>
      )}

      {category === 'pdf' && (
        <>
          <View style={[styles.pdfFrame, { borderColor: theme.border }]}>
            <PdfViewer uri={doc.uri} height={PREVIEW_HEIGHT} showToolbar={false} />
            {/* An overlay, not a wrapping Pressable, so the tap is caught
                reliably regardless of how the WebView/iframe underneath
                handles touch — the small inline preview isn't meant to be
                interactively scrolled/zoomed anyway, just tapped open. */}
            <Pressable
              onPress={() => setShowPdfViewer(true)}
              style={StyleSheet.absoluteFill}
              accessibilityRole="button"
              accessibilityLabel="View PDF full-screen"
            />
          </View>
          <ThemedText type="small" themeColor="textMuted" style={styles.hint}>
            Tap to open full screen
          </ThemedText>
          <PdfViewerModal visible={showPdfViewer} uri={doc.uri} onClose={() => setShowPdfViewer(false)} />
        </>
      )}

      {category === 'other' && (
        <>
          <View style={[styles.previewPlaceholder, { backgroundColor: `${fileTypeMeta(doc.mimeType).color}14` }]}>
            <Ionicons name={fileTypeMeta(doc.mimeType).icon} size={64} color={fileTypeMeta(doc.mimeType).color} />
          </View>
          <Button
            label={opening ? 'Opening…' : 'Open with…'}
            onPress={handleOpen}
            disabled={opening}
            style={styles.openButton}
          />
          {openError && (
            <ThemedText type="small" style={{ color: StatusColors.danger }}>
              {openError}
            </ThemedText>
          )}
        </>
      )}

      <ThemedText type="cardTitle" numberOfLines={2} style={styles.fileName}>
        {doc.fileName}
      </ThemedText>

      <Button
        label={`Delete ${noun}`}
        variant="outlined"
        color={StatusColors.danger}
        onPress={() => setShowDeleteConfirm(true)}
        style={styles.deleteButton}
      />

      <ConfirmDialog
        visible={showDeleteConfirm}
        title={`Delete ${noun}?`}
        description={`"${doc.fileName}" will be permanently removed. This can't be undone.`}
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          removeDocument(doc.id);
          setShowDeleteConfirm(false);
          // Bug fix: router.back() is a silent no-op with no in-app
          // navigation history — and the document this screen showed no
          // longer exists either way, so the documents list is always the
          // right destination after a delete.
          if (router.canGoBack()) router.back();
          else router.replace('/(tabs)/documents');
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.three,
  },
  headerAction: {
    minHeight: MinTouchTarget,
    minWidth: MinTouchTarget,
    justifyContent: 'center',
  },
  pdfFrame: {
    borderWidth: 1,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  previewPlaceholder: {
    width: '100%',
    height: 140,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E4EBF1',
  },
  openButton: {
    marginTop: Spacing.one,
  },
  hint: {
    textAlign: 'center',
    marginTop: -Spacing.two,
  },
  fileName: {
    textAlign: 'center',
  },
  deleteButton: {
    marginTop: Spacing.two,
  },
});

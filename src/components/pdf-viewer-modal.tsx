import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PdfViewer } from './pdf-viewer';

import { MinTouchTarget, Spacing } from '@/constants/theme';

export interface PdfViewerModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

/**
 * Full-screen PDF reading view. Mirrors ImageViewerModal's reasoning: the
 * document detail page's inline preview stays small and toolbar-free (see
 * PdfViewer's showToolbar prop) so it doesn't look cluttered, and tapping
 * it opens this instead — full height, with the PDF viewer's own toolbar
 * showing here since there's actually room for it to be useful (page
 * count, zoom, search) for reading something like a real multi-page
 * document rather than just a peek.
 */
export function PdfViewerModal({ visible, uri, onClose }: PdfViewerModalProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <PdfViewer uri={uri} height={height} showToolbar />
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeButton, { top: insets.top + Spacing.two }]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={26} color="#ffffff" />
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.three,
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: MinTouchTarget / 2,
  },
});

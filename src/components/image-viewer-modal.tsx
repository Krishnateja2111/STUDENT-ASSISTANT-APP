import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ZoomableImage } from './zoomable-image';

import { MinTouchTarget, Spacing } from '@/constants/theme';

export interface ImageViewerModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

/**
 * Full-screen zoom viewer. Zooming inline (in the document detail page's
 * small preview box) is how this first worked, but a scaled-up image
 * visually bleeds past its own layout box into whatever content sits below
 * it — confirmed live: at 2.5x, the checkerboard test image covered the
 * filename and metadata rows beneath it. Every real photo viewer solves
 * this the same way — zoom happens full-screen, with nothing else on
 * screen to bleed over — so the inline preview stays a plain static
 * thumbnail, and tapping it opens this instead.
 */
export function ImageViewerModal({ visible, uri, onClose }: ImageViewerModalProps) {
  const { height } = useWindowDimensions();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable onPress={() => {}} style={styles.imageArea}>
          <ZoomableImage uri={uri} height={height} />
        </Pressable>
        <Pressable
          onPress={onClose}
          hitSlop={8}
          style={[styles.closeButton, { top: insets.top + Spacing.two }]}
          accessibilityRole="button"
          accessibilityLabel="Close">
          <Ionicons name="close" size={28} color="#ffffff" />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: '#000000',
  },
  imageArea: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    right: Spacing.three,
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

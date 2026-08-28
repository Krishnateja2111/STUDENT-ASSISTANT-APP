import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { Button } from './button';
import { ThemedText } from './themed-text';

import { CardShadow, Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ConfirmDialogProps {
  visible: boolean;
  title: string;
  description: string;
  /** Defaults to "Cancel". */
  cancelLabel?: string;
  confirmLabel: string;
  /** Colors the confirm button as a warning action. Leave false for confirmable-but-non-destructive actions (e.g. sign out). */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * One reusable confirmation pattern for every destructive/discard action in the app.
 * Backdrop tap and the Android hardware back button (via Modal's required
 * onRequestClose) both cancel — neither can ever confirm.
 */
export function ConfirmDialog({
  visible,
  title,
  description,
  cancelLabel = 'Cancel',
  confirmLabel,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        {/* Swallows the tap so pressing the panel itself doesn't bubble to the backdrop's cancel. */}
        <Pressable onPress={() => {}} style={[styles.panel, { backgroundColor: theme.backgroundElement }]}>
          <ThemedText type="sectionTitle" style={styles.title}>
            {title}
          </ThemedText>
          <ThemedText type="default" themeColor="textSecondary" style={styles.description}>
            {description}
          </ThemedText>
          <View style={styles.actions}>
            <Button label={cancelLabel} variant="outlined" onPress={onCancel} />
            <Button
              label={confirmLabel}
              variant="filled"
              color={destructive ? StatusColors.danger : StatusColors.brand}
              onPress={onConfirm}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,17,19,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  panel: {
    width: '100%',
    maxWidth: 360,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.one,
    ...CardShadow,
  },
  title: {
    marginBottom: 2,
  },
  description: {
    marginBottom: Spacing.two,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
});

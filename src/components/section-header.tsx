import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { StatusColors } from '@/constants/theme';

export interface SectionHeaderProps {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  style?: object;
}

/** Small uppercase section label, with an optional right-aligned text action ("View all"). */
export function SectionHeader({ title, actionLabel, onAction, style }: SectionHeaderProps) {
  return (
    <View style={[styles.row, style]}>
      <ThemedText type="meta" themeColor="textMuted" style={styles.title}>
        {title.toUpperCase()}
      </ThemedText>
      {actionLabel && onAction ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <ThemedText type="small" style={styles.action}>
            {actionLabel}
          </ThemedText>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    letterSpacing: 0.6,
  },
  action: {
    color: StatusColors.brand,
    fontWeight: '600',
  },
});

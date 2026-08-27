import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from './themed-text';

import { Radius, Spacing, StatusColors } from '@/constants/theme';

export interface StatusBadgeProps {
  label: string;
  color?: string;
  style?: StyleProp<ViewStyle>;
}

/** Small colored pill for a short status word — "Due tomorrow", "In 19m", "75%". */
export function StatusBadge({ label, color = StatusColors.brand, style }: StatusBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: `${color}1A` }, style]}>
      <ThemedText type="small" style={[styles.text, { color }]}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
  text: {
    fontWeight: '700',
    lineHeight: 16,
  },
});

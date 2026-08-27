import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from './themed-text';

import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ListRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  label: string;
  description?: string;
  onPress?: () => void;
  danger?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** One row of an icon + label(+description) + chevron list — Profile's settings list, etc. */
export function ListRow({ icon, iconColor, label, description, onPress, danger, style }: ListRowProps) {
  const theme = useTheme();
  const color = danger ? '#E0524A' : (iconColor ?? theme.textSecondary);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && onPress ? { opacity: 0.6 } : null, style]}>
      <Ionicons name={icon} size={20} color={color} />
      <View style={styles.textGroup}>
        <ThemedText type="cardTitle" style={danger ? { color } : undefined}>
          {label}
        </ThemedText>
        {description ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {description}
          </ThemedText>
        ) : null}
      </View>
      {onPress && !danger ? <Ionicons name="chevron-forward" size={18} color={theme.textMuted} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    minHeight: MinTouchTarget,
    paddingVertical: Spacing.one,
  },
  textGroup: {
    flex: 1,
    gap: 1,
  },
});

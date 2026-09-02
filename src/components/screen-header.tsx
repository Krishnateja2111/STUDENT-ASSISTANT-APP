import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { MinTouchTarget, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  /** Renders a hamburger-menu button to the left of the title — pass to open the app-wide nav menu (see NavMenu). Omit to leave the header as it was. */
  onMenuPress?: () => void;
}

/** Consistent screen-top row: an optional menu button, title (+ optional subtitle), one optional action on the right. */
export function ScreenHeader({ title, subtitle, right, onMenuPress }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {onMenuPress ? (
        <Pressable
          onPress={onMenuPress}
          hitSlop={8}
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel="Open menu">
          <Ionicons name="menu" size={24} color={theme.text} />
        </Pressable>
      ) : null}
      <View style={styles.textGroup}>
        <ThemedText type="screenTitle">{title}</ThemedText>
        {subtitle ? (
          <ThemedText type="meta" themeColor="textSecondary">
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      {right ? <View style={styles.right}>{right}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  menuButton: {
    minWidth: MinTouchTarget,
    minHeight: MinTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -Spacing.two,
  },
  textGroup: {
    flex: 1,
    gap: 2,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
});

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
  /**
   * Renders a back arrow instead of the hamburger — for a tab screen that
   * was pushed onto from somewhere outside the tab bar (e.g. Settings'
   * "Edit profile" row landing on the Profile tab), where the hamburger
   * alone left no way back to where you came from. Takes priority over
   * onMenuPress when both are passed, though callers should really only
   * pass one — see (tabs)/profile.tsx for the router.canGoBack() check
   * that decides which one to pass.
   */
  onBackPress?: () => void;
}

/** Consistent screen-top row: an optional menu or back button, title (+ optional subtitle), one optional action on the right. */
export function ScreenHeader({ title, subtitle, right, onMenuPress, onBackPress }: ScreenHeaderProps) {
  const theme = useTheme();

  return (
    <View style={styles.row}>
      {onBackPress ? (
        <Pressable
          onPress={onBackPress}
          hitSlop={8}
          style={styles.menuButton}
          accessibilityRole="button"
          accessibilityLabel="Go back">
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
      ) : onMenuPress ? (
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

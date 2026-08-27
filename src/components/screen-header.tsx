import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';

export interface ScreenHeaderProps {
  title: string;
  subtitle?: string;
  right?: ReactNode;
}

/** Consistent screen-top row: title (+ optional subtitle) on the left, one optional action on the right. */
export function ScreenHeader({ title, subtitle, right }: ScreenHeaderProps) {
  return (
    <View style={styles.row}>
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

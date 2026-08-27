import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from './card';
import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';

export interface ScheduledTaskCardProps {
  time: string;
  title: string;
  courseName: string;
  accentColor: string;
  /** Right-aligned slot — a status badge, a button, etc. */
  trailing?: ReactNode;
  onPress?: () => void;
  /** Extra content rendered below the main row (e.g. an expanded action). */
  children?: ReactNode;
}

/** One scheduled block: time · title · course, with an optional trailing action. Shared by Dashboard/Calendar. */
export function ScheduledTaskCard({
  time,
  title,
  courseName,
  accentColor,
  trailing,
  onPress,
  children,
}: ScheduledTaskCardProps) {
  const content = (
    <Card accentColor={accentColor} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <ThemedText type="meta" themeColor="textSecondary">
            {time}
          </ThemedText>
          <ThemedText type="cardTitle">{title}</ThemedText>
          <ThemedText type="meta" themeColor="textMuted">
            {courseName}
          </ThemedText>
        </View>
        {trailing}
      </View>
      {children}
    </Card>
  );

  if (!onPress) return content;
  return <Pressable onPress={onPress}>{content}</Pressable>;
}

const styles = StyleSheet.create({
  card: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  main: {
    flex: 1,
    gap: 2,
  },
});

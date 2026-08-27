import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
}

export function EmptyState({ icon, message }: EmptyStateProps) {
  const theme = useTheme();
  return (
    <View style={styles.container}>
      <Ionicons name={icon} size={28} color={theme.textMuted} />
      <ThemedText type="meta" themeColor="textSecondary" style={styles.message}>
        {message}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.five,
  },
  message: {
    textAlign: 'center',
  },
});

import { StyleSheet, View, type ViewProps } from 'react-native';

import { CardShadow, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface CardProps extends ViewProps {
  /** Renders a colored left-border stripe — used for course accents and status. */
  accentColor?: string;
}

export function Card({ style, accentColor, children, ...rest }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[
        styles.base,
        { backgroundColor: theme.backgroundElement },
        accentColor ? { borderLeftWidth: 4, borderLeftColor: accentColor } : null,
        style,
      ]}
      {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.md,
    padding: Spacing.three,
    ...CardShadow,
  },
});

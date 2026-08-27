import { StyleSheet, View, type ViewStyle, type StyleProp } from 'react-native';

import { Radius, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export interface ProgressBarProps {
  /** 0–100. Values outside that range are clamped. */
  value: number;
  color?: string;
  height?: number;
  style?: StyleProp<ViewStyle>;
}

export function ProgressBar({ value, color = StatusColors.brand, height = 6, style }: ProgressBarProps) {
  const theme = useTheme();
  const pct = Math.max(0, Math.min(100, value));

  return (
    <View
      style={[styles.track, { backgroundColor: theme.backgroundSelected, height, borderRadius: height / 2 }, style]}>
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: color, height, borderRadius: height / 2 },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: Radius.pill,
  },
  fill: {
    borderRadius: Radius.pill,
  },
});

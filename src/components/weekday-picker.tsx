import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAY_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export interface WeekdayPickerProps {
  /** 0 (Sun) – 6 (Sat), matching Date.getDay() — same convention as AvailabilityRule/FixedCommitment. */
  value: number;
  onChange: (weekday: number) => void;
}

/** A row of 7 single-letter day chips — the visual equivalent of typing a weekday number. */
export function WeekdayPicker({ value, onChange }: WeekdayPickerProps) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      {WEEKDAY_LABELS.map((label, weekday) => {
        const selected = value === weekday;
        return (
          <Pressable
            key={weekday}
            onPress={() => onChange(weekday)}
            accessibilityRole="button"
            accessibilityLabel={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][weekday]}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: StatusColors.brand }
                : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
            ]}>
            <ThemedText type="cardTitle" style={selected ? styles.chipTextSelected : undefined}>
              {label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.pill,
  },
  chipTextSelected: {
    color: '#ffffff',
  },
});

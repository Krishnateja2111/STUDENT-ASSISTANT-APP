import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1); // 1..12
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** Parses "HH:mm" (24h) into 12h display parts. Falls back to 9:00 AM for an invalid/empty value, rather than crashing on a blank draft. */
function parse(value: string): { hour12: number; minute: number; period: 'AM' | 'PM' } {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  const hour24 = match ? Number(match[1]) : 9;
  const minute = match ? Number(match[2]) : 0;
  const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return { hour12, minute, period };
}

function toHour24(hour12: number, period: 'AM' | 'PM'): number {
  if (period === 'AM') return hour12 === 12 ? 0 : hour12;
  return hour12 === 12 ? 12 : hour12 + 12;
}

export interface TimePickerProps {
  /** "HH:mm", 24h. */
  value: string;
  onChange: (value: string) => void;
}

/** A visual hour / minute / AM-PM chip picker — never requires typing a time string. Operates on and produces "HH:mm" (24h), the format AvailabilityRule/FixedCommitment already use. */
export function TimePicker({ value, onChange }: TimePickerProps) {
  const theme = useTheme();
  const { hour12, minute, period } = parse(value);

  const set = (nextHour12: number, nextMinute: number, nextPeriod: 'AM' | 'PM') => {
    onChange(`${pad(toHour24(nextHour12, nextPeriod))}:${pad(nextMinute)}`);
  };

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {HOURS_12.map((h) => {
          const selected = h === hour12;
          return (
            <Pressable
              key={h}
              onPress={() => set(h, minute, period)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: StatusColors.brand }
                  : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
              ]}>
              <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                {h}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
        {MINUTES.map((m) => {
          const selected = m === minute;
          return (
            <Pressable
              key={m}
              onPress={() => set(hour12, m, period)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: StatusColors.brand }
                  : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
              ]}>
              <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                :{pad(m)}
              </ThemedText>
            </Pressable>
          );
        })}
      </ScrollView>
      <View style={styles.periodRow}>
        {(['AM', 'PM'] as const).map((p) => {
          const selected = p === period;
          return (
            <Pressable
              key={p}
              onPress={() => set(hour12, minute, p)}
              style={[
                styles.periodChip,
                selected
                  ? { backgroundColor: StatusColors.brand }
                  : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
              ]}>
              <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                {p}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.one,
  },
  chipRow: {
    gap: Spacing.one,
    paddingVertical: 2,
  },
  chip: {
    minWidth: 40,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.two,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  periodRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  periodChip: {
    minWidth: 56,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
});

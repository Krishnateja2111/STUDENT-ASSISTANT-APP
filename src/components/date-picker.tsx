import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from './themed-text';

import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const WEEKDAY_HEADERS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseDateKey(key: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

/** Every visible cell of a month grid, including the leading/trailing days of neighboring months needed to fill whole weeks. */
function buildMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const start = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

export interface DatePickerProps {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM-DD" — days before this are shown but not selectable. */
  minDate?: string;
}

/** A visual month-grid calendar — never requires typing a date string. Operates on and produces "YYYY-MM-DD". */
export function DatePicker({ value, onChange, minDate }: DatePickerProps) {
  const theme = useTheme();
  const selected = parseDateKey(value) ?? new Date();
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const min = minDate ? parseDateKey(minDate) : null;
  const cells = buildMonthGrid(viewYear, viewMonth);
  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={goPrevMonth} hitSlop={8} accessibilityRole="button" accessibilityLabel="Previous month">
          <Ionicons name="chevron-back" size={20} color={theme.textSecondary} />
        </Pressable>
        <ThemedText type="cardTitle">{monthLabel}</ThemedText>
        <Pressable onPress={goNextMonth} hitSlop={8} accessibilityRole="button" accessibilityLabel="Next month">
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </Pressable>
      </View>

      <View style={styles.weekdayRow}>
        {WEEKDAY_HEADERS.map((label, i) => (
          <ThemedText key={i} type="meta" themeColor="textMuted" style={styles.weekdayCell}>
            {label}
          </ThemedText>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((date) => {
          const key = toDateKey(date);
          const inMonth = date.getMonth() === viewMonth;
          const isSelected = key === value;
          const isDisabled = Boolean(min && date < min);
          return (
            <Pressable
              key={key}
              disabled={isDisabled}
              onPress={() => onChange(key)}
              style={styles.dayCellTarget}
              accessibilityRole="button"
              accessibilityLabel={date.toDateString()}>
              <View style={[styles.dayCell, isSelected && { backgroundColor: StatusColors.brand }]}>
                <ThemedText
                  type="small"
                  themeColor={!inMonth || isDisabled ? 'textMuted' : 'text'}
                  style={isSelected ? styles.dayTextSelected : undefined}>
                  {date.getDate()}
                </ThemedText>
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  weekdayRow: {
    flexDirection: 'row',
  },
  weekdayCell: {
    flex: 1,
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCellTarget: {
    width: `${100 / 7}%`,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 2,
  },
  dayCell: {
    width: '100%',
    height: '100%',
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from './card';
import { DatePicker } from './date-picker';
import { ThemedText } from './themed-text';

import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function formatDisplay(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

export interface DateFieldProps {
  /** "YYYY-MM-DD". */
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  /** "YYYY-MM-DD" — days before this are shown but not selectable. */
  minDate?: string;
}

/**
 * A collapsible date-only field — DateTimePicker's summary-row + expanding
 * calendar pattern, minus the time picker, for fields where a time of day
 * genuinely doesn't apply (a recurring goal's start/end day, not a specific
 * due moment).
 */
export function DateField({ value, onChange, placeholder, minDate }: DateFieldProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const hasValue = Boolean(value);

  return (
    <View>
      <Pressable
        onPress={() => setExpanded((prev) => !prev)}
        style={[styles.summaryRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        accessibilityRole="button"
        accessibilityLabel={placeholder}>
        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="default" themeColor={hasValue ? 'text' : 'textMuted'} style={styles.summaryText}>
          {hasValue ? formatDisplay(value) : placeholder}
        </ThemedText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
      </Pressable>

      {expanded && (
        <Card style={styles.expandedCard}>
          <DatePicker value={value} minDate={minDate} onChange={onChange} />
          <Pressable onPress={() => setExpanded(false)} style={styles.doneRow}>
            <ThemedText type="cardTitle" style={{ color: StatusColors.brand }}>
              Done
            </ThemedText>
          </Pressable>
        </Card>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
  },
  summaryText: {
    flex: 1,
  },
  expandedCard: {
    marginTop: Spacing.two,
    gap: Spacing.three,
  },
  doneRow: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});

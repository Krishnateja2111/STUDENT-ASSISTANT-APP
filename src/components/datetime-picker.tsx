import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from './card';
import { DatePicker } from './date-picker';
import { ThemedText } from './themed-text';
import { TimePicker } from './time-picker';

import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Splits a local ISO datetime into its date/time parts, defaulting to
 * today/9:00 AM for an empty or genuinely invalid value. The trailing
 * `:ss` seconds are optional and, when present, silently dropped — every
 * ISO datetime already persisted in this app (scheduledBlocks, seed tasks,
 * seed availability — anything built via the scheduling engine's own
 * isoFromMs helpers) includes them, so requiring an exact "YYYY-MM-DDTHH:mm"
 * match here would silently mis-parse real, valid, already-existing data as
 * invalid and fall through to today's date — exactly the kind of "changed
 * without the student touching anything" bug the master spec warns against.
 */
function split(value: string): { date: string; time: string } {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?$/.exec(value);
  if (match) return { date: match[1], time: match[2] };
  const now = new Date();
  return { date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`, time: '09:00' };
}

function formatDisplay(value: string): string {
  const { date, time } = split(value);
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, h, min);
  const dateLabel = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const timeLabel = dt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${dateLabel} · ${timeLabel}`;
}

export interface DateTimePickerProps {
  /** "YYYY-MM-DDTHH:mm" — same format task-entry.tsx's dueDate and AvailabilityBlock start/end already use. */
  value: string;
  onChange: (value: string) => void;
  /** "YYYY-MM-DD" — days before this are shown but not selectable in the date grid. */
  minDate?: string;
  /** Fires when the picker collapses (the student tapped "Done" or the summary row again) — the signal a caller with a commit-on-close pattern (see settings.tsx's AvailabilityRow) should use, rather than committing on every individual chip tap. */
  onDone?: () => void;
}

/**
 * A visual date + time picker for a single "YYYY-MM-DDTHH:mm" field — the
 * master spec's "never raw string typing" rule, applied without any new
 * native dependency (see the picker-strategy decision this phase): a
 * collapsed summary row expands into a real calendar grid + hour/minute/
 * AM-PM chips, built entirely from existing primitives so it renders
 * identically on native and web.
 */
export function DateTimePicker({ value, onChange, minDate, onDone }: DateTimePickerProps) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const { date, time } = split(value);
  const hasValue = Boolean(value);

  const close = () => {
    setExpanded(false);
    onDone?.();
  };

  return (
    <View>
      <Pressable
        onPress={() => {
          if (expanded) close();
          else setExpanded(true);
        }}
        style={[styles.summaryRow, { borderColor: theme.border, backgroundColor: theme.backgroundElement }]}
        accessibilityRole="button"
        accessibilityLabel="Choose date and time">
        <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
        <ThemedText type="default" themeColor={hasValue ? 'text' : 'textMuted'} style={styles.summaryText}>
          {hasValue ? formatDisplay(value) : 'Choose a date and time'}
        </ThemedText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
      </Pressable>

      {expanded && (
        <Card style={styles.expandedCard}>
          <DatePicker
            value={date}
            minDate={minDate}
            onChange={(newDate) => onChange(`${newDate}T${time}`)}
          />
          <View style={[styles.divider, { backgroundColor: theme.border }]} />
          <TimePicker value={time} onChange={(newTime) => onChange(`${date}T${newTime}`)} />
          <Pressable onPress={close} style={styles.doneRow}>
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
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  doneRow: {
    alignSelf: 'flex-end',
    minHeight: 36,
    justifyContent: 'center',
    paddingHorizontal: Spacing.two,
  },
});

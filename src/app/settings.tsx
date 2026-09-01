import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Avatar } from '@/components/avatar';
import { Button } from '@/components/button';
import { Card } from '@/components/card';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { DatePicker } from '@/components/date-picker';
import { DateTimePicker } from '@/components/datetime-picker';
import { EmptyState } from '@/components/empty-state';
import { ListRow } from '@/components/list-row';
import { SectionHeader } from '@/components/section-header';
import { StatusBadge } from '@/components/status-badge';
import { ThemedText } from '@/components/themed-text';
import { TimePicker } from '@/components/time-picker';
import { WeekdayPicker } from '@/components/weekday-picker';
import { Radius, Spacing, StatusColors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useTheme } from '@/hooks/use-theme';
import { getToday } from '@/lib/reference-date';
import type { AvailabilityBlock, AvailabilityRule, FixedCommitment, TemporaryUnavailablePeriod } from '@/lib/scheduling';
import { useAppState } from '@/state/app-state';
import { useContentState } from '@/state/content-state';

const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 'Invalid time range';
  const day = start.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const startTime = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const endTime = end.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${startTime} – ${endTime}`;
}

function formatTimeOfDay(hhmm: string): string {
  const match = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!match) return hhmm;
  return new Date(2000, 0, 1, Number(match[1]), Number(match[2])).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatTimeRange(startTime: string, endTime: string): string {
  return `${formatTimeOfDay(startTime)} – ${formatTimeOfDay(endTime)}`;
}

/**
 * Phase 3D — commit-time availability editing. Typing into these fields no
 * longer re-plans on every keystroke: each field keeps its own local draft
 * and only calls onCommit (which triggers a single targeted re-plan in
 * app-state.tsx) on blur, and only if the value actually changed. This is
 * the smallest change that gives availability edits a real commit boundary
 * without redesigning the form — same layout, same fields, same Remove
 * button as before.
 */
function AvailabilityRow({
  block,
  onCommit,
  onRemove,
}: {
  block: AvailabilityBlock;
  onCommit: (updates: Partial<Omit<AvailabilityBlock, 'id'>>) => void;
  onRemove: () => void;
}) {
  const [draftStart, setDraftStart] = useState(block.start);
  const [draftEnd, setDraftEnd] = useState(block.end);
  // Tracks which committed block these drafts were last derived from, so a
  // change to `block` coming from elsewhere (e.g. this block's placement
  // shifted as part of an availability re-plan) can be detected and
  // adopted — without this, a stale draft could silently overwrite a
  // fresher committed value the next time a picker closes. Adjusting state
  // directly during render (React's documented pattern for deriving state
  // from a changed prop) rather than in a useEffect avoids an extra render
  // pass and the same set-state-in-effect pitfall already flagged elsewhere
  // in this codebase.
  const [syncedBlock, setSyncedBlock] = useState(block);
  if (block.start !== syncedBlock.start || block.end !== syncedBlock.end) {
    setSyncedBlock(block);
    setDraftStart(block.start);
    setDraftEnd(block.end);
  }

  return (
    <Card style={styles.availabilityCard}>
      <ThemedText type="cardTitle">{formatRange(block.start, block.end)}</ThemedText>
      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        START
      </ThemedText>
      <DateTimePicker
        value={draftStart}
        onChange={setDraftStart}
        onDone={() => {
          if (draftStart !== block.start) onCommit({ start: draftStart });
        }}
      />
      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        END
      </ThemedText>
      <DateTimePicker
        value={draftEnd}
        onChange={setDraftEnd}
        onDone={() => {
          if (draftEnd !== block.end) onCommit({ end: draftEnd });
        }}
      />
      <Button label="Remove" variant="outlined" color={StatusColors.danger} onPress={onRemove} style={styles.removeButton} />
    </Card>
  );
}

/**
 * Category 1 (Phase 3F) — a weekly recurring availability rule. Unlike
 * AvailabilityRow's per-field commit-on-close, WeekdayPicker/TimePicker have
 * no natural "closed" moment of their own (they're always-expanded chip
 * rows, not a collapsible summary) — so this row uses an explicit Save,
 * shown only once the draft actually differs from what's committed.
 */
function AvailabilityRuleRow({
  rule,
  onCommit,
  onRemove,
}: {
  rule: AvailabilityRule;
  onCommit: (updates: Partial<Omit<AvailabilityRule, 'id'>>) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(rule);
  const [synced, setSynced] = useState(rule);
  if (rule.weekday !== synced.weekday || rule.startTime !== synced.startTime || rule.endTime !== synced.endTime) {
    setSynced(rule);
    setDraft(rule);
  }
  const hasChanges =
    draft.weekday !== rule.weekday || draft.startTime !== rule.startTime || draft.endTime !== rule.endTime;

  return (
    <Card style={styles.availabilityCard}>
      <ThemedText type="cardTitle">
        Every {WEEKDAY_NAMES[rule.weekday]}, {formatTimeRange(rule.startTime, rule.endTime)}
      </ThemedText>
      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        DAY
      </ThemedText>
      <WeekdayPicker value={draft.weekday} onChange={(weekday) => setDraft((d) => ({ ...d, weekday }))} />
      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        START
      </ThemedText>
      <TimePicker value={draft.startTime} onChange={(startTime) => setDraft((d) => ({ ...d, startTime }))} />
      <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
        END
      </ThemedText>
      <TimePicker value={draft.endTime} onChange={(endTime) => setDraft((d) => ({ ...d, endTime }))} />
      <View style={styles.rowActions}>
        {hasChanges && (
          <Button
            label="Save"
            onPress={() => onCommit({ weekday: draft.weekday, startTime: draft.startTime, endTime: draft.endTime })}
            style={styles.rowActionButton}
          />
        )}
        <Button label="Remove" variant="outlined" color={StatusColors.danger} onPress={onRemove} style={styles.rowActionButton} />
      </View>
    </Card>
  );
}

type PendingRemove = { kind: 'availability' | 'rule' | 'commitment' | 'unavailable'; id: string };

export default function SettingsScreen() {
  const {
    availability,
    addAvailabilityBlock,
    updateAvailabilityBlock,
    removeAvailabilityBlock,
    availabilityRules,
    addAvailabilityRule,
    updateAvailabilityRule,
    removeAvailabilityRule,
    fixedCommitments,
    addFixedCommitment,
    removeFixedCommitment,
    unavailablePeriods,
    addUnavailablePeriod,
    removeUnavailablePeriod,
    logout,
  } = useAppState();
  const { profile } = useContentState();
  const theme = useTheme();
  const colorScheme = useColorScheme();
  const [pendingRemove, setPendingRemove] = useState<PendingRemove | null>(null);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [commitmentKind, setCommitmentKind] = useState<'recurring' | 'one-time'>('recurring');
  const [commitmentWeekday, setCommitmentWeekday] = useState(1);
  const [commitmentDate, setCommitmentDate] = useState(getToday());
  const [commitmentStart, setCommitmentStart] = useState('09:00');
  const [commitmentEnd, setCommitmentEnd] = useState('10:00');
  const [commitmentLabel, setCommitmentLabel] = useState('');

  const [showAddUnavailable, setShowAddUnavailable] = useState(false);
  const [unavailableStart, setUnavailableStart] = useState('');
  const [unavailableEnd, setUnavailableEnd] = useState('');
  const [unavailableLabel, setUnavailableLabel] = useState('');

  const appearanceLabel = colorScheme === 'dark' ? 'Dark' : 'Light';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  const handleSignOut = () => {
    setShowSignOutConfirm(false);
    logout();
    router.replace('/auth');
  };

  const runMutation = (reviewNeeded: boolean) => {
    if (reviewNeeded) router.push('/reschedule');
  };

  const handleAddCommitment = () => {
    const label = commitmentLabel.trim() || undefined;
    const reviewNeeded =
      commitmentKind === 'recurring'
        ? addFixedCommitment({ kind: 'recurring', weekday: commitmentWeekday, startTime: commitmentStart, endTime: commitmentEnd, label })
        : addFixedCommitment({ kind: 'one-time', date: commitmentDate, startTime: commitmentStart, endTime: commitmentEnd, label });
    setShowAddCommitment(false);
    setCommitmentLabel('');
    runMutation(reviewNeeded);
  };

  const handleAddUnavailable = () => {
    if (!unavailableStart || !unavailableEnd) return;
    const reviewNeeded = addUnavailablePeriod({
      start: unavailableStart,
      end: unavailableEnd,
      label: unavailableLabel.trim() || undefined,
    });
    setShowAddUnavailable(false);
    setUnavailableStart('');
    setUnavailableEnd('');
    setUnavailableLabel('');
    runMutation(reviewNeeded);
  };

  // A one-time block whose time has fully elapsed is no longer usable by
  // the scheduling engine (see effectiveAvailability's horizon-clipping) —
  // keeping it listed here forever would misrepresent it as still-relevant
  // availability the student could edit. It isn't deleted (still exists as
  // a historical record in state), just no longer surfaced as something to
  // manage.
  const nowMs = Date.now();
  const upcomingAvailability = availability.filter((b) => new Date(b.end).getTime() > nowMs);
  const pastAvailabilityCount = availability.length - upcomingAvailability.length;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.section}>
        <SectionHeader title="Account" />
        <Card style={styles.accountCard}>
          <View style={styles.accountRow}>
            <Avatar name={profile.name} size={44} />
            <View style={styles.accountText}>
              <ThemedText type="cardTitle">{profile.name}</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                {profile.email || 'No email set'}
              </ThemedText>
            </View>
          </View>
          <ListRow
            icon="person-outline"
            label="Edit profile"
            description="Name and email"
            onPress={() => router.push('/(tabs)/profile')}
          />
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Weekly availability" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          Recurring windows that repeat every week — this is the real availability the scheduling engine plans
          around, alongside the other sections below.
        </ThemedText>

        {availabilityRules.length === 0 && <EmptyState icon="repeat-outline" message="No weekly availability set yet." />}

        {availabilityRules.map((rule) => (
          <AvailabilityRuleRow
            key={rule.id}
            rule={rule}
            onCommit={(updates) => runMutation(updateAvailabilityRule(rule.id, updates))}
            onRemove={() => setPendingRemove({ kind: 'rule', id: rule.id })}
          />
        ))}

        <Button
          label="+ Add weekly availability"
          variant="outlined"
          onPress={() => runMutation(addAvailabilityRule({ weekday: 1, startTime: '18:00', endTime: '20:00' }))}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="One-time availability" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          Extra availability for a specific date — a single study block that doesn&apos;t repeat.
        </ThemedText>

        {upcomingAvailability.length === 0 && <EmptyState icon="time-outline" message="No one-time availability set yet." />}

        {upcomingAvailability.map((block) => (
          <AvailabilityRow
            key={block.id}
            block={block}
            onCommit={(updates) => runMutation(updateAvailabilityBlock(block.id, updates))}
            onRemove={() => setPendingRemove({ kind: 'availability', id: block.id })}
          />
        ))}

        {pastAvailabilityCount > 0 && (
          <ThemedText type="small" themeColor="textMuted">
            {pastAvailabilityCount} past block{pastAvailabilityCount > 1 ? 's' : ''} hidden — already elapsed, no
            longer used for scheduling.
          </ThemedText>
        )}

        <Button
          label="+ Add availability block"
          variant="outlined"
          onPress={() => {
            const now = new Date();
            now.setMinutes(0, 0, 0);
            const start = now.toISOString().slice(0, 16);
            now.setHours(now.getHours() + 2);
            const end = now.toISOString().slice(0, 16);
            runMutation(addAvailabilityBlock({ start, end }));
          }}
        />
      </View>

      <View style={styles.section}>
        <SectionHeader title="Fixed commitments" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          Classes, work, and appointments — the scheduler never places a study task on top of one of these,
          separately from your availability above.
        </ThemedText>

        {fixedCommitments.length === 0 && !showAddCommitment && (
          <EmptyState icon="briefcase-outline" message="No fixed commitments yet." />
        )}

        {fixedCommitments.map((commitment) => (
          <Card key={commitment.id} style={styles.availabilityCard}>
            <ThemedText type="cardTitle">{commitment.label || 'Commitment'}</ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {commitment.kind === 'recurring'
                ? `Every ${WEEKDAY_NAMES[commitment.weekday]}`
                : new Date(`${commitment.date}T00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' · '}
              {formatTimeRange(commitment.startTime, commitment.endTime)}
            </ThemedText>
            <Button
              label="Remove"
              variant="outlined"
              color={StatusColors.danger}
              onPress={() => setPendingRemove({ kind: 'commitment', id: commitment.id })}
              style={styles.removeButton}
            />
          </Card>
        ))}

        {showAddCommitment ? (
          <Card style={styles.availabilityCard}>
            <View style={styles.kindToggleRow}>
              {(['recurring', 'one-time'] as const).map((kind) => {
                const selected = commitmentKind === kind;
                return (
                  <Pressable
                    key={kind}
                    onPress={() => setCommitmentKind(kind)}
                    style={[
                      styles.kindChip,
                      selected
                        ? { backgroundColor: StatusColors.brand }
                        : { backgroundColor: theme.background, borderWidth: 1, borderColor: theme.border },
                    ]}>
                    <ThemedText type="small" style={selected ? styles.chipTextSelected : undefined}>
                      {kind === 'recurring' ? 'Every week' : 'One time'}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>

            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              LABEL
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="e.g. CS 301 Lecture"
              placeholderTextColor={theme.textMuted}
              value={commitmentLabel}
              onChangeText={setCommitmentLabel}
            />

            {commitmentKind === 'recurring' ? (
              <>
                <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
                  DAY
                </ThemedText>
                <WeekdayPicker value={commitmentWeekday} onChange={setCommitmentWeekday} />
              </>
            ) : (
              <>
                <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
                  DATE
                </ThemedText>
                <DatePicker value={commitmentDate} onChange={setCommitmentDate} minDate={getToday()} />
              </>
            )}

            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              START
            </ThemedText>
            <TimePicker value={commitmentStart} onChange={setCommitmentStart} />
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              END
            </ThemedText>
            <TimePicker value={commitmentEnd} onChange={setCommitmentEnd} />

            <View style={styles.rowActions}>
              <Button label="Save" onPress={handleAddCommitment} style={styles.rowActionButton} />
              <Button
                label="Cancel"
                variant="outlined"
                onPress={() => setShowAddCommitment(false)}
                style={styles.rowActionButton}
              />
            </View>
          </Card>
        ) : (
          <Button label="+ Add fixed commitment" variant="outlined" onPress={() => setShowAddCommitment(true)} />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Unavailable periods" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          A temporary stretch you&apos;re unreachable for studying — travel, a busy week, anything that
          overrides your usual availability for that time.
        </ThemedText>

        {unavailablePeriods.length === 0 && !showAddUnavailable && (
          <EmptyState icon="airplane-outline" message="No unavailable periods set." />
        )}

        {unavailablePeriods.map((period) => (
          <Card key={period.id} style={styles.availabilityCard}>
            <ThemedText type="cardTitle">{period.label || 'Unavailable'}</ThemedText>
            <ThemedText type="meta" themeColor="textSecondary">
              {formatRange(period.start, period.end)}
            </ThemedText>
            <Button
              label="Remove"
              variant="outlined"
              color={StatusColors.danger}
              onPress={() => setPendingRemove({ kind: 'unavailable', id: period.id })}
              style={styles.removeButton}
            />
          </Card>
        ))}

        {showAddUnavailable ? (
          <Card style={styles.availabilityCard}>
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              LABEL
            </ThemedText>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
              placeholder="e.g. Family trip"
              placeholderTextColor={theme.textMuted}
              value={unavailableLabel}
              onChangeText={setUnavailableLabel}
            />
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              FROM
            </ThemedText>
            <DateTimePicker value={unavailableStart} onChange={setUnavailableStart} minDate={getToday()} />
            <ThemedText type="meta" themeColor="textMuted" style={styles.label}>
              UNTIL
            </ThemedText>
            <DateTimePicker value={unavailableEnd} onChange={setUnavailableEnd} minDate={getToday()} />
            <View style={styles.rowActions}>
              <Button
                label="Save"
                disabled={!unavailableStart || !unavailableEnd}
                onPress={handleAddUnavailable}
                style={styles.rowActionButton}
              />
              <Button
                label="Cancel"
                variant="outlined"
                onPress={() => setShowAddUnavailable(false)}
                style={styles.rowActionButton}
              />
            </View>
          </Card>
        ) : (
          <Button label="+ Add unavailable period" variant="outlined" onPress={() => setShowAddUnavailable(true)} />
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Notifications" />
        <ThemedText type="meta" themeColor="textSecondary" style={styles.sectionNote}>
          Not built yet — nothing below sends a real notification. Shown here so you know what&apos;s planned.
        </ThemedText>
        <Card style={styles.notificationCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Deadline reminders
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A nudge before a task is due
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Daily plan summary
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                A morning recap of today&apos;s plan
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Appearance" />
        <Card style={styles.infoCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle">Theme</ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Automatically follows your device&apos;s system setting
              </ThemedText>
            </View>
            <StatusBadge label={appearanceLabel} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Privacy & security" />
        <Card style={styles.infoCard}>
          <ThemedText type="cardTitle">Your data stays on this device</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Courses, tasks, documents, and your profile are stored locally and are never sent to a server.
          </ThemedText>
        </Card>
        <Card style={styles.infoCard}>
          <View style={styles.notificationRow}>
            <View style={styles.notificationText}>
              <ThemedText type="cardTitle" themeColor="textMuted">
                Password & account security
              </ThemedText>
              <ThemedText type="meta" themeColor="textSecondary">
                Sign-in is not backed by a real account system yet
              </ThemedText>
            </View>
            <StatusBadge label="Coming soon" color={StatusColors.warning} />
          </View>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="About" />
        <Card style={styles.infoCard}>
          <ThemedText type="cardTitle">Student Assistant</ThemedText>
          <ThemedText type="meta" themeColor="textSecondary">
            Version {appVersion}
          </ThemedText>
        </Card>
      </View>

      <View style={styles.section}>
        <SectionHeader title="Account actions" />
        <Button
          label="Sign out"
          variant="outlined"
          color={StatusColors.danger}
          onPress={() => setShowSignOutConfirm(true)}
        />
      </View>

      <ConfirmDialog
        visible={pendingRemove !== null}
        title="Remove this?"
        description="This time will no longer be considered for scheduling — it can affect upcoming and future schedules."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (pendingRemove) {
            const remove = {
              availability: removeAvailabilityBlock,
              rule: removeAvailabilityRule,
              commitment: removeFixedCommitment,
              unavailable: removeUnavailablePeriod,
            }[pendingRemove.kind];
            const reviewNeeded = remove(pendingRemove.id);
            setPendingRemove(null);
            runMutation(reviewNeeded);
          } else {
            setPendingRemove(null);
          }
        }}
        onCancel={() => setPendingRemove(null)}
      />
      <ConfirmDialog
        visible={showSignOutConfirm}
        title="Sign out?"
        description="You'll need to sign back in to continue. This won't delete any of your courses, tasks, or documents."
        confirmLabel="Sign Out"
        onConfirm={handleSignOut}
        onCancel={() => setShowSignOutConfirm(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: Spacing.four,
    gap: Spacing.four,
  },
  section: {
    gap: Spacing.two,
  },
  sectionNote: {
    marginBottom: Spacing.one,
  },
  accountCard: {
    gap: Spacing.two,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  accountText: {
    flex: 1,
    gap: 1,
  },
  availabilityCard: {
    gap: Spacing.one,
  },
  label: {
    letterSpacing: 0.6,
    marginTop: Spacing.one,
  },
  input: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 15,
  },
  removeButton: {
    marginTop: Spacing.one,
  },
  rowActions: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  rowActionButton: {
    flex: 1,
  },
  kindToggleRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  kindChip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Radius.md,
  },
  chipTextSelected: {
    color: '#ffffff',
    fontWeight: '700',
  },
  notificationCard: {
    gap: Spacing.three,
  },
  infoCard: {
    gap: Spacing.one,
  },
  notificationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
    minHeight: 44,
  },
  notificationText: {
    flex: 1,
    gap: 2,
  },
});

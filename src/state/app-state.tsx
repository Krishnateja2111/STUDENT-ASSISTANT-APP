import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  computeHorizon,
  diffSchedules,
  expandAvailability,
  explainChanges,
  findAvailabilityImpact,
  generateSchedule,
  getScheduleHealth,
  replanTasks,
  rescheduleAfterMiss,
  ReasonCode,
  type AvailabilityBlock,
  type AvailabilityRule,
  type Course,
  type ExplanationEntry,
  type FixedCommitment,
  type RescheduleResult,
  type ScheduledBlock,
  type ScheduleChange,
  type ScheduleHealth,
  type Task,
  type TemporaryUnavailablePeriod,
} from '@/lib/scheduling';
import { getNow } from '@/lib/reference-date';
import { readPersisted, writePersisted } from '@/lib/storage';
import { createScheduleProposal, isProposalCurrent, type ScheduleProposal } from '@/state/scheduling-types';
import { seedAvailability, seedAvailabilityRules, seedCourses, seedTasks } from '@/state/seed-data';

/**
 * TODO(state-management): this is a plain React Context stand-in so the MVP
 * screens are wireable now. State management (Zustand vs Context) and a
 * real backend are explicitly undecided per the brief — replace this whole
 * module once that's picked. The durable fields below (courses, tasks,
 * availability, scheduledBlocks) now persist locally via AsyncStorage; see
 * loadPersistedAppState(). isAuthed and the in-flight recovery fields stay
 * in-memory only, unchanged from before — see the field comments.
 */

const APP_STATE_STORAGE_KEY = 'student-assistant:app-state';

/**
 * How far forward availabilityRules/fixedCommitments get expanded from "now"
 * (see computeHorizon) — a floor so a brand-new user with no deadlines yet
 * still gets a real planning window, and a ceiling so a distant/typo'd
 * deadline can't blow up expansion cost. Matches expandAvailability.ts's own
 * documented "real usage" assumption (12 weeks).
 */
const MIN_HORIZON_WEEKS = 2;
const MAX_HORIZON_WEEKS = 12;

/** The subset of AppState that's durable academic data — everything else (auth, in-flight recovery UI) stays transient. */
export interface PersistedAppState {
  courses: Course[];
  tasks: Task[];
  /** Category 4 (Phase 3F) — one-time extra availability blocks. Raw source, not the engine's effective input — see effectiveAvailability. */
  availability: AvailabilityBlock[];
  scheduledBlocks: ScheduledBlock[];
  /** Category 1 (Phase 3F) — weekly recurring availability. Optional for backward compatibility with data persisted before this field existed. */
  availabilityRules?: AvailabilityRule[];
  /** Category 2 (Phase 3F) — fixed commitments (class/work/appointments) the scheduler must never place a task on top of. */
  fixedCommitments?: FixedCommitment[];
  /** Category 3 (Phase 3F) — temporary unavailable periods (e.g. travel). */
  unavailablePeriods?: TemporaryUnavailablePeriod[];
}

function isValidPersistedAppState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // availabilityRules/fixedCommitments/unavailablePeriods are deliberately
  // NOT required here — data persisted before Phase 3F's wiring won't have
  // them, and treating their absence as invalid would silently discard a
  // real user's courses/tasks/scheduledBlocks. Each is read with `?? []`
  // below, so "missing" and "empty" behave identically.
  return (
    Array.isArray(v.courses) &&
    Array.isArray(v.tasks) &&
    Array.isArray(v.availability) &&
    Array.isArray(v.scheduledBlocks)
  );
}

/** Reads persisted app data, if any valid data exists. Never throws — see readPersisted. */
export async function loadPersistedAppState(): Promise<PersistedAppState | null> {
  const data = await readPersisted<unknown>(APP_STATE_STORAGE_KEY);
  return isValidPersistedAppState(data) ? data : null;
}

interface AppState {
  isAuthed: boolean;
  login: () => void;
  logout: () => void;

  courses: Course[];
  addCourse: (course: Omit<Course, 'id'>) => string;
  updateCourse: (id: string, updates: Partial<Omit<Course, 'id'>>) => void;

  tasks: Task[];
  /**
   * Adds the task and immediately attempts to place it (Phase 3C — see
   * planTaskChange). Returns true if a review proposal was created (the
   * caller should navigate to /reschedule); false if it was placed silently,
   * couldn't be scheduling-relevant, or nothing needed reviewing.
   */
  addTask: (task: Omit<Task, 'id' | 'status'>) => boolean;
  /**
   * Updates the task. If a scheduling-relevant field's VALUE actually
   * changed (dueDate/estimatedMinutes/taskType — not just present in
   * `updates`, since callers may resend unchanged fields), re-plans that
   * task only, holding every other scheduled task fixed. Returns true if a
   * review proposal was created; false otherwise (including title-only or
   * other non-scheduling edits, which never re-plan at all).
   */
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'status'>>) => boolean;
  /** Removes the task and any scheduled block for it — never leaves an orphaned block behind. */
  removeTask: (id: string) => void;
  /** Marks a task done. Safe to call repeatedly — setting an already-completed task to 'completed' again is a no-op. Does not touch its scheduled block. */
  markTaskCompleted: (id: string) => void;
  /**
   * Phase 3G — undoes an accidental completion. Restores the task to
   * 'pending' (the same status every other active task in this app already
   * uses — 'scheduled' is never assigned anywhere in the codebase). Never
   * deletes, duplicates, or re-creates the task, never touches its
   * scheduledBlocks (completion never removed them — see markTaskCompleted
   * — so there's nothing to restore or fabricate), and never routes through
   * the replan/proposal machinery, since nothing about placement changed.
   * Safe to call repeatedly.
   */
  reopenTask: (id: string) => void;

  /**
   * Removes the course and cascades: every task belonging to it, and every
   * scheduled block for those tasks. Documents are a separate Context (see
   * content-state.tsx) — callers that also need to clean up a course's
   * documents call contentState.removeDocumentsByCourse(id) alongside this.
   */
  removeCourse: (id: string) => void;

  scheduledBlocks: ScheduledBlock[];
  /** Also returns the task to 'pending' so it re-enters planning instead of becoming an invisible orphan. */
  removeScheduledBlock: (blockId: string) => void;

  /** Category 4 (Phase 3F) — one-time extra availability blocks. The raw source Settings' "One-time" section edits — NOT what the engine actually schedules against; see effectiveAvailability. */
  availability: AvailabilityBlock[];
  /**
   * Phase 3D — commits the new block, then attempts to place any currently-
   * unscheduled task into it (existing scheduled work is never touched by an
   * addition — see planAvailabilityChange). Returns true if a review
   * proposal was created (the caller should navigate to /reschedule); false
   * if applied silently or nothing changed. Adding time can never itself
   * invalidate existing work, so this practically always returns false.
   */
  addAvailabilityBlock: (block: Omit<AvailabilityBlock, 'id'>) => boolean;
  /**
   * Commits the edit, then re-plans only whichever tasks' existing blocks no
   * longer fit (plus any newly-fitting unscheduled tasks). Returns true if a
   * review proposal was created.
   */
  updateAvailabilityBlock: (id: string, updates: Partial<Omit<AvailabilityBlock, 'id'>>) => boolean;
  /** Commits the removal, then re-plans only whichever tasks' existing blocks no longer fit. Returns true if a review proposal was created. */
  removeAvailabilityBlock: (id: string) => boolean;

  /** Category 1 (Phase 3F) — weekly recurring availability (e.g. "Mon 6–9pm, every week"). */
  availabilityRules: AvailabilityRule[];
  addAvailabilityRule: (rule: Omit<AvailabilityRule, 'id'>) => boolean;
  updateAvailabilityRule: (id: string, updates: Partial<Omit<AvailabilityRule, 'id'>>) => boolean;
  removeAvailabilityRule: (id: string) => boolean;

  /** Category 2 (Phase 3F) — fixed commitments (classes/work/appointments). The scheduler treats these as unavailable, same as any other commitment — never placing a study task on top of one. */
  fixedCommitments: FixedCommitment[];
  addFixedCommitment: (commitment: DistributiveOmit<FixedCommitment, 'id'>) => boolean;
  removeFixedCommitment: (id: string) => boolean;

  /** Category 3 (Phase 3F) — temporary unavailable periods (e.g. travel, a busy week). */
  unavailablePeriods: TemporaryUnavailablePeriod[];
  addUnavailablePeriod: (period: Omit<TemporaryUnavailablePeriod, 'id'>) => boolean;
  removeUnavailablePeriod: (id: string) => boolean;

  /**
   * Phase 3F wiring — the real, concrete availability the scheduling engine
   * actually plans against: all four raw sources above, expanded and
   * combined (unavailable always wins) over the current horizon (see
   * computeHorizon/expandAvailability, both pure and protected-adjacent).
   * Read-only derived data — never persisted, never set directly. Anything
   * that needs to know what the engine will actually see (a preview before
   * committing a change, e.g. recovery/[id].tsx) should read this, not the
   * raw `availability` field above.
   */
  effectiveAvailability: AvailabilityBlock[];

  health: ScheduleHealth;

  /**
   * A correctly-scoped companion to health.message — see the bug-fix
   * comment on its computation. null when there's no active task with a
   * real (non-past) deadline to anchor on.
   */
  nearTermWorkload: {
    nearestDeadline: string;
    neededMinutesNearTerm: number;
    availableMinutesNearTerm: number;
    neededMinutesTotal: number;
    availableMinutesTotal: number;
  } | null;

  pendingReschedule: RescheduleResult | null;
  pendingExplanations: ExplanationEntry[];
  markMissed: (taskId: string) => void;
  acceptReschedule: () => void;

  /** Summary of the most recently accepted reschedule, for the Dashboard's "recently adjusted" note. */
  lastAcceptedChange: { taskTitle: string; newBlock: ScheduledBlock } | null;
}

/** Plain Omit doesn't distribute over a union — Omit<A|B,'id'> collapses to only the keys A and B share. FixedCommitment is a discriminated union (kind: 'recurring' | 'one-time'), so its add-payload type needs this distributive form to keep both branches' own fields (weekday vs date) intact. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

const AppStateContext = createContext<AppState | null>(null);

function isSchedulable(task: Task): boolean {
  return task.status === 'pending' || task.status === 'scheduled';
}

export function AppStateProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  /** Resolved by RootLayout before this provider ever mounts — null means no valid persisted data existed, so seed data is used. */
  initialData: PersistedAppState | null;
}) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [courses, setCourses] = useState<Course[]>(initialData?.courses ?? seedCourses);
  const [tasks, setTasks] = useState<Task[]>(initialData?.tasks ?? seedTasks);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>(initialData?.availability ?? seedAvailability);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>(
    initialData?.availabilityRules ?? seedAvailabilityRules
  );
  const [fixedCommitments, setFixedCommitments] = useState<FixedCommitment[]>(initialData?.fixedCommitments ?? []);
  const [unavailablePeriods, setUnavailablePeriods] = useState<TemporaryUnavailablePeriod[]>(
    initialData?.unavailablePeriods ?? []
  );
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>(() => {
    if (initialData) return initialData.scheduledBlocks;
    // Boot-time schedule for a genuinely fresh install: computed the exact
    // same way effectiveAvailability will be a moment later (same horizon,
    // same expansion) so the very first paint is already consistent with
    // it — rather than the seed's raw one-time blocks alone, which would
    // miss Krishna's recurring weekly rules entirely and, before this fix,
    // could disagree with the first real effectiveAvailability recompute.
    const horizon = computeHorizon(seedTasks, MIN_HORIZON_WEEKS, MAX_HORIZON_WEEKS, getNow());
    const seedEffectiveAvailability = expandAvailability(seedAvailabilityRules, seedAvailability, [], [], horizon.start, horizon.end);
    return generateSchedule(seedTasks.filter(isSchedulable), seedEffectiveAvailability).scheduled;
  });
  // Phase 3E — pendingProposal wraps the raw RescheduleResult with the
  // scheduling revision it was computed against; pendingReschedule (the
  // public shape reschedule.tsx already reads) is derived from it below, so
  // that screen needed zero changes. schedulingRevisionRef is a ref, not
  // state — it's bumped explicitly at each committed scheduling-relevant
  // mutation's boundary (never in an effect, never on every render — see
  // the mutation handlers below), and reading `.current` is always the
  // live value with no stale-closure risk, unlike state would have.
  const [pendingProposal, setPendingProposal] = useState<ScheduleProposal | null>(null);
  const [pendingExplanations, setPendingExplanations] = useState<ExplanationEntry[]>([]);
  const [lastAcceptedChange, setLastAcceptedChange] = useState<AppState['lastAcceptedChange']>(null);
  const schedulingRevisionRef = useRef(0);

  // Skip the very first run: that write would just re-save the exact data
  // we either just hydrated from storage or freshly seeded — a real write
  // only makes sense once something actually changes.
  const skipNextPersist = useRef(true);
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    writePersisted<PersistedAppState>(APP_STATE_STORAGE_KEY, {
      courses,
      tasks,
      availability,
      scheduledBlocks,
      availabilityRules,
      fixedCommitments,
      unavailablePeriods,
    });
  }, [courses, tasks, availability, scheduledBlocks, availabilityRules, fixedCommitments, unavailablePeriods]);

  // Phase 3F wiring — the engine's real input. Recomputed whenever any of
  // the four raw sources or the active task set (which determines the
  // horizon's far end, see computeHorizon) changes. getNow() is called at
  // render time, not cached — the same acceptable imprecision the rest of
  // the app already has (see reference-date.ts): this recomputes on every
  // relevant state change, not every tick, so "now" here is only ever as
  // stale as the time since the last mutation, never longer.
  const effectiveAvailability = useMemo(() => {
    const horizon = computeHorizon(tasks, MIN_HORIZON_WEEKS, MAX_HORIZON_WEEKS, getNow());
    return expandAvailability(availabilityRules, availability, fixedCommitments, unavailablePeriods, horizon.start, horizon.end);
  }, [tasks, availabilityRules, availability, fixedCommitments, unavailablePeriods]);

  /** Same expansion as effectiveAvailability, but with exactly one raw source hypothetically swapped — used by each add/update/remove mutator below to preview its own change's real effect before committing it. */
  const computeEffectiveAvailability = (overrides: {
    rules?: AvailabilityRule[];
    oneTime?: AvailabilityBlock[];
    commitments?: FixedCommitment[];
    unavailable?: TemporaryUnavailablePeriod[];
  }): AvailabilityBlock[] => {
    const horizon = computeHorizon(tasks, MIN_HORIZON_WEEKS, MAX_HORIZON_WEEKS, getNow());
    return expandAvailability(
      overrides.rules ?? availabilityRules,
      overrides.oneTime ?? availability,
      overrides.commitments ?? fixedCommitments,
      overrides.unavailable ?? unavailablePeriods,
      horizon.start,
      horizon.end
    );
  };

  // Bug fix: getScheduleHealth (protected, unmodified) runs its own greedy
  // placement simulation to determine real feasibility — but that
  // simulation has no fallback for a task whose deadline has already
  // elapsed (only rescheduleAfterMiss/replanTasks retry without honoring
  // the deadline; this one, correctly for its own contract, does not).
  // ANY task with an already-past dueDate that isn't 'completed' —
  // 'missed', or 'pending' after a successful recovery (which gives a task
  // a new block but never changes its original dueDate) — therefore always
  // overflows, permanently pinning the status to red regardless of how
  // much real capacity exists for everything else. Reproduced live:
  // completing 8 of 9 tasks, leaving only one already-past-due missed
  // task, still showed Overloaded. A deadline that's already gone is a
  // "did I handle my past" question — already owned by the dedicated
  // missed-task banner/recovery flow — not a "can I handle what's ahead"
  // one, which is what this card is actually for; so it's excluded here,
  // at the caller boundary, rather than changing the protected file's own
  // contract.
  // Matches effectiveAvailability's own convention just above: getNow() is
  // called fresh inside the memo callback (not listed as a dependency),
  // so this recomputes whenever tasks/availability actually change rather
  // than on every render — "now" here is only ever as stale as the time
  // since the last relevant mutation, the same acceptable imprecision the
  // rest of the app already has (see reference-date.ts).
  const healthRelevantTasks = useMemo(
    () => tasks.filter((t) => new Date(t.dueDate).getTime() >= getNow().getTime()),
    [tasks]
  );
  const health = useMemo(
    () => getScheduleHealth(healthRelevantTasks, effectiveAvailability),
    [healthRelevantTasks, effectiveAvailability]
  );

  // Bug fix: getScheduleHealth's own message text says "You have Xh of
  // work due before {nearest deadline} but only Yh scheduled" — but X is
  // actually the sum of EVERY active task's time, not just the ones
  // genuinely due by that nearest deadline (most are due days later).
  // Reproduced live: message claimed "9h due before Wednesday" when only
  // one 45-minute task was actually due by then — the rest were real work,
  // just due later, misattributed to "before Wednesday" by the sentence's
  // own construction. getScheduleHealth is fully protected (its STATUS —
  // red/yellow/green — comes from a real, more rigorous whole-horizon
  // placement simulation and stays authoritative, untouched here), but
  // nothing requires trusting its pre-built message string for a claim
  // this specific. This is a genuinely correctly-scoped equivalent,
  // computed from the same real tasks/effectiveAvailability data (the
  // same category of real-data aggregation as remainingMinutesToday
  // above — filtering and summing, not a scheduling decision) — Dashboard
  // uses it instead of the protected message's "before X" sentence.
  const nearTermWorkload = useMemo(() => {
    if (healthRelevantTasks.length === 0) return null;
    const nearestDeadlineMs = Math.min(...healthRelevantTasks.map((t) => new Date(t.dueDate).getTime()));
    const dueByNearest = healthRelevantTasks.filter((t) => new Date(t.dueDate).getTime() <= nearestDeadlineMs);
    const neededMinutesNearTerm = dueByNearest.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const availableMinutesNearTerm = effectiveAvailability.reduce((sum, b) => {
      const start = new Date(b.start).getTime();
      const end = Math.min(new Date(b.end).getTime(), nearestDeadlineMs);
      return sum + Math.max(0, (end - start) / 60_000);
    }, 0);
    const neededMinutesTotal = healthRelevantTasks.reduce((sum, t) => sum + t.estimatedMinutes, 0);
    const availableMinutesTotal = effectiveAvailability.reduce(
      (sum, b) => sum + (new Date(b.end).getTime() - new Date(b.start).getTime()) / 60_000,
      0
    );
    return {
      nearestDeadline: new Date(nearestDeadlineMs).toISOString(),
      neededMinutesNearTerm,
      availableMinutesNearTerm,
      neededMinutesTotal,
      availableMinutesTotal,
    };
  }, [healthRelevantTasks, effectiveAvailability]);

  /**
   * Phase 3C — general single-task re-planning orchestration. Re-plans
   * exactly one task (newly added, or one whose scheduling-relevant fields
   * just changed) via replanTasks, which structurally never touches any
   * other task's block — that's the trust guarantee, enforced by the
   * primitive itself, not by this function. The result is either applied
   * immediately (nothing the student already committed to moved) or routed
   * through the same pendingReschedule/pendingExplanations/review flow
   * markMissed already uses.
   *
   * Returns true when a review proposal was created (the caller should
   * navigate to /reschedule); false when applied silently or when there was
   * nothing to do.
   */
  const planTaskChange = useCallback((targetTask: Task, allTasksSnapshot: Task[]): boolean => {
    const result = replanTasks([targetTask], allTasksSnapshot, effectiveAvailability, scheduledBlocks);
    const isOverflow = result.overflow.some((t) => t.id === targetTask.id);
    const hadPreviousBlock = scheduledBlocks.some((b) => b.taskId === targetTask.id);
    const reasonCode = isOverflow ? ReasonCode.OVERFLOW_DEFERRED : ReasonCode.AVAILABILITY_FREED;
    const diffed = diffSchedules(scheduledBlocks, result.scheduledBlocks, [targetTask.id], reasonCode);

    // A task landing in previously-open time — whether it's brand new, or
    // being edited while it had no prior placement — never displaces
    // anyone, so it applies immediately. Only a task that already had a
    // real placement moving to a different time, or losing its placement
    // entirely (overflow), is a change worth asking the student to review.
    const reviewNeeded = isOverflow || (diffed.length > 0 && hadPreviousBlock);

    if (!reviewNeeded) {
      setScheduledBlocks(result.scheduledBlocks);
      return false;
    }

    // diffSchedules reports nothing when a task had no block and still has
    // none (e.g. an edit that leaves an already-overflowing task still
    // overflowing) — but overflow must always stay visible, so guarantee at
    // least one change entry exists whenever review is needed.
    const changes: ScheduleChange[] =
      diffed.length > 0
        ? diffed
        : [{ taskId: targetTask.id, reasonCode, previousBlock: undefined, newBlock: undefined }];

    const explanations: ExplanationEntry[] = changes.map((change) => ({
      taskId: change.taskId,
      reasonCode: change.reasonCode,
      message: !change.newBlock
        ? `${targetTask.title} couldn't be fit into your schedule. Consider freeing up time, or adjusting its deadline or duration.`
        : change.previousBlock
          ? `${targetTask.title} needed a new time because of your recent edit. It still fits before its deadline.`
          : `${targetTask.title} was added to your schedule in the next available open time.`,
    }));

    // Tagged with the CURRENT revision — the caller (addTask/updateTask) has
    // already bumped it before calling planTaskChange, so this reflects the
    // state this exact proposal was computed against, not whatever it was
    // before the mutation.
    setPendingProposal(
      createScheduleProposal({ scheduledBlocks: result.scheduledBlocks, overflow: result.overflow, changes }, schedulingRevisionRef.current)
    );
    setPendingExplanations(explanations);
    return true;
  }, [effectiveAvailability, scheduledBlocks]);

  /**
   * Phase 3D — availability-triggered re-planning. Shared by add/edit/remove
   * so all three funnel through one orchestration, exactly like Phase 3C's
   * addTask/updateTask share planTaskChange. `newAvailability` is computed
   * explicitly by the caller (never read back from a functional setState
   * updater) so this never operates on a stale value — see the Phase 3D
   * report's note on state-timing.
   *
   * findAvailabilityImpact (pure) determines exactly which tasks are
   * affected (their existing block no longer fits under newAvailability) and
   * which are unscheduled candidates that might now fit. Only that
   * candidate set is ever handed to replanTasks — every other task's block
   * is structurally protected by replanTasks itself, the same guarantee
   * Phase 3C already established. Adding time can only ever produce
   * `unscheduled` candidates (a union of segments can't invalidate a block
   * that was already valid), so `affected` is always empty for a pure
   * addition — meaning an addition can never require review, matching the
   * "adding time may place unscheduled work silently" rule directly rather
   * than by a separate special case.
   *
   * Phase 3F — generalized to work for all four availability source
   * categories, not just one-time blocks: `newAvailability` is always the
   * fully-expanded EFFECTIVE availability (see effectiveAvailability /
   * computeEffectiveAvailability), and `commitRawChange` is supplied by the
   * specific mutator (addAvailabilityBlock, addAvailabilityRule,
   * addFixedCommitment, etc.) to commit whichever raw source it actually
   * changed. This function itself never knows or cares which source that
   * was — it only ever reasons about the resulting concrete availability.
   */
  const planAvailabilityChange = useCallback(
    (newAvailability: AvailabilityBlock[], commitRawChange: () => void): boolean => {
      // Bug fix (this phase): effectiveAvailability is horizon-clipped to
      // start at real "now" (see computeHorizon), but scheduledBlocks is
      // never retroactively re-validated as real time passes — a block
      // whose time has already fully elapsed sits there unchanged whether
      // or not its task was ever resolved. Judging an already-past block
      // against a horizon that (correctly) starts at "now" is an
      // apples-to-oranges comparison: newSegments structurally CAN'T
      // contain it (it starts before every segment), so every such block
      // was being flagged "affected" by ANY availability edit — flooding
      // replanTasks with a pile of stale candidates that outcompeted the
      // genuinely new/unscheduled work for the newly added time. A task
      // whose block already elapsed without being completed or marked
      // missed is a real, separate problem (effectively an unresolved
      // overdue task), but an availability EDIT is not the mechanism that
      // should silently sweep it into a mass re-plan — so its past blocks
      // are excluded here, same as a completed/missed task's blocks
      // already were.
      const nowMs = getNow().getTime();
      const relevantScheduledBlocks = scheduledBlocks.filter((b) => new Date(b.end).getTime() > nowMs);
      const { affected, unscheduled } = findAvailabilityImpact(tasks, relevantScheduledBlocks, newAvailability);
      const candidates = [...affected, ...unscheduled];

      if (candidates.length === 0) {
        // Nothing was invalidated and nothing newly fits — just commit the
        // raw source; there's no schedule consequence at all.
        commitRawChange();
        return false;
      }

      const result = replanTasks(candidates, tasks, newAvailability, scheduledBlocks);
      const candidateIds = candidates.map((t) => t.id);
      const reasonCode = ReasonCode.AVAILABILITY_FREED;
      const diffed = diffSchedules(scheduledBlocks, result.scheduledBlocks, candidateIds, reasonCode);

      // Being "affected" means a block that used to be valid no longer is —
      // that can never be a no-op, so any affected task always means review
      // is required. Unscheduled tasks picked up in the same batch ride
      // along in the same proposal (they were replanned together and can
      // compete for the same freed time) rather than being silently applied
      // on the side while the affected task is separately reviewed.
      const reviewNeeded = affected.length > 0;

      commitRawChange();

      if (!reviewNeeded) {
        setScheduledBlocks(result.scheduledBlocks);
        return false;
      }

      // Guarantee every affected task has a visible entry even in the
      // (normally unreachable) case diffSchedules found no difference for
      // it — never let an affected task go unmentioned in its own review.
      const coveredIds = new Set(diffed.map((c) => c.taskId));
      const missingAffected: ScheduleChange[] = affected
        .filter((t) => !coveredIds.has(t.id))
        .map((t) => ({
          taskId: t.id,
          reasonCode,
          previousBlock: scheduledBlocks.find((b) => b.taskId === t.id),
          newBlock: result.scheduledBlocks.find((b) => b.taskId === t.id),
        }));
      const changes = [...diffed, ...missingAffected];

      const explanations: ExplanationEntry[] = changes.map((change) => {
        const changedTask = tasks.find((t) => t.id === change.taskId);
        const title = changedTask?.title ?? 'This task';
        return {
          taskId: change.taskId,
          reasonCode: change.reasonCode,
          message: !change.newBlock
            ? `${title} couldn't be fit after your availability change. Consider freeing up time, or adjusting its deadline or duration.`
            : change.previousBlock
              ? `${title} needed a new time because your availability changed.`
              : `${title} was scheduled using your newly added availability.`,
        };
      });

      setPendingProposal(
        createScheduleProposal({ scheduledBlocks: result.scheduledBlocks, overflow: result.overflow, changes }, schedulingRevisionRef.current)
      );
      setPendingExplanations(explanations);
      return true;
    },
    [tasks, scheduledBlocks]
  );

  // Phase 3E — any existing pending proposal is unconditionally stale the
  // moment a new scheduling-relevant mutation commits (revision-level
  // invalidation, not a dependency graph — see scheduling-types.ts). Every
  // mutation handler below calls this right after bumping the revision,
  // before it does anything that might set a fresh proposal of its own —
  // so a mutation that doesn't produce a new proposal still leaves no stale
  // one behind, and a mutation that does produce one simply overwrites this
  // immediately after with setPendingProposal(...).
  //
  // Phase 3G — also clears lastAcceptedChange here. That note is a one-shot
  // "X was moved to Y" summary of the most recently accepted change; once
  // any further scheduling-relevant mutation happens, it can easily
  // reference a block that no longer exists (e.g. the student removed that
  // exact block from Calendar afterward) — showing it then reads as a
  // stale/confusing review indicator, exactly the bug this phase fixes.
  // acceptReschedule sets a fresh one immediately after, so this never
  // suppresses a legitimate, current note.
  const invalidatePendingProposal = useCallback(() => {
    setPendingProposal(null);
    setPendingExplanations([]);
    setLastAcceptedChange(null);
  }, []);

  const value = useMemo<AppState>(
    () => ({
      isAuthed,
      login: () => setIsAuthed(true),
      logout: () => setIsAuthed(false),

      courses,
      addCourse: (course) => {
        const id = `course-${Date.now()}`;
        setCourses((prev) => [...prev, { ...course, id }]);
        return id;
      },
      updateCourse: (id, updates) =>
        setCourses((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c))),

      tasks,
      addTask: (task) => {
        const newTask: Task = { ...task, id: `task-${Date.now()}`, status: 'pending' };
        setTasks((prev) => [...prev, newTask]);
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planTaskChange(newTask, [...tasks, newTask]);
      },
      updateTask: (id, updates) => {
        const existing = tasks.find((t) => t.id === id);
        const nextTasks = tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
        setTasks(nextTasks);
        if (!existing) return false;

        const updatedTask = { ...existing, ...updates };
        // Compare actual VALUES, not just which keys are present in
        // `updates` — task-entry.tsx resends every field on every save
        // (including unchanged ones), so a title-only edit must not be
        // mistaken for a scheduling-relevant one just because dueDate etc.
        // happen to be present in the payload with their existing value.
        // Per Phase 3E: a pure metadata edit must NOT bump the revision or
        // invalidate a pending proposal — acceptReschedule only ever writes
        // scheduledBlocks (and, for recovery, task.status), never
        // title/description/etc., so an old proposal remains perfectly
        // safe to accept across an unrelated metadata edit.
        const schedulingRelevantChanged =
          updatedTask.dueDate !== existing.dueDate ||
          updatedTask.estimatedMinutes !== existing.estimatedMinutes ||
          updatedTask.taskType !== existing.taskType;
        if (!schedulingRelevantChanged) return false;

        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planTaskChange(updatedTask, nextTasks);
      },
      removeTask: (id) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setScheduledBlocks((prev) => prev.filter((b) => b.taskId !== id));
        // A deleted task can never leave behind an applicable proposal —
        // see Phase 3E §13. No new proposal is generated here: deletion
        // does not auto-repack other tasks (Phase 3B/3C precedent).
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
      },

      markTaskCompleted: (id) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'completed' } : t)));
        // No auto-repack, no new proposal — only prevents a stale proposal
        // from later being applied against the now-changed state.
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
      },

      reopenTask: (id) => {
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'pending' } : t)));
        // Same treatment as markTaskCompleted — a status change is
        // scheduling-relevant bookkeeping even though nothing about
        // placement changes here. No planTaskChange call: the task's
        // scheduledBlocks (if it has any) were never touched by completion
        // and aren't touched here either — reopening never fabricates or
        // removes a block.
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
      },

      removeCourse: (id) => {
        const removedTaskIds = new Set(tasks.filter((t) => t.courseId === id).map((t) => t.id));
        setCourses((prev) => prev.filter((c) => c.id !== id));
        setTasks((prev) => prev.filter((t) => t.courseId !== id));
        setScheduledBlocks((prev) => prev.filter((b) => !removedTaskIds.has(b.taskId)));
        // Cascades to remove scheduledBlocks — scheduling-relevant, same as removeTask.
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
      },

      scheduledBlocks,
      removeScheduledBlock: (blockId) => {
        const block = scheduledBlocks.find((b) => b.id === blockId);
        setScheduledBlocks((prev) => prev.filter((b) => b.id !== blockId));
        if (block) {
          setTasks((prev) =>
            prev.map((t) => (t.id === block.taskId && t.status === 'scheduled' ? { ...t, status: 'pending' } : t))
          );
        }
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
      },

      availability,
      addAvailabilityBlock: (block) => {
        const newBlock: AvailabilityBlock = { ...block, id: `avail-${Date.now()}` };
        const newOneTime = [...availability, newBlock];
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ oneTime: newOneTime }), () => setAvailability(newOneTime));
      },
      updateAvailabilityBlock: (id, updates) => {
        const newOneTime = availability.map((a) => (a.id === id ? { ...a, ...updates } : a));
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ oneTime: newOneTime }), () => setAvailability(newOneTime));
      },
      removeAvailabilityBlock: (id) => {
        const newOneTime = availability.filter((a) => a.id !== id);
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ oneTime: newOneTime }), () => setAvailability(newOneTime));
      },

      availabilityRules,
      addAvailabilityRule: (rule) => {
        const newRule: AvailabilityRule = { ...rule, id: `rule-${Date.now()}` };
        const newRules = [...availabilityRules, newRule];
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ rules: newRules }), () => setAvailabilityRules(newRules));
      },
      updateAvailabilityRule: (id, updates) => {
        const newRules = availabilityRules.map((r) => (r.id === id ? { ...r, ...updates } : r));
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ rules: newRules }), () => setAvailabilityRules(newRules));
      },
      removeAvailabilityRule: (id) => {
        const newRules = availabilityRules.filter((r) => r.id !== id);
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(computeEffectiveAvailability({ rules: newRules }), () => setAvailabilityRules(newRules));
      },

      fixedCommitments,
      addFixedCommitment: (commitment) => {
        const newCommitment = { ...commitment, id: `commitment-${Date.now()}` } as FixedCommitment;
        const newCommitments = [...fixedCommitments, newCommitment];
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(
          computeEffectiveAvailability({ commitments: newCommitments }),
          () => setFixedCommitments(newCommitments)
        );
      },
      removeFixedCommitment: (id) => {
        const newCommitments = fixedCommitments.filter((c) => c.id !== id);
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(
          computeEffectiveAvailability({ commitments: newCommitments }),
          () => setFixedCommitments(newCommitments)
        );
      },

      unavailablePeriods,
      addUnavailablePeriod: (period) => {
        const newPeriod: TemporaryUnavailablePeriod = { ...period, id: `unavail-${Date.now()}` };
        const newPeriods = [...unavailablePeriods, newPeriod];
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(
          computeEffectiveAvailability({ unavailable: newPeriods }),
          () => setUnavailablePeriods(newPeriods)
        );
      },
      removeUnavailablePeriod: (id) => {
        const newPeriods = unavailablePeriods.filter((p) => p.id !== id);
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        return planAvailabilityChange(
          computeEffectiveAvailability({ unavailable: newPeriods }),
          () => setUnavailablePeriods(newPeriods)
        );
      },

      effectiveAvailability,

      health,
      nearTermWorkload,

      // Public shape is unchanged (RescheduleResult | null) — reschedule.tsx
      // needed zero changes for Phase 3E. Internally this is just a view
      // onto pendingProposal.result.
      pendingReschedule: pendingProposal?.result ?? null,
      pendingExplanations,
      markMissed: (taskId) => {
        const missedTask = tasks.find((t) => t.id === taskId);
        if (!missedTask) return;
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'missed' } : t)));
        schedulingRevisionRef.current += 1;
        invalidatePendingProposal();
        const result = rescheduleAfterMiss(missedTask, tasks, effectiveAvailability);
        setPendingProposal(createScheduleProposal(result, schedulingRevisionRef.current));
        setPendingExplanations(explainChanges(result, tasks));
      },
      acceptReschedule: () => {
        if (!pendingProposal) return;
        // Phase 3E — the critical safety check: refuse to apply a proposal
        // that was computed against state that's since moved on. Never
        // partially apply, never fall back to some other data — just clear
        // it and leave the app in whatever the latest committed state
        // already is.
        if (!isProposalCurrent(pendingProposal, schedulingRevisionRef.current)) {
          setPendingProposal(null);
          setPendingExplanations([]);
          return;
        }
        const pendingReschedule = pendingProposal.result;
        const changed = pendingReschedule.changes.find((c) => c.newBlock);
        if (changed?.newBlock) {
          const changedTask = tasks.find((t) => t.id === changed.taskId);
          setLastAcceptedChange({ taskTitle: changedTask?.title ?? 'Task', newBlock: changed.newBlock });
        }
        // Every task that received a real new slot in this recovery is no
        // longer "missed" — it has an active, current placement again. A
        // task the engine still couldn't place (no newBlock, i.e. overflow)
        // stays 'missed', since it genuinely remains unresolved. Mirrors the
        // same status-resolution removeScheduledBlock already does.
        const recoveredTaskIds = new Set(
          pendingReschedule.changes.filter((c) => c.newBlock).map((c) => c.taskId)
        );
        setTasks((prev) =>
          prev.map((t) => (recoveredTaskIds.has(t.id) && t.status === 'missed' ? { ...t, status: 'pending' } : t))
        );
        setScheduledBlocks(pendingReschedule.scheduledBlocks);
        // Applying a proposal is itself a committed scheduling-relevant
        // mutation — keep the invariant that every one of those advances
        // the revision, so nothing generated before this moment could ever
        // be mistaken for current afterward.
        schedulingRevisionRef.current += 1;
        setPendingProposal(null);
        setPendingExplanations([]);
      },

      lastAcceptedChange,
    }),
    [
      isAuthed,
      courses,
      tasks,
      scheduledBlocks,
      availability,
      availabilityRules,
      fixedCommitments,
      unavailablePeriods,
      effectiveAvailability,
      health,
      nearTermWorkload,
      pendingProposal,
      pendingExplanations,
      lastAcceptedChange,
      planTaskChange,
      planAvailabilityChange,
      invalidatePendingProposal,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

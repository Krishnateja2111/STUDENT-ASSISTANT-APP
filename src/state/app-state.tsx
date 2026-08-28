import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import {
  explainChanges,
  generateSchedule,
  getScheduleHealth,
  rescheduleAfterMiss,
  type AvailabilityBlock,
  type Course,
  type ExplanationEntry,
  type RescheduleResult,
  type ScheduledBlock,
  type ScheduleHealth,
  type Task,
} from '@/lib/scheduling';
import { readPersisted, writePersisted } from '@/lib/storage';
import { seedAvailability, seedCourses, seedTasks } from '@/state/seed-data';

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

/** The subset of AppState that's durable academic data — everything else (auth, in-flight recovery UI) stays transient. */
export interface PersistedAppState {
  courses: Course[];
  tasks: Task[];
  availability: AvailabilityBlock[];
  scheduledBlocks: ScheduledBlock[];
}

function isValidPersistedAppState(value: unknown): value is PersistedAppState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
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
  addTask: (task: Omit<Task, 'id' | 'status'>) => void;
  updateTask: (id: string, updates: Partial<Omit<Task, 'id' | 'status'>>) => void;
  /** Removes the task and any scheduled block for it — never leaves an orphaned block behind. */
  removeTask: (id: string) => void;
  /** Marks a task done. Safe to call repeatedly — setting an already-completed task to 'completed' again is a no-op. Does not touch its scheduled block. */
  markTaskCompleted: (id: string) => void;

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

  availability: AvailabilityBlock[];
  addAvailabilityBlock: (block: Omit<AvailabilityBlock, 'id'>) => void;
  updateAvailabilityBlock: (id: string, updates: Partial<Omit<AvailabilityBlock, 'id'>>) => void;
  removeAvailabilityBlock: (id: string) => void;

  health: ScheduleHealth;

  pendingReschedule: RescheduleResult | null;
  pendingExplanations: ExplanationEntry[];
  markMissed: (taskId: string) => void;
  acceptReschedule: () => void;

  /** Summary of the most recently accepted reschedule, for the Dashboard's "recently adjusted" note. */
  lastAcceptedChange: { taskTitle: string; newBlock: ScheduledBlock } | null;
}

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
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>(
    () => initialData?.scheduledBlocks ?? generateSchedule(seedTasks.filter(isSchedulable), seedAvailability).scheduled
  );
  const [pendingReschedule, setPendingReschedule] = useState<RescheduleResult | null>(null);
  const [pendingExplanations, setPendingExplanations] = useState<ExplanationEntry[]>([]);
  const [lastAcceptedChange, setLastAcceptedChange] = useState<AppState['lastAcceptedChange']>(null);

  // Skip the very first run: that write would just re-save the exact data
  // we either just hydrated from storage or freshly seeded — a real write
  // only makes sense once something actually changes.
  const skipNextPersist = useRef(true);
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    writePersisted<PersistedAppState>(APP_STATE_STORAGE_KEY, { courses, tasks, availability, scheduledBlocks });
  }, [courses, tasks, availability, scheduledBlocks]);

  const health = useMemo(() => getScheduleHealth(tasks, availability), [tasks, availability]);

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
      addTask: (task) =>
        setTasks((prev) => [...prev, { ...task, id: `task-${Date.now()}`, status: 'pending' }]),
      updateTask: (id, updates) =>
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...updates } : t))),
      removeTask: (id) => {
        setTasks((prev) => prev.filter((t) => t.id !== id));
        setScheduledBlocks((prev) => prev.filter((b) => b.taskId !== id));
      },

      markTaskCompleted: (id) =>
        setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, status: 'completed' } : t))),

      removeCourse: (id) => {
        const removedTaskIds = new Set(tasks.filter((t) => t.courseId === id).map((t) => t.id));
        setCourses((prev) => prev.filter((c) => c.id !== id));
        setTasks((prev) => prev.filter((t) => t.courseId !== id));
        setScheduledBlocks((prev) => prev.filter((b) => !removedTaskIds.has(b.taskId)));
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
      },

      availability,
      addAvailabilityBlock: (block) =>
        setAvailability((prev) => [...prev, { ...block, id: `avail-${Date.now()}` }]),
      updateAvailabilityBlock: (id, updates) =>
        setAvailability((prev) => prev.map((a) => (a.id === id ? { ...a, ...updates } : a))),
      removeAvailabilityBlock: (id) => setAvailability((prev) => prev.filter((a) => a.id !== id)),

      health,

      pendingReschedule,
      pendingExplanations,
      markMissed: (taskId) => {
        const missedTask = tasks.find((t) => t.id === taskId);
        if (!missedTask) return;
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'missed' } : t)));
        const result = rescheduleAfterMiss(missedTask, tasks, availability);
        setPendingReschedule(result);
        setPendingExplanations(explainChanges(result, tasks));
      },
      acceptReschedule: () => {
        if (!pendingReschedule) return;
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
        setPendingReschedule(null);
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
      health,
      pendingReschedule,
      pendingExplanations,
      lastAcceptedChange,
    ]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

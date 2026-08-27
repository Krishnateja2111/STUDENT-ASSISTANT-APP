import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
import { seedAvailability, seedCourses, seedTasks } from '@/state/seed-data';

/**
 * TODO(state-management): this is a plain React Context stand-in so the MVP
 * screens are wireable now. State management (Zustand vs Context) and
 * persistence (Supabase vs alternative) are explicitly undecided per the
 * brief — replace this whole module once that's picked. Auth is in-memory
 * only and resets on page reload.
 */

interface AppState {
  isAuthed: boolean;
  login: () => void;
  logout: () => void;

  courses: Course[];
  addCourse: (course: Omit<Course, 'id'>) => string;
  updateCourse: (id: string, updates: Partial<Omit<Course, 'id'>>) => void;

  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => void;

  scheduledBlocks: ScheduledBlock[];
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

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [courses, setCourses] = useState<Course[]>(seedCourses);
  const [tasks, setTasks] = useState<Task[]>(seedTasks);
  const [availability, setAvailability] = useState<AvailabilityBlock[]>(seedAvailability);
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>(
    () => generateSchedule(seedTasks.filter(isSchedulable), seedAvailability).scheduled
  );
  const [pendingReschedule, setPendingReschedule] = useState<RescheduleResult | null>(null);
  const [pendingExplanations, setPendingExplanations] = useState<ExplanationEntry[]>([]);
  const [lastAcceptedChange, setLastAcceptedChange] = useState<AppState['lastAcceptedChange']>(null);

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

      scheduledBlocks,
      removeScheduledBlock: (blockId) =>
        setScheduledBlocks((prev) => prev.filter((b) => b.id !== blockId)),

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

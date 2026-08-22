import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import {
  explainChanges,
  getScheduleHealth,
  rescheduleAfterMiss,
  type Course,
  type ExplanationEntry,
  type RescheduleResult,
  type ScheduledBlock,
  type ScheduleHealth,
  type Task,
} from '@/lib/scheduling';
import {
  mockAvailability,
  mockCourses,
  mockScheduledBlocks,
  mockTasks,
} from '@/lib/scheduling/mockData';

/**
 * TODO(state-management): this is a plain React Context stand-in so the 5
 * MVP screens are wireable now. State management (Zustand vs Context) and
 * persistence (Supabase vs alternative) are explicitly undecided per the
 * brief — replace this whole module once that's picked. Auth is in-memory
 * only and resets on page reload.
 */

interface AppState {
  isAuthed: boolean;
  login: () => void;
  logout: () => void;

  courses: Course[];
  tasks: Task[];
  addTask: (task: Omit<Task, 'id' | 'status'>) => void;

  scheduledBlocks: ScheduledBlock[];
  removeScheduledBlock: (blockId: string) => void;

  health: ScheduleHealth;

  pendingReschedule: RescheduleResult | null;
  pendingExplanations: ExplanationEntry[];
  markMissed: (taskId: string) => void;
  acceptReschedule: () => void;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [isAuthed, setIsAuthed] = useState(false);
  const [tasks, setTasks] = useState<Task[]>(mockTasks);
  const [scheduledBlocks, setScheduledBlocks] = useState<ScheduledBlock[]>(mockScheduledBlocks);
  const [pendingReschedule, setPendingReschedule] = useState<RescheduleResult | null>(null);
  const [pendingExplanations, setPendingExplanations] = useState<ExplanationEntry[]>([]);

  const health = useMemo(() => getScheduleHealth(tasks, mockAvailability), [tasks]);

  const value = useMemo<AppState>(
    () => ({
      isAuthed,
      login: () => setIsAuthed(true),
      logout: () => setIsAuthed(false),

      courses: mockCourses,
      tasks,
      addTask: (task) =>
        setTasks((prev) => [...prev, { ...task, id: `task-${Date.now()}`, status: 'pending' }]),

      scheduledBlocks,
      removeScheduledBlock: (blockId) =>
        setScheduledBlocks((prev) => prev.filter((b) => b.id !== blockId)),

      health,

      pendingReschedule,
      pendingExplanations,
      markMissed: (taskId) => {
        const missedTask = tasks.find((t) => t.id === taskId);
        if (!missedTask) return;
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: 'missed' } : t)));
        const result = rescheduleAfterMiss(missedTask, tasks, mockAvailability);
        setPendingReschedule(result);
        setPendingExplanations(explainChanges(result));
      },
      acceptReschedule: () => {
        if (!pendingReschedule) return;
        setScheduledBlocks(pendingReschedule.scheduledBlocks);
        setPendingReschedule(null);
        setPendingExplanations([]);
      },
    }),
    [isAuthed, tasks, scheduledBlocks, health, pendingReschedule, pendingExplanations]
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState(): AppState {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState must be used within AppStateProvider');
  return ctx;
}

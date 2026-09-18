import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { readPersisted, writePersisted } from '@/lib/storage';

/**
 * Phase 2 ("accessory ring") state — documents and profile identity. Kept
 * separate from app-state.tsx: these are new concepts with no pre-existing
 * counterpart there, unlike courses/availability which were natural
 * extensions of state app-state.tsx already held. All of it (documents,
 * profile, notificationPrefs) now persists locally via AsyncStorage — see
 * loadPersistedContentState().
 *
 * TODO(profile): Auth's email/password inputs aren't wired to any shared
 * state (see auth.tsx), so profile identity here is a separate, locally
 * editable placeholder — not literally "what you typed in Auth." Unifying
 * them would mean touching auth.tsx.
 */

const CONTENT_STATE_STORAGE_KEY = 'student-assistant:content-state';

export interface StudentDocument {
  id: string;
  fileName: string;
  courseId: string;
  uploadedAt: string; // ISO
  mimeType: string;
  sizeBytes: number;
  /** Local picker URI — used for the trivial image-preview case only. */
  uri: string;
}

export type AcademicYear = 'Freshman' | 'Sophomore' | 'Junior' | 'Senior' | 'Graduate';

export interface StudentProfile {
  name: string;
  email: string;
  /** Every field below is optional real user-entered identity info — never pre-filled with invented data. */
  school?: string;
  major?: string;
  academicYear?: AcademicYear;
  bio?: string;
}

export interface NotificationPrefs {
  deadlineReminders: boolean;
  dailyPlanSummary: boolean;
}

/** 'system' follows the device's own light/dark setting (the previous, only behavior); 'light'/'dark' pins it regardless of the device. */
export type ThemePreference = 'system' | 'light' | 'dark';

interface ContentState {
  documents: StudentDocument[];
  addDocument: (doc: Omit<StudentDocument, 'id'>) => void;
  removeDocument: (id: string) => void;
  /** Batch delete — one state update / one persist for a multi-select delete. */
  removeDocuments: (ids: string[]) => void;
  /** Cascade cleanup for app-state's removeCourse — a separate Context, so callers invoke both. */
  removeDocumentsByCourse: (courseId: string) => void;

  profile: StudentProfile;
  updateProfile: (updates: Partial<StudentProfile>) => void;

  /** TODO(notifications): UI-only — no real push notification wiring yet. */
  notificationPrefs: NotificationPrefs;
  updateNotificationPrefs: (updates: Partial<NotificationPrefs>) => void;

  themePreference: ThemePreference;
  setThemePreference: (pref: ThemePreference) => void;
}

/** The subset of ContentState that's durable — this Context holds nothing transient beyond these four. */
export interface PersistedContentState {
  documents: StudentDocument[];
  profile: StudentProfile;
  notificationPrefs: NotificationPrefs;
  /** Optional for backward compatibility with data persisted before this field existed — see isValidPersistedContentState. */
  themePreference?: ThemePreference;
}

function isValidPersistedContentState(value: unknown): value is PersistedContentState {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  // themePreference deliberately NOT required — see availabilityRules'
  // identical reasoning in app-state.tsx: data persisted before this field
  // existed shouldn't be treated as invalid and silently discarded.
  return (
    Array.isArray(v.documents) &&
    !!v.profile &&
    typeof v.profile === 'object' &&
    !!v.notificationPrefs &&
    typeof v.notificationPrefs === 'object'
  );
}

/** Reads persisted content data, if any valid data exists. Never throws — see readPersisted. */
export async function loadPersistedContentState(): Promise<PersistedContentState | null> {
  const data = await readPersisted<unknown>(CONTENT_STATE_STORAGE_KEY);
  return isValidPersistedContentState(data) ? data : null;
}

const ContentStateContext = createContext<ContentState | null>(null);

const DEFAULT_PROFILE: StudentProfile = {
  name: 'Krishna',
  email: '',
  school: 'State University',
  major: 'Computer Science',
  academicYear: 'Junior',
  bio: '',
};
const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = { deadlineReminders: true, dailyPlanSummary: false };

export function ContentStateProvider({
  children,
  initialData,
}: {
  children: ReactNode;
  /** Resolved by RootLayout before this provider ever mounts — null means no valid persisted data existed, so defaults are used. */
  initialData: PersistedContentState | null;
}) {
  const [documents, setDocuments] = useState<StudentDocument[]>(initialData?.documents ?? []);
  const [profile, setProfile] = useState<StudentProfile>(initialData?.profile ?? DEFAULT_PROFILE);
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>(
    initialData?.notificationPrefs ?? DEFAULT_NOTIFICATION_PREFS
  );
  const [themePreference, setThemePreference] = useState<ThemePreference>(initialData?.themePreference ?? 'system');

  const skipNextPersist = useRef(true);
  useEffect(() => {
    if (skipNextPersist.current) {
      skipNextPersist.current = false;
      return;
    }
    writePersisted<PersistedContentState>(CONTENT_STATE_STORAGE_KEY, {
      documents,
      profile,
      notificationPrefs,
      themePreference,
    });
  }, [documents, profile, notificationPrefs, themePreference]);

  const value = useMemo<ContentState>(
    () => ({
      documents,
      // Bug fix (caught live): Date.now() alone collides when multiple
      // files are uploaded in one batch (a synchronous loop calling this
      // once per file easily lands two calls in the same millisecond) --
      // reproduced as a real "two children with the same key" React error
      // and a document list that couldn't tell the two apart. The random
      // suffix guarantees uniqueness within a batch, not just across ticks.
      addDocument: (doc) =>
        setDocuments((prev) => [...prev, { ...doc, id: `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` }]),
      removeDocument: (id) => setDocuments((prev) => prev.filter((d) => d.id !== id)),
      removeDocuments: (ids) => {
        const idSet = new Set(ids);
        setDocuments((prev) => prev.filter((d) => !idSet.has(d.id)));
      },
      removeDocumentsByCourse: (courseId) =>
        setDocuments((prev) => prev.filter((d) => d.courseId !== courseId)),

      profile,
      updateProfile: (updates) => setProfile((prev) => ({ ...prev, ...updates })),

      notificationPrefs,
      updateNotificationPrefs: (updates) => setNotificationPrefs((prev) => ({ ...prev, ...updates })),

      themePreference,
      setThemePreference,
    }),
    [documents, profile, notificationPrefs, themePreference]
  );

  return <ContentStateContext.Provider value={value}>{children}</ContentStateContext.Provider>;
}

export function useContentState(): ContentState {
  const ctx = useContext(ContentStateContext);
  if (!ctx) throw new Error('useContentState must be used within ContentStateProvider');
  return ctx;
}

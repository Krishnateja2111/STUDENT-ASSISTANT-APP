import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

/**
 * Phase 2 ("accessory ring") state — documents and profile identity. Kept
 * separate from app-state.tsx: these are new concepts with no pre-existing
 * counterpart there, unlike courses/availability which were natural
 * extensions of state app-state.tsx already held.
 *
 * TODO(profile): Auth's email/password inputs aren't wired to any shared
 * state (see auth.tsx), so profile identity here is a separate, locally
 * editable placeholder — not literally "what you typed in Auth." Unifying
 * them would mean touching auth.tsx.
 */

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

export interface StudentProfile {
  name: string;
  email: string;
}

export interface NotificationPrefs {
  deadlineReminders: boolean;
  dailyPlanSummary: boolean;
}

interface ContentState {
  documents: StudentDocument[];
  addDocument: (doc: Omit<StudentDocument, 'id'>) => void;

  profile: StudentProfile;
  updateProfile: (updates: Partial<StudentProfile>) => void;

  /** TODO(notifications): UI-only — no real push notification wiring yet. */
  notificationPrefs: NotificationPrefs;
  updateNotificationPrefs: (updates: Partial<NotificationPrefs>) => void;
}

const ContentStateContext = createContext<ContentState | null>(null);

export function ContentStateProvider({ children }: { children: ReactNode }) {
  const [documents, setDocuments] = useState<StudentDocument[]>([]);
  const [profile, setProfile] = useState<StudentProfile>({ name: 'Student', email: '' });
  const [notificationPrefs, setNotificationPrefs] = useState<NotificationPrefs>({
    deadlineReminders: true,
    dailyPlanSummary: false,
  });

  const value = useMemo<ContentState>(
    () => ({
      documents,
      addDocument: (doc) => setDocuments((prev) => [...prev, { ...doc, id: `doc-${Date.now()}` }]),

      profile,
      updateProfile: (updates) => setProfile((prev) => ({ ...prev, ...updates })),

      notificationPrefs,
      updateNotificationPrefs: (updates) => setNotificationPrefs((prev) => ({ ...prev, ...updates })),
    }),
    [documents, profile, notificationPrefs]
  );

  return <ContentStateContext.Provider value={value}>{children}</ContentStateContext.Provider>;
}

export function useContentState(): ContentState {
  const ctx = useContext(ContentStateContext);
  if (!ctx) throw new Error('useContentState must be used within ContentStateProvider');
  return ctx;
}

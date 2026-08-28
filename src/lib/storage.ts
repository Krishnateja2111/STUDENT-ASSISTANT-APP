import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Thin, safe wrapper around AsyncStorage used by app-state.tsx and
 * content-state.tsx. Every stored value is tagged with STORAGE_VERSION —
 * not a migration framework, just enough that a future shape change can
 * make old data cleanly fall back to seed defaults instead of crashing the
 * app on a mismatched shape. Bump this number if a persisted field's shape
 * ever changes incompatibly.
 */
const STORAGE_VERSION = 1;

interface StoredEnvelope<T> {
  version: number;
  data: T;
}

/**
 * Reads and parses a JSON value from AsyncStorage. Returns null for a
 * missing key, malformed JSON, or a version mismatch — never throws, so a
 * corrupt or unreadable entry always falls back to the caller's own
 * default/seed data rather than crashing the app.
 */
export async function readPersisted<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as StoredEnvelope<T>).version !== STORAGE_VERSION
    ) {
      return null;
    }
    return (parsed as StoredEnvelope<T>).data;
  } catch {
    return null;
  }
}

/**
 * Writes a JSON value to AsyncStorage, tagged with the current storage
 * version. Failures are swallowed by design — a write failure is not
 * surfaced to the student and never crashes the app; the session simply
 * keeps working in memory.
 */
export async function writePersisted<T>(key: string, data: T): Promise<void> {
  try {
    const envelope: StoredEnvelope<T> = { version: STORAGE_VERSION, data };
    await AsyncStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // best-effort — see doc comment above
  }
}

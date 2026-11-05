import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * The polyfill import above must run before createClient: Hermes/JSC's
 * built-in URL implementation is incomplete, and supabase-js depends on a
 * real one for request signing. See EXPO_PUBLIC_ env vars in .env.example —
 * both are safe to be public; row-level security (not key secrecy) is what
 * actually keeps one account's data away from another's.
 */

let client: SupabaseClient | null = null;

function getSupabaseClient(): SupabaseClient {
  if (client) return client;

  const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in your Supabase project's values (Settings -> API)."
    );
  }

  client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      // AsyncStorage persists the session across app restarts — same
      // mechanism the rest of this app already uses for everything else
      // (see lib/storage.ts), just handed to Supabase's own auth client here.
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // There's no browser redirect step in a magic-link/OTP flow — the
      // app itself handles the code, nothing is ever parsed from a URL.
      detectSessionInUrl: false,
    },
  });
  return client;
}

/**
 * Bug fix (reproduced live): constructing the client eagerly at module load
 * crashed Expo Router's web dev server outright — it server-renders in
 * plain Node.js (not a browser, not React Native), which has neither a
 * WebSocket global (supabase-js's realtime client wants one in its own
 * constructor, even though this app never calls any realtime method) nor a
 * `window` (the AsyncStorage adapter's web implementation wants one). Every
 * real use of this client — signing in, checking the session,
 * onAuthStateChange — already happens inside a useEffect or a button
 * handler, none of which ever run during that server render; they only run
 * once the page has actually reached a real browser or a real native
 * runtime, both of which have WebSocket/window natively. Routing every
 * access through this Proxy defers construction to that point instead of
 * import time, without changing any call site (`supabase.auth.xxx` etc.
 * keeps working exactly as before).
 */
export const supabase: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const realClient = getSupabaseClient();
    const value = (realClient as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === 'function' ? value.bind(realClient) : value;
  },
});

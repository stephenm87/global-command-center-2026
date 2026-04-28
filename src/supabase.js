// ── Supabase Client — Global Command Center ────────────────────────
// Shared singleton. Import { supabase } from anywhere in the app.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Guard: supabase-js v2 requires a valid JWT anon key (eyJ...).
// If env vars are missing OR the key is not JWT format, export a
// no-op stub so the app still renders without auth features.
const isValidJwt = (key) => typeof key === 'string' && key.startsWith('eyJ');
const isConfigured = SUPABASE_URL && isValidJwt(SUPABASE_ANON);

if (!isConfigured) {
    console.warn(
        '[GCC] Supabase env vars missing or key is not JWT format.\n' +
        'Auth/cloud-sync features disabled. Set VITE_SUPABASE_URL and\n' +
        'VITE_SUPABASE_ANON_KEY (eyJ... format) in Netlify env vars.'
    );
}

// Real client, or a safe stub that satisfies every call site.
export const supabase = isConfigured
    ? createClient(SUPABASE_URL, SUPABASE_ANON)
    : {
        auth: {
            getUser:           () => Promise.resolve({ data: { user: null }, error: null }),
            signInWithOtp:     () => Promise.resolve({ error: { message: 'Auth not configured' } }),
            signOut:           () => Promise.resolve({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({
            select:  () => ({ eq: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }),
            upsert:  () => Promise.resolve({ error: null }),
        }),
    };

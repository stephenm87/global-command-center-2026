// ── Supabase Client — Global Command Center ────────────────────────
// Shared singleton. Import { supabase } from anywhere in the app.
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY;

const PLACEHOLDER_PATTERNS = /your[_-]|example|placeholder|changeme|<|>/i;

export function isValidSupabaseUrl(url) {
    if (typeof url !== 'string' || !url.trim() || PLACEHOLDER_PATTERNS.test(url)) return false;
    try {
        const parsed = new URL(url.trim());
        return parsed.protocol === 'https:' || parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
    } catch {
        return false;
    }
}

// Supabase supports modern sb_publishable_* keys and legacy JWT anon keys.
// Reject short or placeholder values (e.g. copied verbatim from .env.example)
// and fall back to a no-op stub so the app renders cleanly without auth features.
export function isValidClientKey(key) {
    if (typeof key !== 'string') return false;
    const trimmed = key.trim();
    if (trimmed.length < 28 || PLACEHOLDER_PATTERNS.test(trimmed)) return false;
    return trimmed.startsWith('sb_publishable_') || trimmed.startsWith('eyJ');
}

const isConfigured = !!SUPABASE_URL && isValidSupabaseUrl(SUPABASE_URL) && isValidClientKey(SUPABASE_KEY);

if (!isConfigured) {
    console.warn(
        '[GCC] Supabase client env vars are missing or invalid.\n' +
        'Auth/cloud-sync features disabled. Set VITE_SUPABASE_URL and\n' +
        'VITE_SUPABASE_PUBLISHABLE_KEY in Netlify env vars.'
    );
}

const emptySingleResult = () => Promise.resolve({ data: null, error: null });

export function createDebouncedRunner(delayMs = 400) {
    let timerId = null;
    return {
        schedule(task) {
            if (timerId !== null) clearTimeout(timerId);
            timerId = setTimeout(() => {
                timerId = null;
                task();
            }, delayMs);
        },
        cancel() {
            if (timerId !== null) {
                clearTimeout(timerId);
                timerId = null;
            }
        },
    };
}

// Real client, or a safe stub that satisfies every call site.
export const supabase = isConfigured
    ? createClient(SUPABASE_URL, SUPABASE_KEY)
    : {
        auth: {
            getUser:           () => Promise.resolve({ data: { user: null }, error: null }),
            getSession:        () => Promise.resolve({ data: { session: null }, error: null }),
            signInWithOtp:     () => Promise.resolve({ error: { message: 'Auth not configured' } }),
            signOut:           () => Promise.resolve({ error: null }),
            onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
        },
        from: () => ({
            select: () => ({
                eq: () => ({
                    eq: () => ({
                        single: emptySingleResult,
                        maybeSingle: emptySingleResult,
                    }),
                }),
            }),
            upsert: () => Promise.resolve({ error: null }),
        }),
    };

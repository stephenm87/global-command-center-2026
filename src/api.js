import { supabase } from './supabase';

export async function secureFetch(input, init = {}) {
    const { data, error } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;

    if (error || !accessToken) {
        throw new Error('Sign in to use live intelligence services.');
    }

    const headers = new Headers(init.headers || {});
    headers.set('Authorization', `Bearer ${accessToken}`);

    return fetch(input, { ...init, headers });
}

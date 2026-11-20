import { createRequire } from 'node:module';
import sourceHealthModule from './_shared/source-health.js';
import { readSnapshot, writeSnapshot } from './_shared/snapshot-store.mjs';

const require = createRequire(import.meta.url);
const manifest = require('./source-health-targets.json');
const { DEFAULT_DEADLINE_MS, checkTargets, summarizeHealth } = sourceHealthModule;
const SNAPSHOT_KEY = 'source-health/current.json';
const DISPATCH_TIMEOUT_MS = 4000;
const SUPABASE_KEEPALIVE_TIMEOUT_MS = 5000;
export const STALE_SNAPSHOT_THRESHOLD_MS = 36 * 60 * 60 * 1000;

export async function pingSupabaseKeepAlive({
    supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
    supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '',
    fetchImpl = fetch,
} = {}) {
    const trimmedUrl = String(supabaseUrl || '').trim().replace(/\/+$/, '');
    const trimmedKey = String(supabaseKey || '').trim();
    if (!/^https:\/\/[^/\s]+/i.test(trimmedUrl) || !trimmedKey || /your[-_]?(supabase|project)|placeholder/i.test(trimmedUrl + trimmedKey)) {
        return { ok: false, skipped: true, reason: 'not-configured' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SUPABASE_KEEPALIVE_TIMEOUT_MS);
    try {
        const response = await fetchImpl(`${trimmedUrl}/rest/v1/user_data?select=key&limit=1`, {
            method: 'GET',
            signal: controller.signal,
            headers: {
                apikey: trimmedKey,
                Accept: 'application/json',
            },
        });
        if (response?.body?.cancel) response.body.cancel().catch(() => {});
        if (response.ok) {
            console.log(`[refresh-source-health] Supabase daily keep-alive HTTP ${response.status}.`);
        } else {
            console.warn(`[refresh-source-health] Supabase daily keep-alive returned HTTP ${response.status}.`);
        }
        return { ok: response.ok, status: response.status };
    } catch (error) {
        console.warn(`[refresh-source-health] Supabase daily keep-alive skipped (${error?.name === 'AbortError' ? 'timeout' : 'network-error'}).`);
        return { ok: false, reason: error?.name === 'AbortError' ? 'timeout' : 'network-error' };
    } finally {
        clearTimeout(timer);
    }
}

export function isSnapshotMissingOrStale(snapshot, nowMs = Date.now()) {
    const parsed = snapshot?.checkedAt ? Date.parse(snapshot.checkedAt) : Number.NaN;
    if (!Number.isFinite(parsed)) return true;
    return (nowMs - parsed) > STALE_SNAPSHOT_THRESHOLD_MS;
}

export async function dispatchOrRunInline({
    siteUrl = process.env.URL || '',
    cronSecret = process.env.CRON_SECRET || '',
    fetchImpl = fetch,
    previousSnapshot = null,
    nowMs = Date.now(),
    runInline,
} = {}) {
    const trimmedUrl = siteUrl.trim().replace(/\/+$/, '');
    const trimmedSecret = cronSecret.trim();
    const staleBeforeDispatch = isSnapshotMissingOrStale(previousSnapshot, nowMs);

    if (/^https?:\/\//i.test(trimmedUrl) && trimmedSecret.length >= 16) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), DISPATCH_TIMEOUT_MS);
        try {
            const response = await fetchImpl(`${trimmedUrl}/.netlify/functions/refresh-source-health-background`, {
                method: 'POST',
                signal: controller.signal,
                headers: {
                    'x-cron-secret': trimmedSecret,
                },
            });
            if (response.status >= 200 && response.status < 300) {
                if (staleBeforeDispatch) {
                    // Netlify returns 202 before background user code runs; if the stored snapshot
                    // is missing or >36h old, seed/recover via the bounded inline check as well so a
                    // misconfigured secret or background crash never leaves link-health permanently stale.
                    console.warn('[refresh-source-health] Snapshot missing or >36h stale; running inline bounded safety refresh alongside background dispatch.');
                    const snapshot = await runInline(previousSnapshot);
                    return { mode: 'background-dispatched-with-stale-guard', status: response.status, snapshot };
                }
                console.log(`[refresh-source-health] Dispatched background worker (HTTP ${response.status}).`);
                return { mode: 'background-dispatched', status: response.status };
            }
            console.warn(`[refresh-source-health] Background dispatch returned HTTP ${response.status}; falling back to inline deadline-bounded run.`);
        } catch (error) {
            console.warn(`[refresh-source-health] Background dispatch failed (${error?.message || 'error'}); falling back to inline deadline-bounded run.`);
        } finally {
            clearTimeout(timer);
        }
    }

    const snapshot = await runInline(previousSnapshot);
    return { mode: 'inline-bounded', status: 204, snapshot };
}

async function runInlineBoundedRefresh(preloadedPrevious = undefined, context = null) {
    const checkedAt = new Date().toISOString();
    const previous = preloadedPrevious !== undefined
        ? preloadedPrevious
        : await readSnapshot(SNAPSHOT_KEY, { context }).catch(() => null);
    const previousByUrl = new Map(
        Array.isArray(previous?.results)
            ? previous.results.filter(r => r?.url && r.status !== 'unknown').map(r => [r.url, r])
            : []
    );

    const activeTargets = manifest.targets.filter(target => target.lifecycle !== 'archived');
    const rawResults = await checkTargets(activeTargets, { deadlineMs: DEFAULT_DEADLINE_MS });
    const results = rawResults.map(result => {
        if (result.reason === 'deadline-exceeded' && previousByUrl.has(result.url)) {
            const carried = previousByUrl.get(result.url);
            return { ...carried, id: result.id, url: result.url, carriedForward: true };
        }
        return result;
    });
    const incompleteCount = rawResults.filter(r => r.reason === 'deadline-exceeded').length;

    const snapshot = {
        schemaVersion: 1,
        checkedAt,
        workerMode: 'inline-24s',
        targetCount: results.length,
        incompleteCount,
        summary: summarizeHealth(results),
        results,
    };
    await writeSnapshot(SNAPSHOT_KEY, snapshot, { context });
    console.log(`[refresh-source-health] Checked ${results.length} active links (${incompleteCount} deadline-deferred): ${JSON.stringify(snapshot.summary)}.`);
    return snapshot;
}

export default async (_request, context) => {
    const previousSnapshot = await readSnapshot(SNAPSHOT_KEY, { context }).catch(() => null);
    const targetSiteUrl = context?.deploy?.published === false
        ? (process.env.DEPLOY_URL || '')
        : (process.env.URL || process.env.DEPLOY_URL || '');
    await Promise.all([
        dispatchOrRunInline({
            siteUrl: targetSiteUrl,
            previousSnapshot,
            runInline: prev => runInlineBoundedRefresh(prev, context),
        }),
        pingSupabaseKeepAlive(),
    ]);
    return new Response(null, { status: 204 });
};

export const _test = { SNAPSHOT_KEY };

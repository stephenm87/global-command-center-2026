const CHECK_TIMEOUT_MS = 5000;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_MAX_PER_HOST = 2;
const DEFAULT_DEADLINE_MS = 24000;
const RESTRICTED_STATUSES = new Set([401, 403, 429, 451]);
const BROKEN_STATUSES = new Set([404, 410]);

function classifyStatus(status) {
    if (status >= 200 && status < 400) return 'healthy';
    if (RESTRICTED_STATUSES.has(status)) return 'restricted';
    if (BROKEN_STATUSES.has(status)) return 'broken';
    return 'unknown';
}

function getHostname(rawUrl) {
    try {
        return new URL(rawUrl).hostname.toLowerCase();
    } catch {
        return 'unknown';
    }
}

async function requestUrl(fetchImpl, url, method, timeoutMs = CHECK_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchImpl(url, {
            method,
            redirect: 'follow',
            signal: controller.signal,
            headers: {
                'User-Agent': 'GlobalCommandCenter-LinkHealth/1.0 (+https://globalcommandcenter2026.netlify.app)',
                ...(method === 'GET' ? { Range: 'bytes=0-0' } : {}),
            },
        });
    } finally {
        clearTimeout(timeout);
    }
}

async function checkTarget(target, fetchImpl = fetch, { timeoutMs = CHECK_TIMEOUT_MS } = {}) {
    const checkedAt = new Date().toISOString();
    try {
        let response = await requestUrl(fetchImpl, target.url, 'HEAD', timeoutMs);
        if ([405, 501].includes(response.status)) {
            response = await requestUrl(fetchImpl, target.url, 'GET', timeoutMs);
        }
        return {
            id: target.id,
            url: target.url,
            status: classifyStatus(response.status),
            httpStatus: response.status,
            checkedAt,
        };
    } catch (error) {
        const isTimeout = error?.name === 'AbortError' || error?.name === 'TimeoutError';
        return {
            id: target.id,
            url: target.url,
            status: 'unknown',
            httpStatus: null,
            checkedAt,
            reason: isTimeout ? 'timeout' : 'network-error',
        };
    }
}

function interleaveByHost(indexedTargets) {
    const byHost = new Map();
    for (const item of indexedTargets) {
        const host = getHostname(item.target.url);
        if (!byHost.has(host)) byHost.set(host, []);
        byHost.get(host).push(item);
    }
    const queues = [...byHost.values()];
    const ordered = [];
    let added = true;
    while (added) {
        added = false;
        for (const q of queues) {
            if (q.length > 0) {
                ordered.push(q.shift());
                added = true;
            }
        }
    }
    return ordered;
}

async function checkTargets(
    targets,
    {
        fetchImpl = fetch,
        concurrency = DEFAULT_CONCURRENCY,
        maxPerHost = DEFAULT_MAX_PER_HOST,
        timeoutMs = CHECK_TIMEOUT_MS,
        deadlineMs = null,
    } = {}
) {
    if (!Array.isArray(targets) || targets.length === 0) return [];

    // Deduplicate identical URLs so shared treaty/docket portals are probed once per run
    const urlGroups = new Map();
    targets.forEach((target, index) => {
        const key = String(target?.url || '');
        if (!urlGroups.has(key)) {
            urlGroups.set(key, { representative: target, indices: [] });
        }
        urlGroups.get(key).indices.push(index);
    });

    const uniqueItems = [...urlGroups.values()].map((group, uniqueIndex) => ({
        target: group.representative,
        host: getHostname(group.representative?.url),
        indices: group.indices,
        index: uniqueIndex,
    }));
    const pending = interleaveByHost(uniqueItems);
    const results = new Array(targets.length);
    const deadlineAt = Number.isFinite(deadlineMs) && deadlineMs > 0 ? Date.now() + deadlineMs : Infinity;
    const activePerHost = new Map();
    const hostWaiters = [];

    const releaseHost = host => {
        const nextCount = Math.max(0, (activePerHost.get(host) || 1) - 1);
        if (nextCount === 0) activePerHost.delete(host);
        else activePerHost.set(host, nextCount);
        while (hostWaiters.length > 0) {
            hostWaiters.shift()();
        }
    };

    const claimNextEligible = async () => {
        while (pending.length > 0) {
            const eligibleIdx = pending.findIndex(item => (activePerHost.get(item.host) || 0) < maxPerHost);
            if (eligibleIdx >= 0) {
                const [item] = pending.splice(eligibleIdx, 1);
                activePerHost.set(item.host, (activePerHost.get(item.host) || 0) + 1);
                return item;
            }
            if (Date.now() >= deadlineAt - 50) {
                const item = pending.shift();
                activePerHost.set(item.host, (activePerHost.get(item.host) || 0) + 1);
                return item;
            }
            await new Promise(resolve => hostWaiters.push(resolve));
        }
        return null;
    };

    const worker = async () => {
        while (true) {
            const item = await claimNextEligible();
            if (!item) return;
            try {
                const remainingMs = deadlineAt - Date.now();
                let outcome;
                if (remainingMs <= 50) {
                    outcome = {
                        id: item.target.id,
                        url: item.target.url,
                        status: 'unknown',
                        httpStatus: null,
                        checkedAt: new Date().toISOString(),
                        reason: 'deadline-exceeded',
                    };
                } else {
                    const effectiveTimeout = Number.isFinite(remainingMs)
                        ? Math.max(50, Math.min(timeoutMs, remainingMs))
                        : timeoutMs;
                    outcome = await checkTarget(item.target, fetchImpl, { timeoutMs: effectiveTimeout });
                }
                for (const origIdx of item.indices) {
                    results[origIdx] = {
                        ...outcome,
                        id: targets[origIdx].id,
                        url: targets[origIdx].url,
                    };
                }
            } finally {
                releaseHost(item.host);
            }
        }
    };

    await Promise.all(Array.from({ length: Math.min(concurrency, pending.length) }, worker));
    return results;
}

function summarizeHealth(results) {
    return results.reduce((summary, result) => {
        summary[result.status] = (summary[result.status] || 0) + 1;
        return summary;
    }, { healthy: 0, restricted: 0, broken: 0, unknown: 0 });
}

module.exports = {
    CHECK_TIMEOUT_MS,
    DEFAULT_CONCURRENCY,
    DEFAULT_MAX_PER_HOST,
    DEFAULT_DEADLINE_MS,
    checkTarget,
    checkTargets,
    classifyStatus,
    summarizeHealth,
};

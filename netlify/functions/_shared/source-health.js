const CHECK_TIMEOUT_MS = 3000;
const RESTRICTED_STATUSES = new Set([401, 403, 429, 451]);
const BROKEN_STATUSES = new Set([404, 410]);

function classifyStatus(status) {
    if (status >= 200 && status < 400) return 'healthy';
    if (RESTRICTED_STATUSES.has(status)) return 'restricted';
    if (BROKEN_STATUSES.has(status)) return 'broken';
    return 'unknown';
}

async function requestUrl(fetchImpl, url, method) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
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

async function checkTarget(target, fetchImpl = fetch) {
    const checkedAt = new Date().toISOString();
    try {
        let response = await requestUrl(fetchImpl, target.url, 'HEAD');
        if ([405, 501].includes(response.status)) response = await requestUrl(fetchImpl, target.url, 'GET');
        return {
            id: target.id,
            url: target.url,
            status: classifyStatus(response.status),
            httpStatus: response.status,
            checkedAt,
        };
    } catch (error) {
        return {
            id: target.id,
            url: target.url,
            status: 'unknown',
            httpStatus: null,
            checkedAt,
            reason: error?.name === 'AbortError' ? 'timeout' : 'network-error',
        };
    }
}

async function checkTargets(targets, { fetchImpl = fetch, concurrency = 24 } = {}) {
    const results = new Array(targets.length);
    let nextIndex = 0;
    const worker = async () => {
        while (nextIndex < targets.length) {
            const index = nextIndex++;
            results[index] = await checkTarget(targets[index], fetchImpl);
        }
    };
    await Promise.all(Array.from({ length: Math.min(concurrency, targets.length) }, worker));
    return results;
}

function summarizeHealth(results) {
    return results.reduce((summary, result) => {
        summary[result.status] = (summary[result.status] || 0) + 1;
        return summary;
    }, { healthy: 0, restricted: 0, broken: 0, unknown: 0 });
}

module.exports = { CHECK_TIMEOUT_MS, checkTarget, checkTargets, classifyStatus, summarizeHealth };

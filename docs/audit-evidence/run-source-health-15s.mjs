import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Original script executed at 2026-11-15T15:52:04+08:00 (07:52:04Z) to produce
// docs/audit-evidence/source-health-15s-2026-11-15.json (paths made repo-relative).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const manifest = require(path.join(repoRoot, 'netlify/functions/source-health-targets.json'));
const { classifyStatus, summarizeHealth } = require(path.join(repoRoot, 'netlify/functions/_shared/source-health.js'));

// Uses classifyStatus & summarizeHealth from source-health.js with 15s timeout & concurrency 8,
// and additionally retries GET (Range: bytes=0-0) on HEAD 403 as well as 405/501 (catching GET
// errors) whereas production source-health.js:33 retries GET only on 405 and 501.
const TIMEOUT_MS = 15000;

async function requestUrl(url, method) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        return await fetch(url, {
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

async function checkOne(target) {
    const start = Date.now();
    try {
        let response = await requestUrl(target.url, 'HEAD');
        if ([403, 405, 501].includes(response.status)) {
            const getRes = await requestUrl(target.url, 'GET').catch(() => null);
            if (getRes) response = getRes;
        }
        return {
            ...target,
            status: classifyStatus(response.status),
            httpStatus: response.status,
            finalUrl: response.url,
            elapsedMs: Date.now() - start,
        };
    } catch (error) {
        return {
            ...target,
            status: 'unknown',
            httpStatus: null,
            reason: error?.name === 'AbortError' ? 'timeout-15s' : (error?.cause?.code || error?.message || 'network-error'),
            elapsedMs: Date.now() - start,
        };
    }
}

const results = new Array(manifest.targets.length);
let nextIndex = 0;
await Promise.all(Array.from({ length: 8 }, async () => {
    while (nextIndex < manifest.targets.length) {
        const i = nextIndex++;
        results[i] = await checkOne(manifest.targets[i]);
    }
}));

const summary = summarizeHealth(results);
const coreResults = results.filter(r => r.group === 'core' && r.kind === 'primary');
const coreSummary = summarizeHealth(coreResults);

const outPath = process.argv[2]
    ? path.resolve(repoRoot, process.argv[2])
    : path.join(__dirname, 'source-health-15s-2026-11-15.json');
await writeFile(outPath, JSON.stringify({ checkedAt: new Date().toISOString(), summary, coreSummary, results }, null, 2));
console.log('ALL TARGETS (106):', JSON.stringify(summary));
console.log('CORE PRIMARY (87):', JSON.stringify(coreSummary));
for (const r of results) {
    if (r.status !== 'healthy') {
        console.log(`[${r.status.toUpperCase()}] ${r.id} (${r.httpStatus ?? r.reason}, ${r.elapsedMs}ms) -> ${r.url}`);
    }
}

/**
 * Controlled 3,000 ms @ concurrency = 4 reachability benchmark runner
 * Produces docs/audit-evidence/source-health-3s-concurrency4-2026-11-16.json
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../..');
const manifest = require(path.join(REPO_ROOT, 'netlify/functions/source-health-targets.json'));
const { checkTargets, summarizeHealth } = require(path.join(REPO_ROOT, 'netlify/functions/_shared/source-health.js'));

const startedAt = Date.now();
const results = await checkTargets(manifest.targets, {
    timeoutMs: 3000,
    concurrency: 4,
    maxPerHost: 2,
    deadlineMs: null,
});
const elapsedMs = Date.now() - startedAt;
const summary = summarizeHealth(results);
const reasons = results.reduce((acc, r) => {
    const k = r.reason || `http-${r.httpStatus}`;
    acc[k] = (acc[k] || 0) + 1;
    return acc;
}, {});

const payload = {
    benchmark: 'controlled-3000ms-concurrency-4',
    ranAt: new Date().toISOString(),
    timeoutMs: 3000,
    concurrency: 4,
    targetCount: manifest.targetCount,
    elapsedMs,
    summary,
    breakdownByReasonOrStatus: reasons,
    results,
};

const outPath = path.join(__dirname, 'source-health-3s-concurrency4-2026-11-16.json');
await fs.writeFile(outPath, `${JSON.stringify(payload, null, 2)}\n`);
console.log(JSON.stringify({ elapsedMs, targetCount: manifest.targetCount, summary, reasons }, null, 2));

import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Original script executed at 2026-11-15T15:48:08+08:00 (07:48:08Z) to produce
// docs/audit-evidence/source-health-live-2026-11-15.json (paths made repo-relative).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const require = createRequire(import.meta.url);
const manifest = require(path.join(repoRoot, 'netlify/functions/source-health-targets.json'));
const { checkTargets, summarizeHealth } = require(path.join(repoRoot, 'netlify/functions/_shared/source-health.js'));

const checkedAt = new Date().toISOString();
const results = await checkTargets(manifest.targets, { concurrency: 16 });
const summary = summarizeHealth(results);

const enriched = results.map((res, idx) => ({
    ...manifest.targets[idx],
    ...res,
}));

const outPath = process.argv[2]
    ? path.resolve(repoRoot, process.argv[2])
    : path.join(__dirname, 'source-health-live-2026-11-15.json');
await writeFile(outPath, JSON.stringify({ checkedAt, targetCount: results.length, summary, results: enriched }, null, 2));
console.log(JSON.stringify({ checkedAt, targetCount: results.length, summary }, null, 2));
for (const r of enriched) {
    if (r.status !== 'healthy') {
        console.log(`[${r.status.toUpperCase()}] ${r.id} (HTTP ${r.httpStatus ?? r.reason}) -> ${r.url}`);
    }
}

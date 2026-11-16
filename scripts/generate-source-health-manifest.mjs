import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ALL_CASE_STUDIES_2026 } from '../src/cases/index.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const outputPath = join(projectRoot, 'netlify/functions/source-health-targets.json');

export function buildManifest(caseStudies) {
    const targets = [];
    for (const caseStudy of caseStudies) {
        const lifecycle = caseStudy.status === 'archived' ? 'archived' : 'active';
        const groups = [
            ['core', caseStudy.sources || []],
            ['supplemental', caseStudy.supplementalSources || []],
        ];
        for (const [group, sources] of groups) {
            sources.forEach((source, sourceIndex) => {
                if (!source.url) return;
                targets.push({
                    id: `${caseStudy.id}:${group}:${sourceIndex}`,
                    caseStudyId: caseStudy.id,
                    caseStudyTitle: caseStudy.title,
                    sourceTitle: source.title,
                    publisher: source.publisher,
                    group,
                    kind: 'primary',
                    lifecycle,
                    url: source.url,
                });
                (source.alternateUrls || []).forEach((alternate, alternateIndex) => {
                    if (!alternate.url) return;
                    targets.push({
                        id: `${caseStudy.id}:${group}:${sourceIndex}:alternate:${alternateIndex}`,
                        caseStudyId: caseStudy.id,
                        caseStudyTitle: caseStudy.title,
                        sourceTitle: source.title,
                        publisher: source.publisher,
                        group,
                        kind: 'alternate',
                        lifecycle,
                        primaryUrl: source.url,
                        label: alternate.label,
                        url: alternate.url,
                    });
                });
            });
        }
    }
    return { schemaVersion: 1, caseStudyCount: caseStudies.length, targetCount: targets.length, targets };
}

const manifest = buildManifest(ALL_CASE_STUDIES_2026);
const serialized = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--check')) {
    const current = await readFile(outputPath, 'utf8').catch(() => '');
    if (current !== serialized) {
        console.error('Source-health manifest is stale. Run npm run sources:manifest.');
        process.exitCode = 1;
    }
} else {
    await writeFile(outputPath, serialized);
    console.log(`Wrote ${manifest.targetCount} source-health targets across ${manifest.caseStudyCount} cases.`);
}

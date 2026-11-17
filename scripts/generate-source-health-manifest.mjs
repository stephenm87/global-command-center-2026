import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { ALL_CASE_STUDIES_2026 } from '../src/cases/index.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const outputPath = join(projectRoot, 'netlify/functions/source-health-targets.json');
const contextCardsPath = join(projectRoot, 'public/context-cards/index.html');

export function extractContextCardTargets(html) {
    const targets = [];
    const anchorPattern = /<a\s+[^>]*href="(https?:\/\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    let index = 0;
    while ((match = anchorPattern.exec(html)) !== null) {
        const url = match[1].trim();
        const label = match[2].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        let publisher = label;
        try {
            publisher = new URL(url).hostname.replace(/^www\./, '');
        } catch {
            // keep label fallback
        }
        targets.push({
            id: `context-cards:citation:${index}`,
            caseStudyId: 'context-cards',
            caseStudyTitle: 'Context Cards: Field Agents — Republican China',
            sourceTitle: label || `Context Card Citation ${index + 1}`,
            publisher,
            group: 'static-page',
            kind: 'primary',
            lifecycle: 'active',
            pagePath: '/context-cards/',
            url,
        });
        index += 1;
    }
    return targets;
}

export function buildManifest(caseStudies, staticPageTargets = []) {
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
    targets.push(...staticPageTargets);
    return {
        schemaVersion: 1,
        caseStudyCount: caseStudies.length,
        staticPageCount: staticPageTargets.length > 0 ? 1 : 0,
        targetCount: targets.length,
        targets,
    };
}

const contextCardsHtml = await readFile(contextCardsPath, 'utf8');
const contextCardTargets = extractContextCardTargets(contextCardsHtml);
if (contextCardTargets.length === 0) {
    throw new Error('Expected outbound citation links in public/context-cards/index.html.');
}
const manifest = buildManifest(ALL_CASE_STUDIES_2026, contextCardTargets);
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

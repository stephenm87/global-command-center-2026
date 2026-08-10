import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceDir = join(projectRoot, 'src');
const outputPath = join(projectRoot, 'netlify/functions/source-health-targets.json');
const sourceFiles = [
    'caseStudies2026.js',
    'caseStudiesAfricaMena2026.js',
    'caseStudiesAmericasGlobal2026.js',
    'caseStudiesAsiaPacific2026.js',
];

async function loadCaseStudies() {
    const temporaryDir = await mkdtemp(join(tmpdir(), 'gcc-source-manifest-'));
    try {
        for (const file of sourceFiles) {
            const input = await readFile(join(sourceDir, file), 'utf8');
            const esm = input.replace(
                /from '(\.\/caseStudies[^']+)'/g,
                (_, specifier) => `from '${specifier}.mjs'`
            );
            await writeFile(join(temporaryDir, basename(file, '.js') + '.mjs'), esm);
        }
        const module = await import(`${pathToFileURL(join(temporaryDir, 'caseStudies2026.mjs')).href}?v=${Date.now()}`);
        return module.CASE_STUDIES_2026;
    } finally {
        await rm(temporaryDir, { recursive: true, force: true });
    }
}

export function buildManifest(caseStudies) {
    const targets = [];
    for (const caseStudy of caseStudies) {
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

const manifest = buildManifest(await loadCaseStudies());
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

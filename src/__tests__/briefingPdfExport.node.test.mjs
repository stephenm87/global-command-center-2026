import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REPO_ROOT } from './_helpers/readAppSources.mjs';

async function createTestViteServer(t) {
    const vite = await createServer({
        configFile: false,
        root: REPO_ROOT,
        cacheDir: `/tmp/vite-gcc-pdf-test-${process.pid}`,
        appType: 'custom',
        logLevel: 'silent',
        esbuild: { jsx: 'automatic' },
        optimizeDeps: { noDiscovery: true },
        plugins: [
            {
                name: 'ignore-css-in-node-ssr',
                load(id) {
                    if (id.endsWith('.css')) return 'export default {};';
                    return null;
                },
            },
        ],
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());
    return vite;
}

function walkSourceFiles(dir) {
    const files = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === '__tests__') continue;
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            files.push(...walkSourceFiles(full));
        } else if (/\.(js|jsx|mjs|ts|tsx)$/.test(entry.name)) {
            files.push(full);
        }
    }
    return files;
}

function decodeHtmlEntities(str) {
    return str
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
}

function extractHrefs(html) {
    return Array.from(html.matchAll(/href="([^"]+)"/g), m => decodeHtmlEntities(m[1]));
}

test('CaseBriefingPrintContent renders every step and all ten ordered sections on v2 briefings', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');

    for (const id of [
        'myanmar-fragmented-sovereignty',
        'somaliland-recognition-red-sea-order',
        'greenland-autonomy-security-minerals',
    ]) {
        const tour = GUIDED_TOURS.find(item => item.id === id);
        assert.ok(tour, `Expected tour ${id}`);
        const markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
            tour,
            exportedAt: '22 November 2026',
            pageUrl: `https://globalcommandcenter2026.netlify.app/?view=briefings&tour=${id}`,
        }));

        const sectionOrder = [
            '>At a glance</h2>',
            '>Where</h2>',
            '>The briefing</h2>',
            '>Background, timeline and key figures</h2>',
            '>Concepts and themes</h2>',
            '>Debate and what to watch</h2>',
            '>Exam practice</h2>',
            '>Sources</h2>',
            'This briefing is an educational summary',
        ];
        let lastPos = -1;
        for (const marker of sectionOrder) {
            const pos = markup.indexOf(marker);
            assert.ok(pos > lastPos, `${id}: expected "${marker}" after index ${lastPos}, got ${pos}`);
            lastPos = pos;
        }

        assert.match(markup, /Editorial caution:/, `${id} should render editorialCaution`);
        assert.match(markup, /class="gcc-print-section gcc-print-exam"/, `${id} should isolate Exam practice on a new page`);
        assert.doesNotMatch(markup, /NASA Earth Observatory/, `${id} should omit NASA credit unless usesNasaImagery is set`);

        tour.waypoints.forEach((wp, index) => {
            assert.ok(
                markup.includes(`Step ${index + 1} of ${tour.waypoints.length}`),
                `${id} missing Step ${index + 1}`,
            );
            assert.ok(markup.includes(wp.title.split('&')[0]), `${id} missing step heading ${wp.title}`);
        });

        tour.map.locations.forEach(loc => {
            assert.ok(markup.includes(loc.label), `${id} missing location ${loc.label}`);
        });

        assert.doesNotMatch(markup, /<h[1-6][^>]*>\s*<\/h[1-6]>/i, `${id} must never emit empty headings`);
    }

    const myanmar = GUIDED_TOURS.find(item => item.id === 'myanmar-fragmented-sovereignty');
    const nasaMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: { ...myanmar, usesNasaImagery: true },
        exportedAt: '22 November 2026',
    }));
    assert.match(nasaMarkup, /NASA Earth Observatory/);
});

test('CaseBriefingPrintContent omits sections a case lacks and emits zero empty headings', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');

    const mongolia = GUIDED_TOURS.find(item => item.id === 'mongolia-coal-critical-minerals-transition');
    assert.ok(mongolia, 'Expected Mongolia v1 tour');
    const v1Markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: mongolia,
        exportedAt: '22 November 2026',
    }));

    assert.match(v1Markup, /At a glance/);
    assert.match(v1Markup, /Where/);
    assert.match(v1Markup, /The briefing/);
    assert.match(v1Markup, /Sources/);
    mongolia.waypoints.forEach((_, idx) => {
        assert.match(v1Markup, new RegExp(`Step ${idx + 1} of ${mongolia.waypoints.length}`));
    });
    for (const absent of [
        'Background, timeline and key figures',
        'Influence check',
        'The debate',
        'What to watch',
        'Exam practice',
        'gcc-print-exam',
    ]) {
        assert.equal(v1Markup.includes(absent), false, `v1 briefing must omit "${absent}"`);
    }

    const minimalMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: {
            id: 'minimal-test',
            title: 'Minimal Test Briefing',
            subtitle: 'Test case with only core fields',
            waypoints: [{ nodeId: 'UN', title: 'Step One', narration: 'Single test paragraph.' }],
            sources: [],
        },
        exportedAt: '22 November 2026',
    }));
    assert.doesNotMatch(minimalMarkup, /At a glance/);
    assert.doesNotMatch(minimalMarkup, /Where/);
    assert.doesNotMatch(minimalMarkup, /Concepts and themes/);
    assert.doesNotMatch(minimalMarkup, /Sources/);
    assert.doesNotMatch(minimalMarkup, /<h[1-6][^>]*>\s*<\/h[1-6]>/i);
});

test('All printed source URLs pass safeHttpUrl and ListBriefingPrintContent preserves 40-item limit', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent, ListBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');
    const { safeHttpUrl } = await vite.ssrLoadModule('/src/navigationState.mjs');
    const { buildCasePrintTitle } = await vite.ssrLoadModule('/src/utils/briefingPrint.mjs');

    assert.equal(
        buildCasePrintTitle('Myanmar: Fragmented Sovereignty'),
        'Myanmar: Fragmented Sovereignty - Global Command Center briefing',
    );

    for (const tour of GUIDED_TOURS) {
        const markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, { tour }));
        const hrefs = extractHrefs(markup);
        assert.ok(hrefs.length > 0, `${tour.id} should contain source links`);
        for (const href of hrefs) {
            assert.equal(safeHttpUrl(href), href, `Printed URL failed safeHttpUrl on ${tour.id}: ${href}`);
        }
    }

    const sampleTour = GUIDED_TOURS[0];
    const taintedMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: {
            ...sampleTour,
            sources: [
                {
                    title: 'Safe Source',
                    publisher: 'UN',
                    dateLabel: '2026',
                    url: 'https://www.un.org/en',
                },
                {
                    title: 'Injected Script Source',
                    publisher: 'Bad',
                    dateLabel: '2026',
                    url: 'javascript:alert(1)',
                },
                {
                    title: 'Injected Data Source',
                    publisher: 'Bad2',
                    dateLabel: '2026',
                    url: 'data:text/html,<script>alert(1)</script>',
                },
            ],
            supplementalSources: [],
        },
    }));
    assert.doesNotMatch(taintedMarkup, /javascript:/i);
    assert.doesNotMatch(taintedMarkup, /data:text\/html/i);

    const manyForecasts = Array.from({ length: 55 }, (_, i) => ({
        Broad_Category: 'Geopolitics & Conflict',
        'Entity/Subject': `Forecast Item ${i + 1}`,
        'Key Player/Organization': 'Actor A',
        'Expected Impact/Value': 'Moderate',
        Timeline: 'Q4 2026',
        Source: 'Source A',
        url: i === 2 ? 'javascript:alert(99)' : `https://example.org/item-${i + 1}`,
    }));
    const listMarkup = renderToStaticMarkup(React.createElement(ListBriefingPrintContent, {
        mode: 'forecasts',
        title: 'Global Intelligence Briefing',
        items: manyForecasts,
        totalCount: 55,
        exportedAt: '22 November 2026',
    }));
    assert.match(listMarkup, /Forecast Item 1\b/);
    assert.match(listMarkup, /Forecast Item 40\b/);
    assert.doesNotMatch(listMarkup, /Forecast Item 41\b/);
    assert.doesNotMatch(listMarkup, /javascript:/i);

    const newsMarkup = renderToStaticMarkup(React.createElement(ListBriefingPrintContent, {
        mode: 'news',
        title: 'Live News Intel Briefing',
        items: manyForecasts.slice(0, 5),
        query: 'Red Sea maritime',
        exportedAt: '22 November 2026',
    }));
    assert.match(newsMarkup, /Live News Intel Briefing/);
    assert.match(newsMarkup, /Red Sea maritime/);
    assert.match(newsMarkup, /Forecast Item 5\b/);
});

test('src contains zero document.write calls and briefingPrint.css isolates screen rules', async () => {
    const srcFiles = walkSourceFiles(path.join(REPO_ROOT, 'src'));
    assert.ok(srcFiles.length > 10);
    for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        assert.equal(
            /\bdocument\.write\b/.test(content),
            false,
            `Forbidden document.write found in ${path.relative(REPO_ROOT, file)}`,
        );
    }

    const css = fs.readFileSync(path.join(REPO_ROOT, 'src/briefingPrint.css'), 'utf8');
    const mediaIndex = css.indexOf('@media print');
    assert.ok(mediaIndex >= 0, 'briefingPrint.css must contain @media print');
    const outsideMedia = css
        .slice(0, mediaIndex)
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .trim();
    assert.match(outsideMedia, /^\.gcc-print-root\s*\{\s*display:\s*none;\s*\}$/);
    const afterLastBrace = css.lastIndexOf('}');
    assert.equal(css.slice(afterLastBrace + 1).trim(), '');
});

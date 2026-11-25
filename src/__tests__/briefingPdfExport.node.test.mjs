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
        .replace(/&#x27;/gi, "'")
        .replace(/&#39;/g, "'");
}

function extractHrefs(html) {
    return Array.from(html.matchAll(/href="([^"]+)"/g), m => decodeHtmlEntities(m[1]));
}

function extractSourceUrlTexts(html) {
    return Array.from(
        html.matchAll(/class="gcc-print-source-url"[^>]*>([^<]+)</g),
        m => decodeHtmlEntities(m[1].trim()),
    );
}

function topLevelCssPreambles(cssText) {
    const preambles = [];
    let depth = 0;
    let currentPreamble = '';
    let i = 0;
    let quote = null;
    while (i < cssText.length) {
        const ch = cssText[i];
        const next = cssText[i + 1];
        if (!quote && ch === '/' && next === '*') {
            const end = cssText.indexOf('*/', i + 2);
            i = end === -1 ? cssText.length : end + 2;
            continue;
        }
        if (quote) {
            if (ch === '\\') {
                i += 2;
                continue;
            }
            if (ch === quote) quote = null;
            i += 1;
            continue;
        }
        if (ch === '"' || ch === "'") {
            quote = ch;
            i += 1;
            continue;
        }
        if (ch === '{') {
            if (depth === 0) {
                const clean = currentPreamble.trim();
                if (clean) preambles.push(clean);
                currentPreamble = '';
            }
            depth += 1;
        } else if (ch === '}') {
            depth = Math.max(0, depth - 1);
            if (depth === 0) currentPreamble = '';
        } else if (depth === 0) {
            currentPreamble += ch;
        }
        i += 1;
    }
    const leftover = currentPreamble.trim();
    if (leftover) preambles.push(leftover);
    return preambles;
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

        assert.match(
            markup,
            /(?:Editorial caution:|Uncertainty and editorial caution:)/,
            `${id} should render editorialCaution`,
        );
        assert.match(markup, /class="gcc-print-section gcc-print-exam"/, `${id} should isolate Exam practice on a new page`);
        assert.doesNotMatch(markup, /NASA Earth Observatory/, `${id} should omit NASA credit unless usesNasaImagery is set`);

        const decodedMarkup = decodeHtmlEntities(markup);
        tour.waypoints.forEach((wp, index) => {
            assert.ok(
                decodedMarkup.includes(`Step ${index + 1} of ${tour.waypoints.length}`),
                `${id} missing Step ${index + 1}`,
            );
            assert.ok(decodedMarkup.includes(wp.title), `${id} missing full step title ${wp.title}`);
        });

        tour.map.locations.forEach(loc => {
            assert.ok(decodedMarkup.includes(loc.label), `${id} missing location ${loc.label}`);
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

test('CaseBriefingPrintContent omits sections a case lacks, aligns source numbers with screen citations, and avoids empty headings', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');

    const mongolia = GUIDED_TOURS.find(item => item.id === 'mongolia-coal-critical-minerals-transition');
    assert.ok(mongolia, 'Expected Mongolia v1 tour');
    const v1Markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: mongolia,
        exportedAt: '22 November 2026',
    }));

    assert.match(v1Markup, />At a glance<\/h2>/);
    assert.match(v1Markup, />Where<\/h2>/);
    assert.match(v1Markup, />The briefing<\/h2>/);
    assert.match(v1Markup, />Sources<\/h2>/);
    mongolia.waypoints.forEach((_, idx) => {
        assert.match(v1Markup, new RegExp(`Step ${idx + 1} of ${mongolia.waypoints.length}`));
    });
    for (const absent of [
        '>Background, timeline and key figures</h2>',
        '>Influence check</h3>',
        '>The debate</h3>',
        '>What to watch</h3>',
        '>Exam practice</h2>',
        'gcc-print-exam',
    ]) {
        assert.equal(v1Markup.includes(absent), false, `v1 briefing must omit "${absent}"`);
    }

    // URL-less source entry must not shift screen [1] numbering in timeline/narration references
    const parityMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: {
            id: 'parity-test',
            title: 'Parity Test',
            subtitle: 'Check numbering',
            waypoints: [{ nodeId: 'UN', title: 'Step One', narration: 'Evidence from [1].' }],
            timeline: [{ date: '2026', label: 'Event', sourceUrl: 'https://www.un.org/real' }],
            sources: [
                { title: 'No-URL Note', publisher: 'Internal', dateLabel: '2026', url: '' },
                { title: 'UN Source', publisher: 'UN News', dateLabel: '2026', url: 'https://www.un.org/real' },
            ],
            supplementalSources: [],
        },
        exportedAt: '22 November 2026',
    }));
    assert.match(parityMarkup, /\[1\] UN News, 2026/);
    assert.doesNotMatch(parityMarkup, /No-URL Note/);

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
    assert.doesNotMatch(minimalMarkup, />At a glance<\/h2>/);
    assert.doesNotMatch(minimalMarkup, />Where<\/h2>/);
    assert.doesNotMatch(minimalMarkup, />Concepts and themes<\/h2>/);
    assert.doesNotMatch(minimalMarkup, />Sources<\/h2>/);
    assert.doesNotMatch(minimalMarkup, /<h[1-6][^>]*>\s*<\/h[1-6]>/i);
});

test('All printed href and source-url text pass safeHttpUrl and ListBriefingPrintContent preserves 40-item limit', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent, ListBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');
    const { safeHttpUrl } = await vite.ssrLoadModule('/src/navigationState.mjs');
    const { buildCasePrintTitle, buildCasePrintUrl } = await vite.ssrLoadModule('/src/utils/briefingPrint.mjs');

    assert.equal(
        buildCasePrintTitle('Myanmar: Fragmented Sovereignty'),
        'Myanmar: Fragmented Sovereignty - Global Command Center briefing',
    );
    assert.equal(
        buildCasePrintUrl('myanmar-fragmented-sovereignty'),
        'https://globalcommandcenter2026.netlify.app/?view=briefings&tour=myanmar-fragmented-sovereignty',
    );

    for (const tour of GUIDED_TOURS) {
        const markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, { tour }));
        const hrefs = extractHrefs(markup);
        const printedUrls = extractSourceUrlTexts(markup);
        assert.ok(hrefs.length > 0, `${tour.id} should contain source links`);
        assert.equal(printedUrls.length, hrefs.length, `${tour.id} should print full URL text for every safe source link`);
        for (const href of hrefs) {
            assert.equal(safeHttpUrl(href), href, `Printed href failed safeHttpUrl on ${tour.id}: ${href}`);
        }
        for (const urlText of printedUrls) {
            assert.equal(safeHttpUrl(urlText), urlText, `Printed URL text failed safeHttpUrl on ${tour.id}: ${urlText}`);
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

test('src omits document.write/window.open, and briefingPrint.css has no leaked screen rules', async t => {
    const vite = await createTestViteServer(t);
    const { default: PrintErrorBoundary } = await vite.ssrLoadModule('/src/components/PrintErrorBoundary.jsx');
    assert.equal(typeof PrintErrorBoundary, 'function');

    const srcFiles = walkSourceFiles(path.join(REPO_ROOT, 'src'));
    assert.ok(srcFiles.length > 10);
    for (const file of srcFiles) {
        const content = fs.readFileSync(file, 'utf8');
        assert.equal(/\bdocument\.write\b/.test(content), false, `Forbidden document.write in ${path.relative(REPO_ROOT, file)}`);
        assert.equal(/\bdocument\.writeln\b/.test(content), false, `Forbidden document.writeln in ${path.relative(REPO_ROOT, file)}`);
        assert.equal(/\bwindow\.open\b/.test(content), false, `Forbidden window.open in ${path.relative(REPO_ROOT, file)}`);
    }

    const css = fs.readFileSync(path.join(REPO_ROOT, 'src/briefingPrint.css'), 'utf8');
    const preambles = topLevelCssPreambles(css);
    assert.ok(preambles.length >= 2, 'Expected screen-hide rule and @media print block');
    for (const selector of preambles) {
        const allowed = selector === '.gcc-print-root' || /^@media\s+print$/i.test(selector);
        assert.equal(allowed, true, `Unexpected top-level CSS rule outside @media print in briefingPrint.css: ${selector}`);
    }
    assert.match(css, /\.gcc-print-debate-pair\s*\{[^}]*width:\s*100%[^}]*max-width:\s*none/s);
    assert.match(css, /\.gcc-print-tail-keep\s*\{[^}]*break-inside:\s*avoid/s);
});

test('Print layout deduplicates matching caution text, binds tail source to footer, and matches normalized text safely', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');
    const { normalizePrintText, isSamePrintText } = await vite.ssrLoadModule('/src/utils/briefingPrint.mjs');

    assert.equal(normalizePrintText('  Caution   Text \n Here  '), 'caution text here');
    assert.equal(isSamePrintText('Same   text.', 'same text.'), true);
    assert.equal(isSamePrintText('First text.', 'Second text.'), false);
    assert.equal(isSamePrintText('', ''), false);

    // Matching uncertainty + editorialCaution renders a single combined callout
    const myanmar = GUIDED_TOURS.find(item => item.id === 'myanmar-fragmented-sovereignty');
    const myanmarMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: myanmar,
        exportedAt: '23 November 2026',
    }));
    assert.match(myanmarMarkup, /<strong>Uncertainty and editorial caution:<\/strong>/);
    assert.doesNotMatch(myanmarMarkup, /<strong>Uncertainty:<\/strong>/);
    assert.doesNotMatch(myanmarMarkup, /<strong>Editorial caution:<\/strong>/);

    // Distinct uncertainty + editorialCaution renders both blocks separately
    const sudan = GUIDED_TOURS.find(item => item.id === 'sudan-displacement-regional-spillover');
    const sudanMarkup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
        tour: sudan,
        exportedAt: '23 November 2026',
    }));
    assert.match(sudanMarkup, /<strong>Uncertainty:<\/strong>/);
    assert.match(sudanMarkup, /<strong>Editorial caution:<\/strong>/);
    assert.doesNotMatch(sudanMarkup, /Uncertainty and editorial caution:/);

    // Final source item is grouped with footer inside .gcc-print-tail-keep with preserved numbering
    assert.match(
        sudanMarkup,
        /<div class="gcc-print-tail-keep"><ol class="gcc-print-sources gcc-print-sources--tail" start="\d+">/,
    );
    assert.match(sudanMarkup, /class="gcc-print-tail-keep"[\s\S]*class="gcc-print-footer"/);
});

test('Print Where section includes actor connections table only for cases with actorMap connections', async t => {
    const vite = await createTestViteServer(t);
    const { CaseBriefingPrintContent } = await vite.ssrLoadModule('/src/components/PrintBriefingDocument.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');
    const { collectActorMapConnections } = await vite.ssrLoadModule('/src/utils/briefingPrint.mjs');

    const expectedCounts = {
        'myanmar-fragmented-sovereignty': 8,
        'somaliland-recognition-red-sea-order': 9,
    };

    for (const [id, count] of Object.entries(expectedCounts)) {
        const tour = GUIDED_TOURS.find(item => item.id === id);
        const rows = collectActorMapConnections(tour);
        assert.equal(rows.length, count, `${id} should collect all actorMap connections`);
        const markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
            tour,
            exportedAt: '24 November 2026',
        }));
        const whereIdx = markup.indexOf('>Where</h2>');
        const briefingIdx = markup.indexOf('>The briefing</h2>');
        const whereSlice = markup.slice(whereIdx, briefingIdx);
        assert.match(whereSlice, /<h3>Actor connections<\/h3>/);
        assert.match(whereSlice, /class="gcc-print-table gcc-print-table--connections"/);
        for (const col of ['From', 'To', 'Type', 'Description']) {
            assert.match(whereSlice, new RegExp(`>${col}</th>`));
        }
        for (const row of rows) {
            assert.ok(decodeHtmlEntities(whereSlice).includes(row.from), `${id} missing from ${row.from}`);
            assert.ok(decodeHtmlEntities(whereSlice).includes(row.to), `${id} missing to ${row.to}`);
            assert.ok(decodeHtmlEntities(whereSlice).includes(row.type), `${id} missing type ${row.type}`);
            assert.ok(decodeHtmlEntities(whereSlice).includes(row.description), `${id} missing description ${row.description}`);
        }
    }

    const pilotIds = new Set(Object.keys(expectedCounts));
    const nonPilotTours = GUIDED_TOURS.filter(item => !pilotIds.has(item.id));
    assert.equal(
        nonPilotTours.length,
        GUIDED_TOURS.length - pilotIds.size,
        'Expected every remaining briefing outside the two pilot cases to be checked',
    );
    for (const tour of nonPilotTours) {
        assert.deepEqual(collectActorMapConnections(tour), []);
        const markup = renderToStaticMarkup(React.createElement(CaseBriefingPrintContent, {
            tour,
            exportedAt: '24 November 2026',
        }));
        assert.doesNotMatch(markup, /Actor connections/, `${tour.id} must remain unchanged without Actor connections`);
        assert.doesNotMatch(markup, /gcc-print-table--connections/, `${tour.id} must not render connections table`);
    }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, readAppWorkspaceSource } from './_helpers/readAppSources.mjs';

test('index.html and App workspace modules use self-hosted assets and favicon, and remove the 3D Nexus bundle', () => {
    const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const appJsx = readAppWorkspaceSource();
    const pkgJson = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));

    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/favicon.svg')), 'public/favicon.svg must exist');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/countries-110m.json')), 'countries-110m.json must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/earth-night.jpg')), 'earth-night.jpg must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/night-sky.jpg')), 'night-sky.jpg must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/fonts/fonts.css')), 'local fonts.css must exist');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/netlify-badge-color-accent.svg')), 'local Netlify SVG badge must exist');
    assert.equal(fs.existsSync(path.join(REPO_ROOT, 'src/GlobalRelationsNexus.jsx')), false, '3D GlobalRelationsNexus bundle must be removed');
    assert.equal(Boolean(pkgJson.dependencies?.['react-force-graph-3d']), false, 'package.json must omit react-force-graph-3d');

    assert.match(indexHtml, /href="\/favicon\.svg"/, 'index.html must link /favicon.svg');
    assert.match(indexHtml, /href="\/assets\/fonts\/fonts\.css"/, 'index.html must load self-hosted fonts.css');
    assert.ok(!indexHtml.includes('fonts.googleapis.com'), 'index.html must not block on fonts.googleapis.com');

    assert.ok(!appJsx.includes('unpkg.com/three-globe'), 'App.jsx must not fetch globe textures from unpkg.com');
    assert.ok(!appJsx.includes('cdn.jsdelivr.net/npm/world-atlas'), 'App.jsx must not fetch countries-110m.json from jsdelivr');
    assert.ok(!appJsx.includes('www.netlify.com/img/global/badges'), 'App.jsx must not fetch redirected badge from netlify.com');
    assert.match(appJsx, /width="114"\s+height="50"/, 'Netlify badge img must carry explicit width and height');
    assert.match(appJsx, /mobileGlobeEnabled/, 'App.jsx must support 1-tap mobile Globe opt-in (<768px)');
});

test('vite.config.mjs wires teacher-guide.html multi-page input, manualChunks case split, and JSON dev function middleware', () => {
    const viteConfig = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.mjs'), 'utf8');
    const redirects = fs.readFileSync(path.join(REPO_ROOT, 'public/_redirects'), 'utf8');

    assert.match(viteConfig, /teacher-guide\.html/, 'vite.config.mjs must include teacher-guide.html build input');
    assert.match(viteConfig, /manualChunks/, 'vite.config.mjs must split heavy static chunks via manualChunks');
    assert.match(viteConfig, /\/\.netlify\/functions\/public-intel/, 'vite.config.mjs dev middleware must serve JSON for public-intel');
    assert.match(redirects, /\/teacher-guide\.html\s+\/teacher-guide\.html\s+200/, '_redirects must pass through /teacher-guide.html before SPA catch-all');
    assert.match(redirects, /\/context-cards\s+\/context-cards\/index\.html\s+200/, '_redirects must pass through /context-cards without 301 loop');
    assert.ok(
        redirects.indexOf('/context-cards /context-cards/index.html 200') < redirects.indexOf('/* /index.html 200'),
        '/context-cards rule must appear before /* /index.html 200 catch-all',
    );
});

test('public/context-cards/ live classroom page, 5 portraits, self-hosted Playfair Display fonts, and source-health targets remain intact', () => {
    const contextCardsHtmlPath = path.join(REPO_ROOT, 'public/context-cards/index.html');
    assert.ok(fs.existsSync(contextCardsHtmlPath), 'public/context-cards/index.html live teaching page must exist');
    const html = fs.readFileSync(contextCardsHtmlPath, 'utf8');

    for (const portrait of ['charlie_soong.jpg', 'ding_ling.jpg', 'lao_she.jpg', 'lin_qiaozhi.jpg', 'lu_xun.jpg']) {
        assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/context-cards', portrait)), `public/context-cards/${portrait} must exist`);
        assert.ok(html.includes(`/context-cards/${portrait}`), `context-cards/index.html must reference /context-cards/${portrait}`);
    }

    for (let i = 1; i <= 8; i += 1) {
        assert.ok(
            fs.existsSync(path.join(REPO_ROOT, `public/assets/fonts/playfair-display-${i}.woff2`)),
            `self-hosted playfair-display-${i}.woff2 must exist`,
        );
        assert.ok(
            html.includes(`/assets/fonts/playfair-display-${i}.woff2`),
            `context-cards/index.html must declare /assets/fonts/playfair-display-${i}.woff2`,
        );
    }

    assert.ok(!html.includes('fonts.googleapis.com'), 'context-cards/index.html must not import from fonts.googleapis.com');
    assert.ok(!html.includes('fonts.gstatic.com'), 'context-cards/index.html must not reference fonts.gstatic.com');

    const outboundLinks = [...html.matchAll(/<a\s+[^>]*href="([^"]+)"[^>]*>/gi)].map(m => m[1]);
    assert.equal(outboundLinks.length, 5, 'context-cards/index.html must preserve all 5 outbound source citations');
    for (const link of outboundLinks) {
        assert.match(link, /^https:\/\//, `context-cards outbound link ${link} must use HTTPS`);
    }

    const manifest = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'netlify/functions/source-health-targets.json'), 'utf8'));
    const contextCardTargets = manifest.targets.filter(target => target.caseStudyId === 'context-cards');
    assert.equal(contextCardTargets.length, 5, 'source-health-targets.json must monitor all 5 context-cards outbound links');
    assert.deepEqual(contextCardTargets.map(t => t.url), outboundLinks);
});

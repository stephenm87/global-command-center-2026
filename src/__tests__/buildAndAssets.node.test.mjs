import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('index.html, App.jsx, and nexusGDELT.js use self-hosted assets, favicon, and server GDELT proxy instead of third-party CDNs', () => {
    const indexHtml = fs.readFileSync(path.join(REPO_ROOT, 'index.html'), 'utf8');
    const appJsx = fs.readFileSync(path.join(REPO_ROOT, 'src/App.jsx'), 'utf8');
    const gdeltJs = fs.readFileSync(path.join(REPO_ROOT, 'src/nexusGDELT.js'), 'utf8');

    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/favicon.svg')), 'public/favicon.svg must exist');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/countries-110m.json')), 'countries-110m.json must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/earth-night.jpg')), 'earth-night.jpg must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/globe/night-sky.jpg')), 'night-sky.jpg must be self-hosted');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/fonts/fonts.css')), 'local fonts.css must exist');
    assert.ok(fs.existsSync(path.join(REPO_ROOT, 'public/assets/netlify-badge-color-accent.svg')), 'local Netlify SVG badge must exist');

    assert.match(indexHtml, /href="\/favicon\.svg"/, 'index.html must link /favicon.svg');
    assert.match(indexHtml, /href="\/assets\/fonts\/fonts\.css"/, 'index.html must load self-hosted fonts.css');
    assert.ok(!indexHtml.includes('fonts.googleapis.com'), 'index.html must not block on fonts.googleapis.com');

    assert.ok(!appJsx.includes('unpkg.com/three-globe'), 'App.jsx must not fetch globe textures from unpkg.com');
    assert.ok(!appJsx.includes('cdn.jsdelivr.net/npm/world-atlas'), 'App.jsx must not fetch countries-110m.json from jsdelivr');
    assert.ok(!appJsx.includes('www.netlify.com/img/global/badges'), 'App.jsx must not fetch redirected badge from netlify.com');
    assert.match(appJsx, /width="114"\s+height="50"/, 'Netlify badge img must carry explicit width and height');
    assert.match(appJsx, /mobileGlobeEnabled/, 'App.jsx must support 1-tap mobile Globe opt-in (<768px)');

    assert.ok(!gdeltJs.includes('https://api.gdeltproject.org'), 'Browser nexusGDELT.js must route through cached Netlify function');
    assert.match(gdeltJs, /\/\.netlify\/functions\/gdelt-pulse/);
});

test('vite.config.mjs wires teacher-guide.html multi-page input, manualChunks case split, and JSON dev function middleware', () => {
    const viteConfig = fs.readFileSync(path.join(REPO_ROOT, 'vite.config.mjs'), 'utf8');
    const redirects = fs.readFileSync(path.join(REPO_ROOT, 'public/_redirects'), 'utf8');

    assert.match(viteConfig, /teacher-guide\.html/, 'vite.config.mjs must include teacher-guide.html build input');
    assert.match(viteConfig, /manualChunks/, 'vite.config.mjs must split heavy static chunks via manualChunks');
    assert.match(viteConfig, /\/\.netlify\/functions\/public-intel/, 'vite.config.mjs dev middleware must serve JSON for public-intel');
    assert.match(redirects, /\/teacher-guide\.html\s+\/teacher-guide\.html\s+200/, '_redirects must pass through /teacher-guide.html before SPA catch-all');
});

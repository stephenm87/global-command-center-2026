const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FUNCTIONS_DIR = path.resolve(__dirname, '..');
const REPO_ROOT = path.resolve(FUNCTIONS_DIR, '../..');

const SCHEDULED_OR_HELPER_FILES = new Set([
    'security.js',
    'gemini-retry.js',
    'refresh-public-intel.mjs',
    'refresh-source-health.mjs',
]);

function stripJsComments(source) {
    return source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('every HTTP-reachable Netlify function invokes protectEndpoint or protectPublicEndpoint', () => {
    for (const helperName of SCHEDULED_OR_HELPER_FILES) {
        assert.ok(
            fs.existsSync(path.join(FUNCTIONS_DIR, helperName)),
            `Allowlisted helper/scheduled file ${helperName} must exist on disk`
        );
    }

    const entries = fs.readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
        .filter(entry => entry.isFile() && /\.(?:m?js)$/.test(entry.name))
        .map(entry => entry.name)
        .filter(name => !SCHEDULED_OR_HELPER_FILES.has(name));

    assert.ok(entries.length >= 5, 'Expected HTTP function handlers in netlify/functions');

    for (const fileName of entries) {
        const source = stripJsComments(fs.readFileSync(path.join(FUNCTIONS_DIR, fileName), 'utf8'));
        const hasGuard = /\bawait\s+protectEndpoint\s*\(/.test(source) || /\bprotectPublicEndpoint\s*\(/.test(source);
        assert.ok(hasGuard, `${fileName} must guard requests with protectEndpoint or protectPublicEndpoint`);
    }
});

test('netlify.toml CSP omits unsafe-eval/unsafe-inline in script-src and restricts fonts/images/connect to self + Supabase', () => {
    const toml = fs.readFileSync(path.join(REPO_ROOT, 'netlify.toml'), 'utf8');
    const cspLine = toml.split('\n').find(line => line.includes('Content-Security-Policy'));
    assert.ok(cspLine, 'Expected Content-Security-Policy in netlify.toml');

    const scriptSrcMatch = cspLine.match(/script-src\s+([^;]+)/);
    const fontSrcMatch = cspLine.match(/font-src\s+([^;]+)/);
    const imgSrcMatch = cspLine.match(/img-src\s+([^;]+)/);
    const connectSrcMatch = cspLine.match(/connect-src\s+([^;]+)/);
    assert.ok(scriptSrcMatch && fontSrcMatch && imgSrcMatch && connectSrcMatch, 'Expected CSP directives');

    assert.ok(!scriptSrcMatch[1].includes("'unsafe-eval'"), "script-src must not allow 'unsafe-eval'");
    assert.ok(!scriptSrcMatch[1].includes("'unsafe-inline'"), "script-src must not allow 'unsafe-inline'");
    assert.equal(fontSrcMatch[1].trim(), "'self'", 'font-src must be restricted to self after local bundling');

    for (const retiredOrigin of ['unpkg.com', 'jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'api.gdeltproject.org', 'raw.githubusercontent.com', 'www.netlify.com']) {
        assert.ok(!cspLine.includes(retiredOrigin), `Retired third-party origin ${retiredOrigin} must be removed from netlify.toml CSP`);
    }
    assert.ok(connectSrcMatch[1].includes('https://*.supabase.co'), 'connect-src must permit Supabase auth/sync');
});

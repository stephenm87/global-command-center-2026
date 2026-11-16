import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REPO_ROOT, readAppWorkspaceSource } from './_helpers/readAppSources.mjs';

async function createTestViteServer(t) {
    const vite = await createServer({
        configFile: false,
        root: REPO_ROOT,
        cacheDir: `/tmp/vite-gcc-auth-test-${process.pid}`,
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

test('supabase client rejects placeholder publishable keys and exposes maybeSingle on fallback stub', async t => {
    const vite = await createTestViteServer(t);
    const { isValidClientKey, supabase } = await vite.ssrLoadModule('/src/supabase.js');

    assert.equal(typeof isValidClientKey, 'function', 'supabase.js should export isValidClientKey');
    assert.equal(isValidClientKey('sb_publishable_your_key_here'), false, 'must reject .env.example placeholder');
    assert.equal(isValidClientKey('your_supabase_publishable_key_here'), false);
    assert.equal(isValidClientKey('sb_publishable_short'), false);
    assert.equal(isValidClientKey('sb_publishable_9f8e7d6c5b4a3f2e1d0c9b8a7f6e'), true);

    const envExample = fs.readFileSync(path.join(REPO_ROOT, '.env.example'), 'utf8');
    const keyMatch = envExample.match(/^VITE_SUPABASE_PUBLISHABLE_KEY=(.+)$/m);
    assert.ok(keyMatch, '.env.example should document VITE_SUPABASE_PUBLISHABLE_KEY');
    assert.equal(isValidClientKey(keyMatch[1].trim()), false, '.env.example placeholder must never pass isValidClientKey');

    const stubResult = await supabase.from('user_data').select('value').eq('user_id', 'u1').eq('key', 'gcc-preferences').maybeSingle();
    assert.deepEqual(stubResult, { data: null, error: null });
});

test('AuthBadge handles null user.email safely and AuthModal renders accessible labelled email input', async t => {
    const vite = await createTestViteServer(t);
    const { AuthBadge, AuthModal, getDisplayName } = await vite.ssrLoadModule('/src/AuthModal.jsx');

    assert.equal(typeof getDisplayName, 'function');
    assert.equal(getDisplayName({ id: 'u-no-email', email: null }), 'Operator');
    assert.equal(getDisplayName({ id: 'u-empty', email: '' }), 'Operator');
    assert.equal(getDisplayName({ id: 'u-real', email: 'alex.rivera@school.org' }), 'Alex');

    const badgeMarkup = renderToStaticMarkup(React.createElement(AuthBadge, {
        user: { id: 'u-no-email', email: null },
        onSignInClick: () => {},
    }));
    assert.match(badgeMarkup, /Operator/);
    assert.match(badgeMarkup, /aria-label="Sign out"/);

    const modalMarkup = renderToStaticMarkup(React.createElement(AuthModal, {
        onClose: () => {},
        initialError: 'That sign-in link expired or was already used.',
    }));
    assert.match(modalMarkup, /role="dialog"/);
    assert.match(modalMarkup, /for="gcc-auth-email"/);
    assert.match(modalMarkup, /id="gcc-auth-email"/);
    assert.match(modalMarkup, /role="alert"/);
    assert.match(modalMarkup, /expired/);
});

test('App.jsx uses maybeSingle() + debounced upsert, createDebouncedRunner coalesces bursts, and user_data RLS SQL migration exists', async t => {
    const vite = await createTestViteServer(t);
    const { createDebouncedRunner } = await vite.ssrLoadModule('/src/supabase.js');

    let calls = 0;
    let lastValue = null;
    const runner = createDebouncedRunner(25);
    for (let i = 1; i <= 5; i += 1) {
        runner.schedule(() => {
            calls += 1;
            lastValue = i;
        });
    }
    await new Promise(resolve => setTimeout(resolve, 60));
    assert.equal(calls, 1, 'Five rapid slider updates must coalesce into a single upsert');
    assert.equal(lastValue, 5);

    const appSource = readAppWorkspaceSource();
    const appRootJsx = fs.readFileSync(path.join(REPO_ROOT, 'src/App.jsx'), 'utf8');
    assert.match(appRootJsx, /\buseSupabasePreferences\s*\(\s*\{/, 'App.jsx must invoke useSupabasePreferences');
    assert.ok(appSource.includes('.maybeSingle()'), 'Preference hydration must use .maybeSingle() instead of .single()');
    assert.ok(!/from\('user_data'\)[\s\S]{0,140}\.single\(\)/.test(appSource), 'App workspace must not call .single() on user_data');
    assert.match(appSource, /setTimeout\(\(\)\s*=>\s*\{\s*supabase\.from\('user_data'\)\.upsert\([\s\S]{0,500}?,\s*400\)/, 'useSupabasePreferences must debounce user_data upserts by 400ms');

    const migrationsDir = path.join(REPO_ROOT, 'supabase/migrations');
    assert.ok(fs.existsSync(migrationsDir), 'supabase/migrations directory must exist');
    const sqlFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    assert.ok(sqlFiles.length >= 1, 'Expected at least one versioned RLS SQL migration');

    const combinedSql = sqlFiles.map(f => fs.readFileSync(path.join(migrationsDir, f), 'utf8')).join('\n');
    assert.match(combinedSql, /enable row level security/i);
    assert.match(combinedSql, /pg_constraint/i, 'Migration should idempotently backfill constraints on pre-existing user_data');
    assert.match(combinedSql, /\(?\s*(?:select\s+)?auth\.uid\(\)\s*\)?\s*=\s*user_id/i);
});

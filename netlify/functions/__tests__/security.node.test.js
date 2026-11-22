const test = require('node:test');
const assert = require('node:assert/strict');
const { Readable } = require('node:stream');

const ORIGINAL_ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
    ALLOWED_SIGNIN_EMAILS: process.env.ALLOWED_SIGNIN_EMAILS,
    ALLOWED_SIGNIN_DOMAINS: process.env.ALLOWED_SIGNIN_DOMAINS,
    AI_SUMMARY_DAILY_CAP: process.env.AI_SUMMARY_DAILY_CAP,
};
const originalFetch = global.fetch;

function createMemoryBlobStore(backing = new Map(), { throwOnGet = false, throwOnSet = false } = {}) {
    return {
        backing,
        async get(key, options = {}) {
            if (throwOnGet) throw new Error('Simulated Blobs read failure');
            assert.equal(options.consistency, 'strong', 'Rate-limit reads must request strong consistency');
            if (!backing.has(key)) return null;
            return JSON.parse(JSON.stringify(backing.get(key)));
        },
        async setJSON(key, value) {
            if (throwOnSet) throw new Error('Simulated Blobs write failure');
            backing.set(key, JSON.parse(JSON.stringify(value)));
        },
    };
}

function event(overrides = {}) {
    return {
        httpMethod: 'POST',
        headers: {},
        ...overrides,
    };
}

function mockSupabaseOk(user = { id: 'user-1', email: 'user@example.com' }) {
    global.fetch = async () => ({
        ok: true,
        json: async () => user,
    });
}

test.beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
    delete process.env.ALLOWED_SIGNIN_EMAILS;
    delete process.env.ALLOWED_SIGNIN_DOMAINS;
    delete process.env.AI_SUMMARY_DAILY_CAP;
});

test.afterEach(() => {
    global.fetch = originalFetch;
});

test.after(() => {
    for (const [key, val] of Object.entries(ORIGINAL_ENV)) {
        if (val === undefined) delete process.env[key];
        else process.env[key] = val;
    }
});

test('rejects requests without a bearer token', async () => {
    const { protectEndpoint } = require('../security');
    const result = await protectEndpoint(event());

    assert.equal(result.response.statusCode, 401);
});

test('rejects unsupported methods before authentication', async () => {
    const { protectEndpoint } = require('../security');
    const result = await protectEndpoint(event({ httpMethod: 'DELETE' }));

    assert.equal(result.response.statusCode, 405);
});

test('answers approved-origin preflight requests with authorization headers', async () => {
    const { protectEndpoint } = require('../security');
    const result = await protectEndpoint(event({
        httpMethod: 'OPTIONS',
        headers: { origin: 'http://localhost:5173' },
    }));

    assert.equal(result.response.statusCode, 204);
    assert.equal(result.response.headers['Access-Control-Allow-Origin'], 'http://localhost:5173');
    assert.match(result.response.headers['Access-Control-Allow-Headers'], /Authorization/);
});

test('validates the bearer token with Supabase Auth', async () => {
    let request;
    global.fetch = async (url, init) => {
        request = { url, init };
        return {
            ok: true,
            json: async () => ({ id: 'user-1', email: 'user@example.com' }),
        };
    };

    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();
    const result = await protectEndpoint(event({
        headers: { authorization: 'Bearer access-token' },
    }), { store });

    assert.equal(result.user.email, 'user@example.com');
    assert.equal(request.url, 'https://example.supabase.co/auth/v1/user');
    assert.equal(request.init.headers.Authorization, 'Bearer access-token');
    assert.equal(request.init.headers.apikey, 'publishable-key');
});

test('rejects invalid tokens reported by Supabase Auth', async () => {
    global.fetch = async () => ({
        ok: false,
    });

    const { protectEndpoint } = require('../security');
    const result = await protectEndpoint(event({
        headers: { authorization: 'Bearer access-token' },
    }), { store: createMemoryBlobStore() });

    assert.equal(result.response.statusCode, 401);
});

test('rejects unapproved browser origins', async () => {
    const { protectEndpoint } = require('../security');
    const result = await protectEndpoint(event({
        headers: { origin: 'https://attacker.example' },
    }));

    assert.equal(result.response.statusCode, 403);
});

test('allows the project deploy-preview origin without weakening arbitrary origins', async () => {
    const { isAllowedOrigin, protectPublicEndpoint } = require('../security');
    const previewOrigin = 'https://deploy-preview-30--globalcommandcenter2026.netlify.app';

    assert.equal(isAllowedOrigin(previewOrigin), true);
    assert.equal(isAllowedOrigin('https://deploy-preview-30--attacker.netlify.app'), false);
    assert.equal(protectPublicEndpoint(event({
        httpMethod: 'GET',
        headers: { origin: previewOrigin },
    })).response, undefined);
});

test('rate limits repeated requests from the same authenticated user across Blobs', async () => {
    mockSupabaseOk({ id: 'rate-test-user', email: 'user@example.com' });

    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();
    const authenticatedEvent = event({
        headers: { authorization: 'Bearer access-token' },
    });

    const first = await protectEndpoint(authenticatedEvent, { maxRequests: 1, store });
    const second = await protectEndpoint(authenticatedEvent, { maxRequests: 1, store });

    assert.equal(first.user.id, 'rate-test-user');
    assert.equal(second.response.statusCode, 429);
    assert.ok(second.response.headers['Retry-After']);
});

test('per-user rate limit survives a simulated cold start when security module cache is cleared', async () => {
    mockSupabaseOk({ id: 'cold-start-user', email: 'user@example.com' });
    const backing = new Map();
    const req = () => event({ headers: { authorization: 'Bearer access-token' } });

    const securityPath = require.resolve('../security');
    let mod1 = require(securityPath);
    const store1 = createMemoryBlobStore(backing);

    assert.equal((await mod1.protectEndpoint(req(), { maxRequests: 2, scope: 'ai-summary', store: store1 })).response, undefined);
    assert.equal((await mod1.protectEndpoint(req(), { maxRequests: 2, scope: 'ai-summary', store: store1 })).response, undefined);

    // Simulate a Netlify cold start by purging security.js from require.cache
    delete require.cache[securityPath];
    const mod2 = require(securityPath);
    const store2 = createMemoryBlobStore(backing);

    const blocked = await mod2.protectEndpoint(req(), { maxRequests: 2, scope: 'ai-summary', store: store2 });
    assert.equal(blocked.response.statusCode, 429);
    assert.match(JSON.parse(blocked.response.body).error, /Rate limit exceeded/i);
});

test('global daily cap refuses next request across distinct users, respects 0 kill-switch, fails closed on malformed cap, and resets next UTC day', async () => {
    let userIndex = 0;
    global.fetch = async () => {
        userIndex += 1;
        return {
            ok: true,
            json: async () => ({ id: `daily-user-${userIndex}`, email: `u${userIndex}@school.edu` }),
        };
    };

    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();
    const day1 = Date.UTC(2026, 10, 22, 12, 0, 0);
    const day2 = Date.UTC(2026, 10, 23, 0, 1, 0);
    const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        AI_SUMMARY_DAILY_CAP: '2',
    };

    const opts = (now = day1, envOverride = env) => ({
        maxRequests: 12,
        scope: 'ai-summary',
        dailyCapEnv: 'AI_SUMMARY_DAILY_CAP',
        defaultDailyCap: 200,
        env: envOverride,
        store,
        nowFn: () => now,
    });

    const r1 = await protectEndpoint(event({ headers: { authorization: 'Bearer t1' } }), opts(day1));
    const r2 = await protectEndpoint(event({ headers: { authorization: 'Bearer t2' } }), opts(day1));
    const r3 = await protectEndpoint(event({ headers: { authorization: 'Bearer t3' } }), opts(day1));

    assert.equal(r1.response, undefined);
    assert.equal(r2.response, undefined);
    assert.equal(r3.response.statusCode, 429);
    assert.match(JSON.parse(r3.response.body).error, /Daily usage limit reached/i);
    assert.ok(Number(r3.response.headers['Retry-After']) > 0);

    // Next UTC day resets daily counter
    const r4 = await protectEndpoint(event({ headers: { authorization: 'Bearer t4' } }), opts(day2));
    assert.equal(r4.response, undefined);

    // Cap of 0 acts as immediate kill-switch
    const killSwitch = await protectEndpoint(
        event({ headers: { authorization: 'Bearer t5' } }),
        opts(day2, { ...env, AI_SUMMARY_DAILY_CAP: '0' }),
    );
    assert.equal(killSwitch.response.statusCode, 429);

    // Malformed cap fails closed with 503
    const malformed = await protectEndpoint(
        event({ headers: { authorization: 'Bearer t6' } }),
        opts(day2, { ...env, AI_SUMMARY_DAILY_CAP: 'not-a-number' }),
    );
    assert.equal(malformed.response.statusCode, 503);
});

test('scopes rate-limit Blobs store by deploy context so previews never spend production allowance', () => {
    const {
        RATE_LIMIT_STORE_NAME,
        isProductionContext,
        resolveRateLimitStore,
    } = require('../security');

    const calls = [];
    const prodStore = createMemoryBlobStore();
    const previewStore = createMemoryBlobStore();
    const fakeGetStore = name => {
        calls.push(`site:${name}`);
        return prodStore;
    };
    const fakeGetDeployStore = name => {
        calls.push(`deploy:${name}`);
        return previewStore;
    };

    assert.equal(isProductionContext({ context: { deploy: { context: 'production' } }, env: {} }), true);
    assert.equal(isProductionContext({ context: { deploy: { context: 'deploy-preview' } }, env: { CONTEXT: 'production' } }), false);
    assert.equal(isProductionContext({ context: { deploy: { context: 'production', published: false } }, env: { CONTEXT: 'production' } }), false);

    assert.equal(
        resolveRateLimitStore({
            context: { deploy: { context: 'production' } },
            env: {},
            getStoreFn: fakeGetStore,
            getDeployStoreFn: fakeGetDeployStore,
        }),
        prodStore,
    );
    assert.equal(
        resolveRateLimitStore({
            context: { deploy: { context: 'deploy-preview' } },
            env: {},
            getStoreFn: fakeGetStore,
            getDeployStoreFn: fakeGetDeployStore,
        }),
        previewStore,
    );
    assert.deepEqual(calls, [`site:${RATE_LIMIT_STORE_NAME}`, `deploy:${RATE_LIMIT_STORE_NAME}`]);
});

test('fails closed with 503 when Blobs store is unavailable or throws on read/write', async () => {
    mockSupabaseOk({ id: 'fail-closed-user', email: 'user@example.com' });
    const { protectEndpoint } = require('../security');

    const originalError = console.error;
    console.error = () => {};
    try {
        const readFail = await protectEndpoint(
            event({ headers: { authorization: 'Bearer token' } }),
            { scope: 'ai-summary', store: createMemoryBlobStore(new Map(), { throwOnGet: true }) },
        );
        assert.equal(readFail.response.statusCode, 503);
        assert.match(JSON.parse(readFail.response.body).error, /temporarily unavailable/i);

        const writeFail = await protectEndpoint(
            event({ headers: { authorization: 'Bearer token' } }),
            { scope: 'ai-summary', store: createMemoryBlobStore(new Map(), { throwOnSet: true }) },
        );
        assert.equal(writeFail.response.statusCode, 503);

        // No store override & no Netlify Blobs env -> MissingBlobsEnvironmentError -> 503 fail closed
        const noBlobsEnv = await protectEndpoint(
            event({ headers: { authorization: 'Bearer token' } }),
            { scope: 'ai-summary', getDeployStoreFn: () => { throw new Error('MissingBlobsEnvironmentError'); } },
        );
        assert.equal(noBlobsEnv.response.statusCode, 503);
    } finally {
        console.error = originalError;
    }
});

test('server-side sign-in allow-list accepts matching email/domain, rejects spoofed/unauthorized users with 403, and never logs email addresses', async () => {
    const { protectEndpoint, isEmailAllowed, parseAllowList } = require('../security');

    const list = parseAllowList({
        ALLOWED_SIGNIN_EMAILS: ' Teacher@Example.org , admin@gov.test ',
        ALLOWED_SIGNIN_DOMAINS: ' @School.EDU , ib-campus.org ',
    });
    assert.equal(isEmailAllowed('teacher@example.org', list), true);
    assert.equal(isEmailAllowed('STUDENT@school.edu', list), true);
    assert.equal(isEmailAllowed('attacker@evil-school.edu', list), false, 'Partial domain suffix must never match');
    assert.equal(isEmailAllowed('spoof@evil.com@school.edu', list), false, 'Double-@ spoofing must fail');
    assert.equal(isEmailAllowed(null, list), false);

    const env = {
        SUPABASE_URL: 'https://example.supabase.co',
        SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
        ALLOWED_SIGNIN_EMAILS: 'teacher@example.org',
        ALLOWED_SIGNIN_DOMAINS: 'school.edu',
    };
    const store = createMemoryBlobStore();
    const capturedLogs = [];
    const origWarn = console.warn;
    console.warn = (...args) => capturedLogs.push(args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' '));

    try {
        // Allowed via Supabase email
        mockSupabaseOk({ id: 'teacher-1', email: 'Teacher@Example.ORG' });
        const allowed = await protectEndpoint(
            event({ headers: { authorization: 'Bearer t1' } }),
            { env, store, scope: 'ai-summary' },
        );
        assert.equal(allowed.response, undefined);

        // Unauthorized email returned by Supabase — even if client sends an allowed email header/body
        const refusedEmail = 'private.unauthorized@outsider.example';
        mockSupabaseOk({ id: 'outsider-1', email: refusedEmail });
        const refused = await protectEndpoint(
            new Request('https://example.org/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: {
                    authorization: 'Bearer t2',
                    'x-user-email': 'teacher@example.org',
                },
                body: JSON.stringify({ email: 'teacher@example.org', content: 'x'.repeat(250) }),
            }),
            { env, store, scope: 'ai-summary', maxBodyBytes: 64 * 1024 },
        );
        assert.equal(refused.response.statusCode, 403);
        const body = JSON.parse(refused.response.body);
        assert.equal(body.code, 'account_not_allowed');
        assert.ok(!JSON.stringify(body).includes(refusedEmail), 'Refusal response must not echo disallowed email');

        // Verify email address never hit console logs
        const allLogs = capturedLogs.join('\n');
        assert.ok(capturedLogs.length >= 1, 'Expected allow-list denial audit log');
        assert.match(allLogs, /userHash/, 'Denial log must record hashed user id');
        assert.ok(!allLogs.includes(refusedEmail), 'Denial log must never contain user email');
        assert.ok(!allLogs.includes('outsider.example'), 'Denial log must never contain user email domain');
    } finally {
        console.warn = origWarn;
    }
});

test('allow-list stays inactive when both ALLOWED_SIGNIN_EMAILS and ALLOWED_SIGNIN_DOMAINS are empty or unset', async () => {
    const { protectEndpoint, parseAllowList } = require('../security');
    assert.equal(parseAllowList({}).enabled, false);
    assert.equal(parseAllowList({ ALLOWED_SIGNIN_EMAILS: ' , ', ALLOWED_SIGNIN_DOMAINS: ' @ , ' }).enabled, false);

    mockSupabaseOk({ id: 'open-user', email: null });
    const res = await protectEndpoint(
        event({ headers: { authorization: 'Bearer token' } }),
        {
            env: {
                SUPABASE_URL: 'https://example.supabase.co',
                SUPABASE_PUBLISHABLE_KEY: 'publishable-key',
                ALLOWED_SIGNIN_EMAILS: '   ',
                ALLOWED_SIGNIN_DOMAINS: '',
            },
            store: createMemoryBlobStore(),
            scope: 'deep-scan',
        },
    );
    assert.equal(res.response, undefined);
});

test('rejects oversized bodies with 413 before parsing or incrementing Blobs counters (both Content-Length and streamed body)', async () => {
    mockSupabaseOk({ id: 'payload-user', email: 'student@school.edu' });
    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();

    // 1. Rejected immediately via declared Content-Length header
    const headerTooLarge = new Request('https://example.org/.netlify/functions/deep-scan', {
        method: 'POST',
        headers: {
            authorization: 'Bearer token',
            'content-length': String(100 * 1024),
        },
        body: '{}',
    });
    const r1 = await protectEndpoint(headerTooLarge, { maxBodyBytes: 4096, store, scope: 'deep-scan' });
    assert.equal(r1.response.statusCode, 413);
    assert.equal(store.backing.size, 0, '413 must abort before touching Blobs quota');

    // 2. Rejected while streaming when Content-Length header is absent (chunked transfer)
    const bigStream = Readable.toWeb(Readable.from([Buffer.alloc(3000, 97), Buffer.alloc(3000, 98)]));
    const streamTooLarge = new Request('https://example.org/.netlify/functions/deep-scan', {
        method: 'POST',
        headers: { authorization: 'Bearer token' },
        body: bigStream,
        duplex: 'half',
    });
    const r2 = await protectEndpoint(streamTooLarge, { maxBodyBytes: 4096, store, scope: 'deep-scan' });
    assert.equal(r2.response.statusCode, 413);
    assert.equal(store.backing.size, 0, 'Streamed 413 must abort before touching Blobs quota');
});

test('scopes rate-limit buckets per endpoint and returns CORS + private Cache-Control headers for 200 responses', async () => {
    global.fetch = async (_url, init) => {
        assert.ok(init.signal, 'Supabase /auth/v1/user fetch must include an AbortSignal timeout');
        return {
            ok: true,
            json: async () => ({ id: 'scoped-user', email: 'scoped@example.com' }),
        };
    };

    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();
    const previewOrigin = 'https://deploy-preview-42--globalcommandcenter2026.netlify.app';
    const reqEvent = event({
        headers: {
            authorization: 'Bearer access-token',
            origin: previewOrigin,
        },
    });

    const scan1 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'deep-scan', store });
    const summary1 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'ai-summary', store });
    const scan2 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'deep-scan', store });

    assert.equal(scan1.response, undefined);
    assert.equal(summary1.response, undefined, 'Different endpoint scope must not exhaust user quota');
    assert.equal(scan2.response.statusCode, 429);
    assert.equal(scan1.headers['Access-Control-Allow-Origin'], previewOrigin);
    assert.equal(scan1.headers['Cache-Control'], 'private, no-store');
});

test('allows 30 distinct classroom users on one shared school IP even after repeated invalid tokens on that IP', async () => {
    let supabaseCalls = 0;
    global.fetch = async (_url, init) => {
        supabaseCalls += 1;
        const authHeader = init.headers.Authorization || '';
        const match = authHeader.match(/^Bearer\s+student-token-(\d+)$/);
        if (!match) {
            return { ok: false };
        }
        const studentNum = match[1];
        return {
            ok: true,
            json: async () => ({ id: `student-${studentNum}`, email: `student${studentNum}@school.edu` }),
        };
    };

    const { protectEndpoint } = require('../security');
    const store = createMemoryBlobStore();
    const sharedSchoolIp = '198.51.100.42';

    // 50 invalid Bearer attempts on the same school NAT must not lock out valid students
    // and repeated identical bad tokens should be cached locally rather than hammering Supabase 50 times.
    for (let i = 0; i < 50; i += 1) {
        const badRes = await protectEndpoint(event({
            headers: {
                authorization: 'Bearer invalid-classroom-token',
                'x-nf-client-connection-ip': sharedSchoolIp,
            },
        }), { maxRequests: 15, scope: 'deep-scan', store });
        assert.equal(badRes.response.statusCode, 401);
    }
    assert.ok(supabaseCalls <= 5, `Expected repeated bad token to stop hitting Supabase after caching, got ${supabaseCalls} calls`);

    // Now 30 students on that exact same IP each make 2 Deep Scan requests (60 valid requests total).
    for (let student = 1; student <= 30; student += 1) {
        for (let scan = 1; scan <= 2; scan += 1) {
            const okRes = await protectEndpoint(event({
                headers: {
                    authorization: `Bearer student-token-${student}`,
                    'x-nf-client-connection-ip': sharedSchoolIp,
                },
            }), { maxRequests: 15, scope: 'deep-scan', store });
            assert.equal(okRes.response, undefined, `Student ${student} scan ${scan} should not be blocked by school NAT sharing`);
            assert.equal(okRes.user.id, `student-${student}`);
        }
    }
});

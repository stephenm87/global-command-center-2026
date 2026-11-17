const test = require('node:test');
const assert = require('node:assert/strict');

const ORIGINAL_ENV = {
    SUPABASE_URL: process.env.SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: process.env.SUPABASE_PUBLISHABLE_KEY,
};
const originalFetch = global.fetch;

function event(overrides = {}) {
    return {
        httpMethod: 'POST',
        headers: {},
        ...overrides,
    };
}

test.beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_PUBLISHABLE_KEY = 'publishable-key';
});

test.afterEach(() => {
    global.fetch = originalFetch;
});

test.after(() => {
    if (ORIGINAL_ENV.SUPABASE_URL === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = ORIGINAL_ENV.SUPABASE_URL;
    if (ORIGINAL_ENV.SUPABASE_PUBLISHABLE_KEY === undefined) delete process.env.SUPABASE_PUBLISHABLE_KEY;
    else process.env.SUPABASE_PUBLISHABLE_KEY = ORIGINAL_ENV.SUPABASE_PUBLISHABLE_KEY;
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
    const result = await protectEndpoint(event({
        headers: { authorization: 'Bearer access-token' },
    }));

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
    }));

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

test('rate limits repeated requests from the same authenticated user', async () => {
    global.fetch = async () => ({
        ok: true,
        json: async () => ({ id: 'rate-test-user', email: 'user@example.com' }),
    });

    const { protectEndpoint } = require('../security');
    const authenticatedEvent = event({
        headers: { authorization: 'Bearer access-token' },
    });

    const first = await protectEndpoint(authenticatedEvent, { maxRequests: 1 });
    const second = await protectEndpoint(authenticatedEvent, { maxRequests: 1 });

    assert.equal(first.user.id, 'rate-test-user');
    assert.equal(second.response.statusCode, 429);
    assert.ok(second.response.headers['Retry-After']);
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
    const previewOrigin = 'https://deploy-preview-42--globalcommandcenter2026.netlify.app';
    const reqEvent = event({
        headers: {
            authorization: 'Bearer access-token',
            origin: previewOrigin,
        },
    });

    const scan1 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'deep-scan' });
    const summary1 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'ai-summary' });
    const scan2 = await protectEndpoint(reqEvent, { maxRequests: 1, scope: 'deep-scan' });

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
    const sharedSchoolIp = '198.51.100.42';

    // 50 invalid Bearer attempts on the same school NAT must not lock out valid students
    // and repeated identical bad tokens should be cached locally rather than hammering Supabase 50 times.
    for (let i = 0; i < 50; i += 1) {
        const badRes = await protectEndpoint(event({
            headers: {
                authorization: 'Bearer invalid-classroom-token',
                'x-nf-client-connection-ip': sharedSchoolIp,
            },
        }), { maxRequests: 15, scope: 'deep-scan' });
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
            }), { maxRequests: 15, scope: 'deep-scan' });
            assert.equal(okRes.response, undefined, `Student ${student} scan ${scan} should not be blocked by school NAT sharing`);
            assert.equal(okRes.user.id, `student-${student}`);
        }
    }
});

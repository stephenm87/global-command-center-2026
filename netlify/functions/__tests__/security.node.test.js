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

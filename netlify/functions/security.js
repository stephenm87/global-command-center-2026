const crypto = require('node:crypto');

const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_STORE_NAME = 'global-command-center-rate-limits';
const AUTH_TIMEOUT_MS = 5000;
const MAX_TRACKED_BAD_TOKENS = 2000;
const PRUNE_INTERVAL_MS = 60 * 1000;
const BAD_TOKEN_MAX_CHECKS = 3;
const ACCOUNT_NOT_ALLOWED_MESSAGE = 'This account is not authorized to use AI analysis or live search tools. Contact your teacher or administrator.';
const DEFAULT_ALLOWED_ORIGINS = [
    'https://globalcommandcenter2026.netlify.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8888',
    'http://127.0.0.1:8888',
];
const DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--globalcommandcenter2026\.netlify\.app$/;

const badTokenBuckets = new Map();
let lastBadTokenPrunedAt = 0;

function readEnv(name, env = process.env) {
    if (env === process.env && typeof globalThis.Netlify?.env?.get === 'function') {
        const value = globalThis.Netlify.env.get(name);
        if (typeof value === 'string') return value;
    }
    return env?.[name];
}

function isWebRequest(input) {
    return Boolean(
        input
        && typeof input.method === 'string'
        && input.headers
        && typeof input.headers.get === 'function'
    );
}

function getHeader(event, name) {
    const headers = event?.headers || {};
    if (typeof headers.get === 'function') {
        return headers.get(name) || headers.get(name.toLowerCase()) || '';
    }
    return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function toLegacyEvent(requestOrEvent, context = null) {
    if (!isWebRequest(requestOrEvent)) {
        return requestOrEvent || {};
    }
    const headers = {};
    for (const [key, value] of requestOrEvent.headers.entries()) {
        headers[key.toLowerCase()] = value;
    }
    let pathname = '';
    try {
        pathname = new URL(requestOrEvent.url || 'https://localhost/').pathname;
    } catch {
        pathname = '';
    }
    return {
        httpMethod: requestOrEvent.method,
        path: pathname,
        headers,
        clientIp: context?.ip || '',
    };
}

function toResponse(response) {
    const status = response?.statusCode || 500;
    const body = (status === 204 || status === 205 || status === 304)
        ? null
        : (response?.body ?? null);
    return new Response(body, {
        status,
        headers: response?.headers || {},
    });
}

function getClientIp(event) {
    return getHeader(event, 'x-nf-client-connection-ip')
        || getHeader(event, 'client-ip')
        || getHeader(event, 'x-forwarded-for').split(',')[0]?.trim()
        || (typeof event?.clientIp === 'string' ? event.clientIp.trim() : '')
        || '';
}

function allowedOrigins(env = process.env) {
    const raw = readEnv('ALLOWED_ORIGINS', env) || '';
    const configured = raw
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isAllowedOrigin(origin, env = process.env) {
    return !origin || allowedOrigins(env).has(origin) || DEPLOY_PREVIEW_ORIGIN.test(origin);
}

function corsHeaders(event, env = process.env) {
    const origin = getHeader(event, 'origin');
    if (origin && isAllowedOrigin(origin, env)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        };
    }
    return {};
}

function responseHeaders(event, extraHeaders = {}, env = process.env) {
    return {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        'Vary': 'Authorization, Origin',
        ...corsHeaders(event, env),
        ...extraHeaders,
    };
}

function publicResponseHeaders(event, extraHeaders = {}, env = process.env) {
    return {
        'Content-Type': 'application/json',
        'Vary': 'Origin',
        ...corsHeaders(event, env),
        ...extraHeaders,
    };
}

function jsonResponse(event, statusCode, message, extraHeaders = {}, extraBody = {}, env = process.env) {
    return {
        statusCode,
        headers: responseHeaders(event, extraHeaders, env),
        body: JSON.stringify({ error: message, ...extraBody }),
    };
}

function hashIdentifier(value) {
    return crypto.createHash('sha256').update(String(value)).digest('hex').slice(0, 32);
}

function parseAllowList(env = process.env) {
    const rawEmails = readEnv('ALLOWED_SIGNIN_EMAILS', env) || '';
    const rawDomains = readEnv('ALLOWED_SIGNIN_DOMAINS', env) || '';
    const emails = new Set(
        String(rawEmails)
            .split(',')
            .map(entry => entry.trim().toLowerCase())
            .filter(Boolean)
    );
    const domains = new Set(
        String(rawDomains)
            .split(',')
            .map(entry => entry.trim().toLowerCase().replace(/^@/, ''))
            .filter(Boolean)
    );
    return {
        emails,
        domains,
        enabled: emails.size > 0 || domains.size > 0,
    };
}

function isEmailAllowed(userEmail, allowList) {
    if (!allowList?.enabled) return true;
    if (typeof userEmail !== 'string') return false;
    const normalized = userEmail.trim().toLowerCase();
    if (!normalized || /\s/.test(normalized)) return false;
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex <= 0 || atIndex === normalized.length - 1 || normalized.indexOf('@') !== atIndex) {
        return false;
    }
    const domain = normalized.slice(atIndex + 1);
    return allowList.emails.has(normalized) || allowList.domains.has(domain);
}

function pruneBadTokenBuckets(now, cutoff) {
    if (badTokenBuckets.size <= MAX_TRACKED_BAD_TOKENS) return;
    if (now - lastBadTokenPrunedAt < PRUNE_INTERVAL_MS) {
        while (badTokenBuckets.size > MAX_TRACKED_BAD_TOKENS) {
            const oldestKey = badTokenBuckets.keys().next().value;
            if (oldestKey === undefined) break;
            badTokenBuckets.delete(oldestKey);
        }
        return;
    }
    lastBadTokenPrunedAt = now;
    for (const [key, timestamps] of badTokenBuckets.entries()) {
        const active = timestamps.filter(ts => ts > cutoff);
        if (active.length === 0) badTokenBuckets.delete(key);
        else badTokenBuckets.set(key, active);
    }
}

function countRecentBadToken(bucketKey, now = Date.now()) {
    const cutoff = now - RATE_WINDOW_MS;
    const recent = (badTokenBuckets.get(bucketKey) || []).filter(timestamp => timestamp > cutoff);
    if (recent.length === 0) badTokenBuckets.delete(bucketKey);
    else badTokenBuckets.set(bucketKey, recent);
    return recent.length;
}

function recordBadToken(bucketKey, now = Date.now()) {
    const cutoff = now - RATE_WINDOW_MS;
    pruneBadTokenBuckets(now, cutoff);
    const recent = (badTokenBuckets.get(bucketKey) || []).filter(timestamp => timestamp > cutoff);
    recent.push(now);
    badTokenBuckets.set(bucketKey, recent);
}

function resolveDeployContext({ context = null, env = process.env } = {}) {
    if (context?.deploy?.published === false) {
        return 'deploy-preview';
    }
    if (typeof context?.deploy?.context === 'string' && context.deploy.context.trim()) {
        return context.deploy.context.trim().toLowerCase();
    }
    if (typeof context?.deploy?.published === 'boolean') {
        return context.deploy.published ? 'production' : 'deploy-preview';
    }
    const rawContext = readEnv('CONTEXT', env);
    if (typeof rawContext === 'string' && rawContext.trim()) {
        return rawContext.trim().toLowerCase();
    }
    return 'non-production';
}

function isProductionContext(options = {}) {
    return resolveDeployContext(options) === 'production';
}

function resolveRateLimitStore({
    context = null,
    env = process.env,
    store = null,
    getStoreFn = null,
    getDeployStoreFn = null,
} = {}) {
    if (store) return store;
    const factory = isProductionContext({ context, env }) ? getStoreFn : getDeployStoreFn;
    if (typeof factory !== 'function') {
        throw new Error('MissingBlobsStoreFactoryError');
    }
    return factory(RATE_LIMIT_STORE_NAME);
}

function resolveDailyCap(capEnvName, defaultCap, env = process.env) {
    if (!capEnvName) {
        return defaultCap === undefined ? undefined : defaultCap;
    }
    const raw = readEnv(capEnvName, env);
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return defaultCap;
    }
    const trimmed = String(raw).trim();
    if (!/^\d+$/.test(trimmed)) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isSafeInteger(parsed) ? parsed : null;
}

function secondsUntilNextUtcMidnight(now) {
    const current = new Date(now);
    const nextMidnight = Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate() + 1);
    return Math.max(1, Math.ceil((nextMidnight - now) / 1000));
}

async function readBoundedBody(requestOrEvent, maxBytes) {
    if (!Number.isFinite(maxBytes) || maxBytes < 0) {
        return { ok: true, bodyText: '' };
    }

    const rawLengthHeader = getHeader(requestOrEvent, 'content-length');
    if (rawLengthHeader) {
        const declaredLength = Number(String(rawLengthHeader).trim());
        if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
            return { ok: false, statusCode: 413, message: 'Request body is too large.' };
        }
    }

    if (isWebRequest(requestOrEvent)) {
        if (!requestOrEvent.body) {
            return { ok: true, bodyText: '' };
        }
        const reader = requestOrEvent.body.getReader();
        const chunks = [];
        let totalBytes = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
                totalBytes += chunk.byteLength;
                if (totalBytes > maxBytes) {
                    await reader.cancel().catch(() => {});
                    return { ok: false, statusCode: 413, message: 'Request body is too large.' };
                }
                chunks.push(Buffer.from(chunk));
            }
            return { ok: true, bodyText: Buffer.concat(chunks, totalBytes).toString('utf8') };
        } catch {
            return { ok: false, statusCode: 400, message: 'Could not read request body.' };
        }
    }

    const rawBody = requestOrEvent?.body;
    if (rawBody === undefined || rawBody === null) {
        return { ok: true, bodyText: '' };
    }
    if (typeof rawBody !== 'string') {
        const encoded = Buffer.from(JSON.stringify(rawBody), 'utf8');
        if (encoded.byteLength > maxBytes) {
            return { ok: false, statusCode: 413, message: 'Request body is too large.' };
        }
        return { ok: true, bodyText: encoded.toString('utf8') };
    }
    if (requestOrEvent?.isBase64Encoded) {
        const decoded = Buffer.from(rawBody, 'base64');
        if (decoded.byteLength > maxBytes) {
            return { ok: false, statusCode: 413, message: 'Request body is too large.' };
        }
        return { ok: true, bodyText: decoded.toString('utf8') };
    }
    if (Buffer.byteLength(rawBody, 'utf8') > maxBytes) {
        return { ok: false, statusCode: 413, message: 'Request body is too large.' };
    }
    return { ok: true, bodyText: rawBody };
}

async function protectEndpoint(
    eventOrRequest,
    {
        methods = ['POST'],
        maxRequests = 20,
        scope,
        context = null,
        dailyCapEnv,
        defaultDailyCap,
        maxBodyBytes,
        env = process.env,
        store = null,
        getStoreFn = null,
        getDeployStoreFn = null,
        nowFn = Date.now,
    } = {},
) {
    const event = toLegacyEvent(eventOrRequest, context);
    const reply = (statusCode, message, extraHeaders = {}, extraBody = {}) => (
        jsonResponse(event, statusCode, message, extraHeaders, extraBody, env)
    );
    const origin = getHeader(event, 'origin');
    if (!isAllowedOrigin(origin, env)) {
        return { response: reply(403, 'Origin not allowed.') };
    }

    if (event.httpMethod === 'OPTIONS') {
        return { response: { statusCode: 204, headers: responseHeaders(event, {}, env), body: '' } };
    }

    if (!methods.includes(event.httpMethod)) {
        return { response: reply(405, 'Method not allowed.') };
    }

    const authorization = getHeader(event, 'authorization');
    const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!tokenMatch || tokenMatch[1].length > 4096) {
        return { response: reply(401, 'Sign in to use this service.') };
    }

    const now = nowFn();
    const token = tokenMatch[1];
    const badTokenKey = `badtoken:${hashIdentifier(token)}`;
    if (countRecentBadToken(badTokenKey, now) >= BAD_TOKEN_MAX_CHECKS) {
        return { response: reply(401, 'Your session is invalid or expired. Please sign in again.') };
    }

    const bucketScope = scope || event.path || 'protected';
    const clientIp = getClientIp(event);

    const supabaseUrl = readEnv('SUPABASE_URL', env);
    const publishableKey = readEnv('SUPABASE_PUBLISHABLE_KEY', env) || readEnv('SUPABASE_ANON_KEY', env);
    if (!supabaseUrl || !publishableKey) {
        return { response: reply(503, 'Authentication service is not configured.') };
    }

    let authResponse;
    try {
        authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
            signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
            headers: {
                apikey: publishableKey,
                Authorization: `Bearer ${token}`,
            },
        });
    } catch {
        return { response: reply(503, 'Authentication service is temporarily unavailable.') };
    }

    if (!authResponse.ok) {
        recordBadToken(badTokenKey, now);
        return { response: reply(401, 'Your session is invalid or expired. Please sign in again.') };
    }

    let user;
    try {
        user = await authResponse.json();
    } catch {
        return { response: reply(503, 'Authentication service returned an unreadable response.') };
    }
    if (!user?.id) {
        recordBadToken(badTokenKey, now);
        return { response: reply(401, 'The authenticated user response is invalid.') };
    }

    const allowList = parseAllowList(env);
    const hasConfirmedEmail = Boolean(user.email_confirmed_at || user.confirmed_at);
    if (allowList.enabled && (!hasConfirmedEmail || !isEmailAllowed(user.email, allowList))) {
        console.warn('[security] Allow-list denied access', {
            userHash: hashIdentifier(user.id),
            scope: bucketScope,
        });
        return {
            response: reply(
                403,
                ACCOUNT_NOT_ALLOWED_MESSAGE,
                {},
                { code: 'account_not_allowed' },
            ),
        };
    }

    let rawBody;
    if (maxBodyBytes !== undefined && !['GET', 'HEAD', 'OPTIONS'].includes(event.httpMethod)) {
        const bodyResult = await readBoundedBody(eventOrRequest, maxBodyBytes);
        if (!bodyResult.ok) {
            return { response: reply(bodyResult.statusCode, bodyResult.message) };
        }
        rawBody = bodyResult.bodyText;
    }

    const hasDailyCap = Boolean(dailyCapEnv) || defaultDailyCap !== undefined;
    const dailyCap = hasDailyCap ? resolveDailyCap(dailyCapEnv, defaultDailyCap, env) : undefined;
    if (hasDailyCap && dailyCap === null) {
        console.error(`[security] Invalid integer value configured for ${dailyCapEnv || 'dailyCap'}`);
        return { response: reply(503, 'Service limit configuration is invalid.') };
    }

    let rateStore;
    try {
        rateStore = resolveRateLimitStore({ context, env, store, getStoreFn, getDeployStoreFn });
    } catch (error) {
        console.error(`[security] Rate-limit store initialization failed (${bucketScope}):`, error?.name || 'Error');
        return { response: reply(503, 'Rate limit service is temporarily unavailable. Please try again later.') };
    }

    const cutoff = now - RATE_WINDOW_MS;
    const windowId = Math.floor(now / RATE_WINDOW_MS);
    const utcDate = new Date(now).toISOString().slice(0, 10);

    const userKey = `user/${bucketScope}/${hashIdentifier(user.id)}`;
    const ipKey = clientIp ? `ip/${bucketScope}/${hashIdentifier(clientIp)}` : null;
    const dailyKey = hasDailyCap ? `daily/${bucketScope}/${utcDate}` : null;

    let userDoc;
    let ipDoc;
    let dailyDoc;
    try {
        [userDoc, ipDoc, dailyDoc] = await Promise.all([
            rateStore.get(userKey, { type: 'json', consistency: 'strong' }),
            ipKey ? rateStore.get(ipKey, { type: 'json', consistency: 'strong' }) : Promise.resolve(null),
            dailyKey ? rateStore.get(dailyKey, { type: 'json', consistency: 'strong' }) : Promise.resolve(null),
        ]);
    } catch (error) {
        console.error(`[security] Rate-limit store read failed (${bucketScope}):`, error?.name || 'Error');
        return { response: reply(503, 'Rate limit service is temporarily unavailable. Please try again later.') };
    }

    const currentDailyCount = (dailyDoc?.date === utcDate && Number.isFinite(dailyDoc?.count) && dailyDoc.count >= 0)
        ? dailyDoc.count
        : 0;
    if (hasDailyCap && currentDailyCount >= dailyCap) {
        return {
            response: reply(
                429,
                'Daily usage limit reached for this service. Please try again tomorrow.',
                { 'Retry-After': String(secondsUntilNextUtcMidnight(now)) },
            ),
        };
    }

    const activeUserTimestamps = Array.isArray(userDoc?.timestamps)
        ? userDoc.timestamps.filter(ts => Number.isFinite(ts) && ts > cutoff)
        : [];
    if (activeUserTimestamps.length >= maxRequests) {
        return {
            response: reply(
                429,
                'Rate limit exceeded. Try again in a few minutes.',
                { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) },
            ),
        };
    }

    // Classroom-safe network ceiling counted only after authentication succeeds
    // so shared school NAT IPs (30+ students) and invalid Bearer attempts never lock out a class.
    const ipCeiling = Math.max(maxRequests * 40, 600);
    const currentIpCount = (ipDoc?.windowId === windowId && Number.isFinite(ipDoc?.count) && ipDoc.count >= 0)
        ? ipDoc.count
        : 0;
    if (ipKey && currentIpCount >= ipCeiling) {
        return {
            response: reply(
                429,
                'Network rate limit exceeded. Try again in a few minutes.',
                { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) },
            ),
        };
    }

    const nowIso = new Date(now).toISOString();
    try {
        const writes = [
            rateStore.setJSON(userKey, { timestamps: [...activeUserTimestamps, now], updatedAt: nowIso }),
        ];
        if (ipKey) {
            writes.push(rateStore.setJSON(ipKey, { windowId, count: currentIpCount + 1, updatedAt: nowIso }));
        }
        if (dailyKey) {
            writes.push(rateStore.setJSON(dailyKey, { date: utcDate, count: currentDailyCount + 1, updatedAt: nowIso }));
        }
        await Promise.all(writes);
    } catch (error) {
        console.error(`[security] Rate-limit store write failed (${bucketScope}):`, error?.name || 'Error');
        return { response: reply(503, 'Rate limit service is temporarily unavailable. Please try again later.') };
    }

    return {
        user,
        headers: responseHeaders(event, {}, env),
        ...(rawBody !== undefined ? { rawBody } : {}),
    };
}

function protectPublicEndpoint(event, { methods = ['GET'] } = {}) {
    const origin = getHeader(event, 'origin');
    if (!isAllowedOrigin(origin)) {
        return { response: jsonResponse(event, 403, 'Origin not allowed.') };
    }
    if (event.httpMethod === 'OPTIONS') {
        return { response: { statusCode: 204, headers: publicResponseHeaders(event), body: '' } };
    }
    if (!methods.includes(event.httpMethod)) {
        return { response: jsonResponse(event, 405, 'Method not allowed.') };
    }
    return { headers: publicResponseHeaders(event) };
}

function protectBackgroundCron(eventOrRequest, { secret = process.env.CRON_SECRET } = {}) {
    const method = typeof eventOrRequest?.method === 'string'
        ? eventOrRequest.method
        : eventOrRequest?.httpMethod;
    if (method !== 'POST') {
        return { ok: false, status: 405, message: 'Method not allowed.' };
    }
    const configuredSecret = typeof secret === 'string' ? secret.trim() : '';
    if (configuredSecret.length < 16) {
        return { ok: false, status: 503, message: 'Background worker secret not configured.' };
    }
    const provided = typeof eventOrRequest?.headers?.get === 'function'
        ? (eventOrRequest.headers.get('x-cron-secret') || '')
        : getHeader(eventOrRequest, 'x-cron-secret');
    const expectedBuf = Buffer.from(configuredSecret, 'utf8');
    const providedBuf = Buffer.from(String(provided || ''), 'utf8');
    if (expectedBuf.length !== providedBuf.length || !crypto.timingSafeEqual(expectedBuf, providedBuf)) {
        return { ok: false, status: 403, message: 'Forbidden.' };
    }
    return { ok: true };
}

module.exports = {
    RATE_LIMIT_STORE_NAME,
    RATE_WINDOW_MS,
    ACCOUNT_NOT_ALLOWED_MESSAGE,
    readEnv,
    hashIdentifier,
    parseAllowList,
    isEmailAllowed,
    isAllowedOrigin,
    responseHeaders,
    publicResponseHeaders,
    toLegacyEvent,
    toResponse,
    resolveDeployContext,
    isProductionContext,
    resolveRateLimitStore,
    resolveDailyCap,
    readBoundedBody,
    protectEndpoint,
    protectPublicEndpoint,
    protectBackgroundCron,
};

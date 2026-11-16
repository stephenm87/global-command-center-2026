const crypto = require('node:crypto');

const RATE_WINDOW_MS = 15 * 60 * 1000;
const AUTH_TIMEOUT_MS = 5000;
const MAX_TRACKED_BUCKETS = 2000;
const PRUNE_INTERVAL_MS = 60 * 1000;
const BAD_TOKEN_MAX_CHECKS = 3;
const DEFAULT_ALLOWED_ORIGINS = [
    'https://globalcommandcenter2026.netlify.app',
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:8888',
    'http://127.0.0.1:8888',
];
const DEPLOY_PREVIEW_ORIGIN = /^https:\/\/deploy-preview-\d+--globalcommandcenter2026\.netlify\.app$/;

const requestBuckets = new Map();
let lastPrunedAt = 0;

function getHeader(event, name) {
    const headers = event?.headers || {};
    return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function getClientIp(event) {
    return getHeader(event, 'x-nf-client-connection-ip')
        || getHeader(event, 'client-ip')
        || getHeader(event, 'x-forwarded-for').split(',')[0]?.trim()
        || '';
}

function allowedOrigins() {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function isAllowedOrigin(origin) {
    return !origin || allowedOrigins().has(origin) || DEPLOY_PREVIEW_ORIGIN.test(origin);
}

function corsHeaders(event) {
    const origin = getHeader(event, 'origin');
    if (origin && isAllowedOrigin(origin)) {
        return {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Headers': 'Authorization, Content-Type',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        };
    }
    return {};
}

function responseHeaders(event, extraHeaders = {}) {
    return {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        'Vary': 'Authorization, Origin',
        ...corsHeaders(event),
        ...extraHeaders,
    };
}

function publicResponseHeaders(event, extraHeaders = {}) {
    return {
        'Content-Type': 'application/json',
        'Vary': 'Origin',
        ...corsHeaders(event),
        ...extraHeaders,
    };
}

function jsonResponse(event, statusCode, message, extraHeaders = {}) {
    return {
        statusCode,
        headers: responseHeaders(event, extraHeaders),
        body: JSON.stringify({ error: message }),
    };
}

function pruneBucketsIfNeeded(now, cutoff) {
    if (requestBuckets.size <= MAX_TRACKED_BUCKETS) return;
    if (now - lastPrunedAt < PRUNE_INTERVAL_MS) {
        while (requestBuckets.size > MAX_TRACKED_BUCKETS) {
            const oldestKey = requestBuckets.keys().next().value;
            if (oldestKey === undefined) break;
            requestBuckets.delete(oldestKey);
        }
        return;
    }
    lastPrunedAt = now;
    for (const [key, timestamps] of requestBuckets.entries()) {
        const active = timestamps.filter(ts => ts > cutoff);
        if (active.length === 0) requestBuckets.delete(key);
        else requestBuckets.set(key, active);
    }
}

function countRecent(bucketKey, now = Date.now()) {
    const cutoff = now - RATE_WINDOW_MS;
    const recent = (requestBuckets.get(bucketKey) || []).filter(timestamp => timestamp > cutoff);
    if (recent.length === 0) requestBuckets.delete(bucketKey);
    else requestBuckets.set(bucketKey, recent);
    return recent.length;
}

function rateLimit(bucketKey, maxRequests) {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    pruneBucketsIfNeeded(now, cutoff);

    const recent = (requestBuckets.get(bucketKey) || []).filter(timestamp => timestamp > cutoff);
    if (recent.length >= maxRequests) {
        requestBuckets.set(bucketKey, recent);
        return false;
    }

    recent.push(now);
    requestBuckets.set(bucketKey, recent);
    return true;
}

function hashToken(token) {
    return crypto.createHash('sha256').update(token).digest('hex').slice(0, 16);
}

async function protectEndpoint(event, { methods = ['POST'], maxRequests = 20, scope } = {}) {
    const origin = getHeader(event, 'origin');
    if (!isAllowedOrigin(origin)) {
        return { response: jsonResponse(event, 403, 'Origin not allowed.') };
    }

    if (event.httpMethod === 'OPTIONS') {
        return { response: { statusCode: 204, headers: responseHeaders(event), body: '' } };
    }

    if (!methods.includes(event.httpMethod)) {
        return { response: jsonResponse(event, 405, 'Method not allowed.') };
    }

    const authorization = getHeader(event, 'authorization');
    const tokenMatch = authorization.match(/^Bearer\s+(\S+)$/i);
    if (!tokenMatch || tokenMatch[1].length > 4096) {
        return { response: jsonResponse(event, 401, 'Sign in to use this service.') };
    }

    const token = tokenMatch[1];
    const badTokenKey = `badtoken:${hashToken(token)}`;
    if (countRecent(badTokenKey) >= BAD_TOKEN_MAX_CHECKS) {
        return { response: jsonResponse(event, 401, 'Your session is invalid or expired. Please sign in again.') };
    }

    const bucketScope = scope || event.path || 'protected';
    const clientIp = getClientIp(event);

    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publishableKey) {
        return { response: jsonResponse(event, 503, 'Authentication service is not configured.') };
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
        return { response: jsonResponse(event, 503, 'Authentication service is temporarily unavailable.') };
    }

    if (!authResponse.ok) {
        rateLimit(badTokenKey, BAD_TOKEN_MAX_CHECKS + 1);
        return { response: jsonResponse(event, 401, 'Your session is invalid or expired. Please sign in again.') };
    }

    const user = await authResponse.json();
    if (!user.id) {
        rateLimit(badTokenKey, BAD_TOKEN_MAX_CHECKS + 1);
        return { response: jsonResponse(event, 401, 'The authenticated user response is invalid.') };
    }

    if (!rateLimit(`user:${bucketScope}:${user.id}`, maxRequests)) {
        return {
            response: jsonResponse(
                event,
                429,
                'Rate limit exceeded. Try again in a few minutes.',
                { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) }
            ),
        };
    }

    // Classroom-safe network ceiling counted only after authentication succeeds
    // so shared school NAT IPs (30+ students) and invalid Bearer attempts never lock out a class.
    if (clientIp && !rateLimit(`ip:${bucketScope}:${clientIp}`, Math.max(maxRequests * 40, 600))) {
        return {
            response: jsonResponse(
                event,
                429,
                'Network rate limit exceeded. Try again in a few minutes.',
                { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) }
            ),
        };
    }

    return { user, headers: responseHeaders(event) };
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
    isAllowedOrigin,
    responseHeaders,
    publicResponseHeaders,
    protectEndpoint,
    protectPublicEndpoint,
    protectBackgroundCron,
};

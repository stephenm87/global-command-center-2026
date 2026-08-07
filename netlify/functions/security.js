const RATE_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_ALLOWED_ORIGINS = [
    'https://globalcommandcenter2026.netlify.app',
    'http://localhost:5173',
    'http://localhost:8888',
];

const requestBuckets = new Map();

function getHeader(event, name) {
    const headers = event.headers || {};
    return headers[name] || headers[name.toLowerCase()] || headers[name.toUpperCase()] || '';
}

function allowedOrigins() {
    const configured = (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
    return new Set([...DEFAULT_ALLOWED_ORIGINS, ...configured]);
}

function responseHeaders(event) {
    const origin = getHeader(event, 'origin');
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'private, no-store',
        'Vary': 'Authorization, Origin',
    };

    if (origin && allowedOrigins().has(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Headers'] = 'Authorization, Content-Type';
        headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS';
    }

    return headers;
}

function jsonResponse(event, statusCode, message, extraHeaders = {}) {
    return {
        statusCode,
        headers: { ...responseHeaders(event), ...extraHeaders },
        body: JSON.stringify({ error: message }),
    };
}

function rateLimit(userId, maxRequests) {
    const now = Date.now();
    const cutoff = now - RATE_WINDOW_MS;
    const recent = (requestBuckets.get(userId) || []).filter(timestamp => timestamp > cutoff);

    if (recent.length >= maxRequests) {
        requestBuckets.set(userId, recent);
        return false;
    }

    recent.push(now);
    requestBuckets.set(userId, recent);
    return true;
}

async function protectEndpoint(event, { methods = ['POST'], maxRequests = 20 } = {}) {
    const origin = getHeader(event, 'origin');
    if (origin && !allowedOrigins().has(origin)) {
        return { response: jsonResponse(event, 403, 'Origin not allowed.') };
    }

    if (event.httpMethod === 'OPTIONS') {
        return { response: { statusCode: 204, headers: responseHeaders(event), body: '' } };
    }

    if (!methods.includes(event.httpMethod)) {
        return { response: jsonResponse(event, 405, 'Method not allowed.') };
    }

    const authorization = getHeader(event, 'authorization');
    const tokenMatch = authorization.match(/^Bearer\s+(.+)$/i);
    if (!tokenMatch) {
        return { response: jsonResponse(event, 401, 'Sign in to use this service.') };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!supabaseUrl || !publishableKey) {
        return { response: jsonResponse(event, 503, 'Authentication service is not configured.') };
    }

    let authResponse;
    try {
        authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
            headers: {
                apikey: publishableKey,
                Authorization: `Bearer ${tokenMatch[1]}`,
            },
        });
    } catch {
        return { response: jsonResponse(event, 503, 'Authentication service is temporarily unavailable.') };
    }

    if (!authResponse.ok) {
        return { response: jsonResponse(event, 401, 'Your session is invalid or expired. Please sign in again.') };
    }

    const user = await authResponse.json();
    if (!user.id) {
        return { response: jsonResponse(event, 401, 'The authenticated user response is invalid.') };
    }

    if (!rateLimit(user.id, maxRequests)) {
        return {
            response: jsonResponse(
                event,
                429,
                'Rate limit exceeded. Try again in a few minutes.',
                { 'Retry-After': String(Math.ceil(RATE_WINDOW_MS / 1000)) }
            ),
        };
    }

    return { user };
}

module.exports = { protectEndpoint };

/**
 * gemini-retry.js — Shared retry wrapper for Gemini API calls.
 * Retries on 429 (rate limit) and 503 (overloaded) within Netlify's synchronous gateway budget (<22s).
 */

const RETRYABLE_STATUSES = [429, 503];
const MAX_RETRIES = 1;
const INITIAL_DELAY_MS = 800;
const MAX_RETRY_DELAY_MS = 2500;
const REQUEST_TIMEOUT_MS = 9000;
const DEADLINE_MS = 21500;

async function fetchWithTimeout(url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

/**
 * Calls a Gemini API endpoint with bounded automatic retry on 429/503.
 * @param {string} url - Gemini API URL (pass API key via options.headers['x-goog-api-key'])
 * @param {object|string} body - Request body to JSON.stringify
 * @param {object} [options] - Optional overrides: { maxRetries, headers, fallbackUrl, timeoutMs, deadlineMs }
 * @returns {Promise<Response>} - The fetch Response
 */
async function callGeminiWithRetry(url, body, options = {}) {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const fallbackUrl = options.fallbackUrl ?? null;
    const baseTimeoutMs = options.timeoutMs ?? REQUEST_TIMEOUT_MS;
    const deadline = options.deadlineAt ?? (Date.now() + (options.deadlineMs ?? DEADLINE_MS));
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const remainingBeforeAttempt = deadline - Date.now();
        const attemptTimeout = Math.max(1000, Math.min(baseTimeoutMs, remainingBeforeAttempt));
        const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: bodyStr
        }, attemptTimeout);

        if (res.ok || !RETRYABLE_STATUSES.includes(res.status)) {
            return res;
        }

        if (attempt < maxRetries) {
            const retryAfter = Number(res.headers?.get?.('Retry-After'));
            const rawDelay = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : INITIAL_DELAY_MS * Math.pow(2, attempt) + Math.random() * 250;
            const delay = Math.min(rawDelay, MAX_RETRY_DELAY_MS);
            if (deadline - Date.now() - delay < 1500) {
                return res;
            }
            console.log(`[gemini-retry] ${res.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${Math.round(delay)}ms...`);
            await new Promise(r => setTimeout(r, delay));
        } else {
            const remainingForFallback = deadline - Date.now();
            if (fallbackUrl && remainingForFallback >= 2000) {
                console.log(`[gemini-retry] Primary model exhausted (${res.status}). Falling back within ${remainingForFallback}ms...`);
                const fallbackRes = await fetchWithTimeout(fallbackUrl, {
                    method: 'POST',
                    headers,
                    body: bodyStr
                }, Math.min(baseTimeoutMs, remainingForFallback));
                console.log(`[gemini-retry] Fallback model returned ${fallbackRes.status}.`);
                return fallbackRes;
            }
            console.log(`[gemini-retry] ${res.status} after ${maxRetries + 1} attempts, giving up.`);
            return res;
        }
    }
}

const _retryConfig = {
    MAX_RETRIES,
    INITIAL_DELAY_MS,
    MAX_RETRY_DELAY_MS,
    REQUEST_TIMEOUT_MS,
    DEADLINE_MS
};

module.exports = { callGeminiWithRetry, fetchWithTimeout, _retryConfig };

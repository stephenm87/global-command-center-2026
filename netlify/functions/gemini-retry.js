/**
 * gemini-retry.js — Shared retry wrapper for Gemini API calls.
 * Retries on 429 (rate limit) and 503 (overloaded) with exponential backoff.
 */
// Node 18+ has native fetch — no polyfill needed

const RETRYABLE_STATUSES = [429, 503];
const MAX_RETRIES = 2;
const INITIAL_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 15000;

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
 * Calls a Gemini API endpoint with automatic retry on 429/503.
 * @param {string} url - Full Gemini API URL (including ?key=...)
 * @param {object} body - Request body to JSON.stringify
 * @param {object} [options] - Optional overrides: { maxRetries, headers, fallbackUrl }
 * @returns {Promise<Response>} - The successful fetch Response
 */
async function callGeminiWithRetry(url, body, options = {}) {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const headers = options.headers ?? { 'Content-Type': 'application/json' };
    const fallbackUrl = options.fallbackUrl ?? null;
    const bodyStr = typeof body === 'string' ? body : JSON.stringify(body);

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers,
            body: bodyStr
        });

        if (res.ok || !RETRYABLE_STATUSES.includes(res.status)) {
            return res;
        }

        // Retryable error
        if (attempt < maxRetries) {
            const retryAfter = Number(res.headers?.get?.('Retry-After'));
            const delay = Number.isFinite(retryAfter) && retryAfter > 0
                ? Math.min(retryAfter * 1000, 10000)
                : INITIAL_DELAY_MS * Math.pow(2, attempt) + Math.random() * 400;
            console.log(`[gemini-retry] ${res.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        } else {
            if (fallbackUrl) {
                console.log(`[gemini-retry] Primary model exhausted (${res.status}). Falling back to flash model...`);
                const fallbackRes = await fetchWithTimeout(fallbackUrl, {
                    method: 'POST',
                    headers,
                    body: bodyStr
                });
                console.log(`[gemini-retry] Fallback model returned ${fallbackRes.status}.`);
                return fallbackRes;
            }
            console.log(`[gemini-retry] ${res.status} after ${maxRetries + 1} attempts, giving up.`);
            return res;
        }
    }
}

module.exports = { callGeminiWithRetry, fetchWithTimeout };

/**
 * gemini-retry.js — Shared retry wrapper for Gemini API calls.
 * Retries on 429 (rate limit) and 503 (overloaded) with exponential backoff.
 */
// Node 18+ has native fetch — no polyfill needed

const RETRYABLE_STATUSES = [429, 503];
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1500;

/**
 * Calls a Gemini API endpoint with automatic retry on 429/503.
 * @param {string} url - Full Gemini API URL (including ?key=...)
 * @param {object} body - Request body to JSON.stringify
 * @param {object} [options] - Optional overrides: { maxRetries, headers }
 * @returns {Promise<Response>} - The successful fetch Response
 */
async function callGeminiWithRetry(url, body, options = {}) {
    const maxRetries = options.maxRetries ?? MAX_RETRIES;
    const headers = options.headers ?? { 'Content-Type': 'application/json' };

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        const res = await fetch(url, {
            method: 'POST',
            headers,
            body: typeof body === 'string' ? body : JSON.stringify(body)
        });

        if (res.ok || !RETRYABLE_STATUSES.includes(res.status)) {
            return res;
        }

        // Retryable error
        if (attempt < maxRetries) {
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
            console.log(`[gemini-retry] ${res.status} on attempt ${attempt + 1}/${maxRetries + 1}, retrying in ${delay}ms...`);
            await new Promise(r => setTimeout(r, delay));
        } else {
            console.log(`[gemini-retry] ${res.status} after ${maxRetries + 1} attempts, giving up.`);
            return res;
        }
    }
}

module.exports = { callGeminiWithRetry };

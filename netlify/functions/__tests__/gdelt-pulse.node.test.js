const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

async function loadGdeltModule() {
    const modPath = pathToFileURL(path.resolve(__dirname, '../gdelt-pulse.mjs')).href;
    return import(modPath);
}

test('gdelt-pulse rejects unsupported HTTP methods and unapproved browser origins while allowing same-origin GETs', async () => {
    const { createGdeltPulseHandler } = await loadGdeltModule();
    const handler = createGdeltPulseHandler({
        fetchImpl: async () => new Response(JSON.stringify({ articles: [] }), { status: 200 }),
    });

    const postRes = await handler(new Request('http://localhost:8888/.netlify/functions/gdelt-pulse', { method: 'POST' }));
    assert.equal(postRes.status, 405);

    const evilOriginRes = await handler(
        new Request('http://localhost:8888/.netlify/functions/gdelt-pulse', {
            method: 'GET',
            headers: { origin: 'https://attacker.example' },
        })
    );
    assert.equal(evilOriginRes.status, 403);

    const sameOriginNoHeaderRes = await handler(new Request('http://localhost:8888/.netlify/functions/gdelt-pulse?topic=2'));
    assert.equal(sameOriginNoHeaderRes.status, 200);
});

test('gdelt-pulse clamps topic index, strips non-HTTP(S) article URLs, and uses short cache TTL on upstream errors', async () => {
    const { createGdeltPulseHandler } = await loadGdeltModule();
    let requestedUpstream = '';

    const okHandler = createGdeltPulseHandler({
        fetchImpl: async url => {
            requestedUpstream = String(url);
            return new Response(
                JSON.stringify({
                    articles: [
                        { title: 'Safe HTTPS story', url: 'https://example.org/story-1', domain: 'example.org', tone: '-3.5' },
                        { title: 'XSS attempt', url: 'javascript:alert(1)', domain: 'evil.test', tone: '0' },
                        { title: 'Data URI attempt', url: 'data:text/html,<script>alert(1)</script>', domain: 'evil.test', tone: '0' },
                    ],
                }),
                { status: 200 }
            );
        },
    });

    const okRes = await okHandler(new Request('http://localhost:8888/.netlify/functions/gdelt-pulse?topic=-9'));
    assert.equal(okRes.status, 200);
    assert.ok(requestedUpstream.includes('Russia%20NATO%20military'), 'Expected negative topic -9 to clamp via abs % 8 -> index 1');
    const okJson = await okRes.json();
    assert.equal(okJson.topicIndex, 1);
    assert.equal(okJson.articles.length, 1, 'Expected javascript: and data: URLs to be stripped');
    assert.equal(okJson.articles[0].url, 'https://example.org/story-1');
    assert.match(okRes.headers.get('netlify-cdn-cache-control') || '', /stale-while-revalidate=1800/);

    const errHandler = createGdeltPulseHandler({
        fetchImpl: async () => new Response('Rate limited', { status: 429 }),
    });
    const errRes = await errHandler(new Request('http://localhost:8888/.netlify/functions/gdelt-pulse?topic=0'));
    assert.equal(errRes.status, 200);
    const errJson = await errRes.json();
    assert.equal(errJson.status, 'upstream-error');
    assert.equal(errRes.headers.get('netlify-cdn-cache-control'), 'public, max-age=30', 'Upstream outage must not be CDN-cached for 35 minutes');

    const timeoutHandler = createGdeltPulseHandler({
        fetchImpl: async () => {
            const err = new Error('Timed out');
            err.name = 'TimeoutError';
            throw err;
        },
    });
    const timeoutRes = await timeoutHandler(new Request('http://localhost:8888/.netlify/functions/gdelt-pulse?topic=0'));
    const timeoutJson = await timeoutRes.json();
    assert.equal(timeoutJson.status, 'unavailable');
    assert.equal(timeoutRes.headers.get('netlify-cdn-cache-control'), 'public, max-age=30');
});

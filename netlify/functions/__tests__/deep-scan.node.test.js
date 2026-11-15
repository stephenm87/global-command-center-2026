const test = require('node:test');
const assert = require('node:assert/strict');

const { _test } = require('../deep-scan');

test('deep-scan preserves at least 15,000 characters including conclusion tail for downstream AI briefs', () => {
    assert.ok(_test, 'deep-scan should expose _test helpers');
    assert.ok(_test.MAX_SCRAPE_CONTENT_LENGTH >= 15000);

    const mediumArticle = `INTRO ${'x'.repeat(13000)} CONCLUSION_SECTION`;
    const preservedMedium = _test.selectScrapedMarkdown(mediumArticle);
    assert.equal(preservedMedium, mediumArticle);

    const longArticle = `LEAD_START ${'m'.repeat(20000)} FINAL_CONCLUSION_PARAGRAPH`;
    const preservedLong = _test.selectScrapedMarkdown(longArticle);
    assert.ok(preservedLong.length >= 12000, 'Selected markdown must feed ai-summary 12k window');
    assert.ok(preservedLong.length <= _test.MAX_SCRAPE_CONTENT_LENGTH + 80);
    assert.match(preservedLong, /^LEAD_START/);
    assert.match(preservedLong, /FINAL_CONCLUSION_PARAGRAPH$/);
});

test('deep-scan SSRF validator upgrades http:// to https:// and blocks private IPs, non-standard ports, and rebinding targets', async () => {
    assert.equal(_test.normalizeOutboundUrl('http://www.reuters.com/world/article'), 'https://www.reuters.com/world/article');
    assert.equal(_test.normalizeOutboundUrl('http://www.reuters.com:80/world/article'), 'https://www.reuters.com/world/article');
    assert.equal(_test.isValidUrl('https://www.reuters.com/world/article'), true);
    assert.equal(_test.isValidUrl('http://www.reuters.com/world/article'), true, 'http URLs upgrade cleanly to https');
    assert.equal(_test.isValidUrl('https://www.reuters.com:8443/world/article'), false, 'non-443 port must be rejected');
    assert.equal(_test.isValidUrl('ftp://www.reuters.com/world/article'), false, 'non-http(s) scheme must be rejected');
    assert.equal(_test.isValidUrl(['https://www.reuters.com/world/article']), false, 'non-string array must be rejected');
    assert.equal(_test.isValidUrl('https://127.0.0.1/secret'), false, 'loopback IPv4 literal must be rejected');
    assert.equal(_test.isValidUrl('https://198.18.0.1/secret'), false, 'benchmarking IPv4 range must be rejected');
    assert.equal(_test.isValidUrl('https://[::ffff:127.0.0.1]/secret'), false, 'IPv4-mapped loopback IPv6 literal must be rejected');
    assert.equal(_test.isValidUrl('https://[64:ff9b::7f00:1]/secret'), false, 'NAT64 IPv6 range must be rejected');
    assert.equal(_test.isValidUrl('https://127.0.0.1.nip.io/secret'), false, 'rebinding suffix must be rejected');
    assert.equal(_test.isValidUrl('https://user:pass@example.com/path'), false, 'embedded credentials must be rejected');

    const rebindingLookup = async () => [{ address: '169.254.169.254', family: 4 }];
    const publicLookup = async () => [{ address: '93.184.216.34', family: 4 }];

    assert.equal(await _test.validateOutboundUrl('https://evil.example.org/article', rebindingLookup), false);
    assert.equal(await _test.validateOutboundUrl('http://www.example.org/article', publicLookup), true);
});

const { normalizeProviderArticle } = require('./intel-normalization');
const {
    GDELT_FEED_QUERIES,
    INSTITUTIONAL_RSS_FEEDS,
    fetchGdeltQuery,
    fetchReliefWebReports,
    fetchRssFeed,
} = require('./free-feeds');

const SNAPSHOT_TTL_MS = 6 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 12000;
const MAX_SNAPSHOT_ITEMS = 20;
const MAX_PER_REGION = 4;
const MAX_PER_ISSUE = 4;
const MAX_PER_DOMAIN = 2;
const MAX_PER_INSTITUTIONAL_HUB = 12;
const MAX_PER_TOPIC_CLUSTER = 2;
const MAX_PER_SOURCE_ROLE = 8;
const MAX_PER_INSTITUTIONAL_ROLE = 14;
const MAX_DISCOVERY_SOURCES = 4;

const TARGET_REGIONS = Object.freeze([
    'Africa',
    'Asia-Pacific',
    'Middle East & North Africa',
    'Europe & Eurasia',
    'Americas & Caribbean',
    'Pacific Islands',
    'Global / Transnational',
]);

const TARGET_ISSUES = Object.freeze([
    'Security & Diplomacy',
    'Governance & Rights',
    'Economy & Development',
    'Climate & Resources',
    'Technology & Information',
    'Health & Human Security',
]);

const TARGET_SOURCE_ROLES = Object.freeze([
    'institutional',
    'regional',
    'independent-news',
    'research',
]);

const FIXED_QUERIES = Object.freeze([
    {
        id: 'africa-governance-development',
        region: 'Africa',
        issueHints: ['Governance & Rights', 'Economy & Development', 'Security & Diplomacy'],
        fallbackCoords: [4.8, 21.4],
        query: 'latest Africa diplomacy governance elections development trade climate security regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'asia-pacific-security-society',
        region: 'Asia-Pacific',
        issueHints: ['Security & Diplomacy', 'Economy & Development', 'Technology & Information'],
        fallbackCoords: [24.2, 108.0],
        query: 'latest Asia South Asia Southeast Asia East Asia diplomacy trade technology rights security regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'mena-diplomacy-human-security',
        region: 'Middle East & North Africa',
        issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Governance & Rights'],
        fallbackCoords: [27.5, 38.0],
        query: 'latest Middle East North Africa diplomacy humanitarian rights energy development regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'europe-eurasia-governance-security',
        region: 'Europe & Eurasia',
        issueHints: ['Security & Diplomacy', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: [50.8, 28.0],
        query: 'latest Europe Eurasia diplomacy governance migration energy economy security regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'americas-caribbean-democracy-development',
        region: 'Americas & Caribbean',
        issueHints: ['Governance & Rights', 'Economy & Development', 'Health & Human Security'],
        fallbackCoords: [7.8, -73.0],
        query: 'latest Latin America Caribbean democracy migration trade climate public health regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'pacific-climate-ocean-governance',
        region: 'Pacific Islands',
        issueHints: ['Climate & Resources', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: [-13.5, 172.0],
        query: 'latest Pacific islands climate ocean sovereignty fisheries development regional media analysis -sports -entertainment',
        results: 7,
    },
    {
        id: 'global-institutions-human-security',
        region: 'Global / Transnational',
        issueHints: ['Health & Human Security', 'Governance & Rights', 'Economy & Development'],
        fallbackCoords: [12.0, -18.0],
        query: 'latest global institutions treaty humanitarian public health migration human rights trade Global South perspectives -sports -entertainment',
        results: 7,
    },
    {
        id: 'global-technology-information-governance',
        region: 'Global / Transnational',
        issueHints: ['Technology & Information', 'Governance & Rights', 'Security & Diplomacy'],
        fallbackCoords: [18.0, 12.0],
        query: 'latest global AI cyber information governance digital rights technology security Global South perspectives -products -sports -entertainment',
        results: 7,
    },
]);

const SOURCE_ROLE_LABELS = Object.freeze({
    institutional: 'Institutional / primary',
    regional: 'Regional / local reporting',
    'independent-news': 'Independent news',
    research: 'Research / analysis',
    discovery: 'Additional discovery source',
});

const criticalMineralsCatalog = require('../../../src/data/criticalMinerals.json');

const MINERAL_REFERENCE = Object.freeze(criticalMineralsCatalog.minerals);

function buildMineralBaseline() {
    return Object.fromEntries(
        Object.entries(MINERAL_REFERENCE).map(([key, entry]) => [
            key,
            {
                symbol: entry.symbol,
                price: String(entry.price || '').trim(),
                unit: entry.unit,
                origins: entry.origins,
                players: entry.players,
                sourceMode: entry.sourceMode || 'reference',
                asOf: criticalMineralsCatalog.asOf,
                sourceLabel: criticalMineralsCatalog.sourceLabel,
                sourceUrl: criticalMineralsCatalog.sourceUrl,
            },
        ])
    );
}

const SOURCE_ROLE_DOMAINS = Object.freeze({
    institutional: [
        'un.org', 'undp.org', 'unhcr.org', 'unicef.org', 'who.int', 'worldbank.org',
        'imf.org', 'wto.org', 'oecd.org', 'ilo.org', 'reliefweb.int', 'ipcc.ch',
        'iaea.org', 'icj-cij.org', 'nato.int', 'europa.eu', 'consilium.europa.eu',
        'asean.org', 'au.int', 'africanunion.org', 'caricom.org', 'oas.org',
        'adb.org', 'afdb.org', 'iadb.org',
    ],
    regional: [
        'africanews.com', 'allafrica.com', 'nation.africa', 'premiumtimesng.com',
        'dailytrust.com', 'channelstv.com', 'theeastafrican.co.ke', 'issafrica.org',
        'channelnewsasia.com', 'scmp.com', 'koreajoongangdaily.com', 'nikkei.com',
        'rappler.com', 'dawn.com', 'thehindu.com', 'indianexpress.com', 'bdnews24.com',
        'frontiermyanmar.net', 'aljazeera.com', 'jpost.com', 'thenationalnews.com',
        'arabnews.com', 'middleeasteye.net', 'newarab.com', 'iranintl.com',
        'balkaninsight.com', 'kyivindependent.com', 'euractiv.com', 'mercopress.com',
        'jamaica-gleaner.com', 'stabroeknews.com', 'americasquarterly.org',
        'rnz.co.nz', 'fijitimes.com', 'islandsbusiness.com', 'devpolicy.org',
    ],
    'independent-news': [
        'reuters.com', 'apnews.com', 'bbc.com', 'bbc.co.uk', 'france24.com',
        'dw.com', 'theguardian.com', 'ft.com', 'economist.com', 'cbsnews.com', 'npr.org',
    ],
    research: [
        'cfr.org', 'crisisgroup.org', 'chathamhouse.org', 'brookings.edu',
        'carnegieendowment.org', 'csis.org', 'sipri.org', 'odi.org', 'rand.org',
        'lowyinstitute.org', 'iiss.org', 'bruegel.org', 'atlanticcouncil.org',
        'wilsoncenter.org', 'theconversation.com', 'thenewhumanitarian.org',
    ],
});

const BLOCKED_DISCOVERY_DOMAINS = Object.freeze([
    'youtube.com', 'youtu.be', 'facebook.com', 'instagram.com', 'tiktok.com',
    'x.com', 'twitter.com', 'linkedin.com',
]);

const PROMOTIONAL_TITLE_PATTERN = /\b(funding opportunities?|job openings?|apply now|register now|webinar|newsletter|weekly roundup|event calendar|sponsored content)\b/i;
const GLOBAL_POLITICS_PATTERN = /\b(diplomac\w*|security|conflict|war|peace|ceasefire|treaty|sanction\w*|election\w*|governance|democrac\w*|authoritarian\w*|human rights?|refugee\w*|migration|displacement|humanitarian|sovereignty|court|law|trade|tariff\w*|debt|development|labor|food security|climate|energy|water|mineral\w*|biodiversity|health|disease|outbreak|technology|artificial intelligence|\bai\b|cyber\w*|information|surveillance|multilateral\w*|aid)\b/gi;

const ISSUE_PATTERNS = Object.freeze({
    'Security & Diplomacy': /\b(diplomac\w*|security|conflict|war|peace|ceasefire|military|defen[cs]e|sanction\w*|nuclear|treaty|border|maritime|geopolitic\w*)\b/gi,
    'Governance & Rights': /\b(governance|democrac\w*|election\w*|authoritarian\w*|human rights?|civil liberties|court|law|justice|accountability|corruption|protest\w*|sovereignty|indigenous)\b/gi,
    'Economy & Development': /\b(econom\w*|trade|tariff\w*|debt|development|labor|worker\w*|employment|finance|investment|poverty|inequality|food security|supply chain|market\w*)\b/gi,
    'Climate & Resources': /\b(climate|energy|water|ocean|fisher\w*|mineral\w*|biodiversity|environment\w*|emission\w*|drought|flood\w*|renewable\w*|oil|gas|forest\w*)\b/gi,
    'Technology & Information': /\b(technology|artificial intelligence|\bai\b|cyber\w*|digital|information|disinformation|surveillance|semiconductor\w*|data governance|internet|platform\w*)\b/gi,
    'Health & Human Security': /\b(health|disease|outbreak|pandemic|vaccine\w*|hospital\w*|refugee\w*|migration|displacement|humanitarian|famine|food crisis|civilian\w*|aid access)\b/gi,
});

const REGION_PATTERNS = Object.freeze({
    'Africa': /\b(africa|sudan|south sudan|ethiopia|eritrea|somalia|kenya|uganda|tanzania|rwanda|burundi|congo|drc|nigeria|ghana|senegal|mali|niger|burkina faso|chad|cameroon|angola|mozambique|zimbabwe|zambia|south africa|sahel)\b/gi,
    'Asia-Pacific': /\b(asian?|asia-pacific|china|taiwan|japan|korea|india|pakistan|bangladesh|sri lanka|nepal|bhutan|myanmar|thailand|vietnam|cambodia|laos|malaysia|singapore|indonesia|philippines|mongolia|afghanistan)\b/gi,
    'Middle East & North Africa': /\b(middle east|north africa|mena|iran|iraq|israel|palestin\w*|gaza|lebanon|syria|jordan|yemen|saudi arabia|qatar|emirates|uae|oman|bahrain|kuwait|egypt|libya|tunisia|algeria|morocco)\b/gi,
    'Europe & Eurasia': /\b(europe|eurasia|ukraine|russia|moldova|georgia|armenia|azerbaijan|belarus|balkans|kosovo|serbia|bosnia|poland|germany|france|britain|united kingdom|eu\b|european union|nato)\b/gi,
    'Americas & Caribbean': /\b(latin america|caribbean|south america|central america|united states|u\.s\.|canada|mexico|brazil|argentina|chile|peru|colombia|venezuela|ecuador|bolivia|guyana|suriname|haiti|cuba|jamaica|trinidad|guatemala|honduras|el salvador|panama)\b/gi,
    'Pacific Islands': /\b(pacific islands?|oceania|tuvalu|fiji|samoa|tonga|vanuatu|kiribati|nauru|palau|micronesia|marshall islands|solomon islands|papua new guinea|new caledonia)\b/gi,
    'Global / Transnational': /\b(global|worldwide|multilateral|united nations|world bank|international monetary fund|world trade organization|cross-border|transnational)\b/gi,
});

const TOPIC_PATTERNS = Object.freeze([
    ['iran', /\biran\w*\b/i], ['israel-palestine', /\b(israel\w*|palestin\w*|gaza)\b/i],
    ['ukraine-russia', /\b(ukrain\w*|russia\w*)\b/i], ['sudan', /\bsudan\w*\b/i],
    ['myanmar', /\bmyanmar\b/i], ['china-taiwan', /\b(china|chinese|taiwan\w*)\b/i],
    ['korean-peninsula', /\b(korea\w*|pyongyang|seoul)\b/i], ['sahel', /\b(sahel|mali|niger|burkina faso)\b/i],
    ['haiti', /\bhaiti\w*\b/i], ['venezuela-guyana', /\b(venezuela\w*|guyana|essequibo)\b/i],
    ['climate-governance', /\b(climate|emissions?|cop\d*)\b/i], ['artificial-intelligence', /\b(artificial intelligence|\bai\b)\b/i],
    ['migration', /\b(migration|migrant\w*|refugee\w*|displacement)\b/i], ['global-trade', /\b(trade|tariff\w*|supply chain)\b/i],
]);

const TITLE_STOP_WORDS = new Set('latest global world update analysis report says amid after before from into over with that this these those their about could would should more than under'.split(' '));

async function fetchWithTimeout(fetchImpl, url, options, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetchImpl(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeout);
    }
}

function classifySerperFailure(status, bodyMessage = '') {
    if (status === 400 && /credit/i.test(bodyMessage)) return 'credits-exhausted';
    if (status === 401 || status === 403 || /unauthorized|invalid.*key/i.test(bodyMessage)) return 'invalid-api-key';
    if (status === 429) return 'rate-limited';
    if (status >= 400 && status < 500) return 'bad-request';
    if (status >= 500) return 'upstream-error';
    return 'unexpected-status';
}

async function fetchQuery(fetchImpl, query, apiKey, results, timeoutMs = REQUEST_TIMEOUT_MS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
        let response;
        try {
            response = await fetchImpl('https://google.serper.dev/news', {
                method: 'POST',
                headers: {
                    'X-API-KEY': apiKey,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ q: query, num: results, hl: 'en', tbs: 'qdr:m' }),
                signal: controller.signal,
            });
        } catch (cause) {
            const error = new Error('Serper request failed');
            error.errorCode = cause?.name === 'AbortError' || cause?.name === 'TimeoutError'
                ? 'timeout'
                : 'network-error';
            throw error;
        }
        if (!response.ok) {
            let bodyMessage = '';
            try {
                const errData = typeof response.json === 'function' ? await response.json() : null;
                if (typeof errData?.message === 'string') bodyMessage = errData.message.slice(0, 120);
            } catch {
                // Ignore non-JSON or aborted upstream error payloads
            }
            const error = new Error(`Serper returned ${response.status}`);
            error.httpStatus = response.status;
            error.errorCode = classifySerperFailure(response.status, bodyMessage);
            throw error;
        }
        let data;
        try {
            data = await response.json();
        } catch (cause) {
            const error = new Error('Serper response body read failed');
            error.errorCode = cause?.name === 'AbortError' || cause?.name === 'TimeoutError'
                ? 'timeout'
                : 'upstream-error';
            throw error;
        }
        return Array.isArray(data.news) ? data.news : [];
    } finally {
        clearTimeout(timeout);
    }
}

function countMatches(text, pattern) {
    return (String(text || '').match(pattern) || []).length;
}

function getPublisherDomain(url) {
    try {
        return new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return '';
    }
}

function domainMatches(domain, candidate) {
    return domain === candidate || domain.endsWith(`.${candidate}`);
}

function getSourceRole(domain) {
    for (const [role, domains] of Object.entries(SOURCE_ROLE_DOMAINS)) {
        if (domains.some(candidate => domainMatches(domain, candidate))) return role;
    }
    return 'discovery';
}

function inferCoverageLabel(text, patterns, fallback) {
    const scored = Object.entries(patterns)
        .map(([label, pattern]) => ({ label, score: countMatches(text, pattern) }))
        .sort((a, b) => (b.score - a.score)
            || (a.label === fallback ? -1 : b.label === fallback ? 1 : 0));
    return scored[0]?.score > 0 ? scored[0].label : fallback;
}

function getTopicCluster(text, region, issue) {
    const namedTopic = TOPIC_PATTERNS.find(([, pattern]) => pattern.test(text));
    if (namedTopic) return `${region}:${namedTopic[0]}`;
    const titleTokens = String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .filter(token => token.length > 3 && !TITLE_STOP_WORDS.has(token))
        .slice(0, 4);
    return `${region}:${issue}:${titleTokens.join('-') || 'general'}`;
}

function assessArticle(item, query, { scraperSource = 'serper-public-cache', isInstitutionalHub = false } = {}) {
    const normalized = normalizeProviderArticle(item, scraperSource);
    if (!normalized) return null;

    const title = normalized['Entity/Subject'];
    const description = normalized['Expected Impact/Value'];
    const combined = `${title} ${description}`;
    const domain = getPublisherDomain(normalized.url);
    if (BLOCKED_DISCOVERY_DOMAINS.some(candidate => domainMatches(domain, candidate))) return null;
    if (PROMOTIONAL_TITLE_PATTERN.test(title)) return null;

    const titleSignals = countMatches(title, GLOBAL_POLITICS_PATTERN);
    const descriptionSignals = countMatches(description, GLOBAL_POLITICS_PATTERN);
    const sourceRole = getSourceRole(domain);
    const region = inferCoverageLabel(combined, REGION_PATTERNS, query.region);
    const issue = inferCoverageLabel(combined, ISSUE_PATTERNS, query.issueHints[0]);
    const regionIsExplicit = countMatches(combined, REGION_PATTERNS[region]) > 0;
    const relevanceScore = Math.min(100,
        (titleSignals * 12)
        + (Math.min(descriptionSignals, 8) * 3)
        + (sourceRole === 'discovery' ? 0 : 8)
        + (normalized.publishedAt ? 4 : 0)
        + (regionIsExplicit ? 5 : 0)
        + (String(description || '').length >= 80 ? 3 : 0)
    );

    if (relevanceScore < 16) return null;

    const usesRegionalFallback = normalized._coordPrecision === 'fallback';
    const locationPrecision = normalized._coordPrecision === 'named-place' ? 'named-place' : 'regional';
    const [fallbackLat, fallbackLng] = query.fallbackCoords;
    const sourceRoleLabel = SOURCE_ROLE_LABELS[sourceRole];
    const selectionReason = `Selected to strengthen ${region} and ${issue} coverage; source role: ${sourceRoleLabel.toLowerCase()}. Automated relevance score ${relevanceScore}/100.`;

    return {
        ...normalized,
        ...(usesRegionalFallback ? {
            Latitude: String(fallbackLat),
            Longitude: String(fallbackLng),
        } : {}),
        coverage: {
            region,
            issue,
            sourceRole,
            sourceRoleLabel,
            queryId: query.id,
            selectionReason,
            relevanceScore,
            locationPrecision,
            ...(normalized._matchedPlace ? { matchedPlace: normalized._matchedPlace } : {}),
        },
        _publisherDomain: domain,
        _topicCluster: getTopicCluster(combined, region, issue),
        _isInstitutionalHub: Boolean(isInstitutionalHub),
    };
}

function dedupeArticles(items) {
    const seenUrls = new Set();
    const seenTitles = new Set();
    return items.filter(item => {
        if (!item) return false;
        const urlKey = String(item.url || '').toLowerCase();
        const titleKey = String(item['Entity/Subject'] || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
        if (!urlKey || !titleKey) return false;
        if (seenUrls.has(urlKey) || seenTitles.has(titleKey)) return false;
        seenUrls.add(urlKey);
        seenTitles.add(titleKey);
        return true;
    });
}

function increment(counter, key) {
    counter.set(key, (counter.get(key) || 0) + 1);
}

function selectDiverseArticles(items, limit = MAX_SNAPSHOT_ITEMS) {
    const candidates = dedupeArticles(items)
        .sort((a, b) => (b.coverage?.relevanceScore || 0) - (a.coverage?.relevanceScore || 0));
    const selected = [];
    const selectedSet = new Set();
    const regionCounts = new Map();
    const issueCounts = new Map();
    const domainCounts = new Map();
    const topicCounts = new Map();
    const sourceRoleCounts = new Map();
    let discoveryCount = 0;

    const trySelect = item => {
        if (!item || selectedSet.has(item)) return false;
        const region = item.coverage?.region;
        const issue = item.coverage?.issue;
        const domain = item._publisherDomain || getPublisherDomain(item.url);
        const topic = item._topicCluster || `${region}:${issue}:${item['Entity/Subject']}`;
        const sourceRole = item.coverage?.sourceRole || 'discovery';
        const maxDomain = item._isInstitutionalHub ? MAX_PER_INSTITUTIONAL_HUB : MAX_PER_DOMAIN;
        const maxRole = (sourceRole === 'institutional' && item._isInstitutionalHub)
            ? MAX_PER_INSTITUTIONAL_ROLE
            : MAX_PER_SOURCE_ROLE;
        if ((regionCounts.get(region) || 0) >= MAX_PER_REGION) return false;
        if ((issueCounts.get(issue) || 0) >= MAX_PER_ISSUE) return false;
        if ((domainCounts.get(domain) || 0) >= maxDomain) return false;
        if ((topicCounts.get(topic) || 0) >= MAX_PER_TOPIC_CLUSTER) return false;
        if ((sourceRoleCounts.get(sourceRole) || 0) >= maxRole) return false;
        if (sourceRole === 'discovery' && discoveryCount >= MAX_DISCOVERY_SOURCES) return false;

        selected.push(item);
        selectedSet.add(item);
        increment(regionCounts, region);
        increment(issueCounts, issue);
        increment(domainCounts, domain);
        increment(topicCounts, topic);
        increment(sourceRoleCounts, sourceRole);
        if (sourceRole === 'discovery') discoveryCount += 1;
        return true;
    };

    const selectFirst = predicate => {
        for (const item of candidates) {
            if (!selectedSet.has(item) && predicate(item) && trySelect(item)) return true;
        }
        return false;
    };

    for (const region of TARGET_REGIONS) {
        selectFirst(item => item.coverage?.region === region);
    }
    for (const issue of TARGET_ISSUES) {
        selectFirst(item => item.coverage?.issue === issue);
    }
    for (const sourceRole of TARGET_SOURCE_ROLES) {
        selectFirst(item => item.coverage?.sourceRole === sourceRole);
    }
    for (const item of candidates) {
        if (selected.length >= limit) break;
        trySelect(item);
    }

    const coordCounts = new Map();
    return selected.slice(0, limit).map(item => {
        const {
            _publisherDomain,
            _topicCluster,
            _isInstitutionalHub,
            _coordPrecision,
            _matchedPlace,
            ...publicItem
        } = item;
        const lat = Number.parseFloat(publicItem.Latitude);
        const lng = Number.parseFloat(publicItem.Longitude);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
            const coordKey = `${lat.toFixed(1)},${lng.toFixed(1)}`;
            const seenCount = coordCounts.get(coordKey) || 0;
            coordCounts.set(coordKey, seenCount + 1);
            if (seenCount > 0) {
                const angle = (seenCount * 2.399963229728653); // golden angle for even spread
                const radius = 1.4 + Math.min(seenCount, 4) * 0.35;
                const nextLat = Math.max(-75, Math.min(75, lat + Math.sin(angle) * radius));
                let nextLng = lng + Math.cos(angle) * radius;
                if (nextLng > 180) nextLng -= 360;
                if (nextLng < -180) nextLng += 360;
                publicItem.Latitude = nextLat.toFixed(2);
                publicItem.Longitude = nextLng.toFixed(2);
            }
        }
        return publicItem;
    });
}

function countBy(items, getter) {
    return items.reduce((counts, item) => {
        const key = getter(item);
        if (key) counts[key] = (counts[key] || 0) + 1;
        return counts;
    }, {});
}

function buildCoverageSummary(items, { candidateCount = 0, rejectedCount = 0 } = {}) {
    const regions = countBy(items, item => item.coverage?.region);
    const issues = countBy(items, item => item.coverage?.issue);
    const sourceRoles = countBy(items, item => item.coverage?.sourceRole);
    const missingRegions = TARGET_REGIONS.filter(region => !regions[region]);
    const missingIssues = TARGET_ISSUES.filter(issue => !issues[issue]);
    const missingSourceRoles = TARGET_SOURCE_ROLES.filter(sourceRole => !sourceRoles[sourceRole]);
    return {
        policy: 'relevance-diversity-v1',
        languagePolicy: 'English-language discovery with regional-source prioritization',
        selectedCount: items.length,
        candidateCount,
        rejectedCount,
        coveredRegionCount: TARGET_REGIONS.length - missingRegions.length,
        targetRegionCount: TARGET_REGIONS.length,
        coveredIssueCount: TARGET_ISSUES.length - missingIssues.length,
        targetIssueCount: TARGET_ISSUES.length,
        coveredSourceRoleCount: TARGET_SOURCE_ROLES.length - missingSourceRoles.length,
        targetSourceRoleCount: TARGET_SOURCE_ROLES.length,
        regions,
        issues,
        sourceRoles,
        missingRegions,
        missingIssues,
        missingSourceRoles,
        sourceRoleDisclaimer: 'Source roles describe perspective and format, not neutrality, accuracy, or endorsement.',
    };
}

const DEFAULT_PUBLIC_PROVIDER = 'Institutional & Open Feeds';
const RELIEFWEB_DEFAULT_QUERY = Object.freeze({
    id: 'reliefweb-latest',
    region: 'Global / Transnational',
    issueHints: ['Health & Human Security', 'Security & Diplomacy', 'Climate & Resources'],
    fallbackCoords: [12.0, 20.0],
});

async function buildPublicSnapshot({
    apiKey = process.env.SERPER_API_KEY,
    enableSerper = process.env.ENABLE_SERPER_PUBLIC_FEED === 'true',
    reliefwebAppname = process.env.RELIEFWEB_APPNAME || '',
    includeFreeFeeds = true,
    fetchImpl = fetch,
    now = new Date(),
} = {}) {
    const useSerper = Boolean(enableSerper && apiKey);
    const activeProviders = [];
    const rawItems = [];
    const assessedItems = [];
    let queryCount = 0;
    let coreFailedCount = 0;
    let totalFailedCount = 0;
    const coreRejected = [];
    const serperRejected = [];
    const providerResults = [];

    if (!includeFreeFeeds && !useSerper) {
        const coverage = buildCoverageSummary([]);
        return {
            items: [],
            minerals: buildMineralBaseline(),
            meta: {
                generatedAt: now.toISOString(),
                sourceMode: 'public-cache',
                status: 'not-configured',
                provider: 'Serper',
                queryPolicy: 'fixed-editorial',
                cacheTtlSeconds: SNAPSHOT_TTL_MS / 1000,
                liveItemCount: 0,
                coverage,
            },
        };
    }

    if (includeFreeFeeds) {
        const rssSettled = await Promise.allSettled(
            INSTITUTIONAL_RSS_FEEDS.map(feed => fetchRssFeed(fetchImpl, feed, { now }))
        );
        queryCount += INSTITUTIONAL_RSS_FEEDS.length;
        let rssSuccessCount = 0;
        let rssItemsCount = 0;
        rssSettled.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                rssSuccessCount += 1;
                const feed = INSTITUTIONAL_RSS_FEEDS[index];
                rawItems.push(...result.value);
                for (const item of result.value) {
                    const assessed = assessArticle(item, feed, {
                        scraperSource: 'institutional-rss',
                        isInstitutionalHub: true,
                    });
                    if (assessed) {
                        assessedItems.push(assessed);
                        rssItemsCount += 1;
                    }
                }
            } else {
                coreFailedCount += 1;
                totalFailedCount += 1;
                coreRejected.push(result.reason);
            }
        });
        if (rssSuccessCount > 0) activeProviders.push('UN News RSS');
        providerResults.push({
            provider: 'UN News RSS',
            status: rssSuccessCount === INSTITUTIONAL_RSS_FEEDS.length
                ? 'ok'
                : (rssSuccessCount > 0 ? 'partial' : 'failed'),
            itemCount: rssItemsCount,
        });

        if (String(reliefwebAppname || '').trim()) {
            queryCount += 1;
            try {
                const rw = await fetchReliefWebReports(fetchImpl, { appname: reliefwebAppname, now });
                let rwCount = 0;
                if (rw.status === 'ok' && rw.items.length > 0) {
                    activeProviders.push('ReliefWeb');
                    rawItems.push(...rw.items);
                    for (const item of rw.items) {
                        const assessed = assessArticle(item, RELIEFWEB_DEFAULT_QUERY, {
                            scraperSource: 'reliefweb-v2',
                            isInstitutionalHub: true,
                        });
                        if (assessed) {
                            assessedItems.push(assessed);
                            rwCount += 1;
                        }
                    }
                }
                providerResults.push({ provider: 'ReliefWeb', status: 'ok', itemCount: rwCount });
            } catch (err) {
                coreFailedCount += 1;
                totalFailedCount += 1;
                coreRejected.push(err);
                providerResults.push({ provider: 'ReliefWeb', status: 'failed', itemCount: 0 });
            }
        }

        // Best-effort single GDELT Doc API query; failures are reported honestly in providerResults and failedQueryCount
        const gdeltSettled = await Promise.allSettled(
            GDELT_FEED_QUERIES.map(query => fetchGdeltQuery(fetchImpl, query, { now }))
        );
        queryCount += GDELT_FEED_QUERIES.length;
        let gdeltItemsAdded = 0;
        let gdeltFailedCount = 0;
        gdeltSettled.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                const query = GDELT_FEED_QUERIES[index];
                rawItems.push(...result.value);
                for (const item of result.value) {
                    const assessed = assessArticle(item, query, {
                        scraperSource: 'gdelt-doc',
                        isInstitutionalHub: false,
                    });
                    if (assessed) {
                        assessedItems.push(assessed);
                        gdeltItemsAdded += 1;
                    }
                }
            } else {
                totalFailedCount += 1;
                gdeltFailedCount += 1;
            }
        });
        if (gdeltItemsAdded > 0) activeProviders.push('GDELT');
        providerResults.push({
            provider: 'GDELT',
            status: gdeltFailedCount === 0 ? 'ok' : (gdeltFailedCount < GDELT_FEED_QUERIES.length ? 'partial' : 'failed'),
            itemCount: gdeltItemsAdded,
        });
    }

    if (useSerper) {
        const serperResults = await Promise.allSettled(FIXED_QUERIES.map(query =>
            fetchQuery(fetchImpl, query.query, apiKey, query.results)
        ));
        queryCount += FIXED_QUERIES.length;
        let serperSuccessCount = 0;
        serperResults.forEach((result, index) => {
            if (result.status === 'fulfilled') {
                serperSuccessCount += 1;
                rawItems.push(...result.value);
                for (const item of result.value) {
                    const assessed = assessArticle(item, FIXED_QUERIES[index], {
                        scraperSource: 'serper-public-cache',
                        isInstitutionalHub: false,
                    });
                    if (assessed) assessedItems.push(assessed);
                }
            } else {
                totalFailedCount += 1;
                if (!includeFreeFeeds) coreFailedCount += 1;
                serperRejected.push(result.reason);
            }
        });
        if (serperSuccessCount > 0) {
            activeProviders.push('Serper');
        } else if (serperRejected.length > 0 && includeFreeFeeds) {
            console.warn(`[public-intel] Optional Serper skipped (${serperRejected[0]?.errorCode || 'provider-error'}); serving free institutional feeds.`);
        }
        providerResults.push({
            provider: 'Serper',
            status: serperRejected.length === 0 ? 'ok' : (serperSuccessCount > 0 ? 'partial' : 'failed'),
            itemCount: serperResults.reduce((acc, r) => acc + (r.status === 'fulfilled' ? r.value.length : 0), 0),
        });
    }

    const relevantRejected = includeFreeFeeds ? coreRejected : serperRejected;
    const errorCounts = countBy(relevantRejected, err => err?.errorCode || (err?.name === 'AbortError' ? 'timeout' : 'upstream-error'));
    const dominantErrorCode = Object.entries(errorCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    const firstHttpStatus = relevantRejected.find(err => Number.isInteger(err?.httpStatus))?.httpStatus || null;
    const dedupedCandidates = dedupeArticles(assessedItems);
    const items = selectDiverseArticles(dedupedCandidates);
    const coverage = buildCoverageSummary(items, {
        candidateCount: dedupedCandidates.length,
        rejectedCount: Math.max(0, rawItems.length - dedupedCandidates.length),
    });

    const providerLabel = activeProviders.length > 0
        ? activeProviders.join(' + ')
        : (includeFreeFeeds ? DEFAULT_PUBLIC_PROVIDER : 'Serper');

    return {
        items,
        minerals: buildMineralBaseline(),
        meta: {
            generatedAt: now.toISOString(),
            sourceMode: 'public-cache',
            status: items.length > 0
                ? (coreFailedCount > 0 ? 'partial' : 'fresh')
                : (coreFailedCount > 0 ? 'provider-error' : 'empty'),
            provider: providerLabel,
            providerResults,
            queryPolicy: 'fixed-editorial',
            queryCount,
            failedQueryCount: totalFailedCount,
            ...(items.length === 0 && coreFailedCount > 0 && dominantErrorCode ? {
                errorCode: dominantErrorCode,
                ...(firstHttpStatus ? { providerHttpStatus: firstHttpStatus } : {}),
            } : {}),
            cacheTtlSeconds: SNAPSHOT_TTL_MS / 1000,
            liveItemCount: items.length,
            coverage,
        },
    };
}

function withSnapshotAge(snapshot, now = Date.now()) {
    const generatedAt = new Date(snapshot?.meta?.generatedAt || 0).getTime();
    const ageSeconds = Number.isFinite(generatedAt) && generatedAt > 0
        ? Math.max(0, Math.floor((now - generatedAt) / 1000))
        : null;
    const stale = ageSeconds === null || ageSeconds > (SNAPSHOT_TTL_MS / 1000) * 2;
    return {
        ...snapshot,
        meta: {
            ...snapshot?.meta,
            ageSeconds,
            status: stale && snapshot?.items?.length ? 'stale' : snapshot?.meta?.status,
        },
    };
}

module.exports = {
    DEFAULT_PUBLIC_PROVIDER,
    FIXED_QUERIES,
    MAX_SNAPSHOT_ITEMS,
    MINERAL_REFERENCE,
    REQUEST_TIMEOUT_MS,
    SNAPSHOT_TTL_MS,
    SOURCE_ROLE_LABELS,
    TARGET_ISSUES,
    TARGET_REGIONS,
    TARGET_SOURCE_ROLES,
    assessArticle,
    buildCoverageSummary,
    buildMineralBaseline,
    buildPublicSnapshot,
    dedupeArticles,
    getPublisherDomain,
    selectDiverseArticles,
    withSnapshotAge,
};

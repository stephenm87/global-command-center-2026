// fetch-intel.js - Multi-source live geopolitical news scraper
// Sources: Serper (primary) → GNews (backup)
// Cached 30 min to preserve free-tier quotas

const CACHE_DURATION_MS = 30 * 60 * 1000;
let cache = { data: null, timestamp: 0 };

// Simple keyword → coordinates lookup for geolocating headlines
const REGION_COORDS = {
    ukraine: [49.0, 31.2], russia: [61.5, 105.3],
    gaza: [31.5, 34.5], israel: [31.0, 34.9], palestine: [31.9, 35.2],
    iran: [32.4, 53.7], iraq: [33.2, 43.7], syria: [34.8, 38.9],
    china: [35.9, 104.2], taiwan: [23.7, 120.9], 'hong kong': [22.3, 114.2],
    'north korea': [40.3, 127.5], korea: [36.5, 127.9],
    usa: [37.1, -95.6], 'united states': [37.1, -95.6], america: [37.1, -95.6],
    europe: [54.5, 15.3], germany: [51.2, 10.5], france: [46.2, 2.2],
    uk: [55.4, -3.4], britain: [55.4, -3.4], ukraine: [49.0, 31.2],
    nato: [50.8, 4.3], un: [40.7, -74.0],
    africa: [8.8, 26.8], sudan: [12.9, 30.2], ethiopia: [9.1, 40.5],
    somalia: [5.2, 46.2], nigeria: [9.1, 8.7], congo: [-4.0, 21.8],
    india: [20.6, 79.0], pakistan: [30.4, 69.3], afghanistan: [33.9, 67.7],
    myanmar: [19.2, 96.7], thailand: [15.9, 101.0], philippines: [12.9, 121.8],
    japan: [36.2, 138.3], 'south china sea': [14.0, 114.0],
    venezuela: [6.4, -66.6], colombia: [4.6, -74.1], mexico: [23.6, -102.5],
    brazil: [-14.2, -51.9], haiti: [18.9, -72.3],
    turkey: [38.9, 35.2], 'saudi arabia': [23.9, 45.1], yemen: [15.6, 48.5]
};

// ── PINNED INTEL — Hand-curated high-signal events (Feb 24, 2026) ────────────
// These always appear as live nodes regardless of scraper output.
const PINNED_INTEL = [
    // A — US-Iran Military Standoff
    {
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'US-Iran Military Standoff: Armada Deployed, Talks Continue Under Threat',
        'Key Player/Organization': 'United States, Iran, US Navy',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'US carrier groups positioned near Iran as Trump threatens military action; indirect talks ongoing but Iran views any confrontation as existential — escalation risk HIGH',
        'Source': 'Modern Diplomacy / GIS Reports',
        'url': 'https://moderndiplomacy.eu/2026/02/24/no-win-situation-for-trump-why-the-us-cannot-achieve-military-victory/',
        'Latitude': '32.4279',
        'Longitude': '53.6880',
        'Broad_Category': 'Geopolitics & Conflict',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // B — Ukraine War 4-Year Anniversary
    {
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'Ukraine War: 4th Anniversary — Putin\'s Aims Unchanged, Peace Dim',
        'Key Player/Organization': 'Russia, Ukraine, NATO, USA',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'Four years since Russia\'s full-scale invasion; Ukrainian forces counterattack in Dnipropetrovsk; Western experts see no change in Putin\'s objectives and dimming peace prospects',
        'Source': 'Russia Matters / Reddit CredibleDefense',
        'url': 'https://www.russiamatters.org/analysis/four-years-russias-invasion-western-experts-see-putins-aims-largely-unchanged-prospects',
        'Latitude': '48.3794',
        'Longitude': '31.1656',
        'Broad_Category': 'Geopolitics & Conflict',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // C — South Sudan Humanitarian Crisis
    {
        'Topic/Sector': 'Health / Society',
        'Entity/Subject': 'South Sudan: Conflict Deepens Hunger Crisis, Aid Access Blocked',
        'Key Player/Organization': 'UN OCHA, WFP, South Sudan government, armed factions',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': '1.2 million+ people at crisis-level food insecurity; armed conflict blocking humanitarian corridors — UN warns of imminent famine if aid cannot reach affected populations',
        'Source': 'UN News',
        'url': 'https://news.un.org/en/story/2026/02/1167005',
        'Latitude': '6.8770',
        'Longitude': '31.3070',
        'Broad_Category': 'Health & Society',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // D — Trump 15% Global Tariff
    {
        'Topic/Sector': 'Economy / Global',
        'Entity/Subject': 'Trump 15% Global Tariff: Supreme Court Clips IEEPA, Trade War Escalates',
        'Key Player/Organization': 'USA, EU, UK, WTO, US Supreme Court',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'SCOTUS struck down IEEPA tariffs 6-3; Trump immediately responded with 15% blanket tariff under Section 122 — effective Feb 24. Wall Street drops; EU and UK scramble to respond. Could reshape global trade architecture',
        'Source': 'NYT / Reuters / CFR',
        'url': 'https://www.cfr.org/articles/the-supreme-court-clipped-trumps-tariff-powers-and-opened-new-trade-battle-fronts',
        'Latitude': '38.8951',
        'Longitude': '-77.0364',
        'Broad_Category': 'Economy & Trade',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // F — US Rejects Global AI Governance
    {
        'Topic/Sector': 'Technology / Security',
        'Entity/Subject': 'US "Totally Rejects" Global AI Governance at India Summit',
        'Key Player/Organization': 'USA White House, India AI Summit, EU, UN',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'White House tech adviser Kratsios declares US opposes risk-focused multilateral AI regulation at Global AI Summit in New Delhi — fracturing international consensus on AI governance just as UN pushes its own framework',
        'Source': 'France 24',
        'url': 'https://www.france24.com/en/technology/20260220-us-totally-rejects-global-ai-governance-white-house-adviser-tells-india-summit',
        'Latitude': '28.6139',
        'Longitude': '77.2090',
        'Broad_Category': 'Technology & Science',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // G — UN AI Human Rights Framework
    {
        'Topic/Sector': 'Technology / Security',
        'Entity/Subject': 'UN Launches AI Human Rights Governance Framework',
        'Key Player/Organization': 'UN Human Rights Council, Volker Türk, OpenAI, member states',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'UN High Commissioner Türk calls for inclusivity, accountability and global AI standards at 61st HRC session in Geneva — directly countering US unilateralist stance. Sam Altman also urges urgent global AI regulation',
        'Source': 'UN News / Dig.Watch',
        'url': 'https://news.un.org/en/story/2026/02/1167000',
        'Latitude': '46.2044',
        'Longitude': '6.1432',
        'Broad_Category': 'Technology & Science',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // J — SCOTUS Oil Companies Climate Suit
    {
        'Topic/Sector': 'Environment / Energy',
        'Entity/Subject': 'SCOTUS Takes Up Exxon/Suncor Climate Accountability Case',
        'Key Player/Organization': 'US Supreme Court, ExxonMobil, Suncor Energy, Boulder CO, fossil fuel sector',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'Supreme Court agrees to hear oil companies\' bid to dismiss Boulder\'s climate damage lawsuit — ruling could shield fossil fuel industry from wave of city/state climate litigation nationwide and globally',
        'Source': 'The Guardian / LA Times',
        'url': 'https://www.theguardian.com/us-news/2026/feb/23/supreme-court-suncor-exxonmobil-case',
        'Latitude': '37.0902',
        'Longitude': '-95.7129',
        'Broad_Category': 'Environment & Energy',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // K — Somalia WFP Food Aid Crisis
    {
        'Topic/Sector': 'Health / Society',
        'Entity/Subject': 'WFP: Somalia Food Aid Could Halt Within Weeks Due to Funding Collapse',
        'Key Player/Organization': 'WFP, Somalia government, USAID (dismantled), donor nations',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'World Food Programme warns food aid to Somalia may fully stop within weeks — directly linked to USAID dismantling and declining donor contributions. 1.2M+ face acute food insecurity',
        'Source': 'CNBC Africa / WFP',
        'url': 'https://www.cnbcafrica.com/2026/food-aid-in-somalia-could-halt-within-weeks-due-to-funding-shortages-wfp-warns/',
        'Latitude': '2.0469',
        'Longitude': '45.3418',
        'Broad_Category': 'Health & Society',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // L — USAID 1-Year Dismantling Impact
    {
        'Topic/Sector': 'Health / Society',
        'Entity/Subject': 'USAID Dismantled: Lancet Study Projects Mass Death Toll After 1 Year',
        'Key Player/Organization': 'USA (Trump admin), USAID, Lancet, WHO, Global South nations',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'One year since Trump dismantled USAID — Lancet study projects devastating mortality projections across HIV, TB, malaria, and maternal health programs in Sub-Saharan Africa and South/Southeast Asia',
        'Source': 'CNN / The Lancet',
        'url': 'https://www.cnn.com/2026/02/04/world/lancet-usaid-global-aid-cuts-intl',
        'Latitude': '0.0',
        'Longitude': '20.0',
        'Broad_Category': 'Health & Society',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // J — M1: El Mencho Killing & CJNG Retaliation
    {
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'Mexico: CJNG Boss "El Mencho" Killed, Cartel Retaliatory Violence Erupts Across Jalisco',
        'Key Player/Organization': 'Mexico (Sheinbaum govt), CJNG Cartel, US Intelligence',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'US-assisted military raid killed CJNG leader Nemesio Oseguera ("El Mencho") Feb 22 — immediate retaliation: burning buses, highway blockades, gunfights across Jalisco & Michoacán; 10,000 troops deployed; Mexico at a crossroads on cartel power vs. state authority',
        'Source': 'NYT / Modern Diplomacy',
        'url': 'https://www.nytimes.com/2026/02/22/world/americas/jalisco-new-generation-cartel-leader-killed.html',
        'Latitude': '20.6597',
        'Longitude': '-103.3496',
        'Broad_Category': 'Geopolitics & Conflict',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // K — M2: US-Mexico Sovereignty Clash
    {
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'US-Mexico Sovereignty Standoff: Sheinbaum Rejects Intervention, Counters Tariffs, Faces Musk',
        'Key Player/Organization': 'USA (Trump/Musk), Mexico (Sheinbaum), USMCA',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'Mexico firmly rejects US military intervention despite Trump threats; Sheinbaum imposes 50% retaliatory tariffs on 1,000+ US goods; considers legal action after Elon Musk criticism — textbook realist sovereignty vs. liberal interventionist tension under USMCA framework',
        'Source': 'Al Jazeera / CRS Report',
        'url': 'https://www.aljazeera.com/news/2026/2/24/mexicos-claudia-sheinbaum-considers-legal-action-after-elon-musk-criticism',
        'Latitude': '19.4326',
        'Longitude': '-99.1332',
        'Broad_Category': 'Geopolitics & Conflict',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // L — S1: Duterte ICC Pre-Trial
    {
        'Topic/Sector': 'Human Rights / Governance',
        'Entity/Subject': 'Philippines: Duterte Faces ICC Pre-Trial — "War on Drugs" Killings Prosecuted Internationally',
        'Key Player/Organization': 'ICC, Rodrigo Duterte, Philippines, Human Rights Watch',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'ICC pre-trial hearings opened Feb 23: prosecutors allege Duterte personally directed extrajudicial drug war killings (est. 6,000–30,000 deaths 2016–2022); landmark case for international criminal accountability in SE Asia — precedent for state-sanctioned violence trials',
        'Source': 'The Star / Foreign Policy / ISEAS',
        'url': 'https://foreignpolicy.com/2026/02/24/duterte-icc-court-hearing-war-drugs/',
        'Latitude': '14.5995',
        'Longitude': '120.9842',
        'Broad_Category': 'Human Rights & Dignity',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // M — S2: ASEAN Treaty 50 Years Under Pressure
    {
        'Topic/Sector': 'Global Governance',
        'Entity/Subject': 'ASEAN at 50: Treaty of Amity Under Strain as US Unilateralism and China Pressure Mount',
        'Key Player/Organization': 'ASEAN, USA, China, RSIS Singapore',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'ASEAN\'s foundational Treaty of Amity & Cooperation marks 50 years amid unprecedented pressure: US tariff unilateralism disrupts regional trade frameworks, China asserts SCS claims, and major-power rivalries test ASEAN\'s non-alignment doctrine — regional multilateralism at inflection point',
        'Source': 'CNA / RSIS',
        'url': 'https://www.channelnewsasia.com/asia/asean-treaty-amity-cooperation-southeast-asia-mark-50-years-5949361',
        'Latitude': '13.7563',
        'Longitude': '100.5018',
        'Broad_Category': 'Global Governance',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // N — S4: Rohingya Militant Transnational Threat
    {
        'Topic/Sector': 'Human Rights / Security',
        'Entity/Subject': 'Rohingya Crisis Metastasizes: Refugee Camps Breeding Transnational Militant Networks Across SE Asia',
        'Key Player/Organization': 'Rohingya refugees, Bangladesh, Malaysia, Thailand, Indonesia, ARSA militants',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'Bangladesh Rohingya refugee crisis (1M+ displaced) spawning transnational criminal-militant ecosystem: arms trafficking, people smuggling, radicalization networks spreading into Malaysia, Thailand, Indonesia — The Diplomat warns of regional security breakdown if unaddressed',
        'Source': 'The Diplomat',
        'url': 'https://thediplomat.com/2026/02/southeast-asia-and-the-rohingya-militant-threat/',
        'Latitude': '21.9162',
        'Longitude': '95.9560',
        'Broad_Category': 'Human Rights & Dignity',
        'isScraped': true,
        '_scraperSource': 'pinned'
    },
    // O — S5: Myanmar Civil War Border Spillover
    {
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'Myanmar Civil War: Junta Losing Ground, Civilian Displacement Floods Thailand & Malaysia Borders',
        'Key Player/Organization': 'Myanmar Military (SAC), PDFs, NUG, Thailand, Malaysia',
        'Timeline': 'LIVE - Feb 2026',
        'Expected Impact/Value': 'Ongoing junta vs. resistance People\'s Defence Forces conflict; military losing territory in Shan, Kayah & Rakhine states; massive civilian displacement spilling into Thailand and India; Malaysia arrested 7,043 undocumented migrants Jan–Feb 2026 alone — regional humanitarian and security crisis accelerating',
        'Source': 'NST Malaysia / ISEAS',
        'url': 'https://www.nst.com.my/newssummary/1382735',
        'Latitude': '19.7633',
        'Longitude': '96.0785',
        'Broad_Category': 'Geopolitics & Conflict',
        'isScraped': true,
        '_scraperSource': 'pinned'
    }
];

function getCoords(text) {
    const lower = (text || '').toLowerCase();
    for (const [key, coords] of Object.entries(REGION_COORDS)) {
        if (lower.includes(key)) return coords;
    }
    return [20.0, 0.0]; // Global default
}

function categorizeSector(text) {
    const t = (text || '').toLowerCase();
    if (/war|conflict|military|attack|missile|sanction|nato|nuclear|troops|coup|siege|weapons|drone/.test(t))
        return 'Geopolitics & Conflict';
    if (/economy|trade|gdp|inflation|tariff|market|debt|recession|bank|supply chain|crypto/.test(t))
        return 'Economy & Trade';
    if (/climate|energy|oil|gas|carbon|emissions|environment|flooding|drought|cop/.test(t))
        return 'Environment & Energy';
    if (/ai|tech|cyber|hack|satellite|space|chip|quantum|digital|surveillance/.test(t))
        return 'Technology & Science';
    if (/health|pandemic|disease|vaccine|hospital|mental|food crisis|famine/.test(t))
        return 'Health & Society';
    return 'Geopolitics & Conflict';
}

const SECTOR_LABELS = {
    'Geopolitics & Conflict': 'Geopolitics / Conflict',
    'Economy & Trade': 'Economy / Global',
    'Environment & Energy': 'Environment / Energy',
    'Technology & Science': 'Technology / Security',
    'Health & Society': 'Health / Society',
};

// ── SERPER ──────────────────────────────────────────────────────────────────
async function fetchSerper(query, apiKey, numResults = 8) {
    const res = await fetch('https://google.serper.dev/news', {
        method: 'POST',
        headers: {
            'X-API-KEY': apiKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ q: query, num: numResults, gl: 'us', hl: 'en', tbs: 'qdr:m' })
    });
    if (!res.ok) throw new Error(`Serper error: ${res.status}`);
    const data = await res.json();
    return (data.news || []).map(item => {
        const category = categorizeSector(`${item.title} ${item.snippet}`);
        const [lat, lng] = getCoords(`${item.title} ${item.snippet}`);
        return {
            'Topic/Sector': SECTOR_LABELS[category],
            'Entity/Subject': item.title,
            'Key Player/Organization': item.source || 'Global News',
            'Timeline': (() => {
                if (!item.date) return 'LIVE - Feb 2026';
                const parsed = new Date(item.date);
                if (!isNaN(parsed)) return `LIVE - ${parsed.toLocaleString('en-US', { month: 'short', year: 'numeric' })}`;
                // Serper sometimes returns relative strings like "2 days ago" — use as-is
                return `LIVE - ${item.date}`;
            })(),
            'Expected Impact/Value': item.snippet || item.title,
            'Source': item.source || 'Google News',
            'url': item.link,
            'Latitude': String(lat),
            'Longitude': String(lng),
            'Broad_Category': category,
            'isScraped': true,
            '_scraperSource': 'serper'
        };
    });
}

// ── GNEWS (backup) ───────────────────────────────────────────────────────────
async function fetchGNews(query, apiKey, max = 8) {
    const url = `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=en&country=any&max=${max}&sortby=publishedAt&token=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GNews error: ${res.status}`);
    const data = await res.json();
    return (data.articles || []).map(article => {
        const combined = `${article.title} ${article.description}`;
        const category = categorizeSector(combined);
        const [lat, lng] = getCoords(combined);
        return {
            'Topic/Sector': SECTOR_LABELS[category],
            'Entity/Subject': article.title,
            'Key Player/Organization': article.source?.name || 'Global News',
            'Timeline': `LIVE - ${new Date(article.publishedAt || Date.now()).toLocaleString('en-US', { month: 'short', year: 'numeric' })}`,
            'Expected Impact/Value': article.description || article.title,
            'Source': article.source?.name || 'GNews',
            'url': article.url,
            'Latitude': String(lat),
            'Longitude': String(lng),
            'Broad_Category': category,
            'isScraped': true,
            '_scraperSource': 'gnews'
        };
    });
}

// ── HANDLER ──────────────────────────────────────────────────────────────────
exports.handler = async (event) => {
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=1800'
    };

    try {
        // Return cached data if still fresh
        const now = Date.now();
        if (cache.data && (now - cache.timestamp) < CACHE_DURATION_MS) {
            return { statusCode: 200, headers, body: JSON.stringify(cache.data) };
        }

        const serperKey = process.env.SERPER_API_KEY;
        const gnewsKey = process.env.GNEWS_API_KEY;

        let intelItems = [];

        // PRIMARY: Serper — scoped to past month (tbs:qdr:m), targeting latest + ongoing conflicts
        if (serperKey) {
            const [breakingConflict, ongoingWars, geoecon, techSec] = await Promise.all([
                fetchSerper('breaking geopolitics crisis conflict 2026 latest update', serperKey, 8),
                fetchSerper('Ukraine Gaza Sudan Taiwan ceasefire offensive latest development 2026', serperKey, 7),
                fetchSerper('global economy sanctions trade war tariffs 2026', serperKey, 5),
                fetchSerper('cyber attack AI surveillance military technology 2026', serperKey, 4)
            ]);
            intelItems = [...breakingConflict, ...ongoingWars, ...geoecon, ...techSec];
        }

        // BACKUP: GNews (if Serper unavailable or too few results)
        if (intelItems.length < 5 && gnewsKey) {
            const [conflictBack, econBack] = await Promise.all([
                fetchGNews('geopolitics war conflict UN sanctions', gnewsKey, 8),
                fetchGNews('global economy trade inflation crisis', gnewsKey, 5)
            ]);
            intelItems = [...intelItems, ...conflictBack, ...econBack];
        }

        // Deduplicate scraped items by URL
        const seen = new Set();
        // Pre-seed with pinned URLs so scraper dupes are removed
        PINNED_INTEL.forEach(p => seen.add(p.url));
        intelItems = intelItems.filter(item => {
            if (!item.url || seen.has(item.url)) return false;
            seen.add(item.url);
            return true;
        });

        // Merge: pinned intel always leads, scraped items follow
        intelItems = [...PINNED_INTEL, ...intelItems];

        // ── CRITICAL MINERALS PRICING ──────────────────────────────────────
        // Static reference data for the matrix grid
        const MINERAL_REF = {
            gold: { symbol: 'Au', unit: '/oz', origins: 'China, Australia, Russia, USA', players: 'Newmont, Barrick Gold, AngloGold' },
            silver: { symbol: 'Ag', unit: '/oz', origins: 'Mexico, Peru, China, Australia', players: 'Fresnillo, Polymetal, Pan American Silver' },
            lithium: { symbol: 'Li', unit: '/t', origins: 'Australia, Chile, China, Argentina', players: 'Albemarle, SQM, Ganfeng Lithium' },
            cobalt: { symbol: 'Co', unit: '/t', origins: 'DRC (70%), Russia, Australia', players: 'Glencore, CMOC, ERG' },
            copper: { symbol: 'Cu', unit: '/lb', origins: 'Chile, Peru, DRC, China', players: 'Codelco, Freeport-McMoRan, BHP' },
            rareEarths: { symbol: 'RE', unit: '', origins: 'China (60%), Myanmar, USA, Australia', players: 'Northern Rare Earths, Lynas, MP Materials' }
        };

        let minerals = {};
        Object.keys(MINERAL_REF).forEach(k => {
            minerals[k] = { ...MINERAL_REF[k], price: null };
        });

        if (serperKey) {
            try {
                // Batch 1: precious metals
                const preciousRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'gold silver price per ounce today 2026', num: 5, gl: 'us', hl: 'en' })
                });
                if (preciousRes.ok) {
                    const data = await preciousRes.json();
                    // Try knowledge graph
                    const kgPrice = data.knowledgeGraph?.attributes?.['Price'] || data.knowledgeGraph?.description || '';
                    const kgMatch = kgPrice.match(/\$[\d,]+\.?\d*/);
                    if (kgMatch) minerals.gold.price = kgMatch[0];

                    for (const r of (data.organic || [])) {
                        const text = `${r.title} ${r.snippet}`;
                        if (!minerals.gold.price) {
                            const m = text.match(/gold.*?\$\s*([\d,]+\.?\d*)/i) || text.match(/\$\s*([\d,]+\.?\d*).*?(?:per\s+ounce|\/oz)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.gold.price = `$${m[1]}`;
                        }
                        if (!minerals.silver.price) {
                            const m = text.match(/silver.*?\$\s*([\d,.]+)/i);
                            if (m && parseFloat(m[1].replace(/,/g, '')) < 200) minerals.silver.price = `$${m[1]}`;
                        }
                    }
                }

                // Batch 2: industrial minerals
                const industrialRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'lithium cobalt copper price 2026 per tonne', num: 5, gl: 'us', hl: 'en' })
                });
                if (industrialRes.ok) {
                    const data = await industrialRes.json();
                    for (const r of (data.organic || [])) {
                        const text = `${r.title} ${r.snippet}`;
                        if (!minerals.lithium.price) {
                            const m = text.match(/lithium.*?\$\s*([\d,]+)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.lithium.price = `$${m[1]}`;
                        }
                        if (!minerals.cobalt.price) {
                            const m = text.match(/cobalt.*?\$\s*([\d,]+)/i);
                            if (m && parseInt(m[1].replace(/,/g, '')) > 1000) minerals.cobalt.price = `$${m[1]}`;
                        }
                        if (!minerals.copper.price) {
                            const m = text.match(/copper.*?\$\s*([\d,.]+)/i);
                            if (m) minerals.copper.price = `$${m[1]}`;
                        }
                    }
                }

                // Rare earths supply status
                const reRes = await fetch('https://google.serper.dev/search', {
                    method: 'POST',
                    headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ q: 'rare earth minerals supply chain status 2026', num: 2, gl: 'us', hl: 'en' })
                });
                if (reRes.ok) {
                    const reData = await reRes.json();
                    const snippet = reData.organic?.[0]?.snippet || '';
                    if (/shortage|crisis|disruption|restrict|ban|tension/i.test(snippet)) minerals.rareEarths.price = '⚠ CONSTRAINED';
                    else if (/stable|surplus|growth/i.test(snippet)) minerals.rareEarths.price = '✅ STABLE';
                    else minerals.rareEarths.price = '⬤ MONITORED';
                }
            } catch (mineralErr) {
                console.log('[fetch-intel] Mineral pricing skipped:', mineralErr.message);
            }
        }
        // If no items scraped (no API key or all failed), load static fallback
        if (intelItems.length === 0) {
            try {
                const fs = require('fs');
                const path = require('path');
                const staticPath = path.join(__dirname, '../../public/live_intel.json');
                const fallbackData = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
                intelItems = fallbackData.map(item => ({ ...item, isScraped: true }));
            } catch (_) {
                // No static fallback available either
            }
        }

        const payload = { items: intelItems, minerals };
        cache = { data: payload, timestamp: now };
        return { statusCode: 200, headers, body: JSON.stringify(payload) };

    } catch (error) {
        console.error('[fetch-intel] Error:', error.message);

        // Graceful fallback to static file
        try {
            const fs = require('fs');
            const path = require('path');
            const staticPath = path.join(__dirname, '../../public/live_intel.json');
            const fallback = JSON.parse(fs.readFileSync(staticPath, 'utf8'));
            return {
                statusCode: 200,
                headers: { ...headers, 'X-Fallback': 'static' },
                body: JSON.stringify(fallback)
            };
        } catch (_) {
            return { statusCode: 200, headers, body: JSON.stringify([]) };
        }
    }
};

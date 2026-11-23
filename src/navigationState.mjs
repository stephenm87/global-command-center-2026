import { resolveActorId } from './briefingActors.js';

export const VIEW_MODES = Object.freeze(['globe', 'briefings']);

export const categoryColors = Object.freeze({
    'Geopolitics & Conflict': '#ff0066',
    'Governance & Rights': '#fbbf24',
    'Economy & Trade': '#00ccff',
    'Technology & Science': '#00ff88',
    'Health & Society': '#ff9900',
    'Environment & Energy': '#66ff00',
    'Culture & Entertainment': '#ff00ff',
});

export const ACCESSIBLE_TEXT_ACCENTS = Object.freeze({
    '#ff0066': '#ff5c99',
    '#cc0000': '#ff6b6b',
    '#ff00ff': '#f472ff',
});

export const getAccessibleTextAccent = hex => ACCESSIBLE_TEXT_ACCENTS[String(hex || '').toLowerCase()] || hex;

export const THEORY_KEYWORDS = Object.freeze({
    realism: /war|military|nuclear|territory|power|arms|coup|missile|troops|conflict|navy|siege|weapon|sanctions|invasion|balance.of.power|deterrence|security.dilemma|national.interest|strategic|defense|geopolitics|rival|supremacy|hegemony/,
    liberalism: /un\b|united nations|trade|wto|institution|cooperation|treaty|ngo|democracy|aid|climate|multilateral|agreement|imf|world bank|rule.of.law|human.rights|transparency|governance|diplomatic|peace.process|free.trade|interdependence|reform|accountability|election|civil.society/,
    constructivism: /identity|human rights|norms|refugee|sovereignty|dignity|gender|indigenous|culture|legitimacy|narrative|recognition|discourse|ethnic|nationalist|colonial|heritage|community|belonging|framing|perception|social.construct|belief|value|ideology|separatist|self.determination|apartheid|persecution|historical.memory|diaspora/,
    marxism: /class|exploit|capital|labor|worker|inequality|wealth|profit|poverty|wage|neoliberal|austerity|privatization|corporation|oligarch|surplus|proletariat|bourgeois|commodity|extraction|accumulation|sweatshop|factory|garment|supply.chain|debt/,
    structuralism: /core|periphery|dependency|develop|underdevelop|global.south|global.north|colonial|extraction|commodity|raw.material|industrializ|structural|unequal.exchange|world.system|imf|world.bank|debt|loan|aid|conditionality|terms.of.trade|multinational/,
    feminism: /women|gender|female|\bgirl\b|maternal|patriarch|sexual|lgbtq|domestic.violence|reproductive|feminist|masculinit|care.work|trafficking|\bbride\b|dowry|femicide|misogyn|glass.ceiling|pay.gap|gendered|women.rights|abortion|contraception/,
    postcolonialism: /colonial|imperial|decoloni|empire|settler|indigenous|native|subaltern|orientalism|eurocentri|western.gaze|global.south|race|racial|ethnic.cleansing|genocide|reparation|partition|mandate|protectorate|annexed|occupied|liberation|independence|self.determination|diaspora|migration|displacement/,
    greenTheory: /climate|environment|carbon|emissions|pollution|biodiversity|deforestation|ocean|ecosystem|species|sustainability|renewable|fossil.fuel|coal|oil|gas|solar|wind|drought|flood|wildfire|sea.level|glacier|arctic|plastic|waste|conservation|ecology|green|nature|earth/,
    criticalSecurity: /securit|surveillance|terrorism|cyber|border.control|refugee|migrant|asylum|detention|police|intelligence|threat|risk|emergency|crisis|extremism|radicali|civil.liberties|privacy|freedom|censorship|protest|dissent|authoritarian|human.security|food.security|water.security/,
});

export const THEORY_COLORS = Object.freeze({
    realism: '#ff3344',
    liberalism: '#00ddff',
    constructivism: '#00cc99',
    marxism: '#cc0000',
    structuralism: '#9966ff',
    feminism: '#ff66cc',
    postcolonialism: '#ff9933',
    greenTheory: '#33cc33',
    criticalSecurity: '#ff6600',
});

export const THEORY_LABELS = Object.freeze({
    realism: 'Realism',
    liberalism: 'Liberalism',
    constructivism: 'Constructivism',
    marxism: 'Marxism',
    structuralism: 'Structuralism',
    feminism: 'Feminism',
    postcolonialism: 'Postcolonialism',
    greenTheory: 'Green Theory',
    criticalSecurity: 'Critical Security',
});

export function parseViewFromSearch(search = '') {
    const requested = new URLSearchParams(search).get('view');
    if (requested === 'nexus') return 'briefings';
    return VIEW_MODES.includes(requested) ? requested : 'globe';
}

export function parseBriefingEntryFromSearch(search = '') {
    const params = new URLSearchParams(search);
    const rawStep = params.get('step');
    const numericStep = rawStep === null ? undefined : Number(rawStep);
    const step = rawStep === 'all'
        ? 'all'
        : (Number.isInteger(numericStep) && numericStep >= 1 ? numericStep : undefined);
    return {
        tourId: params.get('tour') || undefined,
        nodeId: resolveActorId(params.get('actor'), undefined),
        step,
    };
}

export function getViewFromLocation() {
    if (typeof window === 'undefined') return 'globe';
    return parseViewFromSearch(window.location.search);
}

export function getBriefingEntryFromLocation() {
    if (typeof window === 'undefined') return { tourId: undefined, nodeId: undefined, step: undefined };
    return parseBriefingEntryFromSearch(window.location.search);
}

export const escHtml = s => String(s || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
}[c]));

export const safeHttpUrl = url => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    try {
        const u = new URL(trimmed);
        return ['http:', 'https:'].includes(u.protocol) ? trimmed : '';
    } catch {
        return '';
    }
};

export const safeHref = url => escHtml(safeHttpUrl(url));

export function getLocalIsoDate(now = new Date()) {
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export const isReviewOverdue = (reviewBy, referenceDate = getLocalIsoDate()) => (
    Boolean(reviewBy && reviewBy < referenceDate)
);

export function getCaseReviewNotice(item, referenceDate = getLocalIsoDate()) {
    if (!item || item.status === 'archived') return null;
    if (item.reviewStatus === 'update-in-progress') {
        return `Last reviewed ${item.updatedAt}, update in progress`;
    }
    if (isReviewOverdue(item.reviewBy, referenceDate)) {
        return `Last reviewed ${item.updatedAt} · review overdue since ${item.reviewBy}`;
    }
    return null;
}

export function formatGlobePointTooltip(d, referenceDate = getLocalIsoDate()) {
    if (d.isCluster) {
        const caseDetail = d.caseCount ? ` · ${d.caseCount} EDITORIAL ${d.caseCount === 1 ? 'CASE' : 'CASES'}` : '';
        return `<div style="background:rgba(0,0,0,0.9);padding:10px 14px;border:1px solid #ffcc00;border-radius:20px;font-family:Roboto Mono;color:#ffcc00;font-size:0.875rem;font-weight:900;line-height:1.4;">${d.count} MAP ITEMS${caseDetail} — click to expand</div>`;
    }
    const isLinked = d.data.url
        ? `<div style="color:#00ff88;font-size:0.8rem;margin-top:7px;font-weight:bold;">[ ${d.data.isCaseStudy ? 'OPEN CASE & BRIEFING' : 'CLICK FOR SOURCE'} ]</div>`
        : '';
    const layerLabel = d.data.isCaseStudy
        ? `◆ EDITORIAL CASE · ${d.data.sources?.length || 0} PERSPECTIVES`
        : d.data.isLive ? '[LIVE] CURRENT SOURCE' : 'REFERENCE SOURCE';
    const overdueNotice = d.data.isCaseStudy ? getCaseReviewNotice(d.data, referenceDate) : null;
    const reviewLabel = d.data.isCaseStudy
        ? `<div style="color:${overdueNotice ? '#fbbf24' : '#c4b5fd'};font-size:0.75rem;font-weight:700;margin-top:5px;">${overdueNotice ? `⚠ ${escHtml(overdueNotice)}` : `Last reviewed ${escHtml(d.data.updatedAt)}`}</div>`
        : '';
    const locationLabel = d.locationLabel ? `<div style="color:#b6c5ce;font-size:0.75rem;margin-top:5px;">📍 ${escHtml(d.locationLabel)}</div>` : '';
    return `<div style="background:rgba(0,0,0,0.94);padding:14px;border:1px solid ${d.color};border-radius:6px;font-family:Roboto Mono;color:#00ffff;max-width:340px;box-shadow:0 0 15px ${d.color}44;line-height:1.45;">
                    <div style="color:${d.color};font-size:0.75rem;font-weight:700;margin-bottom:6px;">${layerLabel}</div>
                    <div style="font-size:1rem;color:#fff;">${escHtml(d.data['Entity/Subject'])}</div>
                    ${locationLabel}
                    ${reviewLabel}
                    ${isLinked}
                  </div>`;
}

export const dedupeClusterItems = items => {
    const caseIds = new Set();
    return (items || []).filter(item => {
        if (!item.isCaseStudy || !item.caseStudyId) return true;
        if (caseIds.has(item.caseStudyId)) return false;
        caseIds.add(item.caseStudyId);
        return true;
    });
};

export function clusterPoints(points, radius = 8) {
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < points.length; i++) {
        if (used.has(i)) continue;
        const group = [points[i]];
        used.add(i);
        for (let j = i + 1; j < points.length; j++) {
            if (used.has(j)) continue;
            const dlat = Math.abs(points[i].lat - points[j].lat);
            const dlng = Math.abs(points[i].lng - points[j].lng);
            if (dlat < radius && dlng < radius) {
                group.push(points[j]);
                used.add(j);
            }
        }
        if (group.length === 1) {
            clusters.push(group[0]);
        } else {
            const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
            const avgLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
            const dominant = group.reduce((a, b) => (a.size > b.size ? a : b));
            clusters.push({
                lat: avgLat,
                lng: avgLng,
                size: Math.min(2.5, 0.8 + group.length * 0.25),
                color: dominant.color,
                isCluster: true,
                count: group.length,
                caseCount: new Set(
                    group
                        .filter(point => point.data?.isCaseStudy && point.data?.caseStudyId)
                        .map(point => point.data.caseStudyId)
                ).size,
                items: group.map(g => g.data),
                data: dominant.data,
            });
        }
    }
    return clusters;
}

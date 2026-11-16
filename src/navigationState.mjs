import { resolveActorId } from './nexus/actorIds.js';

export const VIEW_MODES = Object.freeze(['globe', 'briefings', 'nexus']);

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
    return VIEW_MODES.includes(requested) ? requested : 'globe';
}

export function parseBriefingEntryFromSearch(search = '') {
    const params = new URLSearchParams(search);
    const rawStep = params.get('step');
    const numericStep = rawStep === null ? undefined : Number(rawStep);
    return {
        tourId: params.get('tour') || undefined,
        nodeId: resolveActorId(params.get('actor'), undefined),
        step: Number.isInteger(numericStep) && numericStep >= 1 ? numericStep : undefined,
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

export const isReviewOverdue = (reviewBy, referenceDate = new Date().toISOString().slice(0, 10)) => (
    Boolean(reviewBy && reviewBy < referenceDate)
);

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

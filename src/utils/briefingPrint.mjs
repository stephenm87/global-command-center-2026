import { safeHttpUrl } from '../navigationState.mjs';

export const FORECAST_EXPORT_LIMIT = 40;
export const DEFAULT_PUBLIC_ORIGIN = 'https://globalcommandcenter2026.netlify.app';

export function normalizePrintText(text) {
    return typeof text === 'string' ? text.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

export function isSamePrintText(a, b) {
    const left = normalizePrintText(a);
    const right = normalizePrintText(b);
    return Boolean(left && right && left === right);
}

export function formatExportDate(date = new Date()) {
    const d = date instanceof Date && !Number.isNaN(date.getTime()) ? date : new Date();
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

export function buildCasePrintTitle(caseTitle) {
    const clean = String(caseTitle || '').trim() || 'Case Briefing';
    return `${clean} - Global Command Center briefing`;
}

export function buildListPrintTitle(mode) {
    if (mode === 'news') return 'Live News Intel Briefing - Global Command Center';
    return 'Global Intelligence Briefing - Global Command Center';
}

export function buildCasePrintUrl(tourId) {
    const cleanId = String(tourId || '').trim();
    const target = cleanId
        ? `${DEFAULT_PUBLIC_ORIGIN}/?view=briefings&tour=${encodeURIComponent(cleanId)}`
        : `${DEFAULT_PUBLIC_ORIGIN}/?view=briefings`;
    return safeHttpUrl(target) || `${DEFAULT_PUBLIC_ORIGIN}/?view=briefings`;
}

export function buildPageUrl(locationHref) {
    if (typeof locationHref === 'string' && locationHref.trim()) {
        try {
            const parsed = new URL(locationHref);
            if (parsed.hostname === 'globalcommandcenter2026.netlify.app') {
                return safeHttpUrl(locationHref) || DEFAULT_PUBLIC_ORIGIN;
            }
        } catch {
            return DEFAULT_PUBLIC_ORIGIN;
        }
    }
    return DEFAULT_PUBLIC_ORIGIN;
}

export function collectSanitizedSources(tour) {
    if (!tour) return [];
    const seenUrls = new Set();
    const collected = [];
    const pushSource = (source, isSupplemental) => {
        if (!source || typeof source !== 'object') return;
        const rawUrl = typeof source.url === 'string' ? source.url : '';
        if (!rawUrl || seenUrls.has(rawUrl)) return;
        seenUrls.add(rawUrl);
        collected.push({
            number: collected.length + 1,
            publisher: source.publisher || '',
            title: source.title || '',
            dateLabel: source.dateLabel || '',
            perspectiveType: source.perspectiveType || '',
            perspective: source.perspective || '',
            supports: source.supports || '',
            rawUrl,
            safeUrl: safeHttpUrl(rawUrl),
            isSupplemental,
        });
    };

    for (const src of tour.sources || []) pushSource(src, false);
    for (const src of tour.supplementalSources || []) pushSource(src, true);
    return collected;
}

const CONNECTION_TYPE_LABELS = {
    conflict: 'Conflict',
    pressure: 'Pressure',
    support: 'Support',
    movement: 'Movement',
};

export function collectActorMapConnections(tour) {
    const connections = tour?.actorMap?.connections;
    if (!Array.isArray(connections) || connections.length === 0) return [];
    const actorNameById = new Map((tour.actorMap.actors || []).map(actor => [actor.id, actor.name]));
    return connections.map((conn, idx) => {
        const rawType = String(conn.type || '').trim();
        const type = CONNECTION_TYPE_LABELS[rawType]
            || (rawType ? `${rawType[0].toUpperCase()}${rawType.slice(1)}` : '');
        return {
            id: conn.id || `${conn.from}-${conn.to}-${idx}`,
            from: actorNameById.get(conn.from) || conn.from || '',
            to: actorNameById.get(conn.to) || conn.to || '',
            type,
            description: String(conn.label || conn.text || '').trim(),
        };
    });
}

export function sanitizeListItems(items, limit = null) {
    const rawList = Array.isArray(items) ? items : [];
    const sliced = Number.isInteger(limit) && limit >= 0 ? rawList.slice(0, limit) : rawList;
    return sliced.map((item, index) => ({
        index: index + 1,
        category: item?.Broad_Category || item?.['Topic/Sector'] || 'GLOBAL',
        subject: item?.['Entity/Subject'] || '',
        players: item?.['Key Player/Organization'] || '—',
        impact: item?.['Expected Impact/Value'] || '—',
        timeline: item?.Timeline || '—',
        sourceLabel: item?.Source || '',
        safeUrl: safeHttpUrl(item?.url),
    }));
}

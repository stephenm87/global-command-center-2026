import { safeHttpUrl } from '../navigationState.mjs';

export const FORECAST_EXPORT_LIMIT = 40;
export const DEFAULT_PUBLIC_ORIGIN = 'https://globalcommandcenter2026.netlify.app';

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

export function buildCasePrintUrl(tourId, locationHref) {
    const cleanId = String(tourId || '').trim();
    let origin = DEFAULT_PUBLIC_ORIGIN;
    if (typeof locationHref === 'string' && locationHref.trim()) {
        try {
            const parsed = new URL(locationHref);
            if (['http:', 'https:'].includes(parsed.protocol)) {
                origin = parsed.origin;
            }
        } catch {
            origin = DEFAULT_PUBLIC_ORIGIN;
        }
    }
    const target = cleanId
        ? `${origin}/?view=briefings&tour=${encodeURIComponent(cleanId)}`
        : `${origin}/?view=briefings`;
    return safeHttpUrl(target) || `${DEFAULT_PUBLIC_ORIGIN}/?view=briefings`;
}

export function buildPageUrl(locationHref) {
    if (typeof locationHref === 'string' && locationHref.trim()) {
        const clean = safeHttpUrl(locationHref);
        if (clean) return clean;
    }
    return DEFAULT_PUBLIC_ORIGIN;
}

export function collectSanitizedSources(tour) {
    if (!tour) return [];
    const seenKeys = new Set();
    const collected = [];
    const pushSource = (source, isSupplemental) => {
        if (!source || typeof source !== 'object') return;
        const rawUrl = typeof source.url === 'string' ? source.url.trim() : '';
        const key = rawUrl || `__no_url_${collected.length}`;
        if (rawUrl && seenKeys.has(key)) return;
        if (rawUrl) seenKeys.add(key);
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

/**
 * Pure builders for the Editorial Cases globe layers.
 *
 * Every arc drawn here connects locations that a single case explicitly maps
 * in its own `map.locations`. Arcs therefore show the geography an editor
 * attached to a case, never an inferred relationship between unrelated items.
 */
import { categoryColors, isReviewOverdue, getLocalIsoDate } from '../navigationState.mjs';

export const CASE_FALLBACK_COLOR = '#b69cff';

export const CATEGORY_SHORT_LABELS = Object.freeze({
    'Geopolitics & Conflict': 'Conflict',
    'Governance & Rights': 'Governance',
    'Economy & Trade': 'Economy',
    'Technology & Science': 'Technology',
    'Health & Society': 'Health',
    'Environment & Energy': 'Environment',
    'Culture & Entertainment': 'Culture',
});

export function caseColor(item) {
    return categoryColors[item?.Broad_Category] || CASE_FALLBACK_COLOR;
}

export function hexToRgba(hex, alpha) {
    const clean = String(hex || '').replace('#', '');
    const full = clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean;
    const value = Number.parseInt(full, 16);
    if (!Number.isFinite(value) || full.length !== 6) return `rgba(182, 156, 255, ${alpha})`;
    const r = (value >> 16) & 255;
    const g = (value >> 8) & 255;
    const b = value & 255;
    return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}

const validLocation = location => (
    location
    && Number.isFinite(Number(location.latitude))
    && Number.isFinite(Number(location.longitude))
);

function caseLocations(item) {
    return (item?.map?.locations || []).filter(validLocation);
}

/**
 * One pulsing ring per mapped case location. Overdue cases pulse slower and
 * smaller so freshness is visible at a glance without hiding the case.
 */
export function buildCaseRings(items, referenceDate = getLocalIsoDate()) {
    const rings = [];
    for (const item of items || []) {
        if (!item?.isCaseStudy || item.status === 'archived') continue;
        const overdue = item.reviewStatus === 'update-in-progress' || isReviewOverdue(item.reviewBy, referenceDate);
        const color = caseColor(item);
        caseLocations(item).forEach((location, index) => {
            const primary = index === 0;
            rings.push({
                lat: Number(location.latitude),
                lng: Number(location.longitude),
                color,
                overdue,
                primary,
                maxRadius: overdue ? 1.3 : primary ? 2.6 : 1.8,
                propagationSpeed: overdue ? 0.7 : 1.6,
                repeatPeriod: overdue ? 2600 : primary ? 1100 : 1500,
                caseStudyId: item.caseStudyId,
            });
        });
    }
    return rings;
}

/**
 * Pairs of locations to connect for a case, following its declared map mode:
 * - `route`: consecutive locations, in the order the case lists them.
 * - `regional`: hub-and-spoke from the primary (first) location.
 * - `global` and `point`: none. Global locations are representative examples,
 *   not connected places, and a point case has nothing to connect.
 */
export function caseLocationPairs(item) {
    const locations = caseLocations(item);
    const mode = item?.map?.mode;
    if (locations.length < 2 || mode === 'global' || mode === 'point') return [];
    if (mode === 'route') {
        return locations.slice(1).map((destination, index) => [locations[index], destination]);
    }
    const [origin, ...others] = locations;
    return others.map(destination => [origin, destination]);
}

/** Arcs for every non-archived case, following `caseLocationPairs`. */
export function buildCaseArcs(items) {
    const arcs = [];
    for (const item of items || []) {
        if (!item?.isCaseStudy || item.status === 'archived') continue;
        const pairs = caseLocationPairs(item);
        if (pairs.length === 0) continue;
        const color = caseColor(item);
        const label = CATEGORY_SHORT_LABELS[item.Broad_Category] || 'Case';
        const idHash = [...String(item.caseStudyId || '')].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 997, 0);
        pairs.forEach(([origin, destination], pairIndex) => {
            const startLat = Number(origin.latitude);
            const startLng = Number(origin.longitude);
            const endLat = Number(destination.latitude);
            const endLng = Number(destination.longitude);
            const distance = Math.hypot(endLat - startLat, endLng - startLng);
            const initialGap = ((idHash + pairIndex * 37) % 100) / 100;
            arcs.push({
                startLat,
                startLng,
                endLat,
                endLng,
                color: [hexToRgba(color, 0.95), hexToRgba(color, 0.35)],
                altitude: Math.min(0.45, 0.06 + distance / 260),
                initialGap,
                relType: label.toUpperCase(),
                relHex: color,
                caseTitle: item['Entity/Subject'],
                caseStudyId: item.caseStudyId,
                fromName: origin.label,
                toName: destination.label,
                fromImpact: origin.role || '',
                toImpact: destination.role || '',
                fromFull: item,
                toFull: item,
            });
        });
    }
    return arcs;
}

/**
 * Rows for the operational "case links" panel, limited to conflict cases so
 * the high-stress view highlights the geography of active conflict cases.
 */
export function buildConflictCasePairs(arcs) {
    return (arcs || [])
        .filter(arc => arc.fromFull?.Broad_Category === 'Geopolitics & Conflict')
        .map(arc => ({
            from: arc.fromName,
            to: arc.toName,
            fromOrg: arc.fromName,
            toOrg: arc.toName,
            caseTitle: arc.caseTitle,
            relType: arc.relType,
            relIcon: '◆',
            relHex: arc.relHex,
        }));
}

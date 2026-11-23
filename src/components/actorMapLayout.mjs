/**
 * Screen-space collision-free label placement solver shared by both the 3D
 * actor map (DOM buttons) and 2D flat SVG fallback. Never shrinks fonts below
 * design size and hides lower-priority labels first across 390px-1900px.
 */

const CHAR_WIDTH_PRIMARY = 7.1;
const CHAR_WIDTH_SUB = 6.0;
const CHAR_WIDTH_LINK = 6.6;
const CHAR_WIDTH_COUNTRY = 7.8;

const intersects = (a, b, pad = 2) => !(
    a.x1 + pad <= b.x0
    || a.x0 - pad >= b.x1
    || a.y1 + pad <= b.y0
    || a.y0 - pad >= b.y1
);

export function segmentIntersectsBox(p0, p1, box, pad = 4) {
    if (!p0 || !p1 || !box) return false;
    const minX = box.x0 - pad;
    const maxX = box.x1 + pad;
    const minY = box.y0 - pad;
    const maxY = box.y1 + pad;
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    let t0 = 0;
    let t1 = 1;
    const clip = (p, q) => {
        if (Math.abs(p) < 1e-9) return q >= 0;
        const r = q / p;
        if (p < 0) {
            if (r > t1) return false;
            if (r > t0) t0 = r;
        } else {
            if (r < t0) return false;
            if (r < t1) t1 = r;
        }
        return true;
    };
    return (
        clip(-dx, p0.x - minX)
        && clip(dx, maxX - p0.x)
        && clip(-dy, p0.y - minY)
        && clip(dy, maxY - p0.y)
    );
}

export function boxIntersectsArcs(box, arcPoints = [], { excludeArcId = null, pad = 4 } = {}) {
    if (!box) return false;
    for (const arc of arcPoints) {
        if (excludeArcId && arc.id === excludeArcId) continue;
        const pts = arc.points || [];
        if (pts.length === 1) {
            if (pointNearBox(pts[0], box, pad)) return true;
            continue;
        }
        for (let i = 0; i < pts.length - 1; i += 1) {
            if (segmentIntersectsBox(pts[i], pts[i + 1], box, pad)) return true;
        }
    }
    return false;
}

/**
 * Deterministically pushes apart projected markers whose circles would overlap
 * on screen (dist < r1 + r2 + minGap) while leaving well-separated markers untouched.
 */
export function resolveMarkerCollisions(
    markers = [],
    { width = 640, height = 480, padding = 10, minGap = 2, maxIterations = 24 } = {},
) {
    const pos = markers.map(m => ({
        id: m.id,
        origX: m.x,
        origY: m.y,
        x: m.x,
        y: m.y,
        r: m.r || 7,
    }));

    for (let iter = 0; iter < maxIterations; iter += 1) {
        let moved = false;
        for (let i = 0; i < pos.length; i += 1) {
            for (let j = i + 1; j < pos.length; j += 1) {
                const a = pos[i];
                const b = pos[j];
                let dx = b.x - a.x;
                let dy = b.y - a.y;
                let dist = Math.hypot(dx, dy);
                const minDist = a.r + b.r + minGap;
                if (dist >= minDist) continue;
                if (dist < 1e-3) {
                    const angle = ((i * 1.7 + j * 0.9) % (Math.PI * 2));
                    dx = Math.cos(angle);
                    dy = Math.sin(angle);
                    dist = 1;
                }
                const push = (minDist - dist) * 0.52;
                const ux = dx / dist;
                const uy = dy / dist;
                a.x -= ux * push;
                a.y -= uy * push;
                b.x += ux * push;
                b.y += uy * push;
                moved = true;
            }
        }
        for (const p of pos) {
            const margin = padding + p.r;
            p.x = Math.max(margin, Math.min(width - margin, p.x));
            p.y = Math.max(margin, Math.min(height - margin, p.y));
        }
        if (!moved) break;
    }

    const out = new Map();
    for (const p of pos) {
        out.set(p.id, {
            x: p.x,
            y: p.y,
            dx: p.x - p.origX,
            dy: p.y - p.origY,
        });
    }
    return out;
}

const insideFrame = (box, width, height, padding) => (
    box.x0 >= padding
    && box.x1 <= width - padding
    && box.y0 >= padding
    && box.y1 <= height - padding
);

const pointNearBox = (pt, box, pad = 5) => (
    pt.x >= box.x0 - pad
    && pt.x <= box.x1 + pad
    && pt.y >= box.y0 - pad
    && pt.y <= box.y1 + pad
);

const TOP_BOTTOM_NUDGE_X = [0, 18, -18, 36, -36, 56, -56, 76, -76];

export function splitActorLabelLines(title) {
    const clean = String(title || '').trim();
    if (clean.length < 12) return [clean];
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length < 2) return [clean];

    let best = null;
    let bestScore = Infinity;
    for (let i = 1; i < words.length; i += 1) {
        const line1 = words.slice(0, i).join(' ');
        const line2 = words.slice(i).join(' ');
        const maxLen = Math.max(line1.length, line2.length);
        const balance = Math.abs(line1.length - line2.length);
        const score = maxLen * 10 + balance;
        if (score < bestScore) {
            bestScore = score;
            best = [line1, line2];
        }
    }
    return best || [clean];
}

export function actorLabelBox(x, y, r, side, title, note = '', offsetX = 0, lines = null) {
    const titleLines = Array.isArray(lines) && lines.length > 0 ? lines : [String(title || '')];
    const titleW = Math.max(...titleLines.map(l => String(l || '').length)) * CHAR_WIDTH_PRIMARY;
    const subW = note ? String(note).length * CHAR_WIDTH_SUB : 0;
    const w = Math.max(titleW, subW) + 14;
    const h = titleLines.length * 14 + (note ? 13 : 0) + 4;
    const gap = r + 8;

    if (side === 'r') {
        const x0 = x + gap;
        const y0 = y - h / 2;
        return { x0, y0, x1: x0 + w, y1: y0 + h };
    }
    if (side === 'l') {
        const x1 = x - gap;
        const y0 = y - h / 2;
        return { x0: x1 - w, y0, x1, y1: y0 + h };
    }
    if (side === 't') {
        const x0 = x - w / 2 + offsetX;
        const y1 = y - gap;
        return { x0, y0: y1 - h, x1: x0 + w, y1 };
    }
    if (side === 'b') {
        const x0 = x - w / 2 + offsetX;
        const y0 = y + gap;
        return { x0, y0, x1: x0 + w, y1: y0 + h };
    }
    if (side === 'tr') {
        const x0 = x + gap * 0.75;
        const y1 = y - gap * 0.65;
        return { x0, y0: y1 - h, x1: x0 + w, y1 };
    }
    if (side === 'tl') {
        const x1 = x - gap * 0.75;
        const y1 = y - gap * 0.65;
        return { x0: x1 - w, y0: y1 - h, x1, y1 };
    }
    if (side === 'br') {
        const x0 = x + gap * 0.75;
        const y0 = y + gap * 0.65;
        return { x0, y0, x1: x0 + w, y1: y0 + h };
    }
    const x1 = x - gap * 0.75;
    const y0 = y + gap * 0.65;
    return { x0: x1 - w, y0, x1, y1: y0 + h };
}

export function linkLabelBox(x, y, text) {
    const w = String(text || '').length * CHAR_WIDTH_LINK + 16;
    const h = 22;
    return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

export function countryLabelBox(x, y, text) {
    const w = String(text || '').length * CHAR_WIDTH_COUNTRY + 6;
    const h = 14;
    return { x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 };
}

const DEFAULT_SIDE_ORDER = ['r', 'l', 't', 'b', 'tr', 'br', 'tl', 'bl'];

function orderedSides(preferredSide) {
    if (!preferredSide || !DEFAULT_SIDE_ORDER.includes(preferredSide)) {
        return DEFAULT_SIDE_ORDER;
    }
    return [preferredSide, ...DEFAULT_SIDE_ORDER.filter(s => s !== preferredSide)];
}

/**
 * Places labels greedily by priority against marker obstacles, HUD boxes,
 * floating badges, and already-accepted labels.
 */
export function solveActorMapLabels({
    width,
    height,
    markers = [],
    floatingBadges = [],
    actorLabels = [],
    linkLabels = [],
    countryLabels = [],
    arcPoints = [],
    reservedBoxes = [],
    padding = 8,
}) {
    const occupied = [];

    // Reserve fixed HUD boxes and floating badges (including caption beneath badge)
    for (const box of reservedBoxes) {
        if (box) occupied.push({ ...box });
    }
    for (const badge of floatingBadges) {
        occupied.push({
            x0: badge.cx - badge.w / 2 - 4,
            y0: badge.cy - badge.h / 2 - 2,
            x1: badge.cx + badge.w / 2 + 4,
            y1: badge.cy + badge.h / 2 + 16,
        });
    }
    // Every visible actor marker circle is a hard obstacle
    const markerBoxes = markers.map(m => ({
        id: m.id,
        box: {
            x0: m.x - (m.r || 8) - 2,
            y0: m.y - (m.r || 8) - 2,
            x1: m.x + (m.r || 8) + 2,
            y1: m.y + (m.r || 8) + 2,
        },
    }));

    const isFree = (candidate, ownMarkerId = null) => {
        if (!insideFrame(candidate, width, height, padding)) return false;
        for (const m of markerBoxes) {
            if (ownMarkerId && m.id === ownMarkerId) continue;
            if (intersects(candidate, m.box, 2)) return false;
        }
        for (const box of occupied) {
            if (intersects(candidate, box, 3)) return false;
        }
        return true;
    };

    const sortedActors = [...actorLabels].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const placedActors = new Map();

    for (const item of sortedActors) {
        if (item.hidden) {
            placedActors.set(item.id, { visible: false, side: item.preferredSide || 'r', showNote: false, offsetX: 0, lines: [item.name], box: null });
            continue;
        }
        const sides = orderedSides(item.preferredSide);
        const singleLines = [String(item.name || '')];
        const wrappedLines = splitActorLabelLines(item.name);
        const hasWrap = wrappedLines.length > 1;
        const attempts = item.note
            ? [
                { showNote: true, lines: singleLines },
                ...(hasWrap ? [{ showNote: true, lines: wrappedLines }] : []),
                { showNote: false, lines: singleLines },
                ...(hasWrap ? [{ showNote: false, lines: wrappedLines }] : []),
            ]
            : [
                { showNote: false, lines: singleLines },
                ...(hasWrap ? [{ showNote: false, lines: wrappedLines }] : []),
            ];

        let chosen = null;
        for (const { showNote, lines } of attempts) {
            for (const side of sides) {
                const offsets = (side === 't' || side === 'b') ? TOP_BOTTOM_NUDGE_X : [0];
                for (const offsetX of offsets) {
                    const box = actorLabelBox(item.x, item.y, item.r || 8, side, item.name, showNote ? item.note : '', offsetX, lines);
                    if (offsetX !== 0 && (item.x < box.x0 - 10 || item.x > box.x1 + 10)) continue;
                    if (!isFree(box, item.id)) continue;
                    if (!boxIntersectsArcs(box, arcPoints, { excludeArcId: null, pad: 4 })) {
                        chosen = { visible: true, side, showNote, offsetX, lines, box };
                        break;
                    }
                }
                if (chosen) break;
            }
            if (chosen) {
                occupied.push(chosen.box);
                break;
            }
        }

        if (!chosen) {
            chosen = { visible: false, side: item.preferredSide || 'r', showNote: false, offsetX: 0, lines: singleLines, box: null };
        }
        placedActors.set(item.id, chosen);
    }

    const sortedLinks = [...linkLabels].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    const placedLinks = new Map();

    for (const item of sortedLinks) {
        if (item.hidden || !Array.isArray(item.candidates) || item.candidates.length === 0) {
            placedLinks.set(item.id, { visible: false, candidate: null, box: null });
            continue;
        }
        let chosen = null;
        let ownArcOnly = null;
        for (const cand of item.candidates) {
            const box = linkLabelBox(cand.x, cand.y, item.label);
            if (!isFree(box, null)) continue;
            if (!boxIntersectsArcs(box, arcPoints, { excludeArcId: null, pad: 4 })) {
                chosen = { visible: true, candidate: cand, box };
                break;
            }
            if (!ownArcOnly && !boxIntersectsArcs(box, arcPoints, { excludeArcId: item.id, pad: 4 })) {
                ownArcOnly = { visible: true, candidate: cand, box };
            }
        }
        if (!chosen && ownArcOnly) chosen = ownArcOnly;
        if (chosen) occupied.push(chosen.box);
        placedLinks.set(item.id, chosen || { visible: false, candidate: null, box: null });
    }

    const placedCountries = new Map();
    for (const item of countryLabels) {
        const box = countryLabelBox(item.x, item.y, item.name);
        if (isFree(box, null) && !boxIntersectsArcs(box, arcPoints, { excludeArcId: null, pad: 4 })) {
            occupied.push(box);
            placedCountries.set(item.name, { visible: true, x: item.x, y: item.y, box });
        } else {
            placedCountries.set(item.name, { visible: false, x: item.x, y: item.y, box: null });
        }
    }

    return { actors: placedActors, links: placedLinks, countries: placedCountries, occupied };
}

export const CLUSTER_DOT_RADIUS = 12;

export function buildStepClusterIndex(step) {
    const clusters = Array.isArray(step?.clusters) ? step.clusters : [];
    const clusterById = new Map();
    const actorToCluster = new Map();
    for (const cluster of clusters) {
        if (!cluster?.id) continue;
        clusterById.set(cluster.id, cluster);
        for (const memberId of cluster.memberIds || []) {
            actorToCluster.set(memberId, cluster);
        }
    }
    return { clusters, clusterById, actorToCluster };
}

export function isStepConnectionVisible(conn, actorToCluster) {
    if (!conn) return false;
    const cFrom = actorToCluster?.get(conn.from);
    const cTo = actorToCluster?.get(conn.to);
    return !(cFrom && cTo && cFrom.id === cTo.id);
}

export function isRelatedActorMapItem(selected, kind, id, step, connById) {
    if (!selected) return true;
    if (selected.kind === 'place') return false;
    const { clusterById, actorToCluster } = buildStepClusterIndex(step);
    const isActorInIdOrCluster = (actorId, targetKind, targetId) => {
        if (targetKind === 'actor') return actorId === targetId;
        if (targetKind === 'cluster') return actorToCluster.get(actorId)?.id === targetId;
        return false;
    };

    if (selected.kind === 'connection') {
        if (kind === 'connection') return id === selected.id;
        const c = connById.get(selected.id);
        if (!c) return false;
        return isActorInIdOrCluster(c.from, kind, id) || isActorInIdOrCluster(c.to, kind, id);
    }

    if (selected.kind === 'cluster') {
        const cluster = clusterById.get(selected.id);
        const members = new Set(cluster?.memberIds || []);
        if (kind === 'cluster') return id === selected.id;
        if (kind === 'actor') {
            if (members.has(id)) return true;
            return (step?.connections || []).some(cid => {
                const c = connById.get(cid);
                return c && ((members.has(c.from) && c.to === id) || (members.has(c.to) && c.from === id));
            });
        }
        const c = connById.get(id);
        return c ? (members.has(c.from) || members.has(c.to)) : false;
    }

    if (selected.kind === 'actor') {
        if (kind === 'cluster') {
            const cluster = clusterById.get(id);
            const members = new Set(cluster?.memberIds || []);
            if (members.has(selected.id)) return true;
            return (step?.connections || []).some(cid => {
                const c = connById.get(cid);
                return c && (
                    (c.from === selected.id && members.has(c.to))
                    || (c.to === selected.id && members.has(c.from))
                );
            });
        }
        if (kind === 'actor') {
            if (id === selected.id) return true;
            return (step?.connections || []).some(cid => {
                const c = connById.get(cid);
                return c && ((c.from === selected.id && c.to === id) || (c.to === selected.id && c.from === id));
            });
        }
        const c = connById.get(id);
        return c ? (c.from === selected.id || c.to === selected.id) : false;
    }
    return true;
}

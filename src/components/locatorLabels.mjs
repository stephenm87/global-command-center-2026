/** Collision-aware label placement for the case locator map. */
const LABEL_CHAR_WIDTH = 5.7;
const LABEL_HEIGHT = 11;
const MAX_LABEL_CHARS = 24;

const shortLabel = label => (label.length > MAX_LABEL_CHARS ? `${label.slice(0, MAX_LABEL_CHARS - 1)}…` : label);

/**
 * Greedy label placement: score six positions around each point and keep the
 * one with the fewest overlaps that stays inside the frame.
 */
export function placeLabels(points, width = 360, height = 260) {
    const placed = [];
    const dots = points.map(p => ({ x0: p.x - 5, y0: p.y - 5, x1: p.x + 5, y1: p.y + 5 }));
    const overlaps = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
    return points.map((point, index) => {
        const text = shortLabel(point.label || '');
        const w = text.length * LABEL_CHAR_WIDTH;
        const candidates = [
            { dx: 8, dy: -6, anchor: 'start' },
            { dx: 8, dy: 13, anchor: 'start' },
            { dx: -8, dy: -6, anchor: 'end' },
            { dx: -8, dy: 13, anchor: 'end' },
            { dx: 0, dy: -12, anchor: 'middle' },
            { dx: 0, dy: 20, anchor: 'middle' },
        ];
        const boxFor = c => {
            const x = point.x + c.dx;
            const y = point.y + c.dy;
            const x0 = c.anchor === 'start' ? x : c.anchor === 'end' ? x - w : x - w / 2;
            return { x0, y0: y - LABEL_HEIGHT + 2, x1: x0 + w, y1: y + 2 };
        };
        const fits = box => box.x0 >= 4 && box.x1 <= width - 4 && box.y0 >= 4 && box.y1 <= height - 4;
        const score = c => {
            const box = boxFor(c);
            if (!fits(box)) return Number.POSITIVE_INFINITY;
            return placed.filter(other => overlaps(box, other)).length * 10
                + dots.filter((dot, di) => di !== index && overlaps(box, dot)).length;
        };
        let choice = candidates[0];
        let best = Number.POSITIVE_INFINITY;
        for (const c of candidates) {
            const value = score(c);
            if (value < best) { best = value; choice = c; }
            if (value === 0) break;
        }
        const box = boxFor(choice);
        placed.push(box);
        return { text, fullText: String(point.label || ''), x: point.x + choice.dx, y: point.y + choice.dy, anchor: choice.anchor };
    });
}

/**
 * Pure spherical camera, projection, framing, arc-profile, and floating-badge
 * geometry shared by the 3D WebGL actor map, 2D flat fallback, and Node tests.
 */
import { geoDistance, geoInterpolate, geoOrthographic } from 'd3-geo';

export const GLOBE_RADIUS = 100;
export const DEFAULT_FOV_DEG = 50;
export const FLIGHT_DURATION_MS = 1500;

export const DASH_SPEC = Object.freeze({
    conflict: [0, 0, 0],
    pressure: [0.024, 0.015, 4200],
    support: [0.011, 0.011, 3600],
    movement: [0.004, 0.011, 3000],
});

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

export function cubicInOut(t) {
    const k = Math.max(0, Math.min(1, t));
    return k < 0.5 ? 4 * k * k * k : 1 - ((-2 * k + 2) ** 3) / 2;
}

export function visAltitudeBase(camDist = 0.5) {
    return 0.0012 + Math.max(0.03, camDist) * 0.011;
}

/** Matches three-globe's polar2Cartesian convention exactly. */
export function latLngAltToVec3(lat, lng, alt = 0, radius = GLOBE_RADIUS) {
    const phi = (90 - lat) * DEG_TO_RAD;
    const theta = (90 - lng) * DEG_TO_RAD;
    const r = radius * (1 + alt);
    const phiSin = Math.sin(phi);
    return [
        r * phiSin * Math.cos(theta),
        r * Math.cos(phi),
        r * phiSin * Math.sin(theta),
    ];
}

export function vec3ToLatLngAlt(x, y, z, radius = GLOBE_RADIUS) {
    const r = Math.hypot(x, y, z) || radius;
    const clampedCosPhi = Math.max(-1, Math.min(1, y / r));
    const phi = Math.acos(clampedCosPhi);
    const theta = Math.atan2(z, x);
    const lat = 90 - phi * RAD_TO_DEG;
    let lng = 90 - theta * RAD_TO_DEG;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng, alt: r / radius - 1 };
}

const add3 = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub3 = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const scale3 = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len3 = a => Math.hypot(a[0], a[1], a[2]);
const norm3 = a => {
    const l = len3(a) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
};
const cross3 = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
];

/**
 * Computes custom camera position, up vector, and surface focus point.
 * Pointing lookAt at the focus point on the sphere avoids center-locked views
 * and enables horizon tilt on close-up views while staying outside the globe.
 */
export function computeCameraPose(cam, sway = { h: 0, t: 0 }, driftDeg = 0, radius = GLOBE_RADIUS) {
    const lat = Math.max(-85, Math.min(85, Number(cam?.lat) || 0));
    const lng = Number(cam?.lng) || 0;
    const dist = Math.max(0.035, Number(cam?.dist) || 0.5);
    const p = latLngAltToVec3(lat, lng, 0, radius);
    const n = norm3(p);
    const north = norm3(sub3(latLngAltToVec3(Math.min(89.5, lat + 0.05), lng, 0, radius), p));
    const east = norm3(cross3(north, n));

    const hRad = ((sway?.h || 0) + driftDeg) * DEG_TO_RAD;
    const tiltDeg = Math.max(0, Math.min(66, (Number(cam?.tilt) || 0) + (sway?.t || 0)));
    const tRad = tiltDeg * DEG_TO_RAD;

    const fwd = norm3(add3(scale3(north, Math.cos(hRad)), scale3(east, Math.sin(hRad))));
    const position = add3(
        add3(p, scale3(n, radius * dist * Math.cos(tRad))),
        scale3(fwd, -radius * dist * Math.sin(tRad)),
    );
    const up = norm3(add3(scale3(n, Math.sin(tRad)), scale3(fwd, Math.cos(tRad))));
    return {
        position,
        up,
        target: p,
        distanceFromCenter: len3(position),
        visBase: visAltitudeBase(dist),
    };
}

/**
 * Great-circle + logarithmic-altitude camera flight. Guarantees the camera
 * rises smoothly on wide hops and never passes through the globe.
 */
export function interpolateCamera(a, b, k) {
    const clampedK = Math.max(0, Math.min(1, k));
    const e = cubicInOut(clampedK);
    const [lng, lat] = geoInterpolate([a.lng, a.lat], [b.lng, b.lat])(e);
    const angRad = geoDistance([a.lng, a.lat], [b.lng, b.lat]);
    const distA = Math.max(0.035, a.dist);
    const distB = Math.max(0.035, b.dist);
    const baseDist = Math.exp(Math.log(distA) * (1 - e) + Math.log(distB) * e);
    const hop = angRad > 0.08 ? Math.min(0.6, angRad * 0.38) * Math.sin(Math.PI * clampedK) : 0;
    return {
        lat,
        lng,
        dist: Math.max(0.035, baseDist + hop),
        tilt: a.tilt + (b.tilt - a.tilt) * e,
    };
}

function cameraBasis(pose) {
    const forward = norm3(sub3(pose.target, pose.position));
    const right = norm3(cross3(forward, pose.up));
    const up = norm3(cross3(right, forward));
    return { forward, right, up };
}

export function projectPointWithPose(pointVec3, pose, width, height, fovDeg = DEFAULT_FOV_DEG) {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const { forward, right, up } = cameraBasis(pose);
    const rel = sub3(pointVec3, pose.position);
    const cx = dot3(rel, right);
    const cy = dot3(rel, up);
    const cz = dot3(rel, forward);
    const tanHalf = Math.tan((fovDeg * DEG_TO_RAD) / 2);
    const aspect = safeW / safeH;
    const safeCz = cz > 0.001 ? cz : 0.001;
    const ndcX = cx / (safeCz * tanHalf * aspect);
    const ndcY = cy / (safeCz * tanHalf);
    const x = (ndcX * 0.5 + 0.5) * safeW;
    const y = (-ndcY * 0.5 + 0.5) * safeH;
    const surfaceNormal = norm3(pointVec3);
    const toCam = sub3(pose.position, pointVec3);
    const visibleOnHorizon = cz > 0.5 && dot3(surfaceNormal, toCam) > 0;
    return { x, y, ndcX, ndcY, inFront: cz > 0.5, visibleOnHorizon };
}

export function unprojectScreenToGlobeSpace(
    sx,
    sy,
    pose,
    width,
    height,
    fovDeg = DEFAULT_FOV_DEG,
    radius = GLOBE_RADIUS,
) {
    const safeW = Math.max(1, width);
    const safeH = Math.max(1, height);
    const { forward, right, up } = cameraBasis(pose);
    const ndcX = (sx / safeW) * 2 - 1;
    const ndcY = -(sy / safeH) * 2 + 1;
    const tanHalf = Math.tan((fovDeg * DEG_TO_RAD) / 2);
    const aspect = safeW / safeH;
    const ray = norm3(add3(add3(forward, scale3(right, ndcX * tanHalf * aspect)), scale3(up, ndcY * tanHalf)));
    const targetDist = len3(sub3(pose.target, pose.position));
    const depth = Math.max(radius * 0.12, targetDist * (safeW < 640 ? 0.72 : 0.8));
    let pt = add3(pose.position, scale3(ray, depth));
    const minRadius = radius * (1 + Math.max(0.035, len3(sub3(pose.position, pose.target)) / radius * 0.05));
    if (len3(pt) < minRadius) {
        pt = scale3(norm3(pt), minRadius);
    }
    return vec3ToLatLngAlt(pt[0], pt[1], pt[2], radius);
}

/**
 * Expands camera distance cleanly so every surface actor in the step fits
 * inside the viewport with clear margins across 390px-1900px widths.
 */
export function fitCameraToActors(
    baseCam,
    surfaceCoords,
    width,
    height,
    { fovDeg = DEFAULT_FOV_DEG, hasFloatingBadges = false, maxScale = 3.2 } = {},
) {
    if (!baseCam || !surfaceCoords || surfaceCoords.length === 0 || width <= 0 || height <= 0) {
        return { ...baseCam };
    }
    const narrow = width < 640;
    const sidePad = narrow ? Math.max(36, width * 0.11) : Math.max(72, width * 0.11);
    const topPad = hasFloatingBadges ? (narrow ? 116 : 92) : (narrow ? 42 : 48);
    const bottomPad = narrow ? 118 : 68;

    let dist = Math.max(0.04, baseCam.dist);
    let tilt = Math.max(0, Math.min(64, baseCam.tilt ?? 40));
    const maxDist = Math.min(2.6, dist * maxScale);

    const fitsAll = candidate => {
        const pose = computeCameraPose(candidate);
        for (const coord of surfaceCoords) {
            const vec = latLngAltToVec3(coord.lat, coord.lng, coord.alt || pose.visBase);
            const proj = projectPointWithPose(vec, pose, width, height, fovDeg);
            if (!proj.visibleOnHorizon) return false;
            if (proj.x < sidePad || proj.x > width - sidePad) return false;
            if (proj.y < topPad || proj.y > height - bottomPad) return false;
        }
        return true;
    };

    if (narrow && dist < 1.3) {
        dist = Math.min(maxDist, dist * 1.18);
    }

    for (let iter = 0; iter < 28; iter += 1) {
        const candidate = { lat: baseCam.lat, lng: baseCam.lng, dist, tilt };
        if (fitsAll(candidate)) return candidate;
        dist = Math.min(maxDist, dist * 1.075);
        if (dist > 0.75) {
            tilt = Math.max(12, tilt * 0.96);
        }
        if (dist >= maxDist - 1e-4) break;
    }

    return { lat: baseCam.lat, lng: baseCam.lng, dist, tilt };
}

/**
 * Computes elevated geodesic connection path points, dash/gap lengths
 * proportional to view width, and whether a ground shadow should be drawn.
 * Close-view arcs stay low (lines over terrain, not tall loops), and only
 * short surface arcs (< 12 degrees) cast ground shadows.
 */
export function computeArcProfile(
    fromLngLat,
    toLngLat,
    {
        camDist = 0.5,
        visBase = visAltitudeBase(camDist),
        side = 0,
        isDrop = false,
        noShadow = false,
        fromAlt = visBase,
        toAlt = visBase,
        type = 'pressure',
        steps = 48,
    } = {},
) {
    const it = geoInterpolate(fromLngLat, toLngLat);
    const angRad = geoDistance(fromLngLat, toLngLat);
    const lenDeg = angRad * RAD_TO_DEG;

    const closeBlend = Math.max(0, Math.min(1, (camDist - 0.2) / 0.5));
    const relCap = camDist * (0.02 + 0.036 * closeBlend);
    const rawPeak = (angRad > 0.2 ? 0.11 : 0.065) * angRad;
    const peak = isDrop ? 0 : Math.min(relCap, rawPeak, 0.14);

    const rawDx = toLngLat[0] - fromLngLat[0];
    const dx = ((rawDx + 540) % 360) - 180;
    const dy = toLngLat[1] - fromLngLat[1];
    const px = -dy;
    const py = dx;

    const pts = [];
    for (let i = 0; i <= steps; i += 1) {
        const t = i / steps;
        const s = Math.sin(Math.PI * t);
        const q = it(t);
        const alt = isDrop
            ? toAlt + (fromAlt - toAlt) * Math.pow(Math.cos((t * Math.PI) / 2), 1.35)
            : visBase + peak * s;
        pts.push([q[0] + side * px * s, q[1] + side * py * s, alt]);
    }

    const castShadow = !noShadow && !isDrop && lenDeg < 12 && peak > 0.0003;
    const shadowPts = castShadow ? pts.map(p => [p[0], p[1], visBase * 0.65]) : null;
    const [dv, gv, anim] = DASH_SPEC[type] || DASH_SPEC.pressure;
    const safeLenDeg = Math.max(0.3, lenDeg);
    const viewDeg = 53 * Math.max(0.04, camDist);

    return {
        pts,
        shadowPts,
        castShadow,
        peak,
        lenDeg,
        dash: dv ? (dv * viewDeg) / safeLenDeg : 1,
        gap: (gv * viewDeg) / safeLenDeg,
        anim,
    };
}

/**
 * Computes viewport-safe screen slots for global actors with no single place
 * so badges stay 100% inside the frame at 390px-1900px without shrinking text.
 */
export function computeFloatingBadgeScreenSlots(floatingActors, width, height) {
    if (!floatingActors || floatingActors.length === 0 || width <= 0) return [];
    const marginX = width < 640 ? 12 : 24;
    const topY = width < 640 ? 28 : 34;
    const rowStep = 44;
    const badgeW = actor => Math.min(width - marginX * 2, Math.max(124, actor.name.length * 7.4 + 32));
    const items = floatingActors.map(actor => ({
        actor,
        w: badgeW(actor),
        h: 38,
    }));

    const singleRowWidth = items.reduce((sum, item) => sum + item.w, 0) + Math.max(0, items.length - 1) * 18;
    const canShareRow = singleRowWidth <= width - marginX * 2;
    const slots = [];

    if (canShareRow) {
        let cursor = (width - singleRowWidth) / 2;
        for (const item of items) {
            const cx = Math.max(marginX + item.w / 2, Math.min(width - marginX - item.w / 2, cursor + item.w / 2));
            slots.push({
                id: item.actor.id,
                actor: item.actor,
                cx,
                cy: topY,
                w: item.w,
                h: item.h,
            });
            cursor += item.w + 18;
        }
    } else {
        items.forEach((item, idx) => {
            const cx = Math.max(marginX + item.w / 2, Math.min(width - marginX - item.w / 2, width / 2));
            const cy = Math.min(height * 0.4, topY + idx * rowStep);
            slots.push({
                id: item.actor.id,
                actor: item.actor,
                cx,
                cy,
                w: item.w,
                h: item.h,
            });
        });
    }
    return slots;
}

/**
 * Computes auto-fitted orthographic view framing for the 2D flat fallback map.
 */
export function computeFlatTargetView(step, surfaceCoords, width, height, hasFloating) {
    if (!step) return { lng: 96, lat: 20, half: 10 };
    if (step.key === 'all' || !surfaceCoords.length) {
        return { lng: step.cam.lng, lat: step.cam.lat, half: Math.min(62, Math.max(18, step.cam.dist * 34)) };
    }
    const baseHalf = step.cam.dist < 0.14
        ? 3.2
        : step.cam.dist < 0.28
            ? 6.2
            : step.cam.dist < 0.72
                ? 17.5
                : 30;
    const minAspectSpan = Math.min(width, height) / Math.max(width, height);
    let half = Math.max(baseHalf, baseHalf / Math.max(0.65, minAspectSpan));

    const testProj = geoOrthographic().clipAngle(90);
    const leftPad = width < 640 ? 34 : 64;
    const rightPad = width < 640 ? 34 : 64;
    const topPad = hasFloating ? (width < 640 ? 112 : 84) : 34;
    const bottomPad = 104;

    for (let i = 0; i < 18; i += 1) {
        const scale = Math.min(width, height) / (2 * Math.sin((half * Math.PI) / 180));
        testProj
            .translate([width / 2, height / 2 + (hasFloating ? 16 : 0)])
            .rotate([-step.cam.lng, -step.cam.lat])
            .scale(scale);
        const fits = surfaceCoords.every(c => {
            if (geoDistance(c, [step.cam.lng, step.cam.lat]) > 1.38) return false;
            const p = testProj(c);
            return p && p[0] >= leftPad && p[0] <= width - rightPad && p[1] >= topPad && p[1] <= height - bottomPad;
        });
        if (fits || half >= 62) break;
        half = Math.min(62, half * 1.15);
    }
    return { lng: step.cam.lng, lat: step.cam.lat, half };
}

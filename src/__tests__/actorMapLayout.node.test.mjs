import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
    GLOBE_RADIUS,
    computeArcProfile,
    computeCameraPose,
    computeFloatingBadgeScreenSlots,
    fitCameraToActors,
    interpolateCamera,
    latLngAltToVec3,
    projectPointWithPose,
    unprojectScreenToGlobeSpace,
    vec3ToLatLngAlt,
} from '../components/actorMapCamera.mjs';
import {
    actorLabelBox,
    countryLabelBox,
    linkLabelBox,
    resolveMarkerCollisions,
    solveActorMapLabels,
} from '../components/actorMapLayout.mjs';
import {
    HONEST_3D_LOADING_MESSAGE,
    SLOW_THROUGHPUT_BYTES_PER_SEC,
    actorMapLoadingStatus,
    chooseActorMapMode,
    isLowPowerDeviceConfig,
    isSlowConnectionConfig,
    isSlowMeasuredThroughput,
    measureResourceThroughput,
    preferWebpUrl,
} from '../components/actorMapMode.mjs';
import { parseBriefingEntryFromSearch } from '../navigationState.mjs';
import { CASE_STUDIES_2026 } from '../cases/index.mjs';

test('latLngAltToVec3 and vec3ToLatLngAlt invert accurately and camera flights never enter the globe', () => {
    for (const [lat, lng, alt] of [[21.3349, 95.0844, 0], [9.5611, 44.0667, 0.04], [-12.5, -75.2, 0.25], [31.5, 34.75, 0]]) {
        const v = latLngAltToVec3(lat, lng, alt);
        const back = vec3ToLatLngAlt(v[0], v[1], v[2]);
        assert.ok(Math.abs(back.lat - lat) < 1e-4, `lat mismatch ${back.lat} vs ${lat}`);
        assert.ok(Math.abs(back.lng - lng) < 1e-4, `lng mismatch ${back.lng} vs ${lng}`);
        assert.ok(Math.abs(back.alt - alt) < 1e-4, `alt mismatch ${back.alt} vs ${alt}`);
    }

    const endpoints = [
        { lat: 20.6, lng: 95.5, dist: 0.09, tilt: 54 },
        { lat: 16.5, lng: 107.0, dist: 0.56, tilt: 36 },
        { lat: 13.0, lng: 36.5, dist: 0.92, tilt: 26 },
        { lat: 16.0, lng: 106.0, dist: 1.65, tilt: 14 },
    ];
    for (let i = 0; i < endpoints.length; i += 1) {
        for (let j = 0; j < endpoints.length; j += 1) {
            for (let s = 0; s <= 20; s += 1) {
                const k = s / 20;
                const cam = interpolateCamera(endpoints[i], endpoints[j], k);
                const pose = computeCameraPose(cam);
                assert.ok(
                    pose.distanceFromCenter > GLOBE_RADIUS * 1.02,
                    `camera dipped too close to sphere during flight (${i}->${j} k=${k}: ${pose.distanceFromCenter})`,
                );
            }
        }
    }
});

test('fitCameraToActors frames every actor in Myanmar and Somaliland steps across 390px-1900px', () => {
    const pilots = CASE_STUDIES_2026.filter(c => c.actorMap);
    assert.equal(pilots.length, 2);

    const viewports = [
        [358, 440],
        [700, 520],
        [840, 580],
        [1200, 620],
    ];

    for (const cs of pilots) {
        const actorById = new Map(cs.actorMap.actors.map(a => [a.id, a]));
        for (const step of cs.actorMap.steps) {
            const surface = step.actors
                .map(entry => actorById.get(entry.id))
                .filter(actor => actor && actor.location.kind !== 'noSinglePlace')
                .map(actor => (
                    actor.location.kind === 'pin'
                        ? { lat: actor.location.latitude, lng: actor.location.longitude }
                        : { lat: actor.location.anchor.latitude, lng: actor.location.anchor.longitude }
                ));
            const hasFloating = step.actors.some(entry => actorById.get(entry.id)?.location.kind === 'noSinglePlace');

            for (const [w, h] of viewports) {
                const fitted = fitCameraToActors(step.cam, surface, w, h, { hasFloatingBadges: hasFloating });
                const pose = computeCameraPose(fitted);
                for (const pt of surface) {
                    const proj = projectPointWithPose(latLngAltToVec3(pt.lat, pt.lng, pose.visBase), pose, w, h);
                    assert.ok(proj.visibleOnHorizon, `${cs.id} step ${step.key} at ${w}x${h}: actor behind horizon`);
                    assert.ok(proj.x >= 18 && proj.x <= w - 18, `${cs.id} step ${step.key} at ${w}x${h}: x=${proj.x} out of margins`);
                    assert.ok(proj.y >= 18 && proj.y <= h - 18, `${cs.id} step ${step.key} at ${w}x${h}: y=${proj.y} out of margins`);
                }
            }
        }
    }
});

test('computeArcProfile stays low on close views and casts ground shadows only on short non-drop arcs', () => {
    const shortClose = computeArcProfile([96.13, 19.75], [95.08, 21.33], { camDist: 0.09, type: 'conflict' });
    assert.ok(shortClose.peak <= 0.003, `close-view arc peak should read as line over ground, got ${shortClose.peak}`);
    assert.equal(shortClose.castShadow, true);
    assert.ok(Array.isArray(shortClose.shadowPts));

    const longRegional = computeArcProfile([34.75, 31.5], [44.07, 9.56], { camDist: 0.58, type: 'support' });
    assert.ok(longRegional.lenDeg > 12);
    assert.equal(longRegional.castShadow, false);
    assert.equal(longRegional.shadowPts, null);

    const dropArc = computeArcProfile([38.0, 42.0], [96.15, 16.8], { camDist: 0.5, isDrop: true, fromAlt: 0.25 });
    assert.equal(dropArc.castShadow, false);
    assert.equal(dropArc.shadowPts, null);
});

test('computeFloatingBadgeScreenSlots keeps floating badges inside frame and unprojection round-trips cleanly', () => {
    const pose = computeCameraPose({ lat: 16.0, lng: 106.0, dist: 1.65, tilt: 14 });
    for (const [w, h] of [[358, 440], [700, 520], [1100, 620]]) {
        const slots = computeFloatingBadgeScreenSlots(
            [{ id: 'a', name: 'Donor governments' }, { id: 'b', name: 'UN Security Council (14 of 15)' }],
            w,
            h,
        );
        for (const s of slots) {
            assert.ok(s.cx - s.w / 2 >= 10 && s.cx + s.w / 2 <= w - 10, `badge horizontal overflow at ${w}`);
            assert.ok(s.cy - s.h / 2 >= 8 && s.cy + s.h / 2 <= h * 0.5, `badge vertical overflow at ${w}x${h}`);
            const geo = unprojectScreenToGlobeSpace(s.cx, s.cy, pose, w, h);
            assert.ok(geo.alt > pose.visBase * 2, 'floating anchor must sit cleanly above terrain');
            const back = projectPointWithPose(latLngAltToVec3(geo.lat, geo.lng, geo.alt), pose, w, h);
            assert.ok(Math.abs(back.x - s.cx) < 1.5 && Math.abs(back.y - s.cy) < 1.5);
        }
    }
});

test('solveActorMapLabels avoids all marker/label overlaps and keeps lower-priority labels hidden on narrow views', () => {
    const boxOverlap = (a, b) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
    const placed = solveActorMapLabels({
        width: 358,
        height: 440,
        reservedBoxes: [{ x0: 8, y0: 320, x1: 140, y1: 432 }],
        floatingBadges: [{ cx: 179, cy: 28, w: 220, h: 38 }],
        markers: [
            { id: 'a', x: 180, y: 200, r: 9 },
            { id: 'b', x: 192, y: 206, r: 9 },
            { id: 'c', x: 165, y: 215, r: 7 },
        ],
        actorLabels: [
            { id: 'a', name: 'Military authorities', note: 'Naypyidaw', x: 180, y: 200, r: 9, preferredSide: 'r', priority: 100 },
            { id: 'b', name: 'Displaced villagers', note: 'Pakokku', x: 192, y: 206, r: 9, preferredSide: 't', priority: 80 },
            { id: 'c', name: 'Magwe interim government', note: 'formed March 2026', x: 165, y: 215, r: 7, preferredSide: 'l', priority: 60 },
        ],
        linkLabels: [
            { id: 'l1', label: 'Intensifies offensives', priority: 50, candidates: [{ x: 185, y: 203 }, { x: 140, y: 245 }] },
        ],
        countryLabels: [
            { name: 'Myanmar', x: 182, y: 202 },
        ],
    });

    const visibleBoxes = [];
    for (const res of placed.actors.values()) {
        if (res.visible) visibleBoxes.push(res.box);
    }
    for (const res of placed.links.values()) {
        if (res.visible) visibleBoxes.push(res.box);
    }
    for (const res of placed.countries.values()) {
        if (res.visible) visibleBoxes.push(res.box);
    }

    assert.ok(placed.actors.get('a').visible, 'highest-priority actor label should stay visible');
    for (let i = 0; i < visibleBoxes.length; i += 1) {
        const b = visibleBoxes[i];
        assert.ok(b.x0 >= 8 && b.x1 <= 350 && b.y0 >= 8 && b.y1 <= 432, 'label must stay inside frame');
        for (let j = i + 1; j < visibleBoxes.length; j += 1) {
            assert.ok(!boxOverlap(b, visibleBoxes[j]), 'no two visible labels may overlap');
        }
    }

    assert.ok(actorLabelBox(100, 100, 8, 'r', 'Test').x0 > 100);
    assert.ok(linkLabelBox(100, 100, 'Link').x0 < 100);
    assert.ok(countryLabelBox(100, 100, 'Myanmar').y1 > 100);
});

test('chooseActorMapMode, isLowPowerDeviceConfig, antimeridian wrap, and step=all parsing enforce lazy-loading rules', () => {
    // WebGL unavailable, reduced-motion, or forced fallback must stay flat regardless of userChoice/inView
    for (const forceFlat of [
        { webgl: false, reducedMotion: false, fallbackForced: false },
        { webgl: true, reducedMotion: true, fallbackForced: false },
        { webgl: true, reducedMotion: false, fallbackForced: true },
    ]) {
        for (const lowPower of [false, true]) {
            for (const userChoice of [null, '3d', 'flat']) {
                for (const inView of [false, true]) {
                    assert.equal(
                        chooseActorMapMode({ ...forceFlat, lowPower, userChoice, inView }),
                        'flat',
                    );
                }
            }
        }
    }

    // Mobile/low-power defaults to flat even in view, until explicit tap
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: true, userChoice: null, inView: false }), 'flat');
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: true, userChoice: null, inView: true }), 'flat');
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: true, userChoice: '3d', inView: true }), '3d');

    // Desktop defers 3D until scrolled into view, and respects manual switch back to 2D
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: false, userChoice: null, inView: false }), 'flat');
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: false, userChoice: null, inView: true }), '3d');
    assert.equal(chooseActorMapMode({ webgl: true, lowPower: false, userChoice: 'flat', inView: true }), 'flat');

    // Device capability heuristics
    assert.equal(isLowPowerDeviceConfig({ innerWidth: 390, hardwareConcurrency: 8, deviceMemory: 8, saveData: false }), true);
    assert.equal(isLowPowerDeviceConfig({ innerWidth: 1440, hardwareConcurrency: 4, deviceMemory: 8, saveData: false }), true);
    assert.equal(isLowPowerDeviceConfig({ innerWidth: 1440, hardwareConcurrency: 8, deviceMemory: 2, saveData: false }), true);
    assert.equal(isLowPowerDeviceConfig({ innerWidth: 1440, hardwareConcurrency: 8, deviceMemory: 8, saveData: true }), true);
    assert.equal(isLowPowerDeviceConfig({ innerWidth: 1440, hardwareConcurrency: 8, deviceMemory: 8, saveData: false }), false);

    // URL query ?step=all parsing and antimeridian bow wrapping
    assert.equal(parseBriefingEntryFromSearch('?view=briefings&tour=myanmar-fragmented-sovereignty&step=all').step, 'all');
    const pacificArc = computeArcProfile([175, -18], [-175, -17], { camDist: 0.5, side: 0.1 });
    assert.ok(pacificArc.lenDeg < 15, `expected short antimeridian arc, got ${pacificArc.lenDeg}`);
    assert.ok(Math.abs(pacificArc.pts[24][1] + 17.5) < 5, 'perpendicular bow near antimeridian must stay wrapped');
});

test('Slow-connection gating, WebP preference with JPG fallback, honest loading status, and trimmed 50m borders stay consistent', () => {
    assert.equal(isSlowConnectionConfig({ effectiveType: '3g', downlink: 10, saveData: false }), true);
    assert.equal(isSlowConnectionConfig({ effectiveType: '2g', downlink: 10, saveData: false }), true);
    assert.equal(isSlowConnectionConfig({ effectiveType: 'slow-2g', downlink: 10, saveData: false }), true);
    assert.equal(isSlowConnectionConfig({ effectiveType: '4g', downlink: 1.2, saveData: false }), true);
    assert.equal(isSlowConnectionConfig({ effectiveType: '4g', downlink: 5.0, saveData: true }), true);
    assert.equal(isSlowConnectionConfig({ effectiveType: '4g', downlink: 2.0, saveData: false }), false);

    // Timed fallback ignores sub-20ms bursts, HTTP 304/300B cache revalidations, and cold TLS RTT before responseStart
    assert.equal(isSlowMeasuredThroughput(105000, 10), false);
    assert.equal(isSlowMeasuredThroughput(100000, 1000), true);
    assert.equal(isSlowMeasuredThroughput(SLOW_THROUGHPUT_BYTES_PER_SEC * 2, 1000), false);
    const reval304 = measureResourceThroughput({ responseStatus: 304, transferSize: 300, encodedBodySize: 38000, decodedBodySize: 107761, fetchStart: 100, responseStart: 140, responseEnd: 145 }, 107761, 45);
    assert.equal(reval304.bytes, 0);
    assert.equal(isSlowMeasuredThroughput(reval304.bytes, reval304.durationMs), false);
    const fastCdnColdTls = measureResourceThroughput({ responseStatus: 200, transferSize: 38276, encodedBodySize: 37976, decodedBodySize: 107761, fetchStart: 2765.7, responseStart: 3033.9, responseEnd: 3039.4 }, 107761, 273.7);
    assert.equal(isSlowMeasuredThroughput(fastCdnColdTls.bytes, fastCdnColdTls.durationMs), false);
    const slow150k = measureResourceThroughput({ responseStatus: 200, transferSize: 38276, encodedBodySize: 37976, decodedBodySize: 107761, fetchStart: 100, responseStart: 200, responseEnd: 460 }, 107761, 360);
    assert.equal(isSlowMeasuredThroughput(slow150k.bytes, slow150k.durationMs), true);

    // Slow connection holds on flat map even on high-power desktop in view until user opts in
    assert.equal(
        chooseActorMapMode({ webgl: true, lowPower: false, slowConnection: true, userChoice: null, inView: true }),
        'flat',
    );
    assert.equal(
        chooseActorMapMode({ webgl: true, lowPower: false, slowConnection: true, userChoice: '3d', inView: true }),
        '3d',
    );

    assert.equal(actorMapLoadingStatus('3d', false), HONEST_3D_LOADING_MESSAGE);
    assert.equal(actorMapLoadingStatus('3d', true), '');
    assert.equal(actorMapLoadingStatus('flat', false), '');
    assert.equal(preferWebpUrl('/assets/actor-map/myanmar-region.jpg'), '/assets/actor-map/myanmar-region.webp');

    const assetDir = path.resolve('public/assets/actor-map');
    for (const jpg of ['blue-marble-base.jpg', 'myanmar-region.jpg', 'myanmar-local.jpg', 'somaliland-region.jpg', 'somaliland-local.jpg']) {
        assert.equal(fs.existsSync(path.join(assetDir, jpg)), true, `missing fallback ${jpg}`);
        assert.equal(fs.existsSync(path.join(assetDir, jpg.replace(/\.jpg$/, '.webp'))), true, `missing WebP ${jpg}`);
    }

    const topo = JSON.parse(fs.readFileSync(path.join(assetDir, 'countries-50m.json'), 'utf8'));
    assert.deepEqual(Object.keys(topo.objects), ['countries']);
    const names = new Set(topo.objects.countries.geometries.map(g => g.properties?.name).filter(Boolean));
    for (const required of ['Myanmar', 'India', 'Philippines', 'Somalia', 'Somaliland', 'Ethiopia', 'Kenya', 'Djibouti', 'Israel']) {
        assert.ok(names.has(required), `trimmed countries-50m.json missing required country "${required}"`);
    }
});

test('Rule 4d.6 geometry: all pilot steps keep markers inside frame, non-overlapping at 1440px, and clear of crossing arcs/IGAD-AU collision', () => {
    const W = 533;
    const H = 540;
    const fovDeg = 50;
    const pilotIds = ['myanmar-fragmented-sovereignty', 'somaliland-recognition-red-sea-order'];
    const coordOf = actor => (
        actor?.location?.kind === 'pin'
            ? { lat: actor.location.latitude, lng: actor.location.longitude }
            : actor?.location?.kind === 'area' && actor.location.anchor
                ? { lat: actor.location.anchor.latitude, lng: actor.location.anchor.longitude }
                : null
    );
    const dotR = (actor, entry) => (entry.small ? 5 : actor.level === 'regional' ? 10.5 : actor.level === 'state' ? 8.5 : 7);

    for (const id of pilotIds) {
        const c = CASE_STUDIES_2026.find(item => item.id === id);
        assert.ok(c?.actorMap, `missing pilot case ${id}`);
        const byId = new Map(c.actorMap.actors.map(a => [a.id, a]));
        const connsById = new Map(c.actorMap.connections.map(x => [x.id, x]));

        for (const step of c.actorMap.steps) {
            const entries = step.actors || [];
            const surfaceCoords = entries.map(e => coordOf(byId.get(e.id))).filter(Boolean);
            const floatingActors = entries.map(e => byId.get(e.id)).filter(a => a?.location?.kind === 'noSinglePlace');
            const cam = fitCameraToActors(step.cam, surfaceCoords, W, H, {
                fovDeg,
                hasFloatingBadges: floatingActors.length > 0,
            });
            const pose = computeCameraPose(cam, { h: 0, t: 0 }, 0, GLOBE_RADIUS);

            const markers = [];
            const rawActorMarkers = [];
            const labelRequests = [];
            for (const entry of entries) {
                const actor = byId.get(entry.id);
                const co = coordOf(actor);
                if (!actor || !co) continue;
                const proj = projectPointWithPose(
                    latLngAltToVec3(co.lat, co.lng, pose.visBase, GLOBE_RADIUS),
                    pose,
                    W,
                    H,
                    fovDeg,
                );
                assert.ok(proj.visibleOnHorizon, `${id} step ${step.key} actor ${actor.id} must stay visible in frame`);
                assert.ok(proj.x >= 8 && proj.x <= W - 8 && proj.y >= 8 && proj.y <= H - 8, `${id} step ${step.key} actor ${actor.id} projected out of bounds`);
                const r = dotR(actor, entry);
                const m = { id: actor.id, x: proj.x, y: proj.y, r };
                markers.push(m);
                rawActorMarkers.push({ ...m });
                labelRequests.push({
                    id: actor.id,
                    name: actor.name,
                    note: entry.note || (actor.location.kind === 'pin' ? actor.location.place : actor.location.label),
                    x: proj.x,
                    y: proj.y,
                    r,
                    preferredSide: entry.preferredSide || 'r',
                    hidden: Boolean(entry.small),
                    priority: actor.level === 'regional' ? 96 : actor.level === 'state' ? 88 : 78,
                });
            }

            // Include legacy extraPlaces (e.g. Berbera, Las Anod / Laascaanood)
            for (const loc of c.map?.locations || []) {
                const lat = Number(loc.latitude);
                const lng = Number(loc.longitude);
                const matched = entries.some(e => {
                    const ac = coordOf(byId.get(e.id));
                    return ac && Math.hypot(ac.lat - lat, ac.lng - lng) < 0.08;
                });
                if (matched) continue;
                const proj = projectPointWithPose(
                    latLngAltToVec3(lat, lng, pose.visBase, GLOBE_RADIUS),
                    pose,
                    W,
                    H,
                    fovDeg,
                );
                if (!proj.visibleOnHorizon || proj.x < 12 || proj.x > W - 12 || proj.y < 12 || proj.y > H - 12) continue;
                markers.push({ id: `place:${loc.label}`, x: proj.x, y: proj.y, r: 5.5 });
                labelRequests.push({
                    id: `place:${loc.label}`,
                    name: loc.label,
                    note: '',
                    x: proj.x,
                    y: proj.y,
                    r: 5.5,
                    preferredSide: 'r',
                    hidden: Boolean(step.quietLabels),
                    priority: 52,
                });
            }

            // Raw geo actors (without offset) must already satisfy dist >= r1 + r2 on focused narrative steps
            if (id === 'somaliland-recognition-red-sea-order' || ['1', '2', '3'].includes(String(step.key))) {
                for (let i = 0; i < rawActorMarkers.length; i += 1) {
                    for (let j = i + 1; j < rawActorMarkers.length; j += 1) {
                        const a = rawActorMarkers[i];
                        const b = rawActorMarkers[j];
                        const d = Math.hypot(a.x - b.x, a.y - b.y);
                        assert.ok(d >= a.r + b.r, `${id} step ${step.key} raw overlap ${a.id} vs ${b.id}: ${d.toFixed(1)} < ${a.r + b.r}`);
                    }
                }
            }

            const resolved = resolveMarkerCollisions(markers, { width: W, height: H, padding: 10, minGap: 2 });
            const resolvedList = markers.map(m => ({ ...m, ...resolved.get(m.id) }));
            for (const m of resolvedList) {
                assert.ok(
                    Math.hypot(m.dx, m.dy) <= 12,
                    `${id} step ${step.key} marker ${m.id} moved too far (${Math.hypot(m.dx, m.dy).toFixed(1)}px)`,
                );
            }
            for (let i = 0; i < resolvedList.length; i += 1) {
                for (let j = i + 1; j < resolvedList.length; j += 1) {
                    const a = resolvedList[i];
                    const b = resolvedList[j];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    assert.ok(
                        d >= a.r + b.r,
                        `${id} step ${step.key} marker diameter overlap: ${a.id} vs ${b.id} (${d.toFixed(1)} < ${a.r + b.r})`,
                    );
                }
            }

            if (id === 'somaliland-recognition-red-sea-order' && String(step.key) === '4') {
                const adjReqs = labelRequests.map(req => ({ ...req, ...resolved.get(req.id) }));
                const arcPts = (step.connections || []).map(cid => {
                    const conn = connsById.get(cid);
                    const pf = coordOf(byId.get(conn.from));
                    const pt = coordOf(byId.get(conn.to));
                    if (!pf || !pt) return null;
                    const prof = computeArcProfile([pf.lng, pf.lat], [pt.lng, pt.lat], {
                        camDist: cam.dist,
                        visBase: pose.visBase,
                        side: conn.side || 0,
                    });
                    return {
                        id: cid,
                        points: prof.pts.map(p => projectPointWithPose(latLngAltToVec3(p[1], p[0], p[2], GLOBE_RADIUS), pose, W, H, fovDeg))
                            .filter(pr => pr.visibleOnHorizon),
                    };
                }).filter(Boolean);
                const solved = solveActorMapLabels({
                    width: W,
                    height: H,
                    markers: resolvedList,
                    actorLabels: adjReqs,
                    arcPoints: arcPts,
                });
                const igadLabel = solved.actors.get('igad');
                const auMarker = resolvedList.find(m => m.id === 'african-union');
                assert.ok(igadLabel?.visible, 'IGAD label must stay visible in Somaliland step 4');
                assert.ok(
                    igadLabel.box.x1 <= auMarker.x - auMarker.r - 2
                    || igadLabel.box.x0 >= auMarker.x + auMarker.r + 2
                    || igadLabel.box.y1 <= auMarker.y - auMarker.r - 2
                    || igadLabel.box.y0 >= auMarker.y + auMarker.r + 2,
                    'IGAD label box must not sit over African Union marker',
                );
            }
        }
    }

    // noShadow suppresses arc shadow even on short arcs, and solveActorMapLabels avoids crossing arcPoints
    const shortNoShadow = computeArcProfile([96.13, 19.74], [95.08, 21.33], { camDist: 0.1, side: 0.14, noShadow: true });
    assert.equal(shortNoShadow.castShadow, false);

    const arcAvoid = solveActorMapLabels({
        width: 400,
        height: 400,
        markers: [{ id: 'p', x: 200, y: 200, r: 6 }],
        actorLabels: [{ id: 'p', name: 'Las Anod', x: 200, y: 200, r: 6, preferredSide: 'b', priority: 50 }],
        arcPoints: [{ id: 'a1', points: [{ x: 200, y: 222 }, { x: 205, y: 225 }] }],
    });
    assert.notEqual(arcAvoid.actors.get('p')?.side, 'b', 'actor label should avoid crossing arcPoints when clear side exists');

    // Section C regression checks
    const my = CASE_STUDIES_2026.find(c => c.id === 'myanmar-fragmented-sovereignty');
    const india = my.actorMap.actors.find(a => a.id === 'india');
    assert.equal(india.location.label, 'Imphal, Manipur');
    assert.equal(india.location.anchor.latitude, 24.8081);
    assert.equal(india.location.anchor.longitude, 93.9442);
    assert.match(india.location.anchor.gazetteer, /1269771/);

    const som = CASE_STUDIES_2026.find(c => c.id === 'somaliland-recognition-red-sea-order');
    const somAuth = som.actorMap.actors.find(a => a.id === 'somaliland-authorities');
    assert.equal(somAuth.level, 'local');
    assert.match(somAuth.role, /Self-declared state.*recognised by Israel.*claimed by the Federal Government of Somalia/i);
    assert.equal(som.actorMap.boundaryNote, 'The outline shows the territory Somaliland claims and does not imply recognition.');
    const nes = som.actorMap.actors.find(a => a.id === 'ssc-khaatumo');
    assert.equal(nes.name, 'North Eastern State of Somalia');
});

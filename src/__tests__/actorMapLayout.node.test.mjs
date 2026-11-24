import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { geoOrthographic } from 'd3-geo';
import {
    GLOBE_RADIUS,
    computeArcProfile,
    computeCameraPose,
    computeFlatTargetView,
    computeFloatingBadgeScreenSlots,
    fitCameraToActors,
    interpolateCamera,
    latLngAltToVec3,
    projectPointWithPose,
    unprojectScreenToGlobeSpace,
    vec3ToLatLngAlt,
} from '../components/actorMapCamera.mjs';
import {
    CLUSTER_DOT_RADIUS,
    actorLabelBox,
    boxIntersectsArcs,
    buildFlatArcGeometry,
    buildStepClusterIndex,
    countryLabelBox,
    isRelatedActorMapItem,
    isStepConnectionVisible,
    linkLabelBox,
    resolveMarkerCollisions,
    segmentIntersectsBox,
    solveActorMapLabels,
    splitActorLabelLines,
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
import { normalizeCaseStudy } from '../cases/schema.mjs';
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
    assert.ok(actorLabelBox(100, 100, 8, 't', 'Test Title', '', 24).x0 > actorLabelBox(100, 100, 8, 't', 'Test Title', '', 0).x0);
    assert.ok(linkLabelBox(100, 100, 'Link').x0 < 100);
    assert.ok(countryLabelBox(100, 100, 'Myanmar').y1 > 100);
    assert.deepEqual(splitActorLabelLines('Federal Government of Somalia'), ['Federal Government', 'of Somalia']);
    assert.equal(segmentIntersectsBox({ x: 0, y: 10 }, { x: 100, y: 10 }, { x0: 40, y0: 5, x1: 60, y1: 15 }, 0), true);
    assert.equal(segmentIntersectsBox({ x: 0, y: 30 }, { x: 100, y: 30 }, { x0: 40, y0: 5, x1: 60, y1: 15 }, 2), false);
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
            const { clusters, actorToCluster } = buildStepClusterIndex(step);
            const entries = step.actors || [];
            const surfaceCoords = [
                ...entries.filter(e => !actorToCluster.has(e.id)).map(e => coordOf(byId.get(e.id))).filter(Boolean),
                ...clusters.map(cl => ({ lat: cl.lat, lng: cl.lng })),
            ];
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
                if (actorToCluster.has(entry.id)) continue;
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
            for (const cl of clusters) {
                const proj = projectPointWithPose(
                    latLngAltToVec3(cl.lat, cl.lng, pose.visBase, GLOBE_RADIUS),
                    pose,
                    W,
                    H,
                    fovDeg,
                );
                assert.ok(proj.visibleOnHorizon, `${id} step ${step.key} cluster ${cl.id} must stay visible in frame`);
                assert.ok(proj.x >= 8 && proj.x <= W - 8 && proj.y >= 8 && proj.y <= H - 8, `${id} step ${step.key} cluster ${cl.id} projected out of bounds`);
                markers.push({ id: cl.id, x: proj.x, y: proj.y, r: CLUSTER_DOT_RADIUS });
                labelRequests.push({
                    id: cl.id,
                    name: cl.name,
                    note: cl.note || `${cl.memberIds.length} actors`,
                    x: proj.x,
                    y: proj.y,
                    r: CLUSTER_DOT_RADIUS,
                    preferredSide: cl.preferredSide || 'b',
                    hidden: false,
                    priority: 94,
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

    // Section C regression checks & cluster/strict-arc geometry across every step at 1440px and 390px
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

    // Step cluster metadata must survive schema normalization cleanly
    const normalizedMy = normalizeCaseStudy(my);
    const myStep4 = normalizedMy.actorMap.steps.find(s => String(s.key) === '4');
    assert.equal(myStep4.clusters?.length, 1);
    assert.equal(myStep4.clusters[0].memberIds.length, 2);
    const myAllStep = normalizedMy.actorMap.steps.find(s => String(s.key) === 'all');
    assert.equal(myAllStep.clusters?.length, 1);
    assert.equal(myAllStep.clusters[0].memberIds.length, 6);

    const normalizedSom = normalizeCaseStudy(som);
    const somAllStep = normalizedSom.actorMap.steps.find(s => String(s.key) === 'all');
    assert.equal(somAllStep.clusters?.length, 1);
    assert.equal(somAllStep.clusters[0].memberIds.length, 2);
});

test('Strict geometry across every step (1-4 & All) at 1440px and 390px (3D & Flat): zero label/marker/arc overlaps', () => {
    const coordOf = actor => (
        actor?.location?.kind === 'pin'
            ? { lat: actor.location.latitude, lng: actor.location.longitude }
            : actor?.location?.kind === 'area' && actor.location.anchor
                ? { lat: actor.location.anchor.latitude, lng: actor.location.anchor.longitude }
                : null
    );
    const boxOverlap = (a, b) => !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
    const circleHitsBox = (m, b) => {
        const cx = Math.max(b.x0, Math.min(b.x1, m.x));
        const cy = Math.max(b.y0, Math.min(b.y1, m.y));
        return Math.hypot(m.x - cx, m.y - cy) < m.r;
    };
    const findUnlabelledStepActors = (entries, byId, actorToCluster, slotById, solved, { width = Infinity, height = Infinity } = {}) => {
        const missing = [];
        for (const entry of entries) {
            const actor = byId.get(entry.id);
            if (!actor) {
                missing.push(`${entry.id} (missing actor def)`);
                continue;
            }
            if (actor.location.kind === 'noSinglePlace') {
                const slot = slotById.get(actor.id);
                const onScreen = slot
                    && slot.cx - slot.w / 2 >= 8
                    && slot.cx + slot.w / 2 <= width - 8
                    && slot.cy - slot.h / 2 >= 6
                    && slot.cy + slot.h / 2 <= height * 0.5;
                if (!onScreen) missing.push(actor.id);
                continue;
            }
            const cl = actorToCluster.get(entry.id);
            if (cl) {
                if (!solved.actors.get(cl.id)?.visible) missing.push(`${entry.id} (cluster ${cl.id})`);
                continue;
            }
            if (!solved.actors.get(entry.id)?.visible) missing.push(entry.id);
        }
        return missing;
    };

    const configs = [
        { label: '1440px-3d', mode: '3d', width: 533, height: 540 },
        { label: '1440px-flat', mode: 'flat', width: 533, height: 540 },
        { label: '390px-flat', mode: 'flat', width: 360, height: 440 },
        { label: '390px-3d', mode: '3d', width: 360, height: 440 },
    ];
    const fovDeg = 50;

    for (const cs of [
        CASE_STUDIES_2026.find(c => c.id === 'myanmar-fragmented-sovereignty'),
        CASE_STUDIES_2026.find(c => c.id === 'somaliland-recognition-red-sea-order'),
    ]) {
        const byId = new Map(cs.actorMap.actors.map(a => [a.id, a]));
        const connsById = new Map(cs.actorMap.connections.map(x => [x.id, x]));

        for (const step of cs.actorMap.steps) {
            const { clusters, actorToCluster } = buildStepClusterIndex(step);
            const entries = step.actors || [];
            const floatingActors = entries.map(e => byId.get(e.id)).filter(a => a?.location?.kind === 'noSinglePlace');
            const surfaceCoords = [
                ...entries.filter(e => !actorToCluster.has(e.id)).map(e => coordOf(byId.get(e.id))).filter(Boolean),
                ...clusters.map(cl => ({ lat: cl.lat, lng: cl.lng })),
            ];

            for (const cfg of configs) {
                const { mode, width: W, height: H, label: vpLabel } = cfg;
                const floatingSlots = computeFloatingBadgeScreenSlots(floatingActors, W, H);
                const slotById = new Map(floatingSlots.map(s => [s.id, s]));

                let cam = null;
                let pose = null;
                let projection = null;
                let flatHalf = 0;
                if (mode === '3d') {
                    cam = fitCameraToActors(step.cam, surfaceCoords, W, H, { fovDeg, hasFloatingBadges: floatingActors.length > 0 });
                    pose = computeCameraPose(cam, { h: 0, t: 0 }, 0, GLOBE_RADIUS);
                } else {
                    const view = computeFlatTargetView(
                        step,
                        surfaceCoords.map(c => [c.lng, c.lat]),
                        W,
                        H,
                        floatingActors.length > 0,
                    );
                    flatHalf = view.half;
                    const radius = Math.min(W, H) / (2 * Math.sin((Math.max(1, view.half) * Math.PI) / 180));
                    projection = geoOrthographic()
                        .clipAngle(90)
                        .precision(0.4)
                        .translate([W / 2, H / 2 + (floatingActors.length > 0 ? 18 : 0)])
                        .rotate([-view.lng, -view.lat])
                        .scale(radius);
                }

                const markers = [];
                const actorLabels = [];
                const posMap = new Map();

                for (const entry of entries) {
                    if (actorToCluster.has(entry.id)) continue;
                    const actor = byId.get(entry.id);
                    if (!actor) continue;
                    if (actor.location.kind === 'noSinglePlace') {
                        const sl = slotById.get(actor.id);
                        if (sl) {
                            posMap.set(
                                actor.id,
                                mode === 'flat'
                                    ? [sl.cx, sl.cy + sl.h / 2]
                                    : unprojectScreenToGlobeSpace(sl.cx, sl.cy, pose, W, H, fovDeg, GLOBE_RADIUS),
                            );
                        }
                        continue;
                    }
                    const co = coordOf(actor);
                    const pt = mode === 'flat'
                        ? projection([co.lng, co.lat])
                        : (() => {
                            const pr = projectPointWithPose(latLngAltToVec3(co.lat, co.lng, pose.visBase, GLOBE_RADIUS), pose, W, H, fovDeg);
                            return pr.visibleOnHorizon ? [pr.x, pr.y] : null;
                        })();
                    assert.ok(pt, `${cs.id} ${step.key} ${vpLabel}: actor ${actor.id} not visible`);
                    const flatR = step.quietLabels
                        ? Math.max(3.5, (actor.level === 'regional' ? 9.5 : actor.level === 'state' ? 8 : 6) * 0.72)
                        : (actor.level === 'regional' ? 9.5 : actor.level === 'state' ? 8 : 7);
                    const r = mode === 'flat'
                        ? flatR
                        : (entry.small ? 5 : actor.level === 'regional' ? 10.5 : actor.level === 'state' ? 8.5 : 7);
                    markers.push({ id: actor.id, x: pt[0], y: pt[1], r });
                    posMap.set(actor.id, mode === 'flat' ? pt : { lat: co.lat, lng: co.lng, alt: pose.visBase, isFloating: false });
                    actorLabels.push({
                        id: actor.id,
                        name: actor.name,
                        note: entry.note || (actor.location.kind === 'pin' ? actor.location.place : actor.location.label),
                        x: pt[0],
                        y: pt[1],
                        r,
                        preferredSide: entry.preferredSide || 'r',
                        hidden: Boolean(entry.small),
                        priority: actor.level === 'regional' ? (mode === 'flat' ? 95 : 96) : actor.level === 'state' ? 88 : 78,
                    });
                }

                for (const cl of clusters) {
                    const pt = mode === 'flat'
                        ? projection([cl.lng, cl.lat])
                        : (() => {
                            const pr = projectPointWithPose(latLngAltToVec3(cl.lat, cl.lng, pose.visBase, GLOBE_RADIUS), pose, W, H, fovDeg);
                            return pr.visibleOnHorizon ? [pr.x, pr.y] : null;
                        })();
                    assert.ok(pt, `${cs.id} ${step.key} ${vpLabel}: cluster ${cl.id} not visible`);
                    markers.push({ id: cl.id, x: pt[0], y: pt[1], r: CLUSTER_DOT_RADIUS });
                    posMap.set(cl.id, mode === 'flat' ? pt : { lat: cl.lat, lng: cl.lng, alt: pose.visBase, isFloating: false });
                    actorLabels.push({
                        id: cl.id,
                        name: cl.name,
                        note: cl.note || `${cl.memberIds.length} actors`,
                        x: pt[0],
                        y: pt[1],
                        r: CLUSTER_DOT_RADIUS,
                        preferredSide: cl.preferredSide || 'b',
                        hidden: false,
                        priority: 94,
                    });
                }

                for (const loc of cs.map?.locations || []) {
                    const lat = Number(loc.latitude);
                    const lng = Number(loc.longitude);
                    const matched = entries.some(e => {
                        const ac = coordOf(byId.get(e.id));
                        return ac && Math.hypot(ac.lat - lat, ac.lng - lng) < 0.08;
                    });
                    if (matched) continue;
                    const pt = mode === 'flat'
                        ? projection([lng, lat])
                        : (() => {
                            const pr = projectPointWithPose(latLngAltToVec3(lat, lng, pose.visBase, GLOBE_RADIUS), pose, W, H, fovDeg);
                            return pr.visibleOnHorizon ? [pr.x, pr.y] : null;
                        })();
                    if (!pt || pt[0] < 12 || pt[0] > W - 12 || pt[1] < 12 || pt[1] > H - 12) continue;
                    markers.push({ id: `place:${loc.label}`, x: pt[0], y: pt[1], r: 5.5 });
                    actorLabels.push({
                        id: `place:${loc.label}`,
                        name: loc.label,
                        note: '',
                        x: pt[0],
                        y: pt[1],
                        r: 5.5,
                        preferredSide: 'r',
                        hidden: Boolean(step.quietLabels),
                        priority: 52,
                    });
                }

                const resolved = resolveMarkerCollisions(markers, { width: W, height: H, padding: 10, minGap: 2 });
                const resolvedList = markers.map(m => {
                    const r = resolved.get(m.id);
                    const updated = r ? { ...m, x: r.x, y: r.y } : m;
                    if (mode === 'flat' && posMap.has(m.id) && r) posMap.set(m.id, [r.x, r.y]);
                    return updated;
                });
                for (const req of actorLabels) {
                    const r = resolved.get(req.id);
                    if (r) { req.x = r.x; req.y = r.y; }
                }

                const stepActorMap = new Map(entries.map(e => [e.id, e]));
                const endpointPad = (actorId, isTo) => {
                    if (actorToCluster.has(actorId)) return CLUSTER_DOT_RADIUS + (isTo ? 5 : 4);
                    const a = byId.get(actorId);
                    if (a?.location?.kind === 'noSinglePlace') return isTo ? 5 : 4;
                    const baseR = a?.level === 'regional' ? 9.5 : a?.level === 'state' ? 8 : 7;
                    return (stepActorMap.get(actorId)?.small ? 4 : baseR) + (isTo ? 5 : 4);
                };

                const arcPoints = [];
                const linkLabels = [];
                for (const cid of step.connections || []) {
                    const conn = connsById.get(cid);
                    if (!conn || !isStepConnectionVisible(conn, actorToCluster)) continue;
                    const clFrom = actorToCluster.get(conn.from);
                    const clTo = actorToCluster.get(conn.to);
                    const pF = clFrom ? posMap.get(clFrom.id) : posMap.get(conn.from);
                    const pT = clTo ? posMap.get(clTo.id) : posMap.get(conn.to);
                    if (!pF || !pT) continue;
                    if (mode === 'flat') {
                        const fromFloat = byId.get(conn.from)?.location?.kind === 'noSinglePlace';
                        const { len, quadAt, samplePts } = buildFlatArcGeometry(pF, pT, {
                            padA: endpointPad(conn.from, false),
                            padB: endpointPad(conn.to, true),
                            side: conn.side || 0.16,
                            fromFloating: fromFloat,
                        });
                        arcPoints.push({ id: conn.id, points: samplePts });
                        const halfW = Math.ceil((String(conn.label || '').length * 6.6 + 16) / 2) + 8;
                        linkLabels.push({
                            id: conn.id,
                            label: conn.label,
                            priority: conn.type === 'pressure' ? 68 : 60,
                            hidden: Boolean(step.quietLabels || len < 22),
                            candidates: [
                                ...[0.5, 0.4, 0.6, 0.34, 0.66, 0.26, 0.74].map(t => {
                                    const p = quadAt(t);
                                    return { x: p[0], y: p[1] - 10 };
                                }),
                                ...[1, -1].map(dir => {
                                    const p = quadAt(0.5);
                                    return { x: p[0] + dir * halfW, y: p[1] - 6 };
                                }),
                            ],
                        });
                    } else {
                        const prof = computeArcProfile([pF.lng, pF.lat], [pT.lng, pT.lat], {
                            camDist: cam.dist,
                            visBase: pose.visBase,
                            side: conn.side || 0,
                            isDrop: Boolean(pF.isFloating),
                            fromAlt: pF.alt,
                            toAlt: pT.alt,
                        });
                        const pts = [];
                        const lastSampleIdx = Math.max(1, prof.pts.length - 2);
                        const ast = Math.max(1, Math.floor((prof.pts.length - 1) / 22));
                        const indices = [];
                        for (let si = 1; si <= lastSampleIdx; si += ast) indices.push(si);
                        if (indices[indices.length - 1] !== lastSampleIdx) indices.push(lastSampleIdx);
                        for (const si of indices) {
                            const ptS = prof.pts[si];
                            const pr = projectPointWithPose(latLngAltToVec3(ptS[1], ptS[0], ptS[2], GLOBE_RADIUS), pose, W, H, fovDeg);
                            if (pr.visibleOnHorizon) pts.push({ x: pr.x, y: pr.y });
                        }
                        arcPoints.push({ id: conn.id, points: pts });
                        const candidates = [];
                        for (const frac of [0.5, 0.4, 0.6, 0.34, 0.66, 0.26, 0.74]) {
                            const pt = prof.pts[Math.round((prof.pts.length - 1) * frac)];
                            const pr = projectPointWithPose(latLngAltToVec3(pt[1], pt[0], pt[2], GLOBE_RADIUS), pose, W, H, fovDeg);
                            if (pr.visibleOnHorizon) candidates.push({ x: pr.x, y: pr.y });
                        }
                        linkLabels.push({
                            id: conn.id,
                            label: conn.label,
                            priority: conn.type === 'pressure' ? 68 : 60,
                            hidden: Boolean(step.quietLabels),
                            candidates,
                        });
                    }
                }

                const stepActorIds = new Set(entries.map(e => e.id));
                const showCountries = mode === '3d' ? cam.dist < 0.88 : flatHalf < 36;
                const countryLabels = showCountries
                    ? (cs.actorMap.contextLabels || [])
                        .filter(cl => mode === 'flat' || !stepActorIds.has(cl.name.toLowerCase()))
                        .map(cl => {
                            const pt = mode === 'flat'
                                ? projection([cl.longitude, cl.latitude])
                                : (() => {
                                    const pr = projectPointWithPose(latLngAltToVec3(cl.latitude, cl.longitude, 0.0005, GLOBE_RADIUS), pose, W, H, fovDeg);
                                    return pr.visibleOnHorizon ? [pr.x, pr.y] : null;
                                })();
                            return pt ? { name: cl.name, x: pt[0], y: pt[1] } : null;
                        })
                        .filter(Boolean)
                    : [];

                const reservedBoxes = [
                    { x0: 6, y0: H - (W < 480 ? 116 : 132), x1: W < 480 ? 114 : 148, y1: H - 6 },
                    ...(mode === '3d' && W >= 480 ? [{ x0: W - 250, y0: H - 40, x1: W - 6, y1: H - 6 }] : []),
                    ...(mode === '3d' && floatingSlots.length > 0 ? [{ x0: 8, y0: 4, x1: Math.min(W - 8, 250), y1: 22 }] : []),
                ];

                const solved = solveActorMapLabels({
                    width: W,
                    height: H,
                    markers: resolvedList,
                    floatingBadges: floatingSlots,
                    actorLabels,
                    linkLabels,
                    countryLabels,
                    arcPoints,
                    reservedBoxes,
                    padding: 8,
                });

                const placedEntries = [];
                for (const [aid, res] of solved.actors.entries()) {
                    if (res.visible) placedEntries.push({ tag: `actor:${aid}`, box: res.box, excludeArcId: null, checkAllArcs: true });
                }
                for (const [lid, res] of solved.links.entries()) {
                    if (res.visible) placedEntries.push({ tag: `link:${lid}`, box: res.box, excludeArcId: lid, checkAllArcs: false });
                }
                for (const [cname, res] of solved.countries.entries()) {
                    if (res.visible) placedEntries.push({ tag: `country:${cname}`, box: res.box, excludeArcId: null, checkAllArcs: true });
                }

                // 1) No pairwise label overlap & no overlap with floating badges
                for (let i = 0; i < placedEntries.length; i += 1) {
                    const a = placedEntries[i];
                    for (let j = i + 1; j < placedEntries.length; j += 1) {
                        const b = placedEntries[j];
                        assert.equal(
                            boxOverlap(a.box, b.box),
                            false,
                            `${cs.id} step ${step.key} (${vpLabel}): ${a.tag} overlaps ${b.tag}`,
                        );
                    }
                    for (const fb of floatingSlots) {
                        const fbBox = { x0: fb.cx - fb.w / 2, y0: fb.cy - fb.h / 2, x1: fb.cx + fb.w / 2, y1: fb.cy + fb.h / 2 + 14 };
                        assert.equal(
                            boxOverlap(a.box, fbBox),
                            false,
                            `${cs.id} step ${step.key} (${vpLabel}): ${a.tag} overlaps floating badge ${fb.id}`,
                        );
                    }
                    // 2) No label overlaps any visible marker circle
                    for (const m of resolvedList) {
                        assert.equal(
                            circleHitsBox(m, a.box),
                            false,
                            `${cs.id} step ${step.key} (${vpLabel}): ${a.tag} overlaps marker ${m.id}`,
                        );
                    }
                    // 3) No label overlaps arcs
                    assert.equal(
                        boxIntersectsArcs(a.box, arcPoints, { excludeArcId: a.excludeArcId, pad: 1 }),
                        false,
                        `${cs.id} step ${step.key} (${vpLabel}): ${a.tag} crosses an arc`,
                    );
                }

                // 4) Every actor shown in step.actors must have a readable label (floating pill, visible cluster, or visible actor label)
                const unlabelled = findUnlabelledStepActors(entries, byId, actorToCluster, slotById, solved, { width: W, height: H });
                assert.deepEqual(
                    unlabelled,
                    [],
                    `${cs.id} step ${step.key} (${vpLabel}): unlabelled actors: ${unlabelled.join(', ')}`,
                );

                // Step-specific invariants required by review
                if (cs.id === 'myanmar-fragmented-sovereignty' && String(step.key) === '4') {
                    assert.ok(solved.actors.get('myanmar-step4-actors')?.visible, `Myanmar Step 4 cluster label must be visible (${vpLabel})`);
                }
                if (cs.id === 'myanmar-fragmented-sovereignty' && String(step.key) === 'all') {
                    assert.ok(solved.actors.get('myanmar-actors')?.visible, `Myanmar cluster label must be visible (${vpLabel})`);
                    assert.ok(solved.actors.get('india')?.visible, `India label must be visible in Myanmar All (${vpLabel})`);
                    assert.ok(solved.actors.get('asean')?.visible, `ASEAN label must be visible in Myanmar All (${vpLabel})`);
                }
                if (cs.id === 'somaliland-recognition-red-sea-order' && String(step.key) === '4') {
                    assert.ok(solved.actors.get('somaliland-authorities')?.visible, `Somaliland authorities must be visible in Step 4 (${vpLabel})`);
                }
                if (cs.id === 'somaliland-recognition-red-sea-order' && String(step.key) === 'all') {
                    assert.ok(solved.actors.get('somaliland-local-actors')?.visible, `Somaliland cluster label must be visible in All (${vpLabel})`);
                    assert.ok(solved.actors.get('igad')?.visible, `IGAD label must be visible in Somaliland All (${vpLabel})`);
                }
                if (cs.id === 'somaliland-recognition-red-sea-order' && vpLabel === '390px-flat') {
                    const fg = solved.actors.get('somalia-fg');
                    assert.ok(fg?.visible, `Federal Government of Somalia must stay visible in Somaliland step ${step.key} at 390px flat`);
                    assert.equal(boxIntersectsArcs(fg.box, arcPoints, { pad: 1 }), false, `Federal Government of Somalia must stay clear of every arc in step ${step.key}`);
                }
            }
        }
    }

    // Cluster selection highlights, intra-cluster connection suppression, and selected-item arc fallback
    const my = CASE_STUDIES_2026.find(c => c.id === 'myanmar-fragmented-sovereignty');
    const allStep = my.actorMap.steps.find(s => String(s.key) === 'all');
    const connMap = new Map(my.actorMap.connections.map(c => [c.id, c]));
    assert.equal(isRelatedActorMapItem({ kind: 'cluster', id: 'myanmar-actors' }, 'actor', 'military-authorities', allStep, connMap), true);
    assert.equal(isRelatedActorMapItem({ kind: 'cluster', id: 'myanmar-actors' }, 'connection', 'asean-ban', allStep, connMap), true);
    assert.equal(isRelatedActorMapItem({ kind: 'actor', id: 'military-authorities' }, 'cluster', 'myanmar-actors', allStep, connMap), true);
    assert.equal(isRelatedActorMapItem({ kind: 'connection', id: 'donor-funding' }, 'cluster', 'myanmar-actors', allStep, connMap), true);
    assert.equal(isRelatedActorMapItem({ kind: 'connection', id: 'asean-ban' }, 'actor', 'india', allStep, connMap), false);

    // When every side touches an arc, unselected actor hides while allowArcFallback keeps selected actor visible
    const crowdedArcs = [
        { id: 'n', points: [{ x: 150, y: 185 }, { x: 250, y: 185 }] },
        { id: 's', points: [{ x: 150, y: 215 }, { x: 250, y: 215 }] },
        { id: 'w', points: [{ x: 180, y: 160 }, { x: 180, y: 240 }] },
        { id: 'e', points: [{ x: 220, y: 160 }, { x: 220, y: 240 }] },
    ];
    const hiddenCrowded = solveActorMapLabels({
        width: 400,
        height: 400,
        markers: [{ id: 'p', x: 200, y: 200, r: 8 }],
        actorLabels: [{ id: 'p', name: 'Crowded', x: 200, y: 200, r: 8, priority: 50 }],
        arcPoints: crowdedArcs,
    });
    assert.equal(hiddenCrowded.actors.get('p').visible, false);

    const visibleSelected = solveActorMapLabels({
        width: 400,
        height: 400,
        markers: [{ id: 'p', x: 200, y: 200, r: 8 }],
        actorLabels: [{ id: 'p', name: 'Crowded', x: 200, y: 200, r: 8, priority: 200, allowArcFallback: true }],
        arcPoints: crowdedArcs,
    });
    assert.equal(visibleSelected.actors.get('p').visible, true);

    // An unclustered hidden/small actor or misspelled actor id fails findUnlabelledStepActors
    const unlabelledCatch = solveActorMapLabels({
        width: 400,
        height: 400,
        markers: [{ id: 'igad', x: 180, y: 260, r: 9 }],
        actorLabels: [{ id: 'igad', name: 'IGAD', x: 180, y: 260, r: 9, hidden: true, priority: 96 }],
    });
    const somMap = new Map([['igad', { id: 'igad', location: { kind: 'area' } }]]);
    assert.deepEqual(
        findUnlabelledStepActors([{ id: 'igad', small: true }, { id: 'typo-actor' }], somMap, new Map(), new Map(), unlabelledCatch),
        ['igad', 'typo-actor (missing actor def)'],
    );
});

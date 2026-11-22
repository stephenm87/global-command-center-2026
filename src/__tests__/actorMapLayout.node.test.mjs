import test from 'node:test';
import assert from 'node:assert/strict';
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
    solveActorMapLabels,
} from '../components/actorMapLayout.mjs';
import {
    chooseActorMapMode,
    isLowPowerDeviceConfig,
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

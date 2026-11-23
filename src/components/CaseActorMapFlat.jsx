import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { geoDistance, geoGraticule10, geoOrthographic, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';
import { computeFloatingBadgeScreenSlots, cubicInOut } from './actorMapCamera.mjs';
import {
    CLUSTER_DOT_RADIUS,
    buildStepClusterIndex,
    isRelatedActorMapItem,
    isStepConnectionVisible,
    resolveMarkerCollisions,
    solveActorMapLabels,
} from './actorMapLayout.mjs';
import { measureResourceThroughput } from './actorMapMode.mjs';

const LEVEL_COLORS = {
    local: '#ffd9a0',
    state: '#67d5f5',
    regional: '#b79cff',
    global: '#f7f3e8',
};

const TYPE_COLORS = {
    conflict: '#ff5d6c',
    pressure: '#ff9f43',
    support: '#4ade80',
    movement: '#cfe3ee',
};

const NODE_RADIUS = {
    local: 6,
    state: 8,
    regional: 9.5,
    global: 7.5,
};

let world110TimedPromise = null;
export function loadWorld110Timed() {
    if (!world110TimedPromise) {
        const startedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
            ? performance.now()
            : Date.now();
        world110TimedPromise = fetch('/assets/globe/countries-110m.json')
            .then(async res => {
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const text = await res.text();
                const endedAt = typeof performance !== 'undefined' && typeof performance.now === 'function'
                    ? performance.now()
                    : Date.now();
                const world = JSON.parse(text);
                const byteLength = typeof TextEncoder !== 'undefined'
                    ? new TextEncoder().encode(text).length
                    : text.length;
                const entry = typeof performance !== 'undefined' && typeof performance.getEntriesByType === 'function'
                    ? performance.getEntriesByType('resource').filter(r => r.name.includes('countries-110m.json')).pop()
                    : null;
                const { bytes, durationMs } = measureResourceThroughput(entry, byteLength, Math.max(0, endedAt - startedAt));
                return {
                    features: topojson.feature(world, world.objects.countries).features,
                    bytes,
                    durationMs,
                };
            })
            .catch(err => {
                world110TimedPromise = null;
                throw err;
            });
    }
    return world110TimedPromise;
}

function loadWorld110() {
    return loadWorld110Timed().then(result => result.features);
}

function actorCoord(actor) {
    if (!actor?.location) return null;
    if (actor.location.kind === 'pin') {
        return [actor.location.longitude, actor.location.latitude];
    }
    if (actor.location.kind === 'area' && actor.location.anchor) {
        return [actor.location.anchor.longitude, actor.location.anchor.latitude];
    }
    return null;
}

function computeTargetView(step, surfaceCoords, width, height, hasFloating) {
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

function initialFlatBox() {
    if (typeof window === 'undefined') return { width: 533, height: 540 };
    if (window.innerWidth < 720) {
        return { width: Math.max(280, window.innerWidth - 32), height: 440 };
    }
    return { width: 533, height: 540 };
}

export default function CaseActorMapFlat({
    actorMap,
    mapLocations = [],
    activeStepKey = '1',
    selected = null,
    onSelect,
    reducedMotion = false,
}) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const wrapRef = useRef(null);
    const [box, setBox] = useState(initialFlatBox);
    const [countries, setCountries] = useState(null);
    const [hoveredClusterId, setHoveredClusterId] = useState(null);
    const clusterHoverTimerRef = useRef(null);

    const clearClusterHoverTimer = () => {
        if (clusterHoverTimerRef.current) {
            clearTimeout(clusterHoverTimerRef.current);
            clusterHoverTimerRef.current = null;
        }
    };

    const openClusterPopover = clusterId => {
        clearClusterHoverTimer();
        setHoveredClusterId(clusterId);
    };

    const scheduleCloseClusterPopover = () => {
        clearClusterHoverTimer();
        clusterHoverTimerRef.current = setTimeout(() => {
            setHoveredClusterId(null);
        }, 140);
    };

    useEffect(() => () => clearClusterHoverTimer(), []);
    useEffect(() => {
        clearClusterHoverTimer();
        setHoveredClusterId(null);
    }, [activeStepKey, actorMap?.focusCountry]);

    const step = useMemo(
        () => actorMap?.steps?.find(s => String(s.key) === String(activeStepKey)) || actorMap?.steps?.[0],
        [actorMap, activeStepKey],
    );

    const { clusters: stepClusters, actorToCluster } = useMemo(
        () => buildStepClusterIndex(step),
        [step],
    );

    const actorById = useMemo(
        () => new Map((actorMap?.actors || []).map(a => [a.id, a])),
        [actorMap],
    );
    const connById = useMemo(
        () => new Map((actorMap?.connections || []).map(c => [c.id, c])),
        [actorMap],
    );

    const surfaceCoords = useMemo(() => {
        if (!step) return [];
        return [
            ...(step.actors || [])
                .filter(entry => !actorToCluster.has(entry.id))
                .map(entry => actorCoord(actorById.get(entry.id)))
                .filter(Boolean),
            ...stepClusters.map(cluster => [cluster.lng, cluster.lat]),
        ];
    }, [step, actorById, stepClusters, actorToCluster]);

    const floatingActors = useMemo(() => {
        if (!step) return [];
        return (step.actors || [])
            .map(entry => actorById.get(entry.id))
            .filter(actor => actor?.location?.kind === 'noSinglePlace');
    }, [step, actorById]);

    const [view, setView] = useState(() => computeTargetView(
        step,
        surfaceCoords,
        box.width,
        box.height,
        floatingActors.length > 0,
    ));
    const currentViewRef = useRef(view);
    currentViewRef.current = view;
    const lastStepKeyRef = useRef(`${actorMap?.focusCountry || ''}:${String(step?.key || activeStepKey)}`);
    const mountInitRef = useRef(false);

    useEffect(() => {
        let cancelled = false;
        loadWorld110()
            .then(feats => { if (!cancelled) setCountries(feats); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, []);

    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return undefined;
        const measure = () => {
            const w = Math.floor(el.clientWidth);
            const h = Math.floor(el.clientHeight);
            if (w > 0 && h > 0) {
                setBox(prev => (prev.width === w && prev.height === h ? prev : { width: w, height: h }));
            }
        };
        measure();
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(measure) : null;
        ro?.observe(el);
        return () => ro?.disconnect();
    }, []);

    useEffect(() => {
        const target = computeTargetView(step, surfaceCoords, box.width, box.height, floatingActors.length > 0);
        const stepId = `${actorMap?.focusCountry || ''}:${String(step?.key || activeStepKey)}`;
        const isStepTransition = mountInitRef.current && lastStepKeyRef.current !== stepId;
        mountInitRef.current = true;
        lastStepKeyRef.current = stepId;

        if (!isStepTransition || reducedMotion || typeof requestAnimationFrame !== 'function') {
            setView(prev => (
                Math.abs(prev.lng - target.lng) < 0.01
                && Math.abs(prev.lat - target.lat) < 0.01
                && Math.abs(prev.half - target.half) < 0.01
                    ? prev
                    : target
            ));
            return undefined;
        }
        const from = { ...currentViewRef.current };
        const t0 = performance.now();
        const dur = 1100;
        let raf = 0;
        const tick = now => {
            const k = Math.min(1, (now - t0) / dur);
            const e = cubicInOut(k);
            const nextHalf = Math.exp(Math.log(Math.max(1, from.half)) * (1 - e) + Math.log(Math.max(1, target.half)) * e);
            const lngDelta = ((target.lng - from.lng + 540) % 360) - 180;
            setView({
                lng: from.lng + lngDelta * e,
                lat: from.lat + (target.lat - from.lat) * e,
                half: nextHalf,
            });
            if (k < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [actorMap?.focusCountry, activeStepKey, step, surfaceCoords, box.width, box.height, floatingActors.length, reducedMotion]);

    const scene = useMemo(() => {
        if (!step) return null;
        const { width, height } = box;
        const hasFloating = floatingActors.length > 0;
        const radius = Math.min(width, height) / (2 * Math.sin((Math.max(1, view.half) * Math.PI) / 180));
        const tx = width / 2;
        const ty = height / 2 + (hasFloating ? 18 : 0);
        const projection = geoOrthographic()
            .clipAngle(90)
            .precision(0.4)
            .translate([tx, ty])
            .rotate([-view.lng, -view.lat])
            .scale(radius);
        const pathGen = geoPath(projection);
        const graticule = pathGen(geoGraticule10()) || '';
        const sphereDisc = `M${tx - radius},${ty} a${radius},${radius} 0 1,0 ${2 * radius},0 a${radius},${radius} 0 1,0 ${-2 * radius},0`;
        const isVisible = coord => geoDistance(coord, [view.lng, view.lat]) < 1.44;

        const blocSet = new Set(step.bloc && actorMap?.bloc?.members ? actorMap.bloc.members : []);
        const activeCountries = new Set();
        const stepActorMap = new Map((step.actors || []).map(entry => [entry.id, entry]));

        for (const entry of step.actors || []) {
            const actor = actorById.get(entry.id);
            if (actor?.location?.kind === 'area' && Array.isArray(actor.location.countries)) {
                actor.location.countries.forEach(c => activeCountries.add(c));
            }
        }

        const floatingSlots = computeFloatingBadgeScreenSlots(floatingActors, width, height);
        const slotById = new Map(floatingSlots.map(s => [s.id, s]));

        const actorPositions = new Map();
        const clusterPositions = new Map();
        const markers = [];
        const clusterMarkers = [];
        const actorLabels = [];

        for (const entry of step.actors || []) {
            if (actorToCluster.has(entry.id)) continue;
            const actor = actorById.get(entry.id);
            if (!actor) continue;
            if (actor.location.kind === 'noSinglePlace') {
                const slot = slotById.get(actor.id);
                if (slot) actorPositions.set(actor.id, [slot.cx, slot.cy + slot.h / 2]);
                continue;
            }
            const coord = actorCoord(actor);
            if (!coord || !isVisible(coord)) continue;
            const pt = projection(coord);
            if (!pt) continue;
            actorPositions.set(actor.id, pt);
            const r = step.quietLabels
                ? Math.max(3.5, (NODE_RADIUS[actor.level] || 6) * 0.72)
                : (NODE_RADIUS[actor.level] || 7);
            markers.push({
                actor,
                entry,
                x: pt[0],
                y: pt[1],
                r,
                isRelated: isRelatedActorMapItem(selected, 'actor', actor.id, step, connById),
                isSelected: selected?.kind === 'actor' && selected.id === actor.id,
            });
            const isSel = selected?.kind === 'actor' && selected.id === actor.id;
            const subNote = entry.note || (actor.location.kind === 'pin' ? actor.location.place : actor.location.label);
            actorLabels.push({
                id: actor.id,
                name: actor.name,
                note: subNote,
                x: pt[0],
                y: pt[1],
                r,
                preferredSide: entry.preferredSide || 'r',
                hidden: Boolean(entry.small && !isSel),
                priority: isSel ? 200 : actor.level === 'regional' ? 95 : actor.level === 'state' ? 88 : 78,
            });
        }

        for (const cluster of stepClusters) {
            const members = (cluster.memberIds || []).map(id => actorById.get(id)).filter(Boolean);
            const coord = [cluster.lng, cluster.lat];
            if (!members.length || !isVisible(coord)) continue;
            const pt = projection(coord);
            if (!pt) continue;
            clusterPositions.set(cluster.id, pt);
            const isSel = selected?.kind === 'cluster' && selected.id === cluster.id;
            clusterMarkers.push({
                cluster,
                members,
                x: pt[0],
                y: pt[1],
                r: CLUSTER_DOT_RADIUS,
                isRelated: isRelatedActorMapItem(selected, 'cluster', cluster.id, step, connById),
                isSelected: isSel,
            });
            actorLabels.push({
                id: cluster.id,
                name: cluster.name,
                note: cluster.note || `${members.length} actors`,
                x: pt[0],
                y: pt[1],
                r: CLUSTER_DOT_RADIUS,
                preferredSide: cluster.preferredSide || 'b',
                hidden: false,
                priority: isSel ? 200 : 94,
            });
        }

        // Subtle place markers from existing map.locations not already plotted cleanly as step actors
        const extraPlaces = [];
        const stepPlaceThresholdDeg = 0.08;
        for (const loc of mapLocations || []) {
            if (!Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) continue;
            const coord = [Number(loc.longitude), Number(loc.latitude)];
            const matchesStepActor = [...actorPositions.keys()].some(id => {
                const c = actorCoord(actorById.get(id));
                return c && Math.hypot(c[0] - coord[0], c[1] - coord[1]) < stepPlaceThresholdDeg;
            });
            if (matchesStepActor || !isVisible(coord)) continue;
            const pt = projection(coord);
            if (!pt) continue;
            extraPlaces.push({
                loc,
                x: pt[0],
                y: pt[1],
                isSelected: selected?.kind === 'place' && selected.id === loc.label,
            });
            actorLabels.push({
                id: `place:${loc.label}`,
                name: loc.label,
                note: '',
                x: pt[0],
                y: pt[1],
                r: 5.5,
                preferredSide: 'r',
                hidden: Boolean(step.quietLabels && !(selected?.kind === 'place' && selected.id === loc.label)),
                priority: selected?.kind === 'place' && selected.id === loc.label ? 190 : 52,
            });
        }

        const collisionTargets = [
            ...markers.map(m => ({ id: m.actor.id, x: m.x, y: m.y, r: m.r })),
            ...clusterMarkers.map(m => ({ id: m.cluster.id, x: m.x, y: m.y, r: m.r })),
            ...extraPlaces.map(p => ({ id: `place:${p.loc.label}`, x: p.x, y: p.y, r: 5.5 })),
        ];
        const resolvedCoords = resolveMarkerCollisions(collisionTargets, { width, height, padding: 10, minGap: 2 });
        for (const m of markers) {
            const p = resolvedCoords.get(m.actor.id);
            if (p) {
                m.x = p.x;
                m.y = p.y;
                actorPositions.set(m.actor.id, [p.x, p.y]);
            }
        }
        for (const m of clusterMarkers) {
            const p = resolvedCoords.get(m.cluster.id);
            if (p) {
                m.x = p.x;
                m.y = p.y;
                clusterPositions.set(m.cluster.id, [p.x, p.y]);
            }
        }
        for (const extra of extraPlaces) {
            const p = resolvedCoords.get(`place:${extra.loc.label}`);
            if (p) {
                extra.x = p.x;
                extra.y = p.y;
            }
        }
        for (const lbl of actorLabels) {
            const p = resolvedCoords.get(lbl.id);
            if (p) {
                lbl.x = p.x;
                lbl.y = p.y;
            }
        }

        const resolveEndpoint = id => {
            const cluster = actorToCluster.get(id);
            if (cluster) return clusterPositions.get(cluster.id);
            return actorPositions.get(id);
        };
        const endpointPad = (id, isTo) => {
            if (actorToCluster.has(id)) return CLUSTER_DOT_RADIUS + (isTo ? 5 : 4);
            const a = actorById.get(id);
            if (a?.location?.kind === 'noSinglePlace') return isTo ? 5 : 4;
            return (stepActorMap.get(id)?.small ? 4 : NODE_RADIUS[a?.level] || 7) + (isTo ? 5 : 4);
        };

        const linkItems = [];
        const linkLabelRequests = [];
        const arcPoints = [];
        for (const cid of step.connections || []) {
            const conn = connById.get(cid);
            if (!conn || !isStepConnectionVisible(conn, actorToCluster)) continue;
            const a = resolveEndpoint(conn.from);
            const b = resolveEndpoint(conn.to);
            if (!a || !b) continue;
            const fromActor = actorById.get(conn.from);
            const fromFloating = fromActor?.location?.kind === 'noSinglePlace';
            const padA = endpointPad(conn.from, false);
            const padB = endpointPad(conn.to, true);
            const dx = b[0] - a[0];
            const dy = b[1] - a[1];
            const len = Math.hypot(dx, dy) || 1;
            const ctrl = fromFloating
                ? [a[0] + dx * 0.14, a[1] + dy * 0.72]
                : [(a[0] + b[0]) / 2 - (dy / len) * (conn.side || 0.16) * len, (a[1] + b[1]) / 2 + (dx / len) * (conn.side || 0.16) * len];
            const trim = (p, toward, pad) => {
                const vx = toward[0] - p[0];
                const vy = toward[1] - p[1];
                const vl = Math.hypot(vx, vy) || 1;
                return [p[0] + (vx / vl) * pad, p[1] + (vy / vl) * pad];
            };
            const a2 = trim(a, ctrl, padA);
            const b2 = trim(b, ctrl, padB);
            const quadAt = t => [
                (1 - t) * (1 - t) * a2[0] + 2 * (1 - t) * t * ctrl[0] + t * t * b2[0],
                (1 - t) * (1 - t) * a2[1] + 2 * (1 - t) * t * ctrl[1] + t * t * b2[1],
            ];
            const samplePts = [];
            for (let s = 1; s <= 11; s += 1) {
                const ptSample = quadAt(s / 12);
                samplePts.push({ x: ptSample[0], y: ptSample[1] });
            }
            arcPoints.push({ id: conn.id, points: samplePts });
            const isSel = selected?.kind === 'connection' && selected.id === conn.id;
            linkItems.push({
                conn,
                d: `M${a2[0]},${a2[1]} Q${ctrl[0]},${ctrl[1]} ${b2[0]},${b2[1]}`,
                isRelated: isRelatedActorMapItem(selected, 'connection', conn.id, step, connById),
                isSelected: isSel,
            });
            linkLabelRequests.push({
                id: conn.id,
                label: conn.label,
                priority: isSel ? 180 : conn.type === 'pressure' ? 68 : 60,
                hidden: Boolean((step.quietLabels && !isSel) || len < 22),
                candidates: [
                    ...[0.5, 0.4, 0.6, 0.34, 0.66, 0.26, 0.74].map(t => {
                        const p = quadAt(t);
                        return { x: p[0], y: p[1] - 10 };
                    }),
                    ...[1, -1].map(dir => {
                        const p = quadAt(0.5);
                        const halfW = Math.ceil((String(conn.label || '').length * 6.6 + 16) / 2) + 8;
                        return { x: p[0] + dir * halfW, y: p[1] - 6 };
                    }),
                ],
            });
        }

        const countryLabelRequests = view.half < 36
            ? (actorMap?.contextLabels || [])
                .filter(item => {
                    const c = [item.longitude, item.latitude];
                    return isVisible(c);
                })
                .map(item => {
                    const p = projection([item.longitude, item.latitude]);
                    return p ? { name: item.name, x: p[0], y: p[1] } : null;
                })
                .filter(Boolean)
            : [];

        const reservedBoxes = [
            { x0: 6, y0: height - (width < 480 ? 116 : 132), x1: width < 480 ? 114 : 148, y1: height - 6 }, // bottom-left levels overlay
        ];

        const solvedLabels = solveActorMapLabels({
            width,
            height,
            markers: collisionTargets,
            floatingBadges: floatingSlots,
            actorLabels,
            linkLabels: linkLabelRequests,
            countryLabels: countryLabelRequests,
            arcPoints,
            reservedBoxes,
            padding: 8,
        });

        return {
            width,
            height,
            hasFloating,
            pathGen,
            graticule,
            sphereDisc,
            blocSet,
            activeCountries,
            floatingSlots,
            markers,
            clusterMarkers,
            extraPlaces,
            linkItems,
            solvedLabels,
        };
    }, [step, box, view, floatingActors, actorMap, actorById, connById, mapLocations, selected, stepClusters, actorToCluster]);

    const countryPaths = useMemo(() => {
        if (!countries || !scene) return [];
        const items = [];
        for (const feat of countries) {
            const name = feat.properties?.name;
            const d = scene.pathGen(feat);
            if (!d) continue;
            const isFocus = name === actorMap.focusCountry;
            const isBloc = !isFocus && scene.blocSet.has(name);
            const isArea = !isFocus && !isBloc && scene.activeCountries.has(name);
            items.push({
                key: feat.id ?? name,
                d,
                cls: `flat-country${isFocus ? ' is-focus' : ''}${isBloc ? ' is-bloc' : ''}${isArea ? ' is-area' : ''}`,
            });
        }
        return items;
    }, [countries, scene, actorMap?.focusCountry]);

    if (!actorMap || !step || !scene) return null;

    const glowId = `flat-glow-${uid}`;
    const onActivateKey = (e, fn) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fn();
        }
    };

    return (
        <div ref={wrapRef} className="actor-map-canvas actor-map-canvas--flat">
            <svg
                className="actor-flat-svg"
                viewBox={`0 0 ${scene.width} ${scene.height}`}
                role="img"
                aria-label={`Interactive flat actor map for ${step.key === 'all' ? 'All steps' : `Step ${step.key}`}: ${actorMap.focusCountry}. Use the Connections list below or tab through markers to inspect sources.`}
            >
                <defs>
                    <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
                        <stop offset="80%" stopColor="rgba(103,213,245,0)" />
                        <stop offset="100%" stopColor="rgba(103,213,245,0.22)" />
                    </radialGradient>
                    {['conflict', 'pressure', 'support', 'movement'].map(type => (
                        <marker
                            key={type}
                            id={`flat-arr-${uid}-${type}`}
                            viewBox="0 0 10 10"
                            refX="8.5"
                            refY="5"
                            markerWidth="8"
                            markerHeight="8"
                            orient="auto-start-reverse"
                            markerUnits="userSpaceOnUse"
                        >
                            <path d="M0,1.2 L9,5 L0,8.8 z" fill={TYPE_COLORS[type]} />
                        </marker>
                    ))}
                </defs>

                <path d={scene.sphereDisc} className="flat-sphere" />
                <path d={scene.graticule} className="flat-graticule" />
                <g>
                    {countryPaths.map(item => (
                        <path key={item.key} d={item.d} className={item.cls} />
                    ))}
                </g>
                <path d={scene.sphereDisc} fill={`url(#${glowId})`} pointerEvents="none" />
                <path d={scene.sphereDisc} className="flat-rim" />

                <g>
                    {Array.from(scene.solvedLabels.countries.entries()).map(([name, pos]) => (
                        pos.visible ? (
                            <text key={name} x={pos.x} y={pos.y} className="flat-country-label">
                                {name}
                            </text>
                        ) : null
                    ))}
                </g>

                <g>
                    {scene.linkItems.map(item => {
                        const placed = scene.solvedLabels.links.get(item.conn.id);
                        return (
                            <g
                                key={item.conn.id}
                                role="button"
                                tabIndex={0}
                                aria-label={`${item.conn.type}: ${item.conn.label}`}
                                aria-pressed={item.isSelected}
                                className={`flat-link type-${item.conn.type}${item.isSelected ? ' is-sel' : ''}${!item.isRelated ? ' is-dim' : ''}${reducedMotion ? ' no-anim' : ''}`}
                                style={{ '--c': TYPE_COLORS[item.conn.type] }}
                                onClick={() => onSelect?.('connection', item.conn.id)}
                                onKeyDown={e => onActivateKey(e, () => onSelect?.('connection', item.conn.id))}
                            >
                                <path d={item.d} className="flat-link-hit" />
                                <path
                                    d={item.d}
                                    className="flat-link-line"
                                    markerEnd={`url(#flat-arr-${uid}-${item.conn.type})`}
                                />
                                {placed?.visible && placed.candidate && (
                                    <text x={placed.candidate.x} y={placed.candidate.y} className="flat-link-label">
                                        {item.conn.label}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </g>

                <g>
                    {scene.extraPlaces.map(({ loc, x, y, isSelected }) => {
                        const placed = scene.solvedLabels.actors.get(`place:${loc.label}`);
                        return (
                            <g
                                key={`place-${loc.label}`}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${x},${y})`}
                                aria-label={`Mapped place: ${loc.label}`}
                                aria-pressed={isSelected}
                                className={`flat-place-pin${isSelected ? ' is-sel' : ''}`}
                                onClick={() => onSelect?.('place', loc.label)}
                                onKeyDown={e => onActivateKey(e, () => onSelect?.('place', loc.label))}
                            >
                                <circle r="11" fill="transparent" />
                                <rect x="-3.5" y="-3.5" width="7" height="7" transform="rotate(45)" className="flat-place-diamond" />
                                {placed?.visible && renderFlatPositionedText(5.5, placed, loc.label, '', 'flat-place-label')}
                            </g>
                        );
                    })}
                </g>

                <g>
                    {scene.markers.map(m => {
                        const placed = scene.solvedLabels.actors.get(m.actor.id);
                        const color = LEVEL_COLORS[m.actor.level] || '#67d5f5';
                        return (
                            <g
                                key={m.actor.id}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${m.x},${m.y})`}
                                aria-label={`${m.actor.name}, ${m.actor.level} level`}
                                aria-pressed={m.isSelected}
                                className={`flat-node level-${m.actor.level}${m.isSelected ? ' is-sel' : ''}${!m.isRelated ? ' is-dim' : ''}`}
                                style={{ '--c': color }}
                                onClick={() => onSelect?.('actor', m.actor.id)}
                                onKeyDown={e => onActivateKey(e, () => onSelect?.('actor', m.actor.id))}
                            >
                                <circle r={Math.max(14, m.r + 6)} fill="transparent" />
                                {!step.quietLabels && !reducedMotion && <circle r={m.r} className="flat-node-pulse" />}
                                {!step.quietLabels && <circle r={m.r + 4} className="flat-node-halo" />}
                                <circle r={m.r} className="flat-node-core" />
                                {placed?.visible && renderFlatActorLabel(m, placed)}
                            </g>
                        );
                    })}
                </g>

                <g>
                    {scene.clusterMarkers.map(m => {
                        const placed = scene.solvedLabels.actors.get(m.cluster.id);
                        const namesSummary = m.members.map(member => member.name).join(', ');
                        return (
                            <g
                                key={m.cluster.id}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${m.x},${m.y})`}
                                aria-label={`${m.cluster.name}. Activate or hover to list ${m.members.length} actors`}
                                aria-pressed={m.isSelected}
                                className={`flat-node flat-node--cluster${m.isSelected ? ' is-sel' : ''}${!m.isRelated ? ' is-dim' : ''}`}
                                style={{ '--c': '#67d5f5' }}
                                onMouseEnter={() => openClusterPopover(m.cluster.id)}
                                onMouseLeave={scheduleCloseClusterPopover}
                                onFocus={() => openClusterPopover(m.cluster.id)}
                                onBlur={scheduleCloseClusterPopover}
                                onClick={() => onSelect?.('cluster', m.cluster.id)}
                                onKeyDown={e => onActivateKey(e, () => onSelect?.('cluster', m.cluster.id))}
                            >
                                <title>{`${m.cluster.name}: ${namesSummary}`}</title>
                                <circle r={Math.max(16, m.r + 6)} fill="transparent" />
                                {!step.quietLabels && !reducedMotion && <circle r={m.r} className="flat-node-pulse" />}
                                {!step.quietLabels && <circle r={m.r + 4} className="flat-node-halo" />}
                                <circle r={m.r} className="flat-node-core flat-cluster-core" />
                                <text y="4" className="flat-cluster-count">{m.members.length}</text>
                                {placed?.visible && renderFlatPositionedText(
                                    m.r,
                                    placed,
                                    m.cluster.name,
                                    placed.showNote ? (m.cluster.note || '') : '',
                                    'flat-node-name',
                                )}
                            </g>
                        );
                    })}
                </g>

                <g>
                    {scene.floatingSlots.map(slot => {
                        const isSel = selected?.kind === 'actor' && selected.id === slot.actor.id;
                        const isRel = isRelatedActorMapItem(selected, 'actor', slot.actor.id, step, connById);
                        return (
                            <g
                                key={slot.actor.id}
                                role="button"
                                tabIndex={0}
                                transform={`translate(${slot.cx},${slot.cy})`}
                                aria-label={`${slot.actor.name}, global level, no single place`}
                                aria-pressed={isSel}
                                className={`flat-node level-global flat-badge${isSel ? ' is-sel' : ''}${!isRel ? ' is-dim' : ''}`}
                                style={{ '--c': LEVEL_COLORS.global }}
                                onClick={() => onSelect?.('actor', slot.actor.id)}
                                onKeyDown={e => onActivateKey(e, () => onSelect?.('actor', slot.actor.id))}
                            >
                                <rect x={-slot.w / 2} y={-slot.h / 2} width={slot.w} height={slot.h} rx={slot.h / 2} className="flat-badge-rect" />
                                <text y="4" className="flat-badge-text">{slot.actor.name}</text>
                                <text y={slot.h / 2 + 12} className="flat-badge-cap">No single place</text>
                            </g>
                        );
                    })}
                </g>
            </svg>
            {(() => {
                const activeClusterMarker = hoveredClusterId
                    ? scene.clusterMarkers.find(m => m.cluster.id === hoveredClusterId)
                    : null;
                if (!activeClusterMarker) return null;
                const popLeft = Math.max(8, Math.min(scene.width - 246, activeClusterMarker.x + 14));
                const popTop = Math.max(8, Math.min(scene.height - 240, activeClusterMarker.y - 36));
                return (
                    <div
                        className="flat-cluster-popover"
                        role="region"
                        aria-label={activeClusterMarker.cluster.name}
                        style={{ left: `${popLeft}px`, top: `${popTop}px` }}
                        onMouseEnter={() => openClusterPopover(activeClusterMarker.cluster.id)}
                        onMouseLeave={scheduleCloseClusterPopover}
                    >
                        <div className="actor-cluster-popover-title">{activeClusterMarker.cluster.name}</div>
                        <ul className="actor-cluster-popover-list">
                            {activeClusterMarker.members.map(member => (
                                <li key={member.id}>
                                    <button
                                        type="button"
                                        className="actor-cluster-popover-item"
                                        style={{ '--c': LEVEL_COLORS[member.level] || '#67d5f5' }}
                                        onClick={() => onSelect?.('actor', member.id)}
                                    >
                                        <i aria-hidden="true" />
                                        <span>
                                            <b>{member.name}</b>
                                            <small>
                                                {member.location.kind === 'pin'
                                                    ? member.location.place
                                                    : member.location.label}
                                            </small>
                                        </span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                );
            })()}
        </div>
    );
}

function renderFlatPositionedText(r, placed, title, noteText = '', titleClass = 'flat-node-name') {
    const off = r + 8;
    let x = 0;
    let y = 0;
    let anchor = 'middle';

    if (placed.side === 'r') { x = off; y = -2; anchor = 'start'; }
    else if (placed.side === 'l') { x = -off; y = -2; anchor = 'end'; }
    else if (placed.side === 't') { x = 0; y = -off - (noteText ? 14 : 2); anchor = 'middle'; }
    else if (placed.side === 'b') { x = 0; y = off + 10; anchor = 'middle'; }
    else if (placed.side === 'tr') { x = off * 0.85; y = -off * 0.7; anchor = 'start'; }
    else if (placed.side === 'tl') { x = -off * 0.85; y = -off * 0.7; anchor = 'end'; }
    else if (placed.side === 'br') { x = off * 0.85; y = off * 0.85; anchor = 'start'; }
    else { x = -off * 0.85; y = off * 0.85; anchor = 'end'; }

    return (
        <g pointerEvents="none">
            <text x={x} y={y} textAnchor={anchor} className={titleClass}>{title}</text>
            {noteText && <text x={x} y={y + 12} textAnchor={anchor} className="flat-node-sub">{noteText}</text>}
        </g>
    );
}

function renderFlatActorLabel(m, placed) {
    const noteText = placed.showNote
        ? (m.entry.note || (m.actor.location.kind === 'pin' ? m.actor.location.place : m.actor.location.label))
        : '';
    return renderFlatPositionedText(m.r, placed, m.actor.name, noteText, 'flat-node-name');
}

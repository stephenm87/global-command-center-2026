import { useEffect, useMemo, useRef, useState } from 'react';
import Globe from 'globe.gl';
import * as topojson from 'topojson-client';
import {
    FLIGHT_DURATION_MS,
    GLOBE_RADIUS,
    computeArcProfile,
    computeCameraPose,
    computeFloatingBadgeScreenSlots,
    fitCameraToActors,
    interpolateCamera,
    latLngAltToVec3,
    projectPointWithPose,
    unprojectScreenToGlobeSpace,
} from './actorMapCamera.mjs';
import {
    CLUSTER_DOT_RADIUS,
    buildStepClusterIndex,
    isRelatedActorMapItem,
    isStepConnectionVisible,
    resolveMarkerCollisions,
    solveActorMapLabels,
} from './actorMapLayout.mjs';
import { preferWebpUrl } from './actorMapMode.mjs';

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
    movement: '#e6f2f7',
};

const hexToRgb = hex => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(',');

let world50Promise = null;
function loadWorld50() {
    if (!world50Promise) {
        world50Promise = fetch('/assets/actor-map/countries-50m.json')
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(world => topojson.feature(world, world.objects.countries).features)
            .catch(err => {
                world50Promise = null;
                throw err;
            });
    }
    return world50Promise;
}

let webpSupportPromise = null;
function supportsWebp() {
    if (webpSupportPromise) return webpSupportPromise;
    if (typeof Image === 'undefined') {
        webpSupportPromise = Promise.resolve(false);
        return webpSupportPromise;
    }
    webpSupportPromise = new Promise(resolve => {
        const probe = new Image();
        probe.onload = () => resolve(probe.width > 0 && probe.height > 0);
        probe.onerror = () => resolve(false);
        probe.src = 'data:image/webp;base64,UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==';
    });
    return webpSupportPromise;
}

const imageCache = new Map();
function loadSingleStaticImage(url) {
    if (!imageCache.has(url)) {
        imageCache.set(url, new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.decoding = 'async';
            img.onload = () => {
                if (typeof img.decode === 'function') {
                    img.decode().then(() => resolve({ img, url })).catch(() => resolve({ img, url }));
                } else {
                    resolve({ img, url });
                }
            };
            img.onerror = () => {
                imageCache.delete(url);
                reject(new Error(`Failed to load ${url}`));
            };
            img.src = url;
        }));
    }
    return imageCache.get(url);
}

async function loadStaticImageWithFallback(url) {
    const useWebp = await supportsWebp();
    const preferred = useWebp ? preferWebpUrl(url) : url;
    if (preferred === url) {
        return loadSingleStaticImage(url);
    }
    return loadSingleStaticImage(preferred).catch(() => loadSingleStaticImage(url));
}

function actorCoord(actor) {
    if (!actor?.location) return null;
    if (actor.location.kind === 'pin') {
        return { lat: actor.location.latitude, lng: actor.location.longitude };
    }
    if (actor.location.kind === 'area' && actor.location.anchor) {
        return { lat: actor.location.anchor.latitude, lng: actor.location.anchor.longitude };
    }
    return null;
}

function addCurvedPatch(globe, img, bounds, alt, order) {
    let baseMesh = null;
    globe.scene().traverse(obj => {
        if (!baseMesh && obj.type === 'Mesh' && obj.geometry?.type === 'SphereGeometry' && obj.material?.map) {
            baseMesh = obj;
        }
    });
    if (!baseMesh) return null;

    const MeshCtor = baseMesh.constructor;
    const BufferGeomCtor = Object.getPrototypeOf(baseMesh.geometry.constructor);
    const AttrCtor = baseMesh.geometry.attributes.position.constructor;
    const MaterialCtor = baseMesh.material.constructor;
    const TextureCtor = baseMesh.material.map.constructor;

    const [lng0, lat0, lng1, lat1] = bounds;
    const nx = 48;
    const ny = 64;
    const pos = [];
    const uv = [];
    const nor = [];
    const idx = [];

    for (let j = 0; j <= ny; j += 1) {
        const v = j / ny;
        const lat = lat1 - v * (lat1 - lat0);
        for (let i = 0; i <= nx; i += 1) {
            const u = i / nx;
            const lng = lng0 + u * (lng1 - lng0);
            const c = globe.getCoords(lat, lng, alt);
            const len = Math.hypot(c.x, c.y, c.z) || 1;
            pos.push(c.x, c.y, c.z);
            nor.push(c.x / len, c.y / len, c.z / len);
            uv.push(u, 1 - v);
        }
    }
    for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
            const a = j * (nx + 1) + i;
            const b = a + 1;
            const c = a + nx + 1;
            const d = c + 1;
            idx.push(a, c, b, b, c, d);
        }
    }

    const geometry = new BufferGeomCtor();
    geometry.setAttribute('position', new AttrCtor(pos, 3));
    geometry.setAttribute('normal', new AttrCtor(nor, 3));
    geometry.setAttribute('uv', new AttrCtor(uv, 2));
    geometry.setIndex(idx);

    const texture = new TextureCtor(img);
    texture.colorSpace = baseMesh.material.map.colorSpace;
    const maxAniso = globe.renderer()?.capabilities?.getMaxAnisotropy?.() || 1;
    texture.anisotropy = maxAniso;
    texture.needsUpdate = true;

    baseMesh.renderOrder = -20;

    const material = new MaterialCtor({ map: texture });
    material.side = 2;
    material.transparent = true;
    material.depthWrite = false;
    material.polygonOffset = true;
    material.polygonOffsetFactor = -order;
    material.polygonOffsetUnits = -2 * order;
    material.onBeforeCompile = shader => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
             float patchEdgeX = smoothstep(0.0, 0.08, vMapUv.x) * smoothstep(1.0, 0.92, vMapUv.x);
             float patchEdgeY = smoothstep(0.0, 0.08, vMapUv.y) * smoothstep(1.0, 0.92, vMapUv.y);
             diffuseColor.a *= patchEdgeX * patchEdgeY;`,
        );
    };

    const mesh = new MeshCtor(geometry, material);
    mesh.renderOrder = -20 + order;
    globe.scene().add(mesh);
    return { mesh, geometry, material, texture };
}

export default function CaseActorMap3D({
    actorMap,
    mapLocations = [],
    activeStepKey = '1',
    selected = null,
    onSelect,
    reducedMotion = false,
    onReady,
    onFatalError,
}) {
    const hostRef = useRef(null);
    const globeRef = useRef(null);
    const countriesRef = useRef([]);
    const patchHandlesRef = useRef([]);
    const animRafRef = useRef(0);
    const swayRef = useRef({ h: 0, t: 0 });
    const swayTargetRef = useRef({ h: 0, t: 0 });
    const tweenRef = useRef(null);
    const htmlItemsRef = useRef([]);
    const activeHtmlCacheRef = useRef(new Map());
    const lastPolygonKeyRef = useRef('');
    const onSelectRef = useRef(onSelect);
    onSelectRef.current = onSelect;
    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;
    const onFatalRef = useRef(onFatalError);
    onFatalRef.current = onFatalError;

    const [ready, setReady] = useState(false);
    const [settled, setSettled] = useState(false);
    const [renderedStepKey, setRenderedStepKey] = useState('');

    const actorById = useMemo(
        () => new Map((actorMap?.actors || []).map(a => [a.id, a])),
        [actorMap],
    );
    const connById = useMemo(
        () => new Map((actorMap?.connections || []).map(c => [c.id, c])),
        [actorMap],
    );
    const step = useMemo(
        () => actorMap?.steps?.find(s => String(s.key) === String(activeStepKey)) || actorMap?.steps?.[0],
        [actorMap, activeStepKey],
    );

    const latestSceneInputRef = useRef({ actorMap, actorById, connById, step, mapLocations, selected, reducedMotion });
    latestSceneInputRef.current = { actorMap, actorById, connById, step, mapLocations, selected, reducedMotion };

    const camRef = useRef({
        lat: actorMap?.steps?.[0]?.cam?.lat ?? 18,
        lng: actorMap?.steps?.[0]?.cam?.lng ?? 96,
        dist: actorMap?.steps?.[0]?.cam?.dist ?? 0.5,
        tilt: actorMap?.steps?.[0]?.cam?.tilt ?? 40,
    });

    const buildAndApplySceneRef = useRef(() => {});

    // Initialize globe once per pilot case (terrainPatches + countries-50m.json)
    useEffect(() => {
        const container = hostRef.current;
        if (!container) return undefined;
        let cancelled = false;
        let globe = null;
        let resizeObserver = null;
        let visibilityObserver = null;
        let resizeRaf = 0;
        let readyTimeoutId = 0;
        let isInView = true;
        let isTabVisible = typeof document === 'undefined' ? true : !document.hidden;
        let paused = false;
        const readyRef = { current: false };
        const lastSize = { w: 0, h: 0 };

        const disposePatches = () => {
            for (const h of patchHandlesRef.current) {
                try {
                    globe?.scene?.()?.remove(h.mesh);
                    h.geometry?.dispose?.();
                    h.material?.dispose?.();
                    h.texture?.dispose?.();
                } catch {
                    // ignore cleanup errors
                }
            }
            patchHandlesRef.current = [];
        };

        let onVisibilityChange = null;
        let onPointerMove = null;
        let onPointerLeave = null;

        const placeCameraLoop = now => {
            if (cancelled || paused || !globe) return;
            const { reducedMotion: red } = latestSceneInputRef.current;
            const curTween = tweenRef.current;
            if (curTween) {
                const k = Math.min(1, (now - curTween.t0) / curTween.dur);
                camRef.current = interpolateCamera(curTween.a, curTween.b, k);
                if (k >= 1) {
                    tweenRef.current = null;
                    try {
                        buildAndApplySceneRef.current(false);
                    } catch (err) {
                        cancelled = true;
                        onFatalRef.current?.(err);
                        return;
                    }
                    setSettled(true);
                }
            }
            const sway = swayRef.current;
            const target = swayTargetRef.current;
            sway.h += (target.h - sway.h) * 0.08;
            sway.t += (target.t - sway.t) * 0.08;

            const drift = red || tweenRef.current ? 0 : Math.sin(now / 5200) * 1.4;
            const pose = computeCameraPose(camRef.current, sway, drift, GLOBE_RADIUS);
            const camera = globe.camera();
            camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
            camera.up.set(pose.up[0], pose.up[1], pose.up[2]);
            camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);

            // Clamp floating badge DOM positions mathematically using projection (zero 60fps reflow)
            if (Math.abs(sway.h) > 0.05 || Math.abs(sway.t) > 0.05) {
                const cw = container.clientWidth || 640;
                const ch = container.clientHeight || 480;
                const fov = globe.camera?.()?.fov || 50;
                for (const item of htmlItemsRef.current) {
                    if (item.kind !== 'badge' || !item.el || !item.slot) continue;
                    const proj = projectPointWithPose(
                        latLngAltToVec3(item.at[1], item.at[0], item.alt, GLOBE_RADIUS),
                        pose,
                        cw,
                        ch,
                        fov,
                    );
                    const halfW = item.slot.w / 2;
                    let shiftX = 0;
                    if (proj.x - halfW < 8) shiftX = 8 + halfW - proj.x;
                    else if (proj.x + halfW > cw - 8) shiftX = (cw - 8 - halfW) - proj.x;
                    let shiftY = 0;
                    if (proj.y - 18 < 8) shiftY = 26 - proj.y;
                    else if (proj.y + 30 > ch * 0.48) shiftY = ch * 0.48 - 30 - proj.y;
                    item.el.style.transform = (shiftX || shiftY) ? `translate(${shiftX.toFixed(1)}px, ${shiftY.toFixed(1)}px)` : '';
                }
            }

            animRafRef.current = requestAnimationFrame(placeCameraLoop);
        };

        const syncPauseState = () => {
            const shouldPause = readyRef.current && (!isInView || !isTabVisible);
            if (shouldPause === paused) return;
            paused = shouldPause;
            if (paused) {
                cancelAnimationFrame(animRafRef.current);
                animRafRef.current = 0;
                globe?.pauseAnimation?.();
            } else if (!cancelled && globe) {
                globe.resumeAnimation?.();
                if (!animRafRef.current) {
                    animRafRef.current = requestAnimationFrame(placeCameraLoop);
                }
            }
        };

        const initGlobe = (baseImageUrl, features, initialPatchesLoaded, deferredPatches) => {
            if (cancelled || !container.isConnected) return;
            // Guard WebGL/TextureLoader readiness once base + regional assets finish downloading
            readyTimeoutId = setTimeout(() => {
                if (!cancelled && !readyRef.current) {
                    onFatalRef.current?.(new Error('3D terrain ready timeout'));
                }
            }, 15000);
            const handleGlobeReady = () => {
                if (cancelled) return;
                clearTimeout(readyTimeoutId);
                countriesRef.current = features;
                disposePatches();
                for (const { img, p } of initialPatchesLoaded) {
                    const handle = addCurvedPatch(globe, img, p.bounds, p.altitude, p.order);
                    if (handle) patchHandlesRef.current.push(handle);
                }
                readyRef.current = true;
                lastPolygonKeyRef.current = '';
                setReady(true);
                onReadyRef.current?.();
                buildAndApplySceneRef.current(true);
                syncPauseState();

                // Progressive local terrain enhancement after first 3D frame is visible
                for (const p of deferredPatches) {
                    loadStaticImageWithFallback(p.url)
                        .then(({ img }) => {
                            if (cancelled || !container.isConnected || globeRef.current !== globe) return;
                            const handle = addCurvedPatch(globe, img, p.bounds, p.altitude, p.order);
                            if (handle) patchHandlesRef.current.push(handle);
                        })
                        .catch(() => {
                            // Regional patch remains visible if local detail fetch fails
                        });
                }
            };

            try {
                globe = new Globe(container, { animateIn: false })
                    .backgroundColor('rgba(0,0,0,0)')
                    .onGlobeReady(handleGlobeReady)
                    .globeImageUrl(baseImageUrl)
                    .showAtmosphere(true)
                    .atmosphereColor('#67d5f5')
                    .atmosphereAltitude(0.15)
                    .enablePointerInteraction(false);
                globe.controls().enabled = false;
                globeRef.current = globe;

                const renderer = globe.renderer?.();
                if (renderer && typeof window !== 'undefined' && window.innerWidth < 768) {
                    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
                }
            } catch (err) {
                clearTimeout(readyTimeoutId);
                onFatalRef.current?.(err);
                return;
            }

            const updateSize = () => {
                if (!globe || !container.isConnected) return false;
                const w = Math.floor(container.clientWidth) || 640;
                const h = Math.floor(container.clientHeight) || 480;
                if (Math.abs(w - lastSize.w) < 2 && Math.abs(h - lastSize.h) < 2) return false;
                lastSize.w = w;
                lastSize.h = h;
                globe.width(w).height(h);
                return true;
            };
            updateSize();
            if (typeof ResizeObserver === 'function') {
                resizeObserver = new ResizeObserver(() => {
                    if (cancelled || resizeRaf) return;
                    resizeRaf = requestAnimationFrame(() => {
                        resizeRaf = 0;
                        if (cancelled || !globeRef.current) return;
                        const changed = updateSize();
                        if (changed && readyRef.current && !tweenRef.current) {
                            buildAndApplySceneRef.current(true);
                        }
                    });
                });
                resizeObserver.observe(container);
            }

            globe
                .polygonsData([])
                .polygonsTransitionDuration(0)
                .polygonCapCurvatureResolution(1.5)
                .pathsData([])
                .pathPoints('pts')
                .pathPointLat(p => p[1])
                .pathPointLng(p => p[0])
                .pathPointAlt(p => p[2])
                .pathColor(d => d.color)
                .pathStroke(d => d.stroke)
                .pathDashLength(d => d.dash)
                .pathDashGap(d => d.gap)
                .pathDashAnimateTime(d => d.anim)
                .pathTransitionDuration(0)
                .ringsData([])
                .ringLat(d => d.at[1])
                .ringLng(d => d.at[0])
                .ringAltitude(d => d.alt)
                .ringColor(d => t => `rgba(${d.rgb},${Math.max(0, 0.85 - t)})`)
                .ringMaxRadius(d => d.max)
                .ringPropagationSpeed(d => d.max * 0.9)
                .ringRepeatPeriod(d => d.period)
                .htmlElementsData([])
                .htmlLat(d => d.at[1])
                .htmlLng(d => d.at[0])
                .htmlAltitude(d => d.alt)
                .htmlElement(d => d.el)
                .htmlTransitionDuration(0);

            globe.htmlElementVisibilityModifier?.(() => {});

            if (typeof IntersectionObserver === 'function') {
                visibilityObserver = new IntersectionObserver(
                    entries => {
                        isInView = entries.some(entry => entry.isIntersecting);
                        syncPauseState();
                    },
                    { rootMargin: '80px', threshold: 0.01 },
                );
                visibilityObserver.observe(container);
            }
            onVisibilityChange = () => {
                isTabVisible = !document.hidden;
                syncPauseState();
            };
            if (typeof document !== 'undefined') {
                document.addEventListener('visibilitychange', onVisibilityChange);
            }

            if (!paused) {
                animRafRef.current = requestAnimationFrame(placeCameraLoop);
            }

            onPointerMove = e => {
                if (latestSceneInputRef.current.reducedMotion || e.pointerType === 'touch') return;
                const r = container.getBoundingClientRect();
                swayTargetRef.current = {
                    h: ((e.clientX - r.left) / Math.max(1, r.width) - 0.5) * 9,
                    t: ((e.clientY - r.top) / Math.max(1, r.height) - 0.5) * -5,
                };
            };
            onPointerLeave = () => { swayTargetRef.current = { h: 0, t: 0 }; };
            container.addEventListener('pointermove', onPointerMove);
            container.addEventListener('pointerleave', onPointerLeave);
        };

        const sortedPatches = [...(actorMap?.terrainPatches || [])].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0));
        const initialPatches = sortedPatches.filter(p => (Number(p.order) || 0) <= 1);
        const deferredPatches = sortedPatches.filter(p => (Number(p.order) || 0) > 1);

        Promise.all([
            loadStaticImageWithFallback('/assets/actor-map/blue-marble-base.jpg'),
            loadWorld50(),
            Promise.all(initialPatches.map(p => loadStaticImageWithFallback(p.url).then(({ img }) => ({ img, p })))),
        ])
            .then(([baseAsset, features, initialLoaded]) => initGlobe(baseAsset.url, features, initialLoaded, deferredPatches))
            .catch(err => {
                clearTimeout(readyTimeoutId);
                if (!cancelled && !readyRef.current) onFatalRef.current?.(err);
            });

        return () => {
            cancelled = true;
            clearTimeout(readyTimeoutId);
            cancelAnimationFrame(animRafRef.current);
            cancelAnimationFrame(resizeRaf);
            resizeObserver?.disconnect();
            visibilityObserver?.disconnect();
            if (typeof document !== 'undefined' && onVisibilityChange) {
                document.removeEventListener('visibilitychange', onVisibilityChange);
            }
            if (onPointerMove) container.removeEventListener('pointermove', onPointerMove);
            if (onPointerLeave) container.removeEventListener('pointerleave', onPointerLeave);
            activeHtmlCacheRef.current.clear();
            lastPolygonKeyRef.current = '';
            disposePatches();
            if (globe) {
                try {
                    const renderer = globe.renderer?.();
                    globe._destructor?.();
                    renderer?.forceContextLoss?.();
                    renderer?.dispose?.();
                    container.replaceChildren();
                } catch {
                    // ignore disposal noise
                }
            }
            if (globeRef.current === globe) globeRef.current = null;
        };
    }, [actorMap]);

    // Rebuild overlays/scene cleanly whenever step transitions settle or window resizes
    buildAndApplySceneRef.current = (snapCamera = false) => {
        const globe = globeRef.current;
        const container = hostRef.current;
        const features = countriesRef.current;
        if (!globe || !container || !features.length) return;

        const {
            actorMap: mapData,
            actorById: actorsMap,
            connById: connsMap,
            step: activeStep,
            mapLocations: legacyPlaces,
            selected: currentSel,
            reducedMotion: red,
        } = latestSceneInputRef.current;
        if (!mapData || !activeStep) return;

        const width = Math.floor(container.clientWidth) || 640;
        const height = Math.floor(container.clientHeight) || 480;
        const fovDeg = globe.camera?.()?.fov || 50;

        const stepActorEntries = activeStep.actors || [];
        const stepActorMap = new Map(stepActorEntries.map(e => [e.id, e]));
        const { clusters, actorToCluster } = buildStepClusterIndex(activeStep);
        const surfaceCoords = [
            ...stepActorEntries
                .filter(e => !actorToCluster.has(e.id))
                .map(e => actorCoord(actorsMap.get(e.id)))
                .filter(Boolean),
            ...clusters.map(cluster => [cluster.lng, cluster.lat]),
        ];
        const floatingActors = stepActorEntries
            .map(e => actorsMap.get(e.id))
            .filter(a => a?.location?.kind === 'noSinglePlace');

        const fittedTarget = fitCameraToActors(
            activeStep.cam,
            surfaceCoords,
            width,
            height,
            { fovDeg, hasFloatingBadges: floatingActors.length > 0 },
        );

        if (snapCamera) {
            camRef.current = fittedTarget;
            tweenRef.current = null;
        }

        const activeCam = tweenRef.current ? fittedTarget : camRef.current;
        const pose = computeCameraPose(activeCam, { h: 0, t: 0 }, 0, GLOBE_RADIUS);
        const visBase = pose.visBase;

        const blocSet = new Set(activeStep.bloc && mapData.bloc?.members ? mapData.bloc.members : []);
        const activeAreas = new Set();
        for (const e of stepActorEntries) {
            const a = actorsMap.get(e.id);
            if (a?.location?.kind === 'area' && Array.isArray(a.location.countries)) {
                a.location.countries.forEach(c => activeAreas.add(c));
            }
        }
        const scaleFactor = Math.min(1, activeCam.dist / 0.65);

        // Rule 4d.5: single-edge crisp outlines aligned with Blue Marble coastlines (upload only on polygon state changes)
        const polygonKey = `${mapData.focusCountry}|${activeStep.bloc ? '1' : '0'}|${[...activeAreas].sort().join(',')}|${scaleFactor.toFixed(3)}`;
        if (polygonKey !== lastPolygonKeyRef.current) {
            lastPolygonKeyRef.current = polygonKey;
            globe
                .polygonsData(features)
                .polygonCapColor(f => {
                    const name = f.properties?.name;
                    if (name === mapData.focusCountry) return 'rgba(103, 213, 245, 0.16)';
                    if (blocSet.has(name)) return 'rgba(183, 156, 255, 0.20)';
                    if (activeAreas.has(name)) return 'rgba(103, 213, 245, 0.12)';
                    return 'rgba(0, 0, 0, 0)';
                })
                .polygonSideColor(f => {
                    const name = f.properties?.name;
                    if (name === mapData.focusCountry) return 'rgba(103, 213, 245, 0.26)';
                    if (blocSet.has(name)) return 'rgba(183, 156, 255, 0.22)';
                    if (activeAreas.has(name)) return 'rgba(103, 213, 245, 0.16)';
                    return 'rgba(0, 0, 0, 0)';
                })
                .polygonStrokeColor(f => {
                    const name = f.properties?.name;
                    if (name === mapData.focusCountry) return 'rgba(165, 238, 255, 0.96)';
                    if (blocSet.has(name)) return 'rgba(205, 188, 255, 0.78)';
                    if (activeAreas.has(name)) return 'rgba(145, 225, 245, 0.72)';
                    return 'rgba(145, 210, 232, 0.30)';
                })
                .polygonAltitude(f => {
                    const name = f.properties?.name;
                    if (name === mapData.focusCountry) return 0.0007 + 0.0022 * scaleFactor;
                    if (blocSet.has(name)) return 0.0005 + 0.0016 * scaleFactor;
                    if (activeAreas.has(name)) return 0.0004 + 0.0010 * scaleFactor;
                    return 0.0002;
                });
        }

        // Floating badges pinned safely inside viewport upper band & projected into 3D space
        const floatingSlots = computeFloatingBadgeScreenSlots(floatingActors, width, height);
        const floatingGeoById = new Map();
        for (const slot of floatingSlots) {
            const geo = unprojectScreenToGlobeSpace(slot.cx, slot.cy, pose, width, height, fovDeg, GLOBE_RADIUS);
            floatingGeoById.set(slot.id, { ...geo, slot });
        }

        const nodePoint = id => {
            const cluster = actorToCluster.get(id);
            if (cluster) return { lat: cluster.lat, lng: cluster.lng, alt: visBase, isFloating: false };
            const floatItem = floatingGeoById.get(id);
            if (floatItem) return { lat: floatItem.lat, lng: floatItem.lng, alt: floatItem.alt, isFloating: true };
            const actor = actorsMap.get(id);
            const c = actorCoord(actor);
            return c ? { lat: c.lat, lng: c.lng, alt: visBase, isFloating: false } : null;
        };

        const rings = [];
        const markers = [];
        const actorLabelRequests = [];
        const items = [];

        for (const entry of stepActorEntries) {
            if (actorToCluster.has(entry.id)) continue;
            const actor = actorsMap.get(entry.id);
            const pt = nodePoint(entry.id);
            if (!actor || !pt) continue;

            if (pt.isFloating) {
                const slot = floatingGeoById.get(entry.id).slot;
                items.push({ kind: 'badge', id: actor.id, actor, at: [pt.lng, pt.lat], alt: pt.alt, slot });
                continue;
            }

            const vec = latLngAltToVec3(pt.lat, pt.lng, pt.alt, GLOBE_RADIUS);
            const proj = projectPointWithPose(vec, pose, width, height, fovDeg);
            const dotR = entry.small ? 5 : actor.level === 'regional' ? 10.5 : actor.level === 'state' ? 8.5 : 7;

            if (proj.visibleOnHorizon) {
                markers.push({ id: actor.id, x: proj.x, y: proj.y, r: dotR });
                const isSel = currentSel?.kind === 'actor' && currentSel.id === actor.id;
                actorLabelRequests.push({
                    id: actor.id,
                    name: actor.name,
                    note: entry.note || (actor.location.kind === 'pin' ? actor.location.place : actor.location.label),
                    x: proj.x,
                    y: proj.y,
                    r: dotR,
                    preferredSide: entry.preferredSide || 'r',
                    hidden: Boolean(entry.small && !isSel),
                    priority: isSel ? 200 : actor.level === 'regional' ? 96 : actor.level === 'state' ? 88 : 78,
                });
            }

            if (!activeStep.quietLabels && !entry.small) {
                rings.push({
                    at: [pt.lng, pt.lat],
                    alt: visBase * 0.85,
                    rgb: hexToRgb(LEVEL_COLORS[actor.level] || '#67d5f5'),
                    max: Math.max(0.14, Math.min(2.6, activeCam.dist * 2.1)) * (actor.level === 'local' ? 0.78 : 1.05),
                    period: 1700,
                });
            }

            items.push({ kind: 'actor', id: actor.id, actor, entry, at: [pt.lng, pt.lat], alt: pt.alt });
        }

        for (const cluster of clusters) {
            const members = (cluster.memberIds || []).map(id => actorsMap.get(id)).filter(Boolean);
            if (!members.length) continue;
            const vec = latLngAltToVec3(cluster.lat, cluster.lng, visBase, GLOBE_RADIUS);
            const proj = projectPointWithPose(vec, pose, width, height, fovDeg);
            const dotR = CLUSTER_DOT_RADIUS;
            const isSel = currentSel?.kind === 'cluster' && currentSel.id === cluster.id;
            if (proj.visibleOnHorizon) {
                markers.push({ id: cluster.id, x: proj.x, y: proj.y, r: dotR });
                actorLabelRequests.push({
                    id: cluster.id,
                    name: cluster.name,
                    note: cluster.note || `${members.length} actors`,
                    x: proj.x,
                    y: proj.y,
                    r: dotR,
                    preferredSide: cluster.preferredSide || 'b',
                    priority: isSel ? 200 : 94,
                });
            }
            if (!activeStep.quietLabels) {
                rings.push({
                    at: [cluster.lng, cluster.lat],
                    alt: visBase * 0.85,
                    rgb: hexToRgb('#67d5f5'),
                    max: Math.max(0.16, Math.min(2.6, activeCam.dist * 2.1)),
                    period: 1700,
                });
            }
            items.push({
                kind: 'cluster',
                id: cluster.id,
                cluster,
                members,
                at: [cluster.lng, cluster.lat],
                alt: visBase,
            });
        }

        // Legacy place pins (e.g., Berbera) not already shown as step actors
        const extraPlaces = [];
        for (const loc of legacyPlaces || []) {
            if (!Number.isFinite(Number(loc.latitude)) || !Number.isFinite(Number(loc.longitude))) continue;
            const lat = Number(loc.latitude);
            const lng = Number(loc.longitude);
            const matchedActor = stepActorEntries.some(e => {
                const c = actorCoord(actorsMap.get(e.id));
                return c && Math.hypot(c.lat - lat, c.lng - lng) < 0.08;
            });
            if (matchedActor) continue;
            const proj = projectPointWithPose(latLngAltToVec3(lat, lng, visBase, GLOBE_RADIUS), pose, width, height, fovDeg);
            if (!proj.visibleOnHorizon || proj.x < 12 || proj.x > width - 12 || proj.y < 12 || proj.y > height - 12) continue;
            extraPlaces.push({ loc, lat, lng, proj });
            markers.push({ id: `place:${loc.label}`, x: proj.x, y: proj.y, r: 5.5 });
            actorLabelRequests.push({
                id: `place:${loc.label}`,
                name: loc.label,
                note: '',
                x: proj.x,
                y: proj.y,
                r: 5.5,
                preferredSide: 'r',
                hidden: Boolean(activeStep.quietLabels && !(currentSel?.kind === 'place' && currentSel.id === loc.label)),
                priority: currentSel?.kind === 'place' && currentSel.id === loc.label ? 190 : 52,
            });
        }

        const resolvedMarkerPos = resolveMarkerCollisions(markers, { width, height, padding: 10, minGap: 2 });
        for (const m of markers) {
            const adj = resolvedMarkerPos.get(m.id);
            if (adj) {
                m.x = adj.x;
                m.y = adj.y;
            }
        }
        for (const req of actorLabelRequests) {
            const adj = resolvedMarkerPos.get(req.id);
            if (adj) {
                req.x = adj.x;
                req.y = adj.y;
            }
        }

        // Connections & path shadows (Rules 4d.3 & 4d.4)
        const paths = [];
        const linkLabelRequests = [];
        const linkMidPoints = new Map();
        const arcPoints = [];

        for (const cid of activeStep.connections || []) {
            const conn = connsMap.get(cid);
            if (!conn || !isStepConnectionVisible(conn, actorToCluster)) continue;
            const pFrom = nodePoint(conn.from);
            const pTo = nodePoint(conn.to);
            if (!pFrom || !pTo) continue;

            const profile = computeArcProfile(
                [pFrom.lng, pFrom.lat],
                [pTo.lng, pTo.lat],
                {
                    camDist: activeCam.dist,
                    visBase,
                    side: conn.side || 0,
                    isDrop: pFrom.isFloating,
                    noShadow: Boolean(conn.noShadow),
                    fromAlt: pFrom.alt,
                    toAlt: pTo.alt,
                    type: conn.type,
                },
            );

            const arcScreenPts = [];
            for (let si = 2; si <= profile.pts.length - 3; si += Math.max(2, Math.floor(profile.pts.length / 12))) {
                const ptSample = profile.pts[si];
                const projSample = projectPointWithPose(
                    latLngAltToVec3(ptSample[1], ptSample[0], ptSample[2], GLOBE_RADIUS),
                    pose,
                    width,
                    height,
                    fovDeg,
                );
                if (projSample.visibleOnHorizon) {
                    arcScreenPts.push({ x: projSample.x, y: projSample.y });
                }
            }
            arcPoints.push({ id: conn.id, points: arcScreenPts });

            if (profile.castShadow && profile.shadowPts) {
                paths.push({
                    id: `${conn.id}-shadow`,
                    shadow: true,
                    pts: profile.shadowPts,
                    color: 'rgba(0, 0, 0, 0.52)',
                    stroke: 3.1,
                    dash: 1,
                    gap: 0,
                    anim: 0,
                });
            }

            paths.push({
                id: conn.id,
                pts: profile.pts,
                color: TYPE_COLORS[conn.type] || '#67d5f5',
                stroke: 3.2,
                dash: red ? 1 : profile.dash,
                gap: red ? 0 : profile.gap,
                anim: red ? 0 : profile.anim,
            });

            if (conn.type === 'conflict' && !activeStep.quietLabels) {
                rings.push({
                    at: [pTo.lng, pTo.lat],
                    alt: visBase * 0.85,
                    rgb: hexToRgb(TYPE_COLORS.conflict),
                    max: Math.max(0.18, Math.min(3.0, activeCam.dist * 2.5)),
                    period: 950,
                });
            }

            const candidateFractions = [0.5, 0.4, 0.6, 0.34, 0.66, 0.26, 0.74];
            const candidates = [];
            for (const frac of candidateFractions) {
                const pt = profile.pts[Math.round((profile.pts.length - 1) * frac)];
                const proj = projectPointWithPose(latLngAltToVec3(pt[1], pt[0], pt[2], GLOBE_RADIUS), pose, width, height, fovDeg);
                if (proj.visibleOnHorizon) {
                    candidates.push({ x: proj.x, y: proj.y, frac, coord: pt, dx: 0, dy: 0 });
                }
            }
            const midPt = profile.pts[Math.round((profile.pts.length - 1) * 0.5)];
            const midProj = projectPointWithPose(latLngAltToVec3(midPt[1], midPt[0], midPt[2], GLOBE_RADIUS), pose, width, height, fovDeg);
            const fromProj = projectPointWithPose(latLngAltToVec3(pFrom.lat, pFrom.lng, pFrom.alt, GLOBE_RADIUS), pose, width, height, fovDeg);
            const toProj = projectPointWithPose(latLngAltToVec3(pTo.lat, pTo.lng, pTo.alt, GLOBE_RADIUS), pose, width, height, fovDeg);
            if (midProj.visibleOnHorizon && fromProj.visibleOnHorizon && toProj.visibleOnHorizon) {
                const chordMidX = (fromProj.x + toProj.x) / 2;
                const chordMidY = (fromProj.y + toProj.y) / 2;
                let nx = midProj.x - chordMidX;
                let ny = midProj.y - chordMidY;
                const nLen = Math.hypot(nx, ny);
                if (nLen < 1) {
                    const cdx = toProj.x - fromProj.x;
                    const cdy = toProj.y - fromProj.y;
                    const cl = Math.hypot(cdx, cdy) || 1;
                    nx = -cdy / cl;
                    ny = cdx / cl;
                } else {
                    nx /= nLen;
                    ny /= nLen;
                }
                const halfLabelW = Math.ceil((String(conn.label || '').length * 6.6 + 16) / 2) + 8;
                for (const dir of [1, -1]) {
                    const shiftX = Math.abs(nx) > 0.35 ? Math.sign(nx * dir) * halfLabelW : nx * dir * 24;
                    const shiftY = ny * dir * 18;
                    candidates.push({
                        x: midProj.x + shiftX,
                        y: midProj.y + shiftY,
                        frac: 0.5,
                        coord: midPt,
                        dx: shiftX,
                        dy: shiftY,
                    });
                }
            }
            const isSel = currentSel?.kind === 'connection' && currentSel.id === conn.id;
            linkMidPoints.set(conn.id, conn);
            linkLabelRequests.push({
                id: conn.id,
                label: conn.label,
                priority: isSel ? 180 : conn.type === 'pressure' ? 68 : 60,
                hidden: Boolean(activeStep.quietLabels && !isSel),
                candidates,
            });
        }

        // Faint country context labels when zoomed in
        const countryRequests = activeCam.dist < 0.88
            ? (mapData.contextLabels || [])
                .filter(c => !stepActorMap.has(c.name.toLowerCase()))
                .map(c => {
                    const proj = projectPointWithPose(latLngAltToVec3(c.latitude, c.longitude, 0.0005, GLOBE_RADIUS), pose, width, height, fovDeg);
                    return proj.visibleOnHorizon ? { ...c, x: proj.x, y: proj.y } : null;
                })
                .filter(Boolean)
            : [];

        const reservedBoxes = [
            { x0: 6, y0: height - 132, x1: 148, y1: height - 6 }, // Levels in view HUD
            { x0: width - 250, y0: height - 40, x1: width - 6, y1: height - 6 }, // Desktop hint pill
        ];
        if (floatingSlots.length > 0) {
            reservedBoxes.push({ x0: 8, y0: 4, x1: Math.min(width - 8, 250), y1: 22 });
        }

        const solved = solveActorMapLabels({
            width,
            height,
            markers,
            floatingBadges: floatingSlots,
            actorLabels: actorLabelRequests,
            linkLabels: linkLabelRequests,
            countryLabels: countryRequests,
            arcPoints,
            reservedBoxes,
            padding: 8,
        });

        // Reuse active DOM buttons across selection updates so keyboard/screen-reader focus never drops
        const activeEl = typeof document !== 'undefined' ? document.activeElement : null;
        const activeFocusKey = activeEl && container.contains(activeEl)
            ? activeEl.getAttribute('data-focus-key')
            : null;
        const prevCache = activeHtmlCacheRef.current;
        const nextCache = new Map();

        const acquireButtonDatum = (focusKey, kind, id, createExtras) => {
            let entry = prevCache.get(focusKey);
            if (!entry) {
                const wrap = document.createElement('div');
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.setAttribute('data-focus-key', focusKey);
                btn.addEventListener('click', () => entry._onClick?.());
                wrap.appendChild(btn);
                const extras = createExtras ? createExtras(wrap) : {};
                entry = {
                    datum: { kind, id, at: [0, 0], alt: 0, el: wrap, focusKey },
                    wrap,
                    btn,
                    ...extras,
                    _onClick: null,
                };
            }
            nextCache.set(focusKey, entry);
            return entry;
        };

        const syncPinLabel = (entry, placed, title, subText) => {
            if (!placed?.visible) {
                if (entry.lab) {
                    entry.lab.remove();
                    entry.lab = null;
                }
                return;
            }
            if (!entry.lab) {
                const lab = document.createElement('div');
                const b = document.createElement('b');
                lab.appendChild(b);
                entry.wrap.appendChild(lab);
                entry.lab = lab;
                entry.labB = b;
                entry.labSpan = null;
            }
            entry.lab.className = `lab ${placed.side} actor-label-box`;
            entry.labB.textContent = title;
            if (subText) {
                if (!entry.labSpan) {
                    entry.labSpan = document.createElement('span');
                    entry.lab.appendChild(entry.labSpan);
                }
                entry.labSpan.textContent = subText;
            } else if (entry.labSpan) {
                entry.labSpan.remove();
                entry.labSpan = null;
            }
        };

        const finalHtml = [];
        for (const it of items) {
            if (it.kind === 'badge') {
                const focusKey = `actor:${it.id}`;
                const isSel = currentSel?.kind === 'actor' && currentSel.id === it.id;
                const isRel = isRelatedActorMapItem(currentSel, 'actor', it.id, activeStep, connsMap);
                const entry = acquireButtonDatum(focusKey, 'badge', it.id, wrap => {
                    const cap = document.createElement('small');
                    cap.textContent = 'no single place';
                    wrap.appendChild(cap);
                    return { cap };
                });
                entry.wrap.className = `n3 global orbit${isSel ? ' sel' : ''}${!isRel ? ' dim' : ''}`;
                entry.wrap.style.marginLeft = '0px';
                entry.wrap.style.marginTop = '0px';
                entry.btn.className = 'actor-floating-btn';
                entry.btn.textContent = it.actor.name;
                entry.btn.setAttribute('aria-label', `${it.actor.name}, global level, no single place`);
                entry.btn.setAttribute('aria-pressed', String(isSel));
                entry._onClick = () => onSelectRef.current?.('actor', it.id);
                entry.datum.at = it.at;
                entry.datum.alt = it.alt;
                entry.datum.slot = it.slot;
                finalHtml.push(entry.datum);
                continue;
            }

            if (it.kind === 'cluster') {
                const focusKey = `cluster:${it.id}`;
                const placed = solved.actors.get(it.id);
                const adj = resolvedMarkerPos.get(it.id);
                const isSel = currentSel?.kind === 'cluster' && currentSel.id === it.id;
                const isRel = isRelatedActorMapItem(currentSel, 'cluster', it.id, activeStep, connsMap);
                const entry = acquireButtonDatum(focusKey, 'cluster', it.id, wrap => {
                    const countSpan = document.createElement('span');
                    countSpan.className = 'cluster-count';
                    const pop = document.createElement('div');
                    pop.className = 'actor-cluster-popover';
                    pop.setAttribute('role', 'region');
                    const popTitle = document.createElement('div');
                    popTitle.className = 'actor-cluster-popover-title';
                    const popList = document.createElement('ul');
                    popList.className = 'actor-cluster-popover-list';
                    pop.appendChild(popTitle);
                    pop.appendChild(popList);
                    wrap.appendChild(pop);
                    return { countSpan, pop, popTitle, popList };
                });
                entry.wrap.className = `n3 cluster${isSel ? ' sel' : ''}${!isRel ? ' dim' : ''}`;
                entry.wrap.style.marginLeft = `${(adj?.dx || 0).toFixed(1)}px`;
                entry.wrap.style.marginTop = `${(adj?.dy || 0).toFixed(1)}px`;
                entry.btn.className = 'actor-pin-btn actor-cluster-btn';
                if (!entry.btn.contains(entry.countSpan)) {
                    entry.btn.textContent = '';
                    entry.btn.appendChild(entry.countSpan);
                }
                entry.countSpan.textContent = String(it.members.length);
                entry.btn.setAttribute('aria-label', `${it.cluster.name}. Activate or hover to list ${it.members.length} actors`);
                entry.btn.setAttribute('aria-pressed', String(isSel));
                entry._onClick = () => onSelectRef.current?.('cluster', it.id);
                entry.pop.setAttribute('aria-label', it.cluster.name);
                entry.popTitle.textContent = it.cluster.name;
                entry.popList.replaceChildren(...it.members.map(member => {
                    const li = document.createElement('li');
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'actor-cluster-popover-item';
                    btn.style.setProperty('--c', LEVEL_COLORS[member.level] || '#67d5f5');
                    const dot = document.createElement('i');
                    dot.setAttribute('aria-hidden', 'true');
                    const copy = document.createElement('span');
                    const b = document.createElement('b');
                    b.textContent = member.name;
                    const sm = document.createElement('small');
                    sm.textContent = member.location.kind === 'pin' ? member.location.place : member.location.label;
                    copy.appendChild(b);
                    copy.appendChild(sm);
                    btn.appendChild(dot);
                    btn.appendChild(copy);
                    btn.addEventListener('click', e => {
                        e.stopPropagation();
                        onSelectRef.current?.('actor', member.id);
                    });
                    li.appendChild(btn);
                    return li;
                }));
                syncPinLabel(entry, placed, it.cluster.name, placed?.showNote ? (it.cluster.note || '') : '');
                entry.datum.at = it.at;
                entry.datum.alt = it.alt;
                finalHtml.push(entry.datum);
                continue;
            }

            const focusKey = `actor:${it.id}`;
            const placed = solved.actors.get(it.id);
            const adj = resolvedMarkerPos.get(it.id);
            const isSel = currentSel?.kind === 'actor' && currentSel.id === it.id;
            const isRel = isRelatedActorMapItem(currentSel, 'actor', it.id, activeStep, connsMap);
            const entry = acquireButtonDatum(focusKey, 'actor', it.id);
            entry.wrap.className = `n3 ${it.actor.level}${it.entry.small ? ' small' : ''}${isSel ? ' sel' : ''}${!isRel ? ' dim' : ''}`;
            entry.wrap.style.marginLeft = `${(adj?.dx || 0).toFixed(1)}px`;
            entry.wrap.style.marginTop = `${(adj?.dy || 0).toFixed(1)}px`;
            entry.btn.className = 'actor-pin-btn';
            entry.btn.setAttribute('aria-label', `${it.actor.name}, ${it.actor.level} level`);
            entry.btn.setAttribute('aria-pressed', String(isSel));
            entry._onClick = () => onSelectRef.current?.('actor', it.id);
            const subText = placed?.showNote
                ? (it.entry.note || (it.actor.location.kind === 'pin' ? it.actor.location.place : it.actor.location.label))
                : '';
            syncPinLabel(entry, placed, it.actor.name, subText);
            entry.datum.at = it.at;
            entry.datum.alt = it.alt;
            finalHtml.push(entry.datum);
        }

        for (const extra of extraPlaces) {
            const key = `place:${extra.loc.label}`;
            const placed = solved.actors.get(key);
            const adj = resolvedMarkerPos.get(key);
            const isSel = currentSel?.kind === 'place' && currentSel.id === extra.loc.label;
            const entry = acquireButtonDatum(key, 'place', extra.loc.label);
            entry.wrap.className = `n3 place-pin${isSel ? ' sel' : ''}${currentSel && !isSel ? ' dim' : ''}`;
            entry.wrap.style.marginLeft = `${(adj?.dx || 0).toFixed(1)}px`;
            entry.wrap.style.marginTop = `${(adj?.dy || 0).toFixed(1)}px`;
            entry.btn.className = '';
            entry.btn.setAttribute('aria-label', `Mapped place: ${extra.loc.label}`);
            entry.btn.setAttribute('aria-pressed', String(isSel));
            entry._onClick = () => onSelectRef.current?.('place', extra.loc.label);
            syncPinLabel(entry, placed, extra.loc.label, '');
            entry.datum.at = [extra.lng, extra.lat];
            entry.datum.alt = visBase;
            finalHtml.push(entry.datum);
        }

        for (const [cid, conn] of linkMidPoints.entries()) {
            const placed = solved.links.get(cid);
            if (!placed?.visible || !placed.candidate?.coord) continue;
            const focusKey = `link:${cid}`;
            const isSel = currentSel?.kind === 'connection' && currentSel.id === cid;
            const isRel = isRelatedActorMapItem(currentSel, 'connection', cid, activeStep, connsMap);
            const entry = acquireButtonDatum(focusKey, 'link', cid);
            entry.wrap.className = `l3wrap${!isRel ? ' dim' : ''}`;
            entry.wrap.style.marginLeft = `${(placed.candidate.dx || 0).toFixed(1)}px`;
            entry.wrap.style.marginTop = `${(placed.candidate.dy || 0).toFixed(1)}px`;
            entry.btn.className = `l3${isSel ? ' sel' : ''}`;
            entry.btn.style.setProperty('--c', TYPE_COLORS[conn.type] || '#67d5f5');
            entry.btn.textContent = conn.label;
            entry.btn.setAttribute('aria-label', `${conn.type}: ${conn.label}`);
            entry.btn.setAttribute('aria-pressed', String(isSel));
            entry._onClick = () => onSelectRef.current?.('connection', cid);
            const coord = placed.candidate.coord;
            entry.datum.at = [coord[0], coord[1]];
            entry.datum.alt = coord[2];
            finalHtml.push(entry.datum);
        }

        for (const c of countryRequests) {
            const placed = solved.countries.get(c.name);
            if (!placed?.visible) continue;
            const focusKey = `country:${c.name}`;
            let entry = prevCache.get(focusKey);
            if (!entry) {
                const d = document.createElement('div');
                d.className = 'cn3';
                d.textContent = c.name;
                entry = { datum: { kind: 'country', id: c.name, at: [0, 0], alt: 0.0005, el: d }, d };
            }
            nextCache.set(focusKey, entry);
            entry.datum.at = [c.longitude, c.latitude];
            entry.datum.alt = 0.0005;
            finalHtml.push(entry.datum);
        }

        activeHtmlCacheRef.current = nextCache;
        htmlItemsRef.current = finalHtml;
        globe
            .htmlElementsData(finalHtml)
            .pathsData(paths)
            .pathColor(d => (d.shadow ? d.color : isRelatedActorMapItem(currentSel, 'connection', d.id, activeStep, connsMap) ? d.color : 'rgba(120,140,150,0.24)'))
            .ringsData(red ? [] : rings);

        if (activeFocusKey) {
            const targetBtn = nextCache.get(activeFocusKey)?.btn;
            if (targetBtn) {
                if (targetBtn.isConnected && document.activeElement !== targetBtn) {
                    targetBtn.focus({ preventScroll: true });
                } else {
                    requestAnimationFrame(() => {
                        if (targetBtn.isConnected && document.activeElement !== targetBtn) {
                            targetBtn.focus({ preventScroll: true });
                        }
                    });
                }
            }
        }
        if (!tweenRef.current) {
            setRenderedStepKey(String(activeStep.key));
            setSettled(true);
        }
    };

    // Fly camera when activeStepKey changes
    useEffect(() => {
        if (!ready || !globeRef.current || !step) return;
        const container = hostRef.current;
        const width = Math.floor(container?.clientWidth || 640);
        const height = Math.floor(container?.clientHeight || 480);
        const fovDeg = globeRef.current.camera?.()?.fov || 50;
        const { clusters: flyClusters, actorToCluster: flyActorToCluster } = buildStepClusterIndex(step);
        const stepActorEntries = step.actors || [];
        const surfaceCoords = [
            ...stepActorEntries
                .filter(e => !flyActorToCluster.has(e.id))
                .map(e => actorCoord(actorById.get(e.id)))
                .filter(Boolean),
            ...flyClusters.map(c => [c.lng, c.lat]),
        ];
        const floatingActors = stepActorEntries.map(e => actorById.get(e.id)).filter(a => a?.location?.kind === 'noSinglePlace');
        const target = fitCameraToActors(step.cam, surfaceCoords, width, height, {
            fovDeg,
            hasFloatingBadges: floatingActors.length > 0,
        });

        const cur = camRef.current;
        const unchanged = Math.abs(cur.lat - target.lat) < 0.01
            && Math.abs(cur.lng - target.lng) < 0.01
            && Math.abs(cur.dist - target.dist) < 0.002;
        if (reducedMotion || unchanged) {
            camRef.current = target;
            tweenRef.current = null;
            buildAndApplySceneRef.current(true);
            setRenderedStepKey(String(step.key));
            setSettled(true);
            return;
        }
        setSettled(false);
        activeHtmlCacheRef.current.clear();
        globeRef.current.htmlElementsData([]);
        tweenRef.current = { a: { ...cur }, b: target, t0: performance.now(), dur: FLIGHT_DURATION_MS };
    }, [ready, step, actorById, reducedMotion]);

    // Update dimming/selection without re-flying camera (never reveal labels mid-flight)
    useEffect(() => {
        if (!ready || tweenRef.current) return;
        buildAndApplySceneRef.current(false);
    }, [ready, selected]);

    return (
        <div
            className={`actor-map-canvas actor-map-canvas--3d ${ready ? 'is-ready' : 'is-loading'}`}
            data-actor-map-step={renderedStepKey}
            data-actor-map-settled={ready && settled && renderedStepKey === String(activeStepKey) ? 'true' : 'false'}
        >
            <div ref={hostRef} className="actor-map-globe-mount" aria-label="Interactive 3D terrain actor map" />
        </div>
    );
}

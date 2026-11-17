import { useEffect, useState } from 'react';
import * as topojson from 'topojson-client';
import {
    categoryColors,
    THEORY_KEYWORDS,
    THEORY_COLORS,
    THEORY_LABELS,
    escHtml,
    clusterPoints,
    formatGlobePointTooltip,
} from '../navigationState.mjs';
import {
    caseColor,
    hexToRgba,
    buildCaseRings,
    buildCaseArcs,
    buildConflictCasePairs,
} from '../globe/caseGlobeLayers.mjs';

const prefersReducedMotion = () => (
    typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
);

export function useGlobeLayerSync({
    globeEl,
    globeContainer,
    viewMode,
    mobileGlobeEnabled,
    setMobileGlobeEnabled,
    globeReady,
    setGlobeReady,
    filteredForecasts,
    stressLevel,
    theoryLens,
    showEditorialCases,
    setExpandedCluster,
    setSelectedForecast,
    setSelectedTheory,
    setEscalationPairs,
    setArcClickedInfo,
}) {
    const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = e => setReducedMotion(e.matches);
        setReducedMotion(mql.matches);
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, []);

    // Auto-enable 3D Globe if viewport expands to tablet/desktop (>= 768px)
    useEffect(() => {
        if (mobileGlobeEnabled || typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia('(min-width: 768px)');
        const onChange = e => { if (e.matches) setMobileGlobeEnabled(true); };
        if (mql.matches) {
            setMobileGlobeEnabled(true);
            return undefined;
        }
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, [mobileGlobeEnabled, setMobileGlobeEnabled]);

    // Initialize globe (auto-mounted on >=768px; 1-tap opt-in on mobile <768px)
    useEffect(() => {
        if (viewMode !== 'globe' || !mobileGlobeEnabled || globeEl.current) return undefined;
        if (!globeContainer.current) return undefined;
        let cancelled = false;

        import('globe.gl').then(({ default: Globe }) => {
            if (cancelled || !globeContainer.current) return;
            const globe = Globe()(globeContainer.current)
                .globeImageUrl('/assets/globe/earth-night.jpg')
                .backgroundImageUrl('/assets/globe/night-sky.jpg')
                .atmosphereColor('#0088ff')
                .atmosphereAltitude(0.15)
                .showGraticules(false);

            globeEl.current = globe;
            if (window.matchMedia?.('(max-width: 767px)').matches) {
                globe.renderer?.()?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 1.5));
            }

            const cw = globeContainer.current.offsetWidth || 600;
            const ch = globeContainer.current.offsetHeight || 500;
            globe.width(cw).height(ch);
            globe.pointOfView({ lat: 40, lng: 30, altitude: 2.5 });

            // Load bundled country boundaries TopoJSON (no third-party CDN fallback)
            fetch('/assets/globe/countries-110m.json')
                .then(res => res.json())
                .then(worldData => {
                    const countries = topojson.feature(worldData, worldData.objects.countries).features;
                    if (countries.length > 0) {
                        globe
                            .polygonsData(countries)
                            .polygonAltitude(0.005)
                            .polygonCapColor(() => 'rgba(0, 255, 255, 0.02)')
                            .polygonSideColor(() => 'rgba(0, 255, 255, 0.05)')
                            .polygonStrokeColor(() => 'rgba(0, 255, 255, 0.3)');
                    }
                })
                .catch(e => console.warn('Bundled country borders unavailable:', e.message));
            setGlobeReady(true);
        }).catch(err => {
            console.error('[Globe] Initialization failed:', err);
            setGlobeReady(true);
        });

        return () => { cancelled = true; };
    }, [viewMode, mobileGlobeEnabled, globeEl, globeContainer, setGlobeReady]);

    // Keep WebGL renderer aligned with responsive workspace dimensions
    useEffect(() => {
        if (viewMode !== 'globe' || !globeContainer.current) return undefined;
        const container = globeContainer.current;
        let resizeFrame = null;

        const resizeGlobe = () => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                const globe = globeEl.current;
                if (!globe || !container.isConnected) return;
                const width = Math.floor(container.clientWidth);
                const height = Math.floor(container.clientHeight);
                if (width > 0 && height > 0) globe.width(width).height(height);
            });
        };

        const observer = typeof ResizeObserver === 'function'
            ? new ResizeObserver(resizeGlobe)
            : null;
        observer?.observe(container);
        window.addEventListener('resize', resizeGlobe);
        resizeGlobe();

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', resizeGlobe);
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
        };
    }, [viewMode, globeReady, globeEl, globeContainer]);

    // Pause WebGL render loop and orbit controls whenever the Globe workspace is hidden
    useEffect(() => {
        const globe = globeEl.current;
        if (!globe) return;
        const controls = typeof globe.controls === 'function' ? globe.controls() : null;
        if (viewMode === 'globe') {
            globe.resumeAnimation?.();
            if (controls) controls.enabled = true;
        } else {
            globe.pauseAnimation?.();
            if (controls) controls.enabled = false;
        }
    }, [viewMode, globeReady, globeEl]);

    // Project filtered records, case-study layers, clusters, and escalation arcs onto the Globe
    useEffect(() => {
        if (!globeEl.current) return;

        const filtered = filteredForecasts;

        const getPointColor = (item, baseColor) => {
            if (!theoryLens) return baseColor;
            const text = `${item['Entity/Subject']} ${item['Expected Impact/Value']} ${item['Topic/Sector']}`.toLowerCase();
            const matches = THEORY_KEYWORDS[theoryLens]?.test(text);
            return matches ? THEORY_COLORS[theoryLens] : baseColor;
        };
        const getPointOpacity = item => {
            if (!theoryLens) return 1;
            const text = `${item['Entity/Subject']} ${item['Expected Impact/Value']} ${item['Topic/Sector']}`.toLowerCase();
            return THEORY_KEYWORDS[theoryLens]?.test(text) ? 1 : 0.15;
        };

        const globeItems = showEditorialCases ? filtered : filtered.filter(item => !item.isCaseStudy);
        const rawPoints = globeItems.flatMap(item => {
            const baseColor = item.isCaseStudy
                ? caseColor(item)
                : item.isLive ? '#00ffff' : (categoryColors[item.Broad_Category] || '#ffffff');
            const color = getPointColor(item, baseColor);
            const opacity = getPointOpacity(item);
            const fallbackLocation = {
                label: item.regionTags?.[0] || item['Entity/Subject'] || 'Mapped location',
                latitude: Number.parseFloat(item.Latitude),
                longitude: Number.parseFloat(item.Longitude),
            };
            const locations = item.isCaseStudy && item.map?.locations?.length
                ? item.map.locations
                : [fallbackLocation];

            return locations
                .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
                .map(location => ({
                    lat: Number(location.latitude),
                    lng: Number(location.longitude),
                    size: (item.isCaseStudy ? 0.95 : item.isLive ? 1.2 : 0.8) * (theoryLens && opacity < 0.5 ? 0.4 : 1),
                    color,
                    opacity,
                    data: item,
                    locationLabel: location.label,
                    type: item.isCaseStudy ? 'editorial-case' : 'forecast',
                }));
        });

        const forecastPoints = clusterPoints(rawPoints);

        globeEl.current
            .pointsData(forecastPoints)
            .pointAltitude(point => (point.data?.isCaseStudy ? 0.03 : 0.01))
            .pointRadius('size')
            .pointColor('color')
            .onPointClick(point => {
                if (point.isCluster) {
                    globeEl.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.0 }, 600);
                    setExpandedCluster({ items: point.items, lat: point.lat, lng: point.lng });
                } else {
                    setExpandedCluster(null);
                    setSelectedForecast(point.data);
                    if (theoryLens) setSelectedTheory(THEORY_LABELS[theoryLens] || 'Realism');
                }
            })
            .pointLabel(d => formatGlobePointTooltip(d));

        const stressColor = stressLevel > 70 ? '#ff3300' : stressLevel > 40 ? '#ff9900' : '#0088ff';
        globeEl.current.atmosphereColor(stressColor);
        globeEl.current.atmosphereAltitude(0.15 + (stressLevel / 500));

        // Editorial case layers: pulsing rings at every mapped case location,
        // and arcs that connect only the locations a case itself maps.
        const caseItems = showEditorialCases ? globeItems.filter(item => item.isCaseStudy) : [];
        const rings = reducedMotion ? [] : buildCaseRings(caseItems);
        globeEl.current
            .ringsData(rings)
            .ringColor(ring => t => hexToRgba(ring.color, (ring.overdue ? 0.45 : 0.85) * (1 - t)))
            .ringMaxRadius('maxRadius')
            .ringPropagationSpeed('propagationSpeed')
            .ringRepeatPeriod('repeatPeriod')
            .ringAltitude(0.004);

        const arcs = buildCaseArcs(caseItems);
        const isCritical = stressLevel > 70;
        const elevated = stressLevel > 50;
        globeEl.current
            .arcsData(arcs)
            .arcColor('color')
            .arcAltitude('altitude')
            .arcStroke(isCritical ? 0.9 : elevated ? 0.7 : 0.5)
            .arcDashLength(reducedMotion ? 1 : 0.45)
            .arcDashGap(reducedMotion ? 0 : 0.25)
            .arcDashInitialGap(d => d.initialGap ?? 0)
            .arcDashAnimateTime(reducedMotion ? 0 : isCritical ? 1400 : elevated ? 2400 : 3600)
            .arcLabel(d => `
                <div style="background:rgba(4,8,14,0.94);padding:10px 14px;border:1px solid ${d.relHex};border-radius:8px;font-family:Roboto Mono,monospace;max-width:300px;box-shadow:0 0 18px ${d.relHex}44;">
                    <div style="color:${d.relHex};font-size:0.72rem;font-weight:800;letter-spacing:1px;margin-bottom:6px;">◆ ${escHtml(d.relType)} CASE · MAPPED LINK</div>
                    <div style="color:#fff;font-size:0.85rem;font-weight:700;margin-bottom:6px;line-height:1.35;">${escHtml(d.caseTitle || '')}</div>
                    <div style="color:#d6e4ea;font-size:0.8rem;">${escHtml(d.fromName)} <span style="color:${d.relHex}">→</span> ${escHtml(d.toName)}</div>
                    <div style="color:#9fb2bc;font-size:0.72rem;margin-top:7px;">Locations mapped by this case · click for detail</div>
                </div>`)
            .onArcClick(d => setArcClickedInfo(d));

        // Retire the legacy HTML pulse elements; rings now carry this signal.
        globeEl.current.htmlElementsData([]);

        setEscalationPairs(elevated ? buildConflictCasePairs(arcs) : []);
    }, [
        globeEl,
        filteredForecasts,
        stressLevel,
        theoryLens,
        showEditorialCases,
        reducedMotion,
        globeReady,
        viewMode,
        setExpandedCluster,
        setSelectedForecast,
        setSelectedTheory,
        setEscalationPairs,
        setArcClickedInfo,
    ]);
}

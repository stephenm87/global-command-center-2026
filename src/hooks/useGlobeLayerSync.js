import { useEffect } from 'react';
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
                ? '#b69cff'
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
                    size: (item.isCaseStudy ? 1.35 : item.isLive ? 1.2 : 0.8) * (theoryLens && opacity < 0.5 ? 0.4 : 1),
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
            .pointAltitude(point => (point.data.isCaseStudy ? 0.035 : 0.01))
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

        const classifyRelationship = (a, b) => {
            const text = [
                a.data['Entity/Subject'], a.data['Expected Impact/Value'],
                b.data['Entity/Subject'], b.data['Expected Impact/Value'],
            ].join(' ').toLowerCase();
            if (/war|military|attack|missile|troops|drone|weapon|navy|armed|combat|siege|nuclear/.test(text))
                return { type: 'MILITARY', color: ['#ff0033', '#ff4400', '#ff0033'], icon: '⚔️', hex: '#ff2200' };
            if (/sanction|tariff|trade.war|embargo|export.ban|economic|gdp|inflation|currency/.test(text))
                return { type: 'ECONOMIC', color: ['#ff9900', '#ffcc00', '#ff9900'], icon: '💰', hex: '#ff9900' };
            if (/territory|border|sea|island|claim|sovereignty|occupation|annex/.test(text))
                return { type: 'TERRITORIAL', color: ['#ffff00', '#ffe000', '#ffff00'], icon: '🗺️', hex: '#ffdd00' };
            if (/famine|refugee|aid|disease|hunger|humanitarian|food.crisis|displaced/.test(text))
                return { type: 'HUMANITARIAN', color: ['#00ff88', '#00ffcc', '#00ff88'], icon: '🏥', hex: '#00ff99' };
            return { type: 'DIPLOMATIC', color: ['#cc00ff', '#ff00cc', '#cc00ff'], icon: '🤝', hex: '#cc44ff' };
        };

        if (stressLevel > 50) {
            const conflictPoints = forecastPoints
                .filter(p => p.data.Broad_Category === 'Geopolitics & Conflict')
                .slice(0, 12);

            const isCritical = stressLevel > 70;
            const arcs = [];
            const pairs = [];
            const connectedNodes = [];

            for (let i = 0; i < conflictPoints.length - 1; i += 2) {
                const a = conflictPoints[i];
                const b = conflictPoints[i + 1];
                const rel = classifyRelationship(a, b);
                const fromName = a.data['Key Player/Organization'] || a.data['Entity/Subject']?.substring(0, 28);
                const toName = b.data['Key Player/Organization'] || b.data['Entity/Subject']?.substring(0, 28);

                arcs.push({
                    startLat: a.lat,
                    startLng: a.lng,
                    endLat: b.lat,
                    endLng: b.lng,
                    color: rel.color,
                    altitude: isCritical ? 0.7 : 0.5,
                    relType: rel.type,
                    relIcon: rel.icon,
                    relHex: rel.hex,
                    fromName,
                    toName,
                    fromImpact: a.data['Expected Impact/Value']?.substring(0, 80),
                    toImpact: b.data['Expected Impact/Value']?.substring(0, 80),
                    fromFull: a.data,
                    toFull: b.data,
                });

                pairs.push({
                    from: a.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    to: b.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    fromOrg: a.data['Key Player/Organization'],
                    toOrg: b.data['Key Player/Organization'],
                    relType: rel.type,
                    relIcon: rel.icon,
                    relHex: rel.hex,
                });

                connectedNodes.push({ lat: a.lat, lng: a.lng, hex: rel.hex });
                connectedNodes.push({ lat: b.lat, lng: b.lng, hex: rel.hex });
            }

            const animTime = isCritical ? 600 : 1800;
            const dashLen = isCritical ? 0.9 : 0.5;
            const dashGap = isCritical ? 0.15 : 1.2;
            const stroke = isCritical ? 2.5 : 1.2;

            globeEl.current
                .arcsData(arcs)
                .arcColor('color')
                .arcDashLength(dashLen)
                .arcDashGap(dashGap)
                .arcDashAnimateTime(animTime)
                .arcStroke(stroke)
                .arcAltitude('altitude')
                .arcLabel(d => `
                    <div style="background:rgba(5,3,3,0.92);padding:10px 14px;border:1px solid ${d.relHex};border-radius:6px;font-family:Roboto Mono,monospace;max-width:280px;box-shadow:0 0 16px ${d.relHex}55;">
                        <div style="color:${d.relHex};font-size:0.75rem;font-weight:900;letter-spacing:1px;margin-bottom:7px;">${d.relIcon} ${d.relType} LINK</div>
                        <div style="color:#fff;font-size:0.875rem;font-weight:700;">${escHtml(d.fromName)}</div>
                        <div style="color:${d.relHex};font-size:1rem;text-align:center;margin:4px 0;">⇄</div>
                        <div style="color:#fff;font-size:0.875rem;font-weight:700;margin-bottom:7px;">${escHtml(d.toName)}</div>
                        <div style="color:#c0c0c0;font-size:0.8rem;line-height:1.5;border-top:1px solid ${d.relHex}44;padding-top:7px;">${escHtml(d.fromImpact || '')}</div>
                        <div style="color:#aaa;font-size:0.75rem;margin-top:7px;">CLICK ARC FOR FULL DETAIL</div>
                    </div>`)
                .onArcClick(d => setArcClickedInfo(d));

            globeEl.current
                .htmlElementsData(connectedNodes)
                .htmlAltitude(0.015)
                .htmlElement(d => {
                    const el = document.createElement('div');
                    el.className = 'node-pulse-ring';
                    el.style.setProperty('--ring-color', d.hex);
                    return el;
                });

            setEscalationPairs(pairs);
        } else {
            globeEl.current.arcsData([]).htmlElementsData([]);
            setEscalationPairs([]);
        }
    }, [
        globeEl,
        filteredForecasts,
        stressLevel,
        theoryLens,
        showEditorialCases,
        globeReady,
        viewMode,
        setExpandedCluster,
        setSelectedForecast,
        setSelectedTheory,
        setEscalationPairs,
        setArcClickedInfo,
    ]);
}

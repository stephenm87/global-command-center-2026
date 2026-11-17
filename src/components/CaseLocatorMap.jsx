import { useEffect, useId, useMemo, useState } from 'react';
import { geoContains, geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo';
import * as topojson from 'topojson-client';
import { caseLocationPairs } from '../globe/caseGlobeLayers.mjs';
import { placeLabels } from './locatorLabels.mjs';

const WIDTH = 360;
const HEIGHT = 260;
const PAD = 26;

let countriesPromise = null;
function loadCountries() {
    if (!countriesPromise) {
        countriesPromise = fetch('/assets/globe/countries-110m.json')
            .then(res => (res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`))))
            .then(world => topojson.feature(world, world.objects.countries).features)
            .catch(error => {
                countriesPromise = null;
                throw error;
            });
    }
    return countriesPromise;
}

const validLocations = map => (map?.locations || []).filter(location => (
    Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude))
));

/**
 * Frame for the projection. Global cases show the whole world. Point cases get
 * a regional window around the single location. Other cases fit their mapped
 * locations with a margin so neighbouring context stays visible.
 */
function frameFor(mode, locations) {
    if (mode === 'global' || locations.length === 0) return { type: 'Sphere' };
    const lats = locations.map(l => Number(l.latitude));
    const lngs = locations.map(l => Number(l.longitude));
    const spanLat = Math.max(...lats) - Math.min(...lats);
    const spanLng = Math.max(...lngs) - Math.min(...lngs);
    const marginLat = Math.max(9, spanLat * 0.35);
    const marginLng = Math.max(14, spanLng * 0.35);
    const south = Math.max(-80, Math.min(...lats) - marginLat);
    const north = Math.min(84, Math.max(...lats) + marginLat);
    const west = Math.max(-180, Math.min(...lngs) - marginLng);
    const east = Math.min(180, Math.max(...lngs) + marginLng);
    return {
        type: 'Feature',
        geometry: {
            type: 'MultiPoint',
            coordinates: [[west, south], [east, south], [east, north], [west, north]],
        },
    };
}

export default function CaseLocatorMap({ map, color = '#67d5f5', title }) {
    const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '');
    const clipId = `case-locator-clip-${uid}`;
    const glowId = `case-locator-glow-${uid}`;
    const [countries, setCountries] = useState(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        let cancelled = false;
        loadCountries()
            .then(features => { if (!cancelled) setCountries(features); })
            .catch(() => { if (!cancelled) setFailed(true); });
        return () => { cancelled = true; };
    }, []);

    const locations = useMemo(() => validLocations(map), [map]);
    const mode = map?.mode || 'point';

    const geometry = useMemo(() => {
        const projection = geoNaturalEarth1()
            .fitExtent([[PAD, PAD], [WIDTH - PAD, HEIGHT - PAD]], frameFor(mode, locations));
        const path = geoPath(projection);
        const points = locations.map((location, index) => {
            const [x, y] = projection([Number(location.longitude), Number(location.latitude)]) || [0, 0];
            return { ...location, x, y, index };
        });
        const pairs = caseLocationPairs({ map: { mode, locations } }).map(([a, b]) => {
            const from = points[locations.indexOf(a)];
            const to = points[locations.indexOf(b)];
            const mx = (from.x + to.x) / 2;
            const my = (from.y + to.y) / 2;
            const lift = Math.min(60, Math.hypot(to.x - from.x, to.y - from.y) * 0.28);
            return { key: `${from.index}-${to.index}`, d: `M${from.x},${from.y} Q${mx},${my - lift} ${to.x},${to.y}` };
        });
        return {
            path,
            labels: placeLabels(points, WIDTH, HEIGHT),
            graticule: path(geoGraticule10()),
            sphere: path({ type: 'Sphere' }),
            points,
            pairs,
        };
    }, [mode, locations]);

    const highlighted = useMemo(() => {
        if (!countries) return new Set();
        const ids = new Set();
        for (const location of locations) {
            const point = [Number(location.longitude), Number(location.latitude)];
            const match = countries.find(feature => geoContains(feature, point));
            if (match) ids.add(match.id ?? match.properties?.name);
        }
        return ids;
    }, [countries, locations]);

    const labelled = geometry.points.length <= 6;
    const description = locations.length
        ? `${title ? `${title}: ` : ''}${locations.map(l => l.label).join(', ')}`
        : 'No mapped locations';

    return (
        <figure className="case-locator" style={{ '--locator-color': color }}>
            <svg
                viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
                role="img"
                aria-label={`Locator map. ${description}`}
                className={failed ? 'case-locator-svg is-fallback' : 'case-locator-svg'}
            >
                <defs>
                    <clipPath id={clipId}>
                        <rect x="0" y="0" width={WIDTH} height={HEIGHT} rx="14" />
                    </clipPath>
                    <radialGradient id={glowId} cx="50%" cy="45%" r="70%">
                        <stop offset="0%" stopColor={color} stopOpacity="0.14" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </radialGradient>
                </defs>
                <g clipPath={`url(#${clipId})`}>
                    <rect x="0" y="0" width={WIDTH} height={HEIGHT} className="case-locator-ocean" />
                    <rect x="0" y="0" width={WIDTH} height={HEIGHT} fill={`url(#${glowId})`} />
                    <path d={geometry.graticule} className="case-locator-graticule" />
                    {countries && countries.map(feature => {
                        const key = feature.id ?? feature.properties?.name;
                        return (
                            <path
                                key={key}
                                d={geometry.path(feature) || ''}
                                className={highlighted.has(key) ? 'case-locator-country is-active' : 'case-locator-country'}
                            />
                        );
                    })}
                    {geometry.pairs.map(pair => (
                        <path key={pair.key} d={pair.d} className="case-locator-arc" />
                    ))}
                    {geometry.points.map(point => (
                        <g key={`${point.label}-${point.index}`} transform={`translate(${point.x},${point.y})`} className={point.index === 0 ? 'case-locator-point is-primary' : 'case-locator-point'}>
                            <circle r="9" className="case-locator-pulse" />
                            <circle r={point.index === 0 ? 4.2 : 3.2} className="case-locator-dot" />
                        </g>
                    ))}
                    {labelled && geometry.labels.map((label, index) => (
                        <text
                            key={`label-${index}`}
                            x={label.x}
                            y={label.y}
                            textAnchor={label.anchor}
                            className={index === 0 ? 'case-locator-label is-primary' : 'case-locator-label'}
                        >
                            {label.fullText && label.fullText !== label.text && <title>{label.fullText}</title>}
                            {label.text}
                        </text>
                    ))}
                    {mode === 'global' && <path d={geometry.sphere} className="case-locator-sphere" />}
                </g>
                <rect x="0.5" y="0.5" width={WIDTH - 1} height={HEIGHT - 1} rx="14" className="case-locator-frame" />
            </svg>
            <figcaption>
                <span>
                    {mode === 'global' ? 'Global · representative sites' : mode === 'route' ? 'Route · in sequence' : mode === 'regional' ? 'Regional · mapped places' : 'Point case'}
                    {failed ? ' · Basemap unavailable' : ''}
                </span>
                <span className="case-locator-count">{locations.length} {locations.length === 1 ? 'location' : 'locations'}</span>
            </figcaption>
        </figure>
    );
}

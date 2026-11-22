import React, { Component, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import CaseActorMapFlat from './CaseActorMapFlat';
import { chooseActorMapMode, detectWebGLSupport, isLowPowerDeviceConfig } from './actorMapMode.mjs';
import { safeHttpUrl } from '../navigationState.mjs';
import './CaseActorMap.css';

const CaseActorMap3D = React.lazy(() => import('./CaseActorMap3D'));

const LEVEL_KEYS = [
    ['local', 'Local'],
    ['state', 'State'],
    ['regional', 'Regional'],
    ['global', 'Global'],
];

const LEVEL_COLORS = {
    local: '#ffd9a0',
    state: '#67d5f5',
    regional: '#b79cff',
    global: '#f7f3e8',
};

const CONNECTION_TYPE_NAMES = {
    conflict: 'Conflict',
    pressure: 'Pressure or restriction',
    support: 'Aid or support',
    movement: 'People moving',
};

const CONNECTION_COLORS = {
    conflict: '#ff5d6c',
    pressure: '#ff9f43',
    support: '#4ade80',
    movement: '#e6f2f7',
};

class ActorMap3DErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { failed: false };
    }
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch() {
        this.props.onFallback?.();
    }
    render() {
        if (this.state.failed) return this.props.fallback;
        return this.props.children;
    }
}

export default function CaseActorMap({
    actorMap,
    mapLocations = [],
    activeStepKey = '1',
    selected = null,
    onSelect,
    sourceIndex,
    onJumpToSource,
}) {
    const frameRef = useRef(null);
    const [reducedMotion, setReducedMotion] = useState(() => (
        typeof window !== 'undefined' && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
    ));
    const [webglAvailable] = useState(() => detectWebGLSupport());
    const [lowPowerInitial] = useState(() => isLowPowerDeviceConfig());
    const [hasScrolledIntoView, setHasScrolledIntoView] = useState(false);
    // null = automatic choice; '3d' = user opted in; 'flat' = user chose 2D flat fallback
    const [userModeChoice, setUserModeChoice] = useState(null);
    const [fallbackForced, setFallbackForced] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
        const onChange = e => setReducedMotion(e.matches);
        setReducedMotion(mql.matches);
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, []);

    // Lazy trigger: defer loading 3D + Blue Marble imagery until scrolled into view
    useEffect(() => {
        if (hasScrolledIntoView || !frameRef.current) return undefined;
        if (typeof IntersectionObserver !== 'function') {
            setHasScrolledIntoView(true);
            return undefined;
        }
        const observer = new IntersectionObserver(
            entries => {
                if (entries.some(entry => entry.isIntersecting)) {
                    setHasScrolledIntoView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '120px', threshold: 0.05 },
        );
        observer.observe(frameRef.current);
        return () => observer.disconnect();
    }, [hasScrolledIntoView]);

    const canUse3D = webglAvailable && !reducedMotion && !fallbackForced;
    const activeMode = useMemo(() => chooseActorMapMode({
        webgl: webglAvailable,
        reducedMotion,
        fallbackForced,
        lowPower: lowPowerInitial,
        userChoice: userModeChoice,
        inView: hasScrolledIntoView,
    }), [webglAvailable, reducedMotion, fallbackForced, userModeChoice, lowPowerInitial, hasScrolledIntoView]);

    const step = useMemo(
        () => actorMap?.steps?.find(s => String(s.key) === String(activeStepKey)) || actorMap?.steps?.[0],
        [actorMap, activeStepKey],
    );

    const handleSelect = (kind, id) => {
        if (selected && selected.kind === kind && selected.id === id) {
            onSelect?.(null);
        } else {
            onSelect?.({ kind, id });
        }
    };

    const flatFallbackEl = (
        <CaseActorMapFlat
            actorMap={actorMap}
            mapLocations={mapLocations}
            activeStepKey={activeStepKey}
            selected={selected}
            onSelect={handleSelect}
            reducedMotion={reducedMotion}
        />
    );

    return (
        <div className="case-actor-map">
            <div className="actor-map-toolbar">
                <span className="actor-map-badge-label">
                    {activeMode === '3d' ? '3D TERRAIN ACTOR MAP' : '2D ACTOR MAP'}
                    {step?.bloc && actorMap?.bloc?.name ? ` · ${actorMap.bloc.name}` : ''}
                </span>
                {canUse3D ? (
                    <button
                        type="button"
                        className="actor-mode-btn"
                        onClick={() => {
                            setHasScrolledIntoView(true);
                            setUserModeChoice(activeMode === '3d' ? 'flat' : '3d');
                        }}
                    >
                        {activeMode === '3d' ? 'Switch to 2D flat map' : 'Open 3D terrain view'}
                    </button>
                ) : (
                    <span className="actor-mode-status">
                        {reducedMotion ? 'Flat view · Reduced motion' : 'Flat view · WebGL unavailable'}
                    </span>
                )}
            </div>

            <div
                ref={frameRef}
                className="actor-map-frame"
                onKeyDown={e => {
                    if (e.key === 'Escape' && selected) {
                        e.preventDefault();
                        onSelect?.(null);
                    }
                }}
            >
                {activeMode === '3d' ? (
                    <ActorMap3DErrorBoundary fallback={flatFallbackEl} onFallback={() => setFallbackForced(true)}>
                        <Suspense fallback={flatFallbackEl}>
                            <CaseActorMap3D
                                key={actorMap.focusCountry}
                                actorMap={actorMap}
                                mapLocations={mapLocations}
                                activeStepKey={activeStepKey}
                                selected={selected}
                                onSelect={handleSelect}
                                reducedMotion={reducedMotion}
                                onFatalError={() => setFallbackForced(true)}
                            />
                        </Suspense>
                    </ActorMap3DErrorBoundary>
                ) : (
                    flatFallbackEl
                )}

                <div className="actor-levels-key" aria-label="Levels in view">
                    {LEVEL_KEYS.map(([key, label]) => (
                        <div
                            key={key}
                            className={`actor-level-item${step?.levels?.includes(key) ? ' on' : ''}`}
                            style={{ '--c': LEVEL_COLORS[key] }}
                        >
                            <i aria-hidden="true" />
                            <span>{label}</span>
                        </div>
                    ))}
                    <div className="actor-levels-title">Levels in view</div>
                </div>

                {activeMode === '3d' && !reducedMotion && (
                    <div className="actor-map-hint">Move pointer to shift angle</div>
                )}
            </div>

            <div className="actor-map-meta-bar">
                <div className="actor-map-legend" aria-label="Connection types">
                    <span>
                        <svg viewBox="0 0 34 8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" stroke="#ff5d6c" strokeWidth="2.4" /></svg>
                        Conflict
                    </span>
                    <span>
                        <svg viewBox="0 0 34 8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" stroke="#ff9f43" strokeWidth="2.4" strokeDasharray="9 5" /></svg>
                        Pressure or restriction
                    </span>
                    <span>
                        <svg viewBox="0 0 34 8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" stroke="#4ade80" strokeWidth="2.4" strokeDasharray="4 4" /></svg>
                        Aid or support
                    </span>
                    <span>
                        <svg viewBox="0 0 34 8" aria-hidden="true"><line x1="1" y1="4" x2="33" y2="4" stroke="#e6f2f7" strokeWidth="2.4" strokeDasharray="1.5 4" strokeLinecap="round" /></svg>
                        People moving
                    </span>
                </div>
                <p className="actor-map-attribution">
                    {activeMode === '3d'
                        ? 'Terrain imagery: NASA Blue Marble (public domain) · Country borders: Natural Earth 1:50m.'
                        : 'Country outlines: Natural Earth 1:110m (public domain).'}
                </p>
            </div>
        </div>
    );
}

export function ActorMapSidePanel({
    actorMap,
    mapLocations = [],
    activeStepKey = '1',
    selected = null,
    onSelect,
    sourceIndex,
    onJumpToSource,
}) {
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

    if (!actorMap || !step) return null;

    const toggleSelect = (kind, id) => {
        if (selected && selected.kind === kind && selected.id === id) {
            onSelect?.(null);
        } else {
            onSelect?.({ kind, id });
        }
    };

    const renderSourceCitation = url => {
        const src = url ? sourceIndex?.get(url) : null;
        if (!src) return null;
        const safeSrcUrl = safeHttpUrl(src.url);
        return (
            <div className="actor-detail-src">
                <span>Source: </span>
                <a
                    href={`#briefing-source-${src.number}`}
                    onClick={e => onJumpToSource?.(e, src.number, src)}
                >
                    [{src.number}] {src.publisher}{src.dateLabel ? ` (${src.dateLabel})` : ''}
                </a>
                {safeSrcUrl && (
                    <>
                        {' · '}
                        <a href={safeSrcUrl} target="_blank" rel="noopener noreferrer">
                            Open original <span aria-hidden="true">↗</span>
                        </a>
                    </>
                )}
            </div>
        );
    };

    const renderInspector = () => {
        if (!selected) {
            return (
                <p className="actor-detail-empty">
                    Select any actor pin, connection label, or entry below to inspect what connects them and its source.
                </p>
            );
        }
        if (selected.kind === 'connection') {
            const c = connById.get(selected.id);
            if (!c) return null;
            const fromActor = actorById.get(c.from);
            const toActor = actorById.get(c.to);
            return (
                <div className="actor-detail-body" style={{ '--c': CONNECTION_COLORS[c.type] }}>
                    <span className="actor-detail-tag">{CONNECTION_TYPE_NAMES[c.type] || c.type}</span>
                    <strong>{fromActor?.name || c.from} → {toActor?.name || c.to}</strong>
                    <p>{c.text}</p>
                    {renderSourceCitation(c.sourceUrl)}
                    <button type="button" className="actor-clear-btn" onClick={() => onSelect?.(null)}>
                        Clear selection
                    </button>
                </div>
            );
        }
        if (selected.kind === 'actor') {
            const a = actorById.get(selected.id);
            if (!a) return null;
            const locSummary = a.location.kind === 'pin'
                ? `${a.location.place} (${a.location.latitude.toFixed(3)}, ${a.location.longitude.toFixed(3)})`
                : a.location.kind === 'area'
                    ? `Area · ${a.location.label}`
                    : 'Global · No single place';
            return (
                <div className="actor-detail-body" style={{ '--c': LEVEL_COLORS[a.level] }}>
                    <span className="actor-detail-tag">{a.level} level · {locSummary}</span>
                    <strong>{a.name}</strong>
                    <p>{a.role}</p>
                    {renderSourceCitation(a.sourceUrl)}
                    <button type="button" className="actor-clear-btn" onClick={() => onSelect?.(null)}>
                        Clear selection
                    </button>
                </div>
            );
        }
        if (selected.kind === 'place') {
            const place = mapLocations.find(loc => loc.label === selected.id);
            if (!place) return null;
            return (
                <div className="actor-detail-body" style={{ '--c': '#67d5f5' }}>
                    <span className="actor-detail-tag">
                        Mapped place · {Number(place.latitude).toFixed(3)}, {Number(place.longitude).toFixed(3)}
                    </span>
                    <strong>{place.label}</strong>
                    <p>{place.role}</p>
                    <button type="button" className="actor-clear-btn" onClick={() => onSelect?.(null)}>
                        Clear selection
                    </button>
                </div>
            );
        }
        return null;
    };

    const matchPlaceToSelection = place => {
        const match = (actorMap.actors || []).find(a => {
            if (a.location.kind === 'pin') {
                return Math.hypot(a.location.longitude - Number(place.longitude), a.location.latitude - Number(place.latitude)) < 0.08;
            }
            if (a.location.kind === 'area' && a.location.anchor) {
                return Math.hypot(a.location.anchor.longitude - Number(place.longitude), a.location.anchor.latitude - Number(place.latitude)) < 0.08;
            }
            return false;
        });
        if (match && (step.actors || []).some(e => e.id === match.id)) {
            toggleSelect('actor', match.id);
        } else {
            toggleSelect('place', place.label);
        }
    };

    return (
        <aside className="actor-map-panel" aria-label="Actor connections and mapped places">
            {step.note && <p className="actor-step-note">{step.note}</p>}

            <div className="actor-panel-section">
                <h3>Connections in this step ({step.connections.length})</h3>
                <ul className="actor-conn-list">
                    {step.connections.map(cid => {
                        const c = connById.get(cid);
                        if (!c) return null;
                        const fromName = actorById.get(c.from)?.name || c.from;
                        const toName = actorById.get(c.to)?.name || c.to;
                        const isSel = selected?.kind === 'connection' && selected.id === c.id;
                        return (
                            <li key={c.id}>
                                <button
                                    type="button"
                                    className={`actor-conn-btn${isSel ? ' is-sel' : ''}`}
                                    style={{ '--c': CONNECTION_COLORS[c.type] }}
                                    aria-pressed={isSel}
                                    onClick={() => toggleSelect('connection', c.id)}
                                >
                                    <i aria-hidden="true" />
                                    <span className="actor-conn-copy">
                                        <span className="actor-conn-type">{CONNECTION_TYPE_NAMES[c.type] || c.type}</span>
                                        <span className="actor-conn-title">{fromName} → {toName}</span>
                                        <small>{c.label}</small>
                                    </span>
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </div>

            <div className="actor-detail-box" aria-live="polite">
                {renderInspector()}
            </div>

            {mapLocations.length > 0 && (
                <details className="actor-places-details">
                    <summary>Mapped places in this case ({mapLocations.length})</summary>
                    <ul className="actor-places-list">
                        {mapLocations.map(place => {
                            const isPlaceSel = selected?.kind === 'place' && selected.id === place.label;
                            return (
                                <li key={place.label}>
                                    <button
                                        type="button"
                                        className={`actor-place-btn${isPlaceSel ? ' is-sel' : ''}`}
                                        onClick={() => matchPlaceToSelection(place)}
                                    >
                                        <strong>{place.label}</strong>
                                        <span>{place.role}</span>
                                    </button>
                                </li>
                            );
                        })}
                    </ul>
                </details>
            )}
        </aside>
    );
}

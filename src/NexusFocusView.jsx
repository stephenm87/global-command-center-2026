import { useEffect, useMemo, useState } from 'react';
import { GUIDED_TOURS } from './nexusTours';
import {
    NEXUS_ACTORS,
    RELATIONSHIP_DIMENSIONS,
    getNexusRelationships,
    inferForecastActorIds,
} from './nexusFocusData';
import './NexusFocusView.css';

const RING_POSITIONS = [
    { x: 50, y: 15 },
    { x: 78, y: 28 },
    { x: 84, y: 58 },
    { x: 69, y: 82 },
    { x: 31, y: 82 },
    { x: 16, y: 58 },
    { x: 22, y: 28 },
    { x: 50, y: 91 },
];

const strengthLabel = salience => salience >= 0.8 ? 'High salience' : salience >= 0.5 ? 'Significant' : 'Established';

export default function NexusFocusView({ forecasts = [], initialNodeId, onSelectActor, onOpenSpatial, onOpenBriefing }) {
    const relationships = useMemo(() => getNexusRelationships(), []);
    const [selectedId, setSelectedId] = useState(NEXUS_ACTORS[initialNodeId] ? initialNodeId : 'USA');
    const [dimension, setDimension] = useState('all');
    const [expanded, setExpanded] = useState(false);
    const [query, setQuery] = useState('');
    const [detailTab, setDetailTab] = useState('summary');

    useEffect(() => {
        if (NEXUS_ACTORS[initialNodeId]) setSelectedId(initialNodeId);
    }, [initialNodeId]);

    const actor = NEXUS_ACTORS[selectedId];
    const related = useMemo(() => relationships
        .filter(relation => relation.source === selectedId || relation.target === selectedId)
        .filter(relation => dimension === 'all' || relation.dimensions.includes(dimension))
        .map(relation => ({
            ...relation,
            actorId: relation.source === selectedId ? relation.target : relation.source,
        }))
        .sort((a, b) => b.tension - a.tension), [relationships, selectedId, dimension]);

    const visibleRelations = related.slice(0, expanded ? 8 : 6);
    const actorCases = useMemo(() => forecasts
        .filter(forecast => inferForecastActorIds(forecast).includes(selectedId))
        .filter(forecast => forecast.url)
        .sort((a, b) => {
            const curatedPriority = Number(Boolean(b.isCaseStudy)) - Number(Boolean(a.isCaseStudy));
            if (curatedPriority !== 0) return curatedPriority;
            return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        })
        .slice(0, 6), [forecasts, selectedId]);

    const suggestions = query.trim().length > 0
        ? Object.values(NEXUS_ACTORS).filter(item => `${item.name} ${item.region} ${item.type}`.toLowerCase().includes(query.toLowerCase())).slice(0, 6)
        : [];

    const matchingTour = GUIDED_TOURS.find(tour => tour.waypoints.some(waypoint => waypoint.nodeId === selectedId));

    const selectActor = id => {
        setSelectedId(id);
        onSelectActor?.(id);
        setQuery('');
        setExpanded(false);
        setDetailTab('summary');
    };

    return (
        <section className="focus-nexus" aria-label="Focused relations nexus">
            <div className="focus-toolbar">
                <div className="focus-search-wrap">
                    <label htmlFor="focus-nexus-search">Find an actor, region, or institution</label>
                    <input
                        id="focus-nexus-search"
                        type="search"
                        value={query}
                        onChange={event => setQuery(event.target.value)}
                        placeholder="Search actors and regions…"
                        autoComplete="off"
                    />
                    {suggestions.length > 0 && (
                        <div className="focus-search-results" aria-label="Matching actors">
                            {suggestions.map(item => (
                                <button key={item.id} type="button" onClick={() => selectActor(item.id)}>
                                    <span>{item.name}</span><small>{item.region} · {item.type}</small>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                <label className="focus-dimension-label" htmlFor="focus-dimension">Relationship lens
                    <select id="focus-dimension" value={dimension} onChange={event => setDimension(event.target.value)}>
                        {Object.entries(RELATIONSHIP_DIMENSIONS).map(([id, meta]) => <option key={id} value={id}>{meta.label}</option>)}
                    </select>
                </label>
                <button className="focus-secondary-btn" type="button" onClick={() => setExpanded(value => !value)} aria-pressed={expanded}>
                    {expanded ? 'Focus only' : 'Show more'}
                </button>
                <button className="focus-secondary-btn" type="button" onClick={onOpenSpatial}>Open 3D spatial</button>
            </div>

            <div className="focus-layout">
                <div className="focus-map" aria-label={`${actor.name} relationship map`}>
                    <div className="focus-map-status"><span>FOCUS</span> {actor.name}<small>{visibleRelations.length} visible relationships</small></div>
                    <svg className="focus-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                        {visibleRelations.map((relation, index) => {
                            const position = RING_POSITIONS[index];
                            const primaryDimension = relation.dimensions[0] || 'diplomacy';
                            return <line key={relation.id} x1="50" y1="50" x2={position.x} y2={position.y} style={{ '--relation-color': RELATIONSHIP_DIMENSIONS[primaryDimension]?.color || '#9fb2bc' }} />;
                        })}
                    </svg>
                    <div
                        className="focus-node focus-node-center"
                        style={{ '--actor-color': actor.color }}
                        aria-label={`Current focus: ${actor.name}`}
                    >
                        <span>{actor.shortName}</span><small>{actor.type}</small>
                    </div>
                    {visibleRelations.map((relation, index) => {
                        const relatedActor = NEXUS_ACTORS[relation.actorId];
                        const position = RING_POSITIONS[index];
                        return (
                            <button
                                className="focus-node"
                                type="button"
                                key={relation.actorId}
                                style={{ left: `${position.x}%`, top: `${position.y}%`, '--actor-color': relatedActor.color }}
                                onClick={() => selectActor(relatedActor.id)}
                                aria-label={`Focus on ${relatedActor.name}`}
                            >
                                <span>{relatedActor.shortName}</span><small>{relation.dimensions.map(item => RELATIONSHIP_DIMENSIONS[item]?.label || item).join(' · ')}</small>
                            </button>
                        );
                    })}
                    {visibleRelations.length === 0 && <p className="focus-empty">No relationships match this lens. Choose another relationship lens.</p>}
                </div>

                <aside className="focus-inspector" aria-live="polite">
                    <div className="focus-actor-meta">{actor.region} · {actor.type}</div>
                    <h2>{actor.name}</h2>
                    <p className="focus-actor-description">{actor.description}</p>

                    <div className="focus-detail-tabs" role="group" aria-label="Focused actor details">
                        {[
                            ['summary', 'Summary'],
                            ['connections', `Connections (${related.length})`],
                            ['cases', `Current cases (${actorCases.length})`],
                        ].map(([id, label]) => (
                            <button key={id} type="button" aria-pressed={detailTab === id} onClick={() => setDetailTab(id)}>{label}</button>
                        ))}
                    </div>

                    {detailTab === 'summary' && (
                        <div className="focus-detail-content">
                            {visibleRelations.slice(0, 3).map(relation => {
                                const detail = relation.details[0];
                                return (
                                    <button key={relation.id} type="button" className="focus-relation-row" onClick={() => selectActor(relation.actorId)}>
                                        <strong>{NEXUS_ACTORS[relation.actorId].name}<span>{strengthLabel(relation.tension)}</span></strong>
                                        <small>{detail?.label || relation.dimensions.join(' · ')}</small>
                                        <p>{detail?.summary || 'Established geopolitical relationship.'}</p>
                                    </button>
                                );
                            })}
                            <p className="focus-context-note">Relationship summaries are reference context. Open Current cases for dated, source-linked material.</p>
                        </div>
                    )}

                    {detailTab === 'connections' && (
                        <div className="focus-detail-content focus-scroll-list">
                            {related.map(relation => (
                                <button key={relation.id} type="button" className="focus-relation-row" onClick={() => selectActor(relation.actorId)}>
                                    <strong>{NEXUS_ACTORS[relation.actorId].name}<span>{strengthLabel(relation.tension)}</span></strong>
                                    <small>{relation.dimensions.map(item => RELATIONSHIP_DIMENSIONS[item]?.label || item).join(' · ')}</small>
                                </button>
                            ))}
                        </div>
                    )}

                    {detailTab === 'cases' && (
                        <div className="focus-detail-content focus-scroll-list">
                            {actorCases.length > 0 ? actorCases.map((item, index) => (
                                <article className="focus-case-row" key={item.caseStudyId || item.url || `${item['Entity/Subject']}-${index}`}>
                                    <div>{(item.region || item.regionTags?.[0]) && <span>{item.region || item.regionTags[0]}</span>}{item.updatedAt && <time dateTime={item.updatedAt}>Updated {item.updatedAt}</time>}</div>
                                    <h3>{item['Entity/Subject']}</h3>
                                    <p>{item['Expected Impact/Value']}</p>
                                    {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer">Primary source ↗</a>}
                                </article>
                            )) : <p className="focus-context-note">No dated case studies are currently mapped to this actor.</p>}
                        </div>
                    )}

                    <div className="focus-actions">
                        {matchingTour && <button type="button" className="focus-primary-btn" onClick={() => onOpenBriefing(matchingTour.id, selectedId)}>Open guided briefing</button>}
                        <button type="button" className="focus-secondary-btn" onClick={() => selectActor('USA')}>Reset focus</button>
                    </div>
                </aside>
            </div>

            <div className="focus-mobile-list" aria-label={`${actor.name} relationships as a list`}>
                {visibleRelations.map(relation => (
                    <button key={relation.id} type="button" onClick={() => selectActor(relation.actorId)}>
                        <strong>{NEXUS_ACTORS[relation.actorId].name}</strong>
                        <span>{relation.details[0]?.label || relation.dimensions.join(' · ')}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

import { useEffect, useMemo, useState } from 'react';
import { GUIDED_TOURS } from './nexusTours';
import { NEXUS_ACTORS } from './nexusFocusData';
import './GuidedBriefings.css';

const validTour = id => GUIDED_TOURS.some(tour => tour.id === id);

const resolveStepIndex = (tourId, nodeId, step) => {
    const requestedTour = GUIDED_TOURS.find(item => item.id === tourId) || GUIDED_TOURS[0];
    const numericStep = Number(step);
    if (Number.isInteger(numericStep) && numericStep >= 1) {
        return Math.min(numericStep - 1, Math.max((requestedTour?.waypoints.length || 1) - 1, 0));
    }
    const actorIndex = requestedTour?.waypoints.findIndex(item => item.nodeId === nodeId) ?? -1;
    return actorIndex >= 0 ? actorIndex : 0;
};

export default function GuidedBriefings({ initialTourId, initialNodeId, initialStep, onExploreNode, onRouteChange }) {
    const [tourId, setTourId] = useState(validTour(initialTourId) ? initialTourId : GUIDED_TOURS[0]?.id);
    const [stepIndex, setStepIndex] = useState(() => resolveStepIndex(initialTourId, initialNodeId, initialStep));

    const tour = useMemo(() => GUIDED_TOURS.find(item => item.id === tourId) || GUIDED_TOURS[0], [tourId]);
    const waypoint = tour?.waypoints[stepIndex];
    const actor = waypoint ? NEXUS_ACTORS[waypoint.nodeId] : null;

    useEffect(() => {
        if (!validTour(initialTourId)) return;
        setTourId(initialTourId);
        setStepIndex(resolveStepIndex(initialTourId, initialNodeId, initialStep));
    }, [initialTourId, initialNodeId, initialStep]);

    useEffect(() => {
        if (!tour) return;
        const url = new URL(window.location.href);
        url.searchParams.set('view', 'briefings');
        url.searchParams.set('tour', tour.id);
        url.searchParams.set('step', String(stepIndex + 1));
        url.searchParams.delete('actor');
        window.history.replaceState({ view: 'briefings', tour: tour.id, step: stepIndex + 1 }, '', url);
        onRouteChange?.({ tourId: tour.id, nodeId: tour.waypoints[stepIndex]?.nodeId, step: stepIndex + 1 });
    }, [tour, stepIndex, onRouteChange]);

    if (!tour || !waypoint) return <div className="briefings-empty">No guided briefings are available.</div>;

    const chooseTour = id => {
        setTourId(id);
        setStepIndex(0);
    };

    const move = delta => setStepIndex(index => Math.min(Math.max(index + delta, 0), tour.waypoints.length - 1));

    return (
        <section
            className="guided-briefings"
            aria-label="Guided geopolitical briefings"
            onKeyDown={event => {
                if (event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
                if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
                if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
            }}
        >
            <aside className="briefing-library">
                <div className="briefing-library-heading">
                    <span>GUIDED BRIEFINGS</span>
                    <p>Follow one relationship at a time.</p>
                </div>
                <div className="briefing-tour-list">
                    {GUIDED_TOURS.map(item => (
                        <button
                            key={item.id}
                            type="button"
                            className={item.id === tour.id ? 'active' : ''}
                            onClick={() => chooseTour(item.id)}
                            aria-pressed={item.id === tour.id}
                            style={{ '--tour-color': item.color }}
                        >
                            <strong>{item.title}</strong>
                            <span>{item.subtitle}</span>
                            <small>{item.waypoints.length} steps{item.regionTags?.length ? ` · ${item.regionTags[0]}` : ''}</small>
                        </button>
                    ))}
                </div>
                <p className="briefing-library-note">Editorial learning paths use dated sources and open into the Focus Nexus for further exploration.</p>
            </aside>

            <div className="briefing-stage" style={{ '--tour-color': tour.color }}>
                <header className="briefing-stage-header">
                    <div>
                        <span className="briefing-kicker">EDITORIAL BRIEFING{tour.updatedAt ? ` · AS OF ${tour.updatedAt}` : ''}</span>
                        <h1>{tour.title}</h1>
                        <p>{tour.subtitle}</p>
                    </div>
                    <div className="briefing-progress-label">STEP {stepIndex + 1} / {tour.waypoints.length}</div>
                </header>

                <div className="briefing-progress" aria-label={`Step ${stepIndex + 1} of ${tour.waypoints.length}`}>
                    {tour.waypoints.map((item, index) => (
                        <button
                            key={`${item.nodeId}-${index}`}
                            type="button"
                            className={index === stepIndex ? 'active' : index < stepIndex ? 'complete' : ''}
                            onClick={() => setStepIndex(index)}
                            aria-label={`Go to step ${index + 1}: ${item.title}`}
                            aria-current={index === stepIndex ? 'step' : undefined}
                        >
                            <span>{index + 1}</span>
                            <small>{NEXUS_ACTORS[item.nodeId]?.shortName || item.nodeId}</small>
                        </button>
                    ))}
                </div>

                <div className="briefing-focus-card">
                    <div className="briefing-actor-mark" style={{ '--actor-color': actor?.color || tour.color }}>
                        <span>{actor?.shortName || waypoint.nodeId}</span>
                        <small>{actor?.type || 'Actor'}</small>
                    </div>
                    <div className="briefing-narrative">
                        <span className="briefing-step-label">{actor?.region || 'Global'} · {waypoint.title}</span>
                        <h2>{waypoint.title}</h2>
                        <p>{waypoint.narration}</p>
                        {waypoint.focusQuestion && <blockquote>{waypoint.focusQuestion}</blockquote>}
                    </div>
                </div>

                <div className="briefing-evidence">
                    <div>
                        <h3>Evidence and currency</h3>
                        <p>{tour.sources?.length ? `${tour.sources.length} official or primary sources · ${tour.confidence || 'unrated'} source confidence.` : 'Source review is required before this briefing is presented as current intelligence.'}</p>
                        {tour.issueDimensions?.length > 0 && <p className="briefing-issues">{tour.issueDimensions.join(' · ')}</p>}
                        {tour.uncertainty && <p className="briefing-uncertainty"><strong>Uncertainty:</strong> {tour.uncertainty}</p>}
                    </div>
                    {tour.sources?.length > 0 && (
                        <ul>
                            {tour.sources.map(source => (
                                <li key={source.url}>
                                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                                    <span>{source.publisher}{source.publishedAt ? ` · ${source.publishedAt}` : ''}{source.perspective ? ` · ${source.perspective}` : ''}</span>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <footer className="briefing-controls">
                    <button type="button" onClick={() => move(-1)} disabled={stepIndex === 0}>← Previous</button>
                    <button type="button" className="briefing-explore" onClick={() => onExploreNode(waypoint.nodeId, tour.id)}>Explore this actor in Nexus</button>
                    <button type="button" onClick={() => move(1)} disabled={stepIndex === tour.waypoints.length - 1}>Next →</button>
                </footer>
            </div>
        </section>
    );
}

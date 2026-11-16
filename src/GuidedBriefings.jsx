import { useEffect, useMemo, useRef, useState } from 'react';
import { GUIDED_TOURS, ARCHIVED_GUIDED_TOURS, ALL_GUIDED_TOURS } from './nexusTours';
import { NEXUS_ACTORS } from './nexusFocusData';
import { isReviewOverdue } from './navigationState.mjs';
import { indexSourceHealth, shouldPreferAlternate, sourceHealthLabel } from './sourceHealth.mjs';
import './GuidedBriefings.css';

const INITIAL_LIBRARY_COUNT = 6;
const NARROW_LIBRARY_QUERY = '(max-width: 1100px)';

const isNarrowLibraryViewport = () => (
    typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia(NARROW_LIBRARY_QUERY).matches
);

const resolveStepIndex = (allTours, activeTours, tourId, nodeId, step) => {
    const requestedTour = allTours.find(item => item.id === tourId) || activeTours[0];
    const numericStep = Number(step);
    if (Number.isInteger(numericStep) && numericStep >= 1) {
        return Math.min(numericStep - 1, Math.max((requestedTour?.waypoints.length || 1) - 1, 0));
    }
    const actorIndex = requestedTour?.waypoints.findIndex(item => item.nodeId === nodeId) ?? -1;
    return actorIndex >= 0 ? actorIndex : 0;
};

function SourceCitation({ source, healthByUrl, supplemental = false }) {
    const health = healthByUrl.get(source.url);
    const healthLabel = sourceHealthLabel(health);
    const preferAlternate = shouldPreferAlternate(health);
    const alternates = Array.isArray(source.alternateUrls) ? source.alternateUrls : [];

    return (
        <li className={supplemental ? 'source-citation source-citation-supplemental' : 'source-citation'}>
            {((!supplemental && source.perspectiveType) || healthLabel) && (
                <div className="source-citation-header">
                    {!supplemental && source.perspectiveType && <strong className={`source-perspective source-perspective-${source.perspectiveType}`}>{source.perspectiveType}</strong>}
                    {healthLabel && <em className={`source-health source-health-${health.status}`}>{healthLabel}{health.httpStatus ? ` · ${health.httpStatus}` : ''}</em>}
                </div>
            )}
            <div className="source-citation-main">
                <a className="source-title" href={source.url} target="_blank" rel="noopener noreferrer">{source.title}<span aria-hidden="true"> ↗</span></a>
                <span className="source-meta">{source.publisher}{source.dateLabel ? ` · ${source.dateLabel}` : ''}</span>
                {source.perspective && <p className="source-perspective-copy">{source.perspective}</p>}
                {source.supports && <p className="source-supports"><strong>Why this source is included:</strong> {source.supports}</p>}
                {alternates.length > 0 && (
                    <div className="source-actions">
                        {alternates.map(alternate => (
                            <a
                                className={`source-alternate ${preferAlternate ? 'recommended' : ''}`}
                                href={alternate.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                key={alternate.url}
                            >
                                {preferAlternate ? 'Recommended fallback: ' : 'Alternate: '}{alternate.label || 'Open alternate source'} ↗
                            </a>
                        ))}
                    </div>
                )}
            </div>
        </li>
    );
}

export default function GuidedBriefings({
    initialTourId,
    initialNodeId,
    initialStep,
    onExploreNode,
    onRouteChange,
    activeTours = GUIDED_TOURS,
    archivedTours = ARCHIVED_GUIDED_TOURS,
}) {
    const allTours = useMemo(
        () => (activeTours === GUIDED_TOURS && archivedTours === ARCHIVED_GUIDED_TOURS
            ? ALL_GUIDED_TOURS
            : [...activeTours, ...archivedTours]),
        [activeTours, archivedTours]
    );
    const isValidTourId = useMemo(() => {
        const ids = new Set(allTours.map(item => item.id));
        return id => ids.has(id);
    }, [allTours]);

    const [tourId, setTourId] = useState(() => (isValidTourId(initialTourId) ? initialTourId : activeTours[0]?.id));
    const [stepIndex, setStepIndex] = useState(() => resolveStepIndex(allTours, activeTours, initialTourId, initialNodeId, initialStep));
    const [librarySearch, setLibrarySearch] = useState('');
    const [regionFilter, setRegionFilter] = useState('all');
    const [issueFilter, setIssueFilter] = useState('all');
    const [showArchived, setShowArchived] = useState(false);
    const [sourceHealth, setSourceHealth] = useState(null);
    const [libraryOpen, setLibraryOpen] = useState(() => !isNarrowLibraryViewport());
    const [visibleCaseCount, setVisibleCaseCount] = useState(INITIAL_LIBRARY_COUNT);
    const stageHeadingRef = useRef(null);
    const progressRef = useRef(null);

    const tour = useMemo(() => allTours.find(item => item.id === tourId) || activeTours[0], [allTours, activeTours, tourId]);
    const waypoint = tour?.waypoints[stepIndex];
    const actor = waypoint ? NEXUS_ACTORS[waypoint.nodeId] : null;
    const perspectiveLabel = waypoint?.perspectiveLabel || actor?.shortName || waypoint?.nodeId;
    const isArchivedTour = tour?.status === 'archived';
    const reviewOverdue = !isArchivedTour && isReviewOverdue(tour?.reviewBy);

    const catalogTours = useMemo(
        () => (showArchived ? allTours : activeTours),
        [showArchived, allTours, activeTours]
    );
    const regionOptions = useMemo(() => [...new Set(catalogTours
        .map(item => item.coverageRegion || item.regionTags?.[0])
        .filter(Boolean))].sort(), [catalogTours]);
    const issueOptions = useMemo(() => [...new Set(catalogTours
        .map(item => item.broadCategory)
        .filter(Boolean))].sort(), [catalogTours]);

    useEffect(() => {
        if (regionFilter !== 'all' && !regionOptions.includes(regionFilter)) {
            setRegionFilter('all');
        }
        if (issueFilter !== 'all' && !issueOptions.includes(issueFilter)) {
            setIssueFilter('all');
        }
    }, [regionFilter, regionOptions, issueFilter, issueOptions]);
    const visibleTours = useMemo(() => {
        const query = librarySearch.trim().toLowerCase();
        return catalogTours.filter(item => {
            const region = item.coverageRegion || item.regionTags?.[0];
            if (regionFilter !== 'all' && region !== regionFilter) return false;
            if (issueFilter !== 'all' && item.broadCategory !== issueFilter) return false;
            if (!query) return true;
            return [
                item.title,
                item.subtitle,
                ...(item.regionTags || []),
                ...(item.issueDimensions || []),
                ...(item.actors || []),
                ...(item.sources || []).map(source => `${source.publisher} ${source.title}`),
            ].join(' ').toLowerCase().includes(query);
        });
    }, [catalogTours, librarySearch, regionFilter, issueFilter]);
    const healthByUrl = useMemo(() => indexSourceHealth(sourceHealth), [sourceHealth]);
    const displayedTours = visibleTours.slice(0, visibleCaseCount);
    const remainingTourCount = Math.max(visibleTours.length - displayedTours.length, 0);

    useEffect(() => {
        const controller = new AbortController();
        fetch('/.netlify/functions/source-health', { signal: controller.signal })
            .then(response => response.ok ? response.json() : null)
            .then(snapshot => { if (snapshot) setSourceHealth(snapshot); })
            .catch(() => {});
        return () => controller.abort();
    }, []);

    useEffect(() => {
        if (!isValidTourId(initialTourId)) return;
        setTourId(initialTourId);
        setStepIndex(resolveStepIndex(allTours, activeTours, initialTourId, initialNodeId, initialStep));
    }, [isValidTourId, allTours, activeTours, initialTourId, initialNodeId, initialStep]);

    useEffect(() => {
        setVisibleCaseCount(INITIAL_LIBRARY_COUNT);
    }, [librarySearch, regionFilter, issueFilter]);

    useEffect(() => {
        const activeStep = progressRef.current?.querySelector('.active');
        if (!activeStep) return;
        const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        activeStep.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'nearest',
            inline: 'center',
        });
    }, [stepIndex, tour?.id]);

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
        if (isNarrowLibraryViewport()) {
            setLibraryOpen(false);
            window.requestAnimationFrame(() => stageHeadingRef.current?.focus());
        }
    };

    const move = delta => setStepIndex(index => Math.min(Math.max(index + delta, 0), tour.waypoints.length - 1));

    return (
        <section
            className={`guided-briefings ${libraryOpen ? '' : 'library-collapsed'}`.trim()}
            aria-label="Guided geopolitical briefings"
            onKeyDown={event => {
                if (event.target.closest('button, a, input, select, textarea, [contenteditable="true"]')) return;
                if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1); }
                if (event.key === 'ArrowRight') { event.preventDefault(); move(1); }
            }}
        >
            <aside id="briefing-case-library" className="briefing-library" aria-label="Guided briefing case library" hidden={!libraryOpen}>
                <div className="briefing-library-heading">
                    <span>GUIDED BRIEFINGS</span>
                    <p>Explore {activeTours.length} sourced, multi-perspective cases.</p>
                    <button
                        type="button"
                        className="briefing-library-close"
                        onClick={() => setLibraryOpen(false)}
                        aria-controls="briefing-case-library"
                        aria-expanded={libraryOpen}
                    >
                        Close library
                    </button>
                </div>
                <div className="briefing-library-tools" role="search" aria-label="Filter guided briefings">
                    <label>
                        <span>Search cases</span>
                        <input
                            type="search"
                            value={librarySearch}
                            onChange={event => setLibrarySearch(event.target.value)}
                            placeholder="Region, issue, actor, source…"
                        />
                    </label>
                    <div className="briefing-library-filters">
                        <label>
                            <span>Region</span>
                            <select value={regionFilter} onChange={event => setRegionFilter(event.target.value)}>
                                <option value="all">All regions</option>
                                {regionOptions.map(region => <option key={region} value={region}>{region}</option>)}
                            </select>
                        </label>
                        <label>
                            <span>Issue area</span>
                            <select value={issueFilter} onChange={event => setIssueFilter(event.target.value)}>
                                <option value="all">All issues</option>
                                {issueOptions.map(issue => <option key={issue} value={issue}>{issue}</option>)}
                            </select>
                        </label>
                    </div>
                    {archivedTours.length > 0 && (
                        <label className="briefing-archive-toggle">
                            <input
                                type="checkbox"
                                checked={showArchived}
                                onChange={event => setShowArchived(event.target.checked)}
                            />
                            <span>Show archived snapshots ({archivedTours.length})</span>
                        </label>
                    )}
                    <div className="briefing-results-status" role="status">
                        <span>
                            Showing {displayedTours.length} of {visibleTours.length} {visibleTours.length === 1 ? 'case' : 'cases'}
                        </span>
                        <div className="briefing-results-actions">
                            {remainingTourCount > 0 && (
                                <button
                                    type="button"
                                    aria-controls="briefing-case-list"
                                    onClick={() => setVisibleCaseCount(visibleTours.length)}
                                >
                                    Show all {visibleTours.length}
                                </button>
                            )}
                            {(librarySearch || regionFilter !== 'all' || issueFilter !== 'all') && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        setLibrarySearch('');
                                        setRegionFilter('all');
                                        setIssueFilter('all');
                                    }}
                                >Clear</button>
                            )}
                        </div>
                    </div>
                </div>
                <div id="briefing-case-list" className="briefing-tour-list">
                    {displayedTours.map(item => (
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
                            <small>{item.waypoints.length} steps · {item.coverageRegion || item.regionTags?.[0]} · {item.sources?.length || 0} views</small>
                        </button>
                    ))}
                    {visibleTours.length === 0 && (
                        <div className="briefing-library-empty">No cases match these filters.</div>
                    )}
                </div>
                {visibleTours.length > INITIAL_LIBRARY_COUNT && (
                    <div className="briefing-library-more-group">
                        <button
                            type="button"
                            className="briefing-library-more"
                            aria-controls="briefing-case-list"
                            onClick={() => setVisibleCaseCount(current => (
                                current >= visibleTours.length
                                    ? INITIAL_LIBRARY_COUNT
                                    : Math.min(current + INITIAL_LIBRARY_COUNT, visibleTours.length)
                            ))}
                        >
                            {remainingTourCount > 0
                                ? `Show ${Math.min(INITIAL_LIBRARY_COUNT, remainingTourCount)} more cases`
                                : 'Show fewer cases'}
                        </button>
                        {remainingTourCount > INITIAL_LIBRARY_COUNT && (
                            <button
                                type="button"
                                className="briefing-library-more briefing-library-more--all"
                                aria-controls="briefing-case-list"
                                onClick={() => setVisibleCaseCount(visibleTours.length)}
                            >
                                Show all {visibleTours.length}
                            </button>
                        )}
                    </div>
                )}
                <p className="briefing-library-note">Every case has three perspective-labelled readings, appears on the globe, and opens into the Focus Nexus.</p>
            </aside>

            <div className="briefing-stage" style={{ '--tour-color': tour.color }}>
                <div className="briefing-stage-toolbar">
                    <button
                        type="button"
                        className="briefing-library-toggle"
                        onClick={() => setLibraryOpen(value => !value)}
                        aria-controls="briefing-case-library"
                        aria-expanded={libraryOpen}
                    >
                        {libraryOpen ? 'Hide case library' : `Browse ${activeTours.length} cases`}
                    </button>
                </div>
                <header className="briefing-stage-header">
                    <div>
                        <span className="briefing-kicker">
                            {isArchivedTour ? 'ARCHIVED HISTORICAL SNAPSHOT' : 'EDITORIAL BRIEFING'}
                            {tour.updatedAt ? ` · AS OF ${tour.updatedAt}` : ''}
                        </span>
                        <h1 ref={stageHeadingRef} tabIndex="-1">{tour.title}</h1>
                        <p>{tour.subtitle}</p>
                    </div>
                    <div className="briefing-progress-label">STEP {stepIndex + 1} / {tour.waypoints.length}</div>
                </header>

                {isArchivedTour && (
                    <div className="briefing-archived-banner" role="status">
                        <div>
                            <strong>Archived historical snapshot{tour.archivedAt ? ` (${tour.archivedAt})` : ''}:</strong>{' '}
                            {tour.archivedReason || `Frozen as reviewed on ${tour.updatedAt} for syllabus continuity and longitudinal comparison.`}
                        </div>
                        {tour.supersededById && isValidTourId(tour.supersededById) && (
                            <button
                                type="button"
                                className="briefing-successor-btn"
                                onClick={() => chooseTour(tour.supersededById)}
                            >
                                Open current successor briefing →
                            </button>
                        )}
                    </div>
                )}

                <div ref={progressRef} className="briefing-progress" aria-label={`Step ${stepIndex + 1} of ${tour.waypoints.length}`}>
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
                            <small>{item.perspectiveLabel || NEXUS_ACTORS[item.nodeId]?.shortName || item.nodeId}</small>
                        </button>
                    ))}
                </div>

                <div className="briefing-focus-card">
                    <div className="briefing-actor-mark" style={{ '--actor-color': actor?.color || tour.color }}>
                        <span>{perspectiveLabel}</span>
                        <small>{waypoint.perspectiveType || actor?.type || 'Perspective'}</small>
                    </div>
                    <div className="briefing-narrative">
                        <span className="briefing-step-label">{perspectiveLabel} · {waypoint.title}</span>
                        <h2>{waypoint.title}</h2>
                        <p>{waypoint.narration}</p>
                        {waypoint.focusQuestion && <blockquote>{waypoint.focusQuestion}</blockquote>}
                    </div>
                </div>

                <div className="briefing-evidence">
                    <div>
                        <h3>Three-perspective reading set</h3>
                        <p>{tour.sources?.length ? `${tour.sources.length} core readings · ${tour.confidence || 'unrated'} evidence confidence.` : 'Source review is required before this briefing is presented as current intelligence.'}</p>
                        {tour.issueDimensions?.length > 0 && <p className="briefing-issues">{tour.issueDimensions.join(' · ')}</p>}
                        {!isArchivedTour && tour.reviewBy && (
                            <p className={`briefing-review-date ${reviewOverdue ? 'overdue' : ''}`}>
                                {reviewOverdue ? 'Source review overdue since' : 'Review by'} {tour.reviewBy}
                            </p>
                        )}
                        {tour.uncertainty && <p className="briefing-uncertainty"><strong>Uncertainty:</strong> {tour.uncertainty}</p>}
                    </div>
                    {tour.sources?.length > 0 && (
                        <div className="briefing-reading-list">
                            <ul>
                                {tour.sources.map(source => <SourceCitation key={source.url} source={source} healthByUrl={healthByUrl} />)}
                            </ul>
                            {tour.supplementalSources?.length > 0 && (
                                <details className="briefing-supplemental">
                                    <summary>{tour.supplementalSources.length} supplemental {tour.supplementalSources.length === 1 ? 'source' : 'sources'}</summary>
                                    <ul>
                                        {tour.supplementalSources.map(source => <SourceCitation key={source.url} source={source} healthByUrl={healthByUrl} supplemental />)}
                                    </ul>
                                </details>
                            )}
                        </div>
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

import { useId, useState } from 'react';
import { readStoredJson, writeStoredJson } from '../localState.mjs';

export const GO_DEEPER_STORAGE_KEY = 'gcc.briefings.goDeeperOpen';

const RATING_LABELS = { STRONG: 'Strong', MIXED: 'Mixed', WEAK: 'Weak' };
const CONCEPT_ORDER = ['power', 'sovereignty', 'legitimacy', 'interdependence'];
const CONCEPT_TITLES = { power: 'Power', sovereignty: 'Sovereignty', legitimacy: 'Legitimacy', interdependence: 'Interdependence' };
const CITE_MARKER_REGEX = /\[\s*(\d+(?:\s*,\s*\d+)*)\s*\]/g;

export function splitNarration(narration) {
    return String(narration || '')
        .split(/\n\s*\n/)
        .map(part => part.trim())
        .filter(Boolean);
}

export function buildSourceIndex(tour) {
    const index = new Map();
    let counter = 0;
    const allSources = [
        ...(tour?.sources || []).map(source => ({ source, isSupplemental: false })),
        ...(tour?.supplementalSources || []).map(source => ({ source, isSupplemental: true })),
    ];
    for (const { source, isSupplemental } of allSources) {
        if (source?.url && !index.has(source.url)) {
            counter += 1;
            index.set(source.url, { ...source, number: counter, isSupplemental });
        }
    }
    return index;
}

export function buildSourceByNumber(sourceIndex) {
    const byNumber = new Map();
    if (!sourceIndex) return byNumber;
    for (const entry of sourceIndex.values()) {
        if (Number.isInteger(entry.number)) byNumber.set(entry.number, entry);
    }
    return byNumber;
}

export function renderCitedText(text, sourceByNumber, onJumpToSource, { linkCitations = true } = {}) {
    const raw = String(text || '');
    if (!raw.includes('[')) return raw;
    const parts = [];
    let lastIndex = 0;
    for (const match of raw.matchAll(CITE_MARKER_REGEX)) {
        const matchStart = match.index ?? 0;
        if (matchStart > lastIndex) {
            parts.push(raw.slice(lastIndex, matchStart));
        }
        const numbers = match[1]
            .split(',')
            .map(token => Number.parseInt(token.trim(), 10))
            .filter(num => Number.isInteger(num) && num > 0);
        if (numbers.length === 0) {
            parts.push(match[0]);
        } else {
            parts.push(
                <sup key={`cite-${matchStart}`} className="cite-group">
                    {linkCitations ? (
                        numbers.map((num, idx) => {
                            const src = sourceByNumber?.get(num);
                            const label = src
                                ? `Source ${num}: ${src.publisher}${src.dateLabel ? `, ${src.dateLabel}` : ''}`
                                : `Source ${num}`;
                            return (
                                <span key={num}>
                                    {idx > 0 && <span className="cite-sep">, </span>}
                                    <a
                                        href={`#briefing-source-${num}`}
                                        className="cite-marker"
                                        title={label}
                                        aria-label={label}
                                        onClick={event => onJumpToSource?.(event, num, src)}
                                    >
                                        [{num}]
                                    </a>
                                </span>
                            );
                        })
                    ) : (
                        <>
                            [{numbers.map((num, idx) => (
                                <span key={num}>{idx > 0 ? ', ' : ''}{num}</span>
                            ))}]
                        </>
                    )}
                </sup>
            );
        }
        lastIndex = matchStart + match[0].length;
    }
    if (lastIndex < raw.length) {
        parts.push(raw.slice(lastIndex));
    }
    return parts;
}

export function SourceLinks({ urls, sourceIndex, label = 'Source' }) {
    const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    if (list.length === 0) return null;
    return (
        <span className="depth-source-links">
            {label}{list.length > 1 ? 's' : ''}:{' '}
            {list.map((url, index) => {
                const source = sourceIndex.get(url);
                const prefix = source?.number ? `[${source.number}] ` : '';
                return (
                    <span key={url}>
                        {index > 0 && '; '}
                        <a href={url} target="_blank" rel="noopener noreferrer">
                            {source ? `${prefix}${source.publisher}${source.dateLabel ? `, ${source.dateLabel}` : ''}` : 'Open source'}
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    </span>
                );
            })}
        </span>
    );
}

export function StepNarration({ narration, sourceByNumber, onJumpToSource }) {
    const paragraphs = splitNarration(narration);
    const [expanded, setExpanded] = useState(false);
    const moreId = useId();
    if (paragraphs.length === 0) return null;
    const [first, ...rest] = paragraphs;
    return (
        <div className="briefing-narration">
            <p>{renderCitedText(first, sourceByNumber, onJumpToSource)}</p>
            {rest.length > 0 && (
                <>
                    <div id={moreId} hidden={!expanded}>
                        {rest.map((paragraph, index) => (
                            <p key={index}>{renderCitedText(paragraph, sourceByNumber, onJumpToSource)}</p>
                        ))}
                    </div>
                    <button
                        type="button"
                        className="briefing-read-more"
                        aria-expanded={expanded}
                        aria-controls={moreId}
                        onClick={() => setExpanded(value => !value)}
                    >
                        {expanded ? 'Show less' : 'Read more: what this shows'}
                    </button>
                </>
            )}
        </div>
    );
}

export function KeyFigures({ figures, sourceIndex }) {
    if (!Array.isArray(figures) || figures.length === 0) return null;
    return (
        <section className="briefing-key-figures" aria-label="Key sourced figures">
            <ul className="key-figures-grid">
                {figures.map(figure => (
                    <li key={`${figure.value}-${figure.label}`} className="key-figure-tile">
                        <strong>
                            {figure.value}
                            {figure.unit ? <span className="key-figure-unit"> {figure.unit}</span> : null}
                        </strong>
                        <span>{figure.label}</span>
                        <small>As of {figure.asOf}</small>
                        <SourceLinks urls={figure.sourceUrl} sourceIndex={sourceIndex} />
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function InfluenceCheck({ stages, sourceIndex }) {
    if (!Array.isArray(stages) || stages.length === 0) return null;
    return (
        <section className="briefing-influence" aria-labelledby="briefing-influence-title">
            <div className="depth-section-heading">
                <h3 id="briefing-influence-title">Influence check</h3>
                <p>Did rules on paper change people's lives? <strong>Editorial assessment</strong> based on the cited sources, not a source's own verdict.</p>
            </div>
            <ol className="influence-steps">
                {stages.map((stage, index) => (
                    <li key={stage.stage} className={`influence-step rating-${String(stage.rating).toLowerCase()}`}>
                        <span className="influence-step-number" aria-hidden="true">{index + 1}</span>
                        <div>
                            <h4>{stage.stage}</h4>
                            <span className="influence-rating">
                                <span className="sr-only">Rating: </span>{RATING_LABELS[stage.rating] || stage.rating}
                            </span>
                            <p>{stage.evidence}</p>
                            <SourceLinks urls={stage.sourceUrls} sourceIndex={sourceIndex} />
                        </div>
                    </li>
                ))}
            </ol>
        </section>
    );
}

export function ConceptLens({ lens }) {
    const entries = CONCEPT_ORDER.filter(key => lens?.[key]);
    if (entries.length === 0) return null;
    return (
        <section className="briefing-concept-lens" aria-labelledby="briefing-concept-lens-title">
            <div className="depth-section-heading">
                <h3 id="briefing-concept-lens-title">Concept lens</h3>
                <p>How the four Unit 1 core concepts apply to this case.</p>
            </div>
            <ul className="concept-cards">
                {entries.map(key => (
                    <li key={key} className={`concept-card concept-${key}`}>
                        <h4>{CONCEPT_TITLES[key]}</h4>
                        <p>{lens[key]}</p>
                    </li>
                ))}
            </ul>
        </section>
    );
}

export function findRelatedTimelineIndex(events, activeWaypoint) {
    if (!Array.isArray(events) || events.length === 0 || !activeWaypoint) return -1;
    if (activeWaypoint.relatedTimelineDate) {
        const explicitIndex = events.findIndex(event => event.date === activeWaypoint.relatedTimelineDate);
        if (explicitIndex >= 0) return explicitIndex;
    }
    const narration = String(activeWaypoint.narration || '');
    if (!narration) return -1;
    let bestIndex = -1;
    let bestScore = 0;
    events.forEach((event, index) => {
        const rawDate = String(event.date || '').trim();
        if (!rawDate) return;
        const yearMatch = rawDate.match(/\b(19|20)\d{2}\b/);
        if (!yearMatch) return;
        if (rawDate.length >= 7 && narration.includes(rawDate)) {
            if (3 > bestScore) { bestScore = 3; bestIndex = index; }
            return;
        }
        if (narration.includes(yearMatch[0]) && 1 > bestScore) {
            bestScore = 1;
            bestIndex = index;
        }
    });
    return bestIndex;
}

function TimelineStrip({ events, updatedAt, reviewBy, activeWaypoint, sourceIndex }) {
    if (!Array.isArray(events) || events.length === 0) return null;
    const relatedIndex = findRelatedTimelineIndex(events, activeWaypoint);
    return (
        <section className="depth-block" aria-labelledby="depth-timeline-title">
            <h4 id="depth-timeline-title">Timeline</h4>
            <ol className="timeline-strip">
                {events.map((event, index) => {
                    const related = index === relatedIndex;
                    return (
                        <li key={`${event.date}-${event.label}`} className={related ? 'is-step-relevant' : ''}>
                            <time dateTime={event.date}>
                                {event.date}
                                {related ? ' · Related to this step' : ''}
                            </time>
                            <p>{event.label}</p>
                            <SourceLinks urls={event.sourceUrl} sourceIndex={sourceIndex} />
                        </li>
                    );
                })}
                {updatedAt && (
                    <li className="timeline-marker">
                        <time dateTime={updatedAt}>{updatedAt}</time>
                        <p>Last reviewed</p>
                    </li>
                )}
                {reviewBy && (
                    <li className="timeline-marker">
                        <time dateTime={reviewBy}>{reviewBy}</time>
                        <p>Review by</p>
                    </li>
                )}
            </ol>
        </section>
    );
}

export function GoDeeper({ tour, activeWaypoint, sourceIndex, sourceByNumber, onJumpToSource }) {
    const hasContent = Boolean(
        tour?.background
        || tour?.timeline?.length
        || tour?.keyTerms?.length
        || tour?.debate?.length
        || tour?.watchFor?.length
        || tour?.examPrompts?.length
        || tour?.essayBuilder
    );
    const [open, setOpen] = useState(() => Boolean(readStoredJson(GO_DEEPER_STORAGE_KEY, false)));
    const panelId = useId();
    if (!hasContent) return null;

    const toggle = () => {
        const next = !open;
        setOpen(next);
        writeStoredJson(GO_DEEPER_STORAGE_KEY, next);
    };

    const backgroundParagraphs = splitNarration(tour.background);

    return (
        <section className="briefing-go-deeper" aria-label="Go deeper">
            <button
                type="button"
                className="go-deeper-toggle"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={toggle}
            >
                <span>{open ? '▾' : '▸'} Go deeper</span>
                <small>Background · timeline · key terms · the debate · what to watch · discussion questions</small>
            </button>
            <div id={panelId} className="go-deeper-panel" hidden={!open}>
                {backgroundParagraphs.length > 0 && (
                    <section className="depth-block" aria-labelledby="depth-background-title">
                        <h4 id="depth-background-title">Background</h4>
                        {backgroundParagraphs.map((paragraph, index) => (
                            <p key={index} className="depth-prose">
                                {renderCitedText(paragraph, sourceByNumber, onJumpToSource)}
                            </p>
                        ))}
                        <SourceLinks urls={tour.backgroundSources} sourceIndex={sourceIndex} />
                    </section>
                )}
                <TimelineStrip
                    events={tour.timeline}
                    updatedAt={tour.updatedAt}
                    reviewBy={tour.reviewBy}
                    activeWaypoint={activeWaypoint}
                    sourceIndex={sourceIndex}
                />
                {tour.keyTerms?.length > 0 && (
                    <section className="depth-block" aria-labelledby="depth-terms-title">
                        <h4 id="depth-terms-title">Key terms</h4>
                        <dl className="key-terms">
                            {tour.keyTerms.map(term => (
                                <div key={term.term}>
                                    <dt>{term.term}</dt>
                                    <dd>
                                        {term.definition}{' '}
                                        <SourceLinks urls={term.sourceUrl} sourceIndex={sourceIndex} />
                                    </dd>
                                </div>
                            ))}
                        </dl>
                    </section>
                )}
                {tour.debate?.length > 0 && (
                    <section className="depth-block" aria-labelledby="depth-debate-title">
                        <h4 id="depth-debate-title">The debate</h4>
                        <p className="depth-note">Attributed positions for essay practice. The site gives no verdict.</p>
                        <ul className="debate-list">
                            {tour.debate.map((pair, index) => (
                                <li key={index} className="debate-pair">
                                    <div className="debate-side">
                                        <span className="debate-by">{pair.claimBy}</span>
                                        <p>{pair.claim}</p>
                                    </div>
                                    <div className="debate-side debate-counter">
                                        <span className="debate-by">{pair.counterBy}</span>
                                        <p>{pair.counterClaim}</p>
                                    </div>
                                    <SourceLinks urls={pair.sourceUrls} sourceIndex={sourceIndex} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {tour.watchFor?.length > 0 && (
                    <section className="depth-block" aria-labelledby="depth-watch-title">
                        <h4 id="depth-watch-title">What to watch</h4>
                        <p className="depth-note">Scheduled, observable indicators. Not predictions.</p>
                        <ul className="watch-list">
                            {tour.watchFor.map(entry => (
                                <li key={`${entry.date}-${entry.indicator}`}>
                                    <strong>{entry.date}</strong> {entry.indicator}{' '}
                                    <SourceLinks urls={entry.sourceUrl} sourceIndex={sourceIndex} />
                                </li>
                            ))}
                        </ul>
                    </section>
                )}
                {tour.examPrompts?.length > 0 && (
                    <section className="depth-block" aria-labelledby="depth-prompts-title">
                        <h4 id="depth-prompts-title">Discussion questions</h4>
                        <ol className="exam-prompts">
                            {tour.examPrompts.map(prompt => <li key={prompt}>{prompt}</li>)}
                        </ol>
                        {tour.essayBuilder && (
                            <div className="essay-builder">
                                <h5>Worked paragraph: Claim, Evidence, Counter-claim, Judgment</h5>
                                <p className="depth-note">Answers: “{tour.essayBuilder.prompt}”</p>
                                <dl>
                                    <div><dt>1 · Claim</dt><dd>{tour.essayBuilder.claim}</dd></div>
                                    <div><dt>2 · Evidence</dt><dd>{tour.essayBuilder.evidence}</dd></div>
                                    <div><dt>3 · Counter-claim</dt><dd>{tour.essayBuilder.counterClaim}</dd></div>
                                    <div><dt>4 · Judgment</dt><dd>{tour.essayBuilder.judgment}</dd></div>
                                </dl>
                                <SourceLinks urls={tour.essayBuilder.sourceUrls} sourceIndex={sourceIndex} />
                            </div>
                        )}
                    </section>
                )}
            </div>
        </section>
    );
}

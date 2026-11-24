import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { BRIEFING_ACTORS } from '../briefingActors';
import { ALL_CASE_STUDIES_2026 } from '../cases/index.mjs';
import { IB_THEME_LABELS } from '../cases/schema.mjs';
import { getCaseReviewNotice } from '../navigationState.mjs';
import {
    buildSourceByNumber,
    buildSourceIndex,
    renderCitedText as renderDepthCitedText,
    splitNarration,
} from './BriefingDepth';
import {
    buildCasePrintTitle,
    buildCasePrintUrl,
    buildListPrintTitle,
    buildPageUrl,
    collectSanitizedSources,
    FORECAST_EXPORT_LIMIT,
    formatExportDate,
    isSamePrintText,
    sanitizeListItems,
} from '../utils/briefingPrint.mjs';
import '../briefingPrint.css';

const CONCEPT_ORDER = ['power', 'sovereignty', 'legitimacy', 'interdependence'];
const CONCEPT_TITLES = {
    power: 'Power',
    sovereignty: 'Sovereignty',
    legitimacy: 'Legitimacy',
    interdependence: 'Interdependence',
};
const RATING_LABELS = { STRONG: 'Strong', MIXED: 'Mixed', WEAK: 'Weak' };

const splitParagraphs = splitNarration;
const renderCitedText = (text, sourceByNumber) => renderDepthCitedText(
    text,
    sourceByNumber,
    undefined,
    { linkCitations: false },
);

function PrintSourceRefs({ urls, sourceByRawUrl, label = 'Sources' }) {
    const rawList = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
    if (rawList.length === 0) return null;
    const resolved = [];
    const seen = new Set();
    for (const rawUrl of rawList) {
        const entry = sourceByRawUrl.get(String(rawUrl).trim());
        const key = entry ? `#${entry.number}` : rawUrl;
        if (seen.has(key)) continue;
        seen.add(key);
        if (entry) {
            resolved.push(`[${entry.number}] ${entry.publisher}${entry.dateLabel ? `, ${entry.dateLabel}` : ''}`);
        }
    }
    if (resolved.length === 0) return null;
    return (
        <span className="gcc-print-evidence-note">
            <strong>{label}:</strong> {resolved.join('; ')}
        </span>
    );
}

function CasePrintSourceItem({ src }) {
    return (
        <li className="gcc-print-source-item">
            <div className="gcc-print-source-head">
                {src.publisher || 'Source'}
                {src.dateLabel ? ` · ${src.dateLabel}` : ''}
                {src.isSupplemental
                    ? ' · Supplemental source'
                    : src.perspectiveType ? ` · ${src.perspectiveType} perspective` : ''}
            </div>
            {src.title && (
                <span className="gcc-print-source-title">
                    {src.safeUrl ? (
                        <a href={src.safeUrl} target="_blank" rel="noopener noreferrer">{src.title}</a>
                    ) : src.title}
                </span>
            )}
            {src.perspective && <p className="gcc-print-source-note">{src.perspective}</p>}
            {src.supports && (
                <p className="gcc-print-source-note">
                    <strong>Relevance:</strong> {src.supports}
                </p>
            )}
            {src.safeUrl && (
                <div className="gcc-print-source-url">{src.safeUrl}</div>
            )}
        </li>
    );
}

function ListPrintItem({ item }) {
    return (
        <li className="gcc-print-list-item">
            <p className="gcc-print-list-item-head">
                {String(item.index).padStart(2, '0')} · {item.category}
            </p>
            <h2>{item.subject}</h2>
            <p><strong>Players:</strong> {item.players}</p>
            <p><strong>Impact:</strong> {item.impact}</p>
            <p><strong>Timeline:</strong> {item.timeline}</p>
            {item.safeUrl && (
                <p className="gcc-print-source-url">
                    <strong>Source:</strong>{' '}
                    <a href={item.safeUrl} target="_blank" rel="noopener noreferrer">
                        {item.sourceLabel || item.safeUrl}
                    </a>{' '}
                    ({item.safeUrl})
                </p>
            )}
        </li>
    );
}

function CasePrintFooter({ hasLocations, usesNasaImagery }) {
    return (
        <footer className="gcc-print-footer">
            <p><strong>2026 Global Command Center — IB Global Politics</strong></p>
            <p>
                This briefing is an educational summary compiled from the cited sources for classroom study and exam preparation.
            </p>
            {hasLocations && (
                <p>
                    Locator map country boundaries are rendered from the bundled Natural Earth 1:110m dataset.
                    {usesNasaImagery ? ' Map imagery credit: NASA Earth Observatory.' : ''}
                </p>
            )}
        </footer>
    );
}

export function CaseBriefingPrintContent({
    tour,
    exportedAt = formatExportDate(),
    pageUrl,
    MapComponent = null,
    onMapReady,
}) {
    if (!tour) return null;

    const screenSourceIndex = buildSourceIndex(tour);
    const sourceByNumber = buildSourceByNumber(screenSourceIndex);
    const sources = collectSanitizedSources(tour);
    const sourceByRawUrl = new Map(sources.filter(src => src.rawUrl).map(src => [src.rawUrl, src]));

    const canonicalUrl = pageUrl || buildCasePrintUrl(tour.id);
    const regionLabel = tour.coverageRegion || (tour.regionTags || []).filter(Boolean).join(', ');
    const issueLabel = tour.issueLens || tour.broadCategory;
    const isArchived = tour.status === 'archived';
    const reviewNotice = !isArchived ? getCaseReviewNotice(tour) : null;
    const versionLabel = tour.briefingVersion === 2
        ? 'v2 · Full multi-perspective briefing'
        : 'v1 · Core briefing';
    const lastReviewedLabel = [
        tour.updatedAt || '',
        isArchived && tour.archivedAt ? `(Archived ${tour.archivedAt})` : '',
        reviewNotice ? `(${reviewNotice})` : '',
    ].filter(Boolean).join(' ');

    const duplicateCaution = isSamePrintText(tour.uncertainty, tour.editorialCaution);
    const showUncertaintyLine = Boolean(tour.uncertainty && !duplicateCaution);
    const showConfidenceSub = Boolean(tour.confidence || showUncertaintyLine);

    const hasAtGlance = Boolean(
        tour.statusSummary
        || tour.whyItMatters
        || tour.confidence
        || tour.uncertainty
        || tour.editorialCaution
    );

    const locations = Array.isArray(tour.map?.locations) ? tour.map.locations : [];
    const waypoints = Array.isArray(tour.waypoints) ? tour.waypoints : [];
    const influenceStages = Array.isArray(tour.influenceCheck) ? tour.influenceCheck : [];
    const backgroundParagraphs = splitParagraphs(tour.background);
    const timelineEvents = Array.isArray(tour.timeline) ? tour.timeline : [];
    const keyFigures = Array.isArray(tour.keyFigures) ? tour.keyFigures : [];
    const concepts = Array.isArray(tour.concepts) ? tour.concepts : [];
    const ibThemes = Array.isArray(tour.ibThemes) ? tour.ibThemes : [];
    const conceptLensEntries = CONCEPT_ORDER.filter(key => tour.conceptLens?.[key]);
    const keyTerms = Array.isArray(tour.keyTerms) ? tour.keyTerms : [];
    const debatePairs = Array.isArray(tour.debate) ? tour.debate : [];
    const watchForItems = Array.isArray(tour.watchFor) ? tour.watchFor : [];
    const relatedLinks = (Array.isArray(tour.relatedCases) ? tour.relatedCases : [])
        .map(link => {
            const target = ALL_CASE_STUDIES_2026.find(item => item.id === link.caseId);
            return target ? { ...link, title: target.title } : null;
        })
        .filter(Boolean);
    const examPrompts = Array.isArray(tour.examPrompts) ? tour.examPrompts : [];
    const hasEssayBuilder = Boolean(tour.essayBuilder);

    const hasSection5 = Boolean(backgroundParagraphs.length || timelineEvents.length || keyFigures.length);
    const hasSection6 = Boolean(concepts.length || ibThemes.length || conceptLensEntries.length || keyTerms.length);
    const hasSection7 = Boolean(debatePairs.length || watchForItems.length || relatedLinks.length);
    const hasSection8 = Boolean(examPrompts.length || hasEssayBuilder);
    const leadSources = sources.length > 1 ? sources.slice(0, -1) : [];
    const tailSource = sources.length > 0 ? sources[sources.length - 1] : null;

    return (
        <article className="gcc-print-doc gcc-print-doc--case" aria-label={`Printable briefing: ${tour.title}`}>
            {/* 1. Title block */}
            <header className="gcc-print-header">
                <p className="gcc-print-kicker">
                    {isArchived ? 'Global Command Center · Archived Case Briefing' : 'Global Command Center · Editorial Case Briefing'}
                </p>
                <h1>{tour.title}</h1>
                {tour.subtitle && <p className="gcc-print-subtitle">{tour.subtitle}</p>}
                <table className="gcc-print-meta-table">
                    <tbody>
                        {regionLabel && (
                            <tr>
                                <th scope="row">Region</th>
                                <td>{regionLabel}</td>
                            </tr>
                        )}
                        {issueLabel && (
                            <tr>
                                <th scope="row">Issue lens</th>
                                <td>
                                    {issueLabel}
                                    {tour.issueDimensions?.length ? ` (${tour.issueDimensions.join(' · ')})` : ''}
                                </td>
                            </tr>
                        )}
                        <tr>
                            <th scope="row">Briefing version</th>
                            <td>{versionLabel}</td>
                        </tr>
                        {lastReviewedLabel && (
                            <tr>
                                <th scope="row">Last reviewed</th>
                                <td>{lastReviewedLabel}</td>
                            </tr>
                        )}
                        <tr>
                            <th scope="row">Exported</th>
                            <td>{exportedAt}</td>
                        </tr>
                        <tr>
                            <th scope="row">Briefing URL</th>
                            <td className="gcc-print-meta-url">{canonicalUrl}</td>
                        </tr>
                    </tbody>
                </table>
            </header>

            {/* 2. At a glance */}
            {hasAtGlance && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-glance">
                    <h2 id="gcc-print-glance">At a glance</h2>
                    {tour.statusSummary && (
                        <div className="gcc-print-subsection">
                            <h3>Status summary</h3>
                            <p>{tour.statusSummary}</p>
                        </div>
                    )}
                    {tour.whyItMatters && (
                        <div className="gcc-print-subsection">
                            <h3>Why it matters</h3>
                            <p>{tour.whyItMatters}</p>
                        </div>
                    )}
                    {showConfidenceSub && (
                        <div className="gcc-print-subsection">
                            <h3>Confidence and uncertainty</h3>
                            {tour.confidence && <p><strong>Evidence confidence:</strong> {tour.confidence}</p>}
                            {showUncertaintyLine && <p><strong>Uncertainty:</strong> {tour.uncertainty}</p>}
                        </div>
                    )}
                    {tour.editorialCaution && (
                        <div className="gcc-print-callout">
                            <p>
                                <strong>{duplicateCaution ? 'Uncertainty and editorial caution:' : 'Editorial caution:'}</strong>{' '}
                                {tour.editorialCaution}
                            </p>
                        </div>
                    )}
                </section>
            )}

            {/* 3. Where */}
            {locations.length > 0 && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-where">
                    <h2 id="gcc-print-where">Where</h2>
                    {MapComponent && tour.map && (
                        <div className="gcc-print-figure">
                            <MapComponent
                                map={tour.map}
                                color={tour.color}
                                title={tour.title}
                                onReady={onMapReady}
                            />
                        </div>
                    )}
                    <ol className="gcc-print-locations">
                        {locations.map((loc, idx) => (
                            <li key={`${loc.label}-${idx}`}>
                                <strong>{loc.label}</strong>
                                {loc.role ? ` — ${loc.role}` : ''}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            {/* 4. The briefing */}
            {(waypoints.length > 0 || influenceStages.length > 0) && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-briefing">
                    <h2 id="gcc-print-briefing">The briefing</h2>
                    {waypoints.map((wp, index) => {
                        const actor = BRIEFING_ACTORS[wp.nodeId];
                        const perspectiveLabel = wp.perspectiveLabel || actor?.shortName || wp.nodeId;
                        const perspectiveType = wp.perspectiveType || actor?.type || 'other';
                        const paragraphs = splitParagraphs(wp.narration);
                        return (
                            <article key={`${wp.nodeId}-${index}`} className="gcc-print-step">
                                <div className="gcc-print-step-head">
                                    <div className="gcc-print-step-kicker">
                                        <span>Step {index + 1} of {waypoints.length}</span>
                                        <span className="gcc-print-badge">
                                            <span className={`gcc-print-swatch gcc-print-swatch--${perspectiveType}`} aria-hidden="true" />
                                            {perspectiveType}
                                        </span>
                                        {perspectiveLabel && <span>{perspectiveLabel}</span>}
                                        {wp.conceptInFocus && <span>· Concept in focus: {wp.conceptInFocus}</span>}
                                    </div>
                                    <h3>{wp.title}</h3>
                                </div>
                                {paragraphs.map((paragraph, pIdx) => (
                                    <p key={pIdx}>{renderCitedText(paragraph, sourceByNumber)}</p>
                                ))}
                                {wp.focusQuestion && (
                                    <blockquote className="gcc-print-focus-q">
                                        {wp.focusQuestion}
                                    </blockquote>
                                )}
                            </article>
                        );
                    })}

                    {influenceStages.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Influence check</h3>
                            <p className="gcc-print-note">
                                Editorial assessment of whether rules on paper changed people&apos;s lives, based on the cited sources.
                            </p>
                            <table className="gcc-print-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="gcc-print-table-col-narrow">Stage</th>
                                        <th scope="col" className="gcc-print-table-col-narrow">Rating</th>
                                        <th scope="col">Evidence and sources</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {influenceStages.map((stage, idx) => {
                                        const ratingKey = String(stage.rating || '').toLowerCase();
                                        return (
                                            <tr key={`${stage.stage}-${idx}`}>
                                                <td><strong>{idx + 1}. {stage.stage}</strong></td>
                                                <td>
                                                    <span className={`gcc-print-rating-dot gcc-print-rating-dot--${ratingKey}`} aria-hidden="true" />{' '}
                                                    {RATING_LABELS[stage.rating] || stage.rating}
                                                </td>
                                                <td>
                                                    <div>{stage.evidence}</div>
                                                    {stage.sourceUrls?.length > 0 && (
                                                        <PrintSourceRefs urls={stage.sourceUrls} sourceByRawUrl={sourceByRawUrl} />
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </section>
            )}

            {/* 5. Background, timeline and key figures */}
            {hasSection5 && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-context">
                    <h2 id="gcc-print-context">Background, timeline and key figures</h2>
                    {backgroundParagraphs.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Background</h3>
                            {backgroundParagraphs.map((paragraph, idx) => (
                                <p key={idx}>{renderCitedText(paragraph, sourceByNumber)}</p>
                            ))}
                            {tour.backgroundSources?.length > 0 && (
                                <p>
                                    <PrintSourceRefs urls={tour.backgroundSources} sourceByRawUrl={sourceByRawUrl} />
                                </p>
                            )}
                        </div>
                    )}
                    {timelineEvents.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Timeline</h3>
                            <table className="gcc-print-table">
                                <thead>
                                    <tr>
                                        <th scope="col" className="gcc-print-table-col-narrow">Date</th>
                                        <th scope="col">Milestone</th>
                                        <th scope="col" className="gcc-print-table-col-src">Source</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {timelineEvents.map((event, idx) => (
                                        <tr key={`${event.date}-${idx}`}>
                                            <td>{event.date}</td>
                                            <td>{event.label}</td>
                                            <td>
                                                {event.sourceUrl
                                                    ? <PrintSourceRefs urls={event.sourceUrl} sourceByRawUrl={sourceByRawUrl} label="Ref" />
                                                    : '—'}
                                            </td>
                                        </tr>
                                    ))}
                                    {tour.updatedAt && (
                                        <tr>
                                            <td>{tour.updatedAt}</td>
                                            <td>Last reviewed</td>
                                            <td>Editorial checkpoint</td>
                                        </tr>
                                    )}
                                    {!isArchived && tour.reviewBy && (
                                        <tr>
                                            <td>{tour.reviewBy}</td>
                                            <td>Review by</td>
                                            <td>Scheduled check</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                    {keyFigures.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Key figures</h3>
                            <ul className="gcc-print-figures-grid">
                                {keyFigures.map((fig, idx) => (
                                    <li key={`${fig.label}-${idx}`} className="gcc-print-key-figure">
                                        <span className="gcc-print-key-value">
                                            {fig.value}{fig.unit ? ` ${fig.unit}` : ''}
                                        </span>
                                        <span>{fig.label}</span>
                                        <span className="gcc-print-key-meta">
                                            {fig.asOf ? `As of ${fig.asOf}` : ''}
                                            {fig.asOf && fig.sourceUrl ? ' · ' : ''}
                                            {fig.sourceUrl && <PrintSourceRefs urls={fig.sourceUrl} sourceByRawUrl={sourceByRawUrl} label="Source" />}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            {/* 6. Concepts and themes */}
            {hasSection6 && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-concepts">
                    <h2 id="gcc-print-concepts">Concepts and themes</h2>
                    {concepts.length > 0 && (
                        <p className="gcc-print-tag-line">
                            <strong>Core concepts:</strong> {concepts.join(' · ')}
                        </p>
                    )}
                    {ibThemes.length > 0 && (
                        <p className="gcc-print-tag-line">
                            <strong>IB Global Politics themes:</strong> {ibThemes.map(t => IB_THEME_LABELS[t] || t).join(' · ')}
                        </p>
                    )}
                    {conceptLensEntries.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Concept lens</h3>
                            <ul className="gcc-print-concept-grid">
                                {conceptLensEntries.map(key => (
                                    <li key={key} className="gcc-print-concept-card">
                                        <h4>{CONCEPT_TITLES[key]}</h4>
                                        <p>{tour.conceptLens[key]}</p>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {keyTerms.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Key terms</h3>
                            <dl className="gcc-print-terms">
                                {keyTerms.map((entry, idx) => (
                                    <div key={`${entry.term}-${idx}`} className="gcc-print-term">
                                        <dt>{entry.term}</dt>
                                        <dd>
                                            {entry.definition}{' '}
                                            {entry.sourceUrl && (
                                                <PrintSourceRefs urls={entry.sourceUrl} sourceByRawUrl={sourceByRawUrl} label="Source" />
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}
                </section>
            )}

            {/* 7. Debate and what to watch */}
            {hasSection7 && (
                <section className="gcc-print-section" aria-labelledby="gcc-print-debate">
                    <h2 id="gcc-print-debate">Debate and what to watch</h2>
                    {debatePairs.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>The debate</h3>
                            <p className="gcc-print-note">Attributed positions for essay practice. The site gives no verdict.</p>
                            <ul className="gcc-print-debate-list">
                                {debatePairs.map((pair, idx) => (
                                    <li key={idx} className="gcc-print-debate-pair">
                                        <div>
                                            <h4>{pair.claimBy}</h4>
                                            <p>{pair.claim}</p>
                                        </div>
                                        <div>
                                            <h4>{pair.counterBy}</h4>
                                            <p>{pair.counterClaim}</p>
                                        </div>
                                        {pair.sourceUrls?.length > 0 && (
                                            <div className="gcc-print-debate-sources">
                                                <PrintSourceRefs urls={pair.sourceUrls} sourceByRawUrl={sourceByRawUrl} />
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {watchForItems.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>What to watch</h3>
                            <p className="gcc-print-note">Scheduled, observable indicators. Not predictions.</p>
                            <ul className="gcc-print-watch-list">
                                {watchForItems.map((entry, idx) => (
                                    <li key={`${entry.date}-${idx}`}>
                                        <strong>{entry.date}:</strong> {entry.indicator}{' '}
                                        {entry.sourceUrl && (
                                            <PrintSourceRefs urls={entry.sourceUrl} sourceByRawUrl={sourceByRawUrl} label="Source" />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {relatedLinks.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Compare with related briefings</h3>
                            <ul className="gcc-print-watch-list">
                                {relatedLinks.map(link => {
                                    const relatedUrl = buildCasePrintUrl(link.caseId, canonicalUrl);
                                    return (
                                        <li key={link.caseId}>
                                            <strong>{link.title}:</strong> {link.note}{' '}
                                            <span className="gcc-print-related-url">({relatedUrl})</span>
                                        </li>
                                    );
                                })}
                            </ul>
                        </div>
                    )}
                </section>
            )}

            {/* 8. Exam practice (starts on a new page for standalone handout printing) */}
            {hasSection8 && (
                <section className="gcc-print-section gcc-print-exam" aria-labelledby="gcc-print-exam">
                    <p className="gcc-print-handout-kicker">Exam Practice Handout · {tour.title}</p>
                    <h2 id="gcc-print-exam">Exam practice</h2>
                    {examPrompts.length > 0 && (
                        <div className="gcc-print-subsection">
                            <h3>Discussion and essay prompts</h3>
                            <ol className="gcc-print-exam-prompts">
                                {examPrompts.map((prompt, idx) => (
                                    <li key={idx}>{prompt}</li>
                                ))}
                            </ol>
                        </div>
                    )}
                    {hasEssayBuilder && (
                        <div className="gcc-print-subsection">
                            <h3>Worked paragraph: Claim, Evidence, Counter-claim, Judgment</h3>
                            {tour.essayBuilder.prompt && (
                                <p className="gcc-print-note">Prompt: &ldquo;{tour.essayBuilder.prompt}&rdquo;</p>
                            )}
                            <dl>
                                {tour.essayBuilder.claim && (
                                    <div className="gcc-print-essay-step">
                                        <dt>1 · Claim</dt>
                                        <dd>{tour.essayBuilder.claim}</dd>
                                    </div>
                                )}
                                {tour.essayBuilder.evidence && (
                                    <div className="gcc-print-essay-step">
                                        <dt>2 · Evidence</dt>
                                        <dd>{tour.essayBuilder.evidence}</dd>
                                    </div>
                                )}
                                {tour.essayBuilder.counterClaim && (
                                    <div className="gcc-print-essay-step">
                                        <dt>3 · Counter-claim</dt>
                                        <dd>{tour.essayBuilder.counterClaim}</dd>
                                    </div>
                                )}
                                {tour.essayBuilder.judgment && (
                                    <div className="gcc-print-essay-step">
                                        <dt>4 · Judgment</dt>
                                        <dd>{tour.essayBuilder.judgment}</dd>
                                    </div>
                                )}
                            </dl>
                            {tour.essayBuilder.sourceUrls?.length > 0 && (
                                <p>
                                    <PrintSourceRefs urls={tour.essayBuilder.sourceUrls} sourceByRawUrl={sourceByRawUrl} />
                                </p>
                            )}
                        </div>
                    )}
                </section>
            )}

            {/* 9. Sources & 10. Footer note */}
            {sources.length > 0 ? (
                <section className="gcc-print-section" aria-labelledby="gcc-print-sources">
                    <h2 id="gcc-print-sources">Sources</h2>
                    {leadSources.length > 0 && (
                        <ol className="gcc-print-sources">
                            {leadSources.map(src => (
                                <CasePrintSourceItem key={src.number} src={src} />
                            ))}
                        </ol>
                    )}
                    <div className="gcc-print-tail-keep">
                        <ol className="gcc-print-sources gcc-print-sources--tail" start={sources.length}>
                            <CasePrintSourceItem src={tailSource} />
                        </ol>
                        <CasePrintFooter
                            hasLocations={locations.length > 0}
                            usesNasaImagery={tour.usesNasaImagery}
                        />
                    </div>
                </section>
            ) : (
                <CasePrintFooter
                    hasLocations={locations.length > 0}
                    usesNasaImagery={tour.usesNasaImagery}
                />
            )}
        </article>
    );
}

export function ListBriefingPrintContent({
    mode = 'forecasts',
    title,
    items = [],
    totalCount = items.length,
    query = '',
    exportedAt = formatExportDate(),
    pageUrl,
}) {
    const isNews = mode === 'news';
    const limit = isNews ? null : FORECAST_EXPORT_LIMIT;
    const sanitizedItems = sanitizeListItems(items, limit);
    const heading = title || (isNews ? 'Live News Intel Briefing' : 'Global Intelligence Briefing');
    const cleanUrl = buildPageUrl(pageUrl);
    const leadItems = sanitizedItems.length > 1 ? sanitizedItems.slice(0, -1) : [];
    const tailItem = sanitizedItems.length > 0 ? sanitizedItems[sanitizedItems.length - 1] : null;

    return (
        <article className="gcc-print-doc gcc-print-doc--list" aria-label={heading}>
            <header className="gcc-print-header">
                <p className="gcc-print-kicker">
                    {isNews ? 'Global Command Center · Live News Scan' : 'Global Command Center · Intelligence Feed'}
                </p>
                <h1>{heading}</h1>
                <table className="gcc-print-meta-table">
                    <tbody>
                        <tr>
                            <th scope="row">Exported</th>
                            <td>{exportedAt}</td>
                        </tr>
                        <tr>
                            <th scope="row">Included items</th>
                            <td>
                                {sanitizedItems.length}
                                {!isNews && totalCount > sanitizedItems.length ? ` of ${totalCount} filtered items (capped at ${FORECAST_EXPORT_LIMIT})` : ''}
                            </td>
                        </tr>
                        {isNews && query && (
                            <tr>
                                <th scope="row">Query</th>
                                <td>{query}</td>
                            </tr>
                        )}
                        <tr>
                            <th scope="row">Site URL</th>
                            <td className="gcc-print-meta-url">{cleanUrl}</td>
                        </tr>
                    </tbody>
                </table>
            </header>

            {sanitizedItems.length > 0 ? (
                <>
                    {leadItems.length > 0 && (
                        <ol className="gcc-print-list-items">
                            {leadItems.map(item => (
                                <ListPrintItem key={item.index} item={item} />
                            ))}
                        </ol>
                    )}
                    <div className="gcc-print-tail-keep">
                        <ol className="gcc-print-list-items gcc-print-list-items--tail">
                            <ListPrintItem item={tailItem} />
                        </ol>
                        <footer className="gcc-print-footer">
                            <p><strong>2026 Global Command Center — IB Global Politics</strong></p>
                            <p>Educational intelligence summary generated {exportedAt}.</p>
                        </footer>
                    </div>
                </>
            ) : (
                <>
                    <p>No items match the current view.</p>
                    <footer className="gcc-print-footer">
                        <p><strong>2026 Global Command Center — IB Global Politics</strong></p>
                        <p>Educational intelligence summary generated {exportedAt}.</p>
                    </footer>
                </>
            )}
        </article>
    );
}

export default function PrintBriefingHost({ job, MapComponent = null, onComplete }) {
    const rootRef = useRef(null);
    const hasMap = job?.mode === 'case' && Boolean(job.tour?.map?.locations?.length) && Boolean(MapComponent);
    const [mapReady, setMapReady] = useState(!hasMap);
    const printedRef = useRef(false);
    const printDispatchedAtRef = useRef(0);
    const finishTimerRef = useRef(null);

    useEffect(() => {
        printedRef.current = false;
        printDispatchedAtRef.current = 0;
        if (finishTimerRef.current) {
            window.clearTimeout(finishTimerRef.current);
            finishTimerRef.current = null;
        }
        setMapReady(!hasMap);
    }, [job, hasMap]);

    const handleMapReady = useCallback(() => {
        setMapReady(true);
    }, []);

    const expectedTitle = useMemo(() => {
        if (!job) return '';
        return job.mode === 'case'
            ? buildCasePrintTitle(job.tour?.title)
            : buildListPrintTitle(job.mode);
    }, [job]);

    useEffect(() => {
        if (!job || typeof document === 'undefined' || typeof window === 'undefined') return undefined;

        const previousTitle = document.title;
        document.title = expectedTitle;
        document.body.classList.add('gcc-print-active');
        let finished = false;

        const finishPrintNow = () => {
            if (finished) return;
            finished = true;
            if (finishTimerRef.current) {
                window.clearTimeout(finishTimerRef.current);
                finishTimerRef.current = null;
            }
            document.title = previousTitle;
            document.body.classList.remove('gcc-print-active');
            onComplete?.();
        };

        const handleAfterPrint = () => {
            const elapsed = Date.now() - printDispatchedAtRef.current;
            // Mobile WebKit/Chrome can emit afterprint before snapshotting the print DOM.
            if (printDispatchedAtRef.current > 0 && elapsed < 150) {
                if (!finishTimerRef.current) {
                    finishTimerRef.current = window.setTimeout(finishPrintNow, 450);
                }
                return;
            }
            finishPrintNow();
        };

        const handleReturnFocus = () => {
            if (!printedRef.current || printDispatchedAtRef.current === 0) return;
            if (document.visibilityState && document.visibilityState !== 'visible') return;
            if (Date.now() - printDispatchedAtRef.current >= 300) {
                finishPrintNow();
            }
        };

        // Generous failsafe (2 min) so non-blocking print previews (Firefox/Zen, iOS sheets)
        // never tear down .gcc-print-active while a user chooses PDF settings, while still
        // resetting the button if a browser fails to fire afterprint/focus.
        const stuckButtonFallback = window.setTimeout(finishPrintNow, 120000);
        window.addEventListener('afterprint', handleAfterPrint);
        window.addEventListener('focus', handleReturnFocus);
        document.addEventListener('visibilitychange', handleReturnFocus);
        return () => {
            window.clearTimeout(stuckButtonFallback);
            if (finishTimerRef.current) {
                window.clearTimeout(finishTimerRef.current);
                finishTimerRef.current = null;
            }
            window.removeEventListener('afterprint', handleAfterPrint);
            window.removeEventListener('focus', handleReturnFocus);
            document.removeEventListener('visibilitychange', handleReturnFocus);
            document.title = previousTitle;
            document.body.classList.remove('gcc-print-active');
        };
    }, [job, expectedTitle, onComplete]);

    useEffect(() => {
        if (!job || mapReady || typeof window === 'undefined') return undefined;
        const fallbackId = window.setTimeout(() => setMapReady(true), 4000);
        return () => window.clearTimeout(fallbackId);
    }, [job, mapReady]);

    useEffect(() => {
        if (!job || !mapReady || printedRef.current || typeof window === 'undefined') return undefined;

        let cancelled = false;
        const waitForPrintReadiness = async () => {
            if (document.fonts?.ready) {
                await Promise.race([
                    document.fonts.ready.catch(() => {}),
                    new Promise(resolve => window.setTimeout(resolve, 1500)),
                ]);
            }
            if (cancelled) return;

            const images = Array.from(rootRef.current?.querySelectorAll('img') || []);
            if (images.length > 0) {
                await Promise.all(images.map(img => (
                    img.complete
                        ? Promise.resolve()
                        : new Promise(resolve => {
                            img.addEventListener('load', resolve, { once: true });
                            img.addEventListener('error', resolve, { once: true });
                            window.setTimeout(resolve, 2000);
                        })
                )));
            }
            if (cancelled) return;

            await new Promise(resolve => window.requestAnimationFrame(() => window.requestAnimationFrame(resolve)));
            if (cancelled || printedRef.current) return;
            printedRef.current = true;
            printDispatchedAtRef.current = Date.now();
            window.print();
        };

        waitForPrintReadiness();
        return () => {
            cancelled = true;
        };
    }, [job, mapReady]);

    if (!job || typeof document === 'undefined') return null;

    return createPortal(
        <div ref={rootRef} className="gcc-print-root">
            {job.mode === 'case' ? (
                <CaseBriefingPrintContent
                    tour={job.tour}
                    exportedAt={job.exportedAt}
                    pageUrl={job.pageUrl}
                    MapComponent={MapComponent}
                    onMapReady={handleMapReady}
                />
            ) : (
                <ListBriefingPrintContent
                    mode={job.mode}
                    title={job.title}
                    items={job.items}
                    totalCount={job.totalCount}
                    query={job.query}
                    exportedAt={job.exportedAt}
                    pageUrl={job.pageUrl}
                />
            )}
        </div>,
        document.body
    );
}

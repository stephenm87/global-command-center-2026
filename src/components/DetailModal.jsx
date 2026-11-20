import React from 'react';
import { theories, getTheoryInterpretation } from '../theories';
import { generate5W1H, getGlobalChallenges, CHALLENGE_ICONS } from '../eventAnalysis';
import { categoryColors, getAccessibleTextAccent, getCaseReviewNotice, isReviewOverdue, safeHttpUrl } from '../navigationState.mjs';

export default function DetailModal({
    selectedForecast,
    modalRef,
    selectedTheory,
    onSelectTheory,
    onClose,
    onOpenBriefing,
    onOpenAuthModal,
    onDeepScan,
    deepScanResult,
    deepScanLoading,
    aiSummary,
    aiSummaryLoading,
}) {
    if (!selectedForecast) return null;

    const analysis = generate5W1H(selectedForecast);
    const challenges = getGlobalChallenges(selectedForecast);
    const catColor = categoryColors[selectedForecast.Broad_Category];
    const activeTheoryKey = theories[selectedTheory] ? selectedTheory : 'Realism';
    const activeTheory = theories[activeTheoryKey];
    const validReportUrl = safeHttpUrl(selectedForecast.url);
    const overdueNotice = selectedForecast.isCaseStudy ? getCaseReviewNotice(selectedForecast) : null;

    return (
        <div className="detail-modal" onClick={onClose}>
            <div
                ref={modalRef}
                className="modal-content"
                role="dialog"
                aria-modal="true"
                aria-labelledby="forecast-dialog-title"
                tabIndex="-1"
                onClick={e => e.stopPropagation()}
                style={{ maxWidth: '800px' }}
            >
                <button type="button" className="close-btn" aria-label="Close intelligence detail" onClick={onClose}>✕</button>
                <div className="modal-header" style={{ borderBottomColor: catColor }}>
                    <span className="modal-category" style={{ color: getAccessibleTextAccent(catColor) }}>
                        {selectedForecast.Broad_Category}
                    </span>
                    <h2 id="forecast-dialog-title">
                        {(selectedForecast.isCaseStudy || selectedForecast.isLive)
                            ? (selectedForecast['Entity/Subject'] || selectedForecast['Topic/Sector'])
                            : selectedForecast['Topic/Sector']}
                    </h2>
                    {selectedForecast.isCaseStudy && <p className="modal-case-subtitle">{selectedForecast['Topic/Sector']}</p>}
                    {selectedForecast.isLive && selectedForecast.Source && (
                        <p className="modal-case-subtitle">
                            {selectedForecast.Source}
                            {selectedForecast.publishedAt ? ` · ${selectedForecast.publishedAt}` : ''}
                        </p>
                    )}
                </div>
                <div className="modal-body">
                    {selectedForecast.isCaseStudy && (
                        <section className="case-study-overview" aria-label="Verified case-study evidence">
                            {overdueNotice && (
                                <div className="case-study-update-notice" role="status">
                                    <strong>Editorial review notice:</strong> {overdueNotice} (scheduled review {selectedForecast.reviewBy}).
                                </div>
                            )}
                            <div className="case-study-meta">
                                {selectedForecast.regionTags?.map(region => <span key={region}>{region}</span>)}
                                <time dateTime={selectedForecast.updatedAt}>Last reviewed {selectedForecast.updatedAt}</time>
                                <span>{selectedForecast.confidence} source confidence</span>
                                {selectedForecast.reviewBy && (
                                    <time
                                        className={isReviewOverdue(selectedForecast.reviewBy) ? 'review-overdue' : ''}
                                        dateTime={selectedForecast.reviewBy}
                                    >
                                        {overdueNotice || `Review by ${selectedForecast.reviewBy}`}
                                    </time>
                                )}
                            </div>
                            <p className="case-study-status">{selectedForecast.statusSummary}</p>
                            <div className="case-study-analysis-grid">
                                <div><strong>Why it matters</strong><p>{selectedForecast.whyItMatters}</p></div>
                                <div><strong>What remains uncertain</strong><p>{selectedForecast.uncertainty}</p></div>
                            </div>
                            {selectedForecast.issueDimensions?.length > 0 && (
                                <div className="case-study-dimensions" aria-label="Issue dimensions">
                                    {selectedForecast.issueDimensions.map(issue => <span key={issue}>{issue}</span>)}
                                </div>
                            )}
                            {selectedForecast.sources?.length > 0 && (
                                <div className="case-study-sources">
                                    <strong>Three-perspective reading set</strong>
                                    <ul>
                                        {selectedForecast.sources.map(source => {
                                            const sourceHref = safeHttpUrl(source.url);
                                            return (
                                                <li key={source.url || source.title}>
                                                    {source.perspectiveType && (
                                                        <em className={`case-source-badge case-source-${source.perspectiveType}`}>
                                                            {source.perspectiveType}
                                                        </em>
                                                    )}
                                                    {sourceHref
                                                        ? <a href={sourceHref} target="_blank" rel="noopener noreferrer">{source.title}</a>
                                                        : <span>{source.title}</span>}
                                                    <span>
                                                        {source.publisher}
                                                        {source.dateLabel ? ` · ${source.dateLabel}` : ''}
                                                        {source.perspective ? ` · ${source.perspective}` : ''}
                                                    </span>
                                                    {source.supports && <small>Supports: {source.supports}</small>}
                                                </li>
                                            );
                                        })}
                                    </ul>
                                    {selectedForecast.supplementalSources?.length > 0 && (
                                        <details>
                                            <summary>
                                                {selectedForecast.supplementalSources.length} supplemental {selectedForecast.supplementalSources.length === 1 ? 'source' : 'sources'}
                                            </summary>
                                            <ul>
                                                {selectedForecast.supplementalSources.map(source => {
                                                    const suppHref = safeHttpUrl(source.url);
                                                    return (
                                                        <li key={source.url || source.title}>
                                                            {suppHref
                                                                ? <a href={suppHref} target="_blank" rel="noopener noreferrer">{source.title}</a>
                                                                : <span>{source.title}</span>}
                                                            <span>{source.publisher}{source.dateLabel ? ` · ${source.dateLabel}` : ''}</span>
                                                        </li>
                                                    );
                                                })}
                                            </ul>
                                        </details>
                                    )}
                                </div>
                            )}
                            <button
                                type="button"
                                className="case-study-briefing-btn"
                                onClick={() => {
                                    onClose();
                                    onOpenBriefing(selectedForecast.caseStudyId, selectedForecast.nexusActorIds?.[0]);
                                }}
                            >
                                OPEN GUIDED BRIEFING →
                            </button>
                        </section>
                    )}

                    {selectedForecast.isLive && selectedForecast.coverage && (
                        <section className="current-source-context" aria-label="Automated source selection context">
                            <strong>WHY THIS UPDATE IS INCLUDED</strong>
                            <div className="coverage-badges coverage-badges-detail">
                                <span>{selectedForecast.coverage.region}</span>
                                <span>{selectedForecast.coverage.issue}</span>
                                <span>{selectedForecast.coverage.fundingLabel || selectedForecast.coverage.sourceRoleLabel}</span>
                                {selectedForecast.coverage.locationPrecision === 'global-unmapped' && (
                                    <span className="coverage-badge-unmapped">Global · No single pin</span>
                                )}
                            </div>
                            <p>{selectedForecast.coverage.selectionReason}</p>
                            {safeHttpUrl(selectedForecast.coverage.attributionUrl) && (
                                <p>
                                    Source credit:{' '}
                                    <a
                                        href={safeHttpUrl(selectedForecast.coverage.attributionUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {selectedForecast.Source || 'Publisher homepage'} ↗
                                    </a>
                                </p>
                            )}
                            <small>Funding labels describe organizational support—not editorial endorsement or neutrality.</small>
                        </section>
                    )}

                    {analysis && (
                        <div className="fivewh-section">
                            <div className="section-label">📋 5W1H ANALYSIS</div>
                            <div className="fivewh-grid">
                                {[
                                    { key: 'who', label: 'WHO', icon: '👤' },
                                    { key: 'what', label: 'WHAT', icon: '📌' },
                                    { key: 'where', label: 'WHERE', icon: '📍' },
                                    { key: 'when', label: 'WHEN', icon: '⏱' },
                                    { key: 'why', label: 'WHY', icon: '❓' },
                                    { key: 'how', label: 'HOW', icon: '⚙️' },
                                ].map(item => (
                                    <div className="fivewh-row" key={item.key}>
                                        <span className="fivewh-label">{item.icon} {item.label}</span>
                                        <span className="fivewh-value">{analysis[item.key]}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {challenges && Object.keys(challenges).length > 0 && (
                        <div className="challenges-section">
                            <div className="section-label">⚠️ HL GLOBAL CHALLENGES</div>
                            <div className="challenges-grid">
                                {Object.entries(challenges).map(([name, text]) => (
                                    <div className="challenge-card" key={name}>
                                        <div className="challenge-header">
                                            <span className="challenge-icon">{CHALLENGE_ICONS[name] || '📋'}</span>
                                            <span className="challenge-name">{name}</span>
                                        </div>
                                        <p className="challenge-analysis">{text}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="theory-overlay">
                        <div className="theory-selector">
                            <span className="modal-label">THEORETICAL LENS:</span>
                            <div className="theory-buttons">
                                {Object.keys(theories).map(theory => (
                                    <button
                                        key={theory}
                                        type="button"
                                        className={`theory-btn ${activeTheoryKey === theory ? 'active' : ''}`}
                                        style={{ '--theory-color': theories[theory].color }}
                                        onClick={() => onSelectTheory(theory)}
                                    >
                                        {theory.toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>
                        <div className="theory-content" style={{ borderColor: activeTheory.color }}>
                            <div className="theory-meta">
                                <span className="theory-name" style={{ color: getAccessibleTextAccent(activeTheory.color) }}>
                                    {activeTheoryKey}
                                </span>
                                <p className="theory-desc">{activeTheory.description}</p>
                            </div>
                            <div className="theory-interpretation">
                                <strong>ANALYSIS:</strong> {getTheoryInterpretation(activeTheoryKey, selectedForecast)}
                            </div>
                        </div>
                    </div>

                    {validReportUrl && (
                        <div className="modal-action">
                            <a
                                href={validReportUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="live-report-btn"
                            >
                                OPEN SOURCE INTELLIGENCE REPORT ↗
                            </a>
                        </div>
                    )}

                    {validReportUrl && (
                        <div className="deep-scan-section">
                            <button
                                type="button"
                                className="deep-scan-btn"
                                onClick={() => onDeepScan(validReportUrl)}
                                disabled={deepScanLoading || aiSummaryLoading}
                            >
                                {deepScanLoading
                                    ? <><span className="scan-spinner">⟳</span> EXTRACTING ARTICLE...</>
                                    : '🔥 FIRECRAWL + AI BRIEF'}
                            </button>

                            {(aiSummaryLoading || aiSummary) && (
                                <div className="ai-brief-panel">
                                    <div className="ai-brief-header">
                                        <span className="ai-brief-icon">🤖</span>
                                        <span className="ai-brief-title">AI INTEL BRIEF</span>
                                        <span className="ai-brief-model">{aiSummary?.model || 'Configured AI model'}</span>
                                    </div>

                                    {aiSummaryLoading ? (
                                        <div className="ai-loading">
                                            <span className="scan-spinner">⟳</span> Generating intelligence brief...
                                        </div>
                                    ) : aiSummary?.error ? (
                                        <div className="scan-error"><span>⚠</span> {aiSummary.error}</div>
                                    ) : aiSummary && (
                                        <>
                                            <div className="bluf-box">
                                                <span className="bluf-label">📌 BLUF</span>
                                                <p className="bluf-text">{aiSummary.oneLiner}</p>
                                            </div>
                                            <div className="risk-row">
                                                <span className="risk-indicator" data-level={aiSummary.riskLevel}>
                                                    {aiSummary.riskLevel === 'HIGH' ? '🔴' : aiSummary.riskLevel === 'MEDIUM' ? '🟡' : '🟢'} {aiSummary.riskLevel} RISK
                                                </span>
                                                {aiSummary.riskReason && <span className="risk-reason">{aiSummary.riskReason}</span>}
                                            </div>
                                            {aiSummary.keyActors?.length > 0 && (
                                                <div className="brief-row">
                                                    <span className="brief-row-label">👥 KEY ACTORS</span>
                                                    <div className="actor-chips">
                                                        {aiSummary.keyActors.map((actor, i) => (
                                                            <span key={i} className="actor-chip">{actor}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {aiSummary.ibThemes?.length > 0 && (
                                                <div className="brief-row">
                                                    <span className="brief-row-label">📚 IB GP THEMES</span>
                                                    <div className="actor-chips">
                                                        {aiSummary.ibThemes.map((theme, i) => (
                                                            <span key={i} className="theme-badge">{theme}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {aiSummary.rawSummary && (
                                                <div className="brief-summary">
                                                    <span className="brief-row-label">📝 ANALYSIS</span>
                                                    <p className="summary-text">{aiSummary.rawSummary}</p>
                                                </div>
                                            )}
                                            {aiSummary.studentPrompt && (
                                                <div className="student-prompt-box">
                                                    <span className="prompt-label">💬 STUDENT DISCUSSION</span>
                                                    <p className="prompt-text">{aiSummary.studentPrompt}</p>
                                                </div>
                                            )}
                                            {aiSummary.keyConceptTags?.length > 0 && (
                                                <div className="brief-row">
                                                    <span className="brief-row-label">🏷️ KEY CONCEPTS</span>
                                                    <div className="actor-chips">
                                                        {aiSummary.keyConceptTags.map((concept, i) => (
                                                            <span key={i} className="theme-badge" style={{ borderColor: '#ff9900', color: '#ff9900' }}>
                                                                {concept}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                            {aiSummary.cuiBono && (
                                                <div className="brief-summary" style={{ borderLeftColor: '#ff6600' }}>
                                                    <span className="brief-row-label">🎯 CUI BONO — WHO BENEFITS?</span>
                                                    <p className="summary-text" style={{ color: '#ff9966' }}>{aiSummary.cuiBono}</p>
                                                </div>
                                            )}
                                            {aiSummary.globalSouthPerspective && (
                                                <div className="student-prompt-box" style={{ borderColor: '#33cc33', background: 'rgba(51,204,51,0.05)' }}>
                                                    <span className="prompt-label" style={{ color: '#33cc33' }}>🌍 GLOBAL SOUTH PERSPECTIVE</span>
                                                    <p className="prompt-text" style={{ color: '#aaddaa' }}>{aiSummary.globalSouthPerspective}</p>
                                                </div>
                                            )}
                                            {aiSummary.historicalParallel && (
                                                <div className="brief-row">
                                                    <span className="brief-row-label">📖 HISTORICAL PARALLEL</span>
                                                    <p className="summary-text" style={{ fontSize: '0.72rem', color: '#ccaaff', fontStyle: 'italic' }}>
                                                        {aiSummary.historicalParallel}
                                                    </p>
                                                </div>
                                            )}
                                            {(aiSummary.sourceType || aiSummary.sourceBias) && (
                                                <div className="brief-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                                                    <span className="brief-row-label">🔍 SOURCE EVALUATION</span>
                                                    {aiSummary.sourceType && (
                                                        <p className="summary-text" style={{ fontSize: '0.68rem' }}>
                                                            <strong style={{ color: '#00ddff' }}>Type:</strong> {aiSummary.sourceType}
                                                        </p>
                                                    )}
                                                    {aiSummary.sourceBias && (
                                                        <p className="summary-text" style={{ fontSize: '0.68rem', color: '#ffaa66' }}>
                                                            <strong>Bias:</strong> {aiSummary.sourceBias}
                                                        </p>
                                                    )}
                                                </div>
                                            )}
                                            {aiSummary.paper2Prompts && (
                                                <details className="raw-scan-details" style={{ marginTop: '8px' }}>
                                                    <summary className="raw-scan-summary" style={{ color: '#00ffcc' }}>📝 IB PAPER 2 PRACTICE PROMPTS</summary>
                                                    <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                        {aiSummary.paper2Prompts.identify && (
                                                            <div style={{ borderLeft: '2px solid #00ddff', paddingLeft: '8px' }}>
                                                                <span style={{ fontSize: '0.55rem', color: '#00ddff', letterSpacing: '1px', fontWeight: 700 }}>SL — IDENTIFY</span>
                                                                <p className="summary-text" style={{ fontSize: '0.7rem' }}>{aiSummary.paper2Prompts.identify}</p>
                                                            </div>
                                                        )}
                                                        {aiSummary.paper2Prompts.explain && (
                                                            <div style={{ borderLeft: '2px solid #ff9900', paddingLeft: '8px' }}>
                                                                <span style={{ fontSize: '0.55rem', color: '#ff9900', letterSpacing: '1px', fontWeight: 700 }}>HL — EXPLAIN</span>
                                                                <p className="summary-text" style={{ fontSize: '0.7rem' }}>{aiSummary.paper2Prompts.explain}</p>
                                                            </div>
                                                        )}
                                                        {aiSummary.paper2Prompts.evaluate && (
                                                            <div style={{ borderLeft: '2px solid #ff3366', paddingLeft: '8px' }}>
                                                                <span style={{ fontSize: '0.55rem', color: '#ff3366', letterSpacing: '1px', fontWeight: 700 }}>HL — EVALUATE</span>
                                                                <p className="summary-text" style={{ fontSize: '0.7rem' }}>{aiSummary.paper2Prompts.evaluate}</p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </details>
                                            )}
                                            <div className="scan-meta">
                                                Generated {aiSummary.generatedAt ? new Date(aiSummary.generatedAt).toLocaleTimeString() : 'just now'}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}

                            {deepScanResult && !deepScanResult.error && (
                                <details className="raw-scan-details">
                                    <summary className="raw-scan-summary">📄 RAW ARTICLE EXTRACT</summary>
                                    <div className="deep-scan-result">
                                        {deepScanResult.title && <h4 className="scan-title">{deepScanResult.title}</h4>}
                                        {deepScanResult.description && <p className="scan-description">{deepScanResult.description}</p>}
                                        <div className="scan-content">{deepScanResult.content}</div>
                                        <div className="scan-meta">
                                            Extracted {new Date(deepScanResult.scrapedAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </details>
                            )}

                            {deepScanResult?.error && (
                                <div className={`scan-error${deepScanResult.requiresAuth ? ' scan-error--auth' : ''}`} role="alert">
                                    <span>{deepScanResult.requiresAuth ? '🔒' : '⚠'} {deepScanResult.error}</span>
                                    {deepScanResult.requiresAuth && (
                                        <button
                                            type="button"
                                            className="deep-scan-signin-cta"
                                            onClick={onOpenAuthModal}
                                        >
                                            SIGN IN TO UNLOCK →
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

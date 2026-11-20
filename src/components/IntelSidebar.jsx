import React from 'react';
import { ALL_INTEL_CATEGORY, LIVE_INTEL_CATEGORY, isUnInstitutionalOnly } from '../intelFeed.mjs';
import { categoryColors, getAccessibleTextAccent, getCaseReviewNotice, safeHttpUrl } from '../navigationState.mjs';

export default function IntelSidebar({
    visible,
    sidebarCollapsed,
    onToggleCollapse,
    historicalData,
    historicalLoading,
    timelineYear,
    intelLoading,
    intelLastUpdated,
    intelSummary,
    caseStudyCount,
    feedSearch,
    onSearchChange,
    visibleSelectedCategory,
    onCategoryChange,
    currentFeedLabel,
    feedEmptyState,
    feedItems,
    feedPage,
    feedPageSize = 40,
    onShowMore,
    selectedForecast,
    onSelectForecast,
    onOpenBriefing,
}) {
    const statusTone = intelSummary.sourceMode === 'provider'
        ? 'provider'
        : intelSummary.sourceMode === 'public-cache'
            ? (intelSummary.feedStatus === 'stale' ? 'warning' : 'cached')
            : ['not-configured', 'provider-error', 'unavailable', 'network-error', 'store-error'].includes(intelSummary.feedStatus)
                ? 'warning'
                : 'reference';

    return (
        <aside
            id="intel-feed"
            className={`intel-feed ${sidebarCollapsed ? 'collapsed' : ''}`}
            role="complementary"
            aria-label="Intelligence Feed"
            style={!visible ? { display: 'none' } : {}}
        >
            <button
                type="button"
                className="sidebar-toggle"
                onClick={onToggleCollapse}
                title={sidebarCollapsed ? 'Expand Intel Feed (Space)' : 'Collapse Intel Feed (Space)'}
                aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            />
            <div className="intel-header">
                <span className="intel-title">
                    {historicalData ? `📅 ${timelineYear} ARCHIVE` : 'INTEL FEED'}
                </span>
                {historicalData ? (
                    <span className="intel-history-status">
                        {historicalLoading ? '⟳ LOADING...' : `${historicalData.length} EVENTS • SOURCED`}
                    </span>
                ) : intelLastUpdated && (
                    <>
                        <span className={`intel-source-status ${statusTone}`} role="status">
                            {intelSummary.sourceMode === 'provider'
                                ? `● ${intelSummary.liveItemCount} PROVIDER-CURRENT · ${intelLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                                : intelSummary.sourceMode === 'public-cache'
                                    ? `${intelSummary.feedStatus === 'stale' ? '◐' : '●'} ${intelSummary.liveItemCount} ${intelSummary.feedStatus === 'stale' ? 'STALE ' : ''}${isUnInstitutionalOnly(intelSummary.provider) ? 'UN INSTITUTIONAL' : 'CACHED CURRENT'} · ${intelLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                                    : intelSummary.feedStatus === 'not-configured'
                                        ? `△ CURRENT FEED NOT CONFIGURED · ${caseStudyCount} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                        : ['provider-error', 'unavailable'].includes(intelSummary.feedStatus)
                                            ? `△ CURRENT FEED PROVIDER ERROR · ${caseStudyCount} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                            : ['network-error', 'store-error'].includes(intelSummary.feedStatus)
                                                ? `△ CURRENT FEED CONNECTION FAILED · ${caseStudyCount} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                                : intelSummary.feedStatus === 'empty'
                                                    ? `○ NO QUALIFYING CURRENT ITEMS · ${caseStudyCount} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                                    : `○ PUBLIC REFERENCE MODE · ${caseStudyCount} CASES + ${intelSummary.linkedReferenceCount} LINKED SOURCES`}
                        </span>
                        {intelSummary.liveItemCount > 0 && intelSummary.coverage && (
                            <div className="intel-coverage-summary" aria-label="Current intelligence coverage">
                                <span>{intelSummary.coverage.coveredRegionCount}/{intelSummary.coverage.targetRegionCount} REGIONS</span>
                                <span>{intelSummary.coverage.coveredIssueCount}/{intelSummary.coverage.targetIssueCount} ISSUES</span>
                                <span>{intelSummary.coverage.coveredSourceRoleCount}/{intelSummary.coverage.targetSourceRoleCount} SOURCE ROLES</span>
                            </div>
                        )}
                    </>
                )}
                <label className="feed-search-label" htmlFor="feed-search">Search the intelligence list</label>
                <input
                    id="feed-search"
                    className="feed-search"
                    type="search"
                    value={feedSearch}
                    onChange={event => onSearchChange(event.target.value)}
                    placeholder="Search actors, topics, sources…"
                />
                <select
                    className="category-filter"
                    value={visibleSelectedCategory}
                    onChange={e => onCategoryChange(e.target.value)}
                    aria-label="Filter intelligence sources"
                >
                    <option value={ALL_INTEL_CATEGORY}>ALL SOURCED INTELLIGENCE</option>
                    {!historicalData && (
                        <option value={LIVE_INTEL_CATEGORY} style={{ color: '#00ffff', fontWeight: 'bold' }}>
                            {currentFeedLabel}
                        </option>
                    )}
                    {Object.keys(categoryColors).map(cat => (
                        <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                    ))}
                </select>
            </div>

            <div className="intel-cards">
                {historicalLoading ? (
                    <div className="feed-loading-state historical">
                        ⟳ Loading {timelineYear} historical data...
                    </div>
                ) : intelLoading ? (
                    <div className="feed-loading-state" role="status">
                        ⟳ LOADING PUBLIC SOURCES...
                    </div>
                ) : feedEmptyState ? (
                    <div className="feed-empty-state" role="status">
                        <strong>{feedEmptyState.title}</strong>
                        <span>{feedEmptyState.message}</span>
                        {feedEmptyState.actionLabel && (
                            <button
                                type="button"
                                className="feed-empty-action"
                                onClick={() => {
                                    if (feedEmptyState.action === 'clear-search') onSearchChange('');
                                    if (feedEmptyState.action === 'show-public-sources') onCategoryChange(ALL_INTEL_CATEGORY);
                                }}
                            >
                                {feedEmptyState.actionLabel}
                            </button>
                        )}
                    </div>
                ) : feedItems.slice(0, feedPage * feedPageSize).map((forecast, idx) => {
                    const overdueNotice = forecast.isCaseStudy ? getCaseReviewNotice(forecast) : null;
                    return (
                    <article
                        key={`${forecast.caseStudyId || forecast.url || forecast['Entity/Subject'] || forecast['Topic/Sector'] || 'forecast'}-${idx}`}
                        className={`intel-card ${selectedForecast === forecast ? 'selected' : ''} ${forecast.isLive ? 'live-item' : ''} ${forecast.isEditorial ? 'editorial-item' : ''} ${forecast.isCaseStudy ? 'case-study-item' : ''}`.trim()}
                        style={{
                            borderLeftColor: forecast.isHistorical
                                ? '#ffcc00'
                                : forecast.isLive
                                    ? '#00ffff'
                                    : (categoryColors[forecast.Broad_Category] || (forecast.isEditorial ? '#b69cff' : undefined)),
                        }}
                    >
                        <button
                            type="button"
                            className="intel-card-trigger"
                            onClick={() => onSelectForecast(forecast)}
                        >
                            {forecast.isLive && (
                                <span className="live-tag">
                                    ● {['serper-public-cache', 'institutional-rss', 'public-rss', 'reliefweb-v2', 'gdelt-doc'].includes(forecast._scraperSource) ? 'CACHED CURRENT' : 'LIVE INTEL'}
                                </span>
                            )}
                            {forecast.isLive && forecast.coverage && (
                                <span className="coverage-badges" aria-label="Coverage classification">
                                    <span>{forecast.coverage.region}</span>
                                    <span>{forecast.coverage.issue}</span>
                                    <span>{forecast.coverage.fundingLabel || forecast.coverage.sourceRoleLabel}</span>
                                    {forecast.coverage.locationPrecision === 'global-unmapped' && (
                                        <span className="coverage-badge-unmapped">Global · No single pin</span>
                                    )}
                                </span>
                            )}
                            {forecast.isCaseStudy
                                ? (
                                    <span className={`case-study-tag ${overdueNotice ? 'case-study-tag--overdue' : ''}`.trim()}>
                                        ◆ CASE BRIEF · {overdueNotice || `Last reviewed ${forecast.updatedAt}`}
                                    </span>
                                )
                                : forecast.isEditorial && <span className="context-tag">◆ DATED CONTEXT</span>}
                            {forecast.isReference && !forecast.isEditorial && !forecast.isCaseStudy && (
                                <span className="reference-tag">
                                    {forecast.url ? '◇ PUBLIC SOURCE' : '◇ LEGACY REFERENCE'}
                                </span>
                            )}
                            {forecast.isHistorical && (
                                <span className="live-tag" style={{ background: '#ffcc0022', color: '#ffcc00', borderColor: '#ffcc0044' }}>
                                    📅 {timelineYear}
                                </span>
                            )}
                            <span
                                className="card-category"
                                style={{
                                    color: forecast.isHistorical
                                        ? '#ffcc00'
                                        : forecast.isLive
                                            ? '#00ffff'
                                            : getAccessibleTextAccent(categoryColors[forecast.Broad_Category]),
                                }}
                            >
                                {forecast.Broad_Category}
                            </span>
                            <span className="card-title">
                                {(forecast.isCaseStudy || forecast.isLive)
                                    ? (forecast['Entity/Subject'] || forecast['Topic/Sector'])
                                    : forecast['Topic/Sector']}
                            </span>
                            <span className="card-timeline">
                                ⏱ {forecast.isCaseStudy
                                    ? `${forecast.regionTags?.join(' · ')} · ${overdueNotice || forecast.Timeline}`
                                    : forecast.isLive && forecast.Source
                                        ? `${forecast.Source} · ${forecast.publishedAt || String(forecast.Timeline || '').replace(/^CURRENT\s*—\s*/i, '')}`
                                        : forecast.Timeline}
                            </span>
                            <span className="card-impact">
                                {(() => {
                                    const rawImpact = (forecast.isCaseStudy ? forecast.statusSummary : forecast['Expected Impact/Value']) || '';
                                    if (rawImpact.length <= 140) return rawImpact;
                                    return `${rawImpact.substring(0, 140).trimEnd()}…`;
                                })()}
                            </span>
                        </button>
                        {(safeHttpUrl(forecast.url) || forecast.caseStudyId || (forecast.isLive && safeHttpUrl(forecast.coverage?.attributionUrl))) && (
                            <div className="card-actions">
                                {safeHttpUrl(forecast.url) && (
                                    <a
                                        href={safeHttpUrl(forecast.url)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="card-link"
                                    >
                                        OPEN SOURCE ↗
                                    </a>
                                )}
                                {forecast.isLive && safeHttpUrl(forecast.coverage?.attributionUrl) && (
                                    <a
                                        href={safeHttpUrl(forecast.coverage.attributionUrl)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="card-link card-credit-link"
                                    >
                                        {forecast.Source || 'Publisher'} ↗
                                    </a>
                                )}
                                {forecast.caseStudyId && (
                                    <button
                                        type="button"
                                        className="card-briefing-btn"
                                        onClick={() => onOpenBriefing(forecast.caseStudyId)}
                                    >
                                        BRIEFING →
                                    </button>
                                )}
                            </div>
                        )}
                    </article>
                    );
                })}
                {feedPage * feedPageSize < feedItems.length && (
                    <button
                        type="button"
                        className="show-more-btn"
                        onClick={onShowMore}
                        aria-label={`Show more events. Currently showing ${Math.min(feedPage * feedPageSize, feedItems.length)} of ${feedItems.length}`}
                    >
                        ▼ SHOW MORE ({feedItems.length - feedPage * feedPageSize} remaining)
                    </button>
                )}
            </div>
        </aside>
    );
}

import React from 'react';
import { getGlobalChallenges, CHALLENGE_ICONS } from '../eventAnalysis';
import { getEdgeInfo } from '../nexusEdgeData';
import { getAccessibleTextAccent } from '../navigationState.mjs';
import { ACTOR_TYPE_LABELS, DIM_COLORS, GPC_CONTEXT } from './nexusData';

const INSPECT_TABS = [
    ['overview', '⬡ OVERVIEW'],
    ['metrics', '📊 METRICS'],
    ['gpc', '🌐 GPC'],
    ['theory', '⚛ THEORY'],
];

const readableAccent = getAccessibleTextAccent;

export default function NexusInspectorPanel({
    selectedEdge,
    selectedNode,
    lockedNode,
    selectedGPC,
    inspectTab = 'overview',
    onSelectInspectTab,
    onCloseEdge,
    onCloseNode,
    onToggleLock,
    onReturnToLockedNode,
    onJumpToNodeById,
    onNavigateToNode,
    nodeBadges = [],
    connectionSummary = [],
    radarMetrics = null,
    theories = {},
    selectedTheory,
}) {
    if (selectedEdge && !selectedNode) {
        const sId = typeof selectedEdge.source === 'object' ? selectedEdge.source.id : selectedEdge.source;
        const tId = typeof selectedEdge.target === 'object' ? selectedEdge.target.id : selectedEdge.target;
        const info = getEdgeInfo(sId, tId, selectedEdge.type);
        const dimColor = readableAccent(DIM_COLORS[selectedEdge.type] || '#fff');

        return (
            <aside className="nexus-inspect-panel edge-inspector">
                <button type="button" className="inspect-close" aria-label="Close relationship details" onClick={onCloseEdge}>✕</button>
                <div className="edge-header">
                    <span style={{ color: typeof selectedEdge.source === 'object' ? selectedEdge.source.color : '#fff' }}>
                        {typeof selectedEdge.source === 'object' ? selectedEdge.source.name : selectedEdge.source}
                    </span>
                    <span className="edge-arrow">⟷</span>
                    <span style={{ color: typeof selectedEdge.target === 'object' ? selectedEdge.target.color : '#fff' }}>
                        {typeof selectedEdge.target === 'object' ? selectedEdge.target.name : selectedEdge.target}
                    </span>
                </div>
                <div className="edge-dimension" style={{ color: dimColor }}>
                    {(selectedEdge.type || 'CONNECTION').toUpperCase()}
                </div>
                {info ? (
                    <div className="edge-rich-data">
                        <div className="edge-label">{info.label}</div>
                        <p className="edge-summary">{info.summary}</p>
                        <div className="hero-chips">
                            {info.dataPoints.map((dp, j) => (
                                <span key={j} className="hero-chip">{dp}</span>
                            ))}
                        </div>
                        <div className="hero-tension" style={{ marginTop: '10px' }}>
                            <span>TENSION</span>
                            <div className="tension-bar">
                                <div
                                    className="tension-fill"
                                    style={{
                                        width: `${info.tension * 100}%`,
                                        background: info.tension > 0.7 ? '#ff0066' : info.tension > 0.4 ? '#ff9900' : '#00ff88',
                                    }}
                                />
                            </div>
                            <span style={{ color: info.tension > 0.7 ? '#ff5c99' : info.tension > 0.4 ? '#ff9900' : '#00ff88' }}>
                                {(info.tension * 100).toFixed(0)}%
                            </span>
                        </div>
                        {info.timeline && (
                            <div className="edge-timeline">
                                <div className="section-label" style={{ marginTop: '12px' }}>TIMELINE</div>
                                {info.timeline.map((t, j) => (
                                    <div key={j} className="timeline-event">
                                        <span className="timeline-year">{t.year}</span>
                                        <span className="timeline-text">{t.event}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="edge-metrics">
                        <div>Link Strength: <strong>{((selectedEdge.width || 1) * 20).toFixed(0)}%</strong></div>
                    </div>
                )}
                <div className="edge-nav-btns" style={{ marginTop: '12px', display: 'flex', gap: '6px' }}>
                    <button type="button" className="nexus-ctrl-btn" style={{ flex: 1 }} onClick={() => onJumpToNodeById(sId)}>→ Source</button>
                    <button type="button" className="nexus-ctrl-btn" style={{ flex: 1 }} onClick={() => onJumpToNodeById(tId)}>→ Target</button>
                </div>
            </aside>
        );
    }

    if (!selectedNode) return null;

    const gpcInfo = selectedGPC && GPC_CONTEXT[selectedGPC] ? GPC_CONTEXT[selectedGPC][selectedNode.id] : null;

    return (
        <aside className="nexus-inspect-panel">
            <div className="inspect-header-actions">
                <button
                    type="button"
                    className={`lock-btn ${lockedNode ? 'locked' : ''}`}
                    onClick={onToggleLock}
                    title={lockedNode ? 'Unlock view (Esc)' : "Lock this node's connections"}
                >
                    {lockedNode ? '🔒 LOCKED' : '🔓 LOCK'}
                </button>
                <button type="button" className="inspect-close" aria-label="Close actor details" onClick={onCloseNode}>✕</button>
            </div>

            {gpcInfo && (
                <div
                    className="gpc-context-card"
                    style={{
                        background: 'rgba(0,255,255,0.04)',
                        border: '1px solid rgba(0,255,255,0.2)',
                        borderRadius: '6px',
                        padding: '12px 14px',
                        marginBottom: '14px',
                    }}
                >
                    <div className="gpc-context-heading" style={{ letterSpacing: '2px', color: '#00ffff', marginBottom: '6px' }}>
                        🌐 {selectedGPC.toUpperCase()} CHALLENGE ANALYSIS
                    </div>
                    <p className="gpc-context-insight" style={{ color: '#ddd', lineHeight: '1.55', margin: '0 0 8px' }}>
                        {gpcInfo.insight}
                    </p>
                    <div className="gpc-context-stakes" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ color: '#a5b4bc' }}>STAKES:</span>
                        <span
                            style={{
                                color: gpcInfo.stakes === 'CRITICAL' ? '#ff5c99' : gpcInfo.stakes === 'HIGH' ? '#ff9900' : '#00ff88',
                                fontWeight: 700,
                            }}
                        >
                            {gpcInfo.stakes}
                        </span>
                    </div>
                    <div className="gpc-context-connections" style={{ marginTop: '8px', color: '#a5b4bc' }}>
                        Key connections: {gpcInfo.connections.join(' · ')}
                    </div>
                </div>
            )}

            {lockedNode && lockedNode.id !== selectedNode.id && (
                <div className="lock-breadcrumb">
                    <button
                        type="button"
                        className="breadcrumb-link"
                        onClick={onReturnToLockedNode}
                        style={{ color: lockedNode.color }}
                    >
                        🔒 {lockedNode.name}
                    </button>
                    <span className="breadcrumb-arrow">→</span>
                    <span className="breadcrumb-current">{selectedNode.name}</span>
                </div>
            )}

            <div className="inspect-glow-header" style={{ borderBottom: `2px solid ${selectedNode.color}` }}>
                <div className="inspect-cat">
                    {selectedNode.isAnchor ? (ACTOR_TYPE_LABELS[selectedNode.type] || '') : (selectedNode.category || '').toUpperCase()}
                </div>
                <h2 className="inspect-title">{selectedNode.name}</h2>
                {nodeBadges.length > 0 && (
                    <div className="badge-row">
                        {nodeBadges.map(b => (
                            <span key={b.label} className="node-badge" style={{ borderColor: b.color, color: readableAccent(b.color) }}>
                                {b.icon} {b.label}
                            </span>
                        ))}
                    </div>
                )}
            </div>

            <div className="inspect-tabs">
                {INSPECT_TABS.map(([id, label]) => (
                    <button
                        key={id}
                        type="button"
                        className={`inspect-tab ${inspectTab === id ? 'active' : ''}`}
                        aria-pressed={inspectTab === id}
                        onClick={() => onSelectInspectTab(id)}
                    >
                        {label}
                    </button>
                ))}
            </div>

            {inspectTab === 'overview' && (
                <div className="inspect-tab-content">
                    <div className="inspect-section">
                        <div className="section-label">STRATEGIC IMPACT</div>
                        <p className="section-body">{selectedNode.desc || 'No detailed impact projection available.'}</p>
                    </div>
                    {selectedNode.players && (
                        <div className="inspect-section">
                            <div className="section-label">KEY PLAYERS</div>
                            <p className="section-body" style={{ color: '#00ff88', fontFamily: 'Roboto Mono' }}>{selectedNode.players}</p>
                        </div>
                    )}
                    {selectedNode.timeline && (
                        <div className="inspect-section">
                            <div className="section-label">TIMELINE</div>
                            <p className="section-body" style={{ color: '#00ccff', fontFamily: 'Roboto Mono' }}>{selectedNode.timeline}</p>
                        </div>
                    )}
                    {connectionSummary.length > 0 && (
                        <div className="inspect-section">
                            <div className="section-label">NAVIGATE CONNECTIONS ({connectionSummary.length})</div>
                            <div className="conn-nav-list">
                                {connectionSummary.map((c, i) => (
                                    <button
                                        key={i}
                                        type="button"
                                        className="conn-nav-btn"
                                        onClick={() => onNavigateToNode(c.nodeRef)}
                                        style={{ '--conn-color': c.color }}
                                    >
                                        <span className="conn-nav-dot" style={{ background: c.color }} />
                                        <span className="conn-nav-name">{c.name}</span>
                                        <span className="conn-dim-pill" style={{ borderColor: c.color, color: readableAccent(c.color) }}>
                                            {c.type.toUpperCase()}
                                        </span>
                                        <span className="conn-nav-arrow">→</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {inspectTab === 'metrics' && radarMetrics && (
                <div className="inspect-tab-content">
                    <div className="inspect-section">
                        <div className="section-label">SYSTEMIC RADAR METRICS</div>
                        <div className="radar-grid">
                            {[
                                ['Sovereign Autonomy', radarMetrics.autonomy, '#3399ff', 50],
                                ['Economic Penetration', radarMetrics.economicPenetration, '#00ccff', 45],
                                ['Conflict Exposure', radarMetrics.conflictExposure, '#ff0066', 30],
                                ['Resource Security', radarMetrics.resourceSecurity, '#bf55ec', 40],
                                ['Diplomatic Centrality', radarMetrics.diplomaticCentrality, '#00ff88', 50],
                            ].map(([label, val, color, avg]) => (
                                <div key={label} className="radar-metric" style={{ marginBottom: '6px' }}>
                                    <div className="metric-title" style={{ color: '#c0c8cc' }}>{label}</div>
                                    <div
                                        className="metric-bar-wrapper"
                                        style={{
                                            position: 'relative',
                                            height: '10px',
                                            background: 'rgba(255,255,255,0.03)',
                                            borderRadius: '2px',
                                            border: '1px solid rgba(255,255,255,0.05)',
                                            overflow: 'visible',
                                        }}
                                    >
                                        <div
                                            style={{
                                                position: 'absolute',
                                                left: `${avg}%`,
                                                top: '-4px',
                                                bottom: '-4px',
                                                width: '1px',
                                                borderLeft: '1px dashed rgba(255,255,255,0.4)',
                                                zIndex: 2,
                                            }}
                                            title={`Global Avg: ${avg}%`}
                                        />
                                        <div
                                            className="metric-bar"
                                            style={{
                                                width: `${val}%`,
                                                background: `linear-gradient(90deg, ${color}88, ${color})`,
                                                height: '100%',
                                                borderRadius: '1px',
                                                boxShadow: `0 0 6px ${color}`,
                                                transition: 'width 0.5s ease',
                                            }}
                                        />
                                    </div>
                                    <div className="metric-value-row" style={{ textAlign: 'right', display: 'flex', justifyContent: 'space-between', marginTop: '1px' }}>
                                        <span className="metric-average" style={{ color: '#a5b4bc' }}>avg {avg}%</span>
                                        <span style={{ color: '#fff', fontWeight: 700 }}>{val}%</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {inspectTab === 'gpc' && (
                <div className="inspect-tab-content">
                    {!selectedNode.isAnchor && selectedNode.rawData ? (
                        <div className="inspect-section">
                            <div className="section-label">HL GLOBAL POLITICAL CHALLENGES</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                {Object.entries(getGlobalChallenges(selectedNode.rawData)).map(([ch, txt]) => (
                                    <div key={ch} className="gpc-card">
                                        <div className="gpc-card-header">
                                            <span>{CHALLENGE_ICONS[ch] || '⬢'}</span><span>{ch.toUpperCase()}</span>
                                        </div>
                                        <p className="gpc-card-body">{txt}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <div className="inspect-section">
                            <p className="section-body" style={{ color: '#a5b4bc', fontStyle: 'italic' }}>
                                GPC analysis available for forecast nodes. Click a satellite node to view challenge mapping.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {inspectTab === 'theory' && (
                <div className="inspect-tab-content">
                    {theories[selectedTheory] ? (
                        <div className="inspect-section theoretical-lens-box" style={{ borderLeft: `3px solid ${theories[selectedTheory].color}` }}>
                            <div className="lens-header" style={{ color: readableAccent(theories[selectedTheory].color) }}>
                                <span>⚛ {selectedTheory.toUpperCase()} INTERPRETATION</span>
                            </div>
                            <p className="lens-text">
                                {theories[selectedTheory].getInterpretation
                                    ? theories[selectedTheory].getInterpretation(selectedNode.rawData || {
                                        'Entity/Subject': selectedNode.name,
                                        'Key Player/Organization': selectedNode.players,
                                        'Expected Impact/Value': selectedNode.desc,
                                        Broad_Category: selectedNode.category,
                                    })
                                    : 'No lens translation available.'}
                            </p>
                        </div>
                    ) : (
                        <div className="inspect-section">
                            <p className="section-body" style={{ color: '#a5b4bc' }}>
                                Select an IR theory lens from the top bar to see interpretation.
                            </p>
                        </div>
                    )}
                </div>
            )}
        </aside>
    );
}

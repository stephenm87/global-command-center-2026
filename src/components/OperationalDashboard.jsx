import React from 'react';

export default function OperationalDashboard({
    visible,
    metricsCollapsed,
    onToggleCollapse,
    keyMetrics = {},
    minerals = {},
    onOpenMinerals,
    tensionMeter = 0,
    stressLevel = 0,
    onStressLevelChange,
    escalationPairs = [],
    showConnections = false,
    onToggleConnections,
    timelineYear = 'ALL',
    onTimelineYearChange,
}) {
    return (
        <section
            className={`metrics-shell${metricsCollapsed ? ' collapsed' : ''}`}
            aria-label="Operational metrics and scenario controls"
            style={!visible ? { display: 'none' } : {}}
        >
            <button
                type="button"
                className="metrics-collapse-toggle"
                aria-expanded={!metricsCollapsed}
                aria-controls="operational-metrics"
                onClick={onToggleCollapse}
            >
                <span>OPERATIONAL DASHBOARD</span>
                <span aria-hidden="true">{metricsCollapsed ? '▲ SHOW' : '▼ HIDE'}</span>
            </button>
            <div id="operational-metrics" className="metrics-bar" hidden={metricsCollapsed}>
                <div className="metric-item">
                    <span className="metric-label">TOTAL EVENTS</span>
                    <span className="metric-value">{keyMetrics.totalEvents || 0}</span>
                </div>
                <button
                    type="button"
                    className="metric-item minerals-panel"
                    onClick={onOpenMinerals}
                    aria-label="Open critical minerals prices"
                >
                    <span className="metric-label">⛏️ CRITICAL MINERALS</span>
                    <span className="minerals-grid">
                        <span className="mineral-item">
                            <span className="mineral-symbol">Au</span>
                            <span className="mineral-price gold">{minerals.gold?.price || 'N/A'}</span>
                        </span>
                        <span className="mineral-item">
                            <span className="mineral-symbol">Ag</span>
                            <span className="mineral-price silver">{minerals.silver?.price || 'N/A'}</span>
                        </span>
                        <span className="mineral-item">
                            <span className="mineral-symbol">+4</span>
                            <span className="mineral-price mineral-price--more">VIEW ALL</span>
                        </span>
                    </span>
                </button>
                <div className="metric-item tension-meter">
                    <span className="metric-label">CONFLICT EVENT RATIO</span>
                    <div className="tension-bar">
                        <div className="tension-fill" style={{ width: `${tensionMeter}%` }} />
                        <span className="tension-value">{tensionMeter}%</span>
                    </div>
                </div>
                <div className="metric-item stress-control">
                    <span className="metric-label">SCENARIO SIMULATOR</span>
                    <span className="stress-subtitle">Drag to model &quot;what-if&quot; escalation</span>
                    <input
                        type="range"
                        min="0"
                        max="100"
                        aria-label="Scenario simulator escalation level"
                        value={stressLevel}
                        onChange={e => onStressLevelChange(Number.parseInt(e.target.value, 10))}
                        className="stress-slider"
                    />
                    <span className="stress-level-label">
                        {stressLevel === 0 ? 'BASELINE' : stressLevel < 40 ? 'LOW TENSION' : stressLevel < 70 ? 'ELEVATED' : 'CRITICAL'}
                        {stressLevel > 50 && escalationPairs.length > 0 && (
                            <span
                                className="arc-count-badge"
                                title={stressLevel > 70 ? 'Press L to toggle links panel' : ''}
                                onClick={() => stressLevel > 70 && onToggleConnections()}
                                style={{ cursor: stressLevel > 70 ? 'pointer' : 'default' }}
                            >
                                · {escalationPairs.length} ARCS {stressLevel > 70 ? (showConnections ? '▼' : '▲') : ''}
                            </span>
                        )}
                    </span>
                    <div className="timeline-filter">
                        <span className="timeline-label">📅 TIMELINE</span>
                        <div className="timeline-year-btns">
                            {['ALL', '2023', '2024', '2025', '2026'].map(y => (
                                <button
                                    key={y}
                                    type="button"
                                    className={`timeline-year-btn${timelineYear === y ? ' active' : ''}`}
                                    onClick={() => onTimelineYearChange(y)}
                                >
                                    {y === 'ALL' ? 'ALL' : `'${y.slice(2)}`}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
}

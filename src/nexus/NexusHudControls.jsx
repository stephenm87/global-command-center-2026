import React from 'react';
import * as NexusAudio from '../nexusAudio';
import { getAccessibleTextAccent } from '../navigationState.mjs';
import { PRIMARY_ANCHORS, DIM_COLORS, GPC_NODE_MAP } from './nexusData';

const GPC_CHALLENGES = [
    ['security', '🛡', 'Security'],
    ['borders', '🚧', 'Borders'],
    ['identity', '🧬', 'Identity'],
    ['technology', '💻', 'Technology'],
    ['environment', '🌍', 'Environment'],
    ['health', '🏥', 'Health'],
    ['poverty', '📉', 'Poverty'],
    ['equality', '⚖', 'Equality'],
];

const PHYSICS_PRESETS = [
    ['balance', '⚖️ BALANCE'],
    ['friction', '⚡ FRICTION'],
    ['core', '⬢ CORE-PERIPH.'],
];

export default function NexusHudControls({
    nodeCount = 0,
    edgeCount = 0,
    onResetCamera,
    lockedNode,
    onUnlock,
    selectedNode,
    hudTab,
    onSelectHudTab,
    dimensions,
    onToggleDimension,
    selectedGPC,
    onSelectGPC,
    pulseSignals = [],
    gdeltArticles = [],
    showSatellites,
    onToggleSatellites,
    intensityThreshold,
    onIntensityChange,
    physicsPreset,
    onSelectPhysicsPreset,
    is2D,
    onSetIs2D,
    ambientOn,
    onSetAmbientOn,
    audioMuted,
    onSetAudioMuted,
    audioVolume,
    onSetAudioVolume,
    expandedAnchors = {},
    anchorSatCounts = {},
    onToggleAnchorExpand,
    onExpandAll,
    onCollapseAll,
    onSelectQuickActor,
}) {
    return (
        <>
            <div className="nexus-telemetry">
                <div>NODES: {nodeCount} · EDGES: {edgeCount}</div>
                <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                    <button type="button" onClick={onResetCamera} className="nexus-ctrl-btn" title="Reset camera to overview">⟲ RESET VIEW</button>
                    {lockedNode && (
                        <button
                            type="button"
                            onClick={onUnlock}
                            className="nexus-ctrl-btn"
                            style={{ borderColor: '#ff9900', color: '#ff9900' }}
                            title="Unlock current view"
                        >
                            🔓 UNLOCK
                        </button>
                    )}
                </div>
                <div className="nexus-hint">
                    {lockedNode
                        ? '🔒 LOCKED — Shift+click to compare · Esc to unlock · ←→ cycle'
                        : selectedNode
                            ? '⬡ Esc: deselect · Ctrl+K: search · ←→: cycle'
                            : '⬡ Click node to inspect · Ctrl+K to search · Lock to explore'}
                </div>
            </div>

            <div className="nexus-hud-legend" role="region" aria-label="Advanced Nexus controls">
                <div className="hud-tabs" role="group" aria-label="Advanced Nexus controls">
                    <button type="button" aria-pressed={hudTab === 'filters'} className={`hud-tab ${hudTab === 'filters' ? 'active' : ''}`} onClick={() => onSelectHudTab('filters')}>⬡ FILTERS</button>
                    <button type="button" aria-pressed={hudTab === 'controls'} className={`hud-tab ${hudTab === 'controls' ? 'active' : ''}`} onClick={() => onSelectHudTab('controls')}>⚙ CONTROLS</button>
                    <button type="button" aria-pressed={hudTab === 'actors'} className={`hud-tab ${hudTab === 'actors' ? 'active' : ''}`} onClick={() => onSelectHudTab('actors')}>◉ ACTORS</button>
                </div>

                <div className="hud-tab-panel">
                    {hudTab === 'filters' && (
                        <>
                            <div className="hud-header">DIMENSION FILTERS</div>
                            {Object.entries({
                                trade: 'ECONOMY & TRADE',
                                conflict: 'CONFLICT & FRICTION',
                                diplomacy: 'DIPLOMACY & TREATIES',
                                tech: 'TECH & MINERALS',
                            }).map(([key, label]) => {
                                const textColor = getAccessibleTextAccent(DIM_COLORS[key]);
                                return (
                                    <label
                                        key={key}
                                        className="dim-filter-row"
                                        style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', '--dim-color': DIM_COLORS[key] }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={Boolean(dimensions?.[key])}
                                            onChange={() => onToggleDimension(key)}
                                        />
                                        <span style={{ color: textColor }}>{label}</span>
                                    </label>
                                );
                            })}

                            <div className="hud-header" style={{ marginTop: '12px' }}>GPC CHALLENGES</div>
                            <div className="gpc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                                {GPC_CHALLENGES.map(([key, icon, name]) => {
                                    const sel = selectedGPC === key;
                                    return (
                                        <button
                                            key={key}
                                            type="button"
                                            className="gpc-filter-btn"
                                            aria-pressed={sel}
                                            onClick={() => onSelectGPC(sel ? null : key)}
                                            style={{
                                                background: sel ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${sel ? '#00ffff' : 'rgba(255,255,255,0.1)'}`,
                                                color: sel ? '#00ffff' : '#c0c8cc',
                                                fontFamily: 'Roboto Mono, monospace',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.15s',
                                            }}
                                            title={`Focus on ${name}`}
                                        >
                                            {icon} {name.toUpperCase()}
                                        </button>
                                    );
                                })}
                            </div>
                            {selectedGPC && (
                                <div
                                    className="nexus-gpc-status"
                                    style={{
                                        marginBottom: '8px',
                                        padding: '6px 10px',
                                        background: 'rgba(0,255,255,0.06)',
                                        border: '1px solid rgba(0,255,255,0.15)',
                                        borderRadius: '4px',
                                        color: '#00ffff',
                                        letterSpacing: '1px',
                                        textAlign: 'center',
                                    }}
                                >
                                    VIEWING: {selectedGPC.toUpperCase()} CHALLENGE
                                    <br />
                                    <span className="nexus-gpc-status-count" style={{ color: '#a5b4bc' }}>
                                        {GPC_NODE_MAP[selectedGPC] ? `${GPC_NODE_MAP[selectedGPC].length} relevant actors` : ''}
                                    </span>
                                </div>
                            )}

                            {pulseSignals.length > 0 && (
                                <div className="pulse-indicator">📡 LIVE: {pulseSignals.length} actors in news</div>
                            )}
                            {gdeltArticles.length > 0 && (
                                <div className="gdelt-feed">
                                    <div className="section-label" style={{ marginTop: '6px', marginBottom: '4px' }}>LIVE INTEL</div>
                                    {gdeltArticles
                                        .filter(a => typeof a?.url === 'string' && /^https?:\/\//i.test(a.url.trim()))
                                        .slice(0, 4)
                                        .map((a, i) => (
                                            <a
                                                key={i}
                                                href={a.url.trim()}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="gdelt-item"
                                                style={{ borderLeftColor: a.tone < -2 ? '#ff0066' : a.tone > 2 ? '#00ff88' : '#888' }}
                                            >
                                                {(a.title || '').slice(0, 80)}{(a.title || '').length > 80 ? '…' : ''}
                                            </a>
                                        ))}
                                </div>
                            )}
                        </>
                    )}

                    {hudTab === 'controls' && (
                        <>
                            <div className="hud-header">GRAPH CONTROLS</div>
                            <div className="graph-control-row">
                                <label className="ctrl-label">Satellites</label>
                                <button
                                    type="button"
                                    className={`ctrl-toggle ${showSatellites ? 'on' : ''}`}
                                    aria-pressed={showSatellites}
                                    onClick={onToggleSatellites}
                                >
                                    {showSatellites ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div className="graph-control-row">
                                <label className="ctrl-label" htmlFor="nexus-link-intensity">Link Intensity</label>
                                <input
                                    id="nexus-link-intensity"
                                    type="range"
                                    min="0"
                                    max="3"
                                    step="0.2"
                                    value={intensityThreshold}
                                    aria-valuetext={intensityThreshold > 0 ? `At least ${intensityThreshold.toFixed(1)}` : 'All links'}
                                    onChange={e => onIntensityChange(Number.parseFloat(e.target.value))}
                                    className="audio-slider"
                                />
                                <span className="ctrl-value">{intensityThreshold > 0 ? `≥${intensityThreshold.toFixed(1)}` : 'ALL'}</span>
                            </div>

                            <div className="hud-header" style={{ marginTop: '12px' }}>PHYSICS</div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                                {PHYSICS_PRESETS.map(([id, label]) => {
                                    const act = physicsPreset === id;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            className="physics-preset-btn"
                                            aria-pressed={act}
                                            onClick={() => onSelectPhysicsPreset(id)}
                                            style={{
                                                flex: 1,
                                                background: act ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.02)',
                                                border: `1px solid ${act ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                                                color: act ? '#00ff88' : '#b4bec3',
                                                fontFamily: 'Roboto Mono, monospace',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                transition: 'all 0.15s',
                                            }}
                                        >
                                            {label}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="hud-header" style={{ marginTop: '12px' }}>VIEW MODE</div>
                            <div className="view-toggle">
                                <button
                                    type="button"
                                    className={`view-toggle-btn ${!is2D ? 'active' : ''}`}
                                    aria-pressed={!is2D}
                                    onClick={() => onSetIs2D(false)}
                                >
                                    ◈ 3D
                                </button>
                                <button
                                    type="button"
                                    className={`view-toggle-btn ${is2D ? 'active' : ''}`}
                                    aria-pressed={is2D}
                                    onClick={() => onSetIs2D(true)}
                                >
                                    ◻ 2D
                                </button>
                            </div>
                            <div className="view-mode-label">
                                ACTIVE: {is2D ? '2D FLAT MAP' : '3D SPATIAL'}
                            </div>

                            <div className="hud-header" style={{ marginTop: '12px' }}>AUDIO</div>
                            <div className="graph-control-row" style={{ marginBottom: '6px' }}>
                                <label className="ctrl-label">Ambient Pad</label>
                                <button
                                    type="button"
                                    className={`ctrl-toggle ${ambientOn ? 'on' : ''}`}
                                    aria-pressed={ambientOn}
                                    onClick={() => {
                                        if (ambientOn) {
                                            NexusAudio.stopAmbient();
                                            onSetAmbientOn(false);
                                        } else {
                                            NexusAudio.startAmbient();
                                            onSetAmbientOn(true);
                                        }
                                    }}
                                >
                                    {ambientOn ? 'ON' : 'OFF'}
                                </button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                    type="button"
                                    className="audio-mute-btn"
                                    aria-label={audioMuted ? 'Unmute Nexus audio' : 'Mute Nexus audio'}
                                    aria-pressed={audioMuted}
                                    onClick={() => {
                                        const m = NexusAudio.toggleMute();
                                        onSetAudioMuted(m);
                                    }}
                                >
                                    {audioMuted ? '🔇' : '🔊'}
                                </button>
                                <input
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={audioVolume}
                                    aria-label="Nexus audio volume"
                                    aria-valuetext={`${Math.round(audioVolume * 100)} percent`}
                                    onChange={e => {
                                        const v = Number.parseFloat(e.target.value);
                                        onSetAudioVolume(v);
                                        NexusAudio.setVolume(v);
                                    }}
                                    className="audio-slider"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </>
                    )}

                    {hudTab === 'actors' && (
                        <>
                            <div className="hud-header">ACTOR CLUSTERS</div>
                            <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                                <button type="button" onClick={onExpandAll} className="nexus-ctrl-btn" style={{ flex: 1 }}>▼ EXPAND ALL</button>
                                <button type="button" onClick={onCollapseAll} className="nexus-ctrl-btn" style={{ flex: 1 }}>▲ COLLAPSE ALL</button>
                            </div>
                            <div className="anchor-legend-list">
                                {Object.entries(PRIMARY_ANCHORS).map(([id, a]) => {
                                    const isExp = Boolean(expandedAnchors[id]);
                                    const count = anchorSatCounts[id] || 0;
                                    return (
                                        <button
                                            key={id}
                                            type="button"
                                            className={`anchor-legend-item ${isExp ? 'expanded' : ''}`}
                                            aria-expanded={isExp}
                                            onClick={() => onToggleAnchorExpand(id)}
                                            style={{ '--anchor-color': a.color }}
                                        >
                                            <span className="anchor-dot" style={{ background: a.color }} />
                                            <span className="anchor-label">{a.name}</span>
                                            <span className="anchor-count">{isExp ? '▾' : '▸'} {count}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="hud-header" style={{ marginTop: '12px' }}>QUICK NAV</div>
                            <div className="actor-list">
                                {Object.values(PRIMARY_ANCHORS).map(a => (
                                    <button
                                        key={a.id}
                                        type="button"
                                        className="actor-list-item"
                                        style={{ borderLeftColor: a.color, color: (selectedNode && selectedNode.id === a.id) ? '#fff' : '#a5b4bc' }}
                                        onClick={() => onSelectQuickActor(a.id)}
                                    >
                                        {a.name.split('(')[0].trim()}
                                    </button>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </>
    );
}

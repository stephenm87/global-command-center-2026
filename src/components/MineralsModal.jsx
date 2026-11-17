import React from 'react';
import criticalMineralsCatalog from '../data/criticalMinerals.json';

const MINERAL_ROWS = [
    { key: 'gold', symbol: 'Au', name: 'Gold', color: '#ffd700' },
    { key: 'silver', symbol: 'Ag', name: 'Silver', color: '#c0c0c0' },
    { key: 'lithium', symbol: 'Li', name: 'Lithium', color: '#00ccff' },
    { key: 'cobalt', symbol: 'Co', name: 'Cobalt', color: '#9966ff' },
    { key: 'copper', symbol: 'Cu', name: 'Copper', color: '#ff9900' },
    { key: 'rareEarths', symbol: 'REE', name: 'Rare Earths', color: '#00ff88' },
];

export default function MineralsModal({ open, minerals = {}, modalRef, onClose }) {
    if (!open) return null;
    const defaults = criticalMineralsCatalog.minerals;

    return (
        <div className="detail-modal" onClick={onClose}>
            <div
                ref={modalRef}
                className="modal-content minerals-matrix-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="minerals-dialog-title"
                tabIndex="-1"
                onClick={e => e.stopPropagation()}
            >
                <button type="button" className="close-btn" aria-label="Close critical minerals matrix" onClick={onClose}>✕</button>
                <div className="modal-header" style={{ borderBottomColor: '#ffd700' }}>
                    <span className="modal-category" style={{ color: '#ffd700' }}>STRATEGIC RESOURCES</span>
                    <h2 id="minerals-dialog-title">⛏️ CRITICAL MINERALS MATRIX</h2>
                </div>
                <div className="modal-body">
                    <table className="minerals-table">
                        <thead>
                            <tr>
                                <th>SYMBOL</th>
                                <th>MINERAL</th>
                                <th>BENCHMARK / STATUS</th>
                                <th>PRIMARY ORIGINS</th>
                                <th>MAJOR PLAYERS</th>
                            </tr>
                        </thead>
                        <tbody>
                            {MINERAL_ROWS.map(m => {
                                const entry = { ...defaults[m.key], ...(minerals[m.key] || {}) };
                                return (
                                    <tr key={m.key}>
                                        <td>
                                            <span className="table-symbol" style={{ color: m.color, textShadow: `0 0 8px ${m.color}44` }}>
                                                {entry.symbol || m.symbol}
                                            </span>
                                        </td>
                                        <td className="mineral-name">{m.name}</td>
                                        <td>
                                            <span className="table-price" style={{ color: m.color }}>
                                                {entry.price || defaults[m.key].price}
                                                {entry.unit && entry.price && !entry.price.includes('/') && !entry.price.includes('ref') && (
                                                    <span className="price-unit">{entry.unit}</span>
                                                )}
                                            </span>
                                        </td>
                                        <td className="origins-cell">{entry.origins || '—'}</td>
                                        <td className="players-cell">{entry.players || '—'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    <div className="minerals-footer">
                        <span>
                            📊 {criticalMineralsCatalog.asOf} reference baselines —{' '}
                            <a href={criticalMineralsCatalog.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#5eead4' }}>
                                {criticalMineralsCatalog.sourceLabel} ↗
                            </a>
                        </span>
                        <span>Data for educational purposes only</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

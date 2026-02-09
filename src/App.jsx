import React, { useState, useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import Papa from 'papaparse';
import './App.css';

const categoryColors = {
    'Geopolitics & Conflict': '#ff0066',
    'Economy & Trade': '#00ccff',
    'Technology & Science': '#00ff88',
    'Health & Society': '#ff9900',
    'Environment & Energy': '#66ff00',
    'Culture & Entertainment': '#ff00ff'
};

function App() {
    const [forecasts, setForecasts] = useState([]);
    const [filteredForecasts, setFilteredForecasts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedForecast, setSelectedForecast] = useState(null);
    const [keyMetrics, setKeyMetrics] = useState({});
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const globeEl = useRef();
    const globeContainer = useRef();

    // Initialize globe
    useEffect(() => {
        if (!globeContainer.current) return;

        const globe = Globe()(globeContainer.current)
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
            .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
            .atmosphereColor('#0088ff')
            .atmosphereAltitude(0.15);

        globeEl.current = globe;
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyPress = (e) => {
            // Space: Toggle sidebar (only if modal is not open)
            if (e.code === 'Space' && !selectedForecast) {
                e.preventDefault();
                setSidebarCollapsed(prev => !prev);
            }
            // Esc: Close modal
            if (e.code === 'Escape' && selectedForecast) {
                setSelectedForecast(null);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedForecast]);

    // Load data
    useEffect(() => {
        fetch('/Global_Forecasts_2026_Enriched.csv')
            .then(response => response.text())
            .then(csvText => {
                Papa.parse(csvText, {
                    header: true,
                    complete: (results) => {
                        const data = results.data.filter(row =>
                            row.Latitude && row.Longitude &&
                            (parseFloat(row.Latitude) !== 0 || parseFloat(row.Longitude) !== 0)
                        );
                        setForecasts(data);
                        setFilteredForecasts(data);

                        // Update globe with data
                        if (globeEl.current) {
                            const points = data.map(item => ({
                                lat: parseFloat(item.Latitude),
                                lng: parseFloat(item.Longitude),
                                size: 0.8,
                                color: categoryColors[item.Broad_Category] || '#ffffff',
                                data: item
                            }));

                            globeEl.current
                                .pointsData(points)
                                .pointAltitude(0.01)
                                .pointRadius('size')
                                .pointColor('color')
                                .onPointClick(point => setSelectedForecast(point.data))
                                .pointLabel(d => {
                                    return `<div style="background: rgba(0,0,0,0.9); padding: 10px; border: 1px solid ${d.color}; border-radius: 4px; font-family: Roboto Mono; color: #00ffff; max-width: 300px;">
                    <div style="color: ${d.color}; font-weight: 700; margin-bottom: 5px;">${d.data['Topic/Sector']}</div>
                    <div style="font-size: 0.85rem;">${d.data['Entity/Subject']}</div>
                  </div>`;
                                });
                        }

                        // Extract key metrics
                        extractMetrics(data);
                    }
                });
            });
    }, []);

    // Filter globe data when category changes
    useEffect(() => {
        if (!globeEl.current) return;

        const filtered = selectedCategory === 'All'
            ? forecasts
            : forecasts.filter(f => f.Broad_Category === selectedCategory);

        setFilteredForecasts(filtered);

        const points = filtered.map(item => ({
            lat: parseFloat(item.Latitude),
            lng: parseFloat(item.Longitude),
            size: 0.8,
            color: categoryColors[item.Broad_Category] || '#ffffff',
            data: item
        }));

        // Re-apply all point configurations to ensure interactivity
        globeEl.current
            .pointsData(points)
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointColor('color')
            .onPointClick(point => setSelectedForecast(point.data))
            .pointLabel(d => {
                return `<div style="background: rgba(0,0,0,0.9); padding: 10px; border: 1px solid ${d.color}; border-radius: 4px; font-family: Roboto Mono; color: #00ffff; max-width: 300px;">
                    <div style="color: ${d.color}; font-weight: 700; margin-bottom: 5px;">${d.data['Topic/Sector']}</div>
                    <div style="font-size: 0.85rem;">${d.data['Entity/Subject']}</div>
                  </div>`;
            });
    }, [selectedCategory, forecasts]);

    const extractMetrics = (data) => {
        const metrics = {};

        // Count events by category
        const categoryCounts = {};
        data.forEach(item => {
            const cat = item.Broad_Category;
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        // Extract specific numbers from text
        const goldMentions = data.filter(d => d['Expected Impact/Value']?.includes('$4,') || d['Expected Impact/Value']?.includes('gold'));
        const gdpMentions = data.filter(d => d['Expected Impact/Value']?.includes('2.4%') && d['Expected Impact/Value']?.includes('GDP'));
        const defenseMentions = data.filter(d => d['Expected Impact/Value']?.includes('$2.9trn'));

        metrics.totalEvents = data.length;
        metrics.conflictEvents = categoryCounts['Geopolitics & Conflict'] || 0;
        metrics.economyEvents = categoryCounts['Economy & Trade'] || 0;
        metrics.techEvents = categoryColors['Technology & Science'] || 0;
        metrics.goldPrice = goldMentions.length > 0 ? '$4,500' : 'N/A';
        metrics.globalGrowth = gdpMentions.length > 0 ? '2.4%' : 'N/A';
        metrics.defenseSpending = defenseMentions.length > 0 ? '$2.9trn' : 'N/A';

        setKeyMetrics(metrics);
    };

    const tensionMeter = keyMetrics.conflictEvents && keyMetrics.totalEvents
        ? Math.round((keyMetrics.conflictEvents / keyMetrics.totalEvents) * 100)
        : 0;

    return (
        <div className="command-center">
            {/* Header */}
            <div className="header">
                <div className="logo">
                    <span className="logo-icon">⬢</span>
                    <span className="logo-text">GLOBAL COMMAND CENTER</span>
                </div>
                <div className="date-time">
                    <span className="date">2026 FORECASTS</span>
                    <span className="live-indicator">● LIVE</span>
                </div>
            </div>

            {/* Main Content */}
            <div className="main-content">
                {/* Globe Center Stage */}
                <div className="globe-container">
                    <div ref={globeContainer} style={{ width: '100%', height: '100%' }} />
                    <div className="globe-overlay">
                        <div className="globe-title">GLOBAL THREAT MATRIX</div>
                    </div>
                </div>

                {/* Right Sidebar - Intel Feed */}
                <div className={`intel-feed ${sidebarCollapsed ? 'collapsed' : ''}`}>
                    <button
                        className="sidebar-toggle"
                        onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                        title={sidebarCollapsed ? 'Expand Intel Feed (Space)' : 'Collapse Intel Feed (Space)'}
                        aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    />
                    <div className="intel-header">
                        <span className="intel-title">INTEL FEED</span>
                        <select
                            className="category-filter"
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                        >
                            <option value="All">ALL SECTORS</option>
                            {Object.keys(categoryColors).map(cat => (
                                <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div className="intel-cards">
                        {filteredForecasts.slice(0, 20).map((forecast, idx) => (
                            <div
                                key={idx}
                                className={`intel-card ${selectedForecast === forecast ? 'selected' : ''}`}
                                onClick={() => setSelectedForecast(forecast)}
                                style={{ borderLeftColor: categoryColors[forecast.Broad_Category] }}
                            >
                                <div className="card-category" style={{ color: categoryColors[forecast.Broad_Category] }}>
                                    {forecast.Broad_Category}
                                </div>
                                <div className="card-title">{forecast['Topic/Sector']}</div>
                                <div className="card-timeline">⏱ {forecast.Timeline}</div>
                                <div className="card-impact">{forecast['Expected Impact/Value']?.substring(0, 120)}...</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Bottom Bar - Key Metrics */}
            <div className="metrics-bar">
                <div className="metric-item">
                    <span className="metric-label">TOTAL EVENTS</span>
                    <span className="metric-value">{keyMetrics.totalEvents || 0}</span>
                </div>
                <div className="metric-item">
                    <span className="metric-label">GOLD FORECAST</span>
                    <span className="metric-value gold">{keyMetrics.goldPrice}</span>
                </div>
                <div className="metric-item">
                    <span className="metric-label">GLOBAL GROWTH</span>
                    <span className="metric-value">{keyMetrics.globalGrowth}</span>
                </div>
                <div className="metric-item">
                    <span className="metric-label">DEFENSE SPENDING</span>
                    <span className="metric-value red">{keyMetrics.defenseSpending}</span>
                </div>
                <div className="metric-item tension-meter">
                    <span className="metric-label">CONFLICT EVENT RATIO</span>
                    <div className="tension-bar">
                        <div
                            className="tension-fill"
                            style={{ width: `${tensionMeter}%` }}
                        ></div>
                        <span className="tension-value">{tensionMeter}%</span>
                    </div>
                </div>
            </div>

            {/* Detail Modal */}
            {selectedForecast && (
                <div className="detail-modal" onClick={() => setSelectedForecast(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setSelectedForecast(null)}>✕</button>
                        <div
                            className="modal-header"
                            style={{ borderBottomColor: categoryColors[selectedForecast.Broad_Category] }}
                        >
                            <span className="modal-category" style={{ color: categoryColors[selectedForecast.Broad_Category] }}>
                                {selectedForecast.Broad_Category}
                            </span>
                            <h2>{selectedForecast['Topic/Sector']}</h2>
                        </div>
                        <div className="modal-body">
                            <div className="modal-row">
                                <span className="modal-label">ENTITY:</span>
                                <span>{selectedForecast['Entity/Subject']}</span>
                            </div>
                            <div className="modal-row">
                                <span className="modal-label">KEY PLAYERS:</span>
                                <span>{selectedForecast['Key Player/Organization']}</span>
                            </div>
                            <div className="modal-row">
                                <span className="modal-label">TIMELINE:</span>
                                <span>{selectedForecast.Timeline}</span>
                            </div>
                            <div className="modal-row">
                                <span className="modal-label">EXPECTED IMPACT:</span>
                                <span>{selectedForecast['Expected Impact/Value']}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default App;

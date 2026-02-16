import React, { useState, useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import Papa from 'papaparse';
import { theories, getTheoryInterpretation } from './theories';
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
    const [selectedTheory, setSelectedTheory] = useState('Realism');

    const [stressLevel, setStressLevel] = useState(0);
    const [keyMetrics, setKeyMetrics] = useState({});
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const globeEl = useRef();
    const globeContainer = useRef();
    const attributionRef = useRef();
    const dashboardRef = useRef();

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
        const fetchCSV = fetch('/Global_Forecasts_2026_Enriched.csv')
            .then(response => response.text())
            .then(csvText => {
                return new Promise((resolve) => {
                    Papa.parse(csvText, {
                        header: true,
                        complete: (results) => {
                            const data = results.data.filter(row =>
                                row.Latitude && row.Longitude &&
                                (parseFloat(row.Latitude) !== 0 || parseFloat(row.Longitude) !== 0)
                            );
                            resolve(data);
                        }
                    });
                });
            });

        const fetchLive = fetch('/live_intel.json')
            .then(response => response.ok ? response.json() : [])
            .catch(() => []);

        Promise.all([fetchCSV, fetchLive]).then(([csvData, liveData]) => {
            const combinedData = [
                ...liveData.map(item => ({ ...item, isLive: true })),
                ...csvData
            ];
            setForecasts(combinedData);
            setFilteredForecasts(combinedData);

            if (globeEl.current) {
                const points = combinedData.map(item => ({
                    lat: parseFloat(item.Latitude),
                    lng: parseFloat(item.Longitude),
                    size: item.isLive ? 1.2 : 0.8,
                    color: item.isLive ? '#00ffff' : (categoryColors[item.Broad_Category] || '#ffffff'),
                    data: item
                }));

                globeEl.current
                    .pointsData(points)
                    .pointAltitude(0.01)
                    .pointRadius('size')
                    .pointColor('color')
                    .onPointClick(point => setSelectedForecast(point.data))
                    .pointLabel(d => {
                        const isLinked = d.data.url ? '<div style="color: #00ff88; font-size: 0.7rem; margin-top: 5px; font-weight: bold;">[ CLICK FOR LIVE INTEL ]</div>' : '';
                        return `<div style="background: rgba(0,0,0,0.9); padding: 12px; border: 1px solid ${d.color}; border-radius: 4px; font-family: Roboto Mono; color: #00ffff; max-width: 300px; box-shadow: 0 0 15px ${d.color}44;">
                    <div style="color: ${d.color}; font-weight: 700; margin-bottom: 5px;">${d.data.isLive ? '[LIVE] ' : ''}${d.data['Topic/Sector']}</div>
                    <div style="font-size: 0.85rem; color: #fff;">${d.data['Entity/Subject']}</div>
                    ${isLinked}
                  </div>`;
                    });
            }
            extractMetrics(combinedData);
        });
    }, []);

    // Load Student Pins from LocalStorage
    useEffect(() => {
        const savedPins = localStorage.getItem('gcc_student_pins');
        if (savedPins) {
            try {
                setStudentPins(JSON.parse(savedPins));
            } catch (e) {
                console.error('Failed to parse student pins', e);
            }
        }
    }, []);



    // Update Globe Points (including Student Pins)
    const updateGlobeData = () => {
        if (!globeEl.current) return;

        const filtered = selectedCategory === 'All'
            ? forecasts
            : selectedCategory === 'Live Intel'
                ? forecasts.filter(f => f.isLive)
                : forecasts.filter(f => f.Broad_Category === selectedCategory);

        setFilteredForecasts(filtered);

        const forecastPoints = filtered.map(item => ({
            lat: parseFloat(item.Latitude),
            lng: parseFloat(item.Longitude),
            size: item.isLive ? 1.2 : 0.8,
            color: item.isLive ? '#00ffff' : (categoryColors[item.Broad_Category] || '#ffffff'),
            data: item,
            type: 'forecast'
        }));

        globeEl.current
            .pointsData(forecastPoints)
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointColor('color')
            .onPointClick(point => setSelectedForecast(point.data))
            .pointLabel(d => {
                const isLinked = d.data.url ? '<div style="color: #00ff88; font-size: 0.7rem; margin-top: 5px; font-weight: bold;">[ CLICK FOR LIVE INTEL ]</div>' : '';
                return `<div style="background: rgba(0,0,0,0.9); padding: 12px; border: 1px solid ${d.color}; border-radius: 4px; font-family: Roboto Mono; color: #00ffff; max-width: 300px; box-shadow: 0 0 15px ${d.color}44;">
                    <div style="color: ${d.color}; font-weight: 700; margin-bottom: 5px;">${d.data.isLive ? '[LIVE] ' : ''}${d.data['Topic/Sector']}</div>
                    <div style="font-size: 0.85rem; color: #fff;">${d.data['Entity/Subject']}</div>
                    ${isLinked}
                  </div>`;
            });

        // Crisis Simulation visuals
        const stressColor = stressLevel > 70 ? '#ff3300' : stressLevel > 40 ? '#ff9900' : '#0088ff';
        globeEl.current.atmosphereColor(stressColor);
        globeEl.current.atmosphereAltitude(0.15 + (stressLevel / 500));

        // Escalation Arcs (only at high stress)
        if (stressLevel > 50) {
            const conflictPoints = forecastPoints.filter(p => p.data.Broad_Category === 'Geopolitics & Conflict').slice(0, 10);
            const arcs = [];
            for (let i = 0; i < conflictPoints.length - 1; i += 2) {
                arcs.push({
                    startLat: conflictPoints[i].lat,
                    startLng: conflictPoints[i].lng,
                    endLat: conflictPoints[i + 1].lat,
                    endLng: conflictPoints[i + 1].lng,
                    color: ['#ff3300', '#ff9900']
                });
            }
            globeEl.current
                .arcsData(arcs)
                .arcColor('color')
                .arcDashLength(0.4)
                .arcDashGap(4)
                .arcDashAnimateTime(4000)
                .arcStroke(0.5);
        } else {
            globeEl.current.arcsData([]);
        }
    };

    useEffect(() => {
        updateGlobeData();
    }, [selectedCategory, forecasts, stressLevel]);

    // Filter logic moved to updateGlobeData

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

    const tensionMeter = Math.min(100, (keyMetrics.conflictEvents && keyMetrics.totalEvents
        ? Math.round((keyMetrics.conflictEvents / keyMetrics.totalEvents) * 100)
        : 0) + (stressLevel / 2));



    return (
        <div className="command-center">
            <div className="dashboard-view" ref={dashboardRef}>
                {/* Header */}
                <div className="header">
                    <div className="logo">
                        <span className="logo-icon">⬢</span>
                        <span className="logo-text">GLOBAL COMMAND CENTER</span>
                    </div>
                    <div className="date-time">
                        <span className="date">2026 FORECASTS</span>
                        <a
                            href="https://glistening-cannoli-9a4914.netlify.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="companion-btn"
                        >
                            LAUNCH GLOPO COMPANION
                        </a>
                        <button
                            className="credits-link"
                            onClick={() => attributionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            CREDITS & LICENSE
                        </button>
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
                                <option value="Live Intel" style={{ color: '#00ffff', fontWeight: 'bold' }}>● LIVE INTEL FEED</option>
                                {Object.keys(categoryColors).map(cat => (
                                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="intel-cards">
                            {filteredForecasts.slice(0, 30).map((forecast, idx) => (
                                <div
                                    key={idx}
                                    className={`intel-card ${selectedForecast === forecast ? 'selected' : ''} ${forecast.isLive ? 'live-item' : ''}`}
                                    onClick={() => setSelectedForecast(forecast)}
                                    style={{ borderLeftColor: forecast.isLive ? '#00ffff' : categoryColors[forecast.Broad_Category] }}
                                >
                                    {forecast.isLive && <div className="live-tag">● LIVE INTEL</div>}
                                    <div className="card-category" style={{ color: forecast.isLive ? '#00ffff' : categoryColors[forecast.Broad_Category] }}>
                                        {forecast.Broad_Category}
                                    </div>
                                    <div className="card-title">{forecast['Topic/Sector']}</div>
                                    <div className="card-timeline">⏱ {forecast.Timeline}</div>
                                    <div className="card-impact">{forecast['Expected Impact/Value']?.substring(0, 120)}...</div>
                                    {forecast.url && (
                                        <a
                                            href={forecast.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="card-link"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            VIEW LIVE REPORT ↗
                                        </a>
                                    )}
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
                    <div className="metric-item stress-control">
                        <span className="metric-label">SCENARIO SIMULATOR</span>
                        <span className="stress-subtitle">Drag to model "what-if" escalation</span>
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={stressLevel}
                            onChange={(e) => setStressLevel(parseInt(e.target.value))}
                            className="stress-slider"
                        />
                        <span className="stress-level-label">{stressLevel === 0 ? 'BASELINE' : stressLevel < 40 ? 'LOW TENSION' : stressLevel < 70 ? 'ELEVATED' : 'CRITICAL'}</span>
                    </div>
                </div>
            </div>


            <div className="netlify-attribution" ref={attributionRef} style={{
                textAlign: 'center',
                padding: '40px 10px',
                background: '#000',
                borderTop: '4px solid #00ffff',
                marginTop: '60px',
                boxShadow: '0 -20px 50px rgba(0, 255, 255, 0.2)',
                position: 'relative',
                zIndex: 5
            }}>
                <div style={{ marginBottom: '30px', maxWidth: '600px', margin: '0 auto 30px auto' }}>
                    <p style={{ color: '#00ffff', fontSize: '12px', fontWeight: 'bold', letterSpacing: '2px', marginBottom: '10px' }}>NON-COMMERCIAL ACADEMIC TOOL</p>
                    <p style={{ color: '#fff', fontSize: '11px', opacity: '0.7', lineHeight: '1.6' }}>
                        This project is a 100% academic tool created by **Stephen Martinez (Project Lead & IB Global Politics Teacher)**
                        to support scholars in the IB Global Politics 2026 Syllabus.
                        It is not a commercial product and provides free pedagogical resources.
                    </p>
                </div>
                <div style={{ marginBottom: '30px' }}>
                    <a href="/CODE_OF_CONDUCT.md" style={{
                        color: '#fff',
                        background: '#ff00ff',
                        padding: '10px 20px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '900',
                        letterSpacing: '2px',
                        borderRadius: '0',
                        border: '2px solid #fff',
                        boxShadow: '0 0 20px #ff00ff'
                    }}>
                        OPEN ACCESS CODE OF CONDUCT
                    </a>
                </div>
                <div style={{ color: '#fff', fontSize: '10px', fontWeight: '900', letterSpacing: '2px', marginBottom: '15px' }}>
                    THIS SITE IS POWERED BY NETLIFY
                </div>
                <a
                    href="https://www.netlify.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                        background: '#fff',
                        padding: '15px 30px',
                        borderRadius: '0',
                        display: 'inline-block',
                        border: '4px solid #00ffff',
                        boxShadow: '0 0 30px #00ffff, inset 0 0 10px #00ffff'
                    }}
                >
                    <img
                        src="https://www.netlify.com/img/global/badges/netlify-color-accent.svg"
                        alt="Deploys by Netlify"
                        style={{ height: '35px', width: 'auto' }}
                    />
                </a>
                <div style={{ marginTop: '40px' }}>
                    <button
                        className="back-to-top"
                        onClick={() => dashboardRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    >
                        ⏶ BACK TO COMMAND CENTER
                    </button>
                </div>
            </div>

            {/* Detail Modal */}
            {
                selectedForecast && (
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

                                <div className="theory-overlay">
                                    <div className="theory-selector">
                                        <span className="modal-label">THEORETICAL LENS:</span>
                                        <div className="theory-buttons">
                                            {Object.keys(theories).map(theory => (
                                                <button
                                                    key={theory}
                                                    className={`theory-btn ${selectedTheory === theory ? 'active' : ''}`}
                                                    style={{ '--theory-color': theories[theory].color }}
                                                    onClick={() => setSelectedTheory(theory)}
                                                >
                                                    {theory.toUpperCase()}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="theory-content" style={{ borderColor: theories[selectedTheory].color }}>
                                        <div className="theory-meta">
                                            <span className="theory-name" style={{ color: theories[selectedTheory].color }}>{selectedTheory}</span>
                                            <p className="theory-desc">{theories[selectedTheory].description}</p>
                                        </div>
                                        <div className="theory-interpretation">
                                            <strong>ANALYSIS:</strong> {getTheoryInterpretation(selectedTheory, selectedForecast)}
                                        </div>
                                    </div>
                                </div>

                                {selectedForecast.url && (
                                    <div className="modal-action">
                                        <a
                                            href={selectedForecast.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="live-report-btn"
                                        >
                                            OPEN SOURCE INTELLIGENCE REPORT ↗
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
}

export default App;

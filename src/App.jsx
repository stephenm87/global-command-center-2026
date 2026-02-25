import React, { useState, useEffect, useRef } from 'react';
import Globe from 'globe.gl';
import Papa from 'papaparse';
import * as topojson from 'topojson-client';
import { theories, getTheoryInterpretation } from './theories';
import { generate5W1H, getGlobalChallenges, CHALLENGE_ICONS } from './eventAnalysis';
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
    const [escalationPairs, setEscalationPairs] = useState([]);
    const [keyMetrics, setKeyMetrics] = useState({});
    const [minerals, setMinerals] = useState({});
    const [showMineralsModal, setShowMineralsModal] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [intelLastUpdated, setIntelLastUpdated] = useState(null);
    const [deepScanResult, setDeepScanResult] = useState(null);
    const [deepScanLoading, setDeepScanLoading] = useState(false);
    const [aiSummary, setAiSummary] = useState(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
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
            .atmosphereAltitude(0.15)
            .showGraticules(false);

        globeEl.current = globe;

        // Load country boundaries GeoJSON
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
            .then(res => res.json())
            .then(worldData => {
                const countries = topojson.feature(worldData, worldData.objects.countries).features;
                if (countries.length > 0) {
                    globe
                        .polygonsData(countries)
                        .polygonAltitude(0.005)
                        .polygonCapColor(() => 'rgba(0, 255, 255, 0.02)')
                        .polygonSideColor(() => 'rgba(0, 255, 255, 0.05)')
                        .polygonStrokeColor(() => 'rgba(0, 255, 255, 0.3)');
                }
            })
            .catch(() => {
                // Fallback: try GeoJSON directly
                fetch('https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson')
                    .then(r => r.json())
                    .then(geoData => {
                        globe
                            .polygonsData(geoData.features)
                            .polygonAltitude(0.005)
                            .polygonCapColor(() => 'rgba(0, 255, 255, 0.02)')
                            .polygonSideColor(() => 'rgba(0, 255, 255, 0.05)')
                            .polygonStrokeColor(() => 'rgba(0, 255, 255, 0.3)');
                    })
                    .catch(e => console.log('Country borders unavailable:', e.message));
            });
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

        // Try live scraper function first, fall back to static file
        const fetchLive = fetch('/.netlify/functions/fetch-intel')
            .then(res => res.ok ? res.json() : { items: [], minerals: {} })
            .catch(() =>
                fetch('/live_intel.json')
                    .then(r => r.ok ? r.json().then(d => ({ items: d, minerals: {} })) : { items: [], minerals: {} })
                    .catch(() => ({ items: [], minerals: {} }))
            );

        Promise.all([fetchCSV, fetchLive]).then(([csvData, liveResponse]) => {
            // Support both old (array) and new ({items, minerals}) response formats
            const liveData = Array.isArray(liveResponse) ? liveResponse : (liveResponse.items || []);
            const mineralData = Array.isArray(liveResponse) ? {} : (liveResponse.minerals || {});
            if (Object.keys(mineralData).length > 0) setMinerals(mineralData);

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
            setIntelLastUpdated(new Date());
        });
    }, []);

    // AI Summary: Gemini-powered geopolitical intelligence brief
    const handleAiSummary = async (content, title, url) => {
        setAiSummary(null);
        setAiSummaryLoading(true);
        try {
            const res = await fetch('/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, title, content })
            });
            const data = await res.json();
            setAiSummary(data);
        } catch (e) {
            setAiSummary({ error: 'AI analysis unavailable' });
        } finally {
            setAiSummaryLoading(false);
        }
    };

    // Deep Scan: Firecrawl-powered article extractor → auto-triggers AI summary
    const handleDeepScan = async (url) => {
        if (!url) return;
        setDeepScanResult(null);
        setAiSummary(null);
        setDeepScanLoading(true);
        try {
            const res = await fetch('/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url })
            });
            const data = await res.json();
            setDeepScanResult(data);
            // Auto-trigger AI summary once article is extracted
            if (!data.error && (data.content || data.title)) {
                handleAiSummary(data.content, data.title, url);
            }
        } catch (e) {
            setDeepScanResult({ error: 'Deep scan unavailable' });
        } finally {
            setDeepScanLoading(false);
        }
    };

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

        // Escalation Arcs — Option A: animated dashes, glow, speed scales with stress
        if (stressLevel > 50) {
            const conflictPoints = forecastPoints
                .filter(p => p.data.Broad_Category === 'Geopolitics & Conflict')
                .slice(0, 12);

            const isCritical = stressLevel > 70;
            const arcs = [];
            const pairs = [];

            for (let i = 0; i < conflictPoints.length - 1; i += 2) {
                const a = conflictPoints[i];
                const b = conflictPoints[i + 1];
                const label = `${a.data['Key Player/Organization'] || a.data['Entity/Subject']?.substring(0, 30)} ↔ ${b.data['Key Player/Organization'] || b.data['Entity/Subject']?.substring(0, 30)}`;
                arcs.push({
                    startLat: a.lat,
                    startLng: a.lng,
                    endLat: b.lat,
                    endLng: b.lng,
                    // At CRITICAL: solid red-orange; at Elevated: orange-yellow
                    color: isCritical
                        ? ['#ff0000', '#ff6600', '#ff0000']
                        : ['#ff9900', '#ffcc00', '#ff9900'],
                    label
                });
                pairs.push({
                    from: a.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    to: b.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    fromOrg: a.data['Key Player/Organization'],
                    toOrg: b.data['Key Player/Organization'],
                    label
                });
            }

            // Animation speed scales with stress; stroke thickens at CRITICAL
            const animTime = isCritical ? 800 : 2000;
            const dashLen = isCritical ? 0.6 : 0.4;
            const dashGap = isCritical ? 0.3 : 2;
            const stroke = isCritical ? 1.5 : 0.8;

            globeEl.current
                .arcsData(arcs)
                .arcColor('color')
                .arcDashLength(dashLen)
                .arcDashGap(dashGap)
                .arcDashAnimateTime(animTime)
                .arcStroke(stroke)
                .arcLabel(d => `<div style="background:rgba(0,0,0,0.85);padding:6px 10px;border:1px solid #ff4400;border-radius:4px;font-family:Roboto Mono,monospace;color:#ff9900;font-size:0.7rem;max-width:240px;">${d.label}</div>`);

            setEscalationPairs(pairs);
        } else {
            globeEl.current.arcsData([]);
            setEscalationPairs([]);
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
                            href="https://glopocompanion.netlify.app/"
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
                            {intelLastUpdated && (
                                <span style={{ fontSize: '0.6rem', color: '#00ff8880', display: 'block', marginTop: '2px' }}>
                                    ⟳ SCRAPED {intelLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            )}
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
                    <div className="metric-item minerals-panel" onClick={() => setShowMineralsModal(true)} style={{ cursor: 'pointer' }}>
                        <span className="metric-label">⛏️ CRITICAL MINERALS</span>
                        <div className="minerals-grid">
                            <div className="mineral-item">
                                <span className="mineral-symbol">Au</span>
                                <span className="mineral-price gold">{minerals.gold?.price || 'N/A'}</span>
                            </div>
                            <div className="mineral-item">
                                <span className="mineral-symbol">Ag</span>
                                <span className="mineral-price silver">{minerals.silver?.price || 'N/A'}</span>
                            </div>
                            <div className="mineral-item">
                                <span className="mineral-symbol">+4</span>
                                <span className="mineral-price" style={{ color: '#888', fontSize: '0.6rem' }}>VIEW ALL</span>
                            </div>
                        </div>
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

                        {/* Option D: CRITICAL connections panel */}
                        {stressLevel > 70 && escalationPairs.length > 0 && (
                            <div className="critical-connections-panel">
                                <div className="critical-connections-header">
                                    <span className="critical-blink">⚡</span> ACTIVE ESCALATION LINKS
                                </div>
                                <div className="critical-connections-list">
                                    {escalationPairs.map((pair, i) => (
                                        <div key={i} className="connection-row">
                                            <span className="conn-index">{String(i + 1).padStart(2, '0')}</span>
                                            <span className="conn-from">{pair.fromOrg || pair.from.substring(0, 35)}</span>
                                            <span className="conn-arrow">⇄</span>
                                            <span className="conn-to">{pair.toOrg || pair.to.substring(0, 35)}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
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
                    <div className="detail-modal" onClick={() => { setSelectedForecast(null); setDeepScanResult(null); setAiSummary(null); }}>
                        <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                            <button className="close-btn" onClick={() => { setSelectedForecast(null); setDeepScanResult(null); setAiSummary(null); }}>✕</button>
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
                                {/* 5W1H Analysis Section */}
                                {(() => {
                                    const analysis = generate5W1H(selectedForecast);
                                    if (!analysis) return null;
                                    return (
                                        <div className="fivewh-section">
                                            <div className="section-label">📋 5W1H ANALYSIS</div>
                                            <div className="fivewh-grid">
                                                {[
                                                    { key: 'who', label: 'WHO', icon: '👤' },
                                                    { key: 'what', label: 'WHAT', icon: '📌' },
                                                    { key: 'where', label: 'WHERE', icon: '📍' },
                                                    { key: 'when', label: 'WHEN', icon: '⏱' },
                                                    { key: 'why', label: 'WHY', icon: '❓' },
                                                    { key: 'how', label: 'HOW', icon: '⚙️' }
                                                ].map(item => (
                                                    <div className="fivewh-row" key={item.key}>
                                                        <span className="fivewh-label">{item.icon} {item.label}</span>
                                                        <span className="fivewh-value">{analysis[item.key]}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

                                {/* Global Challenges Section */}
                                {(() => {
                                    const challenges = getGlobalChallenges(selectedForecast);
                                    if (!challenges || Object.keys(challenges).length === 0) return null;
                                    return (
                                        <div className="challenges-section">
                                            <div className="section-label">⚠️ HL GLOBAL CHALLENGES</div>
                                            <div className="challenges-grid">
                                                {Object.entries(challenges).map(([name, analysis]) => (
                                                    <div className="challenge-card" key={name}>
                                                        <div className="challenge-header">
                                                            <span className="challenge-icon">{CHALLENGE_ICONS[name] || '📋'}</span>
                                                            <span className="challenge-name">{name}</span>
                                                        </div>
                                                        <p className="challenge-analysis">{analysis}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })()}

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

                                {selectedForecast.url && (
                                    <div className="deep-scan-section">
                                        <button
                                            className="deep-scan-btn"
                                            onClick={() => handleDeepScan(selectedForecast.url)}
                                            disabled={deepScanLoading || aiSummaryLoading}
                                        >
                                            {deepScanLoading
                                                ? <><span className="scan-spinner">⟳</span> EXTRACTING ARTICLE...</>
                                                : '🔥 FIRECRAWL + AI BRIEF'
                                            }
                                        </button>

                                        {/* AI INTEL BRIEF — renders after Firecrawl extraction */}
                                        {(aiSummaryLoading || aiSummary) && (
                                            <div className="ai-brief-panel">
                                                <div className="ai-brief-header">
                                                    <span className="ai-brief-icon">🤖</span>
                                                    <span className="ai-brief-title">AI INTEL BRIEF</span>
                                                    <span className="ai-brief-model">Gemini 2.0 Flash</span>
                                                </div>

                                                {aiSummaryLoading ? (
                                                    <div className="ai-loading">
                                                        <span className="scan-spinner">⟳</span> Generating intelligence brief...
                                                    </div>
                                                ) : aiSummary?.error ? (
                                                    <div className="scan-error"><span>⚠</span> {aiSummary.error}</div>
                                                ) : aiSummary && (
                                                    <>
                                                        {/* BLUF */}
                                                        <div className="bluf-box">
                                                            <span className="bluf-label">📌 BLUF</span>
                                                            <p className="bluf-text">{aiSummary.oneLiner}</p>
                                                        </div>

                                                        {/* Risk Level */}
                                                        <div className="risk-row">
                                                            <span
                                                                className="risk-indicator"
                                                                data-level={aiSummary.riskLevel}
                                                            >
                                                                {aiSummary.riskLevel === 'HIGH' ? '🔴' : aiSummary.riskLevel === 'MEDIUM' ? '🟡' : '🟢'} {aiSummary.riskLevel} RISK
                                                            </span>
                                                            {aiSummary.riskReason && (
                                                                <span className="risk-reason">{aiSummary.riskReason}</span>
                                                            )}
                                                        </div>

                                                        {/* Key Actors */}
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

                                                        {/* IB Themes */}
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

                                                        {/* Analytical Summary */}
                                                        {aiSummary.rawSummary && (
                                                            <div className="brief-summary">
                                                                <span className="brief-row-label">📝 ANALYSIS</span>
                                                                <p className="summary-text">{aiSummary.rawSummary}</p>
                                                            </div>
                                                        )}

                                                        {/* Student Discussion Prompt */}
                                                        {aiSummary.studentPrompt && (
                                                            <div className="student-prompt-box">
                                                                <span className="prompt-label">💬 STUDENT DISCUSSION</span>
                                                                <p className="prompt-text">{aiSummary.studentPrompt}</p>
                                                            </div>
                                                        )}

                                                        <div className="scan-meta">
                                                            Generated {aiSummary.generatedAt ? new Date(aiSummary.generatedAt).toLocaleTimeString() : 'just now'}
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}

                                        {/* Raw Firecrawl Extraction (collapsible) */}
                                        {deepScanResult && !deepScanResult.error && (
                                            <details className="raw-scan-details">
                                                <summary className="raw-scan-summary">📄 RAW ARTICLE EXTRACT</summary>
                                                <div className="deep-scan-result">
                                                    {deepScanResult.title && (
                                                        <h4 className="scan-title">{deepScanResult.title}</h4>
                                                    )}
                                                    {deepScanResult.description && (
                                                        <p className="scan-description">{deepScanResult.description}</p>
                                                    )}
                                                    <div className="scan-content">{deepScanResult.content}</div>
                                                    <div className="scan-meta">
                                                        Extracted {new Date(deepScanResult.scrapedAt).toLocaleTimeString()}
                                                    </div>
                                                </div>
                                            </details>
                                        )}
                                        {deepScanResult?.error && (
                                            <div className="scan-error"><span>⚠</span> {deepScanResult.error}</div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )
            }

            {/* Critical Minerals Matrix Modal */}
            {showMineralsModal && (
                <div className="detail-modal" onClick={() => setShowMineralsModal(false)}>
                    <div className="modal-content minerals-matrix-modal" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" onClick={() => setShowMineralsModal(false)}>✕</button>
                        <div className="modal-header" style={{ borderBottomColor: '#ffd700' }}>
                            <span className="modal-category" style={{ color: '#ffd700' }}>STRATEGIC RESOURCES</span>
                            <h2>⛏️ CRITICAL MINERALS MATRIX</h2>
                        </div>
                        <div className="modal-body">
                            <table className="minerals-table">
                                <thead>
                                    <tr>
                                        <th>SYMBOL</th>
                                        <th>MINERAL</th>
                                        <th>LIVE PRICE</th>
                                        <th>PRIMARY ORIGINS</th>
                                        <th>MAJOR PLAYERS</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[
                                        { key: 'gold', name: 'Gold', color: '#ffd700' },
                                        { key: 'silver', name: 'Silver', color: '#c0c0c0' },
                                        { key: 'lithium', name: 'Lithium', color: '#00ccff' },
                                        { key: 'cobalt', name: 'Cobalt', color: '#9966ff' },
                                        { key: 'copper', name: 'Copper', color: '#ff9900' },
                                        { key: 'rareEarths', name: 'Rare Earths', color: '#00ff88' }
                                    ].map(m => (
                                        <tr key={m.key}>
                                            <td>
                                                <span className="table-symbol" style={{ color: m.color, textShadow: `0 0 8px ${m.color}44` }}>
                                                    {minerals[m.key]?.symbol || m.key.substring(0, 2).toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="mineral-name">{m.name}</td>
                                            <td>
                                                <span className="table-price" style={{ color: m.color }}>
                                                    {minerals[m.key]?.price || 'N/A'}
                                                    {minerals[m.key]?.unit && minerals[m.key]?.price && !minerals[m.key]?.price?.includes('/') && (
                                                        <span className="price-unit">{minerals[m.key].unit}</span>
                                                    )}
                                                </span>
                                            </td>
                                            <td className="origins-cell">{minerals[m.key]?.origins || '—'}</td>
                                            <td className="players-cell">{minerals[m.key]?.players || '—'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                            <div className="minerals-footer">
                                <span>⟳ Prices scraped via Serper API • 30-min cache</span>
                                <span>Data for educational purposes only</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}

export default App;

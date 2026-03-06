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
    const [showConnections, setShowConnections] = useState(false);
    const [arcClickedInfo, setArcClickedInfo] = useState(null);
    const [keyMetrics, setKeyMetrics] = useState({});
    const [minerals, setMinerals] = useState({});
    const [showMineralsModal, setShowMineralsModal] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [intelLastUpdated, setIntelLastUpdated] = useState(null);
    const [deepScanResult, setDeepScanResult] = useState(null);
    const [deepScanLoading, setDeepScanLoading] = useState(false);
    const [aiSummary, setAiSummary] = useState(null);
    const [aiSummaryLoading, setAiSummaryLoading] = useState(false);
    const [theoryLens, setTheoryLens] = useState(null);
    const [timelineYear, setTimelineYear] = useState('ALL');
    const [expandedCluster, setExpandedCluster] = useState(null);
    const [historicalData, setHistoricalData] = useState(null);
    const [historicalLoading, setHistoricalLoading] = useState(false);
    // News scan state
    const [newsNodes, setNewsNodes] = useState([]);
    const [newsScanLoading, setNewsScanLoading] = useState(false);
    const [newsScanError, setNewsScanError] = useState(null);
    const [newsQuery, setNewsQuery] = useState('');
    const [globeNewsOnly, setGlobeNewsOnly] = useState(false); // 🎯 news-only globe filter
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
        globe.pointOfView({ lat: 40, lng: 30, altitude: 2.5 });

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


    // Auto-open connections panel when entering CRITICAL
    useEffect(() => {
        if (stressLevel > 70 && escalationPairs.length > 0) {
            setShowConnections(true);
        } else if (stressLevel <= 70) {
            setShowConnections(false);
        }
    }, [stressLevel, escalationPairs.length]);

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
            // L: Toggle escalation links panel
            if (e.code === 'KeyL' && !selectedForecast && stressLevel > 70) {
                setShowConnections(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedForecast, stressLevel]);

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

    // Load historical data when year is 2023 / 2024 / 2025
    useEffect(() => {
        const HISTORICAL_YEARS = ['2023', '2024', '2025'];
        if (!HISTORICAL_YEARS.includes(timelineYear)) {
            setHistoricalData(null);
            return;
        }
        setHistoricalLoading(true);
        fetch(`/historical_${timelineYear}.json`)
            .then(r => r.ok ? r.json() : [])
            .then(data => {
                setHistoricalData(data.map(item => ({ ...item, isHistorical: true })));
            })
            .catch(() => setHistoricalData([]))
            .finally(() => setHistoricalLoading(false));
    }, [timelineYear]);


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

    // (Student pins removed — setStudentPins was never declared)

    // ── Live News Scan: tries Netlify fn first, falls back to direct Serper call ──
    const fetchLiveNews = async (queryOverride) => {
        setNewsScanLoading(true);
        setNewsScanError(null);

        const query = queryOverride || newsQuery || 'geopolitical crisis conflict war sanctions sovereignty 2026';

        // Country → coords map for frontend fallback
        const COORDS = {
            'united states': [38.9, -77.0], 'usa': [38.9, -77.0], 'russia': [55.7, 37.6],
            'ukraine': [50.4, 30.5], 'china': [39.9, 116.4], 'israel': [31.8, 35.2],
            'iran': [35.7, 51.4], 'north korea': [39.0, 125.7], 'taiwan': [25.0, 121.5],
            'india': [28.6, 77.2], 'pakistan': [33.7, 73.1], 'saudi arabia': [24.7, 46.7],
            'turkey': [39.9, 32.9], 'europe': [50.0, 10.0], 'germany': [52.5, 13.4],
            'france': [48.9, 2.3], 'uk': [51.5, -0.1], 'united kingdom': [51.5, -0.1],
            'brazil': [-15.8, -47.9], 'africa': [0, 25], 'egypt': [30.0, 31.2],
            'syria': [33.5, 36.3], 'iraq': [33.3, 44.4], 'afghanistan': [34.5, 69.2],
            'japan': [35.7, 139.7], 'south korea': [37.6, 127.0], 'venezuela': [10.5, -66.9],
            'gaza': [31.5, 34.5], 'lebanon': [33.9, 35.5], 'yemen': [15.4, 44.2],
            'myanmar': [19.7, 96.1], 'philippines': [14.6, 121.0], 'thailand': [13.7, 100.5],
        };
        const inferCoords = (text) => {
            const t = text.toLowerCase();
            for (const [name, coords] of Object.entries(COORDS)) {
                if (t.includes(name)) return { lat: coords[0] + (Math.random() - 0.5) * 2, lng: coords[1] + (Math.random() - 0.5) * 2 };
            }
            return null;
        };
        const inferCategory = (text) => {
            const t = text.toLowerCase();
            if (/war|military|nuclear|coup|missile|conflict|troops/.test(t)) return 'Geopolitics & Conflict';
            if (/sanction|tariff|trade|inflation|gdp|currency/.test(t)) return 'Economy & Trade';
            if (/climate|energy|oil|solar|emissions/.test(t)) return 'Environment & Energy';
            if (/pandemic|health|disease|refugee/.test(t)) return 'Health & Society';
            if (/tech|ai|cyber|space/.test(t)) return 'Technology & Science';
            return 'Geopolitics & Conflict';
        };

        let path1Error = null;
        try {
            // 1. Try Netlify function first
            const fnRes = await fetch('/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query })
            });

            if (fnRes.ok) {
                const data = await fnRes.json();
                if (data.error) throw new Error(data.error);
                const mapped = (data.nodes || []).map(n => ({ ...n, isLive: true, isNews: true }));
                setNewsNodes(mapped);
                setForecasts(prev => [...prev.filter(f => !f.isNews), ...mapped]);
                setNewsScanLoading(false); // ← must reset before early return
                return;
            } else {
                const errText = await fnRes.text().catch(() => '');
                path1Error = `Netlify fn error ${fnRes.status}: ${errText.substring(0, 80)}`;
            }
        } catch (e) { path1Error = e.message; /* fall through to direct call */ }

        // 2. Fallback: call Serper directly from frontend
        try {
            const serperKey = import.meta.env.VITE_SERPER_API_KEY;
            if (!serperKey) throw new Error('No API key available');

            const serperRes = await fetch('https://google.serper.dev/news', {
                method: 'POST',
                headers: { 'X-API-KEY': serperKey, 'Content-Type': 'application/json' },
                body: JSON.stringify({ q: query, num: 10, tbs: 'qdr:d' })
            });

            if (!serperRes.ok) throw new Error(`Serper error: ${serperRes.status}`);
            const serperData = await serperRes.json();
            const articles = serperData.news || [];

            const mapped = articles
                .map(a => {
                    const text = `${a.title} ${a.snippet || ''}`;
                    const coords = inferCoords(text);
                    if (!coords) return null;
                    return {
                        'Topic/Sector': a.title?.substring(0, 80) || 'News Alert',
                        'Entity/Subject': a.title || 'Breaking News',
                        'Broad_Category': inferCategory(text),
                        'Expected Impact/Value': a.snippet || '',
                        'Key Player/Organization': a.source || 'News Source',
                        'Timeline': 'Live – ' + (a.date || 'Today'),
                        Latitude: coords.lat, Longitude: coords.lng,
                        url: a.link, isLive: true, isNews: true, source: a.source || 'News'
                    };
                })
                .filter(Boolean);

            setNewsNodes(mapped);
            setForecasts(prev => [...prev.filter(f => !f.isNews), ...mapped]);

        } catch (err) {
            const msg = path1Error
                ? `Scan failed. Server: ${path1Error}`
                : err.message;
            setNewsScanError(msg);
        } finally {
            setNewsScanLoading(false);
        }
    };

    // ── Clear news nodes & reset globe to base dataset ───────────────────────
    const clearNewsNodes = () => {
        setNewsNodes([]);
        setNewsScanError(null);
        setNewsQuery('');
        setGlobeNewsOnly(false);
        setForecasts(prev => prev.filter(f => !f.isNews));
        setSelectedCategory('All');
    };

    // ── Export briefing scoped to current news scan results ──────────────────
    const exportNewsReport = () => {
        if (!newsNodes.length) return;
        const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
        const html = `<!DOCTYPE html><html><head><title>Live News Intel Briefing</title><style>body{font-family:monospace;background:#000;color:#0ff;padding:30px;max-width:800px;margin:0 auto}h1{color:#0ff;border-bottom:2px solid #0ff;padding-bottom:10px;font-size:1.1rem;letter-spacing:3px}.node{border:1px solid #333;padding:12px;margin:10px 0;border-radius:4px}.cat{color:#ff9900;font-size:0.7rem;letter-spacing:2px;margin-bottom:4px}.sub{color:#fff;font-size:0.85rem;margin-bottom:6px}.detail{color:#888;font-size:0.75rem;line-height:1.5}.src a{color:#00ff88;font-size:0.65rem}footer{color:#444;font-size:0.6rem;margin-top:30px;border-top:1px solid #222;padding-top:10px}@media print{body{background:#fff;color:#000}.cat{color:#c70}.src a{color:green}h1{color:#000;border-color:#000}}</style></head><body><h1>📡 LIVE NEWS INTEL BRIEFING — ${date}</h1>${newsNodes.map((n, i) => `<div class="node"><div class="cat">${String(i + 1).padStart(2, '0')} · ${n.Broad_Category || n['Topic/Sector'] || 'GLOBAL'}</div><div class="sub">${n['Entity/Subject'] || ''}</div><div class="detail"><strong>Players:</strong> ${n['Key Player/Organization'] || '—'}<br/><strong>Impact:</strong> ${n['Expected Impact/Value'] || '—'}<br/><strong>Timeline:</strong> ${n.Timeline || '—'}</div>${n.url ? `<div class="src"><a href="${n.url}" target="_blank">SOURCE ↗</a></div>` : ''}</div>`).join('')}<footer>Generated by Global Command Center · ${date} · Live News Scan</footer></body></html>`;
        const w = window.open('', '_blank');
        w.document.write(html); w.document.close();
        setTimeout(() => w.print(), 400);
    };


    // ── Theory lens keyword maps ──────────────────────────────────────────────
    const THEORY_KEYWORDS = {
        realism: /war|military|nuclear|territory|power|arms|coup|missile|troops|conflict|navy|siege|weapon|sanctions|invasion/,
        liberalism: /un\b|united nations|trade|wto|institution|cooperation|treaty|ngo|democracy|aid|climate|multilateral|agreement|imf|world bank/,
        constructivism: /identity|human rights|norms|refugee|sovereignty|dignity|gender|indigenous|culture|legitimacy|narrative|recognition|discourse/
    };
    const THEORY_COLORS = { realism: '#ff3344', liberalism: '#00ddff', constructivism: '#cc44ff' };

    // ── Node clustering: group points within 8° of each other ────────────────
    const clusterPoints = (points) => {
        const RADIUS = 8;
        const clusters = [];
        const used = new Set();
        for (let i = 0; i < points.length; i++) {
            if (used.has(i)) continue;
            const group = [points[i]];
            used.add(i);
            for (let j = i + 1; j < points.length; j++) {
                if (used.has(j)) continue;
                const dlat = Math.abs(points[i].lat - points[j].lat);
                const dlng = Math.abs(points[i].lng - points[j].lng);
                if (dlat < RADIUS && dlng < RADIUS) { group.push(points[j]); used.add(j); }
            }
            if (group.length === 1) {
                clusters.push(group[0]);
            } else {
                const avgLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
                const avgLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
                const dominant = group.reduce((a, b) => (a.size > b.size ? a : b));
                clusters.push({
                    lat: avgLat, lng: avgLng,
                    size: Math.min(2.5, 0.8 + group.length * 0.25),
                    color: dominant.color,
                    isCluster: true, count: group.length,
                    items: group.map(g => g.data),
                    data: dominant.data,
                });
            }
        }
        return clusters;
    };

    // Update Globe Points (including Student Pins)
    const updateGlobeData = () => {
        if (!globeEl.current) return;

        // Timeline year filter
        const yearFilter = (item) => {
            if (timelineYear === 'ALL') return true;
            const tl = (item.Timeline || '').toString();
            return tl.includes(timelineYear);
        };

        // Use historical dataset for 2023/2024/2025; otherwise use live forecasts
        const activeData = historicalData || forecasts;

        // 🎯 News-only filter takes precedence when FILTER GLOBE is active
        const filtered = globeNewsOnly
            ? forecasts.filter(f => f.isNews)
            : historicalData
                ? (selectedCategory === 'All'
                    ? historicalData
                    : historicalData.filter(f => f.Broad_Category === selectedCategory))
                : (selectedCategory === 'All'
                    ? forecasts
                    : selectedCategory === 'Live Intel'
                        ? forecasts.filter(f => f.isLive)
                        : forecasts.filter(f => f.Broad_Category === selectedCategory)
                ).filter(yearFilter);

        setFilteredForecasts(filtered);

        // Theory lens coloring
        const getPointColor = (item, baseColor) => {
            if (!theoryLens) return baseColor;
            const text = `${item['Entity/Subject']} ${item['Expected Impact/Value']} ${item['Topic/Sector']}`.toLowerCase();
            const matches = THEORY_KEYWORDS[theoryLens]?.test(text);
            return matches ? THEORY_COLORS[theoryLens] : baseColor;
        };
        const getPointOpacity = (item) => {
            if (!theoryLens) return 1;
            const text = `${item['Entity/Subject']} ${item['Expected Impact/Value']} ${item['Topic/Sector']}`.toLowerCase();
            return THEORY_KEYWORDS[theoryLens]?.test(text) ? 1 : 0.15;
        };

        const rawPoints = filtered.map(item => {
            const baseColor = item.isLive ? '#00ffff' : (categoryColors[item.Broad_Category] || '#ffffff');
            const color = getPointColor(item, baseColor);
            const opacity = getPointOpacity(item);
            return {
                lat: parseFloat(item.Latitude),
                lng: parseFloat(item.Longitude),
                size: (item.isLive ? 1.2 : 0.8) * (theoryLens && opacity < 0.5 ? 0.4 : 1),
                color,
                opacity,
                data: item,
                type: 'forecast'
            };
        });

        // Cluster nearby points
        const forecastPoints = clusterPoints(rawPoints);

        globeEl.current
            .pointsData(forecastPoints)
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointColor('color')
            .onPointClick(point => {
                if (point.isCluster) {
                    globeEl.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.0 }, 600);
                    setExpandedCluster({ items: point.items, lat: point.lat, lng: point.lng });
                } else {
                    setExpandedCluster(null);
                    setSelectedForecast(point.data);
                }
            })
            .pointLabel(d => {
                if (d.isCluster) {
                    return `<div style="background:rgba(0,0,0,0.9);padding:8px 12px;border:1px solid #ffcc00;border-radius:20px;font-family:Roboto Mono;color:#ffcc00;font-size:0.75rem;font-weight:900;">${d.count} EVENTS — click to expand</div>`;
                }
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

        // ── C: Classify arc relationship type → color + icon ──────────────────
        const classifyRelationship = (a, b) => {
            const text = [
                a.data['Entity/Subject'], a.data['Expected Impact/Value'],
                b.data['Entity/Subject'], b.data['Expected Impact/Value']
            ].join(' ').toLowerCase();
            if (/war|military|attack|missile|troops|drone|weapon|navy|armed|combat|siege|nuclear/.test(text))
                return { type: 'MILITARY', color: ['#ff0033', '#ff4400', '#ff0033'], icon: '⚔️', hex: '#ff2200' };
            if (/sanction|tariff|trade.war|embargo|export.ban|economic|gdp|inflation|currency/.test(text))
                return { type: 'ECONOMIC', color: ['#ff9900', '#ffcc00', '#ff9900'], icon: '💰', hex: '#ff9900' };
            if (/territory|border|sea|island|claim|sovereignty|occupation|annex/.test(text))
                return { type: 'TERRITORIAL', color: ['#ffff00', '#ffe000', '#ffff00'], icon: '🗺️', hex: '#ffdd00' };
            if (/famine|refugee|aid|disease|hunger|humanitarian|food.crisis|displaced/.test(text))
                return { type: 'HUMANITARIAN', color: ['#00ff88', '#00ffcc', '#00ff88'], icon: '🏥', hex: '#00ff99' };
            return { type: 'DIPLOMATIC', color: ['#cc00ff', '#ff00cc', '#cc00ff'], icon: '🤝', hex: '#cc44ff' };
        };

        // Escalation Arcs — Options B/C/D/E
        if (stressLevel > 50) {
            const conflictPoints = forecastPoints
                .filter(p => p.data.Broad_Category === 'Geopolitics & Conflict')
                .slice(0, 12);

            const isCritical = stressLevel > 70;
            const arcs = [];
            const pairs = [];
            const connectedNodes = []; // for D: pulsing rings

            for (let i = 0; i < conflictPoints.length - 1; i += 2) {
                const a = conflictPoints[i];
                const b = conflictPoints[i + 1];

                // C: classify relationship
                const rel = classifyRelationship(a, b);

                const fromName = a.data['Key Player/Organization'] || a.data['Entity/Subject']?.substring(0, 28);
                const toName = b.data['Key Player/Organization'] || b.data['Entity/Subject']?.substring(0, 28);

                arcs.push({
                    startLat: a.lat, startLng: a.lng,
                    endLat: b.lat, endLng: b.lng,
                    color: rel.color,
                    // B: altitude — high so arcs arch clearly above globe surface
                    altitude: isCritical ? 0.7 : 0.5,
                    relType: rel.type,
                    relIcon: rel.icon,
                    relHex: rel.hex,
                    fromName, toName,
                    fromImpact: a.data['Expected Impact/Value']?.substring(0, 80),
                    toImpact: b.data['Expected Impact/Value']?.substring(0, 80),
                    fromFull: a.data,
                    toFull: b.data,
                });

                pairs.push({
                    from: a.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    to: b.data['Entity/Subject']?.substring(0, 50) || 'Unknown',
                    fromOrg: a.data['Key Player/Organization'],
                    toOrg: b.data['Key Player/Organization'],
                    relType: rel.type,
                    relIcon: rel.icon,
                    relHex: rel.hex,
                });

                // D: collect connected node positions for pulsing rings
                connectedNodes.push({ lat: a.lat, lng: a.lng, hex: rel.hex });
                connectedNodes.push({ lat: b.lat, lng: b.lng, hex: rel.hex });
            }

            const animTime = isCritical ? 600 : 1800;
            const dashLen = isCritical ? 0.9 : 0.5;   // longer dashes = more visible
            const dashGap = isCritical ? 0.15 : 1.2;
            const stroke = isCritical ? 2.5 : 1.2;   // thicker stroke

            globeEl.current
                .arcsData(arcs)
                .arcColor('color')
                .arcDashLength(dashLen)
                .arcDashGap(dashGap)
                .arcDashAnimateTime(animTime)
                .arcStroke(stroke)
                // B: high altitude
                .arcAltitude('altitude')
                // E: rich hover label with type icon, both names, impact snippet
                .arcLabel(d => `
                    <div style="background:rgba(5,3,3,0.92);padding:10px 14px;border:1px solid ${d.relHex};border-radius:6px;font-family:Roboto Mono,monospace;max-width:280px;box-shadow:0 0 16px ${d.relHex}55;">
                        <div style="color:${d.relHex};font-size:0.62rem;font-weight:900;letter-spacing:1.5px;margin-bottom:6px;">${d.relIcon} ${d.relType} LINK</div>
                        <div style="color:#fff;font-size:0.7rem;font-weight:700;">${d.fromName}</div>
                        <div style="color:${d.relHex};font-size:0.75rem;text-align:center;margin:3px 0;">⇄</div>
                        <div style="color:#fff;font-size:0.7rem;font-weight:700;margin-bottom:6px;">${d.toName}</div>
                        <div style="color:#aaa;font-size:0.58rem;line-height:1.4;border-top:1px solid ${d.relHex}44;padding-top:5px;">${d.fromImpact || ''}</div>
                        <div style="color:#777;font-size:0.5rem;margin-top:5px;">CLICK ARC FOR FULL DETAIL</div>
                    </div>`)
                // B: click arc to open detail card
                .onArcClick(d => setArcClickedInfo(d));

            // D: pulsing HTML rings on connected nodes
            globeEl.current
                .htmlElementsData(connectedNodes)
                .htmlAltitude(0.015)
                .htmlElement(d => {
                    const el = document.createElement('div');
                    el.className = 'node-pulse-ring';
                    el.style.setProperty('--ring-color', d.hex);
                    return el;
                });

            setEscalationPairs(pairs);
        } else {
            globeEl.current.arcsData([]).htmlElementsData([]);
            setEscalationPairs([]);
        }
    };

    useEffect(() => {
        updateGlobeData();
    }, [selectedCategory, forecasts, stressLevel, theoryLens, timelineYear, historicalData, globeNewsOnly]);

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
        : 0) + stressLevel);



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
                        <button className="export-btn" onClick={() => {
                            const nodes = filteredForecasts.slice(0, 40);
                            const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                            const html = `<!DOCTYPE html><html><head><title>Global Intelligence Briefing</title><style>body{font-family:monospace;background:#000;color:#0ff;padding:30px;max-width:800px;margin:0 auto}h1{color:#0ff;border-bottom:2px solid #0ff;padding-bottom:10px;font-size:1.1rem;letter-spacing:3px}.node{border:1px solid #333;padding:12px;margin:10px 0;border-radius:4px}.cat{color:#ff9900;font-size:0.7rem;letter-spacing:2px;margin-bottom:4px}.sub{color:#fff;font-size:0.85rem;margin-bottom:6px}.detail{color:#888;font-size:0.75rem;line-height:1.5}.src a{color:#00ff88;font-size:0.65rem}footer{color:#444;font-size:0.6rem;margin-top:30px;border-top:1px solid #222;padding-top:10px}@media print{body{background:#fff;color:#000}.cat{color:#c70}.src a{color:green}h1{color:#000;border-color:#000}}</style></head><body><h1>⬢ GLOBAL INTELLIGENCE BRIEFING — ${date}</h1>${nodes.map((n, i) => `<div class="node"><div class="cat">${String(i + 1).padStart(2, '0')} · ${n.Broad_Category || n['Topic/Sector'] || 'GLOBAL'}</div><div class="sub">${n['Entity/Subject'] || ''}</div><div class="detail"><strong>Players:</strong> ${n['Key Player/Organization'] || '—'}<br/><strong>Impact:</strong> ${n['Expected Impact/Value'] || '—'}<br/><strong>Timeline:</strong> ${n.Timeline || '—'}</div>${n.url ? `<div class="src"><a href="${n.url}" target="_blank">SOURCE ↗</a></div>` : ''}</div>`).join('')}<footer>Generated by Global Command Center · ${date} · globalcommandcenter2026.netlify.app</footer></body></html>`;
                            const w = window.open('', '_blank');
                            w.document.write(html); w.document.close();
                            setTimeout(() => w.print(), 400);
                        }} title="Export Intelligence Briefing">
                            📄 EXPORT BRIEFING
                        </button>

                        {/* 📡 Live News Scan */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '4px' }}>
                            {/* Search row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <input
                                    value={newsQuery}
                                    onChange={e => setNewsQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchLiveNews()}
                                    placeholder="news topic..."
                                    style={{ background: 'rgba(0,255,200,0.05)', border: '1px solid rgba(0,255,200,0.2)', borderRadius: '6px', padding: '4px 10px', color: '#00ffcc', fontFamily: 'Roboto Mono', fontSize: '0.65rem', width: '130px', outline: 'none' }}
                                />
                                <button
                                    className="export-btn"
                                    onClick={() => fetchLiveNews()}
                                    disabled={newsScanLoading}
                                    style={{ background: newsScanLoading ? 'rgba(0,255,200,0.05)' : 'rgba(0,255,200,0.1)', borderColor: 'rgba(0,255,200,0.3)', color: '#00ffcc' }}
                                    title="Fetch live geopolitical news and place on globe"
                                >
                                    {newsScanLoading ? '⟳ SCANNING...' : '📡 NEWS SCAN'}
                                </button>
                                {newsScanError && (
                                    <div style={{ background: 'rgba(255,50,50,0.15)', border: '1px solid rgba(255,50,50,0.4)', borderRadius: '6px', padding: '4px 10px', color: '#ff6666', fontSize: '0.6rem', fontFamily: 'Roboto Mono', maxWidth: '280px', lineHeight: 1.4 }}>
                                        ⚠ {newsScanError}
                                    </div>
                                )}
                            </div>

                            {/* ✅ SCAN COMPLETE action panel */}
                            {newsNodes.length > 0 && !newsScanLoading && (() => {
                                const conflictCount = newsNodes.filter(n => n.Broad_Category === 'Geopolitics & Conflict').length;
                                const econCount = newsNodes.filter(n => n.Broad_Category === 'Economy & Trade').length;
                                const otherCount = newsNodes.length - conflictCount - econCount;
                                return (
                                    <div style={{
                                        background: 'rgba(0,255,200,0.05)',
                                        border: '1px solid rgba(0,255,200,0.3)',
                                        borderRadius: '8px',
                                        padding: '8px 12px',
                                        fontFamily: 'Roboto Mono',
                                        minWidth: '320px',
                                        boxShadow: '0 0 14px rgba(0,255,200,0.12)'
                                    }}>
                                        {/* Header */}
                                        <div style={{ color: '#00ffcc', fontSize: '0.62rem', fontWeight: 900, letterSpacing: '1.5px', marginBottom: '5px' }}>
                                            ✅ SCAN COMPLETE — +{newsNodes.length} NODES PLOTTED
                                        </div>
                                        {/* Category mini-stats */}
                                        <div style={{ display: 'flex', gap: '10px', marginBottom: '8px', fontSize: '0.55rem', color: '#888', letterSpacing: '0.5px' }}>
                                            <span style={{ color: '#ff0066' }}>⚔️ {conflictCount} Conflict</span>
                                            <span style={{ color: '#00ccff' }}>💰 {econCount} Economy</span>
                                            <span style={{ color: '#aaa' }}>🌍 {otherCount} Other</span>
                                        </div>
                                        {/* Action buttons */}
                                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                                            <button
                                                onClick={() => { setSelectedCategory('Live Intel'); }}
                                                style={{ background: 'rgba(0,255,200,0.08)', border: '1px solid rgba(0,255,200,0.35)', borderRadius: '5px', color: '#00ffcc', fontFamily: 'Roboto Mono', fontSize: '0.58rem', padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,255,200,0.18)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,255,200,0.08)'}
                                                title="Filter Intel Feed to show only news nodes"
                                            >
                                                📋 VIEW IN FEED
                                            </button>
                                            <button
                                                onClick={() => setGlobeNewsOnly(prev => !prev)}
                                                style={{ background: globeNewsOnly ? 'rgba(0,200,255,0.25)' : 'rgba(0,200,255,0.08)', border: `1px solid ${globeNewsOnly ? 'rgba(0,200,255,0.7)' : 'rgba(0,200,255,0.35)'}`, borderRadius: '5px', color: '#00ccff', fontFamily: 'Roboto Mono', fontSize: '0.58rem', padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,200,255,0.25)'}
                                                onMouseLeave={e => e.currentTarget.style.background = globeNewsOnly ? 'rgba(0,200,255,0.25)' : 'rgba(0,200,255,0.08)'}
                                                title={globeNewsOnly ? 'Showing news nodes only — click to restore all' : 'Filter globe to show only scanned news nodes'}
                                            >
                                                {globeNewsOnly ? '🎯 NEWS ONLY ✓' : '🎯 FILTER GLOBE'}
                                            </button>
                                            <button
                                                onClick={exportNewsReport}
                                                style={{ background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.35)', borderRadius: '5px', color: '#ff9900', fontFamily: 'Roboto Mono', fontSize: '0.58rem', padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,153,0,0.18)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,153,0,0.08)'}
                                                title="Export a printable briefing of the scanned news nodes"
                                            >
                                                📄 EXPORT BRIEFING
                                            </button>
                                            <button
                                                onClick={clearNewsNodes}
                                                style={{ background: 'rgba(255,50,50,0.08)', border: '1px solid rgba(255,50,50,0.3)', borderRadius: '5px', color: '#ff4444', fontFamily: 'Roboto Mono', fontSize: '0.58rem', padding: '4px 8px', cursor: 'pointer', letterSpacing: '0.5px', transition: 'all 0.15s' }}
                                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,50,50,0.18)'}
                                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,50,50,0.08)'}
                                                title="Clear news scan and reset globe"
                                            >
                                                🗑️ CLEAR SCAN
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>

                {/* Main Content */}
                <div className="main-content">
                    {/* Globe Center Stage */}
                    <div className={`globe-container ${stressLevel > 70 ? 'critical-vignette' : ''}`}>
                        <div ref={globeContainer} style={{ width: '100%', height: '100%' }} />
                        <div className="globe-overlay">
                            <div className="globe-title">GLOBAL THREAT MATRIX</div>


                        </div>

                        {/* Node Category Color Key — always visible */}
                        <div className="arc-legend">
                            <div className="arc-legend-title">NODE KEY</div>
                            {[
                                ['Geopolitics & Conflict', '#ff0066'],
                                ['Economy & Trade', '#00ccff'],
                                ['Technology & Science', '#00ff88'],
                                ['Health & Society', '#ff9900'],
                                ['Environment & Energy', '#66ff00'],
                                ['Culture & Entertainment', '#ff00ff'],
                                ['Live Intel', '#00ffff'],
                            ].map(([label, color]) => (
                                <div key={label} className="arc-legend-item">
                                    <span className="arc-legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                                    <span style={{ color }}>{label}</span>
                                </div>
                            ))}

                            {/* Arc type sub-key — only when scenario simulator is elevated */}
                            {stressLevel > 50 && (
                                <>
                                    <div className="arc-legend-title" style={{ marginTop: '12px' }}>ARC KEY</div>
                                    {[['⚔️', 'Military', '#ff2200'], ['💰', 'Economic', '#ff9900'], ['🗺️', 'Territorial', '#ffdd00'], ['🏥', 'Humanitarian', '#00ff99'], ['🤝', 'Diplomatic', '#cc44ff']].map(([icon, label, color]) => (
                                        <div key={label} className="arc-legend-item">
                                            <span className="arc-legend-dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
                                            <span style={{ color }}>{icon} {label}</span>
                                        </div>
                                    ))}
                                </>
                            )}
                        </div>
                    </div>


                    {/* Cluster expand panel */}
                    {expandedCluster && (
                        <>
                            {/* Backdrop — click outside to dismiss */}
                            <div onClick={() => setExpandedCluster(null)}
                                style={{ position: 'absolute', inset: 0, zIndex: 99, cursor: 'default' }} />
                            <div onClick={e => e.stopPropagation()}
                                style={{
                                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.95)', border: '1px solid #ffcc00',
                                    borderRadius: '12px', padding: '16px', zIndex: 100, width: '320px',
                                    maxHeight: '60vh', overflowY: 'auto', fontFamily: 'Roboto Mono, monospace',
                                    boxShadow: '0 0 30px #ffcc0044'
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span style={{ color: '#ffcc00', fontWeight: 900, fontSize: '0.8rem' }}>
                                        📍 {expandedCluster.items.length} EVENTS IN REGION
                                    </span>
                                    <button onClick={() => setExpandedCluster(null)}
                                        style={{ background: 'none', border: '1px solid #ffcc0055', borderRadius: '4px', color: '#ffcc00', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem' }}>
                                        ✕
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(() => {
                                        // Group items by category
                                        const groups = {};
                                        expandedCluster.items.forEach(item => {
                                            const cat = item.isLive ? 'Live Intel' : (item.Broad_Category || 'Other');
                                            if (!groups[cat]) groups[cat] = [];
                                            groups[cat].push(item);
                                        });
                                        return Object.entries(groups).map(([cat, items]) => {
                                            const catColor = items[0].isLive ? '#00ffff' : (categoryColors[cat] || '#aaaaaa');
                                            return (
                                                <div key={cat}>
                                                    <div style={{ color: catColor, fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${catColor}33` }}>
                                                        {cat} ({items.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        {items.map((item, i) => (
                                                            <button key={i} onClick={() => { setSelectedForecast(item); setExpandedCluster(null); }}
                                                                style={{ textAlign: 'left', background: catColor + '0d', border: `1px solid ${catColor}33`, borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', transition: 'all 0.15s' }}
                                                                onMouseEnter={e => e.currentTarget.style.background = catColor + '22'}
                                                                onMouseLeave={e => e.currentTarget.style.background = catColor + '0d'}>
                                                                <div style={{ color: '#ddd', fontSize: '0.68rem', lineHeight: 1.3 }}>
                                                                    {item.isLive ? <span style={{ color: '#00ffff', fontWeight: 700, marginRight: '4px' }}>[LIVE]</span> : null}
                                                                    {item['Entity/Subject']?.substring(0, 70)}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </>
                    )}

                    {/* Right Sidebar - Intel Feed */}
                    <div className={`intel-feed ${sidebarCollapsed ? 'collapsed' : ''}`}>
                        <button
                            className="sidebar-toggle"
                            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                            title={sidebarCollapsed ? 'Expand Intel Feed (Space)' : 'Collapse Intel Feed (Space)'}
                            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                        />
                        <div className="intel-header">
                            <span className="intel-title">
                                {historicalData ? `📅 ${timelineYear} ARCHIVE` : 'INTEL FEED'}
                            </span>
                            {historicalData ? (
                                <span style={{ fontSize: '0.6rem', color: '#ffcc0099', display: 'block', marginTop: '2px' }}>
                                    {historicalLoading ? '⟳ LOADING...' : `${historicalData.length} EVENTS • SOURCED`}
                                </span>
                            ) : intelLastUpdated && (
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
                                {!historicalData && <option value="Live Intel" style={{ color: '#00ffff', fontWeight: 'bold' }}>● LIVE INTEL FEED</option>}
                                {Object.keys(categoryColors).map(cat => (
                                    <option key={cat} value={cat}>{cat.toUpperCase()}</option>
                                ))}
                            </select>
                        </div>

                        <div className="intel-cards">
                            {historicalLoading ? (
                                <div style={{ color: '#ffcc00', fontFamily: 'Roboto Mono', fontSize: '0.7rem', padding: '20px', textAlign: 'center', opacity: 0.8 }}>
                                    ⟳ Loading {timelineYear} historical data...
                                </div>
                            ) : filteredForecasts.slice(0, 30).map((forecast, idx) => (
                                <div
                                    key={idx}
                                    className={`intel-card ${selectedForecast === forecast ? 'selected' : ''} ${forecast.isLive ? 'live-item' : ''}`}
                                    onClick={() => setSelectedForecast(forecast)}
                                    style={{ borderLeftColor: forecast.isHistorical ? '#ffcc00' : forecast.isLive ? '#00ffff' : categoryColors[forecast.Broad_Category] }}
                                >
                                    {forecast.isLive && <div className="live-tag">● LIVE INTEL</div>}
                                    {forecast.isHistorical && <div className="live-tag" style={{ background: '#ffcc0022', color: '#ffcc00', borderColor: '#ffcc0044' }}>📅 {timelineYear}</div>}
                                    <div className="card-category" style={{ color: forecast.isHistorical ? '#ffcc00' : forecast.isLive ? '#00ffff' : categoryColors[forecast.Broad_Category] }}>
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
                        <span className="stress-level-label">
                            {stressLevel === 0 ? 'BASELINE' : stressLevel < 40 ? 'LOW TENSION' : stressLevel < 70 ? 'ELEVATED' : 'CRITICAL'}
                            {stressLevel > 50 && escalationPairs.length > 0 && (
                                <span className="arc-count-badge"
                                    title={stressLevel > 70 ? 'Press L to toggle links panel' : ''}
                                    onClick={() => stressLevel > 70 && setShowConnections(p => !p)}
                                    style={{ cursor: stressLevel > 70 ? 'pointer' : 'default' }}
                                >
                                    · {escalationPairs.length} ARCS {stressLevel > 70 ? (showConnections ? '▼' : '▲') : ''}
                                </span>
                            )}
                        </span>
                        {/* Feature 5: Timeline Year Filter */}
                        <div className="timeline-filter">
                            <span className="timeline-label">📅 TIMELINE</span>
                            <div className="timeline-year-btns">
                                {['ALL', '2023', '2024', '2025', '2026'].map(y => (
                                    <button key={y}
                                        className={`timeline-year-btn${timelineYear === y ? ' active' : ''}`}
                                        onClick={() => setTimelineYear(y)}
                                    >{y === 'ALL' ? 'ALL' : `'${y.slice(2)}`}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Fixed floating escalation links panel */}
            {stressLevel > 70 && escalationPairs.length > 0 && (
                <div className={`critical-connections-panel ${showConnections ? 'panel-open' : 'panel-collapsed'}`}>
                    <div className="critical-connections-header" onClick={() => setShowConnections(p => !p)}>
                        <span className="critical-blink">⚡</span>
                        <span className="conn-header-title">ACTIVE ESCALATION LINKS</span>
                        <span className="conn-count-badge">{escalationPairs.length}</span>
                        <span className="conn-toggle-icon">{showConnections ? '▼' : '▲'}</span>
                        {showConnections && (
                            <button className="conn-close-btn" onClick={(e) => { e.stopPropagation(); setShowConnections(false); }} title="Close (L)">✕</button>
                        )}
                    </div>
                    {showConnections && (
                        <div className="critical-connections-list">
                            <div className="conn-keyboard-hint">Press <kbd>L</kbd> to toggle</div>
                            {escalationPairs.map((pair, i) => (
                                <div key={i} className="connection-row">
                                    <span className="conn-index">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="conn-from">{pair.fromOrg || pair.from.substring(0, 30)}</span>
                                    <span className="conn-arrow">⇄</span>
                                    <span className="conn-to">{pair.toOrg || pair.to.substring(0, 30)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* B: Arc clicked — relationship detail card */}
            {arcClickedInfo && (
                <div className="arc-detail-overlay" onClick={() => setArcClickedInfo(null)}>
                    <div className="arc-detail-card" onClick={e => e.stopPropagation()}>
                        <button className="arc-detail-close" onClick={() => setArcClickedInfo(null)}>✕</button>
                        <div className="arc-detail-type" style={{ color: arcClickedInfo.relHex, borderBottomColor: arcClickedInfo.relHex + '55' }}>
                            {arcClickedInfo.relIcon} {arcClickedInfo.relType} CONFLICT LINK
                        </div>
                        <div className="arc-detail-entities">
                            <div className="arc-entity-box" style={{ borderColor: arcClickedInfo.relHex + '88' }}>
                                <span className="arc-entity-label">NODE A</span>
                                <strong className="arc-entity-name">{arcClickedInfo.fromName}</strong>
                                <p className="arc-entity-impact">{arcClickedInfo.fromImpact || '—'}</p>
                            </div>
                            <div className="arc-entity-connector" style={{ color: arcClickedInfo.relHex }}>⇄</div>
                            <div className="arc-entity-box" style={{ borderColor: arcClickedInfo.relHex + '88' }}>
                                <span className="arc-entity-label">NODE B</span>
                                <strong className="arc-entity-name">{arcClickedInfo.toName}</strong>
                                <p className="arc-entity-impact">{arcClickedInfo.toImpact || '—'}</p>
                            </div>
                        </div>
                        <div className="arc-detail-hint">Click outside to dismiss · Click a globe node for full intel</div>
                    </div>
                </div>
            )}

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

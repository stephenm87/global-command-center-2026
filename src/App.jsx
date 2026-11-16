import React, { useState, useEffect, useRef, useCallback, useMemo, Component } from 'react';
import Papa from 'papaparse';
import * as topojson from 'topojson-client';
import { theories, getTheoryInterpretation } from './theories';
import { generate5W1H, getGlobalChallenges, CHALLENGE_ICONS } from './eventAnalysis';
import { AuthBadge, AuthModal, useAuth } from './AuthModal';
import { supabase } from './supabase';
import { secureFetch } from './api';
import { readStoredJson, writeStoredJson } from './localState.mjs';
import { CASE_STUDIES_2026, toForecastRecord } from './caseStudies2026';
import { resolveActorId } from './nexus/actorIds';
import criticalMineralsCatalog from './data/criticalMinerals.json';
import {
    ALL_INTEL_CATEGORY,
    LIVE_INTEL_CATEGORY,
    filterIntelForecasts,
    getCurrentFeedLabel,
    getFeedEmptyState,
    mergeIntelSources,
    searchIntelForecasts,
    summarizeIntelSources,
} from './intelFeed.mjs';
import './App.css';

const GuidedBriefings = React.lazy(() => import('./GuidedBriefings'));
const NexusWorkspace = React.lazy(() => import('./NexusWorkspace'));

const VIEW_MODES = ['globe', 'briefings', 'nexus'];
const CURATED_CASE_RECORDS = CASE_STUDIES_2026.map(toForecastRecord);

const normalizeLegacyForecast = row => {
    const sourceUrl = typeof row.Source === 'string' && /^https:\/\//i.test(row.Source.trim())
        ? row.Source.trim()
        : '';
    return { ...row, url: row.url || sourceUrl };
};

const getViewFromLocation = () => {
    const requested = new URLSearchParams(window.location.search).get('view');
    return VIEW_MODES.includes(requested) ? requested : 'globe';
};

const getBriefingEntryFromLocation = () => {
    const params = new URLSearchParams(window.location.search);
    const rawStep = params.get('step');
    const numericStep = rawStep === null ? undefined : Number(rawStep);
    return {
        tourId: params.get('tour') || undefined,
        nodeId: resolveActorId(params.get('actor'), undefined),
        step: Number.isInteger(numericStep) && numericStep >= 1 ? numericStep : undefined,
    };
};

// ── XSS prevention: escape HTML in user/CSV-sourced data before template strings ──
const escHtml = s => (s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// ── URL validation: only allow https URLs in export hrefs (block javascript: etc) ──
const safeHref = url => {
    if (!url || typeof url !== 'string') return '';
    try { const u = new URL(url); return ['http:', 'https:'].includes(u.protocol) ? escHtml(url) : ''; } catch { return ''; }
};

const isReviewOverdue = reviewBy => Boolean(reviewBy && reviewBy < new Date().toISOString().slice(0, 10));

const dedupeClusterItems = items => {
    const caseIds = new Set();
    return items.filter(item => {
        if (!item.isCaseStudy || !item.caseStudyId) return true;
        if (caseIds.has(item.caseStudyId)) return false;
        caseIds.add(item.caseStudyId);
        return true;
    });
};

// ── ErrorBoundary: graceful fallback if WebGL/Globe.gl crashes ──
class GlobeErrorBoundary extends Component {
    constructor(props) { super(props); this.state = { hasError: false, error: null }; }
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    componentDidCatch(error, info) { console.error('[GlobeErrorBoundary]', error, info); }
    render() {
        if (this.state.hasError) return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#ff4444', fontFamily: 'Roboto Mono', textAlign: 'center', padding: '40px' }}>
                <div style={{ fontSize: '3rem', marginBottom: '16px' }}>⚠️</div>
                <h2 style={{ color: '#ff6666', marginBottom: '8px' }}>Globe Rendering Failed</h2>
                <p style={{ color: '#888', fontSize: '0.85rem', maxWidth: '400px' }}>WebGL could not initialize. This may be due to your browser or device not supporting 3D graphics. Try using Chrome or Firefox on a desktop computer.</p>
                <button onClick={() => this.setState({ hasError: false })} style={{ marginTop: '16px', padding: '8px 16px', background: 'rgba(0,255,136,0.1)', border: '1px solid #00ff88', color: '#00ff88', borderRadius: '4px', cursor: 'pointer', fontFamily: 'Roboto Mono' }}>⟳ Retry</button>
            </div>
        );
        return this.props.children;
    }
}

const categoryColors = {
    'Geopolitics & Conflict': '#ff0066',
    'Economy & Trade': '#00ccff',
    'Technology & Science': '#00ff88',
    'Health & Society': '#ff9900',
    'Environment & Energy': '#66ff00',
    'Culture & Entertainment': '#ff00ff'
};

const ACCESSIBLE_TEXT_ACCENTS = {
    '#ff0066': '#ff5c99',
    '#cc0000': '#ff6b6b',
    '#ff00ff': '#f472ff',
};

const getAccessibleTextAccent = hex => ACCESSIBLE_TEXT_ACCENTS[String(hex || '').toLowerCase()] || hex;

const DEFAULT_MINERALS = criticalMineralsCatalog.minerals;


class NexusErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null, info: null }; }
    static getDerivedStateFromError(err) { return { error: err }; }
    componentDidCatch(err, info) { 
        this.setState({ info }); 
        console.error('[NEXUS CRASH]', err.message, err.stack);
    }
    render() {
        if (this.state.error) {
            return React.createElement('div', {
                style: { color: '#ff0066', background: '#0a0a1a', padding: '40px', fontFamily: 'Roboto Mono, monospace', fontSize: '13px', position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'auto' }
            },
                React.createElement('h2', { style: { color: '#ff0066', marginBottom: '16px' } }, '⚠ NEXUS COMPONENT CRASHED'),
                React.createElement('div', { style: { color: '#ff9900', marginBottom: '8px' } }, 'Error: ' + this.state.error.message),
                React.createElement('pre', { style: { color: '#888', fontSize: '11px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '4px' } }, this.state.error.stack),
                this.state.info && React.createElement('pre', { style: { color: '#555', fontSize: '10px', whiteSpace: 'pre-wrap', marginTop: '12px' } }, this.state.info.componentStack),
                React.createElement('button', {
                    onClick: () => this.setState({ error: null, info: null }),
                    style: { marginTop: '20px', padding: '8px 16px', background: '#00ff88', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold' }
                }, '⟲ RETRY')
            );
        }
        return this.props.children;
    }
}

function App() {
    const { user, showModal, authError, openModal, closeModal } = useAuth();
    const [forecasts, setForecasts] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedForecast, setSelectedForecast] = useState(null);
    const [selectedTheory, setSelectedTheory] = useState('Realism');
    const [viewMode, setViewMode] = useState(getViewFromLocation);
    const [nexusEntry, setNexusEntry] = useState(() => ({ nodeId: resolveActorId(new URLSearchParams(window.location.search).get('actor'), 'USA') }));
    const [briefingEntry, setBriefingEntry] = useState(getBriefingEntryFromLocation);

    const [stressLevel, setStressLevel] = useState(0);
    const [escalationPairs, setEscalationPairs] = useState([]);
    const [showConnections, setShowConnections] = useState(false);
    const [arcClickedInfo, setArcClickedInfo] = useState(null);
    const [keyMetrics, setKeyMetrics] = useState({});
    const [minerals, setMinerals] = useState(() => ({ ...DEFAULT_MINERALS }));
    const [showMineralsModal, setShowMineralsModal] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [legendCollapsed, setLegendCollapsed] = useState(true);
    const [largeText, setLargeText] = useState(false);
    const [reducedEffects, setReducedEffects] = useState(false);
    const [metricsCollapsed, setMetricsCollapsed] = useState(true);
    const [intelLastUpdated, setIntelLastUpdated] = useState(null);
    const [intelMeta, setIntelMeta] = useState(null);
    const [intelLoading, setIntelLoading] = useState(true);
    const [feedSearch, setFeedSearch] = useState('');
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
    const [showEditorialCases, setShowEditorialCases] = useState(true);
    const [preferencesHydratedFor, setPreferencesHydratedFor] = useState(null);
    const [globeReady, setGlobeReady] = useState(false); // loading skeleton
    const [mobileGlobeEnabled, setMobileGlobeEnabled] = useState(() => (
        typeof window !== 'undefined' ? !window.matchMedia?.('(max-width: 767px)').matches : true
    ));
    const [feedPage, setFeedPage] = useState(1); // Intel Feed pagination
    const FEED_PAGE_SIZE = 40;
    const globeEl = useRef();
    const globeContainer = useRef();
    const attributionRef = useRef();
    const dashboardRef = useRef();
    const detailModalRef = useRef();
    const mineralsModalRef = useRef();
    const clusterDialogRef = useRef();
    const previousFocusRef = useRef();

    const navigateView = (mode, params = {}) => {
        const nextMode = VIEW_MODES.includes(mode) ? mode : 'globe';
        if (nextMode === viewMode && Object.keys(params).length === 0) return;
        const url = new URL(window.location.href);
        url.searchParams.set('view', nextMode);
        ['tour', 'step', 'actor'].forEach(key => url.searchParams.delete(key));
        Object.entries(params).forEach(([key, value]) => {
            if (value) url.searchParams.set(key, value);
        });
        window.history.pushState({ view: nextMode, ...params }, '', url);
        setViewMode(nextMode);
    };

    const openNexusAtActor = (nodeId, tourId) => {
        setNexusEntry({ nodeId, tourId });
        navigateView('nexus', { actor: nodeId });
    };

    const openBriefing = (tourId, nodeId) => {
        setBriefingEntry({ tourId, nodeId, step: 1 });
        navigateView('briefings', { tour: tourId, actor: nodeId, step: 1 });
    };

    const rememberNexusActor = useCallback(nodeId => {
        setNexusEntry(previous => ({ ...previous, nodeId }));
    }, []);

    const rememberBriefingRoute = useCallback(entry => {
        setBriefingEntry(previous => (
            previous.tourId === entry.tourId
            && previous.nodeId === entry.nodeId
            && previous.step === entry.step
                ? previous
                : entry
        ));
    }, []);

    useEffect(() => {
        const handleHistory = () => {
            const params = new URLSearchParams(window.location.search);
            setViewMode(getViewFromLocation());
            setNexusEntry({ nodeId: resolveActorId(params.get('actor'), 'USA') });
            setBriefingEntry(getBriefingEntryFromLocation());
        };
        window.addEventListener('popstate', handleHistory);
        return () => window.removeEventListener('popstate', handleHistory);
    }, []);

    // ── Preferences persistence: restore on mount ────────────────────────
    useEffect(() => {
        let cancelled = false;
        const preferenceOwner = user?.id || 'anonymous';
        setPreferencesHydratedFor(null);

        const applyPreferences = prefs => {
            if (prefs.selectedTheory) setSelectedTheory(prefs.selectedTheory);
            if (prefs.selectedCategory) setSelectedCategory(prefs.selectedCategory);
            if (prefs.timelineYear) setTimelineYear(prefs.timelineYear);
            if (typeof prefs.stressLevel === 'number') setStressLevel(prefs.stressLevel);
            if (typeof prefs.sidebarCollapsed === 'boolean') setSidebarCollapsed(prefs.sidebarCollapsed);
            if (typeof prefs.showEditorialCases === 'boolean') setShowEditorialCases(prefs.showEditorialCases);
            if (typeof prefs.largeText === 'boolean') setLargeText(prefs.largeText);
            if (typeof prefs.reducedEffects === 'boolean') setReducedEffects(prefs.reducedEffects);
            if (typeof prefs.metricsCollapsed === 'boolean') setMetricsCollapsed(prefs.metricsCollapsed);
        };

        const restorePreferences = async () => {
            const localPreferences = readStoredJson('gcc-preferences', {});
            applyPreferences(localPreferences);

            try {
                if (user) {
                    const { data, error: selectError } = await supabase
                        .from('user_data').select('value')
                        .eq('user_id', user.id).eq('key', 'gcc-preferences').maybeSingle();
                    if (selectError) throw selectError;
                    if (cancelled) return;
                    if (data?.value) {
                        applyPreferences(data.value);
                        writeStoredJson('gcc-preferences', data.value);
                    }
                }
            } catch (error) {
                console.warn('[GCC] Cloud preferences unavailable:', error?.message || 'unknown error');
            } finally {
                if (!cancelled) setPreferencesHydratedFor(preferenceOwner);
            }
        };

        restorePreferences();
        return () => { cancelled = true; };
    }, [user?.id]);

    // ── Preferences persistence: save on change ──────────────────────────
    useEffect(() => {
        const preferenceOwner = user?.id || 'anonymous';
        if (preferencesHydratedFor !== preferenceOwner) return;

        const prefs = {
            selectedTheory,
            selectedCategory,
            timelineYear,
            stressLevel,
            sidebarCollapsed,
            showEditorialCases,
            largeText,
            reducedEffects,
            metricsCollapsed,
        };
        writeStoredJson('gcc-preferences', prefs);
        if (!user) return undefined;
        const syncTimer = setTimeout(() => {
            supabase.from('user_data').upsert(
                { user_id: user.id, key: 'gcc-preferences', value: prefs, updated_at: new Date().toISOString() },
                { onConflict: 'user_id,key' }
            ).then(({ error }) => {
                if (error) console.warn('[GCC] Failed to sync cloud preferences:', error.message);
            });
        }, 400);
        return () => clearTimeout(syncTimer);
    }, [selectedTheory, selectedCategory, timelineYear, stressLevel, sidebarCollapsed, showEditorialCases, largeText, reducedEffects, metricsCollapsed, preferencesHydratedFor, user?.id]);

    // Auto-enable 3D Globe if viewport expands to tablet/desktop (>= 768px)
    useEffect(() => {
        if (mobileGlobeEnabled || typeof window === 'undefined' || !window.matchMedia) return undefined;
        const mql = window.matchMedia('(min-width: 768px)');
        const onChange = (e) => { if (e.matches) setMobileGlobeEnabled(true); };
        if (mql.matches) {
            setMobileGlobeEnabled(true);
            return undefined;
        }
        mql.addEventListener?.('change', onChange);
        return () => mql.removeEventListener?.('change', onChange);
    }, [mobileGlobeEnabled]);

    // Initialize globe (auto-mounted on >=768px; 1-tap opt-in on mobile <768px)
    useEffect(() => {
        if (viewMode !== 'globe' || !mobileGlobeEnabled || globeEl.current) return undefined;
        if (!globeContainer.current) return undefined;
        let cancelled = false;

        import('globe.gl').then(({ default: Globe }) => {
            if (cancelled || !globeContainer.current) return;
            const globe = Globe()(globeContainer.current)
                .globeImageUrl('/assets/globe/earth-night.jpg')
                .backgroundImageUrl('/assets/globe/night-sky.jpg')
                .atmosphereColor('#0088ff')
                .atmosphereAltitude(0.15)
                .showGraticules(false);

            globeEl.current = globe;
            if (window.matchMedia?.('(max-width: 767px)').matches) {
                globe.renderer?.()?.setPixelRatio?.(Math.min(window.devicePixelRatio || 1, 1.5));
            }

            // Set globe renderer to match container (not window) dimensions
            const cw = globeContainer.current.offsetWidth || 600;
            const ch = globeContainer.current.offsetHeight || 500;
            globe.width(cw).height(ch);
            globe.pointOfView({ lat: 40, lng: 30, altitude: 2.5 });

            // Load bundled country boundaries TopoJSON (no third-party CDN fallback)
            fetch('/assets/globe/countries-110m.json')
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
                .catch(e => console.warn('Bundled country borders unavailable:', e.message));
            setGlobeReady(true);
        }).catch((err) => {
            console.error('[Globe] Initialization failed:', err);
            setGlobeReady(true);
        });

        return () => { cancelled = true; };
    }, [viewMode, mobileGlobeEnabled]);

    // Keep the WebGL renderer aligned with the responsive workspace. Globe.gl
    // only reads its initial dimensions, so drawer, zoom, and metrics changes
    // otherwise leave an oversized or clipped canvas behind.
    useEffect(() => {
        if (viewMode !== 'globe' || !globeContainer.current) return undefined;
        const container = globeContainer.current;
        let resizeFrame = null;

        const resizeGlobe = () => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                const globe = globeEl.current;
                if (!globe || !container.isConnected) return;
                const width = Math.floor(container.clientWidth);
                const height = Math.floor(container.clientHeight);
                if (width > 0 && height > 0) globe.width(width).height(height);
            });
        };

        const observer = typeof ResizeObserver === 'function'
            ? new ResizeObserver(resizeGlobe)
            : null;
        observer?.observe(container);
        window.addEventListener('resize', resizeGlobe);
        resizeGlobe();

        return () => {
            observer?.disconnect();
            window.removeEventListener('resize', resizeGlobe);
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
        };
    }, [viewMode, globeReady]);

    // Pause WebGL render loop and orbit controls whenever the Globe workspace is hidden
    useEffect(() => {
        const globe = globeEl.current;
        if (!globe) return;
        const controls = typeof globe.controls === 'function' ? globe.controls() : null;
        if (viewMode === 'globe') {
            globe.resumeAnimation?.();
            if (controls) controls.enabled = true;
        } else {
            globe.pauseAnimation?.();
            if (controls) controls.enabled = false;
        }
    }, [viewMode, globeReady]);


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
            // Space: Toggle sidebar (only if modal is not open AND not typing in an input)
            const tag = document.activeElement?.tagName?.toLowerCase();
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
            if (e.code === 'Space' && !selectedForecast && !expandedCluster && !isTyping) {
                e.preventDefault();
                setSidebarCollapsed(prev => !prev);
            }
            // Esc: Close modal
            if (e.code === 'Escape' && (selectedForecast || showMineralsModal || expandedCluster)) {
                setSelectedForecast(null);
                setShowMineralsModal(false);
                setExpandedCluster(null);
            }
            // L: Toggle escalation links panel
            if (e.code === 'KeyL' && !selectedForecast && !expandedCluster && stressLevel > 70) {
                setShowConnections(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedForecast, showMineralsModal, expandedCluster, stressLevel]);

    useEffect(() => {
        const activeModal = selectedForecast
            ? detailModalRef.current
            : showMineralsModal
                ? mineralsModalRef.current
                : expandedCluster
                    ? clusterDialogRef.current
                    : null;
        if (!activeModal) return undefined;
        previousFocusRef.current = document.activeElement;
        activeModal.focus();
        return () => previousFocusRef.current?.focus?.();
    }, [selectedForecast, showMineralsModal, expandedCluster]);

    // Load the public reference library independently from protected provider updates.
    useEffect(() => {
        let cancelled = false;
        const fetchCSV = fetch('/Global_Forecasts_2026_Enriched.csv')
            .then(response => {
                if (!response.ok) throw new Error(`Forecast library unavailable (${response.status})`);
                return response.text();
            })
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
            })
            .catch(() => []);

        const fetchPublicReferences = fetch('/live_intel.json')
            .then(response => {
                if (!response.ok) throw new Error(`Public reference feed unavailable (${response.status})`);
                return response.json();
            })
            .then(data => Array.isArray(data) ? data : [])
            .catch(() => []);

        const providerController = new AbortController();
        const providerTimeout = window.setTimeout(() => providerController.abort(), 30000);
        const fetchProviderUpdates = fetch('/.netlify/functions/public-intel', {
            signal: providerController.signal,
        })
            .then(response => {
                if (!response.ok) throw new Error(`Provider feed unavailable (${response.status})`);
                return response.json();
            })
            .catch(() => ({
                items: [],
                minerals: {},
                meta: {
                    generatedAt: new Date().toISOString(),
                    sourceMode: 'public-cache',
                    status: 'network-error',
                    provider: 'Serper',
                },
            }))
            .finally(() => window.clearTimeout(providerTimeout));

        const applyIntelData = (combinedData, providerMeta = null, mineralData = {}) => {
            if (cancelled) return;
            if (Object.keys(mineralData).length > 0) setMinerals(mineralData);
            const sourceSummary = summarizeIntelSources(combinedData, providerMeta);
            setIntelMeta({ ...providerMeta, ...sourceSummary });
            setForecasts(combinedData);

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
                        const sourceLabel = d.data.isLive ? 'OPEN CURRENT SOURCE' : 'OPEN SOURCE';
                        const isLinked = d.data.url ? `<div style="color: #00ff88; font-size: 0.7rem; margin-top: 5px; font-weight: bold;">[ ${sourceLabel} ]</div>` : '';
                        return `<div style="background: rgba(0,0,0,0.9); padding: 12px; border: 1px solid ${d.color}; border-radius: 4px; font-family: Roboto Mono; color: #00ffff; max-width: 300px; box-shadow: 0 0 15px ${d.color}44;">
                    <div style="color: ${d.color}; font-weight: 700; margin-bottom: 5px;">${d.data.isLive ? '[LIVE] ' : ''}${escHtml(d.data['Topic/Sector'])}</div>
                    <div style="font-size: 0.85rem; color: #fff;">${escHtml(d.data['Entity/Subject'])}</div>
                    ${isLinked}
                  </div>`;
                    });
            }
            extractMetrics(combinedData);
            const generatedAt = providerMeta?.generatedAt ? new Date(providerMeta.generatedAt) : new Date();
            setIntelLastUpdated(Number.isNaN(generatedAt.getTime()) ? new Date() : generatedAt);
        };

        const publicDataPromise = Promise.all([fetchCSV, fetchPublicReferences])
            .then(([csvData, publicReferenceData]) => {
                if (cancelled) return null;
                const publicData = { csvData, publicReferenceData };
                const combinedData = mergeIntelSources({
                    publicReferenceItems: publicReferenceData,
                    curatedItems: CURATED_CASE_RECORDS,
                    legacyItems: csvData.map(normalizeLegacyForecast),
                });
                applyIntelData(combinedData, { sourceMode: 'public-cache', status: 'warming', provider: 'Serper' });
                setIntelLoading(false);
                return publicData;
            })
            .catch(() => {
                if (!cancelled) setIntelLoading(false);
                return null;
            });

        Promise.all([publicDataPromise, fetchProviderUpdates]).then(([publicData, providerResponse]) => {
            if (cancelled || !publicData) return;
            const providerItems = Array.isArray(providerResponse) ? providerResponse : (providerResponse.items || []);
            const mineralData = Array.isArray(providerResponse) ? {} : (providerResponse.minerals || {});
            const providerMeta = Array.isArray(providerResponse) ? null : (providerResponse.meta || null);
            const combinedData = mergeIntelSources({
                providerItems,
                publicReferenceItems: publicData.publicReferenceData,
                curatedItems: CURATED_CASE_RECORDS,
                legacyItems: publicData.csvData.map(normalizeLegacyForecast),
            });
            applyIntelData(combinedData, providerMeta, mineralData);
        });

        return () => {
            cancelled = true;
            providerController.abort();
            window.clearTimeout(providerTimeout);
        };
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
            const res = await secureFetch('/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, title, content }),
                signal: AbortSignal.timeout(45000)
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
        if (!user) {
            setDeepScanResult({
                error: 'Sign in with a magic link to run Firecrawl article extraction and AI intelligence briefs.',
                requiresAuth: true,
            });
            return;
        }
        setDeepScanLoading(true);
        try {
            const res = await secureFetch('/.netlify/functions/deep-scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url }),
                signal: AbortSignal.timeout(30000)
            });
            const data = await res.json();
            if (res.status === 401) {
                setDeepScanResult({
                    error: data?.error || 'Your session expired. Sign in again to run Deep Scan.',
                    requiresAuth: true,
                });
                return;
            }
            setDeepScanResult(data);
            // Auto-trigger AI summary once article is extracted
            if (!data.error && (data.content || data.title)) {
                handleAiSummary(data.content, data.title, url);
            }
        } catch (e) {
            const needsSignIn = /sign in/i.test(e?.message || '');
            setDeepScanResult({
                error: needsSignIn
                    ? 'Sign in with a magic link to run Firecrawl article extraction and AI intelligence briefs.'
                    : 'Deep scan unavailable. Please try again later.',
                requiresAuth: needsSignIn,
            });
        } finally {
            setDeepScanLoading(false);
        }
    };

    // ── Live News Scan: authenticated server-side query via Netlify function ──
    const fetchLiveNews = async (queryOverride) => {
        setNewsScanLoading(true);
        setNewsScanError(null);

        const query = queryOverride || newsQuery || 'geopolitical crisis conflict war sanctions sovereignty 2026';
        let path1Error = null;
        try {
            // 1. Try Netlify function first
            const fnRes = await secureFetch('/.netlify/functions/fetch-news', {
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
        } catch (e) { path1Error = e.message; }

        // Fallback: show server error (no client-side API calls — keys must stay server-side)
        if (path1Error) {
            setNewsScanError(`Scan failed. Server: ${path1Error}`);
        }
        setNewsScanLoading(false);
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
        const html = `<!DOCTYPE html><html><head><title>Live News Intel Briefing</title><style>body{font-family:monospace;background:#000;color:#0ff;padding:30px;max-width:800px;margin:0 auto}h1{color:#0ff;border-bottom:2px solid #0ff;padding-bottom:10px;font-size:1.1rem;letter-spacing:3px}.node{border:1px solid #333;padding:12px;margin:10px 0;border-radius:4px}.cat{color:#ff9900;font-size:0.7rem;letter-spacing:2px;margin-bottom:4px}.sub{color:#fff;font-size:0.85rem;margin-bottom:6px}.detail{color:#888;font-size:0.75rem;line-height:1.5}.src a{color:#00ff88;font-size:0.65rem}footer{color:#444;font-size:0.6rem;margin-top:30px;border-top:1px solid #222;padding-top:10px}@media print{body{background:#fff;color:#000}.cat{color:#c70}.src a{color:green}h1{color:#000;border-color:#000}}</style></head><body><h1>📡 LIVE NEWS INTEL BRIEFING — ${escHtml(date)}</h1>${newsNodes.map((n, i) => `<div class="node"><div class="cat">${String(i + 1).padStart(2, '0')} · ${escHtml(n.Broad_Category || n['Topic/Sector'] || 'GLOBAL')}</div><div class="sub">${escHtml(n['Entity/Subject'] || '')}</div><div class="detail"><strong>Players:</strong> ${escHtml(n['Key Player/Organization'] || '—')}<br/><strong>Impact:</strong> ${escHtml(n['Expected Impact/Value'] || '—')}<br/><strong>Timeline:</strong> ${escHtml(n.Timeline || '—')}</div>${safeHref(n.url) ? `<div class="src"><a href="${safeHref(n.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></div>` : ''}</div>`).join('')}<footer>Generated by Global Command Center · ${escHtml(date)} · Live News Scan</footer></body></html>`;
        const w = window.open('', '_blank');
        if (!w) {
            setNewsScanError('Export blocked by the browser. Allow pop-ups and try again.');
            return;
        }
        w.opener = null;
        w.document.write(html); w.document.close();
        setTimeout(() => w.print(), 400);
    };


    // ── Theory lens keyword maps (all 9 IR theories) ──────────────────────────
    const THEORY_KEYWORDS = {
        realism: /war|military|nuclear|territory|power|arms|coup|missile|troops|conflict|navy|siege|weapon|sanctions|invasion|balance.of.power|deterrence|security.dilemma|national.interest|strategic|defense|geopolitics|rival|supremacy|hegemony/,
        liberalism: /un\b|united nations|trade|wto|institution|cooperation|treaty|ngo|democracy|aid|climate|multilateral|agreement|imf|world bank|rule.of.law|human.rights|transparency|governance|diplomatic|peace.process|free.trade|interdependence|reform|accountability|election|civil.society/,
        constructivism: /identity|human rights|norms|refugee|sovereignty|dignity|gender|indigenous|culture|legitimacy|narrative|recognition|discourse|ethnic|nationalist|colonial|heritage|community|belonging|framing|perception|social.construct|belief|value|ideology|separatist|self.determination|apartheid|persecution|historical.memory|diaspora/,
        marxism: /class|exploit|capital|labor|worker|inequality|wealth|profit|poverty|wage|neoliberal|austerity|privatization|corporation|oligarch|surplus|proletariat|bourgeois|commodity|extraction|accumulation|sweatshop|factory|garment|supply.chain|debt/,
        structuralism: /core|periphery|dependency|develop|underdevelop|global.south|global.north|colonial|extraction|commodity|raw.material|industrializ|structural|unequal.exchange|world.system|imf|world.bank|debt|loan|aid|conditionality|terms.of.trade|multinational/,
        feminism: /women|gender|female|\bgirl\b|maternal|patriarch|sexual|lgbtq|domestic.violence|reproductive|feminist|masculinit|care.work|trafficking|\bbride\b|dowry|femicide|misogyn|glass.ceiling|pay.gap|gendered|women.rights|abortion|contraception/,
        postcolonialism: /colonial|imperial|decoloni|empire|settler|indigenous|native|subaltern|orientalism|eurocentri|western.gaze|global.south|race|racial|ethnic.cleansing|genocide|reparation|partition|mandate|protectorate|annexed|occupied|liberation|independence|self.determination|diaspora|migration|displacement/,
        greenTheory: /climate|environment|carbon|emissions|pollution|biodiversity|deforestation|ocean|ecosystem|species|sustainability|renewable|fossil.fuel|coal|oil|gas|solar|wind|drought|flood|wildfire|sea.level|glacier|arctic|plastic|waste|conservation|ecology|green|nature|earth/,
        criticalSecurity: /securit|surveillance|terrorism|cyber|border.control|refugee|migrant|asylum|detention|police|intelligence|threat|risk|emergency|crisis|extremism|radicali|civil.liberties|privacy|freedom|censorship|protest|dissent|authoritarian|human.security|food.security|water.security/
    };
    const THEORY_COLORS = {
        realism: '#ff3344',
        liberalism: '#00ddff',
        constructivism: '#00cc99',
        marxism: '#cc0000',
        structuralism: '#9966ff',
        feminism: '#ff66cc',
        postcolonialism: '#ff9933',
        greenTheory: '#33cc33',
        criticalSecurity: '#ff6600'
    };
    const THEORY_LABELS = {
        realism: 'Realism',
        liberalism: 'Liberalism',
        constructivism: 'Constructivism',
        marxism: 'Marxism',
        structuralism: 'Structuralism',
        feminism: 'Feminism',
        postcolonialism: 'Postcolonialism',
        greenTheory: 'Green Theory',
        criticalSecurity: 'Critical Security'
    };

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
                    caseCount: new Set(group
                        .filter(point => point.data.isCaseStudy && point.data.caseStudyId)
                        .map(point => point.data.caseStudyId)).size,
                    items: group.map(g => g.data),
                    data: dominant.data,
                });
            }
        }
        return clusters;
    };

    // Derive filtered forecasts independently of WebGL globe initialization
    const filteredForecasts = useMemo(() => filterIntelForecasts({
        forecasts,
        historicalData,
        selectedCategory,
        timelineYear,
        globeNewsOnly,
    }), [forecasts, historicalData, selectedCategory, timelineYear, globeNewsOnly]);

    // Update Globe Points
    const updateGlobeData = () => {
        if (!globeEl.current) return;

        const filtered = filteredForecasts;

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

        const globeItems = showEditorialCases ? filtered : filtered.filter(item => !item.isCaseStudy);
        const rawPoints = globeItems.flatMap(item => {
            const baseColor = item.isCaseStudy
                ? '#b69cff'
                : item.isLive ? '#00ffff' : (categoryColors[item.Broad_Category] || '#ffffff');
            const color = getPointColor(item, baseColor);
            const opacity = getPointOpacity(item);
            const fallbackLocation = {
                label: item.regionTags?.[0] || item['Entity/Subject'] || 'Mapped location',
                latitude: parseFloat(item.Latitude),
                longitude: parseFloat(item.Longitude),
            };
            const locations = item.isCaseStudy && item.map?.locations?.length
                ? item.map.locations
                : [fallbackLocation];

            return locations
                .filter(location => Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)))
                .map(location => ({
                lat: Number(location.latitude),
                lng: Number(location.longitude),
                size: (item.isCaseStudy ? 1.35 : item.isLive ? 1.2 : 0.8) * (theoryLens && opacity < 0.5 ? 0.4 : 1),
                color,
                opacity,
                data: item,
                locationLabel: location.label,
                type: item.isCaseStudy ? 'editorial-case' : 'forecast',
            }));
        });

        // Cluster nearby points
        const forecastPoints = clusterPoints(rawPoints);

        globeEl.current
            .pointsData(forecastPoints)
            .pointAltitude(point => point.data.isCaseStudy ? 0.035 : 0.01)
            .pointRadius('size')
            .pointColor('color')
            .onPointClick(point => {
                if (point.isCluster) {
                    globeEl.current.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.0 }, 600);
                    setExpandedCluster({ items: point.items, lat: point.lat, lng: point.lng });
                } else {
                    setExpandedCluster(null);
                    setSelectedForecast(point.data);
                    // Auto-select matching theory in detail modal when lens is active
                    if (theoryLens) setSelectedTheory(THEORY_LABELS[theoryLens] || 'Realism');
                }
            })
            .pointLabel(d => {
                if (d.isCluster) {
                    const caseDetail = d.caseCount ? ` · ${d.caseCount} EDITORIAL ${d.caseCount === 1 ? 'CASE' : 'CASES'}` : '';
                    return `<div style="background:rgba(0,0,0,0.9);padding:10px 14px;border:1px solid #ffcc00;border-radius:20px;font-family:Roboto Mono;color:#ffcc00;font-size:0.875rem;font-weight:900;line-height:1.4;">${d.count} MAP ITEMS${caseDetail} — click to expand</div>`;
                }
                const isLinked = d.data.url
                    ? `<div style="color:#00ff88;font-size:0.8rem;margin-top:7px;font-weight:bold;">[ ${d.data.isCaseStudy ? 'OPEN CASE & BRIEFING' : 'CLICK FOR SOURCE'} ]</div>`
                    : '';
                const layerLabel = d.data.isCaseStudy
                    ? `◆ EDITORIAL CASE · ${d.data.sources?.length || 0} PERSPECTIVES`
                    : d.data.isLive ? '[LIVE] CURRENT SOURCE' : 'REFERENCE SOURCE';
                const locationLabel = d.locationLabel ? `<div style="color:#b6c5ce;font-size:0.75rem;margin-top:5px;">📍 ${escHtml(d.locationLabel)}</div>` : '';
                return `<div style="background:rgba(0,0,0,0.94);padding:14px;border:1px solid ${d.color};border-radius:6px;font-family:Roboto Mono;color:#00ffff;max-width:340px;box-shadow:0 0 15px ${d.color}44;line-height:1.45;">
                    <div style="color:${d.color};font-size:0.75rem;font-weight:700;margin-bottom:6px;">${layerLabel}</div>
                    <div style="font-size:1rem;color:#fff;">${escHtml(d.data['Entity/Subject'])}</div>
                    ${locationLabel}
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
                        <div style="color:${d.relHex};font-size:0.75rem;font-weight:900;letter-spacing:1px;margin-bottom:7px;">${d.relIcon} ${d.relType} LINK</div>
                        <div style="color:#fff;font-size:0.875rem;font-weight:700;">${escHtml(d.fromName)}</div>
                        <div style="color:${d.relHex};font-size:1rem;text-align:center;margin:4px 0;">⇄</div>
                        <div style="color:#fff;font-size:0.875rem;font-weight:700;margin-bottom:7px;">${escHtml(d.toName)}</div>
                        <div style="color:#c0c0c0;font-size:0.8rem;line-height:1.5;border-top:1px solid ${d.relHex}44;padding-top:7px;">${escHtml(d.fromImpact || '')}</div>
                        <div style="color:#aaa;font-size:0.75rem;margin-top:7px;">CLICK ARC FOR FULL DETAIL</div>
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
    }, [filteredForecasts, stressLevel, theoryLens, showEditorialCases, globeReady, viewMode]);

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
        metrics.techEvents = categoryCounts['Technology & Science'] || 0;
        metrics.goldPrice = goldMentions.length > 0 ? '$4,500' : 'N/A';
        metrics.globalGrowth = gdpMentions.length > 0 ? '2.4%' : 'N/A';
        metrics.defenseSpending = defenseMentions.length > 0 ? '$2.9trn' : 'N/A';

        setKeyMetrics(metrics);
    };

    const tensionMeter = Math.min(100, (keyMetrics.conflictEvents && keyMetrics.totalEvents
        ? Math.round((keyMetrics.conflictEvents / keyMetrics.totalEvents) * 100)
        : 0) + stressLevel);

    const feedItems = searchIntelForecasts(filteredForecasts, feedSearch);
    const intelSummary = summarizeIntelSources(forecasts, intelMeta);
    const visibleSelectedCategory = historicalData && selectedCategory === LIVE_INTEL_CATEGORY
        ? ALL_INTEL_CATEGORY
        : selectedCategory;
    const feedEmptyState = getFeedEmptyState({
        feedItems,
        selectedCategory: visibleSelectedCategory,
        feedSearch,
        historicalLoading,
        historicalData,
        intelLoading,
        intelStatus: intelSummary.feedStatus,
    });
    const currentFeedLabel = getCurrentFeedLabel(intelSummary);

    useEffect(() => {
        setFeedPage(1);
    }, [selectedCategory, feedSearch, timelineYear]);



    return (
        <div className={`command-center command-center--${viewMode}${largeText ? ' large-text' : ''}${reducedEffects ? ' reduced-effects' : ''}`}>
            {/* Skip navigation for accessibility */}
            <a href="#main-workspace" className="skip-nav">Skip to main content</a>
            {showModal && <AuthModal onClose={closeModal} initialError={authError} />}
            {/* Loading skeleton while globe initializes */}
            {viewMode === 'globe' && mobileGlobeEnabled && !globeReady && (
                <div className="globe-loading-overlay" role="status" aria-label="Loading globe">
                    <div className="globe-loading-spinner">⬢</div>
                    <div className="globe-loading-text">INITIALIZING COMMAND CENTER...</div>
                </div>
            )}
            <div className={`dashboard-view dashboard-view--${viewMode}`} ref={dashboardRef}>
                {/* Header */}
                <header className="header" role="navigation" aria-label="Main navigation">
                    <div className="logo">
                        <span className="logo-icon" aria-hidden="true">⬢</span>
                        <span className="logo-text">GLOBAL COMMAND CENTER</span>
                    </div>
                    
                    <nav className="view-mode-selector" aria-label="Intelligence views">
                        {[
                            ['globe', '🌎', 'LIVE GLOBE'],
                            ['briefings', '▤', 'GUIDED BRIEFINGS'],
                            ['nexus', '⚯', 'ADVANCED NEXUS'],
                        ].map(([id, icon, label]) => (
                            <button
                                key={id}
                                type="button"
                                aria-current={viewMode === id ? 'page' : undefined}
                                className={`view-mode-btn ${viewMode === id ? 'active' : ''}`}
                                onClick={() => {
                                    if (viewMode === id) return;
                                    if (id === 'nexus') {
                                        navigateView(id, { actor: nexusEntry.nodeId });
                                    } else if (id === 'briefings') {
                                        navigateView(id, { tour: briefingEntry.tourId, step: briefingEntry.step });
                                    } else {
                                        navigateView(id);
                                    }
                                }}
                            >
                                <span aria-hidden="true">{icon}</span>
                                <span className="view-mode-label">{label}</span>
                            </button>
                        ))}
                    </nav>

                    <div className="date-time header-actions">
                        <a
                            href="https://glopocompanion.netlify.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="companion-btn companion-btn--header"
                            aria-label="Launch GloPo Companion in a new tab"
                        >
                            GLOPO GPT ↗
                        </a>
                        <AuthBadge
                            user={user}
                            onSignInClick={openModal}
                            triggerId="gcc-signin-header-trigger"
                            className="auth-badge-wrapper--header"
                        />
                        <details className="header-tools">
                            <summary>TOOLS &amp; DISPLAY</summary>
                            <div className="header-tools-panel">
                                <div className="display-preferences" role="group" aria-label="Display preferences">
                                    <span className="display-preferences-label">DISPLAY</span>
                                    <button
                                        type="button"
                                        className="preference-toggle"
                                        aria-pressed={largeText}
                                        onClick={() => setLargeText(value => !value)}
                                    >
                                        A+ LARGER TEXT
                                    </button>
                                    <button
                                        type="button"
                                        className="preference-toggle"
                                        aria-pressed={reducedEffects}
                                        onClick={() => setReducedEffects(value => !value)}
                                    >
                                        ◌ REDUCE EFFECTS
                                    </button>
                                    {viewMode === 'globe' && (
                                        <button
                                            type="button"
                                            className="preference-toggle"
                                            aria-pressed={metricsCollapsed}
                                            onClick={() => setMetricsCollapsed(value => !value)}
                                        >
                                            {metricsCollapsed ? '▤ SHOW METRICS' : '▾ HIDE METRICS'}
                                        </button>
                                    )}
                                </div>
                        <a
                            href="https://glopocompanion.netlify.app/"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="companion-btn companion-btn--menu"
                            aria-label="Launch GloPo Companion in a new tab"
                        >
                            GLOPO COMPANION GPT ↗
                        </a>
                        <button
                            className="credits-link"
                            onClick={() => attributionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                        >
                            CREDITS & LICENSE
                        </button>
                        <AuthBadge
                            user={user}
                            onSignInClick={openModal}
                            triggerId="gcc-signin-trigger"
                            className="auth-badge-wrapper--menu"
                        />
                        {viewMode === 'globe' && <>
                        <span className={`live-indicator ${['provider', 'public-cache'].includes(intelSummary.sourceMode) ? '' : 'reference-mode'}`}>
                            {intelLoading
                                ? '○ LOADING'
                                : intelSummary.sourceMode === 'provider'
                                    ? '● CURRENT'
                                    : intelSummary.sourceMode === 'public-cache'
                                        ? intelSummary.feedStatus === 'stale' ? '◐ STALE CACHE' : '● CACHED'
                                        : '○ REFERENCE'}
                        </span>
                        <button className="export-btn" onClick={() => {
                            const nodes = filteredForecasts.slice(0, 40);
                            const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                            const html = `<!DOCTYPE html><html><head><title>Global Intelligence Briefing</title><style>body{font-family:monospace;background:#000;color:#0ff;padding:30px;max-width:800px;margin:0 auto}h1{color:#0ff;border-bottom:2px solid #0ff;padding-bottom:10px;font-size:1.1rem;letter-spacing:3px}.node{border:1px solid #333;padding:12px;margin:10px 0;border-radius:4px}.cat{color:#ff9900;font-size:0.7rem;letter-spacing:2px;margin-bottom:4px}.sub{color:#fff;font-size:0.85rem;margin-bottom:6px}.detail{color:#888;font-size:0.75rem;line-height:1.5}.src a{color:#00ff88;font-size:0.65rem}footer{color:#444;font-size:0.6rem;margin-top:30px;border-top:1px solid #222;padding-top:10px}@media print{body{background:#fff;color:#000}.cat{color:#c70}.src a{color:green}h1{color:#000;border-color:#000}}</style></head><body><h1>⬢ GLOBAL INTELLIGENCE BRIEFING — ${escHtml(date)}</h1>${nodes.map((n, i) => `<div class="node"><div class="cat">${String(i + 1).padStart(2, '0')} · ${escHtml(n.Broad_Category || n['Topic/Sector'] || 'GLOBAL')}</div><div class="sub">${escHtml(n['Entity/Subject'] || '')}</div><div class="detail"><strong>Players:</strong> ${escHtml(n['Key Player/Organization'] || '—')}<br/><strong>Impact:</strong> ${escHtml(n['Expected Impact/Value'] || '—')}<br/><strong>Timeline:</strong> ${escHtml(n.Timeline || '—')}</div>${safeHref(n.url) ? `<div class="src"><a href="${safeHref(n.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></div>` : ''}</div>`).join('')}<footer>Generated by Global Command Center · ${escHtml(date)} · globalcommandcenter2026.netlify.app</footer></body></html>`;
                            const w = window.open('', '_blank');
                            if (!w) return;
                            w.opener = null;
                            w.document.write(html); w.document.close();
                            setTimeout(() => w.print(), 400);
                        }} title="Export Intelligence Briefing">
                            📄 EXPORT BRIEFING
                        </button>

                        {/* 📡 Live News Scan */}
                        <div className="news-tools">
                            {/* Search row */}
                            <div className="news-search-row">
                                <label className="sr-only" htmlFor="news-topic-search">Search current geopolitical news by topic</label>
                                <input
                                    id="news-topic-search"
                                    className="news-input"
                                    value={newsQuery}
                                    onChange={e => setNewsQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && fetchLiveNews()}
                                    placeholder="Search news topic…"
                                />
                                <button
                                    className="export-btn news-scan-btn"
                                    onClick={() => fetchLiveNews()}
                                    disabled={newsScanLoading}
                                    style={{ background: newsScanLoading ? 'rgba(0,255,200,0.05)' : 'rgba(0,255,200,0.1)', borderColor: 'rgba(0,255,200,0.3)', color: '#00ffcc' }}
                                    title="Fetch live geopolitical news and place on globe"
                                >
                                    {newsScanLoading ? '⟳ SCANNING...' : '📡 NEWS SCAN'}
                                </button>
                            </div>
                            {newsScanError && (
                                <div className="news-scan-error" role="status">
                                    ⚠ {newsScanError}
                                </div>
                            )}

                            {/* ✅ SCAN COMPLETE action panel — floats below header, doesn't affect layout */}
                            {newsNodes.length > 0 && !newsScanLoading && (() => {
                                const conflictCount = newsNodes.filter(n => n.Broad_Category === 'Geopolitics & Conflict').length;
                                const econCount = newsNodes.filter(n => n.Broad_Category === 'Economy & Trade').length;
                                const otherCount = newsNodes.length - conflictCount - econCount;
                                return (
                                    <div className="news-action-panel">
                                        {/* Header */}
                                        <div className="news-action-title" role="status">
                                            ✅ SCAN COMPLETE — +{newsNodes.length} NODES PLOTTED
                                        </div>
                                        {/* Category mini-stats */}
                                        <div className="news-action-stats">
                                            <span style={{ color: '#ff0066' }}>⚔️ {conflictCount} Conflict</span>
                                            <span style={{ color: '#00ccff' }}>💰 {econCount} Economy</span>
                                            <span style={{ color: '#aaa' }}>🌍 {otherCount} Other</span>
                                        </div>
                                        {/* Action buttons */}
                                        <div className="news-action-buttons">
                                            <button
                                                type="button"
                                                className="news-action-btn news-action-btn--feed"
                                                onClick={() => { setSelectedCategory('Live Intel'); }}
                                                title="Filter Intel Feed to show only news nodes"
                                            >
                                                📋 VIEW IN FEED
                                            </button>
                                            <button
                                                type="button"
                                                className={`news-action-btn news-action-btn--globe${globeNewsOnly ? ' active' : ''}`}
                                                onClick={() => setGlobeNewsOnly(prev => !prev)}
                                                title={globeNewsOnly ? 'Showing news nodes only — click to restore all' : 'Filter globe to show only scanned news nodes'}
                                            >
                                                {globeNewsOnly ? '🎯 NEWS ONLY ✓' : '🎯 FILTER GLOBE'}
                                            </button>
                                            <button
                                                type="button"
                                                className="news-action-btn news-action-btn--export"
                                                onClick={exportNewsReport}
                                                title="Export a printable briefing of the scanned news nodes"
                                            >
                                                📄 EXPORT BRIEFING
                                            </button>
                                            <button
                                                type="button"
                                                className="news-action-btn news-action-btn--danger"
                                                onClick={clearNewsNodes}
                                                title="Clear news scan and reset globe"
                                            >
                                                🗑️ CLEAR SCAN
                                            </button>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                        </>}
                            </div>
                        </details>
                    </div>
                </header>

                {/* Main Content */}
                <div id="main-workspace" className={`main-content main-content--${viewMode}${sidebarCollapsed ? ' main-content--feed-collapsed' : ''}`} role="main" tabIndex="-1">
                    {/* Globe Center Stage */}
                    <GlobeErrorBoundary>
                    <div className={`globe-container ${stressLevel > 70 ? 'critical-vignette' : ''}${!mobileGlobeEnabled ? ' globe-container--mobile-optin' : ''}`} style={viewMode !== 'globe' ? { display: 'none' } : {}}>
                        <div ref={globeContainer} style={{ width: '100%', height: '100%', display: viewMode === 'globe' && mobileGlobeEnabled ? 'block' : 'none' }} />
                        {viewMode === 'globe' && !mobileGlobeEnabled && (
                            <div className="mobile-globe-optin-card">
                                <div className="mobile-globe-optin-badge">⬢ MOBILE COMMAND BRIEF</div>
                                <h2 className="mobile-globe-optin-title">GLOBAL ISSUES &amp; CASE MAP</h2>
                                <p className="mobile-globe-optin-copy">
                                    {forecasts.length} tracked records and {CASE_STUDIES_2026.length} sourced editorial case studies ready below. Load the interactive 3D WebGL globe on demand to save battery and mobile data.
                                </p>
                                <div className="mobile-globe-optin-actions">
                                    <button
                                        type="button"
                                        className="mobile-globe-load-btn"
                                        onClick={() => setMobileGlobeEnabled(true)}
                                    >
                                        🌐 LOAD 3D GLOBE
                                    </button>
                                    <button
                                        type="button"
                                        className="mobile-jump-feed-btn"
                                        onClick={() => {
                                            setSidebarCollapsed(false);
                                            requestAnimationFrame(() => {
                                                document.getElementById('intel-feed')?.scrollIntoView({ behavior: 'smooth' });
                                            });
                                        }}
                                    >
                                        ↓ JUMP TO INTEL FEED
                                    </button>
                                </div>
                            </div>
                        )}
                        {viewMode === 'globe' && mobileGlobeEnabled && (
                            <button
                                type="button"
                                className="mobile-floating-feed-jump"
                                onClick={() => {
                                    setSidebarCollapsed(false);
                                    requestAnimationFrame(() => {
                                        document.getElementById('intel-feed')?.scrollIntoView({ behavior: 'smooth' });
                                    });
                                }}
                            >
                                ↓ JUMP TO INTEL FEED
                            </button>
                        )}
                        
                        {viewMode === 'globe' && mobileGlobeEnabled && (
                            <div className="globe-overlay">
                                <div className="globe-title">GLOBAL ISSUES & CASE MAP</div>
                                <button
                                    type="button"
                                    className={`editorial-layer-toggle ${showEditorialCases ? 'active' : ''}`}
                                    onClick={() => setShowEditorialCases(value => !value)}
                                    aria-pressed={showEditorialCases}
                                    title="Show or hide the curated case-study layer"
                                >
                                    <span aria-hidden="true">◆</span>
                                    EDITORIAL CASES
                                    <strong>{CASE_STUDIES_2026.length}</strong>
                                    <small>{showEditorialCases ? 'ON' : 'OFF'}</small>
                                </button>
                            </div>
                        )}



                        {/* Node Key & Theory Lens — collapsible compact panel */}
                        {viewMode === 'globe' && mobileGlobeEnabled && (
                        <div className="arc-legend" style={{ maxHeight: legendCollapsed ? '48px' : 'min(70vh, 540px)', overflow: 'hidden', transition: 'max-height 0.3s ease' }}>
                            <button
                                type="button"
                                className="arc-legend-toggle"
                                onClick={() => setLegendCollapsed(!legendCollapsed)}
                                aria-expanded={!legendCollapsed}
                                style={{ marginBottom: legendCollapsed ? 0 : '6px' }}
                            >
                                <span className="arc-legend-title" style={{ margin: 0 }}>
                                    {legendCollapsed ? '◀ KEY / THEORY' : '▼ KEY / THEORY'}
                                </span>
                                <span className="arc-legend-state">
                                    {legendCollapsed ? 'EXPAND' : 'COLLAPSE'}
                                </span>
                            </button>

                            {!legendCollapsed && (
                                <>
                                    {/* Node Key — compact two-column */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px', marginBottom: '8px' }}>
                                        {[
                                            ['Conflict', '#ff0066'],
                                            ['Economy', '#00ccff'],
                                            ['Tech', '#00ff88'],
                                            ['Health', '#ff9900'],
                                            ['Environ', '#66ff00'],
                                            ['Culture', '#ff00ff'],
                                            ['Live', '#00ffff'],
                                            ['Cases', '#b69cff'],
                                        ].map(([label, color]) => (
                                            <div key={label} className="arc-legend-item" style={{ marginBottom: '1px' }}>
                                                <span className="arc-legend-dot" style={{ background: color, boxShadow: `0 0 4px ${color}`, width: '6px', height: '6px' }} />
                                                <span className="arc-legend-label" style={{ color }}>{label}</span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Arc type sub-key — only at elevated stress */}
                                    {stressLevel > 50 && (
                                        <>
                                            <div className="arc-legend-title" style={{ marginBottom: '3px' }}>ARC KEY</div>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 6px', marginBottom: '8px' }}>
                                                {[['⚔️', 'Military', '#ff2200'], ['💰', 'Economic', '#ff9900'], ['🗺️', 'Territory', '#ffdd00'], ['🏥', 'Humanit.', '#00ff99'], ['🤝', 'Diplom.', '#cc44ff']].map(([icon, label, color]) => (
                                                    <div key={label} className="arc-legend-item" style={{ marginBottom: '1px' }}>
                                                        <span className="arc-legend-dot" style={{ background: color, boxShadow: `0 0 4px ${color}`, width: '6px', height: '6px' }} />
                                                        <span className="arc-legend-label" style={{ color }}>{icon} {label}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}

                                    {/* Theory Lens Toggles — compact */}
                                    <div className="arc-legend-title" style={{ marginBottom: '3px' }}>THEORY LENS</div>
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px' }}>
                                        {Object.entries(THEORY_LABELS).map(([key, label]) => {
                                            const isActive = theoryLens === key;
                                            const color = THEORY_COLORS[key];
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    className={`legend-theory-btn ${isActive ? 'active' : ''}`}
                                                    onClick={() => setTheoryLens(isActive ? null : key)}
                                                    aria-pressed={isActive}
                                                    style={{
                                                        background: isActive ? color + '30' : 'transparent',
                                                        border: `1px solid ${isActive ? color : color + '33'}`,
                                                        borderRadius: '10px',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '3px',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = color + '18'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                                                >
                                                    <span style={{
                                                        width: '5px', height: '5px', borderRadius: '50%',
                                                        background: isActive ? color : color + '66',
                                                        boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                                                        flexShrink: 0,
                                                    }} />
                                                    <span style={{
                                                        color: isActive ? color : color + '99',
                                                        fontWeight: isActive ? 700 : 400,
                                                    }} className="theory-btn-label">
                                                        {label.length > 12 ? label.slice(0, 10).toUpperCase() + '…' : label.toUpperCase()}
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {theoryLens && (
                                        <div className="theory-filter-status" style={{ background: THEORY_COLORS[theoryLens] + '12', borderColor: THEORY_COLORS[theoryLens] + '33', color: THEORY_COLORS[theoryLens] }}>
                                            <div>
                                                Filtering: {THEORY_LABELS[theoryLens]} keywords
                                            </div>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                        )}
                    </div>
                    </GlobeErrorBoundary>

                    {viewMode === 'briefings' && (
                        <NexusErrorBoundary>
                            <React.Suspense fallback={<div className="nexus-route-loading" role="status">LOADING GUIDED BRIEFINGS…</div>}>
                                <GuidedBriefings
                                    initialTourId={briefingEntry.tourId}
                                    initialNodeId={briefingEntry.nodeId}
                                    initialStep={briefingEntry.step}
                                    onExploreNode={openNexusAtActor}
                                    onRouteChange={rememberBriefingRoute}
                                />
                            </React.Suspense>
                        </NexusErrorBoundary>
                    )}

                    {/* Relations Nexus — focused by default, 3D on demand */}
                    {viewMode === 'nexus' && (
                        <NexusErrorBoundary>
                            <React.Suspense fallback={<div className="nexus-route-loading" role="status">LOADING FOCUS NEXUS…</div>}>
                                <NexusWorkspace
                                    forecasts={filteredForecasts}
                                    selectedTheory={selectedTheory}
                                    theories={theories}
                                    onTheorySelect={setSelectedTheory}
                                    initialNodeId={nexusEntry.nodeId}
                                    onActorChange={rememberNexusActor}
                                    onOpenBriefing={openBriefing}
                                />
                            </React.Suspense>
                        </NexusErrorBoundary>
                    )}

                    {/* Cluster expand panel */}
                    {expandedCluster && (
                        <>
                            {/* Backdrop — click outside to dismiss */}
                            <div onClick={() => setExpandedCluster(null)} aria-hidden="true"
                                style={{ position: 'absolute', inset: 0, zIndex: 99, cursor: 'default' }} />
                            <div
                                ref={clusterDialogRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="cluster-dialog-title"
                                tabIndex="-1"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.95)', border: '1px solid #ffcc00',
                                    borderRadius: '12px', padding: '16px', zIndex: 100, width: '320px',
                                    maxHeight: '60vh', overflowY: 'auto', fontFamily: 'Roboto Mono, monospace',
                                    boxShadow: '0 0 30px #ffcc0044'
                                }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span id="cluster-dialog-title" style={{ color: '#ffcc00', fontWeight: 900, fontSize: '0.8rem' }}>
                                        📍 {dedupeClusterItems(expandedCluster.items).length} MAP ITEMS IN REGION
                                    </span>
                                    <button onClick={() => setExpandedCluster(null)} aria-label="Close map items"
                                        style={{ background: 'none', border: '1px solid #ffcc0055', borderRadius: '4px', color: '#ffcc00', cursor: 'pointer', padding: '2px 8px', fontSize: '0.75rem' }}>
                                        ✕
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(() => {
                                        const uniqueItems = dedupeClusterItems(expandedCluster.items);
                                        // Group items by category
                                        const groups = {};
                                        uniqueItems.forEach(item => {
                                            const cat = item.isCaseStudy ? 'Editorial Cases' : item.isLive ? 'Live Intel' : (item.Broad_Category || 'Other');
                                            if (!groups[cat]) groups[cat] = [];
                                            groups[cat].push(item);
                                        });
                                        return Object.entries(groups).map(([cat, items]) => {
                                            const catColor = items[0].isCaseStudy ? '#b69cff' : items[0].isLive ? '#00ffff' : (categoryColors[cat] || '#aaaaaa');
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
                                                                    {item.isCaseStudy ? <span style={{ color: '#b69cff', fontWeight: 700, marginRight: '4px' }}>[CASE]</span> : null}
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
                    <aside id="intel-feed" className={`intel-feed ${sidebarCollapsed ? 'collapsed' : ''}`} role="complementary" aria-label="Intelligence Feed" style={viewMode !== 'globe' ? { display: 'none' } : {}}>
                        <button
                            type="button"
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
                                <span className="intel-history-status">
                                    {historicalLoading ? '⟳ LOADING...' : `${historicalData.length} EVENTS • SOURCED`}
                                </span>
                            ) : intelLastUpdated && (
                                <>
                                    <span
                                        className={`intel-source-status ${intelSummary.sourceMode === 'provider' ? 'provider' : intelSummary.sourceMode === 'public-cache' ? (intelSummary.feedStatus === 'stale' ? 'warning' : 'cached') : ['not-configured', 'unavailable', 'network-error'].includes(intelSummary.feedStatus) ? 'warning' : 'reference'}`}
                                        role="status"
                                    >
                                        {intelSummary.sourceMode === 'provider'
                                            ? `● ${intelSummary.liveItemCount} PROVIDER-CURRENT · ${intelLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                                            : intelSummary.sourceMode === 'public-cache'
                                                ? `${intelSummary.feedStatus === 'stale' ? '◐' : '●'} ${intelSummary.liveItemCount} ${intelSummary.feedStatus === 'stale' ? 'STALE' : 'CACHED'} CURRENT · ${intelLastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
                                                : intelSummary.feedStatus === 'not-configured'
                                                    ? `△ CURRENT FEED NOT CONFIGURED · ${CASE_STUDIES_2026.length} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                                    : ['unavailable', 'network-error'].includes(intelSummary.feedStatus)
                                                        ? `△ CURRENT FEED UNAVAILABLE · ${CASE_STUDIES_2026.length} CASES + ${intelSummary.linkedReferenceCount} PUBLIC SOURCES`
                                                        : `○ PUBLIC REFERENCE MODE · ${CASE_STUDIES_2026.length} CASES + ${intelSummary.linkedReferenceCount} LINKED SOURCES`}
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
                                onChange={(event) => setFeedSearch(event.target.value)}
                                placeholder="Search actors, topics, sources…"
                            />
                            <select
                                className="category-filter"
                                value={visibleSelectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
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
                                                if (feedEmptyState.action === 'clear-search') setFeedSearch('');
                                                if (feedEmptyState.action === 'show-public-sources') setSelectedCategory(ALL_INTEL_CATEGORY);
                                            }}
                                        >
                                            {feedEmptyState.actionLabel}
                                        </button>
                                    )}
                                </div>
                            ) : feedItems.slice(0, feedPage * FEED_PAGE_SIZE).map((forecast, idx) => (
                                <article
                                    key={`${forecast.caseStudyId || forecast.url || forecast['Entity/Subject'] || forecast['Topic/Sector'] || 'forecast'}-${idx}`}
                                    className={`intel-card ${selectedForecast === forecast ? 'selected' : ''} ${forecast.isLive ? 'live-item' : ''} ${forecast.isEditorial ? 'editorial-item' : ''}`}
                                    style={{ borderLeftColor: forecast.isHistorical ? '#ffcc00' : forecast.isLive ? '#00ffff' : forecast.isEditorial ? '#b69cff' : categoryColors[forecast.Broad_Category] }}
                                >
                                    <button
                                        type="button"
                                        className="intel-card-trigger"
                                        onClick={() => setSelectedForecast(forecast)}
                                    >
                                        {forecast.isLive && <span className="live-tag">● {forecast._scraperSource === 'serper-public-cache' ? 'CACHED CURRENT' : 'LIVE INTEL'}</span>}
                                        {forecast.isLive && forecast.coverage && (
                                            <span className="coverage-badges" aria-label="Coverage classification">
                                                <span>{forecast.coverage.region}</span>
                                                <span>{forecast.coverage.issue}</span>
                                                <span>{forecast.coverage.sourceRoleLabel}</span>
                                            </span>
                                        )}
                                        {forecast.isCaseStudy
                                            ? <span className="case-study-tag">◆ CASE BRIEF · {forecast.updatedAt}</span>
                                            : forecast.isEditorial && <span className="context-tag">◆ DATED CONTEXT</span>}
                                        {forecast.isReference && !forecast.isEditorial && !forecast.isCaseStudy && (
                                            <span className="reference-tag">
                                                {forecast.url ? '◇ PUBLIC SOURCE' : '◇ LEGACY REFERENCE'}
                                            </span>
                                        )}
                                        {forecast.isHistorical && <span className="live-tag" style={{ background: '#ffcc0022', color: '#ffcc00', borderColor: '#ffcc0044' }}>📅 {timelineYear}</span>}
                                        <span className="card-category" style={{ color: forecast.isHistorical ? '#ffcc00' : forecast.isLive ? '#00ffff' : getAccessibleTextAccent(categoryColors[forecast.Broad_Category]) }}>
                                            {forecast.Broad_Category}
                                        </span>
                                        <span className="card-title">{forecast.isCaseStudy ? forecast['Entity/Subject'] : forecast['Topic/Sector']}</span>
                                        <span className="card-timeline">⏱ {forecast.isCaseStudy ? `${forecast.regionTags?.join(' · ')} · ${forecast.Timeline}` : forecast.Timeline}</span>
                                        <span className="card-impact">{(forecast.isCaseStudy ? forecast.statusSummary : forecast['Expected Impact/Value'])?.substring(0, 120)}...</span>
                                    </button>
                                    {(forecast.url || forecast.caseStudyId) && (
                                        <div className="card-actions">
                                            {forecast.url && (
                                                <a
                                                    href={forecast.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="card-link"
                                                >
                                                    OPEN SOURCE ↗
                                                </a>
                                            )}
                                            {forecast.caseStudyId && (
                                                <button
                                                    type="button"
                                                    className="card-briefing-btn"
                                                    onClick={() => openBriefing(forecast.caseStudyId)}
                                                >
                                                    BRIEFING →
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </article>
                            ))}
                            {/* Show More button for pagination */}
                            {feedPage * FEED_PAGE_SIZE < feedItems.length && (
                                <button
                                    className="show-more-btn"
                                    onClick={() => setFeedPage(p => p + 1)}
                                    aria-label={`Show more events. Currently showing ${Math.min(feedPage * FEED_PAGE_SIZE, feedItems.length)} of ${feedItems.length}`}
                                >
                                    ▼ SHOW MORE ({feedItems.length - feedPage * FEED_PAGE_SIZE} remaining)
                                </button>
                            )}
                        </div>
                </aside>
                </div> {/* end .main-content */}

                {/* Bottom operational dashboard */}
                <section
                    className={`metrics-shell${metricsCollapsed ? ' collapsed' : ''}`}
                    aria-label="Operational metrics and scenario controls"
                    style={viewMode !== 'globe' ? { display: 'none' } : {}}
                >
                    <button
                        type="button"
                        className="metrics-collapse-toggle"
                        aria-expanded={!metricsCollapsed}
                        aria-controls="operational-metrics"
                        onClick={() => setMetricsCollapsed(value => !value)}
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
                        onClick={() => setShowMineralsModal(true)}
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
                                        type="button"
                                        className={`timeline-year-btn${timelineYear === y ? ' active' : ''}`}
                                        onClick={() => setTimelineYear(y)}
                                    >{y === 'ALL' ? 'ALL' : `'${y.slice(2)}`}</button>
                                ))}
                            </div>
                        </div>
                    </div>
                    </div>
                </section>
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
                    <p style={{ color: '#d4dde6', fontSize: '12px', lineHeight: '1.65' }}>
                        This project is a 100% academic tool created by <strong>Stephen Martinez (Project Lead &amp; IB Global Politics Teacher)</strong>{' '}
                        to support scholars in the IB Global Politics 2026 Syllabus.
                        It is not a commercial product and provides free pedagogical resources.
                    </p>
                </div>
                <div style={{ marginBottom: '30px' }}>
                    <a href="/CODE_OF_CONDUCT.md" style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        minHeight: '44px',
                        color: '#ffffff',
                        background: '#7a0099',
                        padding: '12px 20px',
                        textDecoration: 'none',
                        fontSize: '14px',
                        fontWeight: '900',
                        letterSpacing: '2px',
                        borderRadius: '0',
                        border: '2px solid #ffffff',
                        boxShadow: '0 0 20px rgba(255, 0, 255, 0.55)'
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
                        src="/assets/netlify-badge-color-accent.svg"
                        width="114"
                        height="50"
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
                        <div ref={detailModalRef} className="modal-content" role="dialog" aria-modal="true" aria-labelledby="forecast-dialog-title" tabIndex="-1" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
                            <button className="close-btn" aria-label="Close intelligence detail" onClick={() => { setSelectedForecast(null); setDeepScanResult(null); setAiSummary(null); }}>✕</button>
                            <div
                                className="modal-header"
                                style={{ borderBottomColor: categoryColors[selectedForecast.Broad_Category] }}
                            >
                                <span className="modal-category" style={{ color: getAccessibleTextAccent(categoryColors[selectedForecast.Broad_Category]) }}>
                                    {selectedForecast.Broad_Category}
                                </span>
                                <h2 id="forecast-dialog-title">{selectedForecast.isCaseStudy ? selectedForecast['Entity/Subject'] : selectedForecast['Topic/Sector']}</h2>
                                {selectedForecast.isCaseStudy && <p className="modal-case-subtitle">{selectedForecast['Topic/Sector']}</p>}
                            </div>
                            <div className="modal-body">
                                {selectedForecast.isCaseStudy && (
                                    <section className="case-study-overview" aria-label="Verified case-study evidence">
                                        <div className="case-study-meta">
                                            {selectedForecast.regionTags?.map(region => <span key={region}>{region}</span>)}
                                            <time dateTime={selectedForecast.updatedAt}>As of {selectedForecast.updatedAt}</time>
                                            <span>{selectedForecast.confidence} source confidence</span>
                                            {selectedForecast.reviewBy && (
                                                <time
                                                    className={isReviewOverdue(selectedForecast.reviewBy) ? 'review-overdue' : ''}
                                                    dateTime={selectedForecast.reviewBy}
                                                >
                                                    {isReviewOverdue(selectedForecast.reviewBy) ? 'Review overdue since' : 'Review by'} {selectedForecast.reviewBy}
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
                                                    {selectedForecast.sources.map(source => (
                                                        <li key={source.url}>
                                                            {source.perspectiveType && <em className={`case-source-badge case-source-${source.perspectiveType}`}>{source.perspectiveType}</em>}
                                                            <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                                                            <span>{source.publisher}{source.dateLabel ? ` · ${source.dateLabel}` : ''}{source.perspective ? ` · ${source.perspective}` : ''}</span>
                                                            {source.supports && <small>Supports: {source.supports}</small>}
                                                        </li>
                                                    ))}
                                                </ul>
                                                {selectedForecast.supplementalSources?.length > 0 && (
                                                    <details>
                                                        <summary>{selectedForecast.supplementalSources.length} supplemental {selectedForecast.supplementalSources.length === 1 ? 'source' : 'sources'}</summary>
                                                        <ul>
                                                            {selectedForecast.supplementalSources.map(source => (
                                                                <li key={source.url}>
                                                                    <a href={source.url} target="_blank" rel="noopener noreferrer">{source.title}</a>
                                                                    <span>{source.publisher}{source.dateLabel ? ` · ${source.dateLabel}` : ''}</span>
                                                                </li>
                                                            ))}
                                                        </ul>
                                                    </details>
                                                )}
                                            </div>
                                        )}
                                        <button
                                            type="button"
                                            className="case-study-briefing-btn"
                                            onClick={() => {
                                                setSelectedForecast(null);
                                                openBriefing(selectedForecast.caseStudyId, selectedForecast.nexusActorIds?.[0]);
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
                                            <span>{selectedForecast.coverage.sourceRoleLabel}</span>
                                        </div>
                                        <p>{selectedForecast.coverage.selectionReason}</p>
                                        <small>Automated discovery metadata supports coverage balance. A source role describes format and standpoint—not neutrality, accuracy, or endorsement.</small>
                                    </section>
                                )}
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
                                            <span className="theory-name" style={{ color: getAccessibleTextAccent(theories[selectedTheory].color) }}>{selectedTheory}</span>
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

                                                        {/* Key Concept Tags */}
                                                        {aiSummary.keyConceptTags?.length > 0 && (
                                                            <div className="brief-row">
                                                                <span className="brief-row-label">🏷️ KEY CONCEPTS</span>
                                                                <div className="actor-chips">
                                                                    {aiSummary.keyConceptTags.map((concept, i) => (
                                                                        <span key={i} className="theme-badge" style={{ borderColor: '#ff9900', color: '#ff9900' }}>{concept}</span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Cui Bono */}
                                                        {aiSummary.cuiBono && (
                                                            <div className="brief-summary" style={{ borderLeftColor: '#ff6600' }}>
                                                                <span className="brief-row-label">🎯 CUI BONO — WHO BENEFITS?</span>
                                                                <p className="summary-text" style={{ color: '#ff9966' }}>{aiSummary.cuiBono}</p>
                                                            </div>
                                                        )}

                                                        {/* Global South Perspective */}
                                                        {aiSummary.globalSouthPerspective && (
                                                            <div className="student-prompt-box" style={{ borderColor: '#33cc33', background: 'rgba(51,204,51,0.05)' }}>
                                                                <span className="prompt-label" style={{ color: '#33cc33' }}>🌍 GLOBAL SOUTH PERSPECTIVE</span>
                                                                <p className="prompt-text" style={{ color: '#aaddaa' }}>{aiSummary.globalSouthPerspective}</p>
                                                            </div>
                                                        )}

                                                        {/* Historical Parallel */}
                                                        {aiSummary.historicalParallel && (
                                                            <div className="brief-row">
                                                                <span className="brief-row-label">📖 HISTORICAL PARALLEL</span>
                                                                <p className="summary-text" style={{ fontSize: '0.72rem', color: '#ccaaff', fontStyle: 'italic' }}>{aiSummary.historicalParallel}</p>
                                                            </div>
                                                        )}

                                                        {/* Source Evaluation */}
                                                        {(aiSummary.sourceType || aiSummary.sourceBias) && (
                                                            <div className="brief-row" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px', borderRadius: '4px' }}>
                                                                <span className="brief-row-label">🔍 SOURCE EVALUATION</span>
                                                                {aiSummary.sourceType && <p className="summary-text" style={{ fontSize: '0.68rem' }}><strong style={{ color: '#00ddff' }}>Type:</strong> {aiSummary.sourceType}</p>}
                                                                {aiSummary.sourceBias && <p className="summary-text" style={{ fontSize: '0.68rem', color: '#ffaa66' }}><strong>Bias:</strong> {aiSummary.sourceBias}</p>}
                                                            </div>
                                                        )}

                                                        {/* Paper 2 Prompts */}
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
                                            <div className={`scan-error${deepScanResult.requiresAuth ? ' scan-error--auth' : ''}`} role="alert">
                                                <span>{deepScanResult.requiresAuth ? '🔒' : '⚠'} {deepScanResult.error}</span>
                                                {deepScanResult.requiresAuth && (
                                                    <button
                                                        type="button"
                                                        className="deep-scan-signin-cta"
                                                        onClick={openModal}
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
                )
            }

            {/* Critical Minerals Matrix Modal */}
            {showMineralsModal && (
                <div className="detail-modal" onClick={() => setShowMineralsModal(false)}>
                    <div ref={mineralsModalRef} className="modal-content minerals-matrix-modal" role="dialog" aria-modal="true" aria-labelledby="minerals-dialog-title" tabIndex="-1" onClick={e => e.stopPropagation()}>
                        <button className="close-btn" aria-label="Close critical minerals matrix" onClick={() => setShowMineralsModal(false)}>✕</button>
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
                                    {[
                                        { key: 'gold', symbol: 'Au', name: 'Gold', color: '#ffd700' },
                                        { key: 'silver', symbol: 'Ag', name: 'Silver', color: '#c0c0c0' },
                                        { key: 'lithium', symbol: 'Li', name: 'Lithium', color: '#00ccff' },
                                        { key: 'cobalt', symbol: 'Co', name: 'Cobalt', color: '#9966ff' },
                                        { key: 'copper', symbol: 'Cu', name: 'Copper', color: '#ff9900' },
                                        { key: 'rareEarths', symbol: 'REE', name: 'Rare Earths', color: '#00ff88' }
                                    ].map(m => {
                                        const entry = { ...DEFAULT_MINERALS[m.key], ...(minerals[m.key] || {}) };
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
                                                        {entry.price || DEFAULT_MINERALS[m.key].price}
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
            )}
        </div >
    );
}

export default App;

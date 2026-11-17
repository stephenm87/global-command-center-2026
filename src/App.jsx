import React, { useState, useEffect, useRef, useCallback, useMemo, Component } from 'react';
import Papa from 'papaparse';
import { theories } from './theories';
import { AuthBadge, AuthModal, useAuth } from './AuthModal';
import { secureFetch } from './api';
import { CASE_STUDIES_2026, toForecastRecord } from './caseStudies2026';
import { resolveActorId } from './nexus/actorIds';
import criticalMineralsCatalog from './data/criticalMinerals.json';
import {
    VIEW_MODES,
    categoryColors,
    getAccessibleTextAccent,
    THEORY_COLORS,
    THEORY_LABELS,
    getViewFromLocation,
    getBriefingEntryFromLocation,
    escHtml,
    safeHref,
    dedupeClusterItems,
    getCaseReviewNotice,
} from './navigationState.mjs';
import { useSupabasePreferences } from './hooks/useSupabasePreferences';
import { useGlobeLayerSync } from './hooks/useGlobeLayerSync';
import IntelSidebar from './components/IntelSidebar';
import OperationalDashboard from './components/OperationalDashboard';
import AppFooter from './components/AppFooter';
import DetailModal from './components/DetailModal';
import MineralsModal from './components/MineralsModal';
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

const CURATED_CASE_RECORDS = CASE_STUDIES_2026.map(toForecastRecord);
const DEFAULT_MINERALS = criticalMineralsCatalog.minerals;

const normalizeLegacyForecast = row => {
    const sourceUrl = typeof row.Source === 'string' && /^https:\/\//i.test(row.Source.trim())
        ? row.Source.trim()
        : '';
    return { ...row, url: row.url || sourceUrl };
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

class NexusErrorBoundary extends React.Component {
    constructor(props) { super(props); this.state = { error: null, info: null }; }
    static getDerivedStateFromError(err) { return { error: err }; }
    componentDidCatch(err, info) {
        this.setState({ info });
        console.error('[NEXUS CRASH]', err.message, err.stack);
    }
    render() {
        if (this.state.error) {
            return React.createElement(
                'div',
                {
                    style: { color: '#ff0066', background: '#0a0a1a', padding: '40px', fontFamily: 'Roboto Mono, monospace', fontSize: '13px', position: 'absolute', top: '60px', left: 0, right: 0, bottom: 0, zIndex: 100, overflow: 'auto' },
                },
                React.createElement('h2', { style: { color: '#ff0066', marginBottom: '16px' } }, '⚠ NEXUS COMPONENT CRASHED'),
                React.createElement('div', { style: { color: '#ff9900', marginBottom: '8px' } }, 'Error: ' + this.state.error.message),
                React.createElement('pre', { style: { color: '#888', fontSize: '11px', whiteSpace: 'pre-wrap', maxHeight: '300px', overflow: 'auto', background: 'rgba(255,255,255,0.03)', padding: '12px', borderRadius: '4px' } }, this.state.error.stack),
                this.state.info && React.createElement('pre', { style: { color: '#555', fontSize: '10px', whiteSpace: 'pre-wrap', marginTop: '12px' } }, this.state.info.componentStack),
                React.createElement('button', {
                    onClick: () => this.setState({ error: null, info: null }),
                    style: { marginTop: '20px', padding: '8px 16px', background: '#00ff88', color: '#000', border: 'none', cursor: 'pointer', fontFamily: 'monospace', fontWeight: 'bold' },
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
    const [newsNodes, setNewsNodes] = useState([]);
    const [newsScanLoading, setNewsScanLoading] = useState(false);
    const [newsScanError, setNewsScanError] = useState(null);
    const [newsQuery, setNewsQuery] = useState('');
    const [globeNewsOnly, setGlobeNewsOnly] = useState(false);
    const [showEditorialCases, setShowEditorialCases] = useState(true);
    const [globeReady, setGlobeReady] = useState(false);
    const [mobileGlobeEnabled, setMobileGlobeEnabled] = useState(() => (
        typeof window !== 'undefined' ? !window.matchMedia?.('(max-width: 767px)').matches : true
    ));
    const [feedPage, setFeedPage] = useState(1);
    const FEED_PAGE_SIZE = 40;

    const globeEl = useRef();
    const globeContainer = useRef();
    const attributionRef = useRef();
    const dashboardRef = useRef();
    const detailModalRef = useRef();
    const mineralsModalRef = useRef();
    const clusterDialogRef = useRef();
    const previousFocusRef = useRef();

    const navigateView = useCallback((mode, params = {}) => {
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
    }, [viewMode]);

    const openNexusAtActor = useCallback((nodeId, tourId) => {
        setNexusEntry({ nodeId, tourId });
        navigateView('nexus', { actor: nodeId });
    }, [navigateView]);

    const openBriefing = useCallback((tourId, nodeId) => {
        setBriefingEntry({ tourId, nodeId, step: 1 });
        navigateView('briefings', { tour: tourId, actor: nodeId, step: 1 });
    }, [navigateView]);

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

    useSupabasePreferences({
        user,
        values: {
            selectedTheory,
            selectedCategory,
            timelineYear,
            stressLevel,
            sidebarCollapsed,
            showEditorialCases,
            largeText,
            reducedEffects,
            metricsCollapsed,
        },
        setters: {
            setSelectedTheory,
            setSelectedCategory,
            setTimelineYear,
            setStressLevel,
            setSidebarCollapsed,
            setShowEditorialCases,
            setLargeText,
            setReducedEffects,
            setMetricsCollapsed,
        },
    });

    // Derive filtered forecasts independently of WebGL globe initialization
    const filteredForecasts = useMemo(() => filterIntelForecasts({
        forecasts,
        historicalData,
        selectedCategory,
        timelineYear,
        globeNewsOnly,
    }), [forecasts, historicalData, selectedCategory, timelineYear, globeNewsOnly]);

    useGlobeLayerSync({
        globeEl,
        globeContainer,
        viewMode,
        mobileGlobeEnabled,
        setMobileGlobeEnabled,
        globeReady,
        setGlobeReady,
        filteredForecasts,
        stressLevel,
        theoryLens,
        showEditorialCases,
        setExpandedCluster,
        setSelectedForecast,
        setSelectedTheory,
        setEscalationPairs,
        setArcClickedInfo,
    });

    const closeDetailModal = useCallback(() => {
        setSelectedForecast(null);
        setDeepScanResult(null);
        setAiSummary(null);
    }, []);

    // Clear previous item's Deep Scan / AI Brief state whenever forecast selection changes
    useEffect(() => {
        setDeepScanResult(null);
        setAiSummary(null);
    }, [selectedForecast]);

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
        const handleKeyPress = e => {
            const tag = document.activeElement?.tagName?.toLowerCase();
            const isTyping = tag === 'input' || tag === 'textarea' || tag === 'select' || document.activeElement?.isContentEditable;
            if (e.code === 'Space' && !selectedForecast && !expandedCluster && !isTyping) {
                e.preventDefault();
                setSidebarCollapsed(prev => !prev);
            }
            if (e.code === 'Escape' && (selectedForecast || showMineralsModal || expandedCluster)) {
                closeDetailModal();
                setShowMineralsModal(false);
                setExpandedCluster(null);
            }
            if (e.code === 'KeyL' && !selectedForecast && !expandedCluster && stressLevel > 70) {
                setShowConnections(prev => !prev);
            }
        };

        window.addEventListener('keydown', handleKeyPress);
        return () => window.removeEventListener('keydown', handleKeyPress);
    }, [selectedForecast, showMineralsModal, expandedCluster, stressLevel, closeDetailModal]);

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

    const extractMetrics = data => {
        const metrics = {};
        const categoryCounts = {};
        data.forEach(item => {
            const cat = item.Broad_Category;
            categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
        });

        const goldMentions = data.filter(d => d['Expected Impact/Value']?.includes('$4,') || d['Expected Impact/Value']?.includes('gold'));
        const gdpMentions = data.filter(d => d['Expected Impact/Value']?.includes('2.4%') && d['Expected Impact/Value']?.includes('GDP'));
        const defenseMentions = data.filter(d => d['Expected Impact/Value']?.includes('$2.9trn'));

        metrics.totalEvents = data.length;
        metrics.conflictEvents = categoryCounts['Geopolitics & Conflict'] || 0;
        metrics.governanceEvents = categoryCounts['Governance & Rights'] || 0;
        metrics.economyEvents = categoryCounts['Economy & Trade'] || 0;
        metrics.techEvents = categoryCounts['Technology & Science'] || 0;
        metrics.goldPrice = goldMentions.length > 0 ? '$4,500' : 'N/A';
        metrics.globalGrowth = gdpMentions.length > 0 ? '2.4%' : 'N/A';
        metrics.defenseSpending = defenseMentions.length > 0 ? '$2.9trn' : 'N/A';

        setKeyMetrics(metrics);
    };

    // Load the public reference library independently from protected provider updates
    useEffect(() => {
        let cancelled = false;
        const fetchCSV = fetch('/Global_Forecasts_2026_Enriched.csv')
            .then(response => {
                if (!response.ok) throw new Error(`Forecast library unavailable (${response.status})`);
                return response.text();
            })
            .then(csvText => new Promise(resolve => {
                Papa.parse(csvText, {
                    header: true,
                    complete: results => {
                        const data = results.data.filter(row =>
                            row.Latitude && row.Longitude &&
                            (Number.parseFloat(row.Latitude) !== 0 || Number.parseFloat(row.Longitude) !== 0)
                        );
                        resolve(data);
                    },
                });
            }))
            .catch(() => []);

        const fetchPublicReferences = fetch('/live_intel.json')
            .then(response => {
                if (!response.ok) throw new Error(`Public reference feed unavailable (${response.status})`);
                return response.json();
            })
            .then(data => (Array.isArray(data) ? data : []))
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
            .then(r => (r.ok ? r.json() : []))
            .then(data => {
                setHistoricalData(data.map(item => ({ ...item, isHistorical: true })));
            })
            .catch(() => setHistoricalData([]))
            .finally(() => setHistoricalLoading(false));
    }, [timelineYear]);

    const handleAiSummary = async (content, title, url) => {
        setAiSummary(null);
        setAiSummaryLoading(true);
        try {
            const res = await secureFetch('/.netlify/functions/ai-summary', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, title, content }),
                signal: AbortSignal.timeout(45000),
            });
            const data = await res.json();
            setAiSummary(data);
        } catch {
            setAiSummary({ error: 'AI analysis unavailable' });
        } finally {
            setAiSummaryLoading(false);
        }
    };

    const handleDeepScan = async url => {
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
                signal: AbortSignal.timeout(30000),
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

    const fetchLiveNews = async queryOverride => {
        setNewsScanLoading(true);
        setNewsScanError(null);

        const query = queryOverride || newsQuery || 'geopolitical crisis conflict war sanctions sovereignty 2026';
        let path1Error = null;
        try {
            const fnRes = await secureFetch('/.netlify/functions/fetch-news', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });

            if (fnRes.ok) {
                const data = await fnRes.json();
                if (data.error) throw new Error(data.error);
                const mapped = (data.nodes || []).map(n => ({ ...n, isLive: true, isNews: true }));
                setNewsNodes(mapped);
                setForecasts(prev => [...prev.filter(f => !f.isNews), ...mapped]);
                setNewsScanLoading(false);
                return;
            } else {
                const errText = await fnRes.text().catch(() => '');
                path1Error = `Netlify fn error ${fnRes.status}: ${errText.substring(0, 80)}`;
            }
        } catch (e) { path1Error = e.message; }

        if (path1Error) {
            setNewsScanError(`Scan failed. Server: ${path1Error}`);
        }
        setNewsScanLoading(false);
    };

    const clearNewsNodes = () => {
        setNewsNodes([]);
        setNewsScanError(null);
        setNewsQuery('');
        setGlobeNewsOnly(false);
        setForecasts(prev => prev.filter(f => !f.isNews));
        setSelectedCategory('All');
    };

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
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 400);
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
            <a href="#main-workspace" className="skip-nav">Skip to main content</a>
            {showModal && <AuthModal onClose={closeModal} initialError={authError} />}
            {viewMode === 'globe' && mobileGlobeEnabled && !globeReady && (
                <div className="globe-loading-overlay" role="status" aria-label="Loading globe">
                    <div className="globe-loading-spinner">⬢</div>
                    <div className="globe-loading-text">INITIALIZING COMMAND CENTER...</div>
                </div>
            )}
            <div className={`dashboard-view dashboard-view--${viewMode}`} ref={dashboardRef}>
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
                                    type="button"
                                    className="credits-link"
                                    onClick={() => attributionRef.current?.scrollIntoView({ behavior: 'smooth' })}
                                >
                                    CREDITS &amp; LICENSE
                                </button>
                                <AuthBadge
                                    user={user}
                                    onSignInClick={openModal}
                                    triggerId="gcc-signin-trigger"
                                    className="auth-badge-wrapper--menu"
                                />
                                {viewMode === 'globe' && (
                                    <>
                                        <span className={`live-indicator ${['provider', 'public-cache'].includes(intelSummary.sourceMode) ? '' : 'reference-mode'}`}>
                                            {intelLoading
                                                ? '○ LOADING'
                                                : intelSummary.sourceMode === 'provider'
                                                    ? '● CURRENT'
                                                    : intelSummary.sourceMode === 'public-cache'
                                                        ? intelSummary.feedStatus === 'stale' ? '◐ STALE CACHE' : '● CACHED'
                                                        : '○ REFERENCE'}
                                        </span>
                                        <button
                                            type="button"
                                            className="export-btn"
                                            onClick={() => {
                                                const nodes = filteredForecasts.slice(0, 40);
                                                const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                                                const html = `<!DOCTYPE html><html><head><title>Global Intelligence Briefing</title><style>body{font-family:monospace;background:#000;color:#0ff;padding:30px;max-width:800px;margin:0 auto}h1{color:#0ff;border-bottom:2px solid #0ff;padding-bottom:10px;font-size:1.1rem;letter-spacing:3px}.node{border:1px solid #333;padding:12px;margin:10px 0;border-radius:4px}.cat{color:#ff9900;font-size:0.7rem;letter-spacing:2px;margin-bottom:4px}.sub{color:#fff;font-size:0.85rem;margin-bottom:6px}.detail{color:#888;font-size:0.75rem;line-height:1.5}.src a{color:#00ff88;font-size:0.65rem}footer{color:#444;font-size:0.6rem;margin-top:30px;border-top:1px solid #222;padding-top:10px}@media print{body{background:#fff;color:#000}.cat{color:#c70}.src a{color:green}h1{color:#000;border-color:#000}}</style></head><body><h1>⬢ GLOBAL INTELLIGENCE BRIEFING — ${escHtml(date)}</h1>${nodes.map((n, i) => `<div class="node"><div class="cat">${String(i + 1).padStart(2, '0')} · ${escHtml(n.Broad_Category || n['Topic/Sector'] || 'GLOBAL')}</div><div class="sub">${escHtml(n['Entity/Subject'] || '')}</div><div class="detail"><strong>Players:</strong> ${escHtml(n['Key Player/Organization'] || '—')}<br/><strong>Impact:</strong> ${escHtml(n['Expected Impact/Value'] || '—')}<br/><strong>Timeline:</strong> ${escHtml(n.Timeline || '—')}</div>${safeHref(n.url) ? `<div class="src"><a href="${safeHref(n.url)}" target="_blank" rel="noopener noreferrer">SOURCE ↗</a></div>` : ''}</div>`).join('')}<footer>Generated by Global Command Center · ${escHtml(date)} · globalcommandcenter2026.netlify.app</footer></body></html>`;
                                                const w = window.open('', '_blank');
                                                if (!w) return;
                                                w.opener = null;
                                                w.document.write(html);
                                                w.document.close();
                                                setTimeout(() => w.print(), 400);
                                            }}
                                            title="Export Intelligence Briefing"
                                        >
                                            📄 EXPORT BRIEFING
                                        </button>

                                        <div className="news-tools">
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
                                                    type="button"
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

                                            {newsNodes.length > 0 && !newsScanLoading && (() => {
                                                const conflictCount = newsNodes.filter(n => n.Broad_Category === 'Geopolitics & Conflict').length;
                                                const econCount = newsNodes.filter(n => n.Broad_Category === 'Economy & Trade').length;
                                                const otherCount = newsNodes.length - conflictCount - econCount;
                                                return (
                                                    <div className="news-action-panel">
                                                        <div className="news-action-title" role="status">
                                                            ✅ SCAN COMPLETE — +{newsNodes.length} NODES PLOTTED
                                                        </div>
                                                        <div className="news-action-stats">
                                                            <span style={{ color: '#ff5c99' }}>⚔️ {conflictCount} Conflict</span>
                                                            <span style={{ color: '#00ccff' }}>💰 {econCount} Economy</span>
                                                            <span style={{ color: '#aaa' }}>🌍 {otherCount} Other</span>
                                                        </div>
                                                        <div className="news-action-buttons">
                                                            <button
                                                                type="button"
                                                                className="news-action-btn news-action-btn--feed"
                                                                onClick={() => setSelectedCategory('Live Intel')}
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
                                    </>
                                )}
                            </div>
                        </details>
                    </div>
                </header>

                <div id="main-workspace" className={`main-content main-content--${viewMode}${sidebarCollapsed ? ' main-content--feed-collapsed' : ''}`} role="main" tabIndex="-1">
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
                                    <div className="globe-title">GLOBAL ISSUES &amp; CASE MAP</div>
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
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1px 8px', marginBottom: '8px' }}>
                                                {[
                                                    ['Conflict', '#ff5c99'],
                                                    ['Gov/Rights', '#fbbf24'],
                                                    ['Economy', '#00ccff'],
                                                    ['Tech', '#00ff88'],
                                                    ['Health', '#ff9900'],
                                                    ['Environ', '#66ff00'],
                                                    ['Culture', '#f472ff'],
                                                    ['Live', '#00ffff'],
                                                ].map(([label, color]) => (
                                                    <div key={label} className="arc-legend-item" style={{ marginBottom: '1px' }}>
                                                        <span className="arc-legend-dot" style={{ background: color, boxShadow: `0 0 4px ${color}`, width: '6px', height: '6px' }} />
                                                        <span className="arc-legend-label" style={{ color }}>{label}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            {showEditorialCases && (
                                                <div className="arc-legend-case-key">
                                                    <div className="arc-legend-title" style={{ marginBottom: '4px' }}>EDITORIAL CASES</div>
                                                    <p><span className="case-key-ring" aria-hidden="true" /> Pulsing ring = case location, colored by issue lens. Slow, faint pulse = review overdue.</p>
                                                    <p><span className="case-key-arc" aria-hidden="true" /> Arcs join only the places a case itself maps.</p>
                                                </div>
                                            )}

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
                                                                background: isActive ? `${color}30` : 'transparent',
                                                                border: `1px solid ${isActive ? color : `${color}33`}`,
                                                                borderRadius: '10px',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px',
                                                            }}
                                                        >
                                                            <span
                                                                style={{
                                                                    width: '5px',
                                                                    height: '5px',
                                                                    borderRadius: '50%',
                                                                    background: isActive ? color : `${color}66`,
                                                                    boxShadow: isActive ? `0 0 6px ${color}` : 'none',
                                                                    flexShrink: 0,
                                                                }}
                                                            />
                                                            <span
                                                                style={{
                                                                    color: isActive ? '#ffffff' : '#d8e4ee',
                                                                    fontWeight: isActive ? 700 : 400,
                                                                }}
                                                                className="theory-btn-label"
                                                            >
                                                                {label.length > 12 ? `${label.slice(0, 10).toUpperCase()}…` : label.toUpperCase()}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {theoryLens && (
                                                <div className="theory-filter-status" style={{ background: `${THEORY_COLORS[theoryLens]}12`, borderColor: `${THEORY_COLORS[theoryLens]}33`, color: '#e2edf7' }}>
                                                    <div>Filtering: {THEORY_LABELS[theoryLens]} keywords</div>
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

                    {expandedCluster && (
                        <>
                            <div
                                onClick={() => setExpandedCluster(null)}
                                aria-hidden="true"
                                style={{ position: 'absolute', inset: 0, zIndex: 99, cursor: 'default' }}
                            />
                            <div
                                ref={clusterDialogRef}
                                role="dialog"
                                aria-modal="true"
                                aria-labelledby="cluster-dialog-title"
                                tabIndex="-1"
                                onClick={e => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    transform: 'translate(-50%, -50%)',
                                    background: 'rgba(0,0,0,0.95)',
                                    border: '1px solid #ffcc00',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    zIndex: 100,
                                    width: '320px',
                                    maxHeight: '60vh',
                                    overflowY: 'auto',
                                    fontFamily: 'Roboto Mono, monospace',
                                    boxShadow: '0 0 30px #ffcc0044',
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                    <span id="cluster-dialog-title" style={{ color: '#ffcc00', fontWeight: 900, fontSize: '0.8rem' }}>
                                        📍 {dedupeClusterItems(expandedCluster.items).length} MAP ITEMS IN REGION
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setExpandedCluster(null)}
                                        aria-label="Close map items"
                                        style={{ background: 'none', border: '1px solid #ffcc0055', borderRadius: '4px', color: '#ffcc00', cursor: 'pointer', minWidth: '44px', minHeight: '44px', fontSize: '0.75rem' }}
                                    >
                                        ✕
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                    {(() => {
                                        const uniqueItems = dedupeClusterItems(expandedCluster.items);
                                        const groups = {};
                                        uniqueItems.forEach(item => {
                                            const cat = item.isLive ? 'Live Intel' : (item.Broad_Category || (item.isCaseStudy ? 'Editorial Cases' : 'Other'));
                                            if (!groups[cat]) groups[cat] = [];
                                            groups[cat].push(item);
                                        });
                                        return Object.entries(groups).map(([cat, items]) => {
                                            const catColor = items[0].isLive ? '#00ffff' : (categoryColors[cat] || (items[0].isCaseStudy ? '#b69cff' : '#aaaaaa'));
                                            return (
                                                <div key={cat}>
                                                    <div style={{ color: catColor, fontSize: '0.6rem', fontWeight: 900, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px', paddingBottom: '4px', borderBottom: `1px solid ${catColor}33` }}>
                                                        {cat} ({items.length})
                                                    </div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                        {items.map((item, i) => {
                                                            const clusterNotice = item.isCaseStudy ? getCaseReviewNotice(item) : null;
                                                            const caseAccent = getAccessibleTextAccent(categoryColors[item.Broad_Category] || '#b69cff');
                                                            return (
                                                                <button
                                                                    key={i}
                                                                    type="button"
                                                                    onClick={() => { setSelectedForecast(item); setExpandedCluster(null); }}
                                                                    style={{ textAlign: 'left', background: `${catColor}0d`, border: `1px solid ${catColor}33`, borderRadius: '6px', padding: '8px 10px', minHeight: '44px', cursor: 'pointer', transition: 'all 0.15s' }}
                                                                >
                                                                    <span style={{ display: 'block', color: '#ddd', fontSize: '0.68rem', lineHeight: 1.3 }}>
                                                                        {item.isLive ? <span style={{ color: '#00ffff', fontWeight: 700, marginRight: '4px' }}>[LIVE]</span> : null}
                                                                        {item.isCaseStudy ? <span style={{ color: caseAccent, fontWeight: 700, marginRight: '4px' }}>[CASE]</span> : null}
                                                                        {item['Entity/Subject']?.substring(0, 70)}
                                                                    </span>
                                                                    {clusterNotice && (
                                                                        <span style={{ display: 'block', color: '#fde68a', fontSize: '0.62rem', marginTop: '3px', lineHeight: 1.3 }}>
                                                                            {clusterNotice}
                                                                        </span>
                                                                    )}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>
                        </>
                    )}

                    <IntelSidebar
                        visible={viewMode === 'globe'}
                        sidebarCollapsed={sidebarCollapsed}
                        onToggleCollapse={() => setSidebarCollapsed(prev => !prev)}
                        historicalData={historicalData}
                        historicalLoading={historicalLoading}
                        timelineYear={timelineYear}
                        intelLoading={intelLoading}
                        intelLastUpdated={intelLastUpdated}
                        intelSummary={intelSummary}
                        caseStudyCount={CASE_STUDIES_2026.length}
                        feedSearch={feedSearch}
                        onSearchChange={setFeedSearch}
                        visibleSelectedCategory={visibleSelectedCategory}
                        onCategoryChange={setSelectedCategory}
                        currentFeedLabel={currentFeedLabel}
                        feedEmptyState={feedEmptyState}
                        feedItems={feedItems}
                        feedPage={feedPage}
                        feedPageSize={FEED_PAGE_SIZE}
                        onShowMore={() => setFeedPage(p => p + 1)}
                        selectedForecast={selectedForecast}
                        onSelectForecast={setSelectedForecast}
                        onOpenBriefing={openBriefing}
                    />
                </div>

                <OperationalDashboard
                    visible={viewMode === 'globe'}
                    metricsCollapsed={metricsCollapsed}
                    onToggleCollapse={() => setMetricsCollapsed(value => !value)}
                    keyMetrics={keyMetrics}
                    minerals={minerals}
                    onOpenMinerals={() => setShowMineralsModal(true)}
                    tensionMeter={tensionMeter}
                    stressLevel={stressLevel}
                    onStressLevelChange={setStressLevel}
                    escalationPairs={escalationPairs}
                    showConnections={showConnections}
                    onToggleConnections={() => setShowConnections(p => !p)}
                    timelineYear={timelineYear}
                    onTimelineYearChange={setTimelineYear}
                />
            </div>

            {stressLevel > 70 && escalationPairs.length > 0 && (
                <div className={`critical-connections-panel ${showConnections ? 'panel-open' : 'panel-collapsed'}`}>
                    <div className="critical-connections-header" onClick={() => setShowConnections(p => !p)}>
                        <span className="critical-blink">⚡</span>
                        <span className="conn-header-title">CONFLICT CASE LINKS</span>
                        <span className="conn-count-badge">{escalationPairs.length}</span>
                        <span className="conn-toggle-icon">{showConnections ? '▼' : '▲'}</span>
                        {showConnections && (
                            <button
                                type="button"
                                className="conn-close-btn"
                                onClick={e => { e.stopPropagation(); setShowConnections(false); }}
                                title="Close (L)"
                            >
                                ✕
                            </button>
                        )}
                    </div>
                    {showConnections && (
                        <div className="critical-connections-list">
                            <div className="conn-keyboard-hint">Press <kbd>L</kbd> to toggle</div>
                            {escalationPairs.map((pair, i) => (
                                <div key={i} className="connection-row">
                                    <span className="conn-index">{String(i + 1).padStart(2, '0')}</span>
                                    <span className="conn-from">{pair.fromOrg || pair.from.substring(0, 30)}</span>
                                    <span className="conn-arrow">→</span>
                                    <span className="conn-to">{pair.toOrg || pair.to.substring(0, 30)}</span>
                                    {pair.caseTitle && <span className="conn-case" style={{ color: pair.relHex }}>{pair.caseTitle}</span>}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {arcClickedInfo && (
                <div className="arc-detail-overlay" onClick={() => setArcClickedInfo(null)}>
                    <div className="arc-detail-card" onClick={e => e.stopPropagation()}>
                        <button type="button" className="arc-detail-close" onClick={() => setArcClickedInfo(null)}>✕</button>
                        <div className="arc-detail-type" style={{ color: arcClickedInfo.relHex, borderBottomColor: `${arcClickedInfo.relHex}55` }}>
                            ◆ {arcClickedInfo.relType} CASE · MAPPED LINK
                        </div>
                        {arcClickedInfo.caseTitle && <h3 className="arc-detail-case-title">{arcClickedInfo.caseTitle}</h3>}
                        <div className="arc-detail-entities">
                            <div className="arc-entity-box" style={{ borderColor: `${arcClickedInfo.relHex}88` }}>
                                <span className="arc-entity-label">PRIMARY LOCATION</span>
                                <strong className="arc-entity-name">{arcClickedInfo.fromName}</strong>
                                <p className="arc-entity-impact">{arcClickedInfo.fromImpact || '—'}</p>
                            </div>
                            <div className="arc-entity-connector" style={{ color: arcClickedInfo.relHex }}>→</div>
                            <div className="arc-entity-box" style={{ borderColor: `${arcClickedInfo.relHex}88` }}>
                                <span className="arc-entity-label">LINKED LOCATION</span>
                                <strong className="arc-entity-name">{arcClickedInfo.toName}</strong>
                                <p className="arc-entity-impact">{arcClickedInfo.toImpact || '—'}</p>
                            </div>
                        </div>
                        {arcClickedInfo.fromFull && (
                            <button
                                type="button"
                                className="arc-detail-open-case"
                                style={{ borderColor: arcClickedInfo.relHex, color: arcClickedInfo.relHex }}
                                onClick={() => { setSelectedForecast(arcClickedInfo.fromFull); setArcClickedInfo(null); }}
                            >
                                Open case detail
                            </button>
                        )}
                        <div className="arc-detail-hint">Arcs connect only the locations this case maps. They do not assert a relationship beyond the case.</div>
                    </div>
                </div>
            )}

            <AppFooter
                attributionRef={attributionRef}
                onScrollToTop={() => dashboardRef.current?.scrollIntoView({ behavior: 'smooth' })}
            />

            <DetailModal
                selectedForecast={selectedForecast}
                modalRef={detailModalRef}
                selectedTheory={selectedTheory}
                onSelectTheory={setSelectedTheory}
                onClose={closeDetailModal}
                onOpenBriefing={openBriefing}
                onOpenAuthModal={openModal}
                onDeepScan={handleDeepScan}
                deepScanResult={deepScanResult}
                deepScanLoading={deepScanLoading}
                aiSummary={aiSummary}
                aiSummaryLoading={aiSummaryLoading}
            />

            <MineralsModal
                open={showMineralsModal}
                minerals={minerals}
                modalRef={mineralsModalRef}
                onClose={() => setShowMineralsModal(false)}
            />
        </div>
    );
}

export default App;

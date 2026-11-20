import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { REPO_ROOT } from './_helpers/readAppSources.mjs';

async function createSsrViteServer(t) {
    const vite = await createServer({
        configFile: false,
        root: REPO_ROOT,
        cacheDir: `/tmp/vite-gcc-decomposed-test-${process.pid}`,
        appType: 'custom',
        logLevel: 'silent',
        esbuild: { jsx: 'automatic' },
        optimizeDeps: { noDiscovery: true },
        plugins: [
            {
                name: 'ignore-css-in-node-ssr',
                load(id) {
                    if (id.endsWith('.css')) return 'export default {};';
                    return null;
                },
            },
        ],
        server: { middlewareMode: true },
    });
    t.after(() => vite.close());
    return vite;
}

function findElementByClass(node, classToken) {
    if (!node || typeof node !== 'object') return null;
    if (Array.isArray(node)) {
        for (const child of node) {
            const hit = findElementByClass(child, classToken);
            if (hit) return hit;
        }
        return null;
    }
    const cls = typeof node.props?.className === 'string' ? node.props.className.split(/\s+/) : [];
    if (cls.includes(classToken)) return node;
    return findElementByClass(node.props?.children, classToken);
}

test('navigationState.mjs distinguishes raw safeHttpUrl (for JSX & API calls) from HTML-escaped safeHref (for document.write)', async () => {
    const nav = await import('../navigationState.mjs');

    assert.equal(nav.parseViewFromSearch('?view=briefings'), 'briefings');
    assert.equal(nav.parseViewFromSearch('?view=nexus'), 'nexus');
    assert.equal(nav.parseViewFromSearch('?view=invalid'), 'globe');

    const entry = nav.parseBriefingEntryFromSearch('?view=briefings&tour=sudan-rsf-saf&actor=africa&step=3');
    assert.deepEqual(entry, {
        tourId: 'sudan-rsf-saf',
        nodeId: 'Africa',
        step: 3,
    });
    assert.equal(nav.parseBriefingEntryFromSearch('?step=0').step, undefined, 'step=0 is not a valid 1-based briefing step');

    assert.equal(nav.safeHttpUrl('javascript:alert(1)'), '');
    assert.equal(nav.safeHttpUrl('data:text/html,<script>alert(1)</script>'), '');
    assert.equal(nav.safeHttpUrl('  https://www.un.org/en?a=1&b=2  '), 'https://www.un.org/en?a=1&b=2', 'safeHttpUrl must return raw unescaped URL for React JSX and fetch');
    assert.equal(nav.safeHref('https://www.un.org/en?a=1&b=2'), 'https://www.un.org/en?a=1&amp;b=2', 'safeHref escapes HTML entities for document.write templates');

    assert.equal(nav.getAccessibleTextAccent('#ff0066'), '#ff5c99');
    assert.equal(nav.getAccessibleTextAccent('#cc0000'), '#ff6b6b');
    assert.match(nav.getLocalIsoDate(new Date(2026, 10, 17, 1, 30, 0)), /^2026-11-17$/);
    assert.equal(
        nav.getCaseReviewNotice(
            { updatedAt: '2026-08-09', reviewBy: '2026-09-08', status: 'active', reviewStatus: 'update-in-progress' },
            '2026-11-17',
        ),
        'Last reviewed 2026-08-09, update in progress',
    );
    assert.equal(
        nav.getCaseReviewNotice(
            { updatedAt: '2026-08-09', reviewBy: '2026-09-08', status: 'active' },
            '2026-11-17',
        ),
        'Last reviewed 2026-08-09 · review overdue since 2026-09-08',
        'Overdue case without explicit reviewStatus must not falsely claim update in progress',
    );
    assert.equal(
        nav.getCaseReviewNotice({ updatedAt: '2026-11-17', reviewBy: '2026-12-17', status: 'active' }, '2026-11-17'),
        null,
    );
    assert.equal(
        nav.getCaseReviewNotice(
            { updatedAt: '2026-08-09', reviewBy: '2026-09-08', status: 'archived', reviewStatus: 'update-in-progress' },
            '2026-11-17',
        ),
        null,
    );

    const overdueGlobeTooltip = nav.formatGlobePointTooltip(
        {
            isCluster: false,
            color: '#b69cff',
            locationLabel: 'Damascus',
            data: {
                isCaseStudy: true,
                'Entity/Subject': 'Synthetic Briefing',
                updatedAt: '2026-06-30<script>',
                reviewBy: '2026-09-28',
                reviewStatus: 'update-in-progress',
                sources: [{}, {}, {}],
                url: 'https://example.org/case',
            },
        },
        '2026-11-17',
    );
    assert.match(overdueGlobeTooltip, /⚠ Last reviewed 2026-06-30&lt;script&gt;, update in progress/);
    assert.ok(!overdueGlobeTooltip.includes('<script>'), 'formatGlobePointTooltip must escape updatedAt HTML');

    const freshGlobeTooltip = nav.formatGlobePointTooltip(
        {
            isCluster: false,
            color: '#b69cff',
            locationLabel: 'Geneva',
            data: {
                isCaseStudy: true,
                'Entity/Subject': 'Fresh Briefing',
                updatedAt: '2026-11-17',
                reviewBy: '2026-12-17',
                sources: [{}, {}, {}],
                url: 'https://example.org/fresh',
            },
        },
        '2026-11-17',
    );
    assert.match(freshGlobeTooltip, /Last reviewed 2026-11-17/);
    assert.ok(!freshGlobeTooltip.includes('update in progress'));

    const deduped = nav.dedupeClusterItems([
        { isCaseStudy: true, caseStudyId: 'case-a', 'Entity/Subject': 'A1' },
        { isCaseStudy: true, caseStudyId: 'case-a', 'Entity/Subject': 'A2' },
        { isCaseStudy: false, 'Entity/Subject': 'Live Event' },
    ]);
    assert.equal(deduped.length, 2, 'dedupeClusterItems collapses duplicate waypoints of the same case study');

    const clustered = nav.clusterPoints([
        { lat: 15.5, lng: 32.5, size: 1.0, color: '#b69cff', data: { isCaseStudy: true, caseStudyId: 'case-a' } },
        { lat: 16.0, lng: 33.0, size: 1.0, color: '#b69cff', data: { isCaseStudy: true, caseStudyId: 'case-a' } },
        { lat: -34.0, lng: -58.0, size: 0.8, color: '#00ccff', data: { isCaseStudy: false } },
    ]);
    assert.equal(clustered.length, 2);
    const khartoumCluster = clustered.find(p => p.isCluster);
    assert.ok(khartoumCluster);
    assert.equal(khartoumCluster.count, 2);
    assert.equal(khartoumCluster.caseCount, 1, 'Cluster caseCount counts unique caseStudyId records');
});

test('extracted App components preserve unescaped & query URLs, guard invalid theories, and render accessible dialogs & AI briefs', async t => {
    const vite = await createSsrViteServer(t);
    const { default: IntelSidebar } = await vite.ssrLoadModule('/src/components/IntelSidebar.jsx');
    const { default: DetailModal } = await vite.ssrLoadModule('/src/components/DetailModal.jsx');
    const { default: MineralsModal } = await vite.ssrLoadModule('/src/components/MineralsModal.jsx');
    const { default: OperationalDashboard } = await vite.ssrLoadModule('/src/components/OperationalDashboard.jsx');
    const { default: AppFooter } = await vite.ssrLoadModule('/src/components/AppFooter.jsx');

    const queryUrl = 'https://www.un.org/ldcportal/en/content/bangladesh-graduation-status?section=1&lang=en';
    const sampleCaseForecast = {
        isCaseStudy: true,
        isEditorial: true,
        caseStudyId: 'bangladesh-ldc-graduation',
        'Entity/Subject': 'Bangladesh LDC Graduation Deferral',
        'Topic/Sector': 'Trade Preferences & UNGA Deferral',
        'Key Player/Organization': 'Bangladesh / UNGA / WTO',
        'Expected Impact/Value': 'UNGA postponed graduation to 24 November 2029.',
        Broad_Category: 'Economy & Trade',
        Timeline: '2026–2029',
        updatedAt: '2026-11-16',
        reviewBy: '2026-12-16',
        confidence: 'High',
        regionTags: ['South Asia'],
        statusSummary: 'UNGA resolution A/81/L.8 deferred graduation to 24 November 2029.',
        whyItMatters: 'Tests trade preference cliff management.',
        uncertainty: 'EU GSP+ transition benchmarks remain contested.',
        issueDimensions: ['Trade', 'Development'],
        url: queryUrl,
        sources: [
            {
                title: 'Bangladesh graduation status',
                publisher: 'UN LDC Portal',
                url: queryUrl,
                perspectiveType: 'multilateral',
                dateLabel: 'Reviewed Nov 2026',
                supports: 'UNGA A/81/L.8 deferral to Nov 2029',
            },
            {
                title: 'Unsafe Source Scheme',
                publisher: 'Bad Actor',
                url: 'javascript:alert(1)',
                perspectiveType: 'local',
                dateLabel: '2026',
                supports: 'Should render as inert span',
            },
        ],
    };

    const sidebarHtml = renderToStaticMarkup(React.createElement(IntelSidebar, {
        visible: true,
        sidebarCollapsed: false,
        onToggleCollapse: () => {},
        historicalData: null,
        historicalLoading: false,
        timelineYear: '2026',
        intelLoading: false,
        intelLastUpdated: new Date('2026-11-16T12:00:00Z'),
        intelSummary: {
            sourceMode: 'reference',
            feedStatus: 'not-configured',
            liveItemCount: 0,
            linkedReferenceCount: 162,
        },
        caseStudyCount: 29,
        feedSearch: '',
        onSearchChange: () => {},
        visibleSelectedCategory: 'All',
        onCategoryChange: () => {},
        currentFeedLabel: 'CURRENT FEED (0)',
        feedEmptyState: null,
        feedItems: [sampleCaseForecast, { ...sampleCaseForecast, url: 'javascript:alert(1)', caseStudyId: undefined }],
        feedPage: 1,
        feedPageSize: 40,
        onShowMore: () => {},
        selectedForecast: null,
        onSelectForecast: () => {},
        onOpenBriefing: () => {},
    }));
    assert.match(sidebarHtml, /CURRENT FEED NOT CONFIGURED/);

    const providerErrorSidebarHtml = renderToStaticMarkup(React.createElement(IntelSidebar, {
        visible: true,
        sidebarCollapsed: false,
        onToggleCollapse: () => {},
        historicalData: null,
        historicalLoading: false,
        timelineYear: '2026',
        intelLoading: false,
        intelLastUpdated: new Date('2026-11-16T12:00:00Z'),
        intelSummary: {
            sourceMode: 'public-reference',
            feedStatus: 'unavailable',
            liveItemCount: 0,
            linkedReferenceCount: 162,
        },
        caseStudyCount: 29,
        feedSearch: '',
        onSearchChange: () => {},
        visibleSelectedCategory: 'All',
        onCategoryChange: () => {},
        currentFeedLabel: 'CURRENT UPDATES — PROVIDER ERROR',
        feedEmptyState: null,
        feedItems: [sampleCaseForecast],
        feedPage: 1,
        feedPageSize: 40,
        onShowMore: () => {},
        selectedForecast: null,
        onSelectForecast: () => {},
        onOpenBriefing: () => {},
    }));
    assert.match(providerErrorSidebarHtml, /CURRENT FEED PROVIDER ERROR/, 'IntelSidebar must report PROVIDER ERROR when feedStatus is unavailable');
    assert.match(sidebarHtml, /<article class="intel-card/);
    assert.match(sidebarHtml, /BRIEFING →/);
    assert.ok(!sidebarHtml.includes('javascript:alert(1)'), 'IntelSidebar must reject javascript: URLs');
    assert.ok(!sidebarHtml.includes('&amp;amp;'), 'IntelSidebar must not double-escape & query parameters in href');
    assert.ok(sidebarHtml.includes('href="https://www.un.org/ldcportal/en/content/bangladesh-graduation-status?section=1&amp;lang=en"'));

    // Multi-publisher cached feed renders real headlines, funding labels, BBC credit link, global-unmapped badge, and non-UN sidebar status
    const bbcLiveItem = {
        isLive: true,
        _scraperSource: 'public-rss',
        'Topic/Sector': 'Geopolitics / Conflict',
        'Entity/Subject': 'Romania energy security talks advance in parliament',
        'Expected Impact/Value': 'Lawmakers debated regional grid resilience and Black Sea pipeline capacity.',
        Broad_Category: 'Geopolitics & Conflict',
        Timeline: 'CURRENT — 2026-11-19',
        publishedAt: '2026-11-19',
        Source: 'BBC News',
        url: 'https://www.bbc.com/news/articles/romania-2026',
        Latitude: '45.9',
        Longitude: '25',
        coverage: {
            region: 'Europe & Eurasia',
            issue: 'Security & Diplomacy',
            sourceRole: 'independent-news',
            sourceRoleLabel: 'International broadcast & wire',
            fundingLabel: 'Public broadcaster, UK licence fee',
            attributionUrl: 'https://www.bbc.com/news',
            locationPrecision: 'named-place',
            selectionReason: 'Selected for Europe coverage.',
        },
    };
    const globalUnmappedItem = {
        isLive: true,
        _scraperSource: 'institutional-rss',
        'Topic/Sector': 'Environment / Energy',
        'Entity/Subject': 'COP31 climate talks focus on global mitigation pledge',
        'Expected Impact/Value': 'Negotiators debated multilateral adaptation finance mechanisms.',
        Broad_Category: 'Environment & Energy',
        Timeline: 'CURRENT — 2026-11-18',
        publishedAt: '2026-11-18',
        Source: 'UN News',
        url: 'https://news.un.org/en/story/2026/11/1200555',
        Latitude: null,
        Longitude: null,
        coverage: {
            region: 'Global / Transnational',
            issue: 'Climate & Resources',
            sourceRole: 'institutional',
            sourceRoleLabel: 'Institutional / primary',
            fundingLabel: 'UN institutional reporting',
            attributionUrl: 'https://news.un.org/en/',
            locationPrecision: 'global-unmapped',
            selectionReason: 'Selected for global climate coverage.',
        },
    };
    const devpolicyAnalysisItem = {
        isLive: true,
        _scraperSource: 'public-rss',
        'Topic/Sector': 'Environment / Energy',
        'Entity/Subject': 'Gardens in distress: drought, pollution and deep-sea mining in New Ireland',
        'Expected Impact/Value': 'Communities warn deep-sea mining threatens local marine livelihoods.',
        Broad_Category: 'Environment & Energy',
        Timeline: 'CURRENT — 2026-11-19',
        publishedAt: '2026-11-19',
        Source: 'Devpolicy Blog',
        author: 'Philippa Louey and Godfrey Jordan Abage',
        url: 'https://devpolicy.org/gardens-in-distress-20261119/',
        Latitude: '-3.0',
        Longitude: '151.6',
        coverage: {
            region: 'Pacific Islands',
            issue: 'Climate & Resources',
            sourceRole: 'research',
            sourceRoleLabel: 'Research & analysis',
            contentType: 'analysis',
            author: 'Philippa Louey and Godfrey Jordan Abage',
            fundingLabel: 'University research blog (ANU Crawford School, CC BY-NC-SA 4.0)',
            attributionUrl: 'https://devpolicy.org/',
            locationPrecision: 'named-place',
            selectionReason: 'Selected for Pacific Islands coverage.',
        },
    };
    const mixedFeedSidebarHtml = renderToStaticMarkup(React.createElement(IntelSidebar, {
        visible: true,
        sidebarCollapsed: false,
        onToggleCollapse: () => {},
        historicalData: null,
        historicalLoading: false,
        timelineYear: '2026',
        intelLoading: false,
        intelLastUpdated: new Date('2026-11-20T00:15:00Z'),
        intelSummary: {
            sourceMode: 'public-cache',
            feedStatus: 'fresh',
            provider: 'UN News RSS + BBC News RSS + Devpolicy Blog RSS',
            liveItemCount: 3,
            linkedReferenceCount: 162,
        },
        caseStudyCount: 29,
        feedSearch: '',
        onSearchChange: () => {},
        visibleSelectedCategory: 'All',
        onCategoryChange: () => {},
        currentFeedLabel: 'CACHED CURRENT UPDATES (3)',
        feedEmptyState: null,
        feedItems: [bbcLiveItem, globalUnmappedItem, devpolicyAnalysisItem],
        feedPage: 1,
        feedPageSize: 40,
        onShowMore: () => {},
        selectedForecast: null,
        onSelectForecast: () => {},
        onOpenBriefing: () => {},
    }));
    assert.ok(!mixedFeedSidebarHtml.includes('UN INSTITUTIONAL'), 'Sidebar must not say UN INSTITUTIONAL once BBC News is included');
    assert.match(mixedFeedSidebarHtml, /3 CACHED CURRENT/);
    assert.match(mixedFeedSidebarHtml, /Romania energy security talks advance in parliament/);
    assert.match(mixedFeedSidebarHtml, /Public broadcaster, UK licence fee/);
    assert.match(mixedFeedSidebarHtml, /BBC News ↗/);
    assert.ok(mixedFeedSidebarHtml.includes('href="https://www.bbc.com/news"'));
    assert.match(mixedFeedSidebarHtml, /Global · No single pin/);
    assert.match(mixedFeedSidebarHtml, /live-tag--analysis[^>]*>● ANALYSIS</);
    assert.match(mixedFeedSidebarHtml, /coverage-badge-analysis[^>]*>Analysis · Not news</);
    assert.match(mixedFeedSidebarHtml, /By Philippa Louey and Godfrey Jordan Abage · Devpolicy Blog · 2026-11-19/);
    assert.ok(mixedFeedSidebarHtml.includes('href="https://devpolicy.org/gardens-in-distress-20261119/"'));

    const analysisModalHtml = renderToStaticMarkup(React.createElement(DetailModal, {
        selectedForecast: devpolicyAnalysisItem,
        modalRef: { current: null },
        selectedTheory: 'Realism',
        onSelectTheory: () => {},
        onClose: () => {},
        onOpenBriefing: () => {},
        onOpenAuthModal: () => {},
        onDeepScan: () => {},
        deepScanResult: null,
        deepScanLoading: false,
        aiSummary: null,
        aiSummaryLoading: false,
    }));
    assert.match(analysisModalHtml, /By Philippa Louey and Godfrey Jordan Abage · Devpolicy Blog · 2026-11-19/);
    assert.match(analysisModalHtml, /Analysis \(not news\)/);
    assert.ok(analysisModalHtml.includes('href="https://devpolicy.org/"'));
    assert.ok(analysisModalHtml.includes('href="https://devpolicy.org/gardens-in-distress-20261119/"'));

    const unmappedModalHtml = renderToStaticMarkup(React.createElement(DetailModal, {
        selectedForecast: globalUnmappedItem,
        modalRef: { current: null },
        selectedTheory: 'Realism',
        onSelectTheory: () => {},
        onClose: () => {},
        onOpenBriefing: () => {},
        onOpenAuthModal: () => {},
        onDeepScan: () => {},
        deepScanResult: null,
        deepScanLoading: false,
        aiSummary: null,
        aiSummaryLoading: false,
    }));
    assert.match(unmappedModalHtml, /COP31 climate talks focus on global mitigation pledge/);
    assert.match(unmappedModalHtml, /UN institutional reporting/);
    assert.match(unmappedModalHtml, /Global · No single pin/);
    assert.match(unmappedModalHtml, /Global \/ Transnational \(no single map pin\)/);

    // Verify onDeepScan receives the exact unescaped URL (not &amp;)
    let receivedDeepScanUrl = null;
    const detailTree = DetailModal({
        selectedForecast: sampleCaseForecast,
        modalRef: { current: null },
        selectedTheory: 'Marxism',
        onSelectTheory: () => {},
        onClose: () => {},
        onOpenBriefing: () => {},
        onOpenAuthModal: () => {},
        onDeepScan: u => { receivedDeepScanUrl = u; },
        deepScanResult: { error: 'Sign in required to run Firecrawl + AI Brief.', requiresAuth: true },
        deepScanLoading: false,
        aiSummary: {
            model: 'gemini-3.5-flash-lite',
            oneLiner: 'UNGA extended Bangladesh transition window to 2029.',
            riskLevel: 'HIGH',
            riskReason: 'Export preference cliff.',
            paper2Prompts: { identify: 'Identify key stakeholders.' },
        },
        aiSummaryLoading: false,
    });
    const deepScanBtn = findElementByClass(detailTree, 'deep-scan-btn');
    assert.ok(deepScanBtn, 'Expected .deep-scan-btn in DetailModal tree');
    deepScanBtn.props.onClick();
    assert.equal(receivedDeepScanUrl, queryUrl, 'onDeepScan must receive raw unescaped URL with & intact');

    const detailHtml = renderToStaticMarkup(detailTree);
    assert.match(detailHtml, /role="dialog"/);
    assert.match(detailHtml, /aria-labelledby="forecast-dialog-title"/);
    assert.match(detailHtml, /Three-perspective reading set/);
    assert.match(detailHtml, /SIGN IN TO UNLOCK →/);
    assert.match(detailHtml, /IB PAPER 2 PRACTICE PROMPTS/);
    assert.match(detailHtml, /color:#ff6b6b/i, 'Marxism theory name in DetailModal must use accessible #ff6b6b accent');
    assert.ok(!detailHtml.includes('javascript:alert(1)'), 'DetailModal case-study sources must strip non-http(s) URLs');
    assert.ok(!detailHtml.includes('&amp;amp;'), 'DetailModal must not double-escape & query parameters');

    // Verify unknown stored selectedTheory falls back safely to Realism without throwing
    const fallbackTheoryHtml = renderToStaticMarkup(React.createElement(DetailModal, {
        selectedForecast: sampleCaseForecast,
        modalRef: { current: null },
        selectedTheory: 'CorruptedStoredTheory',
        onSelectTheory: () => {},
        onClose: () => {},
        onOpenBriefing: () => {},
        onOpenAuthModal: () => {},
        onDeepScan: () => {},
        deepScanResult: null,
        deepScanLoading: false,
        aiSummary: null,
        aiSummaryLoading: false,
    }));
    assert.match(fallbackTheoryHtml, />Realism<\/span>/);

    const mineralsHtml = renderToStaticMarkup(React.createElement(MineralsModal, {
        open: true,
        minerals: {},
        modalRef: { current: null },
        onClose: () => {},
    }));
    assert.match(mineralsHtml, /CRITICAL MINERALS MATRIX/);
    assert.match(mineralsHtml, /2026-Q1 reference baselines/);

    const dashHtml = renderToStaticMarkup(React.createElement(OperationalDashboard, {
        visible: true,
        metricsCollapsed: false,
        onToggleCollapse: () => {},
        keyMetrics: { totalEvents: 191 },
        minerals: {},
        onOpenMinerals: () => {},
        tensionMeter: 48,
        stressLevel: 30,
        onStressLevelChange: () => {},
        escalationPairs: [],
        showConnections: false,
        onToggleConnections: () => {},
        timelineYear: '2026',
        onTimelineYearChange: () => {},
    }));
    assert.match(dashHtml, /OPERATIONAL DASHBOARD/);
    assert.match(dashHtml, /CRITICAL MINERALS/);

    const footerHtml = renderToStaticMarkup(React.createElement(AppFooter, {
        attributionRef: { current: null },
        onScrollToTop: () => {},
    }));
    assert.match(footerHtml, /<strong>Stephen Martinez \(Project Lead &amp; IB Global Politics Teacher\)<\/strong>/);
    assert.match(footerHtml, /\/CODE_OF_CONDUCT\.md/);
    assert.match(footerHtml, /width="114" height="50"/);
});

test('NexusWorkspace renders 2D Focus view only with Nexus labels and actor deep-linking', async t => {
    const vite = await createSsrViteServer(t);
    const { default: NexusWorkspace } = await vite.ssrLoadModule('/src/NexusWorkspace.jsx');

    const html = renderToStaticMarkup(React.createElement(NexusWorkspace, {
        forecasts: [],
        initialNodeId: 'europe',
        onActorChange: () => {},
        onOpenBriefing: () => {},
    }));

    assert.match(html, /aria-label="Nexus workspace"/);
    assert.match(html, /aria-label="Nexus"/);
    assert.match(html, /Europe/);
    assert.ok(!html.includes('3D spatial'), 'NexusWorkspace must not render 3D spatial toggle');
    assert.ok(!html.includes('Open 3D spatial'), 'NexusFocusView must not render Open 3D spatial button');
    assert.ok(!html.includes('Advanced Nexus'), 'NexusWorkspace must not use Advanced Nexus label');
});

test('GuidedBriefings and decomposed UI components preserve archived banners and deep links', async t => {
    const vite = await createSsrViteServer(t);
    // Verify GuidedBriefings SSR-renders archived deep-link snapshot banner, successor button,
    // archive toggle, and omits the red overdue alert on archived snapshots
    const { default: GuidedBriefings } = await vite.ssrLoadModule('/src/GuidedBriefings.jsx');
    const { GUIDED_TOURS } = await vite.ssrLoadModule('/src/nexusTours.js');
    const archivedFixtureTour = {
        ...GUIDED_TOURS[0],
        id: 'archived-usmca-2026',
        caseStudyId: 'archived-usmca-2026',
        title: 'Archived USMCA 2026 Review Snapshot',
        status: 'archived',
        reviewBy: '2020-01-01',
        archivedAt: '2027-01-15',
        archivedReason: 'Superseded after the joint commission protocol entered into force.',
        supersededById: GUIDED_TOURS[0].id,
    };
    const archivedBriefingHtml = renderToStaticMarkup(React.createElement(GuidedBriefings, {
        initialTourId: 'archived-usmca-2026',
        initialStep: 2,
        onExploreNode: () => {},
        onRouteChange: () => {},
        activeTours: GUIDED_TOURS,
        archivedTours: [archivedFixtureTour],
    }));
    assert.match(archivedBriefingHtml, /ARCHIVED HISTORICAL SNAPSHOT/);
    assert.match(archivedBriefingHtml, /briefing-archived-banner/);
    assert.match(archivedBriefingHtml, /Superseded after the joint commission protocol entered into force\./);
    assert.match(archivedBriefingHtml, /Open current successor briefing →/);
    assert.match(archivedBriefingHtml, /Show archived snapshots \(1\)/);
    assert.match(archivedBriefingHtml, /STEP 2 \//);
    assert.ok(!archivedBriefingHtml.includes('update in progress'), 'Archived snapshots must suppress update-in-progress notices');

    // Verify synthetic update-in-progress active case renders honest "Last reviewed <date>, update in progress"
    // across GuidedBriefings, IntelSidebar, DetailModal, NexusFocusView, and 5W1H without depending on wall-clock date
    const { CASE_STUDIES_2026, normalizeCaseStudy, toForecastRecord } = await vite.ssrLoadModule('/src/caseStudies2026.js');
    const { projectGuidedTour } = await vite.ssrLoadModule('/src/nexusTours.js');
    const { default: IntelSidebar } = await vite.ssrLoadModule('/src/components/IntelSidebar.jsx');
    const { default: DetailModal } = await vite.ssrLoadModule('/src/components/DetailModal.jsx');
    const { default: NexusFocusView } = await vite.ssrLoadModule('/src/NexusFocusView.jsx');
    const { generate5W1H } = await vite.ssrLoadModule('/src/eventAnalysis.js');

    const syntheticUpdateInProgressCase = normalizeCaseStudy({
        ...CASE_STUDIES_2026[0],
        id: 'synthetic-update-in-progress',
        status: 'active',
        reviewStatus: 'update-in-progress',
        updatedAt: '2026-06-30',
        reviewCadenceDays: 90,
        reviewBy: '2026-09-28',
        nexusNodeIds: ['USA'],
        waypoints: CASE_STUDIES_2026[0].waypoints.map((wp, idx) => (idx === 0 ? { ...wp, nodeId: 'USA' } : wp)),
    });
    const syntheticTour = projectGuidedTour(syntheticUpdateInProgressCase);
    const syntheticForecast = toForecastRecord(syntheticUpdateInProgressCase);
    assert.ok(!syntheticForecast.Timeline.includes('Current as of'), 'toForecastRecord must not label snapshots Current as of');

    assert.equal(
        generate5W1H(syntheticForecast, '2026-11-17').when,
        'Last reviewed 2026-06-30, update in progress (scheduled review 2026-09-28).',
    );
    const unflaggedOverdueForecast = toForecastRecord(normalizeCaseStudy({
        ...CASE_STUDIES_2026[0],
        id: 'synthetic-unflagged-overdue',
        status: 'active',
        updatedAt: '2026-08-09',
        reviewCadenceDays: 30,
        reviewBy: '2026-09-08',
    }));
    assert.equal(
        generate5W1H(unflaggedOverdueForecast, '2026-11-17').when,
        'Last reviewed 2026-08-09 · review overdue since 2026-09-08 (scheduled review 2026-09-08).',
    );

    const overdueBriefingHtml = renderToStaticMarkup(React.createElement(GuidedBriefings, {
        initialTourId: 'synthetic-update-in-progress',
        initialStep: 1,
        onExploreNode: () => {},
        onRouteChange: () => {},
        activeTours: [syntheticTour],
        archivedTours: [],
    }));
    assert.match(overdueBriefingHtml, /Last reviewed 2026-06-30, update in progress/);
    assert.match(overdueBriefingHtml, /briefing-update-banner/);
    assert.match(overdueBriefingHtml, /Update in progress/);
    assert.ok(!overdueBriefingHtml.includes('AS OF 2026-06-30'), 'Overdue briefings must not display AS OF wording');

    const overdueSidebarHtml = renderToStaticMarkup(React.createElement(IntelSidebar, {
        visible: true,
        sidebarCollapsed: false,
        onToggleCollapse: () => {},
        historicalData: null,
        historicalLoading: false,
        timelineYear: '2026',
        intelLoading: false,
        intelLastUpdated: new Date('2026-11-17T00:00:00Z'),
        intelSummary: { sourceMode: 'reference', feedStatus: 'ready', liveItemCount: 0, linkedReferenceCount: 56 },
        caseStudyCount: 29,
        feedSearch: '',
        onSearchChange: () => {},
        visibleSelectedCategory: 'ALL SOURCED INTELLIGENCE',
        onCategoryChange: () => {},
        currentFeedLabel: 'CURRENT',
        feedEmptyState: null,
        feedItems: [syntheticForecast],
        feedPage: 1,
        feedPageSize: 40,
        onShowMore: () => {},
        selectedForecast: null,
        onSelectForecast: () => {},
        onOpenBriefing: () => {},
    }));
    assert.match(overdueSidebarHtml, /Last reviewed 2026-06-30, update in progress/);
    assert.match(overdueSidebarHtml, /case-study-tag--overdue/);

    const overdueModalHtml = renderToStaticMarkup(React.createElement(DetailModal, {
        selectedForecast: syntheticForecast,
        modalRef: { current: null },
        selectedTheory: 'Realism',
        onSelectTheory: () => {},
        onClose: () => {},
        onOpenBriefing: () => {},
        onOpenAuthModal: () => {},
        onDeepScan: () => {},
        deepScanResult: null,
        deepScanLoading: false,
        aiSummary: null,
        aiSummaryLoading: false,
    }));
    assert.match(overdueModalHtml, /Last reviewed 2026-06-30, update in progress/);
    assert.match(overdueModalHtml, /case-study-update-notice/);

    const focusNexusHtml = renderToStaticMarkup(React.createElement(NexusFocusView, {
        forecasts: [syntheticForecast],
        initialNodeId: 'USA',
        onSelectActor: () => {},
        onOpenBriefing: () => {},
    }));
    assert.match(focusNexusHtml, /Current cases \(1\)/);

    const conflictCaseForecast = toForecastRecord(normalizeCaseStudy({
        ...syntheticUpdateInProgressCase,
        id: 'synthetic-conflict-case',
        issueLens: 'Security & Diplomacy',
        broadCategory: 'Geopolitics & Conflict',
    }));
    const conflictSidebarHtml = renderToStaticMarkup(React.createElement(IntelSidebar, {
        visible: true,
        sidebarCollapsed: false,
        onToggleCollapse: () => {},
        historicalData: null,
        historicalLoading: false,
        timelineYear: '2026',
        intelLoading: false,
        intelLastUpdated: new Date('2026-11-17T00:00:00Z'),
        intelSummary: { sourceMode: 'reference', feedStatus: 'ready', liveItemCount: 0, linkedReferenceCount: 56 },
        caseStudyCount: 29,
        feedSearch: '',
        onSearchChange: () => {},
        visibleSelectedCategory: 'ALL SOURCED INTELLIGENCE',
        onCategoryChange: () => {},
        currentFeedLabel: 'CURRENT',
        feedEmptyState: null,
        feedItems: [conflictCaseForecast],
        feedPage: 1,
        feedPageSize: 40,
        onShowMore: () => {},
        selectedForecast: null,
        onSelectForecast: () => {},
        onOpenBriefing: () => {},
    }));
    assert.match(conflictSidebarHtml, /case-study-item/);
    assert.match(conflictSidebarHtml, /border-left-color:#ff0066/i);
    assert.match(conflictSidebarHtml, /Geopolitics &amp; Conflict/);

    const conflictBriefingHtml = renderToStaticMarkup(React.createElement(GuidedBriefings, {
        initialTourId: 'synthetic-conflict-tour',
        initialStep: 1,
        onExploreNode: () => {},
        onRouteChange: () => {},
        activeTours: [{ ...syntheticTour, id: 'synthetic-conflict-tour', broadCategory: 'Geopolitics & Conflict' }],
        archivedTours: [],
    }));
    assert.match(conflictBriefingHtml, /briefing-card-category/);
    assert.match(conflictBriefingHtml, /Geopolitics &amp; Conflict/);

    // Verify C4 Content Depth v2 UI renders step nav, quick/full reading time, read-more toggle,
    // numbered source markers, multi-paragraph Background, and <=1 Related to this step across all steps
    const {
        buildSourceByNumber,
        buildSourceIndex,
        findRelatedTimelineIndex,
        renderCitedText,
    } = await vite.ssrLoadModule('/src/components/BriefingDepth.jsx');

    const sampleEvents = [
        { date: '1991-05', label: 'Independence declared' },
        { date: '2025-12-26', label: 'Joint declaration signed' },
    ];
    assert.equal(findRelatedTimelineIndex(sampleEvents, { relatedTimelineDate: '2025-12-26', narration: 'In 1991...' }), 1, 'Explicit relatedTimelineDate wins over year match');
    assert.equal(findRelatedTimelineIndex(sampleEvents, { narration: 'Signed on 2025-12-26 after 1991.' }), 1, 'Exact YYYY-MM-DD match scores higher than year-only match');
    assert.equal(findRelatedTimelineIndex(sampleEvents, { narration: 'No matching year at all.' }), -1);

    const sampleByNum = buildSourceByNumber(buildSourceIndex({
        sources: [{ url: 'https://a.example', publisher: 'Pub A', dateLabel: '2026-01-01' }],
        supplementalSources: [{ url: 'https://b.example', publisher: 'Pub B', dateLabel: '2026-02-01' }],
    }));
    const multiCiteHtml = renderToStaticMarkup(React.createElement('p', null, renderCitedText('Fact [1, 2].', sampleByNum)));
    assert.match(multiCiteHtml, /href="#briefing-source-1"/);
    assert.match(multiCiteHtml, /href="#briefing-source-2"/);
    assert.match(multiCiteHtml, /Source 2: Pub B, 2026-02-01/);

    for (const pilotId of ['somaliland-recognition-red-sea-order', 'western-sahara-autonomy-self-determination']) {
        const pilotTour = GUIDED_TOURS.find(t => t.id === pilotId);
        for (let step = 1; step <= pilotTour.waypoints.length; step += 1) {
            const pilotHtml = renderToStaticMarkup(React.createElement(GuidedBriefings, {
                initialTourId: pilotId,
                initialStep: step,
                onExploreNode: () => {},
                onRouteChange: () => {},
                activeTours: GUIDED_TOURS,
                archivedTours: [],
            }));
            if (step === 1) {
                assert.match(pilotHtml, /class="briefing-stepnav"/, `${pilotId} must render sticky step navigation`);
                assert.match(pilotHtml, /aria-label="Previous step"/, `${pilotId} must render Prev step button`);
                assert.match(pilotHtml, /aria-label="Next step"/, `${pilotId} must render Next step button`);
                assert.match(pilotHtml, /Quick \d+ min · Full \d+ min/, `${pilotId} must render quick & full reading times`);
                assert.match(pilotHtml, /class="cite-marker"/, `${pilotId} must render numbered source markers in step prose`);
                assert.match(pilotHtml, /id="briefing-source-1"/, `${pilotId} must assign numbered source anchor IDs`);
                assert.match(pilotHtml, /Read more: what this shows/, `${pilotId} must collapse second step paragraph behind Read more`);
                assert.match(pilotHtml, /Influence check/, `${pilotId} must render 3-stage Influence check`);
                assert.match(pilotHtml, /Editorial assessment/, `${pilotId} must label Influence check as editorial assessment`);
                assert.match(pilotHtml, /Concept lens/, `${pilotId} must render Concept lens cards`);
                assert.match(pilotHtml, /class="go-deeper-toggle"[^>]*aria-expanded="false"/, `${pilotId} Go deeper must default to collapsed`);
                assert.match(pilotHtml, /class="go-deeper-panel"[^>]*hidden=""/, `${pilotId} Go deeper panel must be hidden when collapsed`);
                assert.ok((pilotHtml.match(/class="depth-prose"/g) || []).length >= 2, `${pilotId} Background must render paragraph breaks as separate <p> elements`);
                assert.match(pilotHtml, /Worked paragraph: Claim, Evidence, Counter-claim, Judgment/, `${pilotId} must include 4-step Essay builder`);
                assert.match(pilotHtml, /Last reviewed/, `${pilotId} timeline strip must include Last reviewed marker`);
                assert.match(pilotHtml, /Review by/, `${pilotId} timeline strip must include Review by marker`);
            }
            assert.equal((pilotHtml.match(/Related to this step/g) || []).length, 1, `${pilotId} step ${step} must mark exactly 1 timeline event as Related to this step`);
            assert.ok(!pilotHtml.includes('Active step'), `${pilotId} step ${step} must use "Related to this step" rather than "Active step"`);
        }
    }
});

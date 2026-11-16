import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import './GlobalRelationsNexus.css';
import * as NexusAudio from './nexusAudio';
import { fetchGlobalPulse } from './nexusGDELT';
import { reheatGraphWhenReady } from './graphReadiness.mjs';
import { readStoredJson, writeStoredJson } from './localState.mjs';
import { resolveActorId } from './nexus/actorIds';
import {
    PRIMARY_ANCHORS,
    ANCHOR_DESCS,
    ACTOR_TYPE_LABELS,
    DIM_COLORS,
    GPC_NODE_MAP,
    assignPrimaryAnchor,
    linkId,
    computeCameraFocusPosition,
    stepNeighborIndex,
    createAxisForce,
} from './nexus/nexusData';
import {
    disposeThreeHierarchy,
    createTextSprite,
    createNexusNodeObject,
    formatNexusNodeTooltip,
    formatNexusLinkTooltip,
} from './nexus/threeSpriteHelpers';
import NexusHudControls from './nexus/NexusHudControls';
import NexusInspectorPanel from './nexus/NexusInspectorPanel';

// ══════════════════════════════════════════════════════════════════════════════



export default function GlobalRelationsNexus({ forecasts, selectedTheory, theories, onTheorySelect, initialNodeId, onActorSelect }) {
    const fgRef = useRef(null);
    const lastGraphInstanceRef = useRef(null);
    const attachGraphRef = useCallback((instance) => {
        fgRef.current = instance;
        if (instance) {
            lastGraphInstanceRef.current = instance;
        }
    }, []);
    const nexusRootRef = useRef(null);
    const [initialPreferences] = useState(() => readStoredJson('gcc-nexus-preferences', {}));
    // react-force-graph schedules its internal layout asynchronously. Calling
    // d3ReheatSimulation before the first engine tick marks the engine as
    // running while its layout is still undefined, which crashes tickFrame.
    const graphReadyRef = useRef(false);

    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedGPC, setSelectedGPC]             = useState(initialPreferences.selectedGPC || null);
    const [physicsPreset, setPhysicsPreset]          = useState(['balance', 'friction', 'core'].includes(initialPreferences.physicsPreset) ? initialPreferences.physicsPreset : 'balance');
    const [selectedNode, setSelectedNode]            = useState(() => {
        const canonicalId = resolveActorId(initialNodeId, null);
        const anchor = canonicalId ? PRIMARY_ANCHORS[canonicalId] : null;
        return anchor ? { ...anchor, isAnchor: true, desc: ANCHOR_DESCS[canonicalId], category: ACTOR_TYPE_LABELS[anchor.type] || '' } : null;
    });
    const [lockedNode, setLockedNode]                = useState(null);
    const [hoveredNode, setHoveredNode]              = useState(null);
    const [inspectTab, setInspectTab]                = useState('overview');
    // Search
    const [searchOpen, setSearchOpen]                = useState(false);
    const [searchQuery, setSearchQuery]              = useState('');
    // Live Data Pulse
    const [pulseSignals, setPulseSignals]             = useState([]);
    // Comparative Mode
    const [compareNode, setCompareNode]              = useState(null);
    // Edge Detail
    const [selectedEdge, setSelectedEdge]            = useState(null);
    // Audio
    const [audioMuted, setAudioMuted]                = useState(initialPreferences.audioMuted === true);
    const [audioVolume, setAudioVolume]              = useState(typeof initialPreferences.audioVolume === 'number' ? initialPreferences.audioVolume : 0.3);
    const [ambientOn, setAmbientOn]                = useState(false);
    // 2D mode
    const [is2D, setIs2D] = useState(initialPreferences.is2D === true);
    // Tabbed HUD
    const [hudTab, setHudTab] = useState('filters');
    // Graph clarity controls
    const [showSatellites, setShowSatellites] = useState(initialPreferences.showSatellites === true);
    const [intensityThreshold, setIntensityThreshold] = useState(typeof initialPreferences.intensityThreshold === 'number' ? initialPreferences.intensityThreshold : 0);
    const [introComplete, setIntroComplete] = useState(false);
    // Double-click & neighbor-cycle tracking
    const lastClickRef = useRef({ nodeId: null, time: 0 });
    const prevTheoryRef = useRef(selectedTheory);
    const cycleStateRef = useRef({ hubNode: null, cursorIndex: -1 });
    const [dimensions, setDimensions] = useState({ trade: true, conflict: true, diplomacy: true, tech: true, ...(initialPreferences.dimensions || {}) });
    const [expandedAnchors, setExpandedAnchors] = useState(() => (
        Object.fromEntries(Object.keys(PRIMARY_ANCHORS).map(id => [id, false]))
    ));

    useEffect(() => {
        const canonicalId = resolveActorId(initialNodeId, null);
        const anchor = canonicalId ? PRIMARY_ANCHORS[canonicalId] : null;
        if (anchor) setSelectedNode({ ...anchor, isAnchor: true, desc: ANCHOR_DESCS[canonicalId], category: ACTOR_TYPE_LABELS[anchor.type] || '' });
    }, [initialNodeId]);

    useEffect(() => {
        if (selectedNode?.isAnchor) onActorSelect?.(selectedNode.id);
    }, [selectedNode?.id, selectedNode?.isAnchor, onActorSelect]);

    useEffect(() => {
        writeStoredJson('gcc-nexus-preferences', {
            selectedGPC,
            physicsPreset,
            audioMuted,
            audioVolume,
            is2D,
            showSatellites,
            intensityThreshold,
            dimensions,
        });
    }, [selectedGPC, physicsPreset, audioMuted, audioVolume, is2D, showSatellites, intensityThreshold, dimensions]);

    const toggleAnchorExpand = useCallback((id) => {
        setExpandedAnchors(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const expandAll = useCallback(() => {
        setExpandedAnchors(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])));
    }, []);

    const collapseAll = useCallback(() => {
        setExpandedAnchors(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false])));
        setSelectedNode(null);
        setLockedNode(null);
        setCompareNode(null);
    }, []);

    // Count satellites per anchor
    const anchorSatCounts = useMemo(() => {
        const counts = {};
        const valid = forecasts.filter(f => f['Entity/Subject']);
        valid.forEach(f => {
            const aid = assignPrimaryAnchor(f);
            counts[aid] = (counts[aid] || 0) + 1;
        });
        return counts;
    }, [forecasts]);

    // ── Build graph data (MUST come before highlightedNodes) ──────────────────
    const graphData = useMemo(() => {
        const nodes = [];
        const links = [];

        // 1. Anchors
        Object.entries(PRIMARY_ANCHORS).forEach(([key, a]) => {
            nodes.push({ ...a, isAnchor: true, val: a.size * 2, desc: ANCHOR_DESCS[key], category: ACTOR_TYPE_LABELS[a.type] || '' });
        });

        // 2. Forecast satellites
        const valid = forecasts.filter(f => f['Entity/Subject']);
        valid.forEach((f, i) => {
            const anchorId = assignPrimaryAnchor(f);
            const id = `forecast-${i}`;
            if (!expandedAnchors[anchorId]) return;

            const cat = f.Broad_Category || '';
            let color = '#ffffff';
            if (cat.includes('Conflict'))    color = '#ff0066';
            else if (cat.includes('Economy') || cat.includes('Trade')) color = '#00ccff';
            else if (cat.includes('Tech'))   color = '#bf55ec';
            else if (cat.includes('Health')) color = '#00ff88';
            else if (cat.includes('Environment')) color = '#66ff00';
            else if (cat.includes('Culture')) color = '#ff00ff';

            nodes.push({
                id, name: f['Entity/Subject'], desc: f['Expected Impact/Value'],
                players: f['Key Player/Organization'], timeline: f.Timeline,
                category: f.Broad_Category || f['Topic/Sector'] || 'Global Intel',
                isAnchor: false, anchorId, val: 4, color, rawData: f,
            });
            links.push({ source: anchorId, target: id, type: 'satellite', color: 'rgba(255,255,255,0.06)', width: 0.8 });

            // Cross-anchor links derived from text
            const txt = `${f['Entity/Subject']} ${f['Expected Impact/Value']} ${f['Key Player/Organization']} ${f.Broad_Category}`.toLowerCase();
            const hasC = /conflict|military|ceasefire|war|rival|insurgent|rsf|wagner/.test(txt);
            const hasT = /trade|economy|finance|tariff|tax|gdp/.test(txt);
            const hasD = /diplomacy|treaty|accord|alliance|cooperation|pact/.test(txt);
            const hasK = /technology|semiconductor|ai|mineral|lithium|pharma|drug/.test(txt);

            const cross = new Set();
            if (/sudan|egypt|rsf/.test(txt))  { cross.add('Africa'); cross.add('MilitantPMC'); }
            if (/saudi|uae/.test(txt))        cross.add('MiddleEast');
            if (/trump|america/.test(txt))    cross.add('USA');
            if (/china|tsmc/.test(txt))       { cross.add('China'); cross.add('TechAIHub'); }
            if (/russia|wagner/.test(txt))    { cross.add('Russia'); cross.add('MilitantPMC'); }
            if (/europe|nato/.test(txt))      { cross.add('Europe'); cross.add('NATO'); }
            cross.delete(anchorId);

            cross.forEach(tgt => {
                if (hasC && dimensions.conflict)  links.push({ source: anchorId, target: tgt, type: 'conflict',  color: DIM_COLORS.conflict,  width: 2.2, particles: 2 });
                if (hasT && dimensions.trade)     links.push({ source: anchorId, target: tgt, type: 'trade',     color: DIM_COLORS.trade,     width: 1.8, particles: 4 });
                if (hasD && dimensions.diplomacy) links.push({ source: anchorId, target: tgt, type: 'diplomacy', color: DIM_COLORS.diplomacy, width: 1.5, particles: 2 });
                if (hasK && dimensions.tech)      links.push({ source: anchorId, target: tgt, type: 'tech',      color: DIM_COLORS.tech,      width: 1.6, particles: 3 });
            });
        });

        // 3. Baseline structural links — comprehensive geopolitical web
        const p = (s, t, tp, c, w, pt) => links.push({ source: s, target: t, type: tp, color: c, width: w, particles: pt });
        if (dimensions.trade) {
            // Major trade corridors
            p('USA','China','trade',DIM_COLORS.trade,2.5,5);         // US-China trade rivalry
            p('USA','Europe','trade',DIM_COLORS.trade,2.2,4);        // Transatlantic trade
            p('USA','AsiaPacific','trade',DIM_COLORS.trade,1.6,3);   // Indo-Pacific trade
            p('USA','LatinAmerica','trade',DIM_COLORS.trade,1.5,3);  // USMCA / Western hemisphere
            p('China','Europe','trade',DIM_COLORS.trade,1.8,3);      // Belt & Road trade with EU
            p('China','MiddleEast','trade',DIM_COLORS.trade,1.8,4);  // Oil imports, BRI
            p('China','Africa','trade',DIM_COLORS.trade,2.0,4);      // Infrastructure-for-minerals
            p('China','AsiaPacific','trade',DIM_COLORS.trade,1.7,3); // RCEP / regional trade
            p('China','LatinAmerica','trade',DIM_COLORS.trade,1.4,2);// Lithium & soy
            p('Europe','MiddleEast','trade',DIM_COLORS.trade,1.5,3); // Energy imports
            p('Europe','Africa','trade',DIM_COLORS.trade,1.3,2);     // Post-colonial trade
            p('MiddleEast','AsiaPacific','trade',DIM_COLORS.trade,1.4,2); // Oil to Asia
            // MNC trade links
            p('USA','TechAIHub','trade',DIM_COLORS.trade,2.5,6);     // Nvidia/chip design
            p('China','TechAIHub','trade',DIM_COLORS.trade,2.0,4);   // TSMC dependency / export controls
            p('Europe','TechAIHub','trade',DIM_COLORS.trade,1.8,3);  // ASML (Netherlands)
            p('AsiaPacific','TechAIHub','trade',DIM_COLORS.trade,2.2,5); // TSMC Taiwan/Samsung Korea
            p('USA','BiotechHub','trade',DIM_COLORS.trade,2.2,5);    // US pharma giants
            p('Europe','BiotechHub','trade',DIM_COLORS.trade,1.8,3); // Novo Nordisk (Denmark)
            p('AsiaPacific','BiotechHub','trade',DIM_COLORS.trade,1.2,2); // Generic drug manufacturing
        }
        if (dimensions.conflict) {
            // Major conflict/friction axes
            p('USA','Russia','conflict',DIM_COLORS.conflict,2.8,3);  // Great power rivalry
            p('USA','China','conflict',DIM_COLORS.conflict,2.5,3);   // Indo-Pacific tensions
            p('Europe','Russia','conflict',DIM_COLORS.conflict,2.6,3);// Ukraine theatre
            p('Russia','NATO','conflict',DIM_COLORS.conflict,2.8,4); // NATO-Russia deterrence
            p('China','AsiaPacific','conflict',DIM_COLORS.conflict,2.2,3); // South China Sea / Taiwan
            p('USA','MiddleEast','conflict',DIM_COLORS.conflict,1.8,2); // Iran strikes
            p('MiddleEast','MilitantPMC','conflict',DIM_COLORS.conflict,2.0,3); // Regional militia
            p('MilitantPMC','Africa','conflict',DIM_COLORS.conflict,2.4,3);  // Sudan RSF, Sahel
            p('MilitantPMC','Russia','conflict',DIM_COLORS.conflict,1.8,2);  // Wagner operations
            p('MilitantPMC','China','conflict',DIM_COLORS.conflict,0.8,1);   // China Belt & Road security
            // Jihadist networks
            p('Jihadist','Africa','conflict',DIM_COLORS.conflict,2.5,4);     // Sahel JNIM, Boko Haram, Al-Shabaab
            p('Jihadist','MiddleEast','conflict',DIM_COLORS.conflict,2.2,3); // ISIS remnants in Syria/Iraq
            p('Jihadist','AsiaPacific','conflict',DIM_COLORS.conflict,1.2,2);// SE Asia affiliates (Philippines, Indonesia)
            p('Jihadist','USA','conflict',DIM_COLORS.conflict,1.5,2);       // Counter-terrorism operations
            p('Jihadist','Europe','conflict',DIM_COLORS.conflict,1.4,2);    // Domestic radicalization
            p('Jihadist','MilitantPMC','conflict',DIM_COLORS.conflict,1.6,2);// Sahel overlap with Wagner
            // Cartels
            p('Cartels','LatinAmerica','conflict',DIM_COLORS.conflict,2.8,4);// Territorial control
            p('Cartels','USA','conflict',DIM_COLORS.conflict,2.2,3);        // Fentanyl crisis, border security
            p('Cartels','China','trade',DIM_COLORS.trade,1.5,2);            // Precursor chemicals from China
            // Cyber actors
            p('CyberActors','Russia','conflict',DIM_COLORS.conflict,2.0,3); // APT28/Sandworm
            p('CyberActors','China','conflict',DIM_COLORS.conflict,1.8,2);  // APT41
            p('CyberActors','USA','conflict',DIM_COLORS.conflict,2.2,3);    // Primary target
            p('CyberActors','Europe','conflict',DIM_COLORS.conflict,1.5,2); // Infrastructure attacks
            p('CyberActors','TechAIHub','tech',DIM_COLORS.tech,1.6,2);     // IP theft, chip espionage
            p('CyberActors','NATO','conflict',DIM_COLORS.conflict,1.3,2);   // Hybrid warfare
            // Hezbollah / Iran proxies
            p('Hezbollah','MiddleEast','conflict',DIM_COLORS.conflict,2.8,4);// Lebanon, Iraq PMF
            p('Hezbollah','AsiaPacific','conflict',DIM_COLORS.conflict,1.0,1);// Houthi Red Sea attacks
            p('Hezbollah','Russia','diplomacy',DIM_COLORS.diplomacy,1.2,2); // Syria alliance
            p('Hezbollah','UN_OPEC','diplomacy',DIM_COLORS.diplomacy,1.0,1);// UN sanctions
            p('Hezbollah','USA','conflict',DIM_COLORS.conflict,2.0,3);      // US sanctions/CENTCOM
            p('MilitantPMC','Europe','conflict',DIM_COLORS.conflict,1.6,2);  // Wagner friction
            // Tech conflict (export controls, cyber)
            p('USA','TechAIHub','conflict',DIM_COLORS.conflict,1.4,2); // Chip export controls
            p('China','TechAIHub','conflict',DIM_COLORS.conflict,1.8,2); // Semiconductor blockade
        }
        if (dimensions.diplomacy) {
            // Alliance structures
            p('USA','Europe','diplomacy',DIM_COLORS.diplomacy,2.5,3); // Transatlantic alliance
            p('USA','NATO','diplomacy',DIM_COLORS.diplomacy,2.6,4);  // NATO backbone
            p('Europe','NATO','diplomacy',DIM_COLORS.diplomacy,2.4,3);// NATO European pillar
            p('USA','AsiaPacific','diplomacy',DIM_COLORS.diplomacy,1.8,2); // AUKUS / Quad
            p('USA','MiddleEast','diplomacy',DIM_COLORS.diplomacy,1.6,2);  // Abraham Accords
            p('China','Russia','diplomacy',DIM_COLORS.diplomacy,2.2,3);    // Strategic partnership
            p('China','Africa','diplomacy',DIM_COLORS.diplomacy,1.6,2);    // FOCAC diplomacy
            p('China','LatinAmerica','diplomacy',DIM_COLORS.diplomacy,1.3,2); // Infrastructure diplomacy
            p('Europe','Africa','diplomacy',DIM_COLORS.diplomacy,1.4,2);   // EU-AU partnership
            // Multilateral diplomacy
            p('UN_OPEC','Europe','diplomacy',DIM_COLORS.diplomacy,2.0,3);  // Multilateral system
            p('UN_OPEC','USA','diplomacy',DIM_COLORS.diplomacy,1.8,2);    // UN/WTO
            p('UN_OPEC','MiddleEast','diplomacy',DIM_COLORS.diplomacy,2.0,3); // OPEC energy governance
            p('UN_OPEC','Africa','diplomacy',DIM_COLORS.diplomacy,1.5,2); // Development agencies
            p('UN_OPEC','AsiaPacific','diplomacy',DIM_COLORS.diplomacy,1.3,2); // Regional governance
        }
        if (dimensions.tech) {
            // Tech supply chains & innovation corridors
            p('TechAIHub','AsiaPacific','tech',DIM_COLORS.tech,2.8,5);// TSMC foundries (Taiwan)
            p('TechAIHub','USA','tech',DIM_COLORS.tech,2.5,4);       // Nvidia, Qualcomm design
            p('TechAIHub','Europe','tech',DIM_COLORS.tech,2.2,4);    // ASML photolithography
            p('TechAIHub','China','tech',DIM_COLORS.tech,1.8,3);     // Chinese chip ambitions / Huawei
            p('China','Africa','tech',DIM_COLORS.tech,2.0,3);        // Belt & Road digital / mining
            p('China','AsiaPacific','tech',DIM_COLORS.tech,1.6,3);   // Regional tech competition
            p('USA','Europe','tech',DIM_COLORS.tech,1.5,2);          // AI regulation / transatlantic tech
            p('LatinAmerica','TechAIHub','tech',DIM_COLORS.tech,1.3,2); // Lithium for batteries
            // Non-state actor trade links
            p('Cartels','Africa','trade',DIM_COLORS.trade,0.8,1);           // Cocaine transit via West Africa
            p('MilitantPMC','Africa','trade',DIM_COLORS.trade,1.2,2);      // Gold/mineral extraction
            // Pharma/biotech tech corridors
            p('BiotechHub','Europe','tech',DIM_COLORS.tech,1.8,3);   // Novo Nordisk R&D
            p('BiotechHub','AsiaPacific','tech',DIM_COLORS.tech,1.4,2); // Generic manufacturing
            p('BiotechHub','USA','tech',DIM_COLORS.tech,2.0,3);      // US pharma R&D hub
        }

        return { nodes, links };
    }, [forecasts, expandedAnchors, dimensions]);

    // ── Highlighted (first-degree) set — uses lockedNode when locked ─────────
    const focusNode = lockedNode || selectedNode;
    const highlightSet = useMemo(() => {
        if (!focusNode) return null;
        const s = new Set([focusNode.id]);
        graphData.links.forEach(l => {
            const sId = linkId(l.source), tId = linkId(l.target);
            if (sId === focusNode.id) s.add(tId);
            if (tId === focusNode.id) s.add(sId);
        });
        // Also highlight the currently selected node (when navigating within lock)
        if (selectedNode && selectedNode.id !== focusNode.id) {
            s.add(selectedNode.id);
        }
        // Comparative mode: also add compare node's neighborhood
        if (compareNode) {
            s.add(compareNode.id);
            graphData.links.forEach(l2 => {
                const s2 = typeof l2.source === 'object' ? l2.source.id : l2.source;
                const t2 = typeof l2.target === 'object' ? l2.target.id : l2.target;
                if (s2 === compareNode.id) s.add(t2);
                if (t2 === compareNode.id) s.add(s2);
            });
        }
        return s;
    }, [focusNode, selectedNode, compareNode, graphData]);

    // ── Filtered graph data for display ─────────────────────────────────────
    const displayData = useMemo(() => {
        let nodes = graphData.nodes;
        let links = graphData.links;

        // GPC challenge filter — dimming handled by linkColor/linkWidth callbacks
        // (No node modification here to preserve ForceGraph position references)

        // Hide satellites unless toggled or a node is selected
        if (!showSatellites && !selectedNode && !lockedNode) {
            const anchorIds = new Set(Object.keys(PRIMARY_ANCHORS));
            nodes = nodes.filter(n => anchorIds.has(n.id));
            links = links.filter(l => {
                const s = typeof l.source === 'object' ? l.source.id : l.source;
                const t = typeof l.target === 'object' ? l.target.id : l.target;
                return anchorIds.has(s) && anchorIds.has(t);
            });
        }

        // Intensity filter — hide weak links
        if (intensityThreshold > 0) {
            links = links.filter(l => (l.width || 1) >= intensityThreshold);
        }

        return { nodes, links };
    }, [graphData, showSatellites, selectedNode, lockedNode, intensityThreshold]);

    // ── Search results ────────────────────────────────────────────────────────
    const searchResults = useMemo(() => {
        if (!searchQuery || searchQuery.length < 2) return [];
        const q = searchQuery.toLowerCase();
        return graphData.nodes.filter(n => {
            const txt = [n.name, n.category, n.players, n.desc].filter(Boolean).join(' ').toLowerCase();
            return txt.includes(q);
        });
    }, [searchQuery, graphData]);

    // ── Theory switch audio cue (fire once per actual theory change) ──────────
    useEffect(() => {
        if (prevTheoryRef.current !== selectedTheory) {
            prevTheoryRef.current = selectedTheory;
            NexusAudio.soundTheorySwitch();
        }
    }, [selectedTheory]);

    // ── Physics engine ────────────────────────────────────────────────────────
    useEffect(() => {
        if (!fgRef.current) return;
        const fg = fgRef.current;

        let charge = -150, baseDist = 110;
        if (physicsPreset === 'friction') { charge = -320; baseDist = 180; }
        else if (physicsPreset === 'core') { charge = -80; baseDist = 60; }
        else if (selectedTheory === 'Realism')        { charge = -230; baseDist = 130; }
        else if (selectedTheory === 'Liberalism')     { charge = -110; baseDist = 90; }
        else if (selectedTheory === 'Constructivism') { charge = -160; baseDist = 110; }

        fg.d3Force('charge').strength(charge);

        // Register spatial lens forces once per effect run (never inside link.distance)
        if (physicsPreset === 'balance' && selectedTheory === 'Marxism') {
            fg.d3Force('x', null);
            fg.d3Force('y', createAxisForce(
                'y',
                d => (['USA', 'Europe', 'Russia', 'NATO'].includes(d.id) ? -80 : 80),
                d => (d.isAnchor ? 0.18 : 0)
            ));
        } else if (physicsPreset === 'balance' && selectedTheory === 'Postcolonialism') {
            fg.d3Force('y', null);
            fg.d3Force('x', createAxisForce(
                'x',
                d => (d.id === 'USA' ? -200 : d.id === 'Europe' ? 200 : 0),
                d => (d.isAnchor && ['USA', 'Europe'].includes(d.id) ? 0.18 : 0)
            ));
        } else {
            fg.d3Force('x', null);
            fg.d3Force('y', null);
        }

        fg.d3Force('link').distance(lnk => {
            if (physicsPreset === 'core')     return lnk.type === 'satellite' ? 20 : 75;
            if (physicsPreset === 'friction') return lnk.type === 'conflict' ? 260 : 160;
            if (selectedTheory === 'Realism') {
                if (lnk.type === 'conflict') return 240;
                if (lnk.type === 'satellite') return 40;
                return 130;
            }
            if (selectedTheory === 'Liberalism') {
                if (lnk.type === 'diplomacy') return 50;
                if (lnk.type === 'trade') return 60;
                return 100;
            }
            return baseDist;
        });
        reheatGraphWhenReady(graphReadyRef, fg);
    }, [selectedTheory, physicsPreset, graphData]);

    // Navigate to a specific node (used by connection table, search, and arrow-key cycling)
    const navigateToNode = useCallback((nodeRef, { preserveCycle = false } = {}) => {
        if (!nodeRef) return;
        if (!preserveCycle) {
            cycleStateRef.current = { hubNode: null, cursorIndex: -1 };
        }
        setSelectedNode(nodeRef);
        setSelectedEdge(null);
        setInspectTab('overview');
        NexusAudio.soundConnectionNav();
        if (fgRef.current && nodeRef.x != null) {
            const camPos = computeCameraFocusPosition(nodeRef, 220);
            fgRef.current.cameraPosition(camPos, nodeRef, 1200);
        }
    }, []);

    // ── Click handler ─────────────────────────────────────────────────────────
    const handleNodeClick = useCallback((node, isShiftKey = false) => {
        if (!node) return;
        cycleStateRef.current = { hubNode: null, cursorIndex: -1 };

        // Double-click detection → auto-lock
        const now = Date.now();
        if (lastClickRef.current.nodeId === node.id && now - lastClickRef.current.time < 400) {
            setSelectedNode(node);
            setLockedNode(node);
            NexusAudio.soundLockEngage();
            navigateToNode(node);
            lastClickRef.current = { nodeId: null, time: 0 };
            return;
        }
        lastClickRef.current = { nodeId: node.id, time: now };

        // Comparative mode: Shift+click with locked node
        if (lockedNode && node.id !== lockedNode.id && isShiftKey) {
            setCompareNode(prev => (prev?.id === node.id ? null : node));
            NexusAudio.soundCompareEngage();
            return;
        }

        const isDeselect = Boolean(selectedNode && selectedNode.id === node.id);
        setSelectedNode(isDeselect ? null : node);
        setSelectedEdge(null);
        NexusAudio.soundNodeClick();

        if (!isDeselect && fgRef.current && node.x != null) {
            const camPos = computeCameraFocusPosition(node, 220);
            fgRef.current.cameraPosition(camPos, node, 1200);
        }
    }, [lockedNode, selectedNode, navigateToNode]);

    // Background click — deselect node but keep lock
    const handleBackgroundClick = useCallback(() => {
        cycleStateRef.current = { hubNode: null, cursorIndex: -1 };
        if (lockedNode) {
            setSelectedNode(lockedNode);
        } else {
            setSelectedNode(null);
        }
    }, [lockedNode]);

    // Reset camera to default overview position
    const resetCamera = useCallback(() => {
        setSelectedNode(null);
        setLockedNode(null);
        setCompareNode(null);
        if (fgRef.current) {
            fgRef.current.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 1500);
        }
    }, []);

    // Lock/unlock the current node's neighborhood
    const toggleLock = useCallback(() => {
        if (lockedNode) {
            // Unlock — resume physics
            setLockedNode(null);
            setCompareNode(null);
            reheatGraphWhenReady(graphReadyRef, fgRef);
            NexusAudio.soundLockRelease();
        } else if (selectedNode) {
            // Lock — freeze physics to stabilize the view
            setLockedNode(selectedNode);
            NexusAudio.soundLockEngage();
            if (reheatGraphWhenReady(graphReadyRef, fgRef)) {
                // Let it settle briefly then pause
                setTimeout(() => {
                    if (fgRef.current) fgRef.current.pauseAnimation();
                    setTimeout(() => {
                        if (fgRef.current) fgRef.current.resumeAnimation();
                    }, 50);
                }, 800);
            }
        }
    }, [selectedNode, lockedNode]);

    // ── GDELT live data pulse ─────────────────────────────────────────────────
    const [gdeltArticles, setGdeltArticles] = useState([]);
    useEffect(() => {
        // Initial fetch
        fetchGlobalPulse().then(articles => {
            setGdeltArticles(articles);
            const signals = [...new Set(articles.flatMap(a => a.anchors))];
            setPulseSignals(signals);
            if (signals.length > 0) NexusAudio.soundDataPulse();
        }).catch(() => {});
        // Refresh every 45 seconds (GDELT rate limit: 1 req per 5s)
        const interval = setInterval(() => {
            fetchGlobalPulse().then(articles => {
                setGdeltArticles(prev => {
                    const combined = [...articles, ...prev].slice(0, 50);
                    return combined;
                });
                const signals = [...new Set(articles.flatMap(a => a.anchors))];
                setPulseSignals(signals);
                if (signals.length > 0) NexusAudio.soundDataPulse();
            }).catch(() => {});
        }, 45000);
        return () => clearInterval(interval);
    }, []);

    // ── Data-driven radar metrics ─────────────────────────────────────────────
    // Each metric is scored 0-100 by scanning the node's text fields for signal keywords.
    // More keyword hits = higher score. Anchors use type-based baselines.
    const radarMetrics = useMemo(() => {
        if (!selectedNode) return null;

        const txt = [
            selectedNode.name, selectedNode.desc, selectedNode.category,
            selectedNode.players, selectedNode.timeline
        ].filter(Boolean).join(' ').toLowerCase();

        // Count keyword matches as signal strength (each match adds points, capped at 100)
        const score = (patterns, base = 20) => {
            let s = base;
            patterns.forEach(([regex, pts]) => { if (regex.test(txt)) s += pts; });
            return Math.min(100, Math.max(5, s));
        };

        const autonomy = score([
            [/sovereign|independence|unilateral|self.?determination/, 25],
            [/state|nation|government|president|prime minister/, 15],
            [/superpower|hegemon/, 20],
            [/depend|auster|imf|bailout|debt/, -15],
            [/colony|occupation|sanction/, -10],
        ], selectedNode.isAnchor && selectedNode.type === 'state' ? 70 : 30);

        const economicPenetration = score([
            [/trade|export|import|tariff|gdp|economy/, 20],
            [/billion|trillion|\$\d/, 15],
            [/market|supply.?chain|investment|fdi/, 15],
            [/pharma|semiconductor|oil|mineral|lithium/, 20],
            [/poverty|recession|default/, -10],
        ], selectedNode.isAnchor && selectedNode.type === 'mnc' ? 75 : 35);

        const conflictExposure = score([
            [/conflict|war|military|attack|strike|bombing/, 30],
            [/ceasefire|casualt|death|kill/, 20],
            [/insurgent|rebel|militia|rsf|wagner|paramilitary/, 25],
            [/nuclear|weapon|missile|drone/, 20],
            [/peace|treaty|accord|reconciliation/, -15],
        ], selectedNode.isAnchor && selectedNode.type === 'nonstate' ? 70 : 15);

        const resourceSecurity = score([
            [/oil|gas|energy|mineral|lithium|cobalt|uranium/, 25],
            [/semiconductor|chip|foundry|tsmc|asml/, 25],
            [/food|water|agriculture|grain/, 15],
            [/supply.?chain|critical|strategic/, 15],
            [/pharma|drug|vaccine|pipeline/, 20],
        ], selectedNode.isAnchor && selectedNode.type === 'mnc' ? 65 : 30);

        const diplomaticCentrality = score([
            [/diplomacy|treaty|alliance|pact|accord/, 25],
            [/un |nato|opec|wto|multilateral|g7|g20/, 25],
            [/cooperation|partner|coalition|negotiat/, 15],
            [/summit|conference|bilateral/, 15],
            [/isolation|sanction|expelled/, -15],
        ], selectedNode.isAnchor && selectedNode.type === 'igo' ? 80 : 35);

        return { autonomy, economicPenetration, conflictExposure, resourceSecurity, diplomaticCentrality };
    }, [selectedNode]);

    // ── Helper: build unique neighbor list for any hub node ─────────────────
    const getNodeConnections = useCallback((hubNode) => {
        if (!hubNode) return [];
        const conns = [];
        const seen = new Set();
        graphData.links.forEach(lnk => {
            const sId = linkId(lnk.source), tId = linkId(lnk.target);
            let partnerId = null;
            if (sId === hubNode.id) partnerId = tId;
            else if (tId === hubNode.id) partnerId = sId;
            if (!partnerId || lnk.type === 'satellite') return;
            const key = `${partnerId}-${lnk.type}`;
            if (seen.has(key)) return;
            seen.add(key);
            const partnerNode = graphData.nodes.find(n => n.id === partnerId);
            if (!partnerNode) return;
            conns.push({
                id: partnerId,
                nodeRef: partnerNode,
                name: partnerNode.name,
                type: lnk.type,
                color: lnk.color || DIM_COLORS[lnk.type] || '#fff',
                width: lnk.width || 1,
            });
        });
        return conns;
    }, [graphData]);

    // ── Connection summary for selected node ────────────────────────────────
    const connectionSummary = useMemo(() => getNodeConnections(selectedNode), [selectedNode, getNodeConnections]);

    // ── Edge click handler ────────────────────────────────────────────────────
    const handleLinkClick = useCallback((link) => {
        cycleStateRef.current = { hubNode: null, cursorIndex: -1 };
        setSelectedEdge(link);
        setSelectedNode(null);
        NexusAudio.soundEdgeClick();
    }, []);

    // ── Keyboard navigation ───────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
            const target = e.target instanceof Element ? e.target : null;
            const isInteractive = Boolean(target?.closest('input, textarea, select, button, a, [contenteditable="true"]'));

            // Shortcuts belong to this workspace only. Normal keyboard behavior
            // always wins in controls, and Tab is never repurposed.
            if (!nexusRootRef.current?.contains(target)) return;
            if (isInteractive && e.key !== 'Escape') return;

            // Search shortcut
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setSearchOpen(prev => !prev);
                setSearchQuery('');
                NexusAudio.soundSearchOpen();
                return;
            }
            if (e.key === 'Escape' && searchOpen) {
                setSearchOpen(false);
                setSearchQuery('');
                return;
            }
            if (e.key === 'Escape') {
                cycleStateRef.current = { hubNode: null, cursorIndex: -1 };
                if (lockedNode) {
                    setLockedNode(null);
                    setCompareNode(null);
                    reheatGraphWhenReady(graphReadyRef, fgRef);
                } else {
                    setSelectedNode(null);
                }
                return;
            }
            // Arrow keys cycle through the locked or initially selected hub's unique neighbors
            if ((lockedNode || selectedNode) && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
                const hubNode = lockedNode || cycleStateRef.current.hubNode || selectedNode;
                const uniqueNeighbors = [];
                const seenPartners = new Set();
                getNodeConnections(hubNode).forEach(conn => {
                    if (!seenPartners.has(conn.id)) {
                        seenPartners.add(conn.id);
                        uniqueNeighbors.push(conn);
                    }
                });
                if (uniqueNeighbors.length > 0) {
                    e.preventDefault();
                    const direction = (e.key === 'ArrowDown' || e.key === 'ArrowRight') ? 1 : -1;
                    const nextIdx = stepNeighborIndex(
                        uniqueNeighbors,
                        selectedNode?.id,
                        cycleStateRef.current.hubNode?.id === hubNode.id ? cycleStateRef.current.cursorIndex : -1,
                        direction
                    );
                    cycleStateRef.current = { hubNode, cursorIndex: nextIdx };
                    navigateToNode(uniqueNeighbors[nextIdx].nodeRef, { preserveCycle: true });
                }
            }
        };
        const root = nexusRootRef.current;
        root?.addEventListener('keydown', handler);
        return () => root?.removeEventListener('keydown', handler);
    }, [selectedNode, lockedNode, getNodeConnections, navigateToNode, searchOpen]);


    // ── At-a-glance badges for selected node ──────────────────────────────────
    const nodeBadges = useMemo(() => {
        if (!selectedNode) return [];
        const badges = [];
        const all = `${selectedNode.name} ${selectedNode.desc || ''} ${selectedNode.category || ''} ${selectedNode.players || ''}`.toLowerCase();
        if (/conflict|war|military|ceasefire|rsf|wagner|insurgent/.test(all))    badges.push({ label: 'HIGH CONFLICT', color: '#ff0066', icon: '🔴' });
        if (/trade|economy|tariff|gdp|finance/.test(all))                        badges.push({ label: 'TRADE NEXUS', color: '#00ccff', icon: '🔵' });
        if (/tech|semiconductor|ai|quantum|asml|nvidia|tsmc/.test(all))          badges.push({ label: 'TECH CHOKEPOINT', color: '#bf55ec', icon: '🟣' });
        if (/diplomacy|treaty|alliance|pact|cooperation/.test(all))              badges.push({ label: 'DIPLOMATIC', color: '#00ff88', icon: '🟢' });
        if (/health|pharma|drug|obesity|semaglutide|lilly/.test(all))            badges.push({ label: 'HEALTH PIPELINE', color: '#ff9900', icon: '🟠' });
        if (/environment|climate|emissions|green/.test(all))                     badges.push({ label: 'CLIMATE LINKED', color: '#66ff00', icon: '🟡' });
        if (/mineral|lithium|oil|energy|resource/.test(all))                     badges.push({ label: 'RESOURCE CRITICAL', color: '#ffcc00', icon: '⚡' });
        return badges.slice(0, 4); // max 4 badges
    }, [selectedNode]);

    // ── Helper: is a link relevant to focus / GPC? ────────────────────────────
    const isLinkFocused = useCallback((lnk) => {
        const focus = lockedNode || selectedNode;
        if (!focus) return true;
        return linkId(lnk.source) === focus.id || linkId(lnk.target) === focus.id;
    }, [selectedNode, lockedNode]);

    const buildNodeObject = useCallback(
        node => createNexusNodeObject(node, { highlightSet, makeSprite: createTextSprite }),
        [highlightSet]
    );

    // ── 2D mode: flatten z-coordinates ──────────────────────────────────────
    useEffect(() => {
        if (!fgRef.current) return;
        const fg = fgRef.current;
        if (is2D) {
            // Flatten all nodes to z=0
            graphData.nodes.forEach(n => { n.fz = 0; });
            reheatGraphWhenReady(graphReadyRef, fg);
            // Top-down camera
            setTimeout(() => {
                fg.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
            }, 200);
        } else {
            // Restore 3D freedom
            graphData.nodes.forEach(n => { n.fz = undefined; });
            reheatGraphWhenReady(graphReadyRef, fg);
        }
    }, [is2D, graphData]);

    // ── Animated intro sequence ───────────────────────────────────────────────
    useEffect(() => {
        if (introComplete) return undefined;
        const anchors = Object.keys(PRIMARY_ANCHORS);
        const timers = anchors.map((id, i) => setTimeout(() => {
            const node = graphData.nodes.find(n => n.id === id);
            if (node) node.__visible = true;
        }, i * 150));
        timers.push(setTimeout(() => setIntroComplete(true), anchors.length * 150 + 500));
        return () => timers.forEach(t => clearTimeout(t));
    }, [graphData, introComplete]);

    // ── WebGL & WebAudio cleanup on unmount ───────────────────────────────────
    useEffect(() => () => {
        const fg = fgRef.current || lastGraphInstanceRef.current;
        lastGraphInstanceRef.current = null;
        if (fg) {
            try { fg.pauseAnimation?.(); } catch {}
            try { disposeThreeHierarchy(fg.scene?.()); } catch {}
            try { fg.renderer?.()?.dispose?.(); } catch {}
        }
        NexusAudio.disposeAudio();
    }, []);

    // ── 3D scene lighting ─────────────────────────────────────────────────────
    useEffect(() => {
        const timer = setTimeout(() => {
            if (fgRef.current) {
                const scene = fgRef.current.scene();
                if (scene && !scene.userData.lightsAdded) {
                    scene.add(new THREE.AmbientLight(0x404040, 2));
                    const pl = new THREE.PointLight(0xffffff, 1.5, 2000);
                    pl.position.set(0, 200, 400);
                    scene.add(pl);
                    const pl2 = new THREE.PointLight(0x0088ff, 0.8, 1500);
                    pl2.position.set(-300, -100, 200);
                    scene.add(pl2);
                    scene.userData.lightsAdded = true;
                }
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [graphData]);

    // ── Anchor rotation animation ─────────────────────────────────────────────
    useEffect(() => {
        if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return undefined;
        let animId;
        const animate = () => {
            if (fgRef.current) {
                const scene = fgRef.current.scene();
                if (scene) {
                    scene.traverse(obj => {
                        if (obj.userData && obj.userData.anchorType) {
                            obj.rotation.y += 0.003;
                            if (obj.userData.anchorType === 'mnc') obj.rotation.x += 0.002;
                            if (obj.userData.anchorType === 'igo') obj.rotation.z += 0.002;
                            if (obj.userData.anchorType === 'nonstate') obj.rotation.x += 0.004;
                        }
                    });
                }
            }
            animId = requestAnimationFrame(animate);
        };
        animId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(animId);
    }, []);

    // ══════════════════════════════════════════════════════════════════════════
    return (
        <div className="nexus-container" ref={nexusRootRef}>
            {/* ── Search Overlay ─────────────────────────────────── */}
            {searchOpen && (
                <div className="nexus-search-overlay" role="dialog" aria-label="Search Nexus actors and topics">
                    <div className="nexus-search-bar">
                        <span className="search-icon" aria-hidden="true">⌕</span>
                        <input autoFocus aria-label="Search nodes, actors, and topics" placeholder="Search nodes, actors, topics... (Esc to close)"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }} />
                        <button className="search-close" aria-label="Close Nexus search" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
                    </div>
                    {searchQuery.length > 1 && (
                        <div className="search-results">
                            {searchResults.slice(0, 8).map(n => (
                                <button key={n.id} className="search-result-item" onClick={() => { navigateToNode(n); setSearchOpen(false); setSearchQuery(''); }}>
                                    <span className="search-dot" style={{ background: n.color }} />
                                    <span className="search-name">{n.name}</span>
                                    <span className="search-cat">{n.isAnchor ? (ACTOR_TYPE_LABELS[n.type] || '') : (n.category || '')}</span>
                                </button>
                            ))}
                            {searchResults.length === 0 && <div className="search-empty">No matches found</div>}
                        </div>
                    )}
                </div>
            )}
            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="nexus-bar">
                <div className="nexus-title">
                    <span className="nexus-pulse-orb" />
                    <span>3D RELATIONS NEXUS SHIELD</span>
                </div>
                <div className="nexus-lens-switch" role="group" aria-label="International relations theory lens">
                    <span className="nexus-lens-label">ACTIVE LENS:</span>
                    {Object.keys(theories).map(t => {
                        const active = selectedTheory === t;
                        const c = theories[t]?.color || '#00ff88';
                        return (
                            <button key={t} className="nexus-lens-btn" aria-pressed={active} onClick={() => onTheorySelect?.(t)} style={{
                                background: active ? `${c}25` : 'transparent',
                                border: `1px solid ${active ? c : 'rgba(255,255,255,0.15)'}`,
                                color: active ? c : '#a5b4bc', borderRadius: '4px', cursor: 'pointer',
                                transition: 'all 0.2s', textShadow: active ? `0 0 6px ${c}` : 'none',
                            }}>{t.toUpperCase()}</button>
                        );
                    })}
                </div>
            </div>

            {/* ── Canvas ──────────────────────────────────────────────────── */}
            <div className="nexus-canvas-wrapper" role="region" tabIndex="0" aria-label="Interactive 3D relationship map. Use arrow keys to move between a selected actor's connections.">
                <ForceGraph3D
                    ref={attachGraphRef}
                    graphData={displayData}
                    onEngineTick={() => { graphReadyRef.current = true; }}
                    backgroundColor="#000000"
                    showNavInfo={false}
                    nodeVal={n => n.val}
                    nodeColor={n => {
                        if (highlightSet) return highlightSet.has(n.id) ? n.color : 'rgba(100,100,100,0.35)';
                        return n.color;
                    }}
                    nodeThreeObject={buildNodeObject}
                    nodeLabel={node => formatNexusNodeTooltip(node, graphData.links)}
                    linkLabel={formatNexusLinkTooltip}
                    onLinkClick={handleLinkClick}
                    linkColor={lnk => {
                        const s = typeof lnk.source === 'object' ? lnk.source.id : lnk.source;
                        const t = typeof lnk.target === 'object' ? lnk.target.id : lnk.target;
                        const focused = selectedNode ? isLinkFocused(lnk) : true;
                        const gpcOk = (selectedGPC && GPC_NODE_MAP[selectedGPC])
                            ? (new Set(GPC_NODE_MAP[selectedGPC]).has(s) || new Set(GPC_NODE_MAP[selectedGPC]).has(t))
                            : true;
                        if (selectedNode && selectedGPC) {
                            return (focused && gpcOk) ? lnk.color : 'rgba(80,80,80,0.06)';
                        }
                        if (selectedNode) return focused ? lnk.color : 'rgba(80,80,80,0.12)';
                        if (selectedGPC) return gpcOk ? lnk.color : 'rgba(80,80,80,0.06)';
                        return lnk.color;
                    }}
                    linkWidth={lnk => {
                        if (selectedNode && selectedGPC) {
                            const s2 = typeof lnk.source === 'object' ? lnk.source.id : lnk.source;
                            const t2 = typeof lnk.target === 'object' ? lnk.target.id : lnk.target;
                            const gpcSet2 = new Set(GPC_NODE_MAP[selectedGPC]);
                            if (isLinkFocused(lnk) && (gpcSet2.has(s2) || gpcSet2.has(t2))) return lnk.width * 4;
                            return 0.1;
                        }
                        if (selectedNode) return isLinkFocused(lnk) ? lnk.width * 4 : 0.15;
                        return (lnk.width || 0.5) * 2.5;
                    }}
                    linkDirectionalParticles={lnk => {
                        if (selectedNode) return isLinkFocused(lnk) ? (lnk.particles || 0) : 0;
                        return lnk.particles || 0;
                    }}
                    linkDirectionalParticleSpeed={() => 0.008}
                    linkDirectionalParticleWidth={lnk => lnk.width * 1.5}
                    linkDirectionalParticleColor={lnk => lnk.color}
                    onNodeClick={(node, event) => handleNodeClick(node, Boolean(event?.shiftKey))}
                    onNodeHover={node => setHoveredNode(node || null)}
                    onBackgroundClick={handleBackgroundClick}
                    enableNodeDrag={true}
                    enableNavigationControls={true}
                    linkHoverPrecision={8}
                    controlType="orbit"
                />

                {/* ── Hover Preview Card ─────────────────────────────── */}
                {hoveredNode && !selectedNode && (
                    <div className="nexus-hover-card">
                        <div className="hover-card-header">
                            <span className="hover-card-dot" style={{ background: hoveredNode.color }} />
                            <span className="hover-card-name">{hoveredNode.name}</span>
                        </div>
                        <div className="hover-card-type">{hoveredNode.isAnchor ? (ACTOR_TYPE_LABELS[hoveredNode.type] || '') : (hoveredNode.category || '')}</div>
                        {hoveredNode.desc && <div className="hover-card-desc">{(hoveredNode.desc || '').slice(0, 120)}{(hoveredNode.desc || '').length > 120 ? '…' : ''}</div>}
                        {hoveredNode.players && <div className="hover-card-players">🎯 {hoveredNode.players}</div>}
                        <div className="hover-card-cta">Click to inspect →</div>
                    </div>
                )}

                <NexusHudControls
                    nodeCount={graphData.nodes.length}
                    edgeCount={graphData.links.length}
                    onResetCamera={resetCamera}
                    lockedNode={lockedNode}
                    onUnlock={() => {
                        setLockedNode(null);
                        setCompareNode(null);
                        reheatGraphWhenReady(graphReadyRef, fgRef);
                    }}
                    selectedNode={selectedNode}
                    hudTab={hudTab}
                    onSelectHudTab={setHudTab}
                    dimensions={dimensions}
                    onToggleDimension={key => setDimensions(d => ({ ...d, [key]: !d[key] }))}
                    selectedGPC={selectedGPC}
                    onSelectGPC={setSelectedGPC}
                    pulseSignals={pulseSignals}
                    gdeltArticles={gdeltArticles}
                    showSatellites={showSatellites}
                    onToggleSatellites={() => setShowSatellites(prev => !prev)}
                    intensityThreshold={intensityThreshold}
                    onIntensityChange={setIntensityThreshold}
                    physicsPreset={physicsPreset}
                    onSelectPhysicsPreset={setPhysicsPreset}
                    is2D={is2D}
                    onSetIs2D={setIs2D}
                    ambientOn={ambientOn}
                    onSetAmbientOn={setAmbientOn}
                    audioMuted={audioMuted}
                    onSetAudioMuted={setAudioMuted}
                    audioVolume={audioVolume}
                    onSetAudioVolume={setAudioVolume}
                    expandedAnchors={expandedAnchors}
                    anchorSatCounts={anchorSatCounts}
                    onToggleAnchorExpand={toggleAnchorExpand}
                    onExpandAll={expandAll}
                    onCollapseAll={collapseAll}
                    onSelectQuickActor={actorId => {
                        const node = graphData.nodes.find(n => n.id === actorId);
                        if (node) {
                            navigateToNode(node);
                            setSelectedNode(node);
                            NexusAudio.soundNodeClick();
                        }
                    }}
                />

                <NexusInspectorPanel
                    selectedEdge={selectedEdge}
                    selectedNode={selectedNode}
                    lockedNode={lockedNode}
                    selectedGPC={selectedGPC}
                    inspectTab={inspectTab}
                    onSelectInspectTab={setInspectTab}
                    onCloseEdge={() => setSelectedEdge(null)}
                    onCloseNode={() => {
                        setSelectedNode(null);
                        setLockedNode(null);
                        setCompareNode(null);
                        setInspectTab('overview');
                    }}
                    onToggleLock={toggleLock}
                    onReturnToLockedNode={() => {
                        setSelectedNode(lockedNode);
                        setInspectTab('overview');
                    }}
                    onJumpToNodeById={nodeId => {
                        const n = graphData.nodes.find(node => node.id === nodeId);
                        if (n) {
                            navigateToNode(n);
                            setSelectedNode(n);
                            setSelectedEdge(null);
                        }
                    }}
                    onNavigateToNode={navigateToNode}
                    nodeBadges={nodeBadges}
                    connectionSummary={connectionSummary}
                    radarMetrics={radarMetrics}
                    theories={theories}
                    selectedTheory={selectedTheory}
                />
            </div>
        </div>
    );
}

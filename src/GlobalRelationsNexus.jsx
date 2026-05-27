import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import ForceGraph3D from 'react-force-graph-3d';
import * as THREE from 'three';
import { getGlobalChallenges, CHALLENGE_ICONS } from './eventAnalysis';
import './GlobalRelationsNexus.css';
import * as NexusAudio from './nexusAudio';
import { getEdgeInfo, getEdgeLabel } from './nexusEdgeData';
import { generateNodeNarrative, generateEdgeNarrative } from './nexusNarrative';
import { fetchGlobalPulse } from './nexusGDELT';

// ── Primary Geopolitical Anchors ──────────────────────────────────────────────
const PRIMARY_ANCHORS = {
    USA:          { id: 'USA',          name: 'United States',                          type: 'state',    color: '#3399ff', size: 14 },
    China:        { id: 'China',        name: 'China',                                  type: 'state',    color: '#ff4d4d', size: 14 },
    Russia:       { id: 'Russia',       name: 'Russia',                                 type: 'state',    color: '#8d6e63', size: 11 },
    Europe:       { id: 'Europe',       name: 'European Union & UK',                    type: 'bloc',     color: '#00ccff', size: 12 },
    MiddleEast:   { id: 'MiddleEast',   name: 'Middle East Hub',                        type: 'bloc',     color: '#ff9900', size: 10 },
    Africa:       { id: 'Africa',       name: 'African Union Zone',                     type: 'bloc',     color: '#66ff00', size: 8  },
    AsiaPacific:  { id: 'AsiaPacific',  name: 'Asia-Pacific Core',                      type: 'bloc',     color: '#ff00ff', size: 9  },
    LatinAmerica: { id: 'LatinAmerica', name: 'Latin America Triangle',                 type: 'bloc',     color: '#ffcc00', size: 8  },
    NATO:         { id: 'NATO',         name: 'NATO Alliance',                          type: 'igo',      color: '#3f51b5', size: 11 },
    UN_OPEC:      { id: 'UN_OPEC',      name: 'Global Institutions (UN/OPEC/WTO)',      type: 'igo',      color: '#e0f7fa', size: 12 },
    BiotechHub:   { id: 'BiotechHub',   name: 'Global Pharma MNCs (Lilly/Novo/Amgen)',  type: 'mnc',      color: '#00ff88', size: 12 },
    TechAIHub:    { id: 'TechAIHub',    name: 'Tech & Silicon MNCs (Nvidia/TSMC/ASML)', type: 'mnc',      color: '#00ffff', size: 12 },
    MilitantPMC:  { id: 'MilitantPMC',  name: 'PMCs & Militias (Wagner/RSF)',             type: 'nonstate', color: '#ff3d00', size: 10 },
    Jihadist:     { id: 'Jihadist',     name: 'Jihadist Networks (ISIS/AQ/Boko Haram)',    type: 'nonstate', color: '#cc0000', size: 9  },
    Cartels:      { id: 'Cartels',      name: 'Transnational Cartels (Sinaloa/CJNG)',      type: 'nonstate', color: '#ff6f00', size: 8  },
    CyberActors:  { id: 'CyberActors',  name: 'State-Backed Cyber Groups (APT28/Lazarus)', type: 'nonstate', color: '#9c27b0', size: 8  },
    Hezbollah:    { id: 'Hezbollah',    name: 'Hezbollah / Iran Proxies (Houthis)',        type: 'nonstate', color: '#d50000', size: 8  },
};

const ANCHOR_DESCS = {
    USA:          'Global maritime superpower; focus on relative power containment, high-tech supply chains, and liberal institutional alliances.',
    China:        'East Asian economic powerhouse; focused on infrastructure diplomacy (BRI), trade connectivity, and raw mineral acquisition.',
    Russia:       'Eurasian revisionist power; leverages energy resources, cyber-warfare capabilities, and private military networks.',
    Europe:       'Regulatory and economic bloc; emphasizes multilateral treaties, trade integration, and green transition.',
    MiddleEast:   'Energy corridor and diplomatic hub; balances multi-aligned ties with USA, China, and regional security concerns.',
    Africa:       'Demographic frontier; regional resource development, gold corridors, and infrastructure investments.',
    AsiaPacific:  'Indo-Pacific technology and security zone; crucial for global semiconductor fabrication and trade flows.',
    LatinAmerica: 'Emerging lithium and agricultural corridor; balances trade diplomacy between Western and Eastern powerhouses.',
    NATO:         'North Atlantic military alliance; coordinates collective security, deterrence, and high-intensity defense posture.',
    UN_OPEC:      'Multilateral system managing international law, global energy supply controls, and trade dispute arbitrations.',
    BiotechHub:   'Transnational pharmaceutical giants dictating global metabolic healthcare pipelines and pharmaceutical distribution networks.',
    TechAIHub:    'Strategic high-tech corporate entities controlling semiconductor foundries, advanced photolithography, and AI hardware platforms.',
    MilitantPMC:  'Private military contractors and paramilitary forces: Wagner Group in Africa/Syria, Sudan RSF, Sahel juntas — state-adjacent but deniable.',
    Jihadist:     'Transnational jihadist networks: ISIS remnants in Syria/Sahel, Al-Qaeda affiliates (JNIM, Al-Shabaab), Boko Haram in Lake Chad Basin.',
    Cartels:      'Mexican and Latin American drug cartels controlling fentanyl/cocaine supply chains: Sinaloa Cartel, CJNG — destabilizing states from Colombia to the US border.',
    CyberActors:  'State-sponsored cyber warfare groups: Russia\'s APT28/Sandworm, China\'s APT41, North Korea\'s Lazarus Group, Iran\'s Charming Kitten — operating in the grey zone.',
    Hezbollah:    'Iran\'s proxy network: Hezbollah in Lebanon, Houthis in Yemen, PMF in Iraq — the "Axis of Resistance" reshaping Middle East power dynamics.',
};

const ACTOR_TYPE_LABELS = {
    state:    'NATION-STATE (SOVEREIGN)',
    bloc:     'REGIONAL BLOCK / ALLIANCE',
    igo:      'INTERGOVERNMENTAL ORGANIZATION (IGO)',
    mnc:      'MULTINATIONAL CORPORATION (MNC)',
    nonstate: 'ASYMMETRIC NON-STATE ACTOR / PMC',
};

const DIM_COLORS = {
    trade:     '#00ccff',
    conflict:  '#ff0066',
    diplomacy: '#00ff88',
    tech:      '#bf55ec',
};

// ── Assign a forecast to a primary anchor ─────────────────────────────────────
const assignPrimaryAnchor = (forecast) => {
    const allText = [
        forecast['Key Player/Organization'],
        forecast['Entity/Subject'],
        forecast['Topic/Sector'],
        forecast.Broad_Category,
    ].join(' ').toLowerCase();

    if (/wagner|rsf|paramilitary|militia|mercenary|pmc/.test(allText)) return 'MilitantPMC';
    if (/isis|isil|islamic.state|al.qaeda|boko.haram|jihadist|al.shabaab|jnim|aqim/.test(allText)) return 'Jihadist';
    if (/cartel|sinaloa|cjng|fentanyl|narco|drug.trafficking|el.chapo/.test(allText)) return 'Cartels';
    if (/cyber|apt28|apt41|lazarus|sandworm|hack|ransomware|charming.kitten/.test(allText)) return 'CyberActors';
    if (/hezbollah|houthi|axis.of.resistance|iran.proxy|pmf|popular.mobilization/.test(allText)) return 'Hezbollah';
    if (/insurgent|rebel|terrorist|guerrilla/.test(allText)) return 'MilitantPMC';
    if (/\bnato\b|north atlantic treaty/.test(allText)) return 'NATO';
    if (/united nations|\bun\b|\bopec\b|\bwto\b|\bwho\b|world health|world bank|\bimf\b|multilateral/.test(allText)) return 'UN_OPEC';
    if (/novo nordisk|wegovy|semaglutide|eli lilly|amgen|retatrutide|cagrisema|maritide|bimagrumab|pharma|pharmaceuticals/.test(allText)) return 'BiotechHub';
    if (/semiconductor|asml|nvidia|\bai\b|tsmc|microchip|quantum computing|technology/.test(allText)) return 'TechAIHub';
    if (/trump|america|united states|\bus\b/.test(allText)) return 'USA';
    if (/china|chinese|beijing/.test(allText)) return 'China';
    if (/russia|russian|moscow|putin/.test(allText)) return 'Russia';
    if (/\beu\b|european|\buk\b|britain|germany|france/.test(allText)) return 'Europe';
    if (/sudan|egypt|africa|african/.test(allText)) return 'Africa';
    if (/saudi|\buae\b|middle east|iran/.test(allText)) return 'MiddleEast';
    if (/brazil|latin|mexico|south america/.test(allText)) return 'LatinAmerica';
    if (/japan|india|korea|australia|pacific/.test(allText)) return 'AsiaPacific';
    return 'USA';
};

// ── Helper: safe link id accessors ────────────────────────────────────────────
const linkId = (end) => (typeof end === 'object' && end !== null) ? (end.id || '') : (end || '');

// ══════════════════════════════════════════════════════════════════════════════



export default function GlobalRelationsNexus({ forecasts, selectedTheory, theories, onTheorySelect }) {
    const fgRef = useRef();

    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedGPC, setSelectedGPC]             = useState(null);
    const [physicsPreset, setPhysicsPreset]          = useState('balance');
    const [selectedNode, setSelectedNode]            = useState(null);
    const [lockedNode, setLockedNode]                = useState(null);
    const [hoveredNode, setHoveredNode]              = useState(null);
    const [inspectTab, setInspectTab]                = useState('overview');
    // Search
    const [searchOpen, setSearchOpen]                = useState(false);
    const [searchQuery, setSearchQuery]              = useState('');
    // Case Study Presets
    const [activeCaseStudy, setActiveCaseStudy]      = useState(null);
    // Live Data Pulse
    const [pulseSignals, setPulseSignals]             = useState([]);
    // Comparative Mode
    const [compareNode, setCompareNode]              = useState(null);
    // Edge Detail
    const [selectedEdge, setSelectedEdge]            = useState(null);
    // Audio
    const [audioMuted, setAudioMuted]                = useState(false);
    const [audioVolume, setAudioVolume]              = useState(0.3);
    // Mini-map
    const miniMapRef = useRef(null);
    // 2D mode
    const [is2D, setIs2D] = useState(false);
    // Collapsible HUD sections
    const [hudSections, setHudSections] = useState({
        filters: true, gpc: false, physics: false, clusters: false,
        graphCtrl: true, view: true, actors: true, audio: false,
    });
    const toggleSection = useCallback((key) => {
        setHudSections(prev => ({ ...prev, [key]: !prev[key] }));
    }, []);
    // Graph clarity controls
    const [showSatellites, setShowSatellites] = useState(false);
    const [intensityThreshold, setIntensityThreshold] = useState(0);
    const [introComplete, setIntroComplete] = useState(false);
    // Context menu
    const [contextMenu, setContextMenu] = useState(null);
    // Double-click tracking
    const lastClickRef = useRef({ nodeId: null, time: 0 });
    const [dimensions, setDimensions] = useState({ trade: true, conflict: true, diplomacy: true, tech: true });
    const [expandedAnchors, setExpandedAnchors] = useState({
        USA: false, China: false, Russia: false, Europe: false,
        MiddleEast: false, Africa: false, AsiaPacific: false, LatinAmerica: false,
        NATO: false, UN_OPEC: false, BiotechHub: false, TechAIHub: false, MilitantPMC: false, Jihadist: false, Cartels: false, CyberActors: false, Hezbollah: false,
    });

    const toggleAnchorExpand = useCallback((id) => {
        setExpandedAnchors(prev => ({ ...prev, [id]: !prev[id] }));
    }, []);

    const expandAll = useCallback(() => {
        setExpandedAnchors(prev => Object.fromEntries(Object.keys(prev).map(k => [k, true])));
    }, []);

    const collapseAll = useCallback(() => {
        setExpandedAnchors(prev => Object.fromEntries(Object.keys(prev).map(k => [k, false])));
        setSelectedNode(null);
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

    // ── Case Study preset logic ────────────────────────────────────────────────
    const CASE_STUDIES = useMemo(() => [
        { id: 'semiconductor', title: '🔬 Semiconductor Supply Chain', color: '#bf55ec',
          nodes: ['TechAIHub','AsiaPacific','USA','Europe','China','LatinAmerica'],
          dims: ['tech','trade','conflict'],
          context: 'TSMC, ASML, Nvidia — the chokepoints controlling who can build advanced chips. US export controls vs China\'s self-sufficiency push.' },
        { id: 'sudan', title: '⚔ Sudan Conflict Network', color: '#ff0066',
          nodes: ['MilitantPMC','Africa','Russia','UN_OPEC','MiddleEast'],
          dims: ['conflict','diplomacy'],
          context: 'The RSF vs SAF civil war, Wagner mercenaries, 12M displaced, Gulf proxy competition, and multilateral paralysis.' },
        { id: 'us-china', title: '🐉 US-China Strategic Competition', color: '#ff9900',
          nodes: ['USA','China','AsiaPacific','TechAIHub','NATO','Europe','Russia'],
          dims: ['conflict','trade','diplomacy','tech'],
          context: 'The defining great power rivalry: Indo-Pacific theatre, tech decoupling, alliance architecture, and the Taiwan question.' },
        { id: 'energy', title: '⚡ Energy Geopolitics', color: '#ff6600',
          nodes: ['MiddleEast','UN_OPEC','Russia','Europe','Africa','China'],
          dims: ['trade','conflict','diplomacy'],
          context: 'OPEC+ production politics, Russia\'s energy weapon, Europe\'s transition, and Africa\'s resource frontier.' },
        { id: 'health', title: '🏥 Global Health Pipeline', color: '#00ff88',
          nodes: ['BiotechHub','USA','Europe','AsiaPacific','Africa','UN_OPEC'],
          dims: ['trade','tech','diplomacy'],
          context: 'GLP-1 drug wars, vaccine equity, TRIPS waivers, generic manufacturing in India, and pharma lobby power.' },
        { id: 'bri', title: '🏗 Belt & Road Initiative', color: '#ffcc00',
          nodes: ['China','Africa','LatinAmerica','AsiaPacific','Europe','MiddleEast'],
          dims: ['trade','diplomacy','tech'],
          context: 'China\'s $1T infrastructure diplomacy: debt traps, port acquisitions, digital silk road, and Western counter-offers (B3W/PGII).' },
        { id: 'minerals', title: '⛏ Critical Minerals Race', color: '#66ff00',
          nodes: ['Africa','LatinAmerica','China','TechAIHub','USA','Europe'],
          dims: ['trade','tech'],
          context: 'Lithium triangle, Congo cobalt, rare earths, supply chain reshoring — who controls the materials of the energy transition?' },
        { id: 'africa', title: '🌍 Africa\'s Strategic Scramble', color: '#66ff00',
          nodes: ['Africa','China','Russia','MilitantPMC','Europe','USA','UN_OPEC'],
          dims: ['conflict','trade','diplomacy','tech'],
          context: 'Sahel coups, Wagner expansion, critical minerals, EU migration deals, and competing infrastructure investments.' },
    ], []);

    // Case study highlight set — overrides normal highlightSet when active
    const caseStudySet = useMemo(() => {
        if (!activeCaseStudy) return null;
        const cs = CASE_STUDIES.find(c => c.id === activeCaseStudy);
        if (!cs) return null;
        return new Set(cs.nodes);
    }, [activeCaseStudy, CASE_STUDIES]);

    const activeCaseData = useMemo(() => {
        if (!activeCaseStudy) return null;
        return CASE_STUDIES.find(c => c.id === activeCaseStudy) || null;
    }, [activeCaseStudy, CASE_STUDIES]);


    // ── Highlighted (first-degree) set — uses lockedNode when locked ─────────
    const focusNode = lockedNode || selectedNode;
    const highlightSet = useMemo(() => {
        // Case study mode overrides when no specific node is selected
        if (!focusNode && caseStudySet) return caseStudySet;
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
    }, [focusNode, selectedNode, compareNode, caseStudySet, graphData]);

    // ── Filtered graph data for display ─────────────────────────────────────
    const displayData = useMemo(() => {
        let nodes = graphData.nodes;
        let links = graphData.links;

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
        fg.d3Force('link').distance(lnk => {
            if (physicsPreset === 'core')     return lnk.type === 'satellite' ? 20 : 75;
            if (physicsPreset === 'friction') return lnk.type === 'conflict' ? 260 : 160;
            NexusAudio.soundTheorySwitch();
            if (selectedTheory === 'Marxism') {
                // Vertical split: Global North up, Global South down
                fg.d3Force('y', d => {
                    if (!d.isAnchor) return;
                    const north = ['USA','Europe','Russia','NATO'].includes(d.id);
                    return north ? -80 : 80;
                });
            } else if (selectedTheory === 'Postcolonialism') {
                // Push former colonial powers to periphery
                fg.d3Force('x', d => {
                    if (!d.isAnchor) return;
                    const peripheral = ['USA','Europe'].includes(d.id);
                    return peripheral ? (d.id === 'USA' ? -200 : 200) : 0;
                });
            } else if (selectedTheory === 'Feminism') {
                fg.d3Force('x', null);
                fg.d3Force('y', null);
            } else {
                fg.d3Force('x', null);
                fg.d3Force('y', null);
            }
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
        fg.d3ReheatSimulation();
    }, [selectedTheory, physicsPreset, graphData]);

    // ── Click handler ─────────────────────────────────────────────────────────
    const handleNodeClick = useCallback((node) => {
        setContextMenu(null);
        // Double-click detection → auto-lock
        const now = Date.now();
        if (lastClickRef.current.nodeId === node.id && now - lastClickRef.current.time < 400) {
            // Double-click: lock the node
            setSelectedNode(node);
            setLockedNode(node);
            NexusAudio.soundLockEngage();
            navigateToNode(node);
            lastClickRef.current = { nodeId: null, time: 0 };
            return;
        }
        lastClickRef.current = { nodeId: node.id, time: now };

        setSelectedNode(prev => (prev && prev.id === node.id) ? null : node);
        setSelectedEdge(null);
        NexusAudio.soundNodeClick();
        // Comparative mode: Shift+click with locked node
        if (lockedNode && node.id !== lockedNode.id && window._lastClickShift) {
            setCompareNode(node);
            NexusAudio.soundCompareEngage();
        }
        // Auto-zoom on first click
        if (!lockedNode) navigateToNode(node);
        // Smooth camera orbit — zoom to comfortable distance (not too close)
        if (fgRef.current && node.x != null) {
            const dist = 220; // comfortable viewing distance
            const ratio = 1 + dist / Math.hypot(node.x, node.y, node.z);
            fgRef.current.cameraPosition(
                { x: node.x * ratio, y: node.y * ratio, z: node.z * ratio },
                node, // lookAt target
                1200  // transition ms
            );
        }
    }, []);

    // Background click — deselect node but keep lock
    const handleBackgroundClick = useCallback(() => {
        if (lockedNode) {
            // When locked, clicking background goes back to locked node
            setSelectedNode(lockedNode);
        } else {
            setSelectedNode(null);
        }
    }, [lockedNode]);

    // Navigate to a specific node (used by connection table)
    const navigateToNode = useCallback((nodeRef) => {
        if (!nodeRef) return;
        setSelectedNode(nodeRef);
        setSelectedEdge(null);
        setInspectTab('overview');
        NexusAudio.soundConnectionNav();
        if (fgRef.current && nodeRef.x != null) {
            const dist = 220;
            const ratio = 1 + dist / Math.hypot(nodeRef.x, nodeRef.y, nodeRef.z);
            fgRef.current.cameraPosition(
                { x: nodeRef.x * ratio, y: nodeRef.y * ratio, z: nodeRef.z * ratio },
                nodeRef, 1200
            );
        }
    }, []);

    // Double-click anchor to expand/collapse its satellites
    const handleNodeDblClick = useCallback((node) => {
        if (node.isAnchor) {
            toggleAnchorExpand(node.id);
        }
    }, [toggleAnchorExpand]);

    // Reset camera to default overview position
    const resetCamera = useCallback(() => {
        setSelectedNode(null);
        setLockedNode(null);
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
            if (fgRef.current) fgRef.current.d3ReheatSimulation();
            NexusAudio.soundLockRelease();
        } else if (selectedNode) {
            // Lock — freeze physics to stabilize the view
            setLockedNode(selectedNode);
            NexusAudio.soundLockEngage();
            if (fgRef.current) {
                fgRef.current.d3ReheatSimulation();
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

    // ── Radar metrics ─────────────────────────────────────────────────────────
    // ── Mini-map 2D projection ─────────────────────────────────────────────────
    useEffect(() => {
        const canvas = miniMapRef.current;
        if (!canvas) return;
        let animId;
        const draw = () => {
            const ctx = canvas.getContext('2d');
            if (!ctx) return;
            const W = 140, H = 140;
            ctx.fillStyle = 'rgba(0, 5, 15, 0.9)';
            ctx.fillRect(0, 0, W, H);
            // Draw nodes
            const nodes = graphData.nodes.filter(n => n.x !== undefined);
            if (nodes.length === 0) { animId = requestAnimationFrame(draw); return; }
            let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
            nodes.forEach(n => {
                if (n.x < minX) minX = n.x;
                if (n.x > maxX) maxX = n.x;
                if (n.y < minY) minY = n.y;
                if (n.y > maxY) maxY = n.y;
            });
            const rangeX = (maxX - minX) || 1, rangeY = (maxY - minY) || 1;
            const pad = 12;
            nodes.forEach(n => {
                const px = pad + ((n.x - minX) / rangeX) * (W - pad * 2);
                const py = pad + ((n.y - minY) / rangeY) * (H - pad * 2);
                const r = n.isAnchor ? 3 : 1.5;
                ctx.beginPath();
                ctx.arc(px, py, r, 0, Math.PI * 2);
                ctx.fillStyle = n.color || '#fff';
                ctx.globalAlpha = (highlightSet && !highlightSet.has(n.id)) ? 0.2 : 0.8;
                ctx.fill();
            });
            ctx.globalAlpha = 1;
            animId = requestAnimationFrame(draw);
        };
        animId = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animId);
    }, [graphData, highlightSet]);

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

    // ── Connection summary for selected node ────────────────────────────────
    const connectionSummary = useMemo(() => {
        if (!selectedNode) return [];
        const conns = [];
        const seen = new Set();
        graphData.links.forEach(lnk => {
            const sId = linkId(lnk.source), tId = linkId(lnk.target);
            let partnerId = null;
            if (sId === selectedNode.id) partnerId = tId;
            else if (tId === selectedNode.id) partnerId = sId;
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
    }, [selectedNode, graphData]);

    // ── Right-click context menu ──────────────────────────────────────────────
    const handleNodeRightClick = useCallback((node, event) => {
        event.preventDefault();
        setContextMenu({
            node,
            x: event.clientX,
            y: event.clientY,
        });
    }, []);

    const contextAction = useCallback((action, node) => {
        setContextMenu(null);
        switch (action) {
            case 'lock':
                setSelectedNode(node);
                setLockedNode(node);
                navigateToNode(node);
                NexusAudio.soundLockEngage();
                break;
            case 'unlock':
                setLockedNode(null);
                setCompareNode(null);
                if (fgRef.current) fgRef.current.d3ReheatSimulation();
                NexusAudio.soundLockRelease();
                break;
            case 'compare':
                if (lockedNode) {
                    setCompareNode(node);
                    NexusAudio.soundCompareEngage();
                }
                break;
            case 'focus':
                navigateToNode(node);
                setSelectedNode(node);
                NexusAudio.soundNodeClick();
                break;
            default: break;
        }
    }, [lockedNode, navigateToNode]);

    // ── Edge click handler ────────────────────────────────────────────────────
    const handleLinkClick = useCallback((link) => {
        setSelectedEdge(link);
        setSelectedNode(null);
        NexusAudio.soundEdgeClick();
    }, []);

    // ── Keyboard navigation ───────────────────────────────────────────────────
    useEffect(() => {
        const handler = (e) => {
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
            if (e.key === 'Escape' && activeCaseStudy) {
                setActiveCaseStudy(null);
                return;
            }
            if (e.key === 'Escape') {
                if (lockedNode) {
                    setLockedNode(null);
                    if (fgRef.current) fgRef.current.d3ReheatSimulation();
                } else {
                    setSelectedNode(null);
                }
                return;
            }
            // Tab cycling through inspect tabs
            if (selectedNode && e.key === 'Tab') {
                e.preventDefault();
                const tabs = ['overview', 'metrics', 'gpc', 'theory'];
                setInspectTab(prev => {
                    const idx = tabs.indexOf(prev);
                    return tabs[(idx + 1) % tabs.length];
                });
                return;
            }
            // Arrow up/down to cycle through connections
            if (selectedNode && connectionSummary.length > 0) {
                if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    // Navigate to next connection
                    const currIdx = connectionSummary.findIndex(c => c.id === selectedNode.id);
                    const nextIdx = currIdx < connectionSummary.length - 1 ? currIdx + 1 : 0;
                    navigateToNode(connectionSummary[nextIdx].nodeRef);
                } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
                    e.preventDefault();
                    const currIdx = connectionSummary.findIndex(c => c.id === selectedNode.id);
                    const prevIdx = currIdx > 0 ? currIdx - 1 : connectionSummary.length - 1;
                    navigateToNode(connectionSummary[prevIdx].nodeRef);
                }
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [selectedNode, lockedNode, connectionSummary, navigateToNode, searchOpen, activeCaseStudy]);

    // ── Narrative generation for selected node ──────────────────────────────
    const nodeNarrative = useMemo(() => {
        if (!selectedNode) return '';
        return generateNodeNarrative(selectedNode, connectionSummary, graphData.links, selectedTheory);
    }, [selectedNode, connectionSummary, graphData, selectedTheory]);


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

    // ── Create a text sprite for 3D labels ─────────────────────────────────────
    const makeTextSprite = useCallback((text, color) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const fontSize = 48;
        ctx.font = `bold ${fontSize}px Roboto Mono, monospace`;
        const w = ctx.measureText(text).width + 20;
        canvas.width = w;
        canvas.height = fontSize + 16;
        ctx.font = `bold ${fontSize}px Roboto Mono, monospace`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, w / 2, (fontSize + 16) / 2);
        const texture = new THREE.CanvasTexture(canvas);
        texture.needsUpdate = true;
        const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(w / 8, (fontSize + 16) / 8, 1);
        return sprite;
    }, []);

    // ── 3D node rendering ─────────────────────────────────────────────────────
    const buildNodeObject = useCallback((node) => {
        const group = new THREE.Group();
        const focused = !highlightSet || highlightSet.has(node.id);

        if (!node.isAnchor) {
            const g = new THREE.SphereGeometry(node.val / 2.2, 16, 16);
            const m = new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: focused ? 0.9 : 0.35 });
            group.add(new THREE.Mesh(g, m));
            return group;
        }

        group.userData = { anchorType: node.type };
        const op = focused ? 0.95 : 0.30;
        if (node.type === 'igo') {
            const g1 = new THREE.DodecahedronGeometry(node.val / 2.4);
            group.add(new THREE.Mesh(g1, new THREE.MeshPhongMaterial({ color: node.color, emissive: node.color, emissiveIntensity: 0.2, transparent: true, opacity: op, wireframe: true })));
            const g2 = new THREE.SphereGeometry(node.val / 4, 16, 16);
            group.add(new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.7 })));
        } else if (node.type === 'mnc') {
            const g1 = new THREE.BoxGeometry(node.val / 2, node.val / 2, node.val / 2);
            const m1 = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op, wireframe: true }));
            m1.rotation.set(Math.PI / 6, Math.PI / 6, 0);
            group.add(m1);
            const g2 = new THREE.BoxGeometry(node.val / 3.5, node.val / 3.5, node.val / 3.5);
            const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.8 }));
            m2.rotation.set(Math.PI / 6, Math.PI / 6, 0);
            group.add(m2);
        } else if (node.type === 'nonstate') {
            const g1 = new THREE.ConeGeometry(node.val / 1.8, node.val / 1.2, 3);
            const m1 = new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op, wireframe: true }));
            m1.rotation.x = Math.PI / 3;
            group.add(m1);
            const g2 = new THREE.ConeGeometry(node.val / 3, node.val / 2, 3);
            const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op * 0.8 }));
            m2.rotation.x = Math.PI / 3;
            group.add(m2);
        } else {
            const g1 = new THREE.SphereGeometry(node.val / 2.5, 32, 32);
            group.add(new THREE.Mesh(g1, new THREE.MeshBasicMaterial({ color: node.color, transparent: true, opacity: op })));
            const g2 = new THREE.RingGeometry(node.val / 1.5, node.val / 1.4, 64);
            const m2 = new THREE.Mesh(g2, new THREE.MeshBasicMaterial({ color: node.color, side: THREE.DoubleSide, transparent: true, opacity: focused ? 0.35 : 0.12 }));
            m2.rotation.x = Math.PI / 2;
            group.add(m2);
        }

        // Floating label for anchor nodes
        const shortName = node.name.length > 16 ? node.name.slice(0, 14) + '..' : node.name;
        const label = makeTextSprite(shortName, node.color);
        label.position.set(0, node.val / 1.5 + 3, 0);
        group.add(label);

        return group;
    }, [highlightSet, makeTextSprite]);

    // ── 2D mode: flatten z-coordinates ──────────────────────────────────────
    useEffect(() => {
        if (!fgRef.current) return;
        const fg = fgRef.current;
        if (is2D) {
            // Flatten all nodes to z=0
            graphData.nodes.forEach(n => { n.fz = 0; });
            fg.d3ReheatSimulation();
            // Top-down camera
            setTimeout(() => {
                fg.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 1000);
            }, 200);
        } else {
            // Restore 3D freedom
            graphData.nodes.forEach(n => { n.fz = undefined; });
            fg.d3ReheatSimulation();
        }
    }, [is2D, graphData]);

    // ── Animated intro sequence ───────────────────────────────────────────────
    useEffect(() => {
        if (introComplete) return;
        // Stagger node appearance
        const anchors = Object.keys(PRIMARY_ANCHORS);
        anchors.forEach((id, i) => {
            setTimeout(() => {
                const node = graphData.nodes.find(n => n.id === id);
                if (node) node.__visible = true;
            }, i * 150);
        });
        setTimeout(() => setIntroComplete(true), anchors.length * 150 + 500);
    }, [graphData, introComplete]);

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
        <div className="nexus-container">
            {/* ── Search Overlay ─────────────────────────────────── */}
            {searchOpen && (
                <div className="nexus-search-overlay">
                    <div className="nexus-search-bar">
                        <span className="search-icon">⌕</span>
                        <input autoFocus placeholder="Search nodes, actors, topics... (Esc to close)"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); } }} />
                        <button className="search-close" onClick={() => { setSearchOpen(false); setSearchQuery(''); }}>✕</button>
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
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#888', fontSize: '0.65rem', marginRight: '6px', letterSpacing: '1px' }}>ACTIVE LENS:</span>
                    {Object.keys(theories).map(t => {
                        const active = selectedTheory === t;
                        const c = theories[t]?.color || '#00ff88';
                        return (
                            <button key={t} onClick={() => onTheorySelect?.(t)} style={{
                                background: active ? `${c}25` : 'transparent',
                                border: `1px solid ${active ? c : 'rgba(255,255,255,0.15)'}`,
                                color: active ? c : '#888', padding: '2px 8px', borderRadius: '4px',
                                fontSize: '0.65rem', fontFamily: 'Roboto Mono, monospace', cursor: 'pointer',
                                transition: 'all 0.2s', textShadow: active ? `0 0 6px ${c}` : 'none', outline: 'none',
                            }}>{t.toUpperCase()}</button>
                        );
                    })}
                </div>
            </div>

            {/* ── Canvas ──────────────────────────────────────────────────── */}
            <div className="nexus-canvas-wrapper">
                <ForceGraph3D
                    ref={fgRef}
                    graphData={displayData}
                    backgroundColor="#000000"
                    showNavInfo={false}
                    nodeVal={n => n.val}
                    nodeColor={n => {
                        if (highlightSet) return highlightSet.has(n.id) ? n.color : 'rgba(100,100,100,0.35)';
                        return n.color;
                    }}
                    nodeThreeObject={buildNodeObject}
                    nodeLabel={node => {
                        if (!node) return '';
                        const conns = graphData.links.filter(l => {
                            const s = typeof l.source === 'object' ? l.source.id : l.source;
                            const t = typeof l.target === 'object' ? l.target.id : l.target;
                            return s === node.id || t === node.id;
                        }).length;
                        return '<div style="background:rgba(0,2,8,0.92);color:#fff;padding:8px 12px;border-radius:5px;font-family:monospace;font-size:11px;border-left:3px solid ' + (node.color || '#fff') + ';max-width:280px;backdrop-filter:blur(10px)">'
                            + '<strong style="color:' + (node.color || '#fff') + '">' + node.name + '</strong><br/>'
                            + '<span style="color:#888;font-size:9px">' + (node.isAnchor ? (node.type || '').toUpperCase() : (node.category || '')) + '</span><br/>'
                            + '<span style="color:#aaa">' + conns + ' connections</span>'
                            + (node.isAnchor ? '<br/><span style="color:#555;font-size:9px">Double-click to lock · Right-click for menu</span>' : '')
                            + '</div>';
                    }}
                    linkLabel={lnk => {
                        const sId = typeof lnk.source === 'object' ? lnk.source.id : lnk.source;
                        const tId = typeof lnk.target === 'object' ? lnk.target.id : lnk.target;
                        const sName = typeof lnk.source === 'object' ? lnk.source.name : sId;
                        const tName = typeof lnk.target === 'object' ? lnk.target.name : tId;
                        const dimColor = DIM_COLORS[lnk.type] || '#fff';
                        const dimLabel = (lnk.type || 'connection').toUpperCase();
                        const info = getEdgeInfo(sId, tId, lnk.type);
                        if (info) {
                            return `<div style="background:rgba(0,2,8,0.94);color:#fff;padding:10px 14px;border-radius:5px;font-family:'Roboto Mono',monospace;font-size:11px;max-width:360px;border-left:4px solid ${dimColor};backdrop-filter:blur(12px);box-shadow:0 8px 32px rgba(0,0,0,0.8)">
                                <div style="color:${dimColor};font-size:9px;letter-spacing:2px;margin-bottom:4px">${dimLabel}</div>
                                <strong style="font-size:13px">${info.label}</strong><br/>
                                <span style="color:#bbb;font-size:10px;line-height:1.5">${info.summary}</span>
                                <div style="margin-top:6px;display:flex;gap:4px;flex-wrap:wrap">${info.dataPoints.slice(0,3).map(dp => '<span style="font-size:9px;color:#aaa;background:rgba(0,255,255,0.06);padding:2px 6px;border-radius:2px;border:1px solid rgba(0,255,255,0.1)">' + dp + '</span>').join('')}</div>
                                <div style="margin-top:6px;font-size:9px;color:#666">Tension: <span style="color:${info.tension > 0.7 ? '#ff0066' : info.tension > 0.4 ? '#ff9900' : '#00ff88'}">${(info.tension * 100).toFixed(0)}%</span> · Click for full details</div>
                            </div>`;
                        }
                        return `<div style="background:rgba(0,2,8,0.92);color:#ccc;padding:8px 12px;border-radius:4px;font-family:'Roboto Mono',monospace;font-size:11px;border-left:3px solid ${dimColor};backdrop-filter:blur(10px)">
                            <span style="color:${dimColor};font-size:9px;letter-spacing:1.5px">${dimLabel}</span><br/>
                            <strong>${sName.split('(')[0].trim()}</strong> ⟷ <strong>${tName.split('(')[0].trim()}</strong><br/>
                            <span style="font-size:9px;color:#888">Click for details</span>
                        </div>`;
                    }}
                    onLinkClick={handleLinkClick}
                    linkColor={lnk => {
                        if (selectedNode) return isLinkFocused(lnk) ? lnk.color : 'rgba(80,80,80,0.12)';
                        return lnk.color;
                    }}
                    linkWidth={lnk => {
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
                    onNodeClick={(node, event) => { window._lastClickShift = event && event.shiftKey; handleNodeClick(node); }}
                    onNodeRightClick={handleNodeRightClick}
                    onNodeHover={node => setHoveredNode(node || null)}
                    onBackgroundClick={() => { handleBackgroundClick(); setContextMenu(null); }}
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

                {/* Telemetry + Controls */}
                <div className="nexus-telemetry">
                    <div>NODES: {graphData.nodes.length} · EDGES: {graphData.links.length}</div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '6px' }}>
                        <button onClick={resetCamera} className="nexus-ctrl-btn" title="Reset camera to overview">⟲ RESET VIEW</button>
                        {lockedNode && <button onClick={() => { setLockedNode(null); if (fgRef.current) fgRef.current.d3ReheatSimulation(); }} className="nexus-ctrl-btn" style={{ borderColor: '#ff9900', color: '#ff9900' }} title="Unlock current view">🔓 UNLOCK</button>}
                    </div>
                    <div className="nexus-hint">
                        {activeCaseStudy
                            ? '📋 CASE STUDY active · click actors below · Esc to clear'
                            : lockedNode
                                ? '🔒 LOCKED — Shift+click to compare · Esc to unlock · ←→ cycle'
                                : selectedNode
                                    ? '⬡ Esc: deselect · Ctrl+K: search · ←→: cycle'
                                    : '⬡ Click node to inspect · Ctrl+K to search · Lock to explore'}
                    </div>
                </div>

                {/* ── HUD Legend ──────────────────────────────────────────── */}
                <div className="nexus-hud-legend">
                    {/* ── Tabbed HUD ──────────────────────────── */}
                    <div className="hud-tabs">
                        <button className={`hud-tab ${hudTab === 'filters' ? 'active' : ''}`} onClick={() => setHudTab('filters')}>⬡ FILTERS</button>
                        <button className={`hud-tab ${hudTab === 'controls' ? 'active' : ''}`} onClick={() => setHudTab('controls')}>⚙ CONTROLS</button>
                        <button className={`hud-tab ${hudTab === 'actors' ? 'active' : ''}`} onClick={() => setHudTab('actors')}>◉ ACTORS</button>
                    </div>

                    <div className="hud-tab-panel">
                    {/* ── TAB: FILTERS ─────────────────────────── */}
                    {hudTab === 'filters' && <>
                        <div className="hud-header">DIMENSION FILTERS</div>
                        {Object.entries(DIM_COLORS).map(([dim, color]) => {
                            const labels = { trade: 'ECONOMY & TRADE', conflict: 'CONFLICT & FRICTION', diplomacy: 'DIPLOMACY & TREATIES', tech: 'TECH & MINERALS' };
                            return (
                                <label key={dim} className="dim-filter-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '4px 0', cursor: 'pointer', fontSize: '0.6rem' }}>
                                    <input type="checkbox" checked={activeDims.has(dim)} onChange={() => toggleDim(dim)}
                                        style={{ accentColor: color }} />
                                    <span style={{ color }}>{labels[dim] || dim.toUpperCase()}</span>
                                </label>
                            );
                        })}

                        <div className="hud-header" style={{ marginTop: '12px' }}>GPC CHALLENGES</div>
                        <div className="gpc-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '10px' }}>
                            {Object.entries(GPC_CHALLENGES || {}).map(([key, {name, icon}]) => {
                                const sel = activeGPCs.has(key);
                                return (
                                    <button key={key} onClick={() => toggleGPC(key)} style={{
                                        background: sel ? 'rgba(0,255,255,0.12)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${sel ? '#00ffff' : 'rgba(255,255,255,0.1)'}`,
                                        color: sel ? '#00ffff' : '#aaa', fontSize: '0.52rem',
                                        fontFamily: 'Roboto Mono, monospace', padding: '4px 2px', borderRadius: '4px',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', outline: 'none',
                                    }} title={`Focus on ${name}`}>{icon} {name.toUpperCase()}</button>
                                );
                            })}
                        </div>

                        {/* GDELT Live Feed */}
                        {pulseSignals.length > 0 && (
                            <div className="pulse-indicator">📡 LIVE: {pulseSignals.length} actors in news</div>
                        )}
                        {gdeltArticles.length > 0 && (
                            <div className="gdelt-feed">
                                <div className="section-label" style={{ marginTop: '6px', marginBottom: '4px' }}>LIVE INTEL</div>
                                {gdeltArticles.slice(0, 4).map((a, i) => (
                                    <a key={i} href={a.url} target="_blank" rel="noopener noreferrer" className="gdelt-item"
                                        style={{ borderLeftColor: a.tone < -2 ? '#ff0066' : a.tone > 2 ? '#00ff88' : '#888' }}>
                                        {a.title.slice(0, 80)}{a.title.length > 80 ? '…' : ''}
                                    </a>
                                ))}
                            </div>
                        )}
                    </>}

                    {/* ── TAB: CONTROLS ────────────────────────── */}
                    {hudTab === 'controls' && <>
                        <div className="hud-header">GRAPH CONTROLS</div>
                        <div className="graph-control-row">
                            <label className="ctrl-label">Satellites</label>
                            <button className={`ctrl-toggle ${showSatellites ? 'on' : ''}`}
                                onClick={() => setShowSatellites(prev => !prev)}>
                                {showSatellites ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        <div className="graph-control-row">
                            <label className="ctrl-label">Link Intensity</label>
                            <input type="range" min="0" max="3" step="0.2" value={intensityThreshold}
                                onChange={e => setIntensityThreshold(parseFloat(e.target.value))}
                                className="audio-slider" />
                            <span className="ctrl-value">{intensityThreshold > 0 ? '≥' + intensityThreshold.toFixed(1) : 'ALL'}</span>
                        </div>

                        <div className="hud-header" style={{ marginTop: '12px' }}>PHYSICS</div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
                            {[['balance','⚖️ BALANCE'],['friction','⚡ FRICTION'],['core','⬢ CORE-PERIPH.']].map(([id, label]) => {
                                const act = physicsPreset === id;
                                return (
                                    <button key={id} onClick={() => setPhysicsPreset(id)} style={{
                                        flex: 1, background: act ? 'rgba(0,255,136,0.15)' : 'rgba(255,255,255,0.02)',
                                        border: `1px solid ${act ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                                        color: act ? '#00ff88' : '#888', fontSize: '0.55rem',
                                        fontFamily: 'Roboto Mono, monospace', padding: '4px 0', borderRadius: '4px',
                                        cursor: 'pointer', textAlign: 'center', transition: 'all 0.15s', outline: 'none',
                                    }}>{label}</button>
                                );
                            })}
                        </div>

                        <div className="hud-header" style={{ marginTop: '12px' }}>VIEW MODE</div>
                        <div className="view-toggle">
                            <button className={`view-toggle-btn ${!is2D ? 'active' : ''}`}
                                onClick={() => setIs2D(false)}>◈ 3D</button>
                            <button className={`view-toggle-btn ${is2D ? 'active' : ''}`}
                                onClick={() => setIs2D(true)}>◻ 2D</button>
                        </div>
                        <div className="view-mode-label">
                            ACTIVE: {is2D ? '2D FLAT MAP' : '3D SPATIAL'}
                        </div>

                        <div className="hud-header" style={{ marginTop: '12px' }}>AUDIO</div>
                        <div className="graph-control-row" style={{ marginBottom: '6px' }}>
                            <label className="ctrl-label">Ambient Pad</label>
                            <button className={`ctrl-toggle ${ambientOn ? 'on' : ''}`}
                                onClick={() => {
                                    if (ambientOn) { NexusAudio.stopAmbient(); setAmbientOn(false); }
                                    else { NexusAudio.startAmbient(); setAmbientOn(true); }
                                }}>
                                {ambientOn ? 'ON' : 'OFF'}
                            </button>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button className="audio-mute-btn" onClick={() => { const m = NexusAudio.toggleMute(); setAudioMuted(m); }}
                                style={{ fontSize: '0.55rem', padding: '3px 8px' }}>
                                {audioMuted ? '🔇' : '🔊'}
                            </button>
                            <input type="range" min="0" max="1" step="0.05" value={audioVolume}
                                onChange={e => { const v = parseFloat(e.target.value); setAudioVolume(v); NexusAudio.setVolume(v); }}
                                className="audio-slider" style={{ flex: 1 }} />
                        </div>
                    </>}

                    {/* ── TAB: ACTORS ──────────────────────────── */}
                    {hudTab === 'actors' && <>
                        <div className="hud-header">ACTOR CLUSTERS</div>
                        <div style={{ display: 'flex', gap: '4px', marginBottom: '8px' }}>
                            <button onClick={expandAll} className="nexus-ctrl-btn" style={{ flex: 1, fontSize: '0.48rem' }}>▼ EXPAND ALL</button>
                            <button onClick={collapseAll} className="nexus-ctrl-btn" style={{ flex: 1, fontSize: '0.48rem' }}>▲ COLLAPSE ALL</button>
                        </div>
                        <div className="anchor-legend-list">
                            {Object.entries(PRIMARY_ANCHORS).map(([id, a]) => {
                                const isExp = expandedAnchors[id];
                                const count = anchorSatCounts[id] || 0;
                                return (
                                    <button key={id} className={`anchor-legend-item ${isExp ? 'expanded' : ''}`}
                                        onClick={() => toggleAnchorExpand(id)}
                                        style={{ '--anchor-color': a.color }}>
                                        <span className="anchor-dot" style={{ background: a.color }} />
                                        <span className="anchor-label">{a.name.length > 20 ? a.name.slice(0, 18) + '..' : a.name}</span>
                                        <span className="anchor-count">{isExp ? '▾' : '▸'} {count}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <div className="hud-header" style={{ marginTop: '12px' }}>QUICK NAV</div>
                        <div className="actor-list">
                            {Object.values(PRIMARY_ANCHORS).map(a => (
                                <button key={a.id} className="actor-list-item"
                                    style={{ borderLeftColor: a.color, color: (selectedNode && selectedNode.id === a.id) ? '#fff' : '#999' }}
                                    onClick={() => {
                                        const node = graphData.nodes.find(n => n.id === a.id);
                                        if (node) { navigateToNode(node); setSelectedNode(node); NexusAudio.soundNodeClick(); }
                                    }}>
                                    {a.name.split('(')[0].trim()}
                                </button>
                            ))}
                        </div>
                    </>}
                    </div>
                </div>

                {/* ── Tabbed Inspect Panel ─────────────────────────────────── */}
                {selectedNode && (
                    <aside className="nexus-inspect-panel">
                        <div className="inspect-header-actions">
                            <button className={`lock-btn ${lockedNode ? 'locked' : ''}`}
                                onClick={toggleLock}
                                title={lockedNode ? 'Unlock view (Esc)' : 'Lock this node\'s connections'}>
                                {lockedNode ? '🔒 LOCKED' : '🔓 LOCK'}
                            </button>
                            <button className="inspect-close" onClick={() => { setSelectedNode(null); setLockedNode(null); setInspectTab('overview'); }}>✕</button>
                        </div>

                        {/* Breadcrumb when navigating within a lock */}
                        {lockedNode && selectedNode && lockedNode.id !== selectedNode.id && (
                            <div className="lock-breadcrumb">
                                <button className="breadcrumb-link" onClick={() => { setSelectedNode(lockedNode); setInspectTab('overview'); }}
                                    style={{ color: lockedNode.color }}>
                                    🔒 {lockedNode.name}
                                </button>
                                <span className="breadcrumb-arrow">→</span>
                                <span className="breadcrumb-current">{selectedNode.name}</span>
                            </div>
                        )}

                        {/* Header with badges */}
                        <div className="inspect-glow-header" style={{ borderBottom: `2px solid ${selectedNode.color}` }}>
                            <div className="inspect-cat">{selectedNode.isAnchor ? (ACTOR_TYPE_LABELS[selectedNode.type] || '') : (selectedNode.category || '').toUpperCase()}</div>
                            <h2 className="inspect-title">{selectedNode.name}</h2>
                            {/* At-a-Glance Badges */}
                            {nodeBadges.length > 0 && (
                                <div className="badge-row">
                                    {nodeBadges.map(b => (
                                        <span key={b.label} className="node-badge" style={{ borderColor: b.color, color: b.color }}>
                                            {b.icon} {b.label}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Tab Bar */}
                        <div className="inspect-tabs">
                            {[['overview','⬡ OVERVIEW'],['metrics','📊 METRICS'],['gpc','🌐 GPC'],['theory','⚛ THEORY']].map(([id, label]) => (
                                <button key={id} className={`inspect-tab ${inspectTab === id ? 'active' : ''}`}
                                    onClick={() => setInspectTab(id)}>{label}</button>
                            ))}
                        </div>

                        {/* ── Tab: Overview ──────────────────────────────── */}
                        {inspectTab === 'overview' && (
                            <div className="inspect-tab-content">
                                <div className="inspect-section">
                                    <div className="section-label">STRATEGIC IMPACT</div>
                                    <p className="section-body">{selectedNode.desc || 'No detailed impact projection available.'}</p>
                                </div>

                                {selectedNode.players && (
                                    <div className="inspect-section">
                                        <div className="section-label">KEY PLAYERS</div>
                                        <p className="section-body" style={{ color: '#00ff88', fontFamily: 'Roboto Mono' }}>{selectedNode.players}</p>
                                    </div>
                                )}
                                {selectedNode.timeline && (
                                    <div className="inspect-section">
                                        <div className="section-label">TIMELINE</div>
                                        <p className="section-body" style={{ color: '#00ccff', fontFamily: 'Roboto Mono' }}>{selectedNode.timeline}</p>
                                    </div>
                                )}

                                {/* Connection Summary Table */}
                                {connectionSummary.length > 0 && (
                                    <div className="inspect-section">
                                        <div className="section-label">NAVIGATE CONNECTIONS ({connectionSummary.length})</div>
                                        <div className="conn-nav-list">
                                            {connectionSummary.map((c, i) => (
                                                <button key={i} className="conn-nav-btn" onClick={() => navigateToNode(c.nodeRef)}
                                                    style={{ '--conn-color': c.color }}>
                                                    <span className="conn-nav-dot" style={{ background: c.color }} />
                                                    <span className="conn-nav-name">{c.name}</span>
                                                    <span className="conn-dim-pill" style={{ borderColor: c.color, color: c.color }}>{c.type.toUpperCase()}</span>
                                                    <span className="conn-nav-arrow">→</span>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Tab: Metrics ───────────────────────────────── */}
                        {inspectTab === 'metrics' && radarMetrics && (
                            <div className="inspect-tab-content">
                                <div className="inspect-section">
                                    <div className="section-label">SYSTEMIC RADAR METRICS</div>
                                    <div className="radar-grid">
                                        {[
                                            ['Sovereign Autonomy', radarMetrics.autonomy, '#3399ff', 50, 'Independence of action; ability to act unilaterally without external constraint'],
                                            ['Economic Penetration', radarMetrics.economicPenetration, '#00ccff', 45, 'Depth of involvement in global trade, investment, and financial networks'],
                                            ['Conflict Exposure', radarMetrics.conflictExposure, '#ff0066', 30, 'Proximity to active conflicts, military tensions, or asymmetric threats'],
                                            ['Resource Security', radarMetrics.resourceSecurity, '#bf55ec', 40, 'Control over or access to critical resources: energy, minerals, technology, pharma'],
                                            ['Diplomatic Centrality', radarMetrics.diplomaticCentrality, '#00ff88', 50, 'Degree of involvement in multilateral institutions, treaties, and alliances'],
                                        ].map(([label, val, color, avg]) => (
                                            <div key={label} className="radar-metric" style={{ marginBottom: '6px' }}>
                                                <div className="metric-title" style={{ fontSize: '0.62rem', color: '#aaa' }}>{label}</div>
                                                <div className="metric-bar-wrapper" style={{ position: 'relative', height: '10px', background: 'rgba(255,255,255,0.03)', borderRadius: '2px', border: '1px solid rgba(255,255,255,0.05)', overflow: 'visible' }}>
                                                    <div style={{ position: 'absolute', left: `${avg}%`, top: '-4px', bottom: '-4px', width: '1px', borderLeft: '1px dashed rgba(255,255,255,0.4)', zIndex: 2 }} title={`Global Avg: ${avg}%`} />
                                                    <div className="metric-bar" style={{ width: `${val}%`, background: `linear-gradient(90deg, ${color}88, ${color})`, height: '100%', borderRadius: '1px', boxShadow: `0 0 6px ${color}`, transition: 'width 0.5s ease' }} />
                                                </div>
                                                <div style={{ textAlign: 'right', display: 'flex', justifyContent: 'space-between', fontSize: '0.58rem', marginTop: '1px' }}>
                                                    <span style={{ color: '#666', fontSize: '0.45rem' }}>avg {avg}%</span>
                                                    <span style={{ color: '#fff', fontWeight: 700 }}>{val}%</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── Tab: GPC ───────────────────────────────────── */}
                        {inspectTab === 'gpc' && (
                            <div className="inspect-tab-content">
                                {!selectedNode.isAnchor && selectedNode.rawData ? (
                                    <div className="inspect-section">
                                        <div className="section-label">HL GLOBAL POLITICAL CHALLENGES</div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                                            {Object.entries(getGlobalChallenges(selectedNode.rawData)).map(([ch, txt]) => (
                                                <div key={ch} className="gpc-card">
                                                    <div className="gpc-card-header">
                                                        <span>{CHALLENGE_ICONS[ch] || '⬢'}</span><span>{ch.toUpperCase()}</span>
                                                    </div>
                                                    <p className="gpc-card-body">{txt}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="inspect-section">
                                        <p className="section-body" style={{ color: '#666', fontStyle: 'italic' }}>GPC analysis available for forecast nodes. Click a satellite node to view challenge mapping.</p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── Tab: Theory ────────────────────────────────── */}
                        {inspectTab === 'theory' && (
                            <div className="inspect-tab-content">
                                {theories[selectedTheory] ? (
                                    <div className="inspect-section theoretical-lens-box" style={{ borderLeft: `3px solid ${theories[selectedTheory].color}` }}>
                                        <div className="lens-header" style={{ color: theories[selectedTheory].color }}>
                                            <span>⚛ {selectedTheory.toUpperCase()} INTERPRETATION</span>
                                        </div>
                                        <p className="lens-text">
                                            {theories[selectedTheory].getInterpretation
                                                ? theories[selectedTheory].getInterpretation(selectedNode.rawData || {
                                                    'Entity/Subject': selectedNode.name,
                                                    'Key Player/Organization': selectedNode.players,
                                                    'Expected Impact/Value': selectedNode.desc,
                                                    Broad_Category: selectedNode.category,
                                                })
                                                : 'No lens translation available.'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="inspect-section">
                                        <p className="section-body" style={{ color: '#666' }}>Select an IR theory lens from the top bar to see interpretation.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </aside>
                )}
            </div>
        </div>
        
    );
}

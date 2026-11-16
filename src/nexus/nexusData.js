import { NEXUS_ACTORS } from '../nexusFocusData';

const ANCHOR_VISUAL_PROPS = {
    USA:          { type: 'state',    color: '#3399ff', size: 14, labelOverride: 'United States' },
    China:        { type: 'state',    color: '#ff4d4d', size: 14, labelOverride: 'China' },
    Russia:       { type: 'state',    color: '#8d6e63', size: 11, labelOverride: 'Russia' },
    Europe:       { type: 'bloc',     color: '#00ccff', size: 12, labelOverride: 'European Union & UK' },
    MiddleEast:   { type: 'bloc',     color: '#ff9900', size: 10, labelOverride: 'Middle East Hub' },
    Africa:       { type: 'bloc',     color: '#66ff00', size: 8,  labelOverride: 'African Union Zone' },
    AsiaPacific:  { type: 'bloc',     color: '#ff00ff', size: 9,  labelOverride: 'Asia-Pacific Core' },
    LatinAmerica: { type: 'bloc',     color: '#ffcc00', size: 8,  labelOverride: 'Latin America Triangle' },
    NATO:         { type: 'igo',      color: '#3f51b5', size: 11, labelOverride: 'NATO Alliance' },
    UN_OPEC:      { type: 'igo',      color: '#e0f7fa', size: 12, labelOverride: 'Global Institutions (UN/OPEC/WTO)' },
    BiotechHub:   { type: 'mnc',      color: '#00ff88', size: 12, labelOverride: 'Global Pharma MNCs (Lilly/Novo/Amgen)' },
    TechAIHub:    { type: 'mnc',      color: '#00ffff', size: 12, labelOverride: 'Tech & Silicon MNCs (Nvidia/TSMC/ASML)' },
    MilitantPMC:  { type: 'nonstate', color: '#ff3d00', size: 10, labelOverride: 'PMCs & Militias (Wagner/RSF)' },
    Jihadist:     { type: 'nonstate', color: '#cc0000', size: 9,  labelOverride: 'Jihadist Networks (ISIS/AQ/Boko Haram)' },
    Cartels:      { type: 'nonstate', color: '#ff6f00', size: 8,  labelOverride: 'Transnational Cartels (Sinaloa/CJNG)' },
    CyberActors:  { type: 'nonstate', color: '#9c27b0', size: 8,  labelOverride: 'State-Backed Cyber Groups (APT28/Lazarus)' },
    Hezbollah:    { type: 'nonstate', color: '#d50000', size: 8,  labelOverride: 'Hezbollah / Iran Proxies (Houthis)' },
};

// Derived directly from canonical NEXUS_ACTORS so Focus Nexus and 3D Nexus never drift on actor IDs.
export const PRIMARY_ANCHORS = Object.fromEntries(
    Object.entries(NEXUS_ACTORS).map(([id, actor]) => {
        const visual = ANCHOR_VISUAL_PROPS[id] || { type: 'bloc', color: actor.color, size: 9 };
        return [
            id,
            {
                id,
                name: visual.labelOverride || actor.name,
                shortName: actor.shortName,
                region: actor.region,
                type: visual.type,
                color: visual.color,
                size: visual.size,
            },
        ];
    })
);

export const ANCHOR_DESCS = {
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

export const ACTOR_TYPE_LABELS = {
    state:    'NATION-STATE (SOVEREIGN)',
    bloc:     'REGIONAL BLOCK / ALLIANCE',
    igo:      'INTERGOVERNMENTAL ORGANIZATION (IGO)',
    mnc:      'MULTINATIONAL CORPORATION (MNC)',
    nonstate: 'ASYMMETRIC NON-STATE ACTOR / PMC',
};

export const DIM_COLORS = {
    trade:     '#00ccff',
    conflict:  '#ff0066',
    diplomacy: '#00ff88',
    tech:      '#bf55ec',
};

export const GPC_NODE_MAP = {
    security:    ['USA', 'China', 'Russia', 'NATO', 'MiddleEast', 'Jihadist', 'Hezbollah', 'MilitantPMC', 'CyberActors'],
    borders:     ['Europe', 'MiddleEast', 'Africa', 'LatinAmerica', 'USA', 'Cartels'],
    identity:    ['MiddleEast', 'Europe', 'Russia', 'Africa', 'LatinAmerica', 'Jihadist'],
    technology:  ['USA', 'China', 'TechAIHub', 'CyberActors', 'Europe', 'AsiaPacific'],
    environment: ['China', 'USA', 'Europe', 'Africa', 'AsiaPacific', 'MiddleEast', 'UN_OPEC'],
    health:      ['UN_OPEC', 'Africa', 'LatinAmerica', 'AsiaPacific', 'BiotechHub'],
    poverty:     ['Africa', 'LatinAmerica', 'AsiaPacific', 'MiddleEast', 'UN_OPEC'],
    equality:    ['UN_OPEC', 'Europe', 'Africa', 'LatinAmerica', 'USA'],
};

export const GPC_CONTEXT = {
    security: {
        USA: { insight: 'Global military hegemon with 750+ overseas bases. NATO anchor, AUKUS, Quad alliances.', stakes: 'HIGH', connections: ['NATO', 'China', 'Russia', 'MiddleEast'] },
        China: { insight: 'Rapid military modernization, South China Sea island-building, Taiwan contingency.', stakes: 'CRITICAL', connections: ['USA', 'AsiaPacific', 'Russia'] },
        Russia: { insight: 'Nuclear arsenal, Wagner Group proxy operations, Arctic militarization.', stakes: 'CRITICAL', connections: ['NATO', 'USA', 'MiddleEast', 'Europe', 'MilitantPMC'] },
        NATO: { insight: 'Post-Ukraine expansion (Finland, Sweden). Eastern flank reinforcement.', stakes: 'HIGH', connections: ['USA', 'Europe', 'Russia'] },
        Europe: { insight: 'Re-arming post-Ukraine. Franco-German defense integration challenges.', stakes: 'MEDIUM', connections: ['NATO', 'Russia', 'MiddleEast'] },
        MiddleEast: { insight: 'Iran nuclear threshold, Israel-Gaza, Saudi-Iran detente fragility.', stakes: 'CRITICAL', connections: ['USA', 'Russia', 'Hezbollah', 'Jihadist'] },
    },
    borders: {
        USA: { insight: 'US-Mexico border crisis: 2.5M encounters/yr. Fentanyl trafficking, asylum policy.', stakes: 'CRITICAL', connections: ['LatinAmerica', 'Cartels', 'MiddleEast'] },
        Europe: { insight: 'Mediterranean migration, Belarus hybrid warfare, Schengen stress-testing.', stakes: 'HIGH', connections: ['Africa', 'MiddleEast', 'LatinAmerica'] },
        MiddleEast: { insight: 'Syrian refugee crisis, Iraqi displacement, Kurdish territorial disputes.', stakes: 'HIGH', connections: ['Europe', 'Africa', 'USA'] },
        Africa: { insight: 'Sahel instability, Lake Chad basin displacement, Libya transit corridor.', stakes: 'CRITICAL', connections: ['Europe', 'MiddleEast', 'LatinAmerica'] },
        LatinAmerica: { insight: 'Venezuelan exodus (7M+), Darien Gap corridor, Northern Triangle push factors.', stakes: 'CRITICAL', connections: ['USA', 'Cartels', 'Africa'] },
        Cartels: { insight: 'Sinaloa/CJNG control migration corridors, human smuggling revenue $13B/yr.', stakes: 'CRITICAL', connections: ['USA', 'LatinAmerica', 'MiddleEast'] },
    },
    technology: {
        USA: { insight: 'AI/chip dominance via Nvidia, TSMC leverage. CHIPS Act $52B reshoring.', stakes: 'CRITICAL', connections: ['China', 'TechAIHub', 'Europe'] },
        China: { insight: 'Self-sufficiency drive post-sanctions. Huawei breakthrough chips, DeepSeek AI.', stakes: 'CRITICAL', connections: ['USA', 'TechAIHub', 'AsiaPacific'] },
        TechAIHub: { insight: 'Big Tech ($3T+ market cap) as geopolitical actors. AI safety governance gap.', stakes: 'HIGH', connections: ['USA', 'China', 'Europe'] },
        Europe: { insight: 'EU AI Act regulatory leadership. Digital sovereignty vs US tech dependence.', stakes: 'MEDIUM', connections: ['USA', 'China', 'TechAIHub'] },
        CyberActors: { insight: 'State-backed APTs (Fancy Bear, Lazarus). Ransomware-as-a-service economy.', stakes: 'CRITICAL', connections: ['USA', 'China', 'Russia'] },
    },
    identity: {
        Europe: { insight: 'Far-right surge, anti-immigration populism, EU values vs sovereignty debate.', stakes: 'HIGH', connections: ['MiddleEast', 'Africa', 'Russia'] },
        MiddleEast: { insight: 'Sunni-Shia divide, pan-Arabism decline, Gulf modernization vs tradition.', stakes: 'CRITICAL', connections: ['Jihadist', 'Europe', 'Africa'] },
        Russia: { insight: 'Civilizational state narrative, Orthodox identity politics, anti-Western ideology.', stakes: 'HIGH', connections: ['Europe', 'MiddleEast', 'USA'] },
        Africa: { insight: 'Post-colonial identity reclamation, ethnic federalism tensions, youth bulge.', stakes: 'HIGH', connections: ['Europe', 'MiddleEast', 'LatinAmerica'] },
    },
    environment: {
        China: { insight: 'Largest emitter (31% global CO2) but also largest renewable investor.', stakes: 'CRITICAL', connections: ['USA', 'Europe', 'Africa'] },
        USA: { insight: 'IRA $369B green investment vs fossil fuel lobbying. Paris re-engagement fragile.', stakes: 'HIGH', connections: ['China', 'Europe', 'MiddleEast'] },
        Europe: { insight: 'Green Deal leader, carbon border tax (CBAM), energy transition post-Russia gas.', stakes: 'HIGH', connections: ['China', 'USA', 'MiddleEast'] },
        Africa: { insight: 'Climate vulnerability disproportionate. Critical minerals for green transition.', stakes: 'CRITICAL', connections: ['China', 'Europe', 'USA'] },
        MiddleEast: { insight: 'Petro-state transition pressure. UAE/Saudi Vision diversification.', stakes: 'HIGH', connections: ['China', 'Europe', 'USA'] },
    },
    health: {
        UN_OPEC: { insight: 'WHO pandemic preparedness reform. Vaccine equity gaps persist.', stakes: 'HIGH', connections: ['Africa', 'AsiaPacific', 'BiotechHub'] },
        Africa: { insight: 'Lowest vaccine coverage globally. Disease surveillance infrastructure gaps.', stakes: 'CRITICAL', connections: ['UN_OPEC', 'BiotechHub', 'China'] },
        BiotechHub: { insight: 'mRNA platform potential vs IP barriers. $1.5T global pharma market.', stakes: 'HIGH', connections: ['UN_OPEC', 'USA', 'Africa'] },
    },
    poverty: {
        Africa: { insight: '60% of extreme poor by 2030. Debt distress in 22 countries.', stakes: 'CRITICAL', connections: ['UN_OPEC', 'China', 'Europe'] },
        LatinAmerica: { insight: 'Inequality highest region globally. Informal economy 50%+ workforce.', stakes: 'HIGH', connections: ['USA', 'UN_OPEC', 'China'] },
        AsiaPacific: { insight: 'Dramatic poverty reduction but 350M+ still in extreme poverty.', stakes: 'MEDIUM', connections: ['China', 'UN_OPEC', 'USA'] },
    },
    equality: {
        UN_OPEC: { insight: 'SDG5 gender equality stalled. LGBTQ+ rights divergence globally.', stakes: 'HIGH', connections: ['Europe', 'Africa', 'USA'] },
        Europe: { insight: 'Gender pay gap narrowing. Anti-discrimination framework strongest globally.', stakes: 'MEDIUM', connections: ['UN_OPEC', 'USA', 'Africa'] },
        Africa: { insight: 'Child marriage, FGM prevalence. Women in parliament rising (Rwanda 61%).', stakes: 'HIGH', connections: ['UN_OPEC', 'Europe', 'LatinAmerica'] },
    },
};

export const assignPrimaryAnchor = (forecast) => {
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

export const linkId = (end) => (typeof end === 'object' && end !== null) ? (end.id || '') : (end || '');

export function computeCameraFocusPosition(node, viewDistance = 220) {
    const x = Number(node?.x) || 0;
    const y = Number(node?.y) || 0;
    const z = Number(node?.z) || 0;
    const norm = Math.hypot(x, y, z);
    if (norm < 1e-6) {
        return { x: 0, y: 0, z: viewDistance };
    }
    const ratio = 1 + viewDistance / norm;
    return {
        x: x * ratio,
        y: y * ratio,
        z: z * ratio,
    };
}

export function stepNeighborIndex(neighbors, currentSelectedId, lastCursorIndex = -1, direction = 1) {
    if (!Array.isArray(neighbors) || neighbors.length === 0) return -1;
    const matchedIdx = neighbors.findIndex(item => item.id === currentSelectedId);
    const baseIdx = matchedIdx >= 0 ? matchedIdx : lastCursorIndex;
    if (direction >= 0) {
        return baseIdx >= 0 && baseIdx < neighbors.length - 1 ? baseIdx + 1 : 0;
    }
    return baseIdx > 0 ? baseIdx - 1 : neighbors.length - 1;
}

/**
 * Lightweight d3-force-3d compatible 1D positioning force so GlobalRelationsNexus.jsx
 * does not rely on an undeclared transitive package import.
 */
export function createAxisForce(axis, targetFn, strengthFn) {
    let nodes = [];
    const velKey = `v${axis}`;
    const force = (alpha = 1) => {
        for (let i = 0; i < nodes.length; i += 1) {
            const node = nodes[i];
            const strength = Number(strengthFn(node)) || 0;
            if (strength !== 0) {
                const target = Number(targetFn(node)) || 0;
                const current = Number(node[axis]) || 0;
                node[velKey] = (Number(node[velKey]) || 0) + (target - current) * strength * alpha;
            }
        }
    };
    force.initialize = (initNodes) => {
        nodes = Array.isArray(initNodes) ? initNodes : [];
    };
    return force;
}

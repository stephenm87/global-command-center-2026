import { EDGE_DESCRIPTIONS } from './nexusEdgeData';
import { CASE_STUDIES_2026 } from './caseStudies2026';

export const NEXUS_ACTORS = {
    USA: { id: 'USA', name: 'United States', shortName: 'United States', type: 'State', region: 'North America', color: '#5eead4', description: 'A central security, technology, financial, and alliance actor whose decisions connect multiple regional systems.' },
    China: { id: 'China', name: 'China', shortName: 'China', type: 'State', region: 'Asia-Pacific', color: '#ff7b8d', description: 'A major economic and military power shaping trade, infrastructure, technology, and regional security.' },
    Russia: { id: 'Russia', name: 'Russia', shortName: 'Russia', type: 'State', region: 'Europe and Eurasia', color: '#c4a484', description: 'A nuclear power using energy, military force, diplomacy, cyber capabilities, and proxy networks to project influence.' },
    Europe: { id: 'Europe', name: 'European Union and United Kingdom', shortName: 'Europe', type: 'Regional bloc', region: 'Europe', color: '#67d5f5', description: 'A regulatory, trade, climate, and security bloc balancing transatlantic cooperation with strategic autonomy.' },
    MiddleEast: { id: 'MiddleEast', name: 'Middle East', shortName: 'Middle East', type: 'Regional system', region: 'Middle East', color: '#f7b955', description: 'An interconnected security and energy system shaped by state rivalry, proxy actors, shipping routes, and outside powers.' },
    Africa: { id: 'Africa', name: 'African regional system', shortName: 'Africa', type: 'Regional system', region: 'Africa', color: '#8fda66', description: 'A diverse regional system where governance, security, climate, resources, and external investment interact.' },
    AsiaPacific: { id: 'AsiaPacific', name: 'Asia-Pacific', shortName: 'Asia-Pacific', type: 'Regional system', region: 'Asia-Pacific', color: '#dc88ef', description: 'The central arena for maritime security, semiconductor production, competing alliances, and economic integration.' },
    LatinAmerica: { id: 'LatinAmerica', name: 'Latin America and Caribbean', shortName: 'Latin America', type: 'Regional system', region: 'Latin America and Caribbean', color: '#f4d35e', description: 'A region connecting migration, democratic governance, organized crime, critical minerals, food systems, and climate politics.' },
    NATO: { id: 'NATO', name: 'NATO', shortName: 'NATO', type: 'Alliance', region: 'Transatlantic', color: '#8495ff', description: 'A collective-defense alliance connecting North American and European security strategy.' },
    UN_OPEC: { id: 'UN_OPEC', name: 'Global institutions', shortName: 'UN / OPEC / WTO', type: 'Institution network', region: 'Global', color: '#c9f4f7', description: 'A grouped view of institutions that structure security, energy, trade, health, and diplomatic coordination.' },
    BiotechHub: { id: 'BiotechHub', name: 'Global health and biotech firms', shortName: 'Health & biotech', type: 'Industry network', region: 'Global', color: '#62e6a7', description: 'Pharmaceutical and biotechnology firms whose research, pricing, intellectual property, and supply chains affect global health.' },
    TechAIHub: { id: 'TechAIHub', name: 'Technology and AI firms', shortName: 'Tech & AI', type: 'Industry network', region: 'Global', color: '#62dfea', description: 'Semiconductor, cloud, and AI firms that increasingly function as geopolitical infrastructure providers.' },
    MilitantPMC: { id: 'MilitantPMC', name: 'Private military and militia networks', shortName: 'PMCs & militias', type: 'Non-state network', region: 'Transregional', color: '#ff835f', description: 'State-adjacent armed networks that provide deniable force, extract resources, and reshape local conflicts.' },
    Jihadist: { id: 'Jihadist', name: 'Transnational jihadist networks', shortName: 'Jihadist networks', type: 'Non-state network', region: 'Transregional', color: '#e55555', description: 'Armed networks operating across borders and exploiting weak governance, conflict, and local grievances.' },
    Cartels: { id: 'Cartels', name: 'Transnational organized-crime networks', shortName: 'Organized crime', type: 'Non-state network', region: 'Transregional', color: '#f39a4a', description: 'Criminal networks connecting drug production, trafficking, illicit finance, migration routes, and state corruption.' },
    CyberActors: { id: 'CyberActors', name: 'State-backed cyber actors', shortName: 'Cyber actors', type: 'Non-state network', region: 'Digital domain', color: '#b179d6', description: 'State-linked groups operating below the threshold of conventional conflict through espionage, disruption, and influence operations.' },
    Hezbollah: { id: 'Hezbollah', name: 'Iran-aligned armed networks', shortName: 'Iran-aligned networks', type: 'Non-state network', region: 'Middle East', color: '#df5a5a', description: 'A set of Iran-aligned armed and political organizations influencing conflicts and deterrence across the Middle East.' },
};

// Neutral baseline relationships fill gaps in the older annotated-edge file.
// They describe durable structures, while dated case records supply current
// evidence in the inspector and Guided Briefings.
const STRUCTURAL_RELATIONSHIPS = [
    { source: 'USA', target: 'AsiaPacific', dimensions: ['trade', 'diplomacy'], salience: .68, label: 'SUPPLY CHAINS & ALLIANCES', summary: 'Trade networks and security partnerships connect the United States to multiple Asia-Pacific economies.' },
    { source: 'China', target: 'AsiaPacific', dimensions: ['trade', 'conflict', 'tech'], salience: .78, label: 'REGIONAL POWER & INTERDEPENDENCE', summary: 'Regional trade, technology supply chains, and maritime-security disputes link China to the wider Asia-Pacific system.' },
    { source: 'UN_OPEC', target: 'AsiaPacific', dimensions: ['diplomacy'], salience: .48, label: 'REGIONAL GOVERNANCE', summary: 'Global and regional institutions provide forums for humanitarian coordination, trade rules, and dispute management.' },
    { source: 'MiddleEast', target: 'AsiaPacific', dimensions: ['trade'], salience: .46, label: 'ENERGY CORRIDOR', summary: 'Energy flows and shipping routes connect Middle Eastern producers with Asia-Pacific markets.' },
    { source: 'BiotechHub', target: 'AsiaPacific', dimensions: ['trade', 'tech'], salience: .44, label: 'HEALTH SUPPLY CHAINS', summary: 'Research, manufacturing, and medicine supply chains connect health and biotechnology firms across the region.' },
    { source: 'TechAIHub', target: 'AsiaPacific', dimensions: ['trade', 'tech'], salience: .72, label: 'TECHNOLOGY PRODUCTION NETWORK', summary: 'Semiconductor fabrication, electronics manufacturing, and digital infrastructure make the region central to global technology systems.' },
    { source: 'USA', target: 'LatinAmerica', dimensions: ['trade', 'diplomacy'], salience: .64, label: 'HEMISPHERIC INTERDEPENDENCE', summary: 'Trade, migration, finance, and diplomacy connect the United States with Latin America and the Caribbean.' },
    { source: 'China', target: 'LatinAmerica', dimensions: ['trade', 'diplomacy'], salience: .52, label: 'TRADE & INFRASTRUCTURE', summary: 'Commodity trade, infrastructure finance, and diplomatic ties connect China with the region.' },
    { source: 'TechAIHub', target: 'LatinAmerica', dimensions: ['trade', 'tech'], salience: .42, label: 'MINERALS & DIGITAL MARKETS', summary: 'Critical-mineral supply chains and growing digital markets connect the region with technology firms.' },
    { source: 'UN_OPEC', target: 'LatinAmerica', dimensions: ['diplomacy'], salience: .4, label: 'MULTILATERAL DISPUTE MANAGEMENT', summary: 'Courts, development institutions, and regional organizations shape dispute settlement and cooperation.' },
    { source: 'Europe', target: 'LatinAmerica', dimensions: ['trade', 'diplomacy'], salience: .38, label: 'INTERREGIONAL PARTNERSHIP', summary: 'Trade, climate policy, investment, and historical ties connect Europe with Latin America and the Caribbean.' },
    { source: 'UN_OPEC', target: 'USA', dimensions: ['diplomacy'], salience: .5, label: 'MULTILATERAL SYSTEM', summary: 'The United States participates in and contests institutions governing security, trade, finance, and public health.' },
    { source: 'UN_OPEC', target: 'Europe', dimensions: ['diplomacy'], salience: .54, label: 'MULTILATERAL SYSTEM', summary: 'European states and institutions are major participants in global rule-making and multilateral coordination.' },
    { source: 'UN_OPEC', target: 'Africa', dimensions: ['diplomacy'], salience: .52, label: 'MULTILATERAL COORDINATION', summary: 'Peace operations, humanitarian agencies, development finance, and regional institutions connect across African crises and policy agendas.' },
    { source: 'UN_OPEC', target: 'BiotechHub', dimensions: ['diplomacy', 'tech'], salience: .4, label: 'GLOBAL HEALTH GOVERNANCE', summary: 'Health institutions, intellectual-property rules, and procurement systems shape the reach of biotechnology and medicine.' },
    { source: 'MilitantPMC', target: 'MiddleEast', dimensions: ['conflict'], salience: .68, label: 'ARMED NETWORKS', summary: 'State-aligned and autonomous armed networks influence deterrence, local authority, and conflict escalation.' },
    { source: 'MilitantPMC', target: 'Russia', dimensions: ['conflict', 'trade'], salience: .58, label: 'STATE-ADJACENT FORCE', summary: 'Private and state-adjacent armed organizations have supported security influence and resource access.' },
    { source: 'MilitantPMC', target: 'Europe', dimensions: ['conflict'], salience: .44, label: 'SECURITY FRICTION', summary: 'Sanctions, accountability measures, and overseas operations connect armed networks to European security policy.' },
];

const ACTOR_KEYWORDS = {
    USA: /\bunited states\b|\bu\.s\.|\busa\b|washington|american|trump|biden/i,
    China: /\bchina\b|chinese|beijing|xi jinping/i,
    Russia: /\brussia\b|russian|moscow|kremlin|putin|wagner/i,
    Europe: /european union|\beu\b|united kingdom|\buk\b|britain|france|germany|brussels/i,
    MiddleEast: /middle east|israel|palestin|gaza|iran|iraq|syria|yemen|saudi|\buae\b|lebanon|houthi/i,
    Africa: /africa|sudan|sahel|congo|drc|ethiopia|somalia|nigeria|kenya|mozambique|mali|niger|burkina/i,
    AsiaPacific: /asia.?pacific|indo.?pacific|taiwan|philippines|japan|korea|myanmar|indonesia|vietnam|pacific island/i,
    LatinAmerica: /latin america|caribbean|haiti|mexico|brazil|colombia|venezuela|argentina|chile|ecuador|peru/i,
    NATO: /\bnato\b|north atlantic treaty/i,
    UN_OPEC: /united nations|\bun\b|\bwto\b|\bwho\b|\bopec\b|world bank|\bimf\b|multilateral/i,
    BiotechHub: /pharma|biotech|vaccine|medicine|drug resistance|antimicrobial|health technology/i,
    TechAIHub: /semiconductor|microchip|artificial intelligence|\bai\b|nvidia|tsmc|asml|cloud computing|digital governance/i,
    MilitantPMC: /private military|\bpmc\b|militia|paramilitary|wagner|africa corps|\brsf\b/i,
    Jihadist: /isis|islamic state|al.?qaeda|boko haram|al.?shabaab|jnim|jihadist/i,
    Cartels: /cartel|organized crime|fentanyl|drug traffick|sinaloa|cjng/i,
    CyberActors: /cyber|ransomware|hacker|digital surveillance|spyware|pegasus/i,
    Hezbollah: /hezbollah|houthi|axis of resistance|iran.?aligned|iranian proxy/i,
};

export const RELATIONSHIP_DIMENSIONS = {
    all: { label: 'All relationships', color: '#9fb2bc' },
    conflict: { label: 'Security', color: '#ff7b8d' },
    trade: { label: 'Trade and resources', color: '#67d5f5' },
    diplomacy: { label: 'Diplomacy', color: '#62e6a7' },
    tech: { label: 'Technology', color: '#c98bf0' },
};

export function getNexusRelationships() {
    const grouped = new Map();

    const addRelationship = ({ source, target, dimension, tension = 0, detail }) => {
        if (!NEXUS_ACTORS[source] || !NEXUS_ACTORS[target] || source === target) return;
        const pairKey = [source, target].sort().join('|');
        const existing = grouped.get(pairKey) || {
            id: pairKey,
            source,
            target,
            dimensions: [],
            tension: 0,
            details: [],
        };
        if (!existing.dimensions.includes(dimension)) existing.dimensions.push(dimension);
        existing.tension = Math.max(existing.tension, Number(tension) || 0);
        existing.details.push({ dimension, ...detail });
        grouped.set(pairKey, existing);
    };

    Object.entries(EDGE_DESCRIPTIONS).forEach(([key, detail]) => {
        const [source, target, dimension = 'diplomacy'] = key.split('|');
        addRelationship({ source, target, dimension, tension: detail.tension, detail: { ...detail, priority: 0 } });
    });

    STRUCTURAL_RELATIONSHIPS.forEach(relation => {
        relation.dimensions.forEach(dimension => addRelationship({
            source: relation.source,
            target: relation.target,
            dimension,
            tension: relation.salience,
            detail: { label: relation.label, summary: relation.summary, priority: 1, structural: true },
        }));
    });

    CASE_STUDIES_2026.forEach(caseStudy => {
        const [anchorId, ...connectedIds] = caseStudy.nexusNodeIds;
        const text = caseStudy.issueDimensions.join(' ').toLowerCase();
        const dimension = /trade|industrial|supply|mineral/.test(text)
            ? 'trade'
            : /conflict|security|sovereignty/.test(text)
                ? 'conflict'
                : /technology|digital/.test(text) ? 'tech' : 'diplomacy';

        connectedIds.forEach(target => addRelationship({
            source: anchorId,
            target,
            dimension,
            tension: .66,
            detail: {
                label: `CURRENT CASE · ${caseStudy.updatedAt}`,
                summary: caseStudy.statusSummary,
                priority: 2,
                caseStudyId: caseStudy.id,
                url: caseStudy.sources[0]?.url,
            },
        }));
    });

    return [...grouped.values()].map(relation => ({
        ...relation,
        details: relation.details.sort((a, b) => (b.priority || 0) - (a.priority || 0)),
    }));
}

export function inferForecastActorIds(forecast) {
    if (Array.isArray(forecast?.nexusActorIds)) {
        return forecast.nexusActorIds.filter(id => NEXUS_ACTORS[id]);
    }

    const text = [
        forecast?.['Topic/Sector'],
        forecast?.['Entity/Subject'],
        forecast?.['Key Player/Organization'],
        forecast?.['Expected Impact/Value'],
        forecast?.Broad_Category,
    ].filter(Boolean).join(' ');

    const matches = Object.entries(ACTOR_KEYWORDS)
        .filter(([, pattern]) => pattern.test(text))
        .map(([id]) => id);

    return matches;
}

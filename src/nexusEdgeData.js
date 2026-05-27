/**
 * nexusEdgeData.js — Rich descriptions and data points for key connections
 * Key format: "sourceId|targetId|dimension" or "sourceId|targetId" for general
 */

export const EDGE_DESCRIPTIONS = {
    // ═══ US-CHINA ═══
    'USA|China|trade':       { summary: '$690B bilateral trade, 301 tariffs since 2018, tech decoupling accelerating', label: 'TRADE WAR', dataPoints: ['$690B annual trade', '25-100% tariffs on $370B goods', 'De-risking replacing decoupling'], tension: 0.9, timeline: [
            { year: '2018', event: 'Section 301 tariffs imposed' },
            { year: '2020', event: 'Phase One trade deal signed' },
            { year: '2022', event: 'CHIPS Act passed ($52B)' },
            { year: '2023', event: 'De-risking replaces decoupling' },
            { year: '2024', event: '100% EV tariffs announced' },
        ] },
    'USA|China|conflict':    { summary: 'Strategic competition across Taiwan Strait, South China Sea, and cyber domains', label: 'STRATEGIC RIVALRY', dataPoints: ['Taiwan contingency planning', '7 military bases in Indo-Pacific', 'Annual $886B US defense budget'], tension: 0.95, timeline: [
            { year: '2018', event: 'Indo-Pacific Strategy released' },
            { year: '2021', event: 'AUKUS submarine pact' },
            { year: '2022', event: 'Pelosi Taiwan visit — PLA exercises' },
            { year: '2023', event: 'Spy balloon incident' },
            { year: '2024', event: 'Philippines confrontations escalate' },
        ] },
    'USA|China|tech':        { summary: 'Export controls on advanced chips, AI compute restrictions, entity list expansions', label: 'TECH DECOUPLING', dataPoints: ['CHIPS Act: $52B subsidy', 'A100/H100 export ban', 'ASML EUV equipment blocked'], tension: 0.85, timeline: [
            { year: '2019', event: 'Huawei entity list ban' },
            { year: '2022', event: 'A100/H100 export controls' },
            { year: '2023', event: 'Huawei Kirin 9000s surprise' },
            { year: '2024', event: 'ASML servicing restrictions' },
        ] },

    // ═══ US-RUSSIA ═══
    'USA|Russia|conflict':   { summary: 'Ukraine proxy war, nuclear posture tensions, NATO expansion friction', label: 'NEW COLD WAR', dataPoints: ['$175B+ US aid to Ukraine', 'INF Treaty collapsed 2019', 'Nuclear saber-rattling'], tension: 0.92, timeline: [
            { year: '2014', event: 'Crimea annexation — first sanctions' },
            { year: '2019', event: 'INF Treaty collapsed' },
            { year: '2022', event: 'Full-scale Ukraine invasion' },
            { year: '2023', event: 'Wagner mutiny' },
            { year: '2024', event: '$175B+ US aid to Ukraine' },
        ] },

    // ═══ US-EUROPE ═══
    'USA|Europe|trade':      { summary: 'Transatlantic trade partnership, LNG replacement of Russian gas, IRA subsidy disputes', label: 'ALLIED TRADE', dataPoints: ['$1.1T bilateral trade', 'US LNG exports tripled', 'IRA green subsidy friction'], tension: 0.3 },
    'USA|Europe|diplomacy':  { summary: 'NATO backbone, intelligence sharing (Five Eyes+), coordinated Russia sanctions', label: 'WESTERN ALLIANCE', dataPoints: ['NATO 32 members', '2% GDP defense target', 'AUKUS trilateral pact'], tension: 0.15 },
    'USA|Europe|tech':       { summary: 'AI regulation divergence, ASML export controls coordination, data privacy conflicts', label: 'TECH ALIGNMENT', dataPoints: ['EU AI Act vs US approach', 'ASML chokepoint', 'Privacy Shield invalidated'], tension: 0.4, timeline: [
            { year: '2013', event: 'Belt & Road Initiative launched' },
            { year: '2017', event: 'Djibouti military base opens' },
            { year: '2023', event: '$170B cumulative BRI investment' },
        ] },

    // ═══ CHINA-RUSSIA ═══
    'China|Russia|trade':    { summary: '"No limits" partnership: energy, arms, and UN voting coordination', label: 'AXIS OF CONVENIENCE', dataPoints: ['$240B bilateral trade', 'Power of Siberia pipeline', 'Yuan settlement growing'], tension: 0.2 },
    'China|Russia|diplomacy':{ summary: 'Joint military exercises, UN veto coordination, anti-Western institutional building', label: 'STRATEGIC ALIGNMENT', dataPoints: ['SCO/BRICS expansion', 'Joint naval drills', 'Parallel SWIFT alternatives'], tension: 0.15 },

    // ═══ CHINA-AFRICA ═══
    'China|Africa|trade':    { summary: 'Belt & Road infrastructure-for-resources: ports, railways, mines across 52 countries', label: 'BRI CORRIDOR', dataPoints: ['$170B BRI investment', 'Djibouti military base', '13,000km railways built'], tension: 0.4 },
    'China|Africa|tech':     { summary: 'Huawei 5G networks, digital surveillance exports, fiber-optic backbone construction', label: 'DIGITAL SILK ROAD', dataPoints: ['Huawei in 40+ African nations', 'Smart city surveillance', 'Undersea cables'], tension: 0.5 },

    // ═══ RUSSIA-AFRICA ═══
    'Russia|Africa|conflict':{ summary: 'Wagner Group operations: Mali, CAR, Burkina Faso, Libya — gold for guns', label: 'WAGNER FOOTPRINT', dataPoints: ['Wagner in 5+ African states', 'Gold mining concessions', 'Anti-French sentiment exploited'], tension: 0.7 },

    // ═══ MIDDLE EAST ═══
    'MiddleEast|USA|trade':  { summary: 'Petrodollar system, arms sales ($110B+), Abraham Accords normalization', label: 'OIL-SECURITY PACT', dataPoints: ['OPEC production decisions', '$110B Saudi arms deals', 'Abraham Accords 2020'], tension: 0.45 },
    'MiddleEast|Europe|trade':{ summary: 'Gas pipeline alternatives, sovereign wealth investment, migration routes', label: 'ENERGY BRIDGE', dataPoints: ['Qatar LNG contracts', 'Gulf SWF €200B+ in EU', 'Turkey migration deal'], tension: 0.4 },
    'MiddleEast|Russia|trade':{ summary: 'OPEC+ coordination, Syria alliance, competing gas supply to Europe', label: 'ENERGY CARTEL', dataPoints: ['OPEC+ production cuts', 'Russia in Syria since 2015', 'Competing pipeline routes'], tension: 0.5 },

    // ═══ HEZBOLLAH / IRAN PROXIES ═══
    'Hezbollah|MiddleEast|conflict': { summary: 'Iran\'s "Axis of Resistance": Lebanon, Yemen Houthis, Iraq PMF — reshaping regional power', label: 'AXIS OF RESISTANCE', dataPoints: ['150,000 Hezbollah rockets', 'Houthi Red Sea attacks', 'Iraq PMF integration'], tension: 0.9, timeline: [
            { year: '2014', event: 'Readiness Action Plan activated' },
            { year: '2022', event: 'NATO 2022 Strategic Concept' },
            { year: '2023', event: 'Finland joins NATO (31st member)' },
            { year: '2024', event: 'Sweden joins — 300K high-readiness force' },
        ] },
    'Hezbollah|USA|conflict':        { summary: 'US sanctions, CENTCOM operations, Beirut embassy bombing legacy', label: 'US CONTAINMENT', dataPoints: ['Treasury sanctions', 'CENTCOM deployments', 'Israeli proxy conflicts'], tension: 0.85, timeline: [
            { year: '2019', event: 'Fentanyl declared national emergency' },
            { year: '2023', event: '110K overdose deaths recorded' },
            { year: '2024', event: 'Cartel-as-terrorist designation debated' },
        ] },

    // ═══ JIHADIST ═══
    'Jihadist|Africa|conflict':      { summary: 'Sahel collapse: JNIM, Boko Haram, Al-Shabaab — 10,000+ annual fatalities', label: 'SAHEL INSURGENCY', dataPoints: ['JNIM controls Mali territory', 'Boko Haram 40K killed', 'Al-Shabaab in Somalia/Kenya'], tension: 0.95, timeline: [
            { year: '2014', event: 'Boko Haram Chibok kidnapping' },
            { year: '2020', event: 'JNIM expands across Sahel' },
            { year: '2023', event: 'Sahel coups — France withdraws' },
            { year: '2024', event: 'Al-Shabaab targets AU forces' },
        ] },
    'Jihadist|MiddleEast|conflict':  { summary: 'ISIS remnants in Syria/Iraq, ongoing insurgency, prison camp risks', label: 'ISIS REMNANTS', dataPoints: ['10,000 ISIS in Al-Hol camp', 'Sleeper cells active', 'Abu Bakr successor killed'], tension: 0.75 },
    'Jihadist|USA|conflict':         { summary: 'Global War on Terror legacy: drone strikes, SOF raids, intelligence operations', label: 'GWOT LEGACY', dataPoints: ['$8T spent since 2001', 'Drone program ongoing', 'CT partnerships in 85 countries'], tension: 0.6 },
    'Jihadist|Europe|conflict':      { summary: 'Domestic radicalization, returning fighters, online recruitment networks', label: 'HOMEGROWN THREAT', dataPoints: ['300+ EU attacks since 2015', 'Online radicalization', 'Deradicalization programs'], tension: 0.65 },

    // ═══ CARTELS ═══
    'Cartels|LatinAmerica|conflict': { summary: 'Territorial control of cocaine/fentanyl routes: 100,000+ annual homicides across region', label: 'NARCO STATES', dataPoints: ['CJNG in 35 countries', '100K+ homicides/year', 'State capture in Honduras/Guatemala'], tension: 0.9, timeline: [
            { year: '2006', event: 'Lebanon War — 33 days' },
            { year: '2015', event: 'Houthis seize Sanaa' },
            { year: '2023', event: 'Oct 7 — Hezbollah opens northern front' },
            { year: '2024', event: 'Houthi Red Sea shipping attacks' },
        ] },
    'Cartels|USA|conflict':          { summary: 'Fentanyl crisis: 110,000 US overdose deaths/year, border security escalation', label: 'FENTANYL CRISIS', dataPoints: ['110K OD deaths/year', '$53B DEA budget', 'Cartel-as-terrorist debate'], tension: 0.85, timeline: [
            { year: '2011', event: 'Nord Stream 1 operational' },
            { year: '2022', event: 'Russia cuts gas — EU scrambles' },
            { year: '2022', event: 'Nord Stream pipelines destroyed' },
            { year: '2023', event: 'EU Russian gas share drops to <15%' },
        ] },
    'Cartels|China|trade':           { summary: 'Chinese chemical precursors fuel fentanyl production in Mexican super-labs', label: 'PRECURSOR PIPELINE', dataPoints: ['Chinese precursor chemicals', 'WeChat-based transactions', 'Bilateral pressure agreements'], tension: 0.7 },

    // ═══ CYBER ═══
    'CyberActors|Russia|conflict':   { summary: 'APT28/Sandworm: election interference, critical infrastructure attacks, ransomware', label: 'HYBRID WARFARE', dataPoints: ['SolarWinds attack', 'Ukraine grid attacks', 'NotPetya $10B damage'], tension: 0.85, timeline: [
            { year: '2016', event: 'DNC hack — election interference' },
            { year: '2017', event: 'NotPetya — $10B global damage' },
            { year: '2020', event: 'SolarWinds supply chain attack' },
            { year: '2022', event: 'Ukraine grid cyberattacks' },
        ] },
    'CyberActors|China|conflict':    { summary: 'APT41: IP theft, military espionage, supply chain compromise at scale', label: 'CYBER ESPIONAGE', dataPoints: ['$600B IP theft annually', 'OPM hack 21.5M records', 'Volt Typhoon infrastructure'], tension: 0.8 },
    'CyberActors|USA|conflict':      { summary: 'Primary target for state-sponsored attacks: defense, energy, finance sectors', label: 'ATTACK SURFACE', dataPoints: ['CISA shields up alerts', '$10B+ cyber defense budget', 'Colonial Pipeline ransom'], tension: 0.8 },
    'CyberActors|NATO|conflict':     { summary: 'Cyber declared a domain of warfare by NATO; Article 5 applicability debated', label: 'FIFTH DOMAIN', dataPoints: ['Cyber as warfare domain', 'Tallinn Manual', 'Collective defense in cyber'], tension: 0.65 },

    // ═══ TECH CORRIDORS ═══
    'TechAIHub|AsiaPacific|tech':    { summary: 'TSMC foundries: 90% of advanced chips manufactured in Taiwan — single point of failure', label: 'CHIP CHOKEPOINT', dataPoints: ['TSMC 90% advanced chips', '$100B Arizona fab', 'Samsung 3nm competition'], tension: 0.7 },
    'TechAIHub|USA|tech':            { summary: 'Nvidia, Qualcomm, AMD design dominance — $500B+ market cap in AI hardware alone', label: 'AI HARDWARE HQ', dataPoints: ['Nvidia $2T+ market cap', 'CHIPS Act $52B', 'AI compute arms race'], tension: 0.3 },
    'TechAIHub|Europe|tech':         { summary: 'ASML monopoly on EUV lithography — the $380M machine no chip fab can exist without', label: 'ASML MONOPOLY', dataPoints: ['Only EUV supplier globally', '$380M per machine', 'Netherlands export controls'], tension: 0.4 },
    'TechAIHub|China|tech':          { summary: 'Huawei breakout attempts, SMIC progress, but 5-10 year gap persists without EUV access', label: 'CHIP BLOCKADE', dataPoints: ['Kirin 9000s surprise', 'SMIC 7nm workaround', 'EUV access denied'], tension: 0.8 },

    // ═══ NATO ═══
    'NATO|USA|diplomacy':    { summary: 'US provides 70% of NATO defense spending — burden-sharing debate intensifies', label: 'ALLIANCE BACKBONE', dataPoints: ['US 3.4% GDP defense', 'Only 11/32 at 2% target', 'Nuclear umbrella'], tension: 0.25 },
    'NATO|Europe|diplomacy': { summary: 'European pillar strengthening: Finland/Sweden accession, EU rapid deployment force', label: 'EUROPEAN DEFENSE', dataPoints: ['32 members after expansion', 'EU 5,000 rapid reaction', '€2B annual ammunition'], tension: 0.2 },
    'NATO|Russia|conflict':  { summary: 'Largest military buildup since Cold War: 300,000 troops on high readiness', label: 'FORWARD DEFENSE', dataPoints: ['300K high-readiness troops', 'Baltic tripwire forces', 'Finland 1,300km border'], tension: 0.9 },

    // ═══ BIOTECH ═══
    'BiotechHub|USA|tech':   { summary: 'US pharma R&D dominance: Eli Lilly, Amgen — GLP-1 drugs reshaping $100B obesity market', label: 'PHARMA R&D HUB', dataPoints: ['GLP-1 market $100B+', 'Eli Lilly Mounjaro', 'FDA fast-track approvals'], tension: 0.2 },
    'BiotechHub|Europe|tech':{ summary: 'Novo Nordisk Ozempic phenomenon — Denmark\'s GDP boosted by single drug class', label: 'OZEMPIC EFFECT', dataPoints: ['Novo Nordisk > Denmark GDP', 'Wegovy supply shortages', 'EU pricing negotiations'], tension: 0.3 },

    // ═══ ENERGY ═══
    'Russia|Europe|trade':   { summary: 'Post-Nord Stream energy divorce: EU cut Russian gas from 40% to <15% in 18 months', label: 'ENERGY DIVORCE', dataPoints: ['Nord Stream destroyed', 'Russian gas 40% → <15%', 'LNG terminals fast-tracked'], tension: 0.85 },

    // ═══ UN/OPEC ═══
    'UN_OPEC|MiddleEast|trade':     { summary: 'OPEC+ controls 40% of global oil: production cuts keeping prices at $80-90/barrel', label: 'OIL CARTEL', dataPoints: ['OPEC+ 40% global output', 'Voluntary cuts 2.2Mb/d', '$80-90 target price'], tension: 0.5 },
    'UN_OPEC|Africa|diplomacy':     { summary: 'UN peacekeeping (90K troops), AU partnerships, development agency coordination', label: 'PEACEKEEPING', dataPoints: ['90K UN peacekeepers', 'MONUSCO withdrawal', 'AU-UN coordination gaps'], tension: 0.4 },

    // ═══ PMC/WAGNER ═══
    'MilitantPMC|Africa|conflict':  { summary: 'Wagner/Africa Corps in Mali, CAR, Burkina Faso, Libya — gold mining for military services', label: 'MERCENARY BELT', dataPoints: ['5+ African deployments', 'Gold concessions', 'France pushed out of Sahel'], tension: 0.85 },
    'MilitantPMC|MiddleEast|conflict':{ summary: 'RSF in Sudan, PMCs in Libya — proxy warfare through deniable non-state forces', label: 'PROXY WARS', dataPoints: ['Sudan RSF 100K fighters', 'Libya civil war', 'UAE-backed operations'], tension: 0.8 },
    'MilitantPMC|Russia|conflict':  { summary: 'Wagner Group: Kremlin-linked PMC providing military force with strategic deniability', label: 'KREMLIN PROXY', dataPoints: ['Prigozhin mutiny 2023', 'Rebranded as Africa Corps', 'GRU coordination'], tension: 0.7 },
};

/**
 * Get edge description for a given link
 * @param {string} sourceId
 * @param {string} targetId
 * @param {string} type - dimension (trade/conflict/diplomacy/tech)
 * @returns {object|null}
 */
export function getEdgeInfo(sourceId, targetId, type) {
    // Try exact match both directions
    const key1 = `${sourceId}|${targetId}|${type}`;
    const key2 = `${targetId}|${sourceId}|${type}`;
    return EDGE_DESCRIPTIONS[key1] || EDGE_DESCRIPTIONS[key2] || null;
}

/**
 * Get the on-graph label for a link (short text visible on the connection)
 */
export function getEdgeLabel(sourceId, targetId, type) {
    const info = getEdgeInfo(sourceId, targetId, type);
    return info ? info.label : null;
}

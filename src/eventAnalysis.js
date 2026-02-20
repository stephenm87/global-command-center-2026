// eventAnalysis.js — Generates 5W1H analysis and Global Challenges from event data
// Parallels the GloPo Companion case library format

// Map Broad_Category → relevant IB HL Global Challenges
const CATEGORY_CHALLENGES = {
    'Geopolitics & Conflict': {
        Security: (event) => `This event directly relates to global security dynamics. ${event['Entity/Subject'] || 'The actors involved'} demonstrate how geopolitical tensions create security dilemmas—where one actor's defensive measures are perceived as offensive by others, potentially escalating conflict.`,
        Borders: (event) => `${event['Entity/Subject'] || 'This situation'} raises critical questions about territorial sovereignty and border integrity. In an interconnected world, ${event['Key Player/Organization'] || 'major powers'} must navigate the tension between national borders and transnational security threats.`,
        Identity: (event) => `The conflict involving ${event['Entity/Subject'] || 'these actors'} is deeply tied to questions of national and cultural identity. Competing narratives about who 'belongs' and who has legitimate claims shape both the causes and the potential resolution of this dispute.`
    },
    'Economy & Trade': {
        Poverty: (event) => `Economic developments around ${event['Entity/Subject'] || 'this issue'} have direct implications for global poverty. Trade policies and economic sanctions disproportionately impact developing nations, potentially deepening structural inequality in the international system.`,
        Equality: (event) => `${event['Entity/Subject'] || 'This economic shift'} highlights the fundamental inequality embedded in global economic governance. The question is: who benefits and who bears the costs of these changes? ${event['Key Player/Organization'] || 'Key actors'} play a decisive role in shaping outcomes.`,
        Environment: (event) => `Economic activity around ${event['Entity/Subject'] || 'this sector'} carries significant environmental implications. The tension between economic growth and environmental sustainability is a defining challenge of the 21st century.`
    },
    'Technology & Science': {
        Technology: (event) => `${event['Entity/Subject'] || 'This development'} is at the frontier of technological governance. Who controls emerging technology, who regulates it, and who benefits from it are central questions. ${event['Key Player/Organization'] || 'Key players'} are shaping norms that will define the digital order.`,
        Security: (event) => `Technological developments in ${event['Entity/Subject'] || 'this field'} have profound security implications. Cyber capabilities, AI, and surveillance technologies blur the line between civilian and military domains, creating new vectors for both state and non-state actors.`,
        Borders: (event) => `Digital technology fundamentally challenges traditional concepts of borders. ${event['Entity/Subject'] || 'This development'} shows how information, capital, and influence flow across borders in ways that traditional sovereignty frameworks struggle to regulate.`
    },
    'Health & Society': {
        Health: (event) => `${event['Entity/Subject'] || 'This health issue'} illustrates how global health governance intersects with sovereignty, equity, and power. Pandemic preparedness, vaccine distribution, and health infrastructure remain deeply unequal between the Global North and South.`,
        Poverty: (event) => `Health crises disproportionately affect those in poverty. ${event['Entity/Subject'] || 'This situation'} shows how structural inequality in healthcare access perpetuates cycles of deprivation, particularly in the Global South.`,
        Identity: (event) => `Health policies around ${event['Entity/Subject'] || 'this issue'} intersect with questions of cultural identity and human rights. Communities' responses to health interventions are shaped by historical experiences, trust in institutions, and cultural values.`
    },
    'Environment & Energy': {
        Environment: (event) => `${event['Entity/Subject'] || 'This environmental issue'} is a defining challenge of our era. Climate change and resource depletion do not respect borders, making this fundamentally a question of global governance and collective action.`,
        Security: (event) => `Environmental changes around ${event['Entity/Subject'] || 'this issue'} have direct security implications. Resource scarcity, climate-driven migration, and competition for energy sources are increasingly recognized as threats to national and human security.`,
        Poverty: (event) => `Environmental degradation disproportionately impacts the world's poorest communities. ${event['Entity/Subject'] || 'This development'} illustrates how environmental challenges and poverty are interlinked—those who contribute least to the problem often suffer the most.`
    },
    'Culture & Entertainment': {
        Identity: (event) => `${event['Entity/Subject'] || 'This cultural development'} reflects how globalization both homogenizes and fragments cultural identities. Soft power through culture shapes how nations are perceived and how citizens understand their place in the world.`,
        Technology: (event) => `Cultural production around ${event['Entity/Subject'] || 'this sphere'} is increasingly mediated by technology platforms. Who controls cultural narratives in a digital age is a question of power, identity, and sovereignty.`,
        Borders: (event) => `Cultural flows around ${event['Entity/Subject'] || 'this area'} transcend national borders, challenging state attempts to control information and cultural narratives. This raises questions about cultural sovereignty in a globalized world.`
    }
};

/**
 * Generate 5W1H analysis from event data fields
 * Extracts structured Who/What/When/Where/Why/How from the event's CSV/live fields
 */
export function generate5W1H(event) {
    if (!event) return null;

    const entity = event['Entity/Subject'] || 'Unknown entity';
    const players = event['Key Player/Organization'] || 'Various actors';
    const timeline = event.Timeline || 'Ongoing';
    const impact = event['Expected Impact/Value'] || '';
    const category = event.Broad_Category || '';
    const topic = event['Topic/Sector'] || '';

    return {
        who: `Primary actors: ${entity}. Key players: ${players}.`,
        what: `${topic}${impact ? '. ' + impact.substring(0, 200) : ''}`,
        where: event.Latitude && event.Longitude
            ? `Geolocation: ${parseFloat(event.Latitude).toFixed(1)}°, ${parseFloat(event.Longitude).toFixed(1)}° — ${entity}`
            : `Global/Regional — ${entity}`,
        when: timeline,
        why: generateWhy(category, entity, impact),
        how: generateHow(category, players, impact)
    };
}

function generateWhy(category, entity, impact) {
    const whyMap = {
        'Geopolitics & Conflict': `Strategic competition and security concerns drive this development. ${entity} is positioned at the intersection of power rivalries and territorial disputes, with regional stability at stake.`,
        'Economy & Trade': `Economic interests and trade dynamics underpin this event. Shifts in global supply chains, sanctions, or market forces are reshaping how states pursue economic security and competitive advantage.`,
        'Technology & Science': `Technological competition and innovation drive this development. Control over emerging technologies translates directly into geopolitical power, creating new frontiers of interstate competition.`,
        'Health & Society': `Public health and social welfare concerns are at the core of this issue. Global health governance gaps and social inequality create vulnerabilities that transcend national borders.`,
        'Environment & Energy': `Environmental pressures and energy transition dynamics are central to this development. Climate change and resource competition force states to balance short-term interests with long-term sustainability.`,
        'Culture & Entertainment': `Cultural influence and soft power dynamics drive this development. In an interconnected world, cultural narratives shape political outcomes and international relations.`
    };
    return whyMap[category] || `This development reflects deeper structural forces in the international system, involving ${entity}.`;
}

function generateHow(category, players, impact) {
    const howMap = {
        'Geopolitics & Conflict': `Through diplomatic maneuvering, military posturing, and alliance management. ${players} navigate between hard power (military, sanctions) and soft power (diplomacy, international law) approaches.`,
        'Economy & Trade': `Via trade agreements, sanctions, tariff policies, and institutional mechanisms (WTO, IMF, bilateral deals). ${players} leverage economic tools to advance strategic interests.`,
        'Technology & Science': `Through R&D investment, regulatory frameworks, export controls, and technological standard-setting. ${players} compete to define the norms and infrastructure of the digital age.`,
        'Health & Society': `Via international health governance (WHO), bilateral aid, vaccine diplomacy, and domestic policy responses. ${players} balance sovereignty with the need for coordinated global health action.`,
        'Environment & Energy': `Through multilateral agreements (Paris Accord), energy policy, carbon markets, and green technology development. ${players} must navigate the tension between economic growth and environmental protection.`,
        'Culture & Entertainment': `Through media platforms, cultural exports, narrative control, and public diplomacy. ${players} use soft power tools to shape international perceptions and influence.`
    };
    return howMap[category] || `${players} employ various mechanisms to advance interests in this domain.`;
}

/**
 * Get relevant IB HL Global Challenges for an event based on its category
 * Returns an object mapping challenge names to analysis text
 */
export function getGlobalChallenges(event) {
    if (!event) return {};
    const category = event.Broad_Category;
    const challengeGenerators = CATEGORY_CHALLENGES[category] || {};

    const result = {};
    Object.entries(challengeGenerators).forEach(([challenge, generator]) => {
        result[challenge] = generator(event);
    });
    return result;
}

// The 7 IB HL Global Challenges
export const CHALLENGE_ICONS = {
    Security: '🛡️',
    Borders: '🗺️',
    Identity: '🏛️',
    Technology: '💻',
    Environment: '🌍',
    Health: '🏥',
    Poverty: '📉',
    Equality: '⚖️'
};

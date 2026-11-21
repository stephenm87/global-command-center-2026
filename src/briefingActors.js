/**
 * Lightweight canonical actor metadata retained for Guided Briefings,
 * case-study validation, and legacy ?actor= deep-link normalization.
 */
export const BRIEFING_ACTORS = Object.freeze({
    USA: { id: 'USA', name: 'United States', shortName: 'United States', type: 'State', color: '#5eead4' },
    China: { id: 'China', name: 'China', shortName: 'China', type: 'State', color: '#ff7b8d' },
    Russia: { id: 'Russia', name: 'Russia', shortName: 'Russia', type: 'State', color: '#c4a484' },
    Europe: { id: 'Europe', name: 'European Union and United Kingdom', shortName: 'Europe', type: 'Regional bloc', color: '#67d5f5' },
    MiddleEast: { id: 'MiddleEast', name: 'Middle East', shortName: 'Middle East', type: 'Regional system', color: '#f7b955' },
    Africa: { id: 'Africa', name: 'African regional system', shortName: 'Africa', type: 'Regional system', color: '#8fda66' },
    AsiaPacific: { id: 'AsiaPacific', name: 'Asia-Pacific', shortName: 'Asia-Pacific', type: 'Regional system', color: '#dc88ef' },
    LatinAmerica: { id: 'LatinAmerica', name: 'Latin America and Caribbean', shortName: 'Latin America', type: 'Regional system', color: '#f4d35e' },
    NATO: { id: 'NATO', name: 'NATO', shortName: 'NATO', type: 'Alliance', color: '#8495ff' },
    UN_OPEC: { id: 'UN_OPEC', name: 'Global institutions', shortName: 'UN / OPEC / WTO', type: 'Institution network', color: '#c9f4f7' },
    BiotechHub: { id: 'BiotechHub', name: 'Global health and biotech firms', shortName: 'Health & biotech', type: 'Industry network', color: '#62e6a7' },
    TechAIHub: { id: 'TechAIHub', name: 'Technology and AI firms', shortName: 'Tech & AI', type: 'Industry network', color: '#62dfea' },
    MilitantPMC: { id: 'MilitantPMC', name: 'Private military and militia networks', shortName: 'PMCs & militias', type: 'Non-state network', color: '#ff835f' },
    Jihadist: { id: 'Jihadist', name: 'Transnational jihadist networks', shortName: 'Jihadist networks', type: 'Non-state network', color: '#e55555' },
    Cartels: { id: 'Cartels', name: 'Transnational organized-crime networks', shortName: 'Organized crime', type: 'Non-state network', color: '#f39a4a' },
    CyberActors: { id: 'CyberActors', name: 'State-backed cyber actors', shortName: 'Cyber actors', type: 'Non-state network', color: '#b179d6' },
    Hezbollah: { id: 'Hezbollah', name: 'Iran-aligned armed networks', shortName: 'Iran-aligned networks', type: 'Non-state network', color: '#df5a5a' },
});

export const CANONICAL_ACTOR_IDS = Object.freeze(Object.keys(BRIEFING_ACTORS));

const ACTOR_LOOKUP = new Map(
    CANONICAL_ACTOR_IDS.flatMap(id => [
        [id.toLowerCase(), id],
        [id.toLowerCase().replace(/[^a-z0-9]/g, ''), id],
    ])
);

export function resolveActorId(rawActorId, fallback = undefined) {
    if (typeof rawActorId !== 'string' || !rawActorId.trim()) return fallback;
    const normalized = rawActorId.trim().toLowerCase();
    return ACTOR_LOOKUP.get(normalized)
        || ACTOR_LOOKUP.get(normalized.replace(/[^a-z0-9]/g, ''))
        || fallback;
}

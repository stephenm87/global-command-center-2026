export const CANONICAL_ACTOR_IDS = Object.freeze([
    'USA',
    'China',
    'Russia',
    'Europe',
    'MiddleEast',
    'Africa',
    'AsiaPacific',
    'LatinAmerica',
    'NATO',
    'UN_OPEC',
    'BiotechHub',
    'TechAIHub',
    'MilitantPMC',
    'Jihadist',
    'Cartels',
    'CyberActors',
    'Hezbollah',
]);

const ACTOR_LOOKUP = new Map(
    CANONICAL_ACTOR_IDS.flatMap(id => [
        [id.toLowerCase(), id],
        [id.toLowerCase().replace(/[^a-z0-9]/g, ''), id],
    ])
);

export function resolveActorId(rawActorId, fallback = 'USA') {
    if (typeof rawActorId !== 'string' || !rawActorId.trim()) return fallback;
    const normalized = rawActorId.trim().toLowerCase();
    return ACTOR_LOOKUP.get(normalized)
        || ACTOR_LOOKUP.get(normalized.replace(/[^a-z0-9]/g, ''))
        || fallback;
}

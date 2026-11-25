export const CONTENT_REVIEW_DATE = '2026-08-10';

export const CANONICAL_REGIONS_7 = Object.freeze([
    'Africa',
    'Asia-Pacific',
    'Middle East & North Africa',
    'Europe & Eurasia',
    'Americas & Caribbean',
    'Pacific Islands',
    'Global / Transnational',
]);

export const ISSUE_LENSES_6 = Object.freeze([
    'Security & Diplomacy',
    'Governance & Rights',
    'Economy & Development',
    'Climate & Resources',
    'Technology & Information',
    'Health & Human Security',
]);

export const BROAD_CATEGORIES = Object.freeze([
    'Geopolitics & Conflict',
    'Governance & Rights',
    'Economy & Trade',
    'Environment & Energy',
    'Technology & Science',
    'Health & Society',
]);

export const ISSUE_LENS_TO_BROAD_CATEGORY = Object.freeze({
    'Security & Diplomacy': 'Geopolitics & Conflict',
    'Governance & Rights': 'Governance & Rights',
    'Economy & Development': 'Economy & Trade',
    'Climate & Resources': 'Environment & Energy',
    'Technology & Information': 'Technology & Science',
    'Health & Human Security': 'Health & Society',
});

export const BROAD_CATEGORY_TO_ISSUE_LENS = Object.freeze({
    'Geopolitics & Conflict': 'Security & Diplomacy',
    'Governance & Rights': 'Governance & Rights',
    'Economy & Trade': 'Economy & Development',
    'Environment & Energy': 'Climate & Resources',
    'Technology & Science': 'Technology & Information',
    'Health & Society': 'Health & Human Security',
});

const BROAD_CATEGORY_ALIASES = {
    'Technology & Innovation': 'Technology & Science',
    'Climate, Resources & Security': 'Environment & Energy',
    'Global Governance & Economics': 'Economy & Trade',
    'Technology & Economics': 'Economy & Trade',
};

export const COVERAGE_REGION_ALIASES = {
    'Sub-Saharan Africa': 'Africa',
    'Horn of Africa and Red Sea': 'Africa',
    'Southern Africa': 'Africa',
    'North Africa': 'Middle East & North Africa',
    'North Africa and Mediterranean': 'Middle East & North Africa',
    'Middle East': 'Middle East & North Africa',
    'Middle East and Red Sea': 'Middle East & North Africa',
    'Asia': 'Asia-Pacific',
    'South Asia': 'Asia-Pacific',
    'Central Asia': 'Asia-Pacific',
    'East Asia': 'Asia-Pacific',
    'Southeast Asia': 'Asia-Pacific',
    'Latin America': 'Americas & Caribbean',
    'Latin America & Caribbean': 'Americas & Caribbean',
    'Caribbean & Americas': 'Americas & Caribbean',
    'Amazon Basin & South America': 'Americas & Caribbean',
    'North America': 'Americas & Caribbean',
    'United States–Mexico Borderlands': 'Americas & Caribbean',
    'Europe': 'Europe & Eurasia',
    'Arctic': 'Europe & Eurasia',
    'Eastern Europe & Eurasia': 'Europe & Eurasia',
    'Pacific': 'Pacific Islands',
    'Global': 'Global / Transnational',
    'Global Oceans': 'Global / Transnational',
};

export const UNIT1_CORE_CONCEPTS = Object.freeze([
    'Power',
    'Sovereignty',
    'Legitimacy',
    'Interdependence',
]);

export const IB_THEMATIC_STUDIES = Object.freeze([
    'peace-and-conflict',
    'rights-and-justice',
    'development-and-sustainability',
]);

export const IB_THEME_LABELS = Object.freeze({
    'peace-and-conflict': 'Peace and conflict',
    'rights-and-justice': 'Rights and justice',
    'development-and-sustainability': 'Development and sustainability',
});

export const INFLUENCE_CHECK_STAGES = Object.freeze([
    'Setting the agenda',
    'The formal decision',
    'What changed in practice',
]);

export const INFLUENCE_RATINGS = Object.freeze([
    'STRONG',
    'MIXED',
    'WEAK',
]);

export const ACTOR_MAP_LEVELS = Object.freeze([
    'local',
    'state',
    'regional',
    'global',
]);

export const ACTOR_MAP_CONNECTION_TYPES = Object.freeze([
    'conflict',
    'pressure',
    'support',
    'movement',
]);

export const ACTOR_MAP_LOCATION_KINDS = Object.freeze([
    'pin',
    'area',
    'noSinglePlace',
]);

function cloneActorMap(actorMap) {
    if (!actorMap || typeof actorMap !== 'object') return undefined;
    return {
        ...actorMap,
        terrainPatches: (actorMap.terrainPatches || []).map(patch => ({
            ...patch,
            bounds: [...(patch.bounds || [])],
        })),
        bloc: actorMap.bloc ? {
            ...actorMap.bloc,
            members: [...(actorMap.bloc.members || [])],
        } : undefined,
        contextLabels: (actorMap.contextLabels || []).map(label => ({ ...label })),
        actors: (actorMap.actors || []).map(actor => ({
            ...actor,
            location: actor.location ? {
                ...actor.location,
                ...(Array.isArray(actor.location.countries) ? { countries: [...actor.location.countries] } : {}),
                ...(actor.location.anchor ? { anchor: { ...actor.location.anchor } } : {}),
            } : undefined,
        })),
        connections: (actorMap.connections || []).map(conn => ({
            ...conn,
            steps: [...(conn.steps || [])],
        })),
        steps: (actorMap.steps || []).map(step => ({
            ...step,
            levels: [...(step.levels || [])],
            cam: step.cam ? { ...step.cam } : undefined,
            actors: (step.actors || []).map(entry => ({ ...entry })),
            ...(Array.isArray(step.clusters) ? {
                clusters: step.clusters.map(cluster => ({
                    ...cluster,
                    memberIds: [...(cluster.memberIds || [])],
                })),
            } : {}),
            connections: [...(step.connections || [])],
        })),
    };
}

export const stripCitationMarkers = value => String(value || '')
    .replace(/\[\s*\d+(?:\s*,\s*\d+)*\s*\]/g, '')
    .replace(/\s+([,.;:!?])/g, '$1');

export const countWords = value => stripCitationMarkers(value)
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length;

export function computeBriefingReadingTimes(caseStudy) {
    if (!caseStudy || typeof caseStudy !== 'object') {
        return { quickMinutes: 1, fullMinutes: 1, quickWords: 0, fullWords: 0 };
    }
    const waypoints = Array.isArray(caseStudy.waypoints) ? caseStudy.waypoints : [];
    const quickText = [
        caseStudy.statusSummary,
        caseStudy.whyItMatters,
        ...waypoints.map(item => String(item.narration || '').split(/\n\s*\n/)[0] || ''),
    ].join(' ');
    const quickWords = countWords(quickText);

    const deeperParts = [
        caseStudy.statusSummary,
        caseStudy.whyItMatters,
        caseStudy.uncertainty,
        caseStudy.background,
        ...waypoints.map(item => item.narration || ''),
        ...(caseStudy.keyTerms || []).map(item => `${item.term} ${item.definition}`),
        ...(caseStudy.debate || []).map(item => `${item.claimBy} ${item.claim} ${item.counterBy} ${item.counterClaim}`),
        ...(caseStudy.watchFor || []).map(item => `${item.date} ${item.indicator}`),
        ...(caseStudy.examPrompts || []),
        ...(caseStudy.influenceCheck || []).map(item => `${item.stage} ${item.evidence}`),
        ...Object.values(caseStudy.conceptLens || {}),
        caseStudy.essayBuilder
            ? `${caseStudy.essayBuilder.prompt} ${caseStudy.essayBuilder.claim} ${caseStudy.essayBuilder.evidence} ${caseStudy.essayBuilder.counterClaim} ${caseStudy.essayBuilder.judgment}`
            : '',
        ...(caseStudy.timeline || []).map(item => `${item.date} ${item.label}`),
    ];
    const fullWords = countWords(deeperParts.join(' '));
    const wordsPerMinute = 200;
    const quickMinutes = Math.max(1, Math.ceil(quickWords / wordsPerMinute));
    const fullMinutes = Math.max(quickMinutes, Math.ceil(fullWords / wordsPerMinute));
    return { quickMinutes, fullMinutes, quickWords, fullWords };
}

export const addDays = (date, days) => {
    const [year, month, day] = date.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day + days));
    return result.toISOString().slice(0, 10);
};

export const getSourceDateLabel = source => {
    if (source.publishedAt) return source.publishedAt;

    const timing = [];
    if (source.dataThrough) timing.push(`Data through ${source.dataThrough}`);
    else if (source.updatedAt) timing.push(`Updated ${source.updatedAt}`);
    else if (source.milestoneDate) timing.push(`${source.milestoneLabel || 'Milestone'} ${source.milestoneDate}`);
    if (source.reviewedAt) timing.push(`Living reference reviewed ${source.reviewedAt}`);

    return timing.join(' · ') || (source.sourceType === 'living-reference' ? 'Living reference' : 'Publication date not stated');
};

export function normalizeCaseStudy(caseStudy) {
    const sourcePerspectiveTypes = ['local', 'institutional', 'independent'];
    const validSensitivity = ['standard', 'high'].includes(caseStudy.sensitivity);
    const reviewCadenceDays = caseStudy.reviewCadenceDays
        || (/conflict|displacement|security|sovereignty/i.test(caseStudy.issueDimensions.join(' ')) ? 30 : 90);
    const sensitivity = validSensitivity
        ? caseStudy.sensitivity
        : reviewCadenceDays <= 30 ? 'high' : 'standard';
    const fallbackLocation = caseStudy.coordinates ? [{
        label: caseStudy.regionTags[0],
        latitude: caseStudy.coordinates.latitude,
        longitude: caseStudy.coordinates.longitude,
    }] : [];
    const map = caseStudy.map || { mode: 'point', locations: fallbackLocation };

    const rawRegion = caseStudy.coverageRegion || caseStudy.regionTags[0];
    const coverageRegion = COVERAGE_REGION_ALIASES[rawRegion] || rawRegion;
    const rawBroadCategory = BROAD_CATEGORY_ALIASES[caseStudy.broadCategory] || caseStudy.broadCategory;
    if (caseStudy.issueLens && rawBroadCategory && ISSUE_LENS_TO_BROAD_CATEGORY[caseStudy.issueLens] !== rawBroadCategory) {
        throw new RangeError(
            `Case study ${caseStudy.id} has mismatched issueLens (${caseStudy.issueLens}) and broadCategory (${rawBroadCategory})`
        );
    }
    const issueLens = caseStudy.issueLens
        || BROAD_CATEGORY_TO_ISSUE_LENS[rawBroadCategory]
        || 'Security & Diplomacy';
    const broadCategory = rawBroadCategory
        || ISSUE_LENS_TO_BROAD_CATEGORY[issueLens]
        || 'Geopolitics & Conflict';
    const status = caseStudy.status === 'archived' ? 'archived' : 'active';
    const reviewStatus = status === 'active' && caseStudy.reviewStatus === 'update-in-progress'
        ? 'update-in-progress'
        : undefined;

    return {
        ...caseStudy,
        status,
        reviewStatus,
        archivedAt: status === 'archived' ? (caseStudy.archivedAt || null) : undefined,
        archivedReason: status === 'archived' ? (caseStudy.archivedReason || '') : undefined,
        supersededById: status === 'archived' ? (caseStudy.supersededById || undefined) : undefined,
        issueLens,
        broadCategory,
        coverageRegion,
        featured: Boolean(caseStudy.featured),
        sensitivity,
        editorialCaution: caseStudy.editorialCaution
            || (!validSensitivity && typeof caseStudy.sensitivity === 'string' ? caseStudy.sensitivity : '')
            || caseStudy.uncertainty,
        reviewCadenceDays,
        reviewBy: caseStudy.reviewBy || addDays(caseStudy.updatedAt, reviewCadenceDays),
        map: {
            ...map,
            locations: map.locations.map(location => ({ ...location })),
        },
        sources: caseStudy.sources.map((source, index) => ({
            ...source,
            perspectiveType: source.perspectiveType || sourcePerspectiveTypes[index],
            dateLabel: getSourceDateLabel(source),
            supports: Array.isArray(source.supports)
                ? source.supports.join(' ')
                : source.supports || source.perspective,
        })),
        supplementalSources: (caseStudy.supplementalSources || []).map(source => ({
            ...source,
            dateLabel: getSourceDateLabel(source),
        })),
        waypoints: caseStudy.waypoints.map((waypoint, index) => ({
            ...waypoint,
            perspectiveLabel: waypoint.perspectiveLabel || waypoint.title,
            perspectiveType: waypoint.perspectiveType || (index === caseStudy.waypoints.length - 1 ? 'synthesis' : sourcePerspectiveTypes[index % sourcePerspectiveTypes.length]),
        })),
        briefingVersion: caseStudy.briefingVersion === 2 ? 2 : 1,
        ...(Array.isArray(caseStudy.concepts) ? { concepts: [...caseStudy.concepts] } : {}),
        ...(Array.isArray(caseStudy.ibThemes) ? { ibThemes: [...caseStudy.ibThemes] } : {}),
        ...(Array.isArray(caseStudy.timeline) ? { timeline: caseStudy.timeline.map(item => ({ ...item })) } : {}),
        ...(Array.isArray(caseStudy.keyFigures) ? { keyFigures: caseStudy.keyFigures.map(item => ({ ...item })) } : {}),
        ...(Array.isArray(caseStudy.backgroundSources) ? { backgroundSources: [...caseStudy.backgroundSources] } : {}),
        ...(Array.isArray(caseStudy.keyTerms) ? { keyTerms: caseStudy.keyTerms.map(item => ({ ...item })) } : {}),
        ...(Array.isArray(caseStudy.debate) ? { debate: caseStudy.debate.map(item => ({ ...item, sourceUrls: [...(item.sourceUrls || [])] })) } : {}),
        ...(Array.isArray(caseStudy.watchFor) ? { watchFor: caseStudy.watchFor.map(item => ({ ...item })) } : {}),
        ...(Array.isArray(caseStudy.examPrompts) ? { examPrompts: [...caseStudy.examPrompts] } : {}),
        ...(Array.isArray(caseStudy.influenceCheck) ? { influenceCheck: caseStudy.influenceCheck.map(item => ({ ...item, sourceUrls: [...(item.sourceUrls || [])] })) } : {}),
        ...(caseStudy.conceptLens ? { conceptLens: { ...caseStudy.conceptLens } } : {}),
        ...(caseStudy.essayBuilder ? { essayBuilder: { ...caseStudy.essayBuilder, sourceUrls: [...(caseStudy.essayBuilder.sourceUrls || [])] } } : {}),
        ...(Array.isArray(caseStudy.relatedCases) ? { relatedCases: caseStudy.relatedCases.map(item => ({ ...item })) } : {}),
        ...(caseStudy.actorMap ? { actorMap: cloneActorMap(caseStudy.actorMap) } : {}),
    };
}

export function toForecastRecord(caseStudy) {
    if (!caseStudy || typeof caseStudy !== 'object') {
        throw new TypeError('toForecastRecord requires a case-study object');
    }

    const primarySource = caseStudy.sources?.[0];
    const sourceLabel = (caseStudy.sources || [])
        .map(source => `${source.publisher}: ${source.title}${source.dateLabel ? ` (${source.dateLabel})` : ''}`)
        .join('; ');
    const mapAnchor = caseStudy.coordinates || caseStudy.map?.locations?.[0];

    if (!mapAnchor || !Number.isFinite(Number(mapAnchor.latitude)) || !Number.isFinite(Number(mapAnchor.longitude))) {
        throw new TypeError(`Case study ${caseStudy.id || '(unknown)'} requires at least one valid map location`);
    }

    return {
        'Topic/Sector': caseStudy.issueDimensions.join(' / '),
        'Entity/Subject': caseStudy.title,
        'Key Player/Organization': caseStudy.actors.join(', '),
        Timeline: `Last reviewed ${caseStudy.updatedAt}`,
        'Expected Impact/Value': `${caseStudy.statusSummary} ${caseStudy.whyItMatters}`,
        Source: sourceLabel,
        url: primarySource?.url || '',
        Latitude: String(mapAnchor.latitude),
        Longitude: String(mapAnchor.longitude),
        Broad_Category: caseStudy.broadCategory,
        issueLens: caseStudy.issueLens,
        status: caseStudy.status || 'active',
        reviewStatus: caseStudy.reviewStatus === 'update-in-progress' ? 'update-in-progress' : undefined,
        caseStudyId: caseStudy.id,
        statusSummary: caseStudy.statusSummary,
        whyItMatters: caseStudy.whyItMatters,
        issueDimensions: [...caseStudy.issueDimensions],
        regionTags: [...caseStudy.regionTags],
        nexusActorIds: [...caseStudy.nexusNodeIds],
        updatedAt: caseStudy.updatedAt,
        confidence: caseStudy.confidence,
        uncertainty: caseStudy.uncertainty,
        coverageRegion: caseStudy.coverageRegion,
        featured: caseStudy.featured,
        sensitivity: caseStudy.sensitivity,
        editorialCaution: caseStudy.editorialCaution,
        reviewCadenceDays: caseStudy.reviewCadenceDays,
        reviewBy: caseStudy.reviewBy,
        map: {
            ...caseStudy.map,
            locations: caseStudy.map.locations.map(location => ({ ...location })),
        },
        sources: caseStudy.sources.map(source => ({ ...source })),
        supplementalSources: caseStudy.supplementalSources.map(source => ({ ...source })),
        waypoints: caseStudy.waypoints.map(waypoint => ({ ...waypoint })),
        isCaseStudy: true,
        isEditorial: true,
    };
}

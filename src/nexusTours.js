/**
 * Guided Briefings are projected from the canonical, source-aware case-study
 * records so the feed, evidence panel, and Nexus never drift into separate
 * versions of the same current claim.
 */
import { CASE_STUDIES_2026 } from './caseStudies2026';

const TOUR_COLORS = {
    'sudan-displacement-regional-spillover': '#ff7b8d',
    'myanmar-fragmented-sovereignty': '#d990ff',
    'south-china-sea-arbitral-award-ten-years': '#67d5f5',
    'syria-transition-return-sanctions': '#f7b955',
    'guyana-venezuela-essequibo-icj': '#f4d35e',
    'usmca-2026-joint-review': '#5eead4',
    'tuvalu-australia-falepili-union': '#62e6a7',
    'greenland-autonomy-security-minerals': '#8495ff',
};

const REGION_COLORS = {
    Africa: '#8fda66',
    'Middle East': '#f7b955',
    Asia: '#dc88ef',
    'Asia-Pacific': '#dc88ef',
    Pacific: '#62e6a7',
    Europe: '#67d5f5',
    'Latin America': '#f4d35e',
    Caribbean: '#f4d35e',
    'North America': '#5eead4',
    Arctic: '#8495ff',
    Global: '#c9f4f7',
};

const getTourColor = caseStudy => TOUR_COLORS[caseStudy.id]
    || REGION_COLORS[caseStudy.coverageRegion]
    || caseStudy.regionTags.map(tag => REGION_COLORS[tag]).find(Boolean)
    || '#5eead4';

export const GUIDED_TOURS = CASE_STUDIES_2026.map(caseStudy => ({
    id: caseStudy.id,
    caseStudyId: caseStudy.id,
    title: caseStudy.title,
    subtitle: caseStudy.subtitle,
    color: getTourColor(caseStudy),
    coverageRegion: caseStudy.coverageRegion,
    featured: Boolean(caseStudy.featured),
    sensitivity: caseStudy.sensitivity,
    reviewBy: caseStudy.reviewBy,
    broadCategory: caseStudy.broadCategory,
    map: caseStudy.map ? {
        ...caseStudy.map,
        locations: caseStudy.map.locations.map(location => ({ ...location })),
    } : null,
    regionTags: [...caseStudy.regionTags],
    issueDimensions: [...caseStudy.issueDimensions],
    actors: [...caseStudy.actors],
    updatedAt: caseStudy.updatedAt,
    confidence: caseStudy.confidence,
    uncertainty: caseStudy.uncertainty,
    sources: caseStudy.sources.map(source => ({ ...source })),
    supplementalSources: caseStudy.supplementalSources.map(source => ({ ...source })),
    waypoints: caseStudy.waypoints.map(waypoint => ({ ...waypoint })),
}));

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

export const GUIDED_TOURS = CASE_STUDIES_2026.map(caseStudy => ({
    id: caseStudy.id,
    caseStudyId: caseStudy.id,
    title: caseStudy.title,
    subtitle: caseStudy.subtitle,
    color: TOUR_COLORS[caseStudy.id] || '#5eead4',
    regionTags: [...caseStudy.regionTags],
    issueDimensions: [...caseStudy.issueDimensions],
    updatedAt: caseStudy.updatedAt,
    confidence: caseStudy.confidence,
    uncertainty: caseStudy.uncertainty,
    sources: caseStudy.sources.map(source => ({ ...source })),
    waypoints: caseStudy.waypoints.map(waypoint => ({ ...waypoint })),
}));

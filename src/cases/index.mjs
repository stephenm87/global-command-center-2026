import { AFRICA_CASES_2026 } from './active/africa-2026.mjs';
import { ASIA_PACIFIC_CASES_2026 } from './active/asia-pacific-2026.mjs';
import { MENA_CASES_2026 } from './active/mena-2026.mjs';
import { EUROPE_EURASIA_CASES_2026 } from './active/europe-eurasia-2026.mjs';
import { AMERICAS_CARIBBEAN_CASES_2026 } from './active/americas-caribbean-2026.mjs';
import { PACIFIC_ISLANDS_CASES_2026 } from './active/pacific-islands-2026.mjs';
import { GLOBAL_INSTITUTIONS_CASES_2026 } from './active/global-institutions-2026.mjs';
import { ARCHIVED_CASES_2026 } from './archive/archived-2026.mjs';
import {
    CONTENT_REVIEW_DATE,
    CANONICAL_REGIONS_7,
    COVERAGE_REGION_ALIASES,
    ISSUE_LENSES_6,
    BROAD_CATEGORIES,
    ISSUE_LENS_TO_BROAD_CATEGORY,
    BROAD_CATEGORY_TO_ISSUE_LENS,
    UNIT1_CORE_CONCEPTS,
    IB_THEMATIC_STUDIES,
    IB_THEME_LABELS,
    INFLUENCE_CHECK_STAGES,
    INFLUENCE_RATINGS,
    countWords,
    computeBriefingReadingTimes,
    addDays,
    getSourceDateLabel,
    normalizeCaseStudy,
    toForecastRecord,
} from './schema.mjs';

const BASELINE_CASE_ORDER = [
    'sudan-displacement-regional-spillover',
    'myanmar-fragmented-sovereignty',
    'south-china-sea-arbitral-award-ten-years',
    'syria-transition-return-sanctions',
    'guyana-venezuela-essequibo-icj',
    'usmca-2026-joint-review',
    'tuvalu-australia-falepili-union',
    'greenland-autonomy-security-minerals',
    'eu-ai-act-transparency-implementation',
    'eastern-drc-peace-civilian-protection',
    'sahel-after-ecowas-regional-order',
    'somaliland-recognition-red-sea-order',
    'zambia-electricity-reset-climate-access',
    'western-sahara-autonomy-self-determination',
    'libya-roadmap-elections-oil-assets',
    'red-sea-yemen-humanitarian-economy',
    'indus-water-regime-under-strain',
    'bangladesh-ldc-graduation-decision',
    'kyrgyzstan-tajikistan-border-peace',
    'mongolia-coal-critical-minerals-transition',
    'indonesia-nickel-development-bargain',
    'mekong-energy-food-bargain',
    'pacific-seabed-governance',
    'haiti-security-legitimacy-haitian-ownership',
    'amazon-indigenous-co-governance',
    'rio-bravo-rio-grande-water-treaty',
    'moldova-transnistria-energy-eu-accession',
    'high-seas-bbnj-implementation',
    'who-pathogen-access-benefit-sharing',
];

const BASELINE_INDEX = new Map(BASELINE_CASE_ORDER.map((id, index) => [id, index]));

const RAW_ACTIVE_CASES = [
    ...AFRICA_CASES_2026,
    ...ASIA_PACIFIC_CASES_2026,
    ...MENA_CASES_2026,
    ...EUROPE_EURASIA_CASES_2026,
    ...AMERICAS_CARIBBEAN_CASES_2026,
    ...PACIFIC_ISLANDS_CASES_2026,
    ...GLOBAL_INSTITUTIONS_CASES_2026,
];

export const CASE_STUDIES_2026 = RAW_ACTIVE_CASES
    .filter(item => item.status !== 'archived')
    .sort((a, b) => {
        const ia = BASELINE_INDEX.has(a.id) ? BASELINE_INDEX.get(a.id) : Number.MAX_SAFE_INTEGER;
        const ib = BASELINE_INDEX.has(b.id) ? BASELINE_INDEX.get(b.id) : Number.MAX_SAFE_INTEGER;
        return ia - ib;
    })
    .map(normalizeCaseStudy);

export const ARCHIVED_CASE_STUDIES_2026 = ARCHIVED_CASES_2026.map(item => (
    normalizeCaseStudy({ ...item, status: 'archived' })
));

export const ALL_CASE_STUDIES_2026 = [
    ...CASE_STUDIES_2026,
    ...ARCHIVED_CASE_STUDIES_2026,
];

export {
    CONTENT_REVIEW_DATE,
    CANONICAL_REGIONS_7,
    COVERAGE_REGION_ALIASES,
    ISSUE_LENSES_6,
    BROAD_CATEGORIES,
    ISSUE_LENS_TO_BROAD_CATEGORY,
    BROAD_CATEGORY_TO_ISSUE_LENS,
    UNIT1_CORE_CONCEPTS,
    IB_THEMATIC_STUDIES,
    IB_THEME_LABELS,
    INFLUENCE_CHECK_STAGES,
    INFLUENCE_RATINGS,
    countWords,
    computeBriefingReadingTimes,
    addDays,
    getSourceDateLabel,
    normalizeCaseStudy,
    toForecastRecord,
};

export default CASE_STUDIES_2026;

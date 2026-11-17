/**
 * Public facade for the 2026 curated case-study library.
 *
 * Regional active modules live under `src/cases/active/*.mjs` and retired
 * historical snapshots live under `src/cases/archive/archived-2026.mjs`.
 */
export {
    CONTENT_REVIEW_DATE,
    CANONICAL_REGIONS_7,
    COVERAGE_REGION_ALIASES,
    ISSUE_LENSES_6,
    BROAD_CATEGORIES,
    ISSUE_LENS_TO_BROAD_CATEGORY,
    BROAD_CATEGORY_TO_ISSUE_LENS,
    CASE_STUDIES_2026,
    ARCHIVED_CASE_STUDIES_2026,
    ALL_CASE_STUDIES_2026,
    addDays,
    getSourceDateLabel,
    normalizeCaseStudy,
    toForecastRecord,
} from './cases/index.mjs';

export { CASE_STUDIES_2026 as default } from './cases/index.mjs';

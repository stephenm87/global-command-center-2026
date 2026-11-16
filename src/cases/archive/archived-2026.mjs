/**
 * Non-destructive historical snapshot archive for retired or superseded case studies.
 *
 * Records moved here retain their permanent `id` so syllabus deep links
 * (`?view=briefings&tour=<id>&step=<n>`) continue resolving with an archived
 * snapshot banner rather than silently redirecting to index 0.
 */
export const ARCHIVED_CASES_2026 = [];

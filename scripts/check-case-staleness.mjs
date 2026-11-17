import { pathToFileURL } from 'node:url';
import { CASE_STUDIES_2026, ARCHIVED_CASE_STUDIES_2026 } from '../src/cases/index.mjs';
import { isReviewOverdue } from '../src/navigationState.mjs';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function getLocalCalendarDate(now = new Date()) {
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function isValidIsoDate(value) {
    if (typeof value !== 'string' || !ISO_DATE_RE.test(value)) return false;
    const ms = Date.parse(`${value}T00:00:00Z`);
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

export function parseCliArgs(argv = [], now = new Date()) {
    let referenceDate = null;
    let strict = false;
    let jsonOutput = false;

    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg === '--strict') {
            strict = true;
        } else if (arg === '--json') {
            jsonOutput = true;
        } else if (arg.startsWith('--as-of=')) {
            referenceDate = arg.slice('--as-of='.length);
        } else if (arg === '--as-of') {
            referenceDate = argv[i + 1] || '';
            i += 1;
        }
    }

    const resolvedDate = referenceDate === null ? getLocalCalendarDate(now) : referenceDate;
    if (!isValidIsoDate(resolvedDate)) {
        throw new RangeError(`Invalid --as-of date "${resolvedDate}". Expected YYYY-MM-DD.`);
    }
    return { referenceDate: resolvedDate, strict, jsonOutput };
}

const daysBetween = (fromIso, toIso) => {
    const a = Date.parse(`${fromIso}T00:00:00Z`);
    const b = Date.parse(`${toIso}T00:00:00Z`);
    return Math.round((b - a) / 86400000);
};

export function analyzeCaseStaleness(
    activeCases = CASE_STUDIES_2026,
    archivedCases = ARCHIVED_CASE_STUDIES_2026,
    referenceDate = getLocalCalendarDate(),
) {
    if (!isValidIsoDate(referenceDate)) {
        throw new RangeError(`Invalid referenceDate "${referenceDate}". Expected YYYY-MM-DD.`);
    }
    const overdue = [];
    const dueSoon = [];
    const fresh = [];

    for (const item of activeCases) {
        if (isReviewOverdue(item.reviewBy, referenceDate)) {
            overdue.push({
                id: item.id,
                coverageRegion: item.coverageRegion,
                issueLens: item.issueLens,
                updatedAt: item.updatedAt,
                reviewBy: item.reviewBy,
                daysOverdue: daysBetween(item.reviewBy, referenceDate),
            });
        } else {
            const daysRemaining = daysBetween(referenceDate, item.reviewBy);
            const entry = {
                id: item.id,
                coverageRegion: item.coverageRegion,
                issueLens: item.issueLens,
                updatedAt: item.updatedAt,
                reviewBy: item.reviewBy,
                daysRemaining,
            };
            if (daysRemaining <= 14) dueSoon.push(entry);
            else fresh.push(entry);
        }
    }

    overdue.sort((a, b) => b.daysOverdue - a.daysOverdue);
    dueSoon.sort((a, b) => a.daysRemaining - b.daysRemaining);

    return {
        referenceDate,
        activeCount: activeCases.length,
        archivedCount: archivedCases.length,
        overdueCount: overdue.length,
        dueWithin14DaysCount: dueSoon.length,
        freshCount: fresh.length,
        overdue,
        dueWithin14Days: dueSoon,
    };
}

const isDirectRun = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
    try {
        const { referenceDate, strict, jsonOutput } = parseCliArgs(process.argv.slice(2));
        const report = analyzeCaseStaleness(CASE_STUDIES_2026, ARCHIVED_CASE_STUDIES_2026, referenceDate);

        if (jsonOutput) {
            console.log(JSON.stringify(report, null, 2));
        } else {
            console.log(`[content:staleness] As of ${referenceDate}: ${report.activeCount} active cases (${report.archivedCount} archived)`);
            console.log(`  - Overdue (reviewBy < ${referenceDate}): ${report.overdueCount}`);
            console.log(`  - Due within 14 days: ${report.dueWithin14DaysCount}`);
            console.log(`  - Fresh (>14 days remaining): ${report.freshCount}`);
            if (report.overdue.length > 0) {
                console.log('\nOverdue active cases (oldest reviewBy first):');
                for (const item of report.overdue) {
                    console.log(`  • ${item.id} (${item.coverageRegion} · ${item.issueLens}) — reviewBy ${item.reviewBy} (${item.daysOverdue}d overdue)`);
                }
            }
            if (report.dueWithin14Days.length > 0) {
                console.log('\nCases due for review within 14 days:');
                for (const item of report.dueWithin14Days) {
                    console.log(`  • ${item.id} (${item.coverageRegion} · ${item.issueLens}) — reviewBy ${item.reviewBy} (${item.daysRemaining}d left)`);
                }
            }
        }

        if (strict && report.overdueCount > 0) {
            process.exitCode = 1;
        }
    } catch (error) {
        console.error(`[content:staleness] ${error.message}`);
        process.exitCode = 1;
    }
}

export const ALL_INTEL_CATEGORY = 'All';
export const LIVE_INTEL_CATEGORY = 'Live Intel';

const cleanKeyPart = value => String(value || '').trim().toLowerCase();

const recordKey = item => [
    cleanKeyPart(item.url),
    cleanKeyPart(item['Entity/Subject']),
    cleanKeyPart(item['Topic/Sector']),
].join('|');

const normalizeIntelItem = (item, sourceKind) => {
    const source = item && typeof item === 'object' ? item : {};
    const defaultContentStatus = {
        'public-reference': 'public-reference',
        'curated-reference': 'verified-case',
        'legacy-reference': 'legacy-reference',
    }[sourceKind];
    const contentStatus = source._contentStatus || defaultContentStatus;
    const isLive = sourceKind === 'public-reference'
        ? false
        : source.isLive ?? contentStatus === 'provider-current';
    const timeline = !isLive && /^LIVE\s*-\s*/i.test(source.Timeline || '')
        ? String(source.Timeline).replace(/^LIVE\s*-\s*/i, 'Dated reference · ')
        : source.Timeline;

    return {
        ...source,
        ...(timeline ? { Timeline: timeline } : {}),
        isLive: Boolean(isLive),
        isEditorial: source.isEditorial ?? contentStatus === 'editorial-archive',
        isReference: sourceKind === 'public-reference' ? true : source.isReference ?? !isLive,
        ...(contentStatus ? { _contentStatus: contentStatus } : {}),
    };
};

export function mergeIntelSources({
    providerItems = [],
    publicReferenceItems = [],
    curatedItems = [],
    legacyItems = [],
} = {}) {
    const orderedSources = [
        ...providerItems.map(item => normalizeIntelItem(item, 'provider')),
        ...publicReferenceItems.map(item => normalizeIntelItem(item, 'public-reference')),
        ...curatedItems.map(item => normalizeIntelItem(item, 'curated-reference')),
        ...legacyItems.map(item => normalizeIntelItem(item, 'legacy-reference')),
    ];
    const seen = new Set();

    return orderedSources.filter(item => {
        const key = recordKey(item);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function filterIntelForecasts({
    forecasts = [],
    historicalData = null,
    selectedCategory = ALL_INTEL_CATEGORY,
    timelineYear = 'ALL',
    globeNewsOnly = false,
} = {}) {
    if (globeNewsOnly) return forecasts.filter(item => item.isNews);

    const source = historicalData || forecasts;
    const effectiveCategory = historicalData && selectedCategory === LIVE_INTEL_CATEGORY
        ? ALL_INTEL_CATEGORY
        : selectedCategory;
    const categoryFiltered = effectiveCategory === ALL_INTEL_CATEGORY
        ? source
        : effectiveCategory === LIVE_INTEL_CATEGORY
            ? source.filter(item => item.isLive)
            : source.filter(item => item.Broad_Category === effectiveCategory);

    if (timelineYear === 'ALL') return categoryFiltered;
    return categoryFiltered.filter(item => String(item.Timeline || '').includes(timelineYear));
}

export function searchIntelForecasts(items = [], search = '') {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter(item => [
        item['Entity/Subject'], item['Topic/Sector'], item['Expected Impact/Value'],
        item['Key Player/Organization'], item.Broad_Category, item.Source,
    ].some(value => String(value || '').toLowerCase().includes(query)));
}

export function summarizeIntelSources(items = [], providerMeta = null) {
    const liveItemCount = items.filter(item => item.isLive).length;
    const linkedReferenceCount = items.filter(item => !item.isLive && /^https:\/\//i.test(item.url || '')).length;

    return {
        totalItemCount: items.length,
        liveItemCount,
        linkedReferenceCount,
        sourceMode: providerMeta?.sourceMode === 'provider' && liveItemCount > 0
            ? 'provider'
            : 'public-reference',
    };
}

export function getFeedEmptyState({
    feedItems = [],
    selectedCategory = ALL_INTEL_CATEGORY,
    feedSearch = '',
    historicalLoading = false,
    historicalData = null,
    intelLoading = false,
} = {}) {
    if (intelLoading || historicalLoading || feedItems.length > 0) return null;
    const effectiveCategory = historicalData && selectedCategory === LIVE_INTEL_CATEGORY
        ? ALL_INTEL_CATEGORY
        : selectedCategory;

    if (effectiveCategory === LIVE_INTEL_CATEGORY) {
        return {
            title: 'NO CURRENT PROVIDER UPDATES',
            message: 'Public source links remain available without a login.',
            actionLabel: 'SHOW PUBLIC SOURCES',
            action: 'show-public-sources',
        };
    }

    if (feedSearch.trim()) {
        return {
            title: 'NO MATCHING SOURCES',
            message: 'Try a broader actor, issue, region, or publisher.',
            actionLabel: 'CLEAR SEARCH',
            action: 'clear-search',
        };
    }

    if (effectiveCategory !== ALL_INTEL_CATEGORY) {
        return {
            title: 'NO SOURCES IN THIS SECTOR',
            message: 'Return to all sourced intelligence to continue browsing.',
            actionLabel: 'SHOW ALL SOURCES',
            action: 'show-public-sources',
        };
    }

    return {
        title: 'SOURCE LIST UNAVAILABLE',
        message: 'The public reference list could not be loaded. Please try again shortly.',
        actionLabel: null,
        action: null,
    };
}

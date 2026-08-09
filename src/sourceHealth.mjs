export function indexSourceHealth(snapshot) {
    const entries = Array.isArray(snapshot?.results) ? snapshot.results : [];
    return new Map(entries.filter(item => item?.url).map(item => [item.url, item]));
}

export function sourceHealthLabel(result) {
    if (!result) return null;
    return {
        healthy: 'Link checked',
        restricted: 'Publisher may restrict access',
        broken: 'Link unavailable',
        unknown: 'Link status uncertain',
    }[result.status] || null;
}

export function shouldPreferAlternate(result) {
    return ['restricted', 'broken'].includes(result?.status);
}

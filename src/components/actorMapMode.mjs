/**
 * Pure device-capability, network-speed, and mode-selection helpers for CaseActorMap.
 * Extracted so unit tests exercise every lazy-loading, slow-link gating,
 * reduced-motion, WebGL2, and WebP fallback rule directly.
 */

export const SLOW_THROUGHPUT_BYTES_PER_SEC = 150 * 1024;
export const HONEST_3D_LOADING_MESSAGE = 'Flat map shown while 3D terrain loads';

export function detectWebGLSupport() {
    if (typeof document === 'undefined') return false;
    try {
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl2');
        if (!gl) return false;
        // Three.js r184 dropped WebGL1; release probe context immediately to preserve GPU quota.
        gl.getExtension?.('WEBGL_lose_context')?.loseContext?.();
        return true;
    } catch {
        return false;
    }
}

export function isLowPowerDeviceConfig({
    innerWidth = typeof window !== 'undefined' ? window.innerWidth : 0,
    hardwareConcurrency = typeof navigator !== 'undefined' ? navigator.hardwareConcurrency : undefined,
    deviceMemory = typeof navigator !== 'undefined' ? navigator.deviceMemory : undefined,
    saveData = typeof navigator !== 'undefined' ? Boolean(navigator?.connection?.saveData) : false,
} = {}) {
    if (typeof innerWidth !== 'number' || innerWidth < 768) return true;
    const lowCores = typeof hardwareConcurrency === 'number' && hardwareConcurrency <= 4;
    const lowMem = typeof deviceMemory === 'number' && deviceMemory <= 2;
    return Boolean(lowCores || lowMem || saveData);
}

export function hasNetworkConnectionMetrics(conn = typeof navigator !== 'undefined' ? navigator?.connection : undefined) {
    if (!conn) return false;
    return Boolean(
        (typeof conn.effectiveType === 'string' && conn.effectiveType.trim().length > 0)
        || (typeof conn.downlink === 'number' && Number.isFinite(conn.downlink) && conn.downlink > 0),
    );
}

export function isSlowConnectionConfig({
    effectiveType = typeof navigator !== 'undefined' ? navigator?.connection?.effectiveType : undefined,
    downlink = typeof navigator !== 'undefined' ? navigator?.connection?.downlink : undefined,
    saveData = typeof navigator !== 'undefined' ? Boolean(navigator?.connection?.saveData) : false,
} = {}) {
    if (saveData) return true;
    if (typeof effectiveType === 'string' && /^(slow-2g|2g|3g)$/i.test(effectiveType.trim())) {
        return true;
    }
    if (typeof downlink === 'number' && Number.isFinite(downlink) && downlink > 0 && downlink < 1.5) {
        return true;
    }
    return false;
}

export function measureResourceThroughput(entry, fallbackBytes = 0, fallbackDurationMs = 0) {
    if (entry) {
        const cachedHit = entry.responseStatus === 304
            || ((entry.transferSize === 0
                || (entry.encodedBodySize > 0 && entry.transferSize < entry.encodedBodySize * 0.5))
                && entry.decodedBodySize > 0);
        if (cachedHit) {
            return { bytes: 0, durationMs: 0 };
        }
        const wireBytes = entry.transferSize > 0 ? entry.transferSize : fallbackBytes;
        const durationMs = entry.responseStart > 0 && entry.responseEnd > entry.responseStart
            ? (entry.responseEnd - entry.responseStart)
            : (entry.responseEnd > entry.fetchStart
                ? (entry.responseEnd - entry.fetchStart)
                : Math.max(0, fallbackDurationMs));
        return { bytes: wireBytes, durationMs };
    }
    return { bytes: fallbackBytes, durationMs: Math.max(0, fallbackDurationMs) };
}

export function isSlowMeasuredThroughput(bytes, durationMs, minBytesPerSec = SLOW_THROUGHPUT_BYTES_PER_SEC) {
    if (!(typeof bytes === 'number' && bytes > 0)) return false;
    // Sub-20ms body transfers come from cache or fast CDN bursts and cannot diagnose slow links.
    if (!(typeof durationMs === 'number' && durationMs > 20)) return false;
    return ((bytes * 1000) / durationMs) <= minBytesPerSec * 1.05;
}

export function chooseActorMapMode({
    webgl = false,
    reducedMotion = false,
    fallbackForced = false,
    lowPower = false,
    slowConnection = false,
    userChoice = null,
    inView = false,
} = {}) {
    if (!webgl || reducedMotion || fallbackForced) return 'flat';
    if (userChoice === 'flat') return 'flat';
    if (userChoice === '3d') return '3d';
    if (lowPower || slowConnection) return 'flat';
    return inView ? '3d' : 'flat';
}

export function preferWebpUrl(url) {
    if (typeof url !== 'string') return url;
    return /\.jpe?g(\?.*)?$/i.test(url)
        ? url.replace(/\.jpe?g(\?.*)?$/i, '.webp$1')
        : url;
}

export function actorMapLoadingStatus(activeMode, terrainReady) {
    return activeMode === '3d' && !terrainReady ? HONEST_3D_LOADING_MESSAGE : '';
}

/**
 * Pure device-capability and mode-selection helpers for CaseActorMap.
 * Extracted so unit tests exercise every lazy-loading, reduced-motion,
 * WebGL2, and low-power mobile fallback rule directly.
 */

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

export function chooseActorMapMode({
    webgl = false,
    reducedMotion = false,
    fallbackForced = false,
    lowPower = false,
    userChoice = null,
    inView = false,
} = {}) {
    if (!webgl || reducedMotion || fallbackForced) return 'flat';
    if (userChoice === 'flat') return 'flat';
    if (userChoice === '3d') return '3d';
    if (lowPower) return 'flat';
    return inView ? '3d' : 'flat';
}

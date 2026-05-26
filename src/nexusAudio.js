/**
 * nexusAudio.js — Web Audio API synthesized sound engine for the Nexus
 * No external audio files needed — all tones generated procedurally.
 */

let audioCtx = null;
let masterGain = null;
let muted = false;
let volume = 0.3;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;
        masterGain.connect(audioCtx.destination);
    }
    // Browser requires user gesture to resume AudioContext
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

// Auto-resume on any click (browsers block audio until first user interaction)
if (typeof document !== 'undefined') {
    const resumeAudio = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    };
    document.addEventListener('click', resumeAudio, { once: false });
    document.addEventListener('keydown', resumeAudio, { once: false });
}

function playTone(freq, duration, type = 'sine', vol = 1, decay = true) {
    if (muted) return;
    const ctx = getCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = vol * volume;
    if (decay) gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(masterGain);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
}

function playChord(freqs, duration, type = 'sine', vol = 0.5) {
    freqs.forEach(f => playTone(f, duration, type, vol / freqs.length));
}

// ── Public API ────────────────────────────────────────────────────────────

/** Soft ping when clicking a node */
export function soundNodeClick() {
    playTone(660, 0.12, 'sine', 0.6);
    setTimeout(() => playTone(880, 0.08, 'sine', 0.3), 40);
}

/** Deep thrum when engaging lock mode */
export function soundLockEngage() {
    playTone(80, 0.3, 'sine', 0.8);
    playTone(120, 0.25, 'triangle', 0.4);
    setTimeout(() => playTone(160, 0.15, 'sine', 0.3), 100);
}

/** Light tick when navigating between connections */
export function soundConnectionNav() {
    playTone(1200, 0.04, 'sine', 0.35);
}

/** Gentle two-note chime for tour waypoints */
export function soundTourWaypoint() {
    playTone(523, 0.2, 'sine', 0.4);
    setTimeout(() => playTone(659, 0.3, 'sine', 0.35), 120);
}

/** Tour start fanfare */
export function soundTourStart() {
    playChord([262, 330, 392], 0.4, 'sine', 0.5);
    setTimeout(() => playChord([330, 392, 523], 0.5, 'sine', 0.4), 250);
}

/** Tour end resolution */
export function soundTourEnd() {
    playChord([392, 523, 659], 0.6, 'sine', 0.4);
}

/** Lock release click */
export function soundLockRelease() {
    playTone(400, 0.08, 'triangle', 0.4);
    setTimeout(() => playTone(300, 0.06, 'triangle', 0.3), 50);
}

/** Soft search activate */
export function soundSearchOpen() {
    playTone(880, 0.06, 'sine', 0.25);
    setTimeout(() => playTone(1100, 0.05, 'sine', 0.2), 30);
}

/** Compare mode activate */
export function soundCompareEngage() {
    playTone(440, 0.15, 'sine', 0.4);
    setTimeout(() => playTone(554, 0.15, 'sine', 0.35), 80);
    setTimeout(() => playTone(659, 0.12, 'sine', 0.3), 160);
}

/** Edge click — lower tone */
export function soundEdgeClick() {
    playTone(330, 0.15, 'triangle', 0.4);
    setTimeout(() => playTone(440, 0.1, 'triangle', 0.3), 60);
}

/** Theory lens switch — sweeping transition */
export function soundTheorySwitch() {
    for (let i = 0; i < 5; i++) {
        setTimeout(() => playTone(200 + i * 80, 0.08, 'sine', 0.2), i * 40);
    }
}

/** Data pulse ping (live feed match) */
export function soundDataPulse() {
    playTone(1400, 0.06, 'sine', 0.2);
}

// ── Volume/Mute Controls ─────────────────────────────────────────────────

export function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
}

export function getVolume() { return volume; }

export function toggleMute() {
    muted = !muted;
    return muted;
}

export function isMuted() { return muted; }

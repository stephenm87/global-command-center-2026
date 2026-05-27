/**
 * nexusAudio.js — Ambient sound engine for the Global Relations Nexus
 * Procedural synthesis with filters, reverb, and generative ambient pad.
 */

let audioCtx = null;
let masterGain = null;
let muted = false;
let volume = 0.3;
let convolver = null; // Reverb
let ambientNodes = []; // For ambient pad
let ambientPlaying = false;
let ambientGain = null;

function getCtx() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.gain.value = volume;

        // Create convolver reverb
        convolver = audioCtx.createConvolver();
        const rate = audioCtx.sampleRate;
        const length = rate * 2;
        const impulse = audioCtx.createBuffer(2, length, rate);
        for (let ch = 0; ch < 2; ch++) {
            const data = impulse.getChannelData(ch);
            for (let i = 0; i < length; i++) {
                data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2.5);
            }
        }
        convolver.buffer = impulse;

        // Wet/dry mix
        const dryGain = audioCtx.createGain();
        const wetGain = audioCtx.createGain();
        dryGain.gain.value = 0.7;
        wetGain.gain.value = 0.3;
        masterGain.connect(dryGain);
        masterGain.connect(convolver);
        convolver.connect(wetGain);
        dryGain.connect(audioCtx.destination);
        wetGain.connect(audioCtx.destination);

        // Ambient gain node
        ambientGain = audioCtx.createGain();
        ambientGain.gain.value = 0;
        ambientGain.connect(dryGain);
        ambientGain.connect(convolver);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
    }
    return audioCtx;
}

// Auto-resume on user interaction
if (typeof document !== 'undefined') {
    const resumeAudio = () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    };
    document.addEventListener('click', resumeAudio, { once: false });
    document.addEventListener('keydown', resumeAudio, { once: false });
}

// ── Core synthesis helpers ────────────────────────────────────────────────

function playTone(freq, duration, type = 'sine', vol = 1, opts = {}) {
    if (muted) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    // Optional filter for warmth
    const filter = ctx.createBiquadFilter();
    filter.type = opts.filterType || 'lowpass';
    filter.frequency.value = opts.filterFreq || 4000;
    filter.Q.value = opts.filterQ || 1;

    osc.type = type;
    osc.frequency.value = freq;

    // Soft attack + decay envelope
    const attack = opts.attack || 0.01;
    const release = opts.release || duration * 0.7;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(vol * volume, now + attack);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    // Slight detune for organic feel
    if (opts.detune) osc.detune.value = opts.detune;

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);
    osc.start(now + (opts.delay || 0));
    osc.stop(now + duration + (opts.delay || 0));
}

function playPad(freqs, duration, vol = 0.15) {
    freqs.forEach((f, i) => {
        playTone(f, duration, 'sine', vol, {
            attack: 0.15,
            detune: (Math.random() - 0.5) * 8,
            filterFreq: 2000,
            delay: i * 0.02,
        });
    });
}

// ── Ambient Background Pad ───────────────────────────────────────────────

const AMBIENT_CHORDS = [
    [130.81, 196.00, 261.63, 329.63],  // C  - E  - G
    [146.83, 220.00, 293.66, 349.23],  // D  - F# - A
    [164.81, 246.94, 329.63, 392.00],  // E  - G# - B
    [130.81, 164.81, 196.00, 293.66],  // C  - E  - G  - D (add9)
];

export function startAmbient() {
    if (ambientPlaying || muted) return;
    const ctx = getCtx();
    ambientPlaying = true;

    function playNextPad() {
        if (!ambientPlaying || muted) return;
        const chord = AMBIENT_CHORDS[Math.floor(Math.random() * AMBIENT_CHORDS.length)];
        chord.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.value = freq;
            osc.detune.value = (Math.random() - 0.5) * 6;

            filter.type = 'lowpass';
            filter.frequency.value = 800 + Math.random() * 400;
            filter.Q.value = 0.5;

            const now = ctx.currentTime;
            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.04 * volume, now + 2);
            gain.gain.linearRampToValueAtTime(0.03 * volume, now + 6);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 10);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGain);
            osc.start(now);
            osc.stop(now + 10);

            ambientNodes.push({ osc, gain });
        });

        // Schedule next chord
        setTimeout(playNextPad, 8000 + Math.random() * 4000);
    }

    playNextPad();
}

export function stopAmbient() {
    ambientPlaying = false;
    const ctx = getCtx();
    ambientNodes.forEach(({ osc, gain }) => {
        try {
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1);
            osc.stop(ctx.currentTime + 1.5);
        } catch (e) {}
    });
    ambientNodes = [];
}

export function isAmbientPlaying() { return ambientPlaying; }

// ── Interaction Sound Effects (warm, filtered) ───────────────────────────

/** Soft bell ping when clicking a node */
export function soundNodeClick() {
    playTone(880, 0.25, 'sine', 0.35, { filterFreq: 3000, attack: 0.005 });
    playTone(1320, 0.18, 'sine', 0.15, { filterFreq: 2500, delay: 0.04 });
}

/** Deep warm pulse when engaging lock mode */
export function soundLockEngage() {
    playPad([110, 165, 220], 0.6, 0.25);
    playTone(55, 0.4, 'sine', 0.3, { filterFreq: 500, attack: 0.05 });
}

/** Soft release chime */
export function soundLockRelease() {
    playTone(440, 0.15, 'sine', 0.25, { filterFreq: 2000 });
    playTone(330, 0.12, 'sine', 0.2, { delay: 0.06, filterFreq: 1800 });
}

/** Gentle tick when navigating connections */
export function soundConnectionNav() {
    playTone(1200, 0.06, 'sine', 0.15, { filterFreq: 3000 });
}

/** Search modal open — rising whisper */
export function soundSearchOpen() {
    playTone(600, 0.1, 'sine', 0.15, { filterFreq: 2500 });
    playTone(800, 0.08, 'sine', 0.1, { delay: 0.04, filterFreq: 2200 });
}

/** Compare mode — two-tone harmony */
export function soundCompareEngage() {
    playPad([330, 415, 523], 0.4, 0.2);
}

/** Edge click — lower warm tone */
export function soundEdgeClick() {
    playTone(293, 0.2, 'triangle', 0.2, { filterFreq: 1500, attack: 0.01 });
    playTone(440, 0.15, 'sine', 0.12, { delay: 0.06, filterFreq: 2000 });
}

/** Theory switch — gentle sweeping arpeggio */
export function soundTheorySwitch() {
    const notes = [262, 330, 392, 523, 659];
    notes.forEach((f, i) => {
        playTone(f, 0.15, 'sine', 0.12, { delay: i * 0.06, filterFreq: 2000 + i * 200 });
    });
}

/** Data pulse — subtle radar blip */
export function soundDataPulse() {
    playTone(1800, 0.04, 'sine', 0.08, { filterFreq: 3500 });
}

/** Tour start — ascending pad */
export function soundTourStart() {
    playPad([262, 330, 392, 523], 0.8, 0.2);
}

/** Tour waypoint — gentle chime */
export function soundTourWaypoint() {
    playTone(523, 0.3, 'sine', 0.2, { filterFreq: 2500, attack: 0.02 });
    playTone(659, 0.35, 'sine', 0.15, { delay: 0.12, filterFreq: 2200 });
}

/** Tour end — resolution chord */
export function soundTourEnd() {
    playPad([392, 523, 659, 784], 1.0, 0.18);
}

// ── Volume/Mute Controls ─────────────────────────────────────────────────

export function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (masterGain) masterGain.gain.value = volume;
}

export function getVolume() { return volume; }

export function toggleMute() {
    muted = !muted;
    if (muted && ambientPlaying) stopAmbient();
    return muted;
}

export function isMuted() { return muted; }

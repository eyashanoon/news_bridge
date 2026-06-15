/**
 * lipsync.js
 * ─────────────────────────────────────────────────────────────
 * Rhubarb Lip-Sync mapping & animation driver.
 *
 * Responsibilities:
 *   1. Convert raw audio (ArrayBuffer) into a timed cue list
 *      using a lightweight phoneme-estimation algorithm.
 *      (Real Rhubarb WASM can be swapped in – see comments.)
 *   2. Drive the Three.js morph targets frame-by-frame during
 *      audio playback via an AudioContext + requestAnimationFrame.
 *
 * Rhubarb mouth-shape reference
 * ──────────────────────────────
 *   A  – /P/, /B/, /M/ (lips together)
 *   B  – /K/, /G/, /HH/, /R/ (slightly open)
 *   C  – /EH/, /IH/, /AH/ (more open)
 *   D  – /AE/, /AA/ (wide open)
 *   E  – /OW/, /AO/ (rounded)
 *   F  – /UW/, /OO/ (tight round)
 *   G  – /F/, /V/ (teeth on lip)
 *   H  – /L/, /N/, /TH/ (tongue up)
 *   X  – silence / rest
 * ─────────────────────────────────────────────────────────────
 */

import { setMorphTarget, resetMorphTargets, resetMouth, forceResetNonActive } from './scene.js';

// ── Sync offset ───────────────────────────────────────────
// Compensates for audio hardware / software output latency.
// Positive → cue lookup advances in time (cues fire earlier vs audio).
// Negative → cue lookup is delayed  (cues fire later  vs audio).
// Units: milliseconds.
// Default 100ms shifts cues forward to compensate for typical browser/OS
// audio output latency so the mouth leads the audio by the right amount.
export let syncOffsetMs = 100;
export function setSyncOffset(ms) { syncOffsetMs = ms; }

// ── Audio delay ───────────────────────────────────────────
// Animation clock starts immediately; audio is scheduled this
// many seconds later.  Lips are therefore this many seconds
// AHEAD of the audio — they lerp into shape before you hear it.
export let audioDelayS = 0.1;
export function setAudioDelay(s) { audioDelayS = s; }

// ── Phoneme → Rhubarb mouth-shape map ──────────────────────
const PHONEME_TO_SHAPE = {
  // Bilabials → A
  'p': 'A', 'b': 'A', 'm': 'A',
  // Mid-open → B
  'k': 'B', 'g': 'B', 'r': 'B', 'hh': 'B',
  // Front vowels → C
  'eh': 'C', 'ih': 'C', 'ah': 'C', 'iy': 'C',
  // Wide vowels → D
  'ae': 'D', 'aa': 'D', 'ay': 'D',
  // Round vowels → E
  'ow': 'E', 'ao': 'E', 'oy': 'E',
  // Tight round → F
  'uw': 'F', 'uh': 'F',
  // Labio-dentals → G
  'f': 'G', 'v': 'G',
  // Alveolars / tongue up → H
  'l': 'H', 'n': 'H', 'th': 'H', 'dh': 'H', 's': 'H', 'z': 'H',
  // Default / silence → X
  'sil': 'X', 'sp': 'X',
};

// ── Simple letter → ARPAbet approximation ──────────────────
// Used when a real phoneme backend is unavailable.
const LETTER_TO_PHONEME = {
  a:'ae', b:'b',  c:'k',  d:'dh', e:'eh', f:'f',  g:'g',
  h:'hh', i:'ih', j:'dh', k:'k',  l:'l',  m:'m',  n:'n',
  o:'ow', p:'p',  q:'k',  r:'r',  s:'s',  t:'th', u:'uh',
  v:'v',  w:'uw', x:'k',  y:'iy', z:'z',
};

// ── Public: build a cue list from text + duration ───────────
/**
 * Generates an array of { time, shape } cues from plain text.
 * Each cue holds the Rhubarb shape letter active at `time` seconds.
 *
 * For production quality, replace this function body with a
 * call to the Rhubarb WASM library passing the audio buffer.
 *
 * @param {string} text          - The spoken sentence
 * @param {number} durationSec   - Total audio duration in seconds
 * @returns {{ time: number, shape: string }[]}
 */
export function buildCuesFromText(text, durationSec) {
  // Strip punctuation, lower-case, split into characters
  const letters = text.toLowerCase().replace(/[^a-z\s]/g, '').split('');

  // Remove spaces and silence-pad at start & end
  const phonemes = ['sil', ...letters.map(c => LETTER_TO_PHONEME[c] || 'sil'), 'sil'];

  // Distribute phonemes evenly over the duration
  const step = durationSec / phonemes.length;

  return phonemes.map((ph, i) => ({
    time:  i * step,
    shape: PHONEME_TO_SHAPE[ph] ?? 'X',
  }));
}

// ── Public: build cue list from a Rhubarb JSON file ─────────
/**
 * Parses the JSON output of the real Rhubarb CLI / WASM.
 * Expected format:
 *   { "mouthCues": [{ "start": 0.0, "end": 0.1, "value": "A" }, …] }
 *
 * @param {object} rhubarbJson
 * @returns {{ time: number, shape: string }[]}
 */
export function buildCuesFromRhubarbJSON(rhubarbJson) {
  console.log("buildCuesFromRhubarbJSON called with:", rhubarbJson);
  return (rhubarbJson.mouthCues ?? []).map(cue => ({
    time:  cue.start,
    shape: cue.value,
  }));
}

// ── Private: slice an AudioBuffer into per-cue sections ──────
// Each section holds exactly the PCM samples for one mouth-shape window.
// Having per-section buffers lets the playback engine pre-schedule every
// section as a separate AudioBufferSourceNode, so the shape change and the
// audio change are guaranteed to happen at the same sample-accurate instant.
//   audioCtx      – AudioContext (only used for createBuffer)
//   decodedBuffer – the full speech AudioBuffer
//   cues          – [{ time: number, shape: string }]
// Returns [{ shape, start, end, buffer: AudioBuffer }]
function buildSections(audioCtx, decodedBuffer, cues) {
  const sr    = decodedBuffer.sampleRate;
  const numCh = decodedBuffer.numberOfChannels;
  const total = decodedBuffer.length;
  return cues.map((cue, i) => {
    const start = cue.time;
    const end   = cues[i + 1]?.time ?? decodedBuffer.duration;
    const s0    = Math.round(start * sr);
    const s1    = Math.min(Math.round(end * sr), total);
    const len   = Math.max(1, s1 - s0);
    const buf   = audioCtx.createBuffer(numCh, len, sr);
    for (let ch = 0; ch < numCh; ch++) {
      const srcData = decodedBuffer.getChannelData(ch);
      const dstData = buf.getChannelData(ch);
      for (let j = 0; j < len; j++) dstData[j] = srcData[s0 + j] ?? 0;
    }
    return { shape: cue.shape, start, end, buffer: buf };
  });
}

// ── Public: build cues from the real audio waveform ─────────
/**
 * Analyses a decoded AudioBuffer to produce lip-sync cues that
 * track actual sound energy.  The mouth opens when the signal is
 * loud, closes during genuine silence — far more accurate than
 * the text-based estimator which just spreads letters uniformly.
 *
 * Algorithm
 * ─────────
 * 1. Compute RMS energy in 25 ms hops.
 * 2. Smooth with a 3-frame moving average.
 * 3. Map energy level to a mouth shape:
 *      silence  (<8% of peak)  → X  (closed)
 *      soft     (<40% of peak) → B  (slightly open)
 *      medium   (<70% of peak) → C  (open)
 *      loud     (≥70% of peak) → D  (wide open)
 * 4. Every ~75 ms during speech, insert a transitional shape
 *    (E or C) to add variety and prevent a "frozen" look.
 * 5. Emit a cue only when the shape changes (minimal cue list).
 * 6. Always append a terminal X cue so the mouth closes cleanly
 *    when the audio buffer ends.
 *
 * @param {AudioBuffer} audioBuffer - decoded by an AudioContext
 * @returns {{ time: number, shape: string }[]}
 */
export function buildCuesFromAudio(audioBuffer) {
  const data = audioBuffer.getChannelData(0);
  const sr   = audioBuffer.sampleRate;
  const HOP  = Math.floor(sr * 0.025); // 25 ms per frame

  // ── RMS energy per frame ────────────────────────────────
  const energies = [];
  for (let i = 0; i + HOP <= data.length; i += HOP) {
    let sum = 0;
    for (let j = 0; j < HOP; j++) sum += data[i + j] ** 2;
    energies.push(Math.sqrt(sum / HOP));
  }

  // ── 3-frame moving-average smoothing ────────────────────
  const smoothed = energies.map((_, i) => {
    const lo = Math.max(0, i - 1), hi = Math.min(energies.length - 1, i + 1);
    let s = 0, n = 0;
    for (let k = lo; k <= hi; k++) { s += energies[k]; n++; }
    return s / n;
  });

  const peak    = Math.max(...smoothed, 1e-6);
  const silGate = peak * 0.08; // 8% of peak = silence threshold

  const cues = [];
  let prev      = null;
  let speechRun = 0; // consecutive speech frames counter

  for (let i = 0; i < smoothed.length; i++) {
    const t = (i * HOP) / sr;
    const e = smoothed[i];
    let shape;

    if (e < silGate) {
      shape     = 'X';
      speechRun = 0;
    } else {
      const norm = e / peak;
      speechRun++;

      // Map loudness to mouth openness
      if      (norm > 0.70) shape = 'D';  // loud  → wide open
      else if (norm > 0.40) shape = 'C';  // mid   → open
      else                  shape = 'B';  // soft  → slightly open

      // Every ~3 frames (≈75 ms) insert a transitional shape for
      // variety — prevents the mouth looking rigidly frozen on one pose.
      if (speechRun % 3 === 0) shape = (speechRun % 6 === 0) ? 'E' : 'C';
    }

    // Only emit a cue on shape change to keep the list small
    if (shape !== prev) {
      cues.push({ time: t, shape });
      prev = shape;
    }
  }

  // Guarantee the list always ends with silence so the mouth
  // closes cleanly when source.onended fires.
  if (!cues.length || cues[cues.length - 1].shape !== 'X') {
    cues.push({ time: audioBuffer.duration, shape: 'X' });
  }

  return cues;
}

// ── Public: play audio + animate lip-sync ───────────────────
/**
 * Decodes the audio blob, plays it via Web Audio API, and
 * drives the morph targets in sync.
 *
 * For the 'browser' TTS provider the blob is empty; in that
 * case we animate against wall-clock time while SpeechSynthesis
 * is speaking.
 *
 * @param {Blob}   audioBlob
 * @param {{ time: number, shape: string }[]} cues
 * @param {number} durationSec  - used for browser-TTS path
 * @returns {Promise<void>}     - resolves when playback ends
 */
export async function playWithLipSync(audioBlob, cues, durationSec, options = {}) {
  resetMorphTargets();
  _prevShape = null; // clear shape-change tracker for this session

  if (audioBlob.size === 0) {
    // ── Browser TTS path: animate against elapsed time ──────
    
    return _animateBrowserTTS(cues, durationSec, options);
  }

  // ── Web Audio path ───────────────────────────────────────
  // Accepts an externally-created AudioContext and/or a pre-decoded
  // AudioBuffer so main.js can avoid a second decode pass.
  // If neither is supplied we create our own and decode here.
  const { audioCtx: extCtx, audioDest, decodedBuffer: extDecoded } = options;
  const ctx     = extCtx ?? new AudioContext();
  await ctx.resume(); // no-op if already running; needed in some browsers
  const decoded = extDecoded ?? await ctx.decodeAudioData(await audioBlob.arrayBuffer());

  if (!cues.length) return;

  // Play the FULL buffer as one continuous AudioBufferSourceNode — no splits,
  // no gaps.  Shape changes are driven by setTimeout scheduled against the
  // Web Audio clock so they fire at exactly the right moment.
  return new Promise(resolve => {
    let finished  = false;
    let rafId     = null;
    let prevShape = null;

    function cleanup() {
      if (finished) return;
      finished = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (src) { src.onended = null; try { src.stop(); } catch (_) {} }
      resetMorphTargets();
      if (!extCtx) ctx.close();
      resolve();
    }

    // Audio starts SHAPE_LEAD_S seconds from now.  By measuring elapsed time
    // from playCallTime we get a built-in look-ahead of SHAPE_LEAD_S — shapes
    // fire this many ms before their phoneme audio arrives so the lerp settles.
    // 150ms gives ~100ms of settled-shape margin even at 30fps with frame jitter.
    const SHAPE_LEAD_S = 0.15;
    const playCallTime = ctx.currentTime;
    const startAt      = playCallTime + SHAPE_LEAD_S;

    const src = ctx.createBufferSource();
    src.buffer = decoded;
    src.connect(ctx.destination);
    if (audioDest) src.connect(audioDest);
    src.start(startAt);
    src.onended = () => cleanup();

    // RAF loop: poll the hardware-accurate audio clock every frame.
    // Subtracts ctx.outputLatency so shapes lead by SHAPE_LEAD_S relative to
    // what is actually heard. Chrome on Windows has outputLatency ~100ms;
    // without this the mouth moves ~250ms ahead of the audio in Chrome.
    function tick() {
      if (finished) return;
      const outputLat = ctx.outputLatency || 0;
      const pos = Math.max(0, ctx.currentTime - playCallTime - outputLat);
      let shape = null;
      for (const cue of cues) {
        if (cue.time <= pos) shape = cue.shape;
        else break;
      }
      if (shape !== null && shape !== prevShape) {
        _applyShape(shape);
        prevShape = shape;
      }
      rafId = requestAnimationFrame(tick);
    }
    tick();
  });
}

// ── Private: browser TTS animation ─────────────────────────
//
// startWall – performance.now() captured at utter.onstart (actual audio
//             output start). Using this instead of capturing it here
//             eliminates the async-chain delay (~100-300ms) that caused
//             the mouth to visibly lag behind the voice.
//
// endedPromise – resolves on utter.onend (real speech completion).
//               Replaces the word-count duration estimate so the mouth
//               closes exactly when the voice stops, even for complex or
//               slow speech.
function _animateBrowserTTS(cues, durationSec, { startWall: _startWall, endedPromise, isSpeakingFn } = {}) {
  _prevShape = null;
  return new Promise(resolve => {
    const startWall = _startWall ?? performance.now();
    let stopped = false;
    let rafId;
    let safetyTimer;

    function stop() {
      if (stopped) return;
      stopped = true;
      cancelAnimationFrame(rafId);
      clearTimeout(safetyTimer);
      resetMouth();
      resolve();
    }

    // Primary stop A: speech engine signals completion via onend.
    if (endedPromise) {
      endedPromise.then(stop);
    }

    // Safety stop: fires durationSec + 1s after speech started.
    // Catches the case where both onend and isSpeakingFn fail.
    safetyTimer = setTimeout(stop, (durationSec + 1) * 1000);

    const animate = () => {
      if (stopped) return;

      // Primary stop B: poll speechSynthesis.speaking every frame.
      // This is the most reliable signal — it goes false the instant
      // the browser stops producing audio, even when onend doesn't fire.
      if (isSpeakingFn && !isSpeakingFn()) {
        stop();
        return;
      }

      const elapsed = (performance.now() - startWall) / 1000 + (syncOffsetMs / 1000);
      _applyShapeAtTime(cues, Math.max(0, elapsed));
      rafId = requestAnimationFrame(animate);
    };

    animate();
  });
}

// ── Private: shape-change tracker (module-level) ──────────
let _prevShape = null;

// ── Private: apply one specific shape to the 3D face ────────
// Called directly by the Web Audio pointer-based loop, and by
// _applyShapeAtTime which is used by the browser TTS path.
//
// On SHAPE CHANGE:
//   1. Hard-zero all outgoing shapes (no lerp) → prevents mushy overlap.
//   2. Only the new shape lerps up from 0 → target.
// For 'X' (silence): all speech shapes zeroed → mouth closes.
function _applyShape(shape) {
  if (shape !== _prevShape) {
    forceResetNonActive(shape);
    _prevShape = shape;
  }
  const SPEECH = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
  if (shape === 'X') {
    // X = 1.0 → closed mouth. A–H = 0.0 → no speech shapes active.
    setMorphTarget('X', 1.0);
    SPEECH.forEach(s => setMorphTarget(s, 0.0));
  } else {
    // Active letter = 1.0, X = 0.0, all others = 0.0.
    setMorphTarget('X', 0.0);
    SPEECH.forEach(s => setMorphTarget(s, s === shape ? 1.0 : 0.0));
  }
}

// ── Private: find the active shape at time t and apply it ────
// Used only by the browser TTS path (_animateBrowserTTS).
// That path cannot use the pointer pattern because the browser's
// speech synthesiser does not expose a precise playback clock —
// we only have wall-clock elapsed time, which can drift, so we
// must be able to seek to any point in the cue list at any time.
function _applyShapeAtTime(cues, t) {
  if (!cues.length) return;
  // Binary-search for the last cue whose time ≤ t
  let lo = 0, hi = cues.length - 1, idx = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (cues[mid].time <= t) { idx = mid; lo = mid + 1; }
    else                     { hi = mid - 1; }
  }
  _applyShape(cues[idx].shape);
}

/**
 * gestures.js
 *
 * State machine (per hand):
 *   HOME(R3) → NEAR (R4, both hands on first step)
 *   NEAR(R4) → NEAR-ALT(R5) | FAR(R1/R2)
 *   FAR(R1)  → FAR-ALT(R2) | WAVE(H1/P1)   ← wave only reachable from FAR
 *   WAVE(H1) → WAVE-ALT(P1) [optional swap during hold] → return to FAR
 *   any      → HOME (mandatory final step)
 *
 * Wave timing: natural speed — 1100 ms UP · 450 ms hold · 1000 ms DOWN.
 * 50% chance the hand swaps H1↔P1 during the hold before lowering.
 */

import { animatePartPose, capturePartialPose, PART_BONES } from './scene.js';

// ── Pose pools ────────────────────────────────────────────────
const HOME = { R: 'rr3', L: 'rl3' };
const POOL = {
  R: { near: ['rr4', 'rr5'], far: ['rr1', 'rr2'], wave: ['hr1', 'pr1'] },
  L: { near: ['rl4', 'rl5'], far: ['rl1', 'rl2'], wave: ['hl1', 'pl1'] },
};

const LEGACY_SEQUENCE = [
  { R: 'rr3', L: 'rl3' },
  { R: 'rr5', L: 'rl3' },
  { R: 'rr3', L: 'rl3' },
  { R: 'rr3', L: 'rl5' },
  { R: 'rr3', L: 'rl3' },
  { R: 'rr2', L: 'rl1' },
  { R: 'rr3', L: 'rl3' },
  { R: 'rr1', L: 'rl2' },
  { R: 'rr3', L: 'rl3' },
];

const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const other = (arr, cur) => arr.find(x => x !== cur) ?? arr[0];

const clamp01 = v => Math.max(0, Math.min(1, Number(v) || 0));
const clampMs = (v, min, max) => Math.max(min, Math.min(max, Math.round(v)));

const DEFAULT_PROFILE = {
  enabled: true,
  energy: 0.5,
  expressiveness: 0.45,
  urgency: 0.25,
  mode: 'neutral',
};

function normalizeProfile(profile) {
  if (!profile) return { ...DEFAULT_PROFILE };
  return {
    enabled: profile.enabled !== false,
    energy: clamp01(profile.energy),
    expressiveness: clamp01(profile.expressiveness),
    urgency: clamp01(profile.urgency),
    mode: profile.mode === 'urgent' || profile.mode === 'calm' ? profile.mode : 'neutral',
  };
}

function legacyGestureCount(durationSec) {
  return Math.max(1, Math.min(6, Math.round(durationSec / 60 * 1.2 + 0.3)));
}

function waveTimings(profile) {
  if (profile.mode === 'calm') {
    return { up: 1850, hold: 340, alt: 1120, down: 1760 };
  }
  if (profile.mode === 'urgent') {
    return { up: 1260, hold: 260, alt: 780, down: 1200 };
  }
  // Neutral mode: natural human range.
  return {
    up:   clampMs(1750 - profile.urgency * 320 - profile.energy * 195, 1260, 2000),
    hold: clampMs( 350 + profile.expressiveness * 320, 300, 760),
    alt:  clampMs(1060 - profile.urgency * 195, 730, 1200),
    down: clampMs(1680 - profile.urgency * 265 - profile.energy * 125, 1260, 1960),
  };
}

// ── Gesture count by audio duration ──────────────────────────
function gestureCount(durationSec) {
  if (durationSec <   5) return 1;
  if (durationSec <  15) return 2;
  if (durationSec <  30) return 3;
  if (durationSec <  60) return 4;
  if (durationSec < 120) return 5;
  return 6;
}

// ── Sequence builder ──────────────────────────────────────────
/**
 * Returns an array of step objects.
 * Normal step:  { R, L, ms, wave:false, weight }
 * Wave step:    { R, L, ms, wave:true, holdMs, altR, altL, altMs,
 *                 retR, retL, retMs, weight }
 * `weight` ≈ real-world duration in seconds, used to spread timing.
 */
function buildSequence(n, profile) {
  const steps = [];
  let stateR = 'home', poseR = HOME.R;
  let stateL = 'home', poseL = HOME.L;
  let wavesUsed = 0;
  const maxWaves = profile.mode === 'calm'
    ? 1
    : profile.mode === 'urgent'
      ? Math.min(4, Math.floor(n / 2) + 2)
      : Math.min(3, Math.floor(n / 2) + Math.round(profile.expressiveness));
  const t = waveTimings(profile);

  // ── Step 0: always R3 → R4, BOTH hands ───────────────────
  const openingMs = profile.mode === 'calm'
    ? 1800
    : profile.mode === 'urgent'
      ? 1290
      : clampMs(1600 - profile.urgency * 250 + (1 - profile.energy) * 125, 1290, 1890);
  steps.push({ R: 'rr4', L: 'rl4', ms: openingMs, wave: false, weight: openingMs / 760 });
  stateR = 'near'; poseR = 'rr4';
  stateL = 'near'; poseL = 'rl4';

  // ── Steps 1 … n-1 ────────────────────────────────────────
  for (let i = 1; i < n; i++) {
    const remaining = n - i;

    // Waves are only allowed from FAR — never from HOME or NEAR
    const eligR  = stateR === 'far';
    const eligL  = stateL === 'far';
    const canWave = wavesUsed < maxWaves && remaining >= 2 && (eligR || eligL);
    const waveChance = profile.mode === 'calm'
      ? 0.08
      : profile.mode === 'urgent'
        ? 0.58
        : 0.22 + profile.expressiveness * 0.30 + profile.energy * 0.10;
    const doWave  = canWave && Math.random() < waveChance;

    if (doWave) {
      const hand   = (eligR && eligL) ? (Math.random() < 0.5 ? 'R' : 'L') : (eligR ? 'R' : 'L');
      const wPool  = POOL[hand].wave;
      const wKey   = pick(wPool);
      const altKey = other(wPool, wKey);      // H1↔P1
      const retKey = pick(POOL[hand].far);    // return to FAR after wave
      const doAlt  = Math.random() < (profile.mode === 'urgent' ? 0.72 : 0.5); // swap H1↔P1?

      steps.push({
        R: hand === 'R' ? wKey : null,
        L: hand === 'L' ? wKey : null,
        ms: t.up, wave: true,
        holdMs: doAlt ? 0 : t.hold,           // if swapping, alt fires right after UP
        altR:  (doAlt && hand === 'R') ? altKey : null,
        altL:  (doAlt && hand === 'L') ? altKey : null,
        altMs: t.alt,
        retR:  hand === 'R' ? retKey : null,
        retL:  hand === 'L' ? retKey : null,
        retMs: t.down,
        weight: ((doAlt ? t.up + t.alt : t.up + t.hold) + t.down + 260) / 1000,
      });
      // state stays 'far' — wave auto-returns to FAR
      wavesUsed++;
      continue;
    }

    // ── Normal position move ──────────────────────────────
    const moveBoth = profile.mode === 'calm'
      ? Math.random() < 0.18
      : profile.mode === 'urgent'
        ? Math.random() < 0.78
        : Math.random() < (0.25 + profile.energy * 0.35);
    const primary  = moveBoth ? 'both' : (Math.random() < 0.5 ? 'R' : 'L');
    let pR = null, pL = null;

    const advance = (side) => {
      const st  = side === 'R' ? stateR : stateL;
      const cur = side === 'R' ? poseR  : poseL;
      const pl  = POOL[side];
      if (st === 'near') {
        // Calm stays near more; urgent pushes to far more.
        const toFar = profile.mode === 'calm' ? 0.35 : profile.mode === 'urgent' ? 0.82 : 0.6;
        if (Math.random() < toFar) return [pick(pl.far),        'far' ];
        else                     return [other(pl.near, cur), 'near'];
      } else { // 'far'
        // Calm retreats to near quickly; urgent stays in far longer.
        const stayFar = profile.mode === 'calm' ? 0.20 : profile.mode === 'urgent' ? 0.70 : 0.4;
        if (Math.random() < stayFar) return [other(pl.far, cur), 'far' ];
        else                     return [pick(pl.near),       'near'];
      }
    };

    if (primary === 'R' || primary === 'both') { const [p, s] = advance('R'); pR = p; stateR = s; poseR = p; }
    if (primary === 'L' || primary === 'both') { const [p, s] = advance('L'); pL = p; stateL = s; poseL = p; }

    if (pR || pL) {
      const ms = profile.mode === 'calm'
        ? 1750
        : profile.mode === 'urgent'
          ? 1150
          : clampMs(1510 - profile.urgency * 250 - profile.energy * 170, 1150, 1750);
      steps.push({ R: pR, L: pL, ms, wave: false, weight: ms / 760 });
    }
  }

  // ── Final: both hands return HOME ─────────────────────────
  const closeMs = profile.mode === 'calm'
    ? 1800
    : profile.mode === 'urgent'
      ? 1260
      : clampMs(1570 - profile.urgency * 195 + (1 - profile.energy) * 140, 1260, 1890);
  steps.push({ R: HOME.R, L: HOME.L, ms: closeMs, wave: false, weight: closeMs / 760 });
  return steps;
}

// ── Timer store ───────────────────────────────────────────────
let _timers = [];

// ── Fire a single step ────────────────────────────────────────
function _fire(step, allPoses) {
  if (step.wave) {
    // UP
    if (step.R) { const p = allPoses.R?.[step.R]; if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, step.ms); }
    if (step.L) { const p = allPoses.L?.[step.L]; if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, step.ms); }

    if (step.altR || step.altL) {
      // Optional H1↔P1 swap: fires after UP, then DOWN fires after swap
      const t1 = setTimeout(() => {
        if (step.altR) { const p = allPoses.R?.[step.altR]; if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, step.altMs); }
        if (step.altL) { const p = allPoses.L?.[step.altL]; if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, step.altMs); }
        const t2 = setTimeout(() => {
          if (step.retR) { const p = allPoses.R?.[step.retR]; if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, step.retMs); }
          if (step.retL) { const p = allPoses.L?.[step.retL]; if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, step.retMs); }
        }, step.altMs + 50);
        _timers.push(t2);
      }, step.ms + step.holdMs);
      _timers.push(t1);
    } else {
      // No swap: DOWN fires after UP + hold
      const t1 = setTimeout(() => {
        if (step.retR) { const p = allPoses.R?.[step.retR]; if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, step.retMs); }
        if (step.retL) { const p = allPoses.L?.[step.retL]; if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, step.retMs); }
      }, step.ms + step.holdMs);
      _timers.push(t1);
    }
  } else {
    if (step.R) { const p = allPoses.R?.[step.R]; if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, step.ms); }
    if (step.L) { const p = allPoses.L?.[step.L]; if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, step.ms); }
  }
}

// ── scheduleGestures ──────────────────────────────────────────
export function scheduleGestures(durationMs, allPoses, profile = null) {
  cancelGestures();
  const motion = normalizeProfile(profile);

  if (!motion.enabled) {
    const n = legacyGestureCount(durationMs / 1000);
    const span = durationMs * 0.85;
    for (let i = 0; i < n; i++) {
      const delay = n === 1 ? 0 : Math.round(i * span / (n - 1));
      const step = LEGACY_SEQUENCE[i % LEGACY_SEQUENCE.length];
      _timers.push(setTimeout(() => {
        const poseR = allPoses.R?.[step.R];
        const poseL = allPoses.L?.[step.L];
        if (poseR) animatePartPose('R', capturePartialPose(PART_BONES.R), poseR, 1100);
        if (poseL) animatePartPose('L', capturePartialPose(PART_BONES.L), poseL, 1100);
      }, delay));
    }
    return;
  }

  // t = 0: establish HOME for both hands
  const homeR = allPoses.R?.[HOME.R];
  const homeL = allPoses.L?.[HOME.L];
  if (homeR) animatePartPose('R', capturePartialPose(PART_BONES.R), homeR, 1000);
  if (homeL) animatePartPose('L', capturePartialPose(PART_BONES.L), homeL, 1000);

  const baseN = Math.max(2, gestureCount(durationMs / 1000));
  const n = motion.mode === 'urgent'
    ? Math.min(8, baseN + 2)
    : motion.mode === 'calm'
      ? Math.max(2, baseN - 1)
      : baseN;
  const steps = buildSequence(n, motion);

  // Body steps spread proportionally from firstAt to just before finalAt.
  // Final HOME fires exactly at finalAt so it always lands at 88% of audio.
  const firstAt    = motion.mode === 'urgent' ? 900 : motion.mode === 'calm' ? 1550 : 1200;
  const finalAt    = Math.round(durationMs * (motion.mode === 'urgent' ? 0.93 : motion.mode === 'calm' ? 0.84 : 0.88));
  const bodySteps  = steps.slice(0, -1);
  const finalStep  = steps[steps.length - 1];
  const totalBodyW = bodySteps.reduce((sum, s) => sum + s.weight, 0);
  const scale      = totalBodyW > 0 ? Math.max(0, finalAt - firstAt) / totalBodyW : 0;

  let cursor = firstAt;
  bodySteps.forEach(step => {
    const delay = Math.round(cursor);
    _timers.push(setTimeout(() => _fire(step, allPoses), delay));
    cursor += step.weight * scale;
  });

  // Final HOME: always at finalAt
  _timers.push(setTimeout(() => _fire(finalStep, allPoses), finalAt));
}

// ── cancelGestures ────────────────────────────────────────────
export function cancelGestures() {
  _timers.forEach(clearTimeout);
  _timers = [];
}

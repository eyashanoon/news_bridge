/**
 * Default hand animation for the AI Presenter (saved from Lip Sync Lab).
 * Persisted on disk via GET/POST /api/presenter-animation (see vite-plugins/avatarStudioApi.js).
 */
import { animatePartPose, capturePartialPose, PART_BONES } from './scene.js';

let _timers = [];

export const EMPTY_ANIMATION = { startR: '', startL: '', keyframes: [] };

export async function fetchPresenterAnimation() {
  try {
    const res = await fetch('/api/presenter-animation');
    if (!res.ok) return { ...EMPTY_ANIMATION };
    const data = await res.json();
    return {
      startR: data.startR ?? '',
      startL: data.startL ?? '',
      keyframes: Array.isArray(data.keyframes) ? data.keyframes : [],
    };
  } catch {
    return { ...EMPTY_ANIMATION };
  }
}

export async function savePresenterAnimation(config) {
  const res = await fetch('/api/presenter-animation', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startR: config.startR ?? '',
      startL: config.startL ?? '',
      keyframes: Array.isArray(config.keyframes) ? config.keyframes : [],
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Save failed (${res.status})`);
  }
  return res.json();
}

export function hasPresenterAnimation(config) {
  if (!config) return false;
  return Boolean(
    config.startR ||
    config.startL ||
    (config.keyframes?.length > 0)
  );
}

export function cancelPresenterAnimation() {
  _timers.forEach(clearTimeout);
  _timers = [];
}

/** Play the saved default animation over the speech duration. */
export function schedulePresenterAnimation(durationMs, allPoses, config) {
  cancelPresenterAnimation();
  if (!hasPresenterAnimation(config)) return;

  if (config.startR) {
    const p = allPoses.R?.[config.startR];
    if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, 1000);
  }
  if (config.startL) {
    const p = allPoses.L?.[config.startL];
    if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, 1000);
  }

  for (const kf of config.keyframes) {
    const delay = Math.round((kf.frac ?? 0) * durationMs);
    const part = kf.hand === 'L' ? 'L' : 'R';
    const poseData = allPoses[part]?.[kf.pose];
    if (!poseData) continue;
    _timers.push(setTimeout(() => {
      animatePartPose(part, capturePartialPose(PART_BONES[part]), poseData, 1100);
    }, delay));
  }
}

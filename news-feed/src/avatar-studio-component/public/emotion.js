/**
 * emotion.js
 * Lightweight text emotion analysis for gesture/tone direction.
 *
 * Returns normalized controls:
 * - tts.rate        : speech speed for presenter delivery
 * - gesture.energy  : how dynamic hand movement should be
 * - gesture.expressiveness : wave/alt usage and variation
 * - gesture.urgency : how brisk transitions should feel
 */

const LEXICON = {
  urgency: [
    'breaking', 'urgent', 'alert', 'warning', 'immediately', 'critical',
    'emergency', 'live', 'update', 'now', 'just in',
  ],
  confidence: [
    'confirmed', 'official', 'according', 'reported', 'announced', 'today',
    'evidence', 'analysis', 'statement', 'sources', 'verified',
  ],
  positive: [
    'improve', 'improved', 'growth', 'progress', 'success', 'win', 'hope',
    'agreement', 'breakthrough', 'stable', 'optimistic',
  ],
  negative: [
    'decline', 'drop', 'loss', 'crisis', 'risk', 'concern', 'threat',
    'conflict', 'injury', 'death', 'fail', 'failed', 'problem',
  ],
};

const clamp01 = n => Math.max(0, Math.min(1, n));
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function scoreWords(text, words) {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const w of words) {
    if (lower.includes(w)) hits++;
  }
  return hits;
}

function scorePunctuation(text) {
  const ex = (text.match(/!/g) || []).length;
  const qn = (text.match(/\?/g) || []).length;
  const up = (text.match(/\b[A-Z]{3,}\b/g) || []).length;
  return { ex, qn, up };
}

function classifyMode(urgency, expressiveness) {
  const score = urgency * 0.7 + expressiveness * 0.3;
  if (score >= 0.50) return 'urgent';
  if (score <= 0.25) return 'calm';
  return 'neutral';
}

export function analyzeSpeechDirectives(text) {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  const urgencyHits = scoreWords(text, LEXICON.urgency);
  const confHits = scoreWords(text, LEXICON.confidence);
  const posHits = scoreWords(text, LEXICON.positive);
  const negHits = scoreWords(text, LEXICON.negative);
  const p = scorePunctuation(text);

  // Keep denominator smaller so short scripts still produce visible variation.
  const normBase = Math.max(2, Math.round(words / 22));
  const emphasis = clamp01((p.ex * 0.7 + p.up * 0.55 + p.qn * 0.35) / Math.max(1, normBase));

  const urgency = clamp01((urgencyHits * 1.25 + p.ex * 1.1 + p.up * 0.9 + p.qn * 0.35) / normBase);
  const confidence = clamp01((confHits * 1.1 + Math.max(0, words - 35) / 18) / normBase);
  const polarity = clamp01((posHits + negHits * 1.2 + p.ex * 0.15) / normBase);

  // Keep speech rate at normal speed regardless of emotion.
  // Gesture mode, voice choice, and SSML style already convey the emotional tone.
  const clampedRate = 1.0;
  const pitch = clamp(-2 + urgency * 7 + confidence * 1.5 - polarity * 2, -4, 6);

  // Stronger gesture profile so hand movement visibly changes per script tone.
  const energy = clamp01(0.12 + urgency * 0.78 + confidence * 0.23 + emphasis * 0.20);
  const expressiveness = clamp01(0.10 + urgency * 0.62 + polarity * 0.30 + emphasis * 0.34);
  const mode = classifyMode(urgency, expressiveness);
  const voice = mode === 'urgent' ? 'en-US-ChristopherNeural' : mode === 'calm' ? 'en-US-GuyNeural' : 'en-US-AndrewNeural';
  const style = mode === 'urgent' ? 'newscast' : mode === 'calm' ? 'newscast-formal' : 'newscast-formal';

  return {
    summary: {
      urgency,
      confidence,
      polarity,
    },
    tts: {
      rate: clampedRate,
      pitch,
      voice,
      style,
    },
    gesture: {
      energy,
      expressiveness,
      urgency,
      mode,
    },
  };
}

/**
 * tts.js
 * ─────────────────────────────────────────────────────────────
 * Text-to-Speech integration.
 *
 * Supports three providers – configure via TTS_PROVIDER below:
 *   'elevenlabs' | 'openai' | 'browser'
 *
 * 'browser' uses the Web Speech API (free, no API key needed)
 *  and produces a dummy timing array so the lip-sync system
 *  still animates the mouth.
 *
 * For production, set TTS_PROVIDER to 'elevenlabs' or 'openai'
 * and fill in your API key and voice ID in the CONFIG block.
 * ─────────────────────────────────────────────────────────────
 */

// ── Configuration ───────────────────────────────────────────
// Change TTS_PROVIDER to switch backends.
//
// 'streamelements' – FREE, no API key. Uses Amazon Polly via StreamElements.
//                    Returns a real MP3 so audio is embedded in the video.
// 'elevenlabs'      – High-quality, requires API key.
// 'openai'          – Good quality, requires API key.
// 'browser'         – No key, but audio CANNOT be captured into the video
//                    (Web Speech API limitation).
const TTS_PROVIDER = 'azure';

const CONFIG = {
  // Azure Cognitive Services Speech (recommended — returns viseme timing alongside audio).
  // Served by the Vite dev-server plugin at /api/azure-tts.
  // Set AZURE_SPEECH_KEY + AZURE_SPEECH_REGION in vite.config.js (or env vars).
  // Uses the same neural voices as Edge TTS but with per-phoneme mouth-shape timing.
  azure: {
    voice: 'en-US-AndrewNeural',
  },

  // Microsoft Edge Neural TTS (free fallback, no API key).
  // Served by the Vite dev-server plugin at /api/tts-edge.
  // Voice: en-US-AndrewNeural — the youngest/most casual-sounding
  // male voice in the Edge TTS catalog; approximate teen register.
  edge: {
    voice: 'en-US-AndrewNeural',
  },

  // Google Translate TTS (free, no API key).
  // Proxied through Vite dev server at /api/tts to avoid CORS.
  // lang: any BCP-47 language tag supported by Google Translate.
  google: {
    lang: 'en',
    speed: '1',   // 0.24 – 1.0
  },
  // StreamElements (was free, now requires API key — keep for reference)
  streamelements: {
    voice: 'Joanna',
    endpoint: 'https://api.streamelements.com/kappa/v2/speech',
  },

  elevenlabs: {
    apiKey:  'YOUR_ELEVENLABS_API_KEY',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // "Bella" – expressive, friendly
    modelId: 'eleven_turbo_v2',
    endpoint: 'https://api.elevenlabs.io/v1/text-to-speech',
  },
  openai: {
    apiKey: 'YOUR_OPENAI_API_KEY',
    voice:  'nova',   // expressive female voice
    model:  'tts-1',
    endpoint: 'https://api.openai.com/v1/audio/speech',
  },
};

// Runtime flag: once Azure fails with a configuration/service error,
// skip Azure calls for the rest of the page session and use Edge directly.
let _azureTemporarilyDisabled = false;

// ── Public: synthesise speech ───────────────────────────────
/**
 * Converts text to speech audio.
 *
 * @param {string} text
 * @returns {Promise<{ audioBlob: Blob, durationSec: number }>}
 *          audioBlob – PCM/MP3 audio ready for an AudioContext
 *          durationSec – approximate duration (used for dummy timing)
 */
export async function synthesise(text, opts = {}) {
  if (opts.enhanced === false) {
    return _edge(text, { voice: CONFIG.edge.voice, rate: 0.9 });
  }
  switch (TTS_PROVIDER) {
    case 'azure':          return _azureWithEdgeFallback(text, opts);
    case 'edge':           return _edge(text, opts);
    case 'google':         return _google(text);
    case 'streamelements': return _streamelements(text);
    case 'elevenlabs':     return _elevenlabs(text);
    case 'openai':         return _openai(text);
    case 'browser':        return _browser(text);
    default:
      throw new Error(`[tts] Unknown provider: ${TTS_PROVIDER}`);
  }
}

async function _azureWithEdgeFallback(text, opts = {}) {
  if (_azureTemporarilyDisabled) {
    return _edge(text, opts);
  }
  try {
    return await _azure(text, opts);
  } catch (err) {
    console.warn('[tts] Azure unavailable, falling back to Edge:', err?.message || err);
    const msg = String(err?.message || err || '').toLowerCase();
    if (msg.includes('azure key not configured') || msg.includes('503') || msg.includes('service unavailable')) {
      _azureTemporarilyDisabled = true;
    }
    return _edge(text, opts);
  }
}

// ── Azure Cognitive Services Speech (recommended) ─────────────
// Calls /api/azure-tts (Vite plugin). Returns MP3 audio AND viseme-timed
// cues in one round-trip — sync is perfect because timing comes from the
// same synthesis pass that produced the audio.
async function _azure(text, opts = {}) {
  const voice = opts.voice || CONFIG.azure.voice;
  const style = opts.style || 'newscast-formal';
  const rate = Number.isFinite(opts.rate)
    ? Math.max(0.68, Math.min(1.28, opts.rate))
    : 0.9;
  const url = `/api/azure-tts?q=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&style=${encodeURIComponent(style)}&rate=${encodeURIComponent(String(rate))}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`[tts/azure] ${err.error ?? `HTTP ${res.status}`}`);
  }
  const { audioBase64, cues } = await res.json();
  const bytes = Uint8Array.from(atob(audioBase64), c => c.charCodeAt(0));
  const audioBlob = new Blob([bytes], { type: 'audio/mpeg' });
  return { audioBlob, cues }; // cues = [{time, shape}, …] already mapped
}

// ── Microsoft Edge Neural TTS (free, no API key) ─────────────
// Served by the Vite dev-server plugin — proxied via /api/tts-edge.
// Uses Microsoft Azure neural voices under the hood via the Edge
// browser read-aloud feature. Returns a real MP3 blob.
async function _edge(text, opts = {}) {
  const voice = opts.voice || CONFIG.edge.voice;
  const rate = Number.isFinite(opts.rate)
    ? Math.max(0.68, Math.min(1.28, opts.rate))
    : 0.9;
  const url = `/api/tts-edge?q=${encodeURIComponent(text)}&voice=${encodeURIComponent(voice)}&rate=${encodeURIComponent(String(rate))}`;
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText);
    throw new Error(`[tts/edge] ${res.status}: ${err}`);
  }
  const audioBlob = await res.blob();
  if (!audioBlob || audioBlob.size === 0) {
    throw new Error('[tts/edge] Empty audio response');
  }
  return { audioBlob, durationSec: null };
}

// ── Google Translate TTS (free, no API key) ─────────────────
// Calls /api/tts which the Vite dev server proxies to
// translate.google.com/translate_tts, avoiding CORS entirely.
// Texts longer than ~200 chars are split into sentence chunks.
async function _google(text) {
  const { lang, speed } = CONFIG.google;

  const chunks = _splitSentences(text, 190);

  const buffers = await Promise.all(chunks.map(async chunk => {
    const url = `/api/tts?ie=UTF-8&q=${encodeURIComponent(chunk)}&tl=${lang}&client=tw-ob&ttsspeed=${speed}`;
    const res = await fetch(url);
    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`[tts/google] ${res.status}: ${err}`);
    }
    return res.arrayBuffer();
  }));

  const audioBlob = new Blob(buffers, { type: 'audio/mpeg' });
  return { audioBlob, durationSec: null };
}

/** Split text into chunks ≤ maxLen, breaking at sentence boundaries. */
function _splitSentences(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const sentences = text.match(/[^.!?,]+[.!?,]*/g) ?? [text];
  const chunks = [];
  let current = '';
  for (const s of sentences) {
    if ((current + s).length > maxLen && current) {
      chunks.push(current.trim());
      current = s;
    } else {
      current += s;
    }
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

// ── StreamElements TTS (now requires API key — kept for reference) ──
// Uses Amazon Polly voices served by StreamElements.
// Returns a real MP3 blob → audio gets baked into the recorded video.
async function _streamelements(text) {
  const { voice, endpoint } = CONFIG.streamelements;
  const url = `${endpoint}?voice=${encodeURIComponent(voice)}&text=${encodeURIComponent(text)}`;

  const response = await fetch(url);
  if (!response.ok) {
    const err = await response.text().catch(() => response.statusText);
    throw new Error(`[tts/streamelements] ${response.status}: ${err}`);
  }

  const audioBlob = await response.blob();
  return { audioBlob, durationSec: null };
}

// ── ElevenLabs ──────────────────────────────────────────────
async function _elevenlabs(text) {
  const { apiKey, voiceId, modelId, endpoint } = CONFIG.elevenlabs;

  const response = await fetch(`${endpoint}/${voiceId}`, {
    method: 'POST',
    headers: {
      'xi-api-key':   apiKey,
      'Content-Type': 'application/json',
      'Accept':       'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: { stability: 0.45, similarity_boost: 0.75 },
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[tts/elevenlabs] ${response.status}: ${err}`);
  }

  const audioBlob = await response.blob();
  return { audioBlob, durationSec: null }; // duration resolved after decode
}

// ── OpenAI TTS ──────────────────────────────────────────────
async function _openai(text) {
  const { apiKey, voice, model, endpoint } = CONFIG.openai;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({ model, input: text, voice }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`[tts/openai] ${response.status}: ${err}`);
  }

  const audioBlob = await response.blob();
  return { audioBlob, durationSec: null };
}

// ── Browser Web Speech API (no API key needed) ───────────────
/**
 * Uses SpeechSynthesis to speak, and returns a dummy Blob +
 * rough duration so the rest of the pipeline keeps working.
 * The returned blob is empty – playback is handled internally.
 */
async function _browser(text) {
  return new Promise((resolve, reject) => {
    const utter = new SpeechSynthesisUtterance(text);
    utter.rate  = 0.95;
    utter.pitch = 1.1;

    // Pick a suitable voice if available
    const voices = speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      /female|woman|girl|zira|google us english/i.test(v.name)
    );
    if (preferred) utter.voice = preferred;

    // Rough duration estimate used only for cue spacing — not for stopping.
    const words       = text.trim().split(/\s+/).length;
    const durationSec = Math.max(1, (words / 130) * 60);

    // endedPromise resolves the moment the speech engine signals completion.
    // This is used to stop the animation exactly when audio actually ends,
    // regardless of whether the word-count estimate was accurate.
    let _endResolve;
    const endedPromise = new Promise(r => { _endResolve = r; });

    utter.onstart = () => {
      // Capture wall-clock the instant audio output begins — this becomes
      // the authoritative time=0 anchor for the lip-sync animation loop.
      const startWall = performance.now();
      resolve({
        audioBlob: new Blob(),
        durationSec,
        startWall,
        endedPromise,
        // Polled every animation frame in lipsync.js.
        // Becomes false the instant the browser stops speaking — reliable
        // even when utter.onend silently fails (known Chrome bug).
        isSpeakingFn: () => speechSynthesis.speaking,
      });
    };
    utter.onend   = () => _endResolve();
    utter.onerror = e => {
      _endResolve(); // unblock any waiting promise
      reject(new Error(`[tts/browser] ${e.error}`));
    };

    speechSynthesis.speak(utter);
  });
}

/**
 * rhubarb.js
 * ─────────────────────────────────────────────────────────────
 * Everything related to phoneme-based lip-sync via Rhubarb.
 *
 * Responsibilities
 * ────────────────
 * 1. Encode a Web Audio AudioBuffer → 16-bit PCM WAV bytes
 *    (Rhubarb only accepts .wav / .ogg, not MP3).
 * 2. POST the WAV to the Vite server-side Rhubarb plugin
 *    at /api/rhubarb and parse its JSON response.
 * 3. Fall back to energy-based cues if Rhubarb fails
 *    (exe missing, timeout, unexpected error, etc.).
 *
 * Exports
 * ───────
 * buildLipSyncCues(decodedBuffer, text) → Promise<[{time, shape}]>
 * ─────────────────────────────────────────────────────────────
 */

import { buildCuesFromRhubarbJSON, buildCuesFromAudio } from './lipsync.js';
// buildCuesFromRhubarbJSON  – converts Rhubarb's { mouthCues:[{start,value}] } → [{time,shape}]
// buildCuesFromAudio        – fallback: analyses PCM amplitude → rough [{time,shape}] cues

// ── audioBufferToWav ──────────────────────────────────────────
// Encodes a Web Audio AudioBuffer to a 16-bit PCM WAV ArrayBuffer.
// WAV format reference: http://soundfile.sapp.org/doc/WaveFormat/
//   buffer – AudioBuffer from audioCtx.decodeAudioData()
// Returns: ArrayBuffer with valid 44-byte WAV header + interleaved 16-bit PCM samples
export function audioBufferToWav(buffer) {
  const numCh    = buffer.numberOfChannels; // 1 = mono, 2 = stereo
  const sr       = buffer.sampleRate;       // e.g. 24000 Hz (Edge TTS outputs 24 kHz)
  const len      = buffer.length;           // total sample frames
  const bps      = 2;                       // bytes per sample: 16-bit = 2 bytes
  const dataSize = numCh * len * bps;       // total PCM payload size in bytes
  // 44 = fixed WAV header size for standard uncompressed PCM
  const ab = new ArrayBuffer(44 + dataSize);
  const v  = new DataView(ab); // DataView lets us write ints at exact byte offsets

  // Helper: write an ASCII string at byte offset `off`
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };

  // ── WAV header (44 bytes) ──────────────────────────────────
  str(0,  'RIFF');                         // offset  0: RIFF chunk ID
  v.setUint32( 4, 36 + dataSize, true);    // offset  4: total file size − 8 (little-endian)
  str(8,  'WAVE');                         // offset  8: format = "WAVE"
  str(12, 'fmt ');                         // offset 12: "fmt " sub-chunk ID (trailing space is required)
  v.setUint32(16, 16, true);               // offset 16: fmt chunk size = 16 bytes for PCM
  v.setUint16(20,  1, true);               // offset 20: audio format = 1 (PCM, uncompressed)
  v.setUint16(22, numCh, true);            // offset 22: number of channels
  v.setUint32(24, sr, true);               // offset 24: sample rate (Hz)
  v.setUint32(28, sr * numCh * bps, true); // offset 28: byte rate = sampleRate × channels × bytesPerSample
  v.setUint16(32, numCh * bps, true);      // offset 32: block align = channels × bytesPerSample
  v.setUint16(34, 16, true);               // offset 34: bits per sample = 16
  str(36, 'data');                         // offset 36: "data" sub-chunk ID
  v.setUint32(40, dataSize, true);         // offset 40: data chunk size in bytes

  // ── PCM samples ────────────────────────────────────────────
  // Web Audio stores Float32 in [-1.0, +1.0].
  // WAV 16-bit PCM uses Int16 in [-32768, +32767].
  // Channels are interleaved: L[0], R[0], L[1], R[1], … (for stereo)
  let off = 44; // start writing right after the 44-byte header
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i])); // clamp to [-1, 1]
      // 0x8000 = 32768 maps -1.0 → -32768 (negative range is one wider than positive)
      // 0x7FFF = 32767 maps +1.0 → +32767
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true); // true = little-endian
      off += 2;
    }
  }
  return ab;
}

// ── buildLipSyncCues ──────────────────────────────────────────
// Primary export. Attempts Rhubarb phoneme analysis; falls back to energy cues.
//   decodedBuffer – Web Audio AudioBuffer (PCM float32, already decoded)
//   text          – the spoken text, sent as the Rhubarb --dialogFile hint for accuracy
// Returns: [{time: number (seconds), shape: 'A'|'B'|…|'X'}]
export async function buildLipSyncCues(decodedBuffer, text) {
  try {
    const wavBytes = audioBufferToWav(decodedBuffer); // encode PCM float32 → WAV bytes
    // Text goes in the URL query string so the Vite plugin can read it without parsing the body
    const url = `/api/rhubarb?text=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'audio/wav' }, // signal that body is raw WAV data
      body:    wavBytes,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({})); // response body may not be JSON
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }
    // Rhubarb returns: { mouthCues: [{start, end, value}, …] }
    // buildCuesFromRhubarbJSON converts that to [{time, shape}]
    
    const rhubarbJson = await res.json();
    return buildCuesFromRhubarbJSON(rhubarbJson);
  } catch (err) {
    // Common failure reasons: rhubarb.exe not found, audio > 30 s timeout,
    // malformed WAV, or network error hitting the Vite dev server.
    console.warn('[rhubarb] Failed, falling back to energy cues:', err.message);
    // buildCuesFromAudio derives mouth openness from PCM amplitude — less accurate
    // but never fails and needs no external binary
    return buildCuesFromAudio(decodedBuffer);
  }
}

/**
 * rhubarb.js
 * ─────────────────────────────────────────────────────────────
 * Everything related to phoneme-based lip-sync via Rhubarb.
 *
 * Responsibilities
 * ────────────────
 * 1. POST TTS audio (MP3 or WAV) to the Vite server-side Rhubarb plugin
 *    at /api/rhubarb and parse its JSON response.
 * 2. Requires /api/rhubarb (Vite plugin + rhubarb binary + res/). No energy fallback.
 *    See news-feed/public/avatar-studio/CHANGES.md
 *
 * Exports
 * ───────
 * buildLipSyncCues(audioBlob, text) → Promise<[{time, shape}]>
 * ─────────────────────────────────────────────────────────────
 */

import { buildCuesFromRhubarbJSON } from './lipsync.js';
// buildCuesFromRhubarbJSON – Rhubarb JSON → [{time, shape}]

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
// Sends TTS audio (MP3) to the dev server; Rhubarb runs server-side (MP3→WAV→phonemes).
export async function buildLipSyncCues(audioBlob, text) {
  if (!audioBlob?.size) {
    throw new Error('[rhubarb] Missing audio blob for lip-sync analysis');
  }
  const contentType = audioBlob.type?.includes('wav') ? 'audio/wav' : 'audio/mpeg';
  const url = `/api/rhubarb?text=${encodeURIComponent(text)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: audioBlob,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `[rhubarb] HTTP ${res.status}`);
  }
  const rhubarbJson = await res.json();
  if (!rhubarbJson?.mouthCues?.length) {
    throw new Error('[rhubarb] No mouth cues returned');
  }
  console.log('[rhubarb] cues:', rhubarbJson.mouthCues.length);
  return buildCuesFromRhubarbJSON(rhubarbJson);
}

/**
 * recorder.js
 * ─────────────────────────────────────────────────────────────
 * Captures the Three.js WebGL canvas as a WebM video while the
 * character speaks, then returns a Blob for playback / download.
 *
 * Usage:
 *   startRecording(canvas)          // call just before playWithLipSync
 *   const blob = await stopRecording()  // call after playWithLipSync resolves
 * ─────────────────────────────────────────────────────────────
 */

let mediaRecorder = null;
let chunks        = [];

// Preferred codec order: VP9 (smallest), VP8 (widest support), plain webm.
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
];

function _pickMime() {
  return MIME_CANDIDATES.find(m => MediaRecorder.isTypeSupported(m)) ?? 'video/webm';
}

// ── Public: begin capturing the canvas ─────────────────────
/**
 * @param {HTMLCanvasElement} canvas      - renderer.domElement from scene.js
 * @param {MediaStream|null}  audioStream - optional audio track(s) to embed
 *                                          in the recorded video (API TTS only)
 * @param {number}            fps         - capture frame rate (default 30)
 */
export function startRecording(canvas, audioStream = null, fps = 30) {
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop(); // stop any leftover session
  }
  chunks = [];

  // Combine canvas video track with optional audio track(s).
  const videoStream = canvas.captureStream(fps);
  const stream = (audioStream && audioStream.getAudioTracks().length > 0)
    ? new MediaStream([...videoStream.getVideoTracks(), ...audioStream.getAudioTracks()])
    : videoStream;

  const mimeType = _pickMime();

  // 5 Mbps video bitrate → noticeably sharper than the browser default (~2.5 Mbps).
  mediaRecorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 5_000_000 });
  mediaRecorder.ondataavailable = e => {
    if (e.data && e.data.size > 0) chunks.push(e.data);
  };

  // Collect data in 100ms slices so the final chunk isn't the whole video.
  mediaRecorder.start(100);
  console.log(`[recorder] Started (${mimeType}, 5 Mbps)`);
}

// ── Public: stop capturing and return the video Blob ───────
/**
 * @returns {Promise<Blob|null>}  null if nothing was recorded.
 */
export function stopRecording() {
  return new Promise(resolve => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      resolve(null);
      return;
    }

    mediaRecorder.onstop = () => {
      const blob = new Blob(chunks, { type: mediaRecorder.mimeType });
      console.log(`[recorder] Stopped — ${(blob.size / 1024).toFixed(1)} KB`);
      resolve(blob.size > 0 ? blob : null);
    };

    mediaRecorder.stop();
  });
}

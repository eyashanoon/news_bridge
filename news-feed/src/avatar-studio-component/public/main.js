/**
 * main.js
 * ─────────────────────────────────────────────────────────────
 * Application entry point and speech pipeline orchestrator.
 *
 * This file is intentionally small. Each concern lives in its
 * own module:
 *   scene.js       – Three.js scene, bones, morph targets
 *   tts.js         – text-to-speech (Edge TTS)
 *   lipsync.js     – lip-sync animation driver
 *   rhubarb.js     – Rhubarb phoneme analysis via /api/rhubarb
 *   gestures.js    – hand-gesture choreography
 *   pose-studio.js – Pose Studio UI (bones, poses, panels)
 *
 * Flow
 * ────
 * 1. Three.js scene initialised into the canvas container.
 * 2. character.glb loaded; saved poses fetched from server.
 * 3. User types text → Speak button (or Enter).
 * 4. TTS → MP3 blob → decode → Rhubarb cues → gestures → play.
 * ─────────────────────────────────────────────────────────────
 */

// ── Scene & character ─────────────────────────────────────────
import { initScene, loadCharacter, updateScreenText } from './scene.js';

// ── TTS ───────────────────────────────────────────────────────
import { synthesise } from './tts.js';
import { analyzeSpeechDirectives } from './emotion.js';
// synthesise(text) → Promise<{ audioBlob: Blob }>

// ── Lip-sync ──────────────────────────────────────────────────
import { playWithLipSync, setAudioDelay } from './lipsync.js';
// playWithLipSync(blob, cues, durationSec, options) – plays audio + drives mouth
// setAudioDelay(seconds) – how long to delay audio after animation starts (default 0.1 s)

// ── Rhubarb (phoneme lip-sync) ────────────────────────────────
import { buildLipSyncCues } from './rhubarb.js';
// buildLipSyncCues(audioBlob, text) → [{time, shape}] via Rhubarb (/api/rhubarb)

// ── Gesture choreography ──────────────────────────────────────
import { scheduleGestures, cancelGestures } from './gestures.js';
// scheduleGestures(durationMs, allPoses) – fires timed hand-pose transitions
// cancelGestures()                       – clears all pending gesture timers

// ── Pose Studio ───────────────────────────────────────────────
import { allPoses, loadPoses, initPoseStudio } from './pose-studio.js';
// allPoses          – live { L:{}, R:{}, H:{} } pose store (read by gestures.js)
// loadPoses(part)   – fetch saved poses from server into allPoses
// initPoseStudio()  – wire all Pose Studio UI, return partControllers

// ── DOM refs ──────────────────────────────────────────────────
const container   = document.getElementById('canvas-container'); // Three.js render target
const textInput   = document.getElementById('text-input');       // speech text area
const speakBtn    = document.getElementById('speak-btn');        // Speak / Generate button
const replayBtn   = document.getElementById('replay-btn');       // Replay last speech
const statusMsg   = document.getElementById('status-msg');       // bottom status bar
const delaySlider = document.getElementById('main-delay-slider');// audio-delay range input
const delayLabel  = document.getElementById('main-delay-label'); // label next to slider
const emotionToggle = document.getElementById('emotion-toggle-main');

// ── Audio-delay slider ────────────────────────────────────────
// Positive delay → mouth starts before audio → looks natural.
// Negative delay → audio plays first → mouth looks late.
delaySlider.addEventListener('input', () => {
  const s = parseFloat(delaySlider.value);    // convert string → float (seconds)
  delayLabel.textContent = `${s.toFixed(2)}s`; // show "0.10s" next to the slider
  setAudioDelay(s);
});

// ── State ─────────────────────────────────────────────────────
let characterReady = false; // true after character.glb + poses are loaded
let isSpeaking        = false; // true while speak pipeline is running (prevents re-entry)
let enhancementEnabled = localStorage.getItem('av_emotion_mode_enabled') === '1';
let _gestureStartAt    = 0;   // performance.now() when last scheduleGestures was called
let _gestureDurationMs = 0;   // ms passed to last scheduleGestures

if (emotionToggle) {
  emotionToggle.checked = enhancementEnabled;
  emotionToggle.addEventListener('change', () => {
    enhancementEnabled = emotionToggle.checked;
    localStorage.setItem('av_emotion_mode_enabled', enhancementEnabled ? '1' : '0');
    setStatus(enhancementEnabled ? 'Enhancements ON: emotion hands + news tone.' : 'Enhancements OFF: legacy hands + standard tone.');
    // Stop the current gesture sequence immediately.
    cancelGestures();
    if (isSpeaking && _gestureDurationMs > 0) {
      // Audio is playing – reschedule gestures for the remaining duration.
      const elapsed   = performance.now() - _gestureStartAt;
      const remaining = _gestureDurationMs - elapsed;
      if (remaining > 300) {
        const dir = lastSession?.directives ?? null;
        scheduleGestures(
          remaining,
          allPoses,
          enhancementEnabled && dir ? dir.gesture : { enabled: false }
        );
      }
    }
  });
}

// Cache of the last completed speech session — replay skips TTS + Rhubarb.
let lastSession = null; // { audioBlob, cues, decodedBuffer, audioCtx, text, directives }

// ── 1. Initialise Three.js scene ──────────────────────────────
initScene(container);

// ── 2. Initialise Pose Studio UI ──────────────────────────────
// Wire tabs, keyboard arrows, D-pad buttons, save/apply/delete, quick-pose selects.
const partControllers = initPoseStudio();

// ── 3. Load character model ───────────────────────────────────
speakBtn.disabled = true; // keep disabled until model + poses are ready
setStatus('Loading character…');

loadCharacter(
  '/character.glb',
  async () => {
    // Load saved poses for all three parts in parallel, then enable the UI.
    await Promise.all(['L', 'R', 'H'].map(loadPoses));
    characterReady = true;
    speakBtn.disabled = false;
    setStatus('Ready — type something and press Generate.');
    // Re-render all pose dropdowns now that allPoses is populated.
    ['L', 'R', 'H'].forEach(p => partControllers[p]?.renderPoseList?.());
  },
  () => setStatus('⚠ Could not load character.glb — put it in the /public folder.')
);

// ── 4. Speak button & Enter key ───────────────────────────────
speakBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (!text)           return setStatus('Please type some text first.');
  if (!characterReady) return setStatus('Character is still loading…');
  if (isSpeaking)      return; // already running — silently ignore
  handleSpeak(text);
});

replayBtn.addEventListener('click', () => {
  if (!lastSession || isSpeaking) return;
  handleReplay();
});

textInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') speakBtn.click();
});

// ── 5. Speech pipeline ────────────────────────────────────────
// handleSpeak: text → TTS → decode → Rhubarb cues → gestures → lip-sync playback.
async function handleSpeak(text) {
  isSpeaking = true;
  speakBtn.disabled = true;
  updateScreenText(text); // show text on the studio's 3D screen
  setStatus('Synthesising speech…');
  try {
    const directives = enhancementEnabled ? analyzeSpeechDirectives(text) : null;

    // A. TTS: text → MP3 blob
    const { audioBlob } = enhancementEnabled && directives
      ? await synthesise(text, {
          enhanced: true,
          rate: directives.tts.rate,
          voice: directives.tts.voice,
          style: directives.tts.style,
        })
      : await synthesise(text, { enhanced: false });

    // B. Decode audio once.
    //    The decoded buffer is passed to playWithLipSync so it does not decode again
    //    (double-decoding caused a visible mouth-start delay).
    const audioCtx      = new AudioContext();
    await audioCtx.resume(); // required on mobile/some browsers (context starts suspended)
    const decodedBuffer = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer());

    // C. Rhubarb phoneme lip-sync (requires vite-plugins/avatarStudioApi.js in dev).
    setStatus('Analyzing lip sync…');
    const cues = await buildLipSyncCues(audioBlob, text);
    console.log('Lip-sync cues:', cues);

    setStatus(''); // clear "Synthesising" message before playback starts

    // D. Schedule hand gestures spread across the speech duration.
    //    allPoses is imported from pose-studio.js; missing poses are silently skipped.
    _gestureDurationMs = decodedBuffer.duration * 1000;
    _gestureStartAt    = performance.now();
    scheduleGestures(
      _gestureDurationMs,
      allPoses,
      enhancementEnabled && directives ? directives.gesture : { enabled: false }
    );

    // E. Play audio and animate mouth concurrently.
    await playWithLipSync(audioBlob, cues, decodedBuffer.duration, {
      audioCtx,
      decodedBuffer, // reuse already-decoded buffer — no second decode
    });

    // Keep the AudioContext open — reused on replay (only close on page unload).
    // Cache everything needed to replay without re-synthesising.
    lastSession = { audioBlob, cues, decodedBuffer, audioCtx, text, directives, enhanced: enhancementEnabled };

  } catch (err) {
    console.error('[main] Pipeline error:', err);
    setStatus(`Error: ${err.message}`);
  } finally {
    cancelGestures();
    isSpeaking        = false;
    speakBtn.disabled = false;
    replayBtn.disabled = !lastSession;
    setStatus('Ready — type something and press Speak.');
  }
}

// ── Replay last speech ────────────────────────────────────────
// Re-plays the cached audio + cues without calling TTS or Rhubarb again.
async function handleReplay() {
  if (!lastSession) return;
  isSpeaking        = true;
  speakBtn.disabled = true;
  replayBtn.disabled = true;
  const { audioBlob, cues, decodedBuffer, audioCtx, text, directives } = lastSession;
  updateScreenText(text);
  setStatus('');
  try {
    await audioCtx.resume();
    _gestureDurationMs = decodedBuffer.duration * 1000;
    _gestureStartAt    = performance.now();
    scheduleGestures(
      _gestureDurationMs,
      allPoses,
      enhancementEnabled && directives ? directives.gesture : { enabled: false }
    );
    await playWithLipSync(audioBlob, cues, decodedBuffer.duration, {
      audioCtx,
      decodedBuffer,
    });
  } catch (err) {
    console.error('[main] Replay error:', err);
    setStatus(`Error: ${err.message}`);
  } finally {
    cancelGestures();
    isSpeaking         = false;
    speakBtn.disabled  = false;
    replayBtn.disabled = false;
    setStatus('Ready — type something and press Speak.');
  }
}

// ── Utility ───────────────────────────────────────────────────
function setStatus(msg) {
  statusMsg.textContent = msg;
}

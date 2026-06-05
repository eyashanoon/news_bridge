/**
 * main.js – entry point
 * The avatar is fully procedural — no external assets needed.
 */

import * as THREE from 'three';
import { createScene }    from './scene.js';
import { Avatar }         from './avatar.js';
import { SpeechManager }  from './speech.js';
import { LipSync }        from './lipSync.js';

const GREETING = "Good evening. Welcome to the broadcast. I'm your news presenter. You can type any headline or story and I will read it for you.";

// ── DOM refs ───────────────────────────────────────────────────────────────
const loadingEl      = document.getElementById('loading');
const startOverlayEl = document.getElementById('start-overlay');
const uiEl           = document.getElementById('ui');
const subtitleEl     = document.getElementById('subtitle');
const inputEl        = document.getElementById('user-input');
const speakBtn       = document.getElementById('speak-btn');

// ── SVG icons ──────────────────────────────────────────────────────────────
const ICON_PLAY = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`;

const ICON_STOP = `
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2"/>
  </svg>`;

// ── Subtitle with current-word highlight ───────────────────────────────────
function esc(str) {
  return str.replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function showSubtitle(text, charIndex = 0) {
  if (!text) { subtitleEl.innerHTML = ''; return; }
  const after   = text.slice(charIndex);
  const wordEnd = charIndex + (after.match(/^\S+/)?.[0].length ?? 0);
  subtitleEl.innerHTML =
    esc(text.slice(0, charIndex)) +
    `<mark>${esc(text.slice(charIndex, wordEnd))}</mark>` +
    esc(text.slice(wordEnd));
}

// ── UI state ───────────────────────────────────────────────────────────────
function setSpeaking(speaking) {
  speakBtn.innerHTML = speaking ? ICON_STOP : ICON_PLAY;
  speakBtn.classList.toggle('speaking', speaking);
  inputEl.disabled = speaking;
}

// ── Bootstrap ──────────────────────────────────────────────────────────────
async function main() {
  // Three.js scene
  const canvas = document.getElementById('canvas');
  const { renderer, scene, camera, controls } = createScene(canvas);

  // Avatar
  const avatar  = new Avatar(scene);
  const lipSync = new LipSync();

  // Speech callbacks
  const speech = new SpeechManager({
    onStart(text, cues, audio) {
      lipSync.start(cues, audio);
      subtitleEl.textContent = text;
      setSpeaking(true);
    },
    onEnd() {
      lipSync.stop();
      setSpeaking(false);
      avatar.setSmile(0);
      setTimeout(() => { subtitleEl.innerHTML = ''; }, 2500);
    },
  });

  // ── Load avatar (GLB from Blender) ─────────────────────────
  const loadingP = loadingEl.querySelector('p');
  let proxy;
  try {
    proxy = await avatar.load(null, (xhr) => {
      if (xhr.total && loadingP) {
        const pct = Math.round((xhr.loaded / xhr.total) * 100);
        loadingP.textContent = `Loading avatar… ${pct}%`;
      }
    });
  } catch (err) {
    console.error('[main] Avatar load failed:', err);
    if (loadingP) loadingP.textContent = 'Avatar load failed — check console.';
  }
  if (proxy) lipSync.setMesh(proxy);

  // ── Show start overlay ───────────────────────────────────────
  loadingEl.classList.add('fade-out');
  setTimeout(() => (loadingEl.style.display = 'none'), 750);

  startOverlayEl.classList.remove('hidden');
  speakBtn.innerHTML = ICON_PLAY;

  // ── Start on first click (satisfies browser autoplay policy) ─
  startOverlayEl.addEventListener('click', () => {
    startOverlayEl.classList.add('fade-out');
    setTimeout(() => (startOverlayEl.style.display = 'none'), 450);

    uiEl.classList.remove('hidden');

    // Play greeting with a slight smile
    avatar.setSmile(0.45);
    speech.speak(GREETING);
    setTimeout(() => avatar.setSmile(0), 4500);
  }, { once: true });

  // ── Speak button ─────────────────────────────────────────────
  const triggerSpeak = () => {
    if (speech.isSpeaking) {
      speech.cancel();
      return;
    }
    const text = inputEl.value.trim();
    if (!text) return;
    inputEl.value = '';
    speech.speak(text);
  };

  speakBtn.addEventListener('click', triggerSpeak);
  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter') triggerSpeak();
  });

  // ── Render loop ──────────────────────────────────────────────
  const clock = new THREE.Clock();
  (function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    controls.update();
    avatar.update(dt);
    lipSync.update(dt);
    renderer.render(scene, camera);
  })();
}

main().catch(console.error);

/**
 * news-brief.js — News Brief orchestration for the avatar studio.
 *
 * Flows:
 *   Phase 1: Reads all titles sequentially with image slideshows
 *   Phase 2: Interactive title list → user picks one → reads title + summary
 */
import { synthesise } from './tts.js';
import { buildLipSyncCues } from './rhubarb.js';
import { playWithLipSync, setAudioDelay } from './lipsync.js';
import { scheduleGestures, cancelGestures } from './gestures.js';
import { allPoses } from './pose-studio.js';
import {
  updateScreenText,
  updateScreenTextNewsBrief,
  setLeftScreenImage,
  clearLeftScreen,
  setStaticCamera,
  disableOrbitControls,
} from './scene.js';
import { analyzeSpeechDirectives } from './emotion.js';

// ── State ─────────────────────────────────────────────────────
let posts = [];           // fetched news brief posts
let currentPhase = 'idle'; // 'idle' | 'reading-titles' | 'interactive'
let isBusy = false;       // true while speech is happening
let abortRequested = false;

// ── DOM elements (created by initNewsBriefUI) ─────────────────
let containerEl, fetchBtn, readAllBtn, titleListEl, statusEl, backBtn;

// ── Init: create the news brief UI inside the provided element ─
export function initNewsBriefUI(parentEl) {
  containerEl = document.createElement('div');
  containerEl.id = 'news-brief-panel';
  containerEl.style.cssText = `
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px; max-height: 88vh; overflow-y: auto;
  `;

  const title = document.createElement('div');
  title.textContent = '📺 News Brief';
  title.style.cssText = 'font-size:14px;font-weight:700;color:#5a5aff;text-align:center;margin-bottom:4px;';
  containerEl.appendChild(title);

  fetchBtn = document.createElement('button');
  fetchBtn.textContent = '📡 Fetch Latest Brief';
  fetchBtn.className = 'anim-btn span-2';
  fetchBtn.style.cssText = 'padding:8px 12px;font-size:13px;font-weight:700;border-radius:8px;border:1px solid #4a4aff;background:rgba(74,74,255,0.25);color:#fff;cursor:pointer;';
  fetchBtn.addEventListener('click', fetchNewsBrief);
  containerEl.appendChild(fetchBtn);

  statusEl = document.createElement('div');
  statusEl.style.cssText = 'font-size:11px;color:#888;text-align:center;min-height:18px;';
  containerEl.appendChild(statusEl);

  readAllBtn = document.createElement('button');
  readAllBtn.textContent = '▶ Read All Titles';
  readAllBtn.style.cssText = 'display:none;padding:8px 12px;font-size:13px;font-weight:700;border-radius:8px;border:1px solid #22c55e;background:rgba(34,197,94,0.2);color:#22c55e;cursor:pointer;';
  readAllBtn.addEventListener('click', readAllTitles);
  containerEl.appendChild(readAllBtn);

  titleListEl = document.createElement('div');
  titleListEl.style.cssText = 'display:flex;flex-direction:column;gap:4px;margin-top:4px;';
  containerEl.appendChild(titleListEl);

  backBtn = document.createElement('button');
  backBtn.textContent = '← Back to Titles';
  backBtn.style.cssText = 'display:none;padding:6px 10px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid #555;background:rgba(255,255,255,0.05);color:#aaa;cursor:pointer;margin-top:4px;';
  backBtn.addEventListener('click', showInteractiveList);
  containerEl.appendChild(backBtn);

  parentEl.appendChild(containerEl);
}

// ── Fetch news brief from backend ─────────────────────────────
async function fetchNewsBrief() {
  if (isBusy) return;
  setStatus('Fetching news brief…');
  fetchBtn.disabled = true;
  try {
    const res = await fetch('/ai/news-brief', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    if (data.status === 'SUCCESS' && data.posts?.length > 0) {
      posts = data.posts;
      readAllBtn.style.display = 'block';
      setStatus(`✅ ${posts.length} stories loaded.`);
    } else {
      setStatus('⚠ No brief available right now.');
      posts = [];
      readAllBtn.style.display = 'none';
    }
  } catch (err) {
    console.error('[news-brief] fetch error:', err);
    setStatus('❌ Failed to fetch brief.');
    posts = [];
    readAllBtn.style.display = 'none';
  } finally {
    fetchBtn.disabled = false;
  }
}

// ── Phase 1: Read all titles sequentially ────────────────────
async function readAllTitles() {
  if (isBusy || posts.length === 0) return;
  abortRequested = false;
  currentPhase = 'reading-titles';
  readAllBtn.disabled = true;
  fetchBtn.disabled = true;
  titleListEl.innerHTML = '';
  backBtn.style.display = 'none';

  setStaticCamera();
  disableOrbitControls();

  for (let i = 0; i < posts.length; i++) {
    if (abortRequested) break;

    const post = posts[i];
    const title = post.title || 'Untitled';
    const images = post.imageUrls || [];

    setStatus(`📰 Reading title ${i + 1}/${posts.length}…`);

    // Show title on the right screen with title progress bar
    updateScreenTextNewsBrief(title, '', 0, i + 1, posts.length);

    // Image slideshow
    if (images.length > 0) {
      startSlideshow(images);
    } else {
      clearLeftScreen();
    }

    try {
      await speakText(title);
    } catch (err) {
      console.error('[news-brief] speak error on title:', err);
    }

    stopSlideshowTimer();
  }

  if (!abortRequested) {
    setStatus('✅ All titles read. Select a story below.');
    showInteractiveList();
    currentPhase = 'interactive';
  } else {
    setStatus('⏹ Stopped.');
    currentPhase = 'idle';
  }

  readAllBtn.disabled = false;
  fetchBtn.disabled = false;
  readAllBtn.style.display = 'none';
}

// ── Image slideshow helper ────────────────────────────────────
let slideshowTimer = null;

function startSlideshow(images) {
  stopSlideshowTimer();
  if (images.length === 0) return;
  let idx = 0;
  setLeftScreenImage(images[0]);
  slideshowTimer = setInterval(() => {
    idx = (idx + 1) % images.length;
    setLeftScreenImage(images[idx]);
  }, 1000);
}

function stopSlideshowTimer() {
  if (slideshowTimer) {
    clearInterval(slideshowTimer);
    slideshowTimer = null;
  }
}

// ── Phase 2: Show interactive title list ─────────────────────
function showInteractiveList() {
  currentPhase = 'interactive';
  titleListEl.innerHTML = '';
  backBtn.style.display = 'none';
  readAllBtn.style.display = 'none';

  if (posts.length === 0) {
    titleListEl.innerHTML = '<div style="color:#888;font-size:12px;text-align:center;">No stories available.</div>';
    return;
  }

  posts.forEach((post, idx) => {
    const btn = document.createElement('button');
    btn.textContent = `${idx + 1}. ${post.title || 'Untitled'}`;
    btn.style.cssText = `
      padding:8px 10px;border-radius:6px;border:1px solid #2a2a5a;
      background:rgba(255,255,255,0.04);color:#ccc;
      font-size:11px;font-weight:600;cursor:pointer;text-align:left;
      transition:background 0.15s;font-family:inherit;
    `;
    btn.addEventListener('mouseenter', () => {
      btn.style.background = 'rgba(74,74,255,0.22)';
      btn.style.borderColor = '#4a4aff';
    });
    btn.addEventListener('mouseleave', () => {
      btn.style.background = 'rgba(255,255,255,0.04)';
      btn.style.borderColor = '#2a2a5a';
    });
    btn.addEventListener('click', () => readStory(idx));
    titleListEl.appendChild(btn);
  });
}

// ── Read a single story (title + summary) ────────────────────
async function readStory(idx) {
  if (isBusy || idx < 0 || idx >= posts.length) return;
  const post = posts[idx];
  const title = post.title || 'Untitled';
  const summary = post.text || post.content || '';
  const images = post.imageUrls || [];

  isBusy = true;
  readAllBtn.disabled = true;
  fetchBtn.disabled = true;
  backBtn.style.display = 'block';
  currentPhase = 'interactive';

  titleListEl.style.display = 'none';

  setStaticCamera();
  disableOrbitControls();

  const fullText = summary ? `${title}. ${summary}` : title;

  setStatus(`🔊 Reading: ${title}`);

  // Initialize screen with title + summary at progress 0
  updateScreenTextNewsBrief(title, summary, 0);

  // Image slideshow
  if (images.length > 0) {
    startSlideshow(images);
  } else {
    clearLeftScreen();
  }

  try {
    await speakText(fullText, (progress) => {
      // Update screen as speech progresses — title stays, summary scrolls
      updateScreenTextNewsBrief(title, summary, progress);
    });
  } catch (err) {
    console.error('[news-brief] speak error:', err);
  }

  // Final: show all the summary
  updateScreenTextNewsBrief(title, summary, 1);

  stopSlideshowTimer();
  clearLeftScreen();

  setStatus('✅ Done. Select another story.');
  titleListEl.style.display = 'flex';
  isBusy = false;
  readAllBtn.disabled = false;
  fetchBtn.disabled = false;
}

// ── Speak text with progress callback ─────────────────────────
let lastAudioCtx = null;

async function speakText(text, onProgress) {
  const enhanced = document.getElementById('emotion-toggle-main')?.checked ?? false;
  const directives = enhanced ? analyzeSpeechDirectives(text) : null;

  setStatus('Synthesising speech…');
  const { audioBlob } = enhanced && directives
    ? await synthesise(text, { enhanced: true, rate: directives.tts.rate, voice: directives.tts.voice, style: directives.tts.style })
    : await synthesise(text, { enhanced: false });

  const audioCtx = lastAudioCtx || new AudioContext();
  await audioCtx.resume();
  lastAudioCtx = audioCtx;
  const decodedBuffer = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer());

  setStatus('Analyzing lip sync…');
  const cues = await buildLipSyncCues(audioBlob, text);

  const durationMs = decodedBuffer.duration * 1000;
  if (enhanced && directives) {
    scheduleGestures(durationMs, allPoses, directives.gesture);
  } else {
    scheduleGestures(durationMs, allPoses, { enabled: false });
  }

  // Start a progress update interval
  let progressInterval = null;
  const startTime = performance.now();
  if (onProgress) {
    progressInterval = setInterval(() => {
      const elapsed = performance.now() - startTime;
      const p = Math.min(1, elapsed / durationMs);
      onProgress(p);
    }, 200); // Update screen 5 times/second
  }

  setStatus('');
  try {
    await playWithLipSync(audioBlob, cues, decodedBuffer.duration, {
      audioCtx,
      decodedBuffer,
    });
  } finally {
    if (progressInterval) clearInterval(progressInterval);
    cancelGestures();
  }
}

// ── Abort current operation ──────────────────────────────────
export function abortNewsBrief() {
  abortRequested = true;
  stopSlideshowTimer();
  cancelGestures();
  clearLeftScreen();
  if (lastAudioCtx) {
    lastAudioCtx.close().catch(() => {});
    lastAudioCtx = null;
  }
  isBusy = false;
  currentPhase = 'idle';
  setStatus('⏹ Stopped.');
}

// ── Receive external data from React via postMessage ─────────
export function handleNewsBriefMessage(event) {
  if (!event.data || event.data.type !== 'news-brief') return;

  const { action, payload } = event.data;

  switch (action) {
    case 'load-posts':
      if (payload?.posts) {
        posts = payload.posts;
        readAllBtn.style.display = 'block';
        setStatus(`✅ ${posts.length} stories loaded from external.`);
      }
      break;
    case 'read-titles':
      readAllTitles();
      break;
    case 'read-story':
      if (typeof payload?.index === 'number') readStory(payload.index);
      break;
    case 'abort':
      abortNewsBrief();
      break;
    case 'fetch':
      fetchNewsBrief();
      break;
  }
}

// ── Utility ──────────────────────────────────────────────────
function setStatus(msg) {
  if (statusEl) statusEl.textContent = msg;
}

export function getNewsBriefState() {
  return { currentPhase, postsCount: posts.length, isBusy };
}
/**
 * test.js — Lip-Sync Lab
 * Integration notes: news-feed/public/avatar-studio/CHANGES.md
 * (phoneme overlay, Rhubarb via buildLipSyncCues, UI fixes in test.html)
 * ─────────────────────────────────────────────────────────────
 * Testing page that lets the user:
 *   1. Type text → Generate: runs TTS + Rhubarb, builds cue list.
 *   2. See every phoneme cue as a coloured chip + a proportional
 *      timeline bar.
 *   3. Click any cue or timeline segment to seek + play from there.
 *   4. Use the Speed slider to slow down or speed up playback;
 *      audio pitch and mouth animation stay in sync.
 *   5. Watch a live phoneme overlay on the canvas while the
 *      character speaks.
 * ─────────────────────────────────────────────────────────────
 */

import {
  initScene, loadCharacter,
  setMorphTarget, resetMorphTargets, forceResetNonActive,
  tweakJoint, capturePartialPose, applyPose, animatePartPose, stopPartPoseAnim, resetJoint, PART_BONES,
  updateScreenText,
} from './scene.js';
import { synthesise } from './tts.js';
import { analyzeSpeechDirectives } from './emotion.js';
import { scheduleGestures, cancelGestures } from './gestures.js';
import { buildLipSyncCues } from './rhubarb.js';
import {
  fetchPresenterAnimation,
  savePresenterAnimation,
  schedulePresenterAnimation,
  cancelPresenterAnimation,
  hasPresenterAnimation,
} from './presenter-animation.js';

// ── Shape metadata ────────────────────────────────────────────
const SHAPE_INFO = {
  A: { color: '#ff6b6b', phonemes: '/P/ /B/ /M/', desc: 'lips together'  },
  B: { color: '#ffa94d', phonemes: '/K/ /G/ /R/', desc: 'slightly open'  },
  C: { color: '#ffd43b', phonemes: '/EH/ /IH/ /AH/', desc: 'open'        },
  D: { color: '#69db7c', phonemes: '/AE/ /AA/', desc: 'wide open'        },
  E: { color: '#38d9a9', phonemes: '/OW/ /AO/', desc: 'rounded'          },
  F: { color: '#74c0fc', phonemes: '/UW/ /OO/', desc: 'tight round'      },
  G: { color: '#da77f2', phonemes: '/F/ /V/', desc: 'teeth on lip'       },
  H: { color: '#f783ac', phonemes: '/L/ /N/ /TH/', desc: 'tongue up'     },
  X: { color: '#495057', phonemes: '—', desc: 'silence / rest'           },
};

const SPEECH_SHAPES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

// Lead time: shape fires this many seconds before its audio section starts.
// 150ms gives the lerp ~100ms of settled-shape margin before the phoneme
// audio arrives, compensating for RAF frame jitter (±16ms) and slow frames.
const SHAPE_LEAD_S = 0.15;

// ── DOM refs ─────────────────────────────────────────────────
const container     = document.getElementById('canvas-container');
const labInput      = document.getElementById('lab-input');
const generateBtn   = document.getElementById('generate-btn');
const labStatus     = document.getElementById('bottom-status');
const speedSlider   = document.getElementById('speed-slider');
const speedLabel    = document.getElementById('speed-label');
const delaySlider   = document.getElementById('delay-slider');
const delayLabel    = document.getElementById('delay-label');
const playBtn       = document.getElementById('play-btn');
const replayBtn     = document.getElementById('replay-btn');
const stopBtn       = document.getElementById('stop-btn');
const timelineBar   = document.getElementById('timeline-bar');
const timelineTime  = document.getElementById('timeline-time');
const cueGrid       = document.getElementById('cue-grid');
const cueCount      = document.getElementById('cue-count');
const phonemeOverlay = document.getElementById('phoneme-overlay');
const emotionToggle = document.getElementById('emotion-toggle-test');

// ── Manual animation DOM refs ─────────────────────────────────
const maSection    = document.getElementById('manual-anim-section');
const maHeader     = document.getElementById('ma-header');
const maBody       = document.getElementById('ma-body');
const maChevron    = document.getElementById('ma-chevron');
const maHeaderHint = document.getElementById('ma-header-hint');
const maStartR     = document.getElementById('ma-start-r');
const maStartL     = document.getElementById('ma-start-l');
const maKfPos      = document.getElementById('ma-kf-pos');
const maKfPosLabel = document.getElementById('ma-kf-pos-label');
const maKfHand     = document.getElementById('ma-kf-hand');
const maKfPose     = document.getElementById('ma-kf-pose');
const maKfAdd      = document.getElementById('ma-kf-add');
const maKfList     = document.getElementById('ma-kf-list');
const maKfClear    = document.getElementById('ma-kf-clear');
const maSave       = document.getElementById('ma-save');
const maLoad       = document.getElementById('ma-load');

// ── State ─────────────────────────────────────────────────────
let characterReady  = false;
let audioCtx        = null;
let decodedBuffer   = null;
let rawCues         = [];   // [{ start, end, value }] from Rhubarb
let currentPlayer   = null;
let currentSpeed    = 1.0;
let currentDelayS   = 0.1;
let currentDirectives = null;
let enhancementEnabled = localStorage.getItem('av_emotion_mode_enabled') === '1';

// ── Manual animation state ────────────────────────────────────
// { startR, startL, keyframes: [{frac, hand, pose}] }
const manualConfig = {
  startR: '',
  startL: '',
  keyframes: [],
};

if (emotionToggle) {
  emotionToggle.checked = enhancementEnabled;
  emotionToggle.addEventListener('change', () => {
    enhancementEnabled = emotionToggle.checked;
    localStorage.setItem('av_emotion_mode_enabled', enhancementEnabled ? '1' : '0');
    updateManualPanelVisibility();

    if (enhancementEnabled) {
      // Turned ON — re-generate so the lip sync is built from emotion-enhanced TTS audio.
      const text = labInput.value.trim();
      if (text && characterReady) {
        setStatus('Emotion ON — regenerating with enhanced speech…');
        cancelGestures();
        if (currentPlayer) { currentPlayer.stop(); currentPlayer = null; }
        doGenerate(text);
        return; // doGenerate takes over from here
      }
      setStatus('Enhancements ON: emotion hands + news tone.');
    } else {
      // Turned OFF — cancel emotion gestures, switch to legacy mode for current clip.
      setStatus('Enhancements OFF: legacy hands + standard tone.');
      cancelGestures();
      cancelPresenterAnimation();
      if (currentPlayer && currentPlayer._playing && decodedBuffer) {
        const remaining = (decodedBuffer.duration - currentPlayer.audioPos) * 1000;
        if (remaining > 300) {
          if (hasPresenterAnimation(manualConfig)) {
            schedulePresenterAnimation(remaining, allPoses, manualConfig);
          } else {
            scheduleGestures(remaining, allPoses, { enabled: false });
          }
        }
      } else {
        const homeR = allPoses.R?.['rr3'];
        const homeL = allPoses.L?.['rl3'];
        if (homeR) animatePartPose('R', capturePartialPose(PART_BONES.R), homeR, 1000);
        if (homeL) animatePartPose('L', capturePartialPose(PART_BONES.L), homeL, 700);
      }
    }
  });
}

// Segment preview state
let _segSource = null;  // active AudioBufferSourceNode for a segment preview
let _segTimer  = null;  // cleanup timeout after segment ends

// Sections: [{shape, start, end, buffer: AudioBuffer}] — built after each generate.
// Each section owns the exact PCM samples for one mouth-shape window so that
// audio and shape can be pre-scheduled at the same Web Audio clock instant.
let sections = [];

// ── Build sections from rawCues ───────────────────────────────
// Slices decodedBuffer into one AudioBuffer per cue entry.
// rawCues format: [{start, end, value}] (Rhubarb output).
function buildSectionsFromRawCues() {
  if (!decodedBuffer || !audioCtx || !rawCues.length) return [];
  const sr    = decodedBuffer.sampleRate;
  const numCh = decodedBuffer.numberOfChannels;
  const total = decodedBuffer.length;
  return rawCues.map(cue => {
    const s0  = Math.round(cue.start * sr);
    const s1  = Math.min(Math.round(cue.end * sr), total);
    const len = Math.max(1, s1 - s0);
    const buf = audioCtx.createBuffer(numCh, len, sr);
    for (let ch = 0; ch < numCh; ch++) {
      const sd = decodedBuffer.getChannelData(ch);
      const dd = buf.getChannelData(ch);
      for (let j = 0; j < len; j++) dd[j] = sd[s0 + j] ?? 0;
    }
    return { shape: cue.value, start: cue.start, end: cue.end, buffer: buf };
  });
}

// ── Manual animation helpers ──────────────────────────────────

/** Populate the starting-position selects and the keyframe pose select
 *  from the loaded allPoses store. Called once after character loads. */
function populateManualPoseDropdowns() {
  function fillSelect(sel, part) {
    const keys = Object.keys(allPoses[part] ?? {}).sort();
    // Keep the placeholder, repopulate options
    while (sel.options.length > 1) sel.remove(1);
    keys.forEach(k => {
      const o = document.createElement('option');
      o.value = o.textContent = k;
      sel.appendChild(o);
    });
  }
  fillSelect(maStartR, 'R');
  fillSelect(maStartL, 'L');
  refreshKfPoseDropdown();
}

/** Refresh the "pose" dropdown in the keyframe adder based on the chosen hand. */
function refreshKfPoseDropdown() {
  const part = maKfHand.value; // 'R' or 'L'
  const keys = Object.keys(allPoses[part] ?? {}).sort();
  while (maKfPose.options.length > 1) maKfPose.remove(1);
  keys.forEach(k => {
    const o = document.createElement('option');
    o.value = o.textContent = k;
    maKfPose.appendChild(o);
  });
}

/** Render the saved keyframes list. */
function renderKfList() {
  maKfList.innerHTML = '';
  if (!manualConfig.keyframes.length) {
    maKfList.innerHTML = '<div style="font-size:0.65rem;color:#444;text-align:center;padding:0.2rem 0">No keyframes added yet</div>';
    return;
  }
  // Sort by frac for display
  const sorted = [...manualConfig.keyframes].sort((a, b) => a.frac - b.frac);
  sorted.forEach((kf, i) => {
    const item = document.createElement('div');
    item.className = 'ma-kf-item';
    item.innerHTML = `
      <span class="ma-kf-pos-badge">${Math.round(kf.frac * 100)}%</span>
      <span class="ma-kf-hand-badge ma-kf-hand-${kf.hand}">${kf.hand}</span>
      <span class="ma-kf-pose">${kf.pose}</span>
      <button class="ma-kf-del" title="Remove" data-idx="${i}">✕</button>`;
    maKfList.appendChild(item);
  });
  maKfList.querySelectorAll('.ma-kf-del').forEach(btn => {
    btn.addEventListener('click', () => {
      // find original index using sorted order
      const sortedIdx = parseInt(btn.dataset.idx);
      const target = sorted[sortedIdx];
      const origIdx = manualConfig.keyframes.indexOf(target);
      if (origIdx !== -1) manualConfig.keyframes.splice(origIdx, 1);
      renderKfList();
    });
  });
}

/** Schedule manual keyframes: start poses + timed hand moves. */
function scheduleManualGestures(durationMs) {
  // Apply starting positions immediately
  if (manualConfig.startR) {
    const p = allPoses.R?.[manualConfig.startR];
    if (p) animatePartPose('R', capturePartialPose(PART_BONES.R), p, 1000);
  }
  if (manualConfig.startL) {
    const p = allPoses.L?.[manualConfig.startL];
    if (p) animatePartPose('L', capturePartialPose(PART_BONES.L), p, 1000);
  }
  // Schedule each keyframe at its fractional time
  manualConfig.keyframes.forEach(kf => {
    const delay = Math.round(kf.frac * durationMs);
    const part  = kf.hand; // 'R' or 'L'
    const poseData = allPoses[part]?.[kf.pose];
    if (!poseData) return;
    const t = setTimeout(() => {
      animatePartPose(part, capturePartialPose(PART_BONES[part]), poseData, 1100);
    }, delay);
    _manualTimers.push(t);
  });
}

function cancelManualGestures() {
  _manualTimers.forEach(clearTimeout);
  _manualTimers = [];
}

let _manualTimers = [];

// ── Manual panel: collapsible toggle ─────────────────────────
let _maPanelOpen = true;
maHeader.addEventListener('click', () => {
  _maPanelOpen = !_maPanelOpen;
  maBody.classList.toggle('collapsed', !_maPanelOpen);
  maChevron.classList.toggle('open', _maPanelOpen);
});
maChevron.classList.add('open'); // start expanded

// ── Manual panel: sync visibility with emotion toggle ─────────
function updateManualPanelVisibility() {
  maSection.classList.toggle('hidden-section', enhancementEnabled);
  maHeaderHint.textContent = enhancementEnabled ? '(Emotions ON)' : 'Emotions OFF';
}
updateManualPanelVisibility();

// ── Manual panel: position slider ────────────────────────────
maKfPos.addEventListener('input', () => {
  maKfPosLabel.textContent = `${maKfPos.value}%`;
});

// ── Manual panel: hand change → refresh pose dropdown ────────
maKfHand.addEventListener('change', refreshKfPoseDropdown);

// ── Manual panel: start-position selects → sync state ────────
maStartR.addEventListener('change', () => { manualConfig.startR = maStartR.value; });
maStartL.addEventListener('change', () => { manualConfig.startL = maStartL.value; });

// ── Manual panel: Add keyframe ────────────────────────────────
maKfAdd.addEventListener('click', () => {
  const pose = maKfPose.value;
  if (!pose) return;
  const frac = parseFloat(maKfPos.value) / 100;
  const hand = maKfHand.value;
  manualConfig.keyframes.push({ frac, hand, pose });
  // Sort in place
  manualConfig.keyframes.sort((a, b) => a.frac - b.frac);
  renderKfList();
  // Reset pose select for next pick
  maKfPose.value = '';
});

// ── Manual panel: Clear all ───────────────────────────────────
maKfClear.addEventListener('click', () => {
  manualConfig.keyframes = [];
  renderKfList();
});

// ── Manual panel: Save / Load (persisted to disk for AI Presenter) ──
function applyPresenterConfig(saved) {
  manualConfig.startR    = saved.startR    ?? '';
  manualConfig.startL    = saved.startL    ?? '';
  manualConfig.keyframes = Array.isArray(saved.keyframes) ? saved.keyframes : [];
  maStartR.value = manualConfig.startR;
  maStartL.value = manualConfig.startL;
  renderKfList();
}

maSave.addEventListener('click', async () => {
  const orig = maSave.textContent;
  try {
    await savePresenterAnimation(manualConfig);
    maLoad.disabled = false;
    maSave.textContent = '✓ Saved as default';
    setStatus('Default animation saved — AI Presenter will use this when Emotions are OFF.');
    setTimeout(() => { maSave.textContent = orig; }, 1800);
  } catch (e) {
    setStatus(`Save failed: ${e.message}`);
  }
});

maLoad.addEventListener('click', async () => {
  const orig = maLoad.textContent;
  try {
    await applyPresenterConfig(await fetchPresenterAnimation());
    maLoad.textContent = '✓ Reloaded';
    setTimeout(() => { maLoad.textContent = orig; }, 1200);
  } catch (e) {
    setStatus(`Reload failed: ${e.message}`);
  }
});

// ── Init Three.js scene ───────────────────────────────────────
initScene(container);

setStatus('Loading character…');
loadCharacter(
  'character.glb',
  async () => {
    await Promise.all(['L', 'R', 'H'].map(loadPoses));
    characterReady = true;
    generateBtn.disabled = false;
    setStatus('Ready — type something and press Generate.');
    ['L', 'R', 'H'].forEach(p => partControllers[p]?.renderPoseList?.());
    populateManualPoseDropdowns();
    const savedAnim = await fetchPresenterAnimation();
    applyPresenterConfig(savedAnim);
    if (hasPresenterAnimation(savedAnim)) maLoad.disabled = false;
  },
  () => setStatus('⚠ Could not load character.glb — put it in /public'),
);

// ── Speed slider ──────────────────────────────────────────────
speedSlider.addEventListener('input', () => {
  currentSpeed = parseFloat(speedSlider.value);
  speedLabel.textContent = `${currentSpeed.toFixed(2)}×`;
  if (currentPlayer) currentPlayer.setSpeed(currentSpeed);
});

delaySlider.addEventListener('input', () => {
  currentDelayS = parseFloat(delaySlider.value);
  delayLabel.textContent = `${currentDelayS.toFixed(2)}s`;
});

// ── Pose Studio ───────────────────────────────────────────────
const allPoses = { L: {}, R: {}, H: {} };

async function loadPoses(part) {
  try {
    const res = await fetch(`/api/poses/${part}`);
    allPoses[part] = res.ok ? await res.json() : {};
  } catch {
    allPoses[part] = {};
  }
}

async function savePoses(part) {
  try {
    await fetch(`/api/poses/${part}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allPoses[part]),
    });
  } catch {
    // Ignore network errors.
  }
}

const JOINT_LABELS = {};
JOINT_LABELS['DEF-spine004'] = 'Neck';
JOINT_LABELS['DEF-spine006'] = 'Head';
['L', 'R'].forEach(s => {
  JOINT_LABELS[`DEF-upper_arm${s}`] = `Shoulder ${s}`;
  JOINT_LABELS[`DEF-forearm${s}`]   = `Elbow ${s}`;
  JOINT_LABELS[`DEF-hand${s}`]      = `Wrist ${s}`;
  [['thumb','Thumb'],['f_index','Index'],['f_middle','Middle'],['f_ring','Ring'],['f_pinky','Pinky']].forEach(([f,fn]) => {
    ['Base','Mid','Tip'].forEach((seg, i) => {
      JOINT_LABELS[`DEF-${f}0${i+1}${s}`] = `${fn} ${s} · ${seg}`;
    });
  });
});

const JOINT_AXES = {};
JOINT_AXES['DEF-spine004']   = { up:['x',-1], dn:['x',+1], lt:['y',+1], rt:['y',-1], rl:null,     rr:null     };
JOINT_AXES['DEF-spine006']   = { up:['x',-1], dn:['x',+1], lt:['y',+1], rt:['y',-1], rl:null,     rr:null     };
JOINT_AXES['DEF-upper_armL'] = { up:['z',+1], dn:['z',-1], lt:['y',-1], rt:['y',+1], rl:['x',-1], rr:['x',+1] };
JOINT_AXES['DEF-upper_armR'] = { up:['z',-1], dn:['z',+1], lt:['y',+1], rt:['y',-1], rl:['x',+1], rr:['x',-1] };
JOINT_AXES['DEF-forearmL']   = { up:['x',+1], dn:['x',-1], lt:null,      rt:null,     rl:['z',+1], rr:['z',-1] };
JOINT_AXES['DEF-forearmR']   = { up:['x',+1], dn:['x',-1], lt:null,      rt:null,     rl:['z',-1], rr:['z',+1] };
JOINT_AXES['DEF-handL']      = { up:['z',+1], dn:['z',-1], lt:['y',+1], rt:['y',-1], rl:['x',-1], rr:['x',+1] };
JOINT_AXES['DEF-handR']      = { up:['z',-1], dn:['z',+1], lt:['y',+1], rt:['y',-1], rl:['x',+1], rr:['x',-1] };
['L','R'].forEach(s => {
  const sd = s === 'L' ? 1 : -1;
  ['thumb','f_index','f_middle','f_ring','f_pinky'].forEach(f => {
    for (let i = 1; i <= 3; i++) {
      const nm = `DEF-${f}0${i}${s}`;
      JOINT_AXES[nm] = { up:['x',-1], dn:['x',+1], lt:null, rt:null, rl:null, rr:null };
      if (i === 1) { JOINT_AXES[nm].lt = ['z',+sd]; JOINT_AXES[nm].rt = ['z',-sd]; }
    }
  });
});

const CTRL_LABELS = {};
CTRL_LABELS['DEF-upper_armL'] = { up:'▲ Raise',   dn:'▼ Lower',   lt:'⟵ Forward', rt:'Back ⟶',  rl:'↺ Twist',  rr:'Twist ↻'  };
CTRL_LABELS['DEF-upper_armR'] = { up:'▲ Raise',   dn:'▼ Lower',   lt:'⟵ Forward', rt:'Back ⟶',  rl:'↺ Twist',  rr:'Twist ↻'  };
CTRL_LABELS['DEF-forearmL']   = { up:'↑ Bend',    dn:'↓ Extend',  lt:null,          rt:null,       rl:'↺ Rotate', rr:'Rotate ↻' };
CTRL_LABELS['DEF-forearmR']   = { up:'↑ Bend',    dn:'↓ Extend',  lt:null,          rt:null,       rl:'↺ Rotate', rr:'Rotate ↻' };
CTRL_LABELS['DEF-handL']      = { up:'▲ Flex Up', dn:'▼ Flex Dn', lt:'◄ Tilt L',  rt:'Tilt R ►', rl:'↺ Roll',   rr:'Roll ↻'   };
CTRL_LABELS['DEF-handR']      = { up:'▲ Flex Up', dn:'▼ Flex Dn', lt:'◄ Tilt L',  rt:'Tilt R ►', rl:'↺ Roll',   rr:'Roll ↻'   };
CTRL_LABELS['DEF-spine004']   = { up:'▲ Look Up', dn:'▼ Look Dn', lt:'◄ Turn L',  rt:'Turn R ►', rl:null,       rr:null       };
CTRL_LABELS['DEF-spine006']   = { up:'▲ Look Up', dn:'▼ Look Dn', lt:'◄ Turn L',  rt:'Turn R ►', rl:null,       rr:null       };

let activePart = 'R';
const partControllers = {};

document.querySelectorAll('.ps-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    activePart = tab.dataset.part;
    document.querySelectorAll('.ps-tab').forEach(t => t.classList.toggle('active', t === tab));
    document.querySelectorAll('.ps-panel').forEach(p =>
      p.style.display = p.id === `ps-panel-${activePart}` ? '' : 'none'
    );
  });
});

document.addEventListener('keydown', e => {
  if (['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  const dir = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[e.key];
  if (!dir) return;
  e.preventDefault();
  partControllers[activePart]?.applyDir(dir);
});

function holdButton(el, fn) {
  let timer = null;
  const start = () => { fn(); timer = setInterval(fn, 80); };
  const stop  = () => { clearInterval(timer); timer = null; };
  el.addEventListener('mousedown',   start);
  el.addEventListener('mouseup',     stop);
  el.addEventListener('mouseleave',  stop);
  el.addEventListener('touchstart',  e => { e.preventDefault(); start(); }, { passive: false });
  el.addEventListener('touchend',    stop);
  el.addEventListener('touchcancel', stop);
}

function initPart(part) {
  const s  = suffix => document.getElementById(suffix + '-' + part);
  const bones = PART_BONES[part];
  let selectedJoint = part === 'H' ? 'DEF-spine004' : null;

  function setSelectedJoint(bone) {
    selectedJoint = bone;
    document.querySelectorAll(`.joint-btn[data-part="${part}"]`).forEach(b =>
      b.classList.toggle('selected', b.dataset.bone === bone)
    );
    const nm = s('ps-selected-name');
    if (nm) nm.textContent = bone ? (JOINT_LABELS[bone] || bone) : '— select —';
    const ax  = bone ? (JOINT_AXES[bone]  || {}) : {};
    const lbl = bone ? (CTRL_LABELS[bone] || {}) : {};
    const isFinger = bone && /DEF-(thumb|f_index|f_middle|f_ring|f_pinky)/.test(bone);
    const isBase   = isFinger && /01[LR]$/.test(bone);
    [
      ['ps-up',      ax.up,  lbl.up  || (isFinger ? '▲ Extend' : '▲')],
      ['ps-down',    ax.dn,  lbl.dn  || (isFinger ? '▼ Curl'   : '▼')],
      ['ps-left',    ax.lt,  lbl.lt  || (isBase   ? '◄ Splay'  : '◄')],
      ['ps-right',   ax.rt,  lbl.rt  || (isBase   ? 'Splay ►'  : '►')],
      ['ps-rollin',  ax.rl,  lbl.rl  || '↺'],
      ['ps-rollout', ax.rr,  lbl.rr  || '↻'],
    ].forEach(([id, axis, label]) => {
      const btn = s(id);
      if (!btn) return;
      btn.textContent = label;
      btn.disabled = !axis;
      btn.style.display = axis ? '' : 'none';
    });
  }

  function getStep() {
    const el = s('ps-step');
    return (el ? parseFloat(el.value) : 5) * Math.PI / 180;
  }

  function applyDir(dir) {
    if (!selectedJoint) return;
    const ax = JOINT_AXES[selectedJoint];
    if (!ax) return;
    const info = { up: ax.up, down: ax.dn, left: ax.lt, right: ax.rt, rollin: ax.rl, rollout: ax.rr }[dir];
    if (!info) return;
    tweakJoint(selectedJoint, info[0], info[1] * getStep());
  }

  if (part !== 'H') {
    document.querySelectorAll(`.joint-btn[data-part="${part}"]`).forEach(btn => {
      btn.addEventListener('click', () => setSelectedJoint(btn.dataset.bone));
    });
  }

  holdButton(s('ps-up'),      () => applyDir('up'));
  holdButton(s('ps-down'),    () => applyDir('down'));
  holdButton(s('ps-left'),    () => applyDir('left'));
  holdButton(s('ps-right'),   () => applyDir('right'));
  holdButton(s('ps-rollin'),  () => applyDir('rollin'));
  holdButton(s('ps-rollout'), () => applyDir('rollout'));
  s('ps-reset-joint').addEventListener('click', () => { if (selectedJoint) resetJoint(selectedJoint); });
  setSelectedJoint(selectedJoint); // initialise labels / visibility

  const stepEl = s('ps-step'), stepVal = s('ps-step-val');
  if (stepEl) stepEl.addEventListener('input', () => { if (stepVal) stepVal.textContent = stepEl.value + '°'; });

  function renderPoseList() {
    const list = s('ps-pose-list');
    if (!list) return;
    const keys = Object.keys(allPoses[part]);
    list.innerHTML = keys.length
      ? keys.map(n =>
          `<div class="ps-pose-row">
            <span class="ps-pose-name" title="${n}">${n}</span>
            <button class="ps-pose-apply" data-name="${n}" data-part="${part}" title="Apply">▶</button>
            <button class="ps-pose-del"   data-name="${n}" data-part="${part}" title="Delete">×</button>
          </div>`
        ).join('')
      : '<div class="ps-no-poses">No poses saved</div>';
    const qsel = document.getElementById(`pose-quick-${part}`);
    if (qsel) {
      const prev = qsel.value;
      const label = part === 'R' ? 'R. Hand' : part === 'L' ? 'L. Hand' : 'Head';
      qsel.innerHTML = `<option value="">— ${label} pose —</option>`
        + keys.map(k => `<option value="${k}">${k}</option>`).join('');
      if (keys.includes(prev)) qsel.value = prev;
    }
  }

  s('ps-save-pose').addEventListener('click', () => {
    const el = s('ps-pose-name'), name = el ? el.value.trim() : '';
    if (!name) { if (el) el.focus(); return; }
    allPoses[part][name] = capturePartialPose(bones);
    savePoses(part);
    renderPoseList();
    if (el) el.value = '';
  });
  s('ps-pose-name').addEventListener('keydown', e => { if (e.key === 'Enter') s('ps-save-pose').click(); });

  s('ps-pose-list').addEventListener('click', e => {
    const name = e.target.dataset.name;
    if (!name || !allPoses[part][name]) return;
    if (e.target.classList.contains('ps-pose-apply')) {
      applyPose(allPoses[part][name]);
    } else if (e.target.classList.contains('ps-pose-del')) {
      delete allPoses[part][name];
      savePoses(part);
      renderPoseList();
    }
  });

  renderPoseList();
  return { applyDir, renderPoseList };
}

partControllers.L = initPart('L');
partControllers.R = initPart('R');
partControllers.H = initPart('H');

// Quick-pose selects — smooth transition to selected pose
['R', 'L', 'H'].forEach(part => {
  const sel = document.getElementById(`pose-quick-${part}`);
  if (!sel) return;
  sel.addEventListener('change', () => {
    const name = sel.value;
    if (!name || !allPoses[part][name]) return;
    animatePartPose(part, capturePartialPose(PART_BONES[part]), allPoses[part][name], 1000);
  });
});

stopBtn.addEventListener('click', () => {
  cancelGestures();
  cancelManualGestures();
  if (currentPlayer) { currentPlayer.stop(); currentPlayer = null; }
  clearActiveUI();
  phonemeOverlay.innerHTML = '';
  timelineTime.textContent = '';
});
playBtn.addEventListener('click', () => startPlayback(0));
replayBtn.addEventListener('click', () => startPlayback(0));

// ── Generate ──────────────────────────────────────────────────
generateBtn.addEventListener('click', () => {
  const text = labInput.value.trim();
  if (!text)           return setStatus('Please type some text first.');
  if (!characterReady) return setStatus('Character still loading…');
  doGenerate(text);
});
labInput.addEventListener('keydown', e => { if (e.key === 'Enter') generateBtn.click(); });

// ─────────────────────────────────────────────────────────────
// Generation pipeline
// ─────────────────────────────────────────────────────────────
async function doGenerate(text) {
  // Reset
  cancelGestures();
  cancelManualGestures();
  if (currentPlayer) { currentPlayer.stop(); currentPlayer = null; }
  rawCues = [];
  sections = [];
  decodedBuffer = null;
  renderTimeline([]);
  renderCueGrid([]);
  phonemeOverlay.innerHTML = '';
  timelineTime.textContent = '';
  playBtn.disabled   = true;
  replayBtn.disabled = true;
  stopBtn.disabled   = true;
  generateBtn.disabled = true;

  try {
    currentDirectives = enhancementEnabled ? analyzeSpeechDirectives(text) : null;

    // 1. TTS
    setStatus('Synthesising speech…');
    updateScreenText(text);
    const { audioBlob } = enhancementEnabled && currentDirectives
      ? await synthesise(text, {
          enhanced: true,
          rate: currentDirectives.tts.rate,
          voice: currentDirectives.tts.voice,
          style: currentDirectives.tts.style,
        })
      : await synthesise(text, { enhanced: false });

    // 2. Decode
    setStatus('Decoding audio…');
    if (!audioCtx) audioCtx = new AudioContext();
    await audioCtx.resume();
    decodedBuffer = await audioCtx.decodeAudioData(await audioBlob.arrayBuffer());

    // 3. Rhubarb lip-sync (server-side MP3→WAV→phonemes)
    setStatus('Analyzing lip sync…');
    const cueList = await buildLipSyncCues(audioBlob, text);
    rawCues = cueList.map((c, i) => ({
      start: c.time,
      end: cueList[i + 1]?.time ?? decodedBuffer.duration,
      value: c.shape,
    }));
    sections = buildSectionsFromRawCues();

    // 4. Render UI
    renderTimeline(rawCues);
    renderCueGrid(rawCues);
    cueCount.textContent = `${rawCues.length} sections`;
    setStatus(`${rawCues.length} phoneme sections — click ▶ Play or any section to start.`);
    playBtn.disabled   = false;
    replayBtn.disabled = false;
    stopBtn.disabled   = false;

  } catch (err) {
    console.error('[lab]', err);
    setStatus(`Error: ${err.message}`);
  } finally {
    generateBtn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Playback helpers
// ─────────────────────────────────────────────────────────────
async function startPlayback(fromOffset) {
  if (!decodedBuffer || !sections.length) return;
  if (!audioCtx) audioCtx = new AudioContext();
  await audioCtx.resume(); // must await — Chrome auto-suspends idle contexts
  if (currentPlayer) currentPlayer.stop();
  // Schedule gestures on full play (not mid-clip seeks) so the timeline aligns.
  cancelGestures();
  cancelManualGestures();
  if (fromOffset === 0) {
    if (enhancementEnabled) {
      // Emotion mode: use emotion-analysis profile.
      const effectiveDirectives = currentDirectives
        ?? analyzeSpeechDirectives(labInput.value.trim());
      scheduleGestures(
        decodedBuffer.duration * 1000,
        allPoses,
        effectiveDirectives.gesture
      );
    } else {
      // Manual mode: apply user-defined starting positions + keyframes.
      scheduleManualGestures(decodedBuffer.duration * 1000);
    }
  }
  currentPlayer = new Player(audioCtx, decodedBuffer, sections, currentSpeed);
  currentPlayer.play(fromOffset);
}

function seekToCue(cueIndex) {
  const cue = rawCues[cueIndex];
  if (!cue) return;
  startPlayback(cue.start);
}

// ─────────────────────────────────────────────────────────────
// Timeline bar
// ─────────────────────────────────────────────────────────────
function renderTimeline(cues) {
  timelineBar.innerHTML = '';
  if (!cues.length) return;

  const total = cues[cues.length - 1].end || 1;
  cues.forEach((cue, i) => {
    const pct = ((cue.end - cue.start) / total) * 100;
    const seg = document.createElement('div');
    seg.className = 'tl-seg';
    seg.dataset.index = i;
    seg.style.width    = `${Math.max(pct, 0.15)}%`;
    seg.style.background = SHAPE_INFO[cue.value]?.color ?? '#888';
    seg.title = `${cue.value} · ${cue.start.toFixed(3)}s – ${cue.end.toFixed(3)}s`;
    seg.addEventListener('click', () => seekToCue(i));
    timelineBar.appendChild(seg);
  });
}

// ─────────────────────────────────────────────────────────────
// Cue grid
// ─────────────────────────────────────────────────────────────
function renderCueGrid(cues) {
  cueGrid.innerHTML = '';
  cues.forEach((cue, i) => {
    const info = SHAPE_INFO[cue.value] ?? { color: '#888', phonemes: '?', desc: '' };
    const chip = document.createElement('div');
    chip.className = 'cue-chip';
    chip.dataset.index = i;
    chip.title = `${cue.value}: ${info.phonemes} — ${info.desc}\n${cue.start.toFixed(3)}s – ${cue.end.toFixed(3)}s`;
    chip.innerHTML = `
      <span class="cue-letter" style="background:${info.color}">${cue.value}</span>
      <span class="cue-time">${cue.start.toFixed(2)}s · ${((cue.end - cue.start) * 1000).toFixed(0)}ms</span>
      <span class="cue-phonemes">${info.phonemes}</span>
      <button class="cue-seg-btn" title="Play this segment only (${cue.start.toFixed(3)}s – ${cue.end.toFixed(3)}s)">&#9654;</button>
    `;
    chip.addEventListener('click', e => {
      if (e.target.classList.contains('cue-seg-btn')) return;
      seekToCue(i);
    });
    chip.querySelector('.cue-seg-btn').addEventListener('click', e => {
      e.stopPropagation();
      playSegment(i);
    });
    cueGrid.appendChild(chip);
  });
}

// ─────────────────────────────────────────────────────────────
// Active-cue UI update (called every animation frame)
// ─────────────────────────────────────────────────────────────
function updateActiveUI(cueIndex, audioPos) {
  // Timeline segment
  const prevActiveSeg = timelineBar.querySelector('.tl-seg.active');
  if (prevActiveSeg && parseInt(prevActiveSeg.dataset.index) !== cueIndex) {
    prevActiveSeg.classList.remove('active');
  }
  if (cueIndex >= 0) {
    const seg = timelineBar.querySelector(`[data-index="${cueIndex}"]`);
    if (seg && !seg.classList.contains('active')) seg.classList.add('active');
  }

  // Cue chip
  const prevActiveChip = cueGrid.querySelector('.cue-chip.active');
  if (prevActiveChip && parseInt(prevActiveChip.dataset.index) !== cueIndex) {
    prevActiveChip.classList.remove('active');
    const chip2 = cueGrid.querySelector(`[data-index="${cueIndex}"]`);
    if (chip2) { chip2.classList.add('active'); chip2.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  } else if (cueIndex >= 0 && !prevActiveChip) {
    const chip = cueGrid.querySelector(`[data-index="${cueIndex}"]`);
    if (chip) { chip.classList.add('active'); chip.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); }
  }

  // Timeline timestamp
  if (typeof audioPos === 'number') {
    timelineTime.textContent = `${audioPos.toFixed(2)}s`;
  }

  // Phoneme overlay
  if (cueIndex >= 0) {
    const cue  = rawCues[cueIndex];
    const info = SHAPE_INFO[cue?.value] ?? { color: '#fff', phonemes: '?', desc: '' };
    phonemeOverlay.innerHTML = `
      <span class="po-shape" style="color:${info.color}">${cue.value}</span>
      <span class="po-phonemes">${info.phonemes}</span>
      <span class="po-desc">${info.desc}</span>
      <span class="po-time">${audioPos?.toFixed(3) ?? ''}s</span>
    `;
  } else {
    phonemeOverlay.innerHTML = '';
  }
}

function clearActiveUI() {
  timelineBar.querySelectorAll('.tl-seg.active').forEach(el => el.classList.remove('active'));
  cueGrid.querySelectorAll('.cue-chip.active').forEach(el => el.classList.remove('active'));
  phonemeOverlay.innerHTML = '';
  timelineTime.textContent = '';
}

function setStatus(msg) { labStatus.textContent = msg; }

// ─────────────────────────────────────────────────────────────
// Segment preview
// ─────────────────────────────────────────────────────────────
// Plays exactly one cue's audio slice [cue.start, cue.end) in isolation.
// The face shape is applied synchronously BEFORE audio.start() is called,
// so the morph is 100% in place when the very first sample plays — no delay.
function playSegment(i) {
  const cue = rawCues[i];
  if (!cue || !decodedBuffer) return;

  // Stop any running full playback or previous segment
  if (currentPlayer) { currentPlayer.stop(); currentPlayer = null; }
  if (_segSource) { try { _segSource.stop(); } catch (_) {} _segSource = null; }
  if (_segTimer)  { clearTimeout(_segTimer); _segTimer = null; }
  clearActiveUI();

  const segDuration = Math.max(0.001, cue.end - cue.start);
  if (!audioCtx) audioCtx = new AudioContext();
  audioCtx.resume();

  // 1. Snap face to the cue's shape immediately — before any audio plays.
  const shape = cue.value;
  forceResetNonActive(shape);
  if (shape === 'X') {
    setMorphTarget('X', 1.0);
    SPEECH_SHAPES.forEach(s => setMorphTarget(s, 0.0));
  } else {
    setMorphTarget('X', 0.0);
    SPEECH_SHAPES.forEach(s => setMorphTarget(s, s === shape ? 1.0 : 0.0));
  }

  // Highlight chip in green
  document.querySelectorAll('.cue-chip.seg-active').forEach(el => el.classList.remove('seg-active'));
  cueGrid.querySelector(`[data-index="${i}"]`)?.classList.add('seg-active');

  // Update phoneme overlay
  const info = SHAPE_INFO[shape] ?? { color: '#fff', phonemes: '?', desc: '' };
  phonemeOverlay.innerHTML = `
    <span class="po-shape" style="color:${info.color}">${shape}</span>
    <span class="po-phonemes">${info.phonemes}</span>
    <span class="po-desc">${info.desc}</span>
    <span class="po-time">${cue.start.toFixed(3)}s – ${cue.end.toFixed(3)}s</span>
  `;

  // 2. Play only this section's pre-sliced buffer.
  //    The buffer already contains exactly [cue.start, cue.end) of PCM,
  //    so src.start(0) plays the right audio with no offset math needed.
  const src = audioCtx.createBufferSource();
  src.buffer = sections[i]?.buffer ?? decodedBuffer;
  src.playbackRate.value = currentSpeed;
  src.connect(audioCtx.destination);
  src.start(0);
  _segSource = src;

  // 3. Clean up when the section's audio ends naturally (via onended).
  src.onended = () => {
    if (_segSource !== src) return;  // a newer preview has taken over
    resetMorphTargets();
    document.querySelectorAll('.cue-chip.seg-active').forEach(el => el.classList.remove('seg-active'));
    phonemeOverlay.innerHTML = '';
    _segSource = null;
    if (_segTimer) { clearTimeout(_segTimer); _segTimer = null; }
  };
  // Safety timeout: if onended never fires (e.g. browser bug), clean up anyway.
  const safetyMs = Math.max(0.001, cue.end - cue.start) / currentSpeed * 1000 + 500;
  if (_segTimer) clearTimeout(_segTimer);
  _segTimer = setTimeout(() => {
    if (_segSource !== src) return;
    try { src.stop(); } catch (_) {}
    resetMorphTargets();
    document.querySelectorAll('.cue-chip.seg-active').forEach(el => el.classList.remove('seg-active'));
    phonemeOverlay.innerHTML = '';
    _segSource = null;
    _segTimer  = null;
  }, safetyMs);
}

// ─────────────────────────────────────────────────────────────
// Player — continuous single-buffer playback with timed shape changes
// ─────────────────────────────────────────────────────────────
// Plays the full decoded AudioBuffer as ONE AudioBufferSourceNode so the
// audio is completely gapless.  Mouth shape changes are driven by
// setTimeout calls scheduled against the Web Audio clock — each shape fires
// SHAPE_LEAD_S (50ms) before its phoneme audio arrives so the morph lerp
// in scene.js (t₉₅ ≈ 50ms) settles exactly on time.
class Player {
  /**
   * @param {AudioContext} ctx
   * @param {AudioBuffer}  buffer    – full decoded buffer
   * @param {{ shape:string, start:number, end:number }[]} sections
   * @param {number} speed
   */
  constructor(ctx, buffer, sections, speed) {
    this.ctx      = ctx;
    this.buffer   = buffer;
    this.sections = sections;
    this.speed    = speed;

    this._src            = null;   // the one live AudioBufferSourceNode
    this._startAudioTime = 0;      // ctx.currentTime when audio was scheduled to start
    this._startOffset    = 0;      // buffer seconds where playback began
    this._playing        = false;
    this._rafId          = null;
    this._prevShape      = null;
  }

  /** Playhead position in seconds within the original audio buffer.
   * Subtracts ctx.outputLatency so shapes lead by SHAPE_LEAD_S relative to
   * what is actually *heard*. Chrome on Windows has outputLatency ~100ms;
   * without this the mouth moves ~250ms ahead of the audio in Chrome. */
  get audioPos() {
    if (!this._playing) return 0;
    const outputLat = this.ctx.outputLatency || 0;
    return this._startOffset +
      Math.max(0, this.ctx.currentTime - this._startAudioTime - outputLat) * this.speed;
  }

  /** Start (or restart) playback from `fromOffset` seconds into the audio. */
  play(fromOffset = 0) {
    this._stopCurrent();
    this._prevShape = null;

    const startAt = this.ctx.currentTime + SHAPE_LEAD_S;
    this._startAudioTime = startAt;
    this._startOffset    = fromOffset;

    const src = this.ctx.createBufferSource();
    src.buffer             = this.buffer;
    src.playbackRate.value = this.speed;
    src.connect(this.ctx.destination);
    src.start(startAt, fromOffset);
    this._src     = src;
    this._playing = true;

    src.onended = () => {
      if (!this._playing) return;
      this._playing = false;
      cancelAnimationFrame(this._rafId);
      resetMorphTargets();
      clearActiveUI();
      phonemeOverlay.innerHTML = '';
      timelineTime.textContent = '';
      setStatus(`${this.sections.length} sections — click ▶ Play or any section to replay.`);
    };

    this._tick();
  }

  /** Change playback speed: capture current position, restart at new rate. */
  setSpeed(s) {
    const pos  = this.audioPos;
    this.speed = s;
    if (this._playing) this.play(pos);
  }

  /** Hard stop — kills the source node and cancels all pending shape timers. */
  stop() {
    this._stopCurrent();
    this._playing = false;
    resetMorphTargets();
  }

  // ── Private ──────────────────────────────────────────────

  _stopCurrent() {
    if (this._src) {
      this._src.onended = null;
      try { this._src.stop(); } catch (_) {}
      this._src = null;
    }
    if (this._rafId) { cancelAnimationFrame(this._rafId); this._rafId = null; }
  }

  _applyShape(shape) {
    if (shape !== this._prevShape) {
      forceResetNonActive(shape);
      this._prevShape = shape;
    }
    if (shape === 'X') {
      setMorphTarget('X', 1.0);
      SPEECH_SHAPES.forEach(s => setMorphTarget(s, 0.0));
    } else {
      setMorphTarget('X', 0.0);
      SPEECH_SHAPES.forEach(s => setMorphTarget(s, s === shape ? 1.0 : 0.0));
    }
  }

  /** RAF loop — shape sync (audio-clock polling) + UI updates. */
  _tick() {
    if (!this._playing) return;

    const pos      = this.audioPos;
    const lookAhead = pos + SHAPE_LEAD_S;

    // Apply the correct shape for the current look-ahead position.
    // Using the audio clock directly means late frames self-correct
    // instead of drifting permanently like setTimeout would.
    let shapeIdx = -1;
    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].start <= lookAhead) shapeIdx = i;
      else break;
    }
    if (shapeIdx >= 0) {
      const shape = this.sections[shapeIdx].shape;
      if (shape !== this._prevShape) this._applyShape(shape);
    }

    // UI highlight uses actual pos (no look-ahead) so it matches audio.
    let activeIdx = -1;
    for (let i = 0; i < this.sections.length; i++) {
      if (this.sections[i].start <= pos) activeIdx = i;
      else break;
    }

    updateActiveUI(activeIdx, pos);
    this._rafId = requestAnimationFrame(() => this._tick());
  }
}

// ─────────────────────────────────────────────────────────────
// WAV encoder (16-bit PCM, for Rhubarb)
// ─────────────────────────────────────────────────────────────
function _audioBufferToWav(buffer) {
  const numCh    = buffer.numberOfChannels;
  const sr       = buffer.sampleRate;
  const len      = buffer.length;
  const bps      = 2;
  const dataSize = numCh * len * bps;
  const ab       = new ArrayBuffer(44 + dataSize);
  const v        = new DataView(ab);
  const str = (off, s) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF');  v.setUint32( 4, 36 + dataSize, true);
  str(8, 'WAVE');  str(12, 'fmt ');
  v.setUint32(16, 16, true);       v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true);    v.setUint32(24, sr, true);
  v.setUint32(28, sr * numCh * bps, true);
  v.setUint16(32, numCh * bps, true); v.setUint16(34, 16, true);
  str(36, 'data'); v.setUint32(40, dataSize, true);
  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return ab;
}

/** Resample an AudioBuffer to mono 16 kHz PCM WAV — the format pocketSphinx needs. */
async function _resampleToMonoWav(buffer) {
  const TARGET_SR  = 16000;
  const numFrames  = Math.ceil(buffer.duration * TARGET_SR);
  const offCtx     = new OfflineAudioContext(1, numFrames, TARGET_SR);
  const src        = offCtx.createBufferSource();
  src.buffer       = buffer;
  src.connect(offCtx.destination);
  src.start(0);
  const mono = await offCtx.startRendering();
  return _audioBufferToWav(mono);
}

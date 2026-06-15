/**
 * pose-studio.js
 * ─────────────────────────────────────────────────────────────
 * Pose Studio UI — the control panel that lets you save, apply,
 * and fine-tune character poses during development.
 *
 * Sections
 * ────────
 * 1. Pose store     – allPoses, loadPoses(), savePoses()
 * 2. Joint data     – JOINT_LABELS, JOINT_AXES, CTRL_LABELS
 * 3. UI helpers     – holdButton(), initPart()
 * 4. Wiring         – tab switching, keyboard arrows, quick-pose selects
 * 5. Bootstrap      – initPoseStudio() called once from main.js
 *
 * Exports
 * ───────
 * allPoses           – live pose store { L:{…}, R:{…}, H:{…} }
 * loadPoses(part)    – fetch saved poses from server into allPoses
 * initPoseStudio()   – wire all UI, return partControllers object
 * ─────────────────────────────────────────────────────────────
 */

import {
  tweakJoint,         // tweakJoint(boneName, axis, deltaRad) – rotates bone by delta
  capturePartialPose, // capturePartialPose(bones[]) – snapshot current bone rotations
  applyPose,          // applyPose(poseObj) – instantly jump to a pose
  animatePartPose,    // animatePartPose(part, from, to, ms) – smooth lerp
  resetJoint,         // resetJoint(boneName) – return bone to rest rotation
  PART_BONES,         // { R:[…bones], L:[…], H:[…] }
} from './scene.js';

// ── 1. Pose store ─────────────────────────────────────────────
// In-memory store of saved poses for each body part.
// Structure: { L: { poseName: { boneName: {x,y,z} } }, R: {…}, H: {…} }
export const allPoses = { L: {}, R: {}, H: {} };

// loadPoses(part): fetch saved poses from disk via GET /api/poses/:part
// (poses.json copied from the original avatar project; see vite-plugins/avatarStudioApi.js).
export async function loadPoses(part) {
  try {
    const res = await fetch(`/api/poses/${part}`);
    allPoses[part] = res.ok ? await res.json() : {};
  } catch {
    allPoses[part] = {};
  }
}

// savePoses(part): persist poses to disk via POST /api/poses/:part.
async function savePoses(part) {
  try {
    await fetch(`/api/poses/${part}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allPoses[part]),
    });
  } catch {
    // Ignore network errors so the UI remains usable.
  }
}

// ── 2. Joint data ─────────────────────────────────────────────

// JOINT_LABELS: GLB bone name → human-readable label shown in the Pose Studio header.
const JOINT_LABELS = {};
JOINT_LABELS['DEF-spine004'] = 'Neck'; // base-of-neck bone — tilts head from below
JOINT_LABELS['DEF-spine006'] = 'Head'; // top-of-neck bone — fine head rotation
['L', 'R'].forEach(s => {
  JOINT_LABELS[`DEF-upper_arm${s}`] = `Shoulder ${s}`;
  JOINT_LABELS[`DEF-forearm${s}`]   = `Elbow ${s}`;
  JOINT_LABELS[`DEF-hand${s}`]      = `Wrist ${s}`;
  // Each finger has 3 segments: 01=Base, 02=Mid, 03=Tip
  [['thumb','Thumb'],['f_index','Index'],['f_middle','Middle'],['f_ring','Ring'],['f_pinky','Pinky']]
    .forEach(([f, fn]) => {
      ['Base', 'Mid', 'Tip'].forEach((seg, i) => {
        JOINT_LABELS[`DEF-${f}0${i + 1}${s}`] = `${fn} ${s} · ${seg}`; // e.g. "Index L · Base"
      });
    });
});

// JOINT_AXES: bone name → { up, dn, lt, rt, rl, rr }
// Each direction maps to [axis, sign] or null.
//   axis  – 'x' | 'y' | 'z'  — which Euler rotation to change
//   sign  – +1 | -1           — positive = counter-clockwise in Three.js
//   null  — this direction is not available; button will be hidden
const JOINT_AXES = {};
// Neck & Head: nod (x), turn (y). No roll — looks unnatural on neck.
JOINT_AXES['DEF-spine004']   = { up:['x',-1], dn:['x',+1], lt:['y',+1], rt:['y',-1], rl:null,     rr:null     };
JOINT_AXES['DEF-spine006']   = { up:['x',-1], dn:['x',+1], lt:['y',+1], rt:['y',-1], rl:null,     rr:null     };
// Shoulders: z=raise/lower, y=forward/back, x=twist. Signs mirror each other.
JOINT_AXES['DEF-upper_armL'] = { up:['z',+1], dn:['z',-1], lt:['y',-1], rt:['y',+1], rl:['x',-1], rr:['x',+1] };
JOINT_AXES['DEF-upper_armR'] = { up:['z',-1], dn:['z',+1], lt:['y',+1], rt:['y',-1], rl:['x',+1], rr:['x',-1] };
// Forearm: x=bend/extend, z=forearm twist. No lateral movement.
JOINT_AXES['DEF-forearmL']   = { up:['x',+1], dn:['x',-1], lt:null,     rt:null,     rl:['z',+1], rr:['z',-1] };
JOINT_AXES['DEF-forearmR']   = { up:['x',+1], dn:['x',-1], lt:null,     rt:null,     rl:['z',-1], rr:['z',+1] };
// Wrists: z=flex, y=tilt, x=roll.
JOINT_AXES['DEF-handL']      = { up:['z',+1], dn:['z',-1], lt:['y',+1], rt:['y',-1], rl:['x',-1], rr:['x',+1] };
JOINT_AXES['DEF-handR']      = { up:['z',-1], dn:['z',+1], lt:['y',+1], rt:['y',-1], rl:['x',+1], rr:['x',-1] };
// Fingers: x=curl/extend. Base joints also splay on z.
// sd = splay direction: +1 for L (outward = +z), -1 for R.
['L', 'R'].forEach(s => {
  const sd = s === 'L' ? 1 : -1;
  ['thumb', 'f_index', 'f_middle', 'f_ring', 'f_pinky'].forEach(f => {
    for (let i = 1; i <= 3; i++) {
      const nm = `DEF-${f}0${i}${s}`;
      JOINT_AXES[nm] = { up:['x',-1], dn:['x',+1], lt:null, rt:null, rl:null, rr:null };
      if (i === 1) { JOINT_AXES[nm].lt = ['z', +sd]; JOINT_AXES[nm].rt = ['z', -sd]; }
    }
  });
});

// CTRL_LABELS: override generic arrow symbols with descriptive text per bone.
// Bones not listed here fall back to arrows in initPart().
// null keeps the button hidden (matches null in JOINT_AXES).
const CTRL_LABELS = {};
CTRL_LABELS['DEF-upper_armL'] = { up:'▲ Raise',   dn:'▼ Lower',   lt:'⟵ Forward', rt:'Back ⟶',  rl:'↺ Twist',  rr:'Twist ↻'  };
CTRL_LABELS['DEF-upper_armR'] = { up:'▲ Raise',   dn:'▼ Lower',   lt:'⟵ Forward', rt:'Back ⟶',  rl:'↺ Twist',  rr:'Twist ↻'  };
CTRL_LABELS['DEF-forearmL']   = { up:'↑ Bend',    dn:'↓ Extend',  lt:null,        rt:null,       rl:'↺ Rotate', rr:'Rotate ↻' };
CTRL_LABELS['DEF-forearmR']   = { up:'↑ Bend',    dn:'↓ Extend',  lt:null,        rt:null,       rl:'↺ Rotate', rr:'Rotate ↻' };
CTRL_LABELS['DEF-handL']      = { up:'▲ Flex Up', dn:'▼ Flex Dn', lt:'◄ Tilt L',  rt:'Tilt R ►', rl:'↺ Roll',   rr:'Roll ↻'   };
CTRL_LABELS['DEF-handR']      = { up:'▲ Flex Up', dn:'▼ Flex Dn', lt:'◄ Tilt L',  rt:'Tilt R ►', rl:'↺ Roll',   rr:'Roll ↻'   };
CTRL_LABELS['DEF-spine004']   = { up:'▲ Look Up', dn:'▼ Look Dn', lt:'◄ Turn L',  rt:'Turn R ►', rl:null,       rr:null       };
CTRL_LABELS['DEF-spine006']   = { up:'▲ Look Up', dn:'▼ Look Dn', lt:'◄ Turn L',  rt:'Turn R ►', rl:null,       rr:null       };

// ── 3. UI helpers ─────────────────────────────────────────────

// holdButton: makes a button fire fn immediately on press, then repeat every 80 ms
// while held (like a held keyboard key). Works for mouse and touch.
//   el – button DOM element
//   fn – function to call repeatedly
function holdButton(el, fn) {
  let timer = null;
  const start = () => { fn(); timer = setInterval(fn, 80); }; // 80 ms ≈ 12 calls/second
  const stop  = () => { clearInterval(timer); timer = null; };
  el.addEventListener('mousedown',   start);
  el.addEventListener('mouseup',     stop);
  el.addEventListener('mouseleave',  stop); // stop when cursor leaves button while held
  // passive:false allows calling e.preventDefault() inside the handler if needed
  el.addEventListener('touchstart',  e => { e.preventDefault(); start(); }, { passive: false });
  el.addEventListener('touchend',    stop);
  el.addEventListener('touchcancel', stop);
}

// initPart: builds all interactive controls for one body-part tab.
//   part – 'R' | 'L' | 'H'
// Returns { applyDir, renderPoseList } for external callers.
function initPart(part) {
  // s(suffix) shorthand: getElementById(suffix + '-' + part)
  // e.g. s('ps-up') → getElementById('ps-up-R')
  const s     = suffix => document.getElementById(`${suffix}-${part}`);
  const bones = PART_BONES[part]; // bone names owned by this part

  // selectedJoint: the bone currently driven by the D-pad buttons.
  // Head panel defaults to the neck bone; arm panels start with nothing selected.
  let selectedJoint = part === 'H' ? 'DEF-spine004' : null;

  // setSelectedJoint: highlights the correct joint button and refreshes D-pad labels.
  function setSelectedJoint(bone) {
    selectedJoint = bone;
    // Highlight only the matching joint button; remove highlight from all others
    document.querySelectorAll(`.joint-btn[data-part="${part}"]`).forEach(b =>
      b.classList.toggle('selected', b.dataset.bone === bone)
    );
    // Update the header label
    const nm = s('ps-selected-name');
    if (nm) nm.textContent = bone ? (JOINT_LABELS[bone] || bone) : '— select —';

    const ax       = bone ? (JOINT_AXES[bone]  || {}) : {};
    const lbl      = bone ? (CTRL_LABELS[bone] || {}) : {};
    const isFinger = bone && /DEF-(thumb|f_index|f_middle|f_ring|f_pinky)/.test(bone);
    const isBase   = isFinger && /01[LR]$/.test(bone); // base joint can splay sideways

    // [elementIdPrefix, axisValue, fallbackLabel]
    // axis===null → button is hidden; axis===undefined → button is disabled only
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
      btn.textContent   = label;
      btn.disabled      = !axis;
      btn.style.display = axis ? '' : 'none'; // hide completely when axis is null
    });
  }

  // getStep: reads the step-size slider (degrees) → radians.
  // Three.js Euler angles are in radians; slider shows degrees for human readability.
  function getStep() {
    const el = s('ps-step');
    return (el ? parseFloat(el.value) : 5) * Math.PI / 180; // default 5° if slider missing
  }

  // applyDir: rotate the selected joint one step in the given direction.
  //   dir – 'up' | 'down' | 'left' | 'right' | 'rollin' | 'rollout'
  function applyDir(dir) {
    if (!selectedJoint) return;
    const ax = JOINT_AXES[selectedJoint];
    if (!ax) return;
    const info = { up:ax.up, down:ax.dn, left:ax.lt, right:ax.rt, rollin:ax.rl, rollout:ax.rr }[dir];
    if (!info) return;
    tweakJoint(selectedJoint, info[0], info[1] * getStep()); // axis, ±radians
  }

  // Wire joint-selector buttons (arm panels only; head panel has no joint grid)
  if (part !== 'H') {
    document.querySelectorAll(`.joint-btn[data-part="${part}"]`).forEach(btn =>
      btn.addEventListener('click', () => setSelectedJoint(btn.dataset.bone))
    );
  }

  // Wire D-pad with hold-to-repeat
  holdButton(s('ps-up'),      () => applyDir('up'));
  holdButton(s('ps-down'),    () => applyDir('down'));
  holdButton(s('ps-left'),    () => applyDir('left'));
  holdButton(s('ps-right'),   () => applyDir('right'));
  holdButton(s('ps-rollin'),  () => applyDir('rollin'));
  holdButton(s('ps-rollout'), () => applyDir('rollout'));

  // Reset-joint button
  s('ps-reset-joint').addEventListener('click', () => { if (selectedJoint) resetJoint(selectedJoint); });

  // Initialise D-pad labels/visibility for the default joint
  setSelectedJoint(selectedJoint);

  // Step-size slider: show current value next to the slider
  const stepEl = s('ps-step'), stepVal = s('ps-step-val');
  if (stepEl) stepEl.addEventListener('input', () => {
    if (stepVal) stepVal.textContent = stepEl.value + '°';
  });

  // renderPoseList: rebuild the saved-pose list and quick-select dropdown.
  // Called on startup (after loadPoses) and after every save / delete.
  function renderPoseList() {
    const list = s('ps-pose-list');
    if (!list) return;
    const keys = Object.keys(allPoses[part]);
    list.innerHTML = keys.length
      ? keys.map(n => `<div class="ps-pose-row">
            <span class="ps-pose-name" title="${n}">${n}</span>
            <button class="ps-pose-apply" data-name="${n}" data-part="${part}" title="Apply">▶</button>
            <button class="ps-pose-del"   data-name="${n}" data-part="${part}" title="Delete">×</button>
          </div>`).join('')
      : '<div class="ps-no-poses">No poses saved</div>';

    // Refresh the quick-pose <select> dropdown and restore its previous value if possible
    const qsel = document.getElementById(`pose-quick-${part}`);
    if (qsel) {
      const prev  = qsel.value;
      const label = part === 'R' ? 'R. Hand' : part === 'L' ? 'L. Hand' : 'Head';
      qsel.innerHTML = `<option value="">— ${label} pose —</option>`
        + keys.map(k => `<option value="${k}">${k}</option>`).join('');
      if (keys.includes(prev)) qsel.value = prev;
    }
  }

  // Save-pose button: snapshot current rotations → store → persist → refresh UI
  s('ps-save-pose').addEventListener('click', () => {
    const el = s('ps-pose-name'), name = el ? el.value.trim() : '';
    if (!name) { if (el) el.focus(); return; }
    allPoses[part][name] = capturePartialPose(bones);
    savePoses(part);
    renderPoseList();
    if (el) el.value = '';
  });
  // Allow Enter key inside the name field to trigger save
  s('ps-pose-name').addEventListener('keydown', e => {
    if (e.key === 'Enter') s('ps-save-pose').click();
  });

  // Pose-list click: event delegation handles both Apply (▶) and Delete (×)
  s('ps-pose-list').addEventListener('click', e => {
    const name = e.target.dataset.name;
    if (!name || !allPoses[part][name]) return;
    if (e.target.classList.contains('ps-pose-apply')) {
      applyPose(allPoses[part][name]); // instant snap to pose
    } else if (e.target.classList.contains('ps-pose-del')) {
      delete allPoses[part][name];
      savePoses(part);
      renderPoseList();
    }
  });

  renderPoseList(); // initial render (shows empty or pre-loaded poses)
  return { applyDir, renderPoseList };
}

// ── 4. Bootstrap ──────────────────────────────────────────────
// initPoseStudio: wire all Pose Studio UI and return the partControllers object.
// Call once from main.js after the page has loaded.
export function initPoseStudio() {
  // partControllers: { R: {applyDir, renderPoseList}, L: {…}, H: {…} }
  // Populated by initPart() — used by keyboard handler and loadPoses callback.
  const partControllers = {};
  let activePart = 'R'; // which panel tab is currently visible

  // ── Tab switching ───────────────────────────────────────────
  // Each tab has class 'ps-tab' and data-part="R"|"L"|"H".
  document.querySelectorAll('.ps-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      activePart = tab.dataset.part;
      document.querySelectorAll('.ps-tab').forEach(t => t.classList.toggle('active', t === tab));
      document.querySelectorAll('.ps-panel').forEach(p =>
        p.style.display = p.id === `ps-panel-${activePart}` ? '' : 'none'
      );
    });
  });

  // ── Keyboard arrow hotkeys ──────────────────────────────────
  // ArrowUp/Down/Left/Right nudge the selected joint in the active panel.
  // Skipped when an input/textarea/select has focus (user is typing).
  document.addEventListener('keydown', e => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
    const dir = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' }[e.key];
    if (!dir) return;
    e.preventDefault(); // prevent page scroll
    partControllers[activePart]?.applyDir(dir);
  });

  // ── Initialise all three panels ─────────────────────────────
  partControllers.R = initPart('R');
  partControllers.L = initPart('L');
  partControllers.H = initPart('H');

  // ── Quick-pose selects ──────────────────────────────────────
  // Dropdowns above each panel: selecting a name lerps to that pose in 1 second.
  ['R', 'L', 'H'].forEach(part => {
    const sel = document.getElementById(`pose-quick-${part}`);
    if (!sel) return;
    sel.addEventListener('change', () => {
      const name = sel.value;
      if (!name || !allPoses[part][name]) return;
      // animatePartPose(part, fromPose, toPose, durationMs)
      animatePartPose(part, capturePartialPose(PART_BONES[part]), allPoses[part][name], 1000);
    });
  });

  return partControllers;
}

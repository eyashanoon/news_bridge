/**
 * bonePicker.js
 * Debug tool — cycles through every jaw/lip/chin bone in the avatar,
 * applies a rotation so you can see what it does, and lets you label it.
 * Open at: http://localhost:5173/debug.html
 */
import * as THREE from 'three';
import { GLTFLoader }   from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }  from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const MODEL_URL   = '/models/avatar.glb';
const HIDE_MESHES = new Set(['tripo_node_f9169681', 'tripo_mesh_f9169681']);

// All 76 jaw/lip/chin bones confirmed in the model (from console log).
// We test every one so you can identify exactly which ones to drive.
const TEST_BONES = [
  // Control bones (no prefix)
  'jaw', 'jaw_master', 'jaw_1',
  'jawL', 'jawL_1', 'jawL001', 'jawL001_1',
  'jawR', 'jawR_1', 'jawR001', 'jawR001_1',
  'chin', 'chin_1', 'chin001', 'chin001_1', 'chin002',
  'chinL', 'chinL_1', 'chinR', 'chinR_1',
  'lipB', 'lipT',
  'lipBL', 'lipBL001', 'lipBL001_1',
  'lipBR', 'lipBR001', 'lipBR001_1',
  'lipTL', 'lipTL001', 'lipTL001_1',
  'lipTR', 'lipTR001', 'lipTR001_1',
  'lipsL', 'lipsR',
  // DEF bones (directly skinned to vertices)
  'DEF-jaw', 'DEF-jawL', 'DEF-jawL001', 'DEF-jawR', 'DEF-jawR001',
  'DEF-chin', 'DEF-chin001', 'DEF-chinL', 'DEF-chinR',
  'DEF-lipBL', 'DEF-lipBL001', 'DEF-lipBR', 'DEF-lipBR001',
  'DEF-lipTL', 'DEF-lipTL001', 'DEF-lipTR', 'DEF-lipTR001',
  // MCH / ORG (mechanism / original)
  'MCH-jaw_master', 'MCH-mouth_lock',
  'ORG-jaw', 'ORG-jawL', 'ORG-jawR',
  'ORG-lipBL', 'ORG-lipBR', 'ORG-lipTL', 'ORG-lipTR',
  'ORG-chin', 'ORG-chinL', 'ORG-chinR',
];

// ── Three.js scene ─────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f1e);

// Lights
scene.add(new THREE.AmbientLight(0xffffff, 1.4));
const sun = new THREE.DirectionalLight(0xffffff, 3.0);
sun.position.set(1, 4, 4); scene.add(sun);
const fill = new THREE.DirectionalLight(0x8899ff, 0.9);
fill.position.set(-3, 1, 1); scene.add(fill);

const camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
camera.position.set(0, 1.8, 1.3);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.8, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.12;
controls.update();

function resize() {
  const w = canvas.clientWidth, h = canvas.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas);
resize();

// ── State ──────────────────────────────────────────────────────────────────
let bones        = {};
let available    = [];   // subset of TEST_BONES actually in model
let currentIdx   = 0;
let currentAxis  = 'x';
let amplitude    = 0.45;
let results      = {};
let prevBone     = null;
let prevAxis     = null;
let prevVal      = 0;

// ── DOM refs ───────────────────────────────────────────────────────────────
const progressEl = document.getElementById('progress');
const boneNameEl = document.getElementById('bone-name');
const resultsEl  = document.getElementById('results-box');
const loadingEl  = document.getElementById('loading');
const doneMsgEl  = document.getElementById('done-msg');

function refreshResults() {
  const labeled = Object.entries(results).filter(([, v]) => v !== 'skip');
  resultsEl.textContent = JSON.stringify(
    Object.fromEntries(labeled), null, 2
  );
}

// ── Show bone ──────────────────────────────────────────────────────────────
function resetPrev() {
  if (!prevBone || prevAxis === null) return;
  const axis = prevAxis.startsWith('-') ? prevAxis.slice(1) : prevAxis;
  prevBone.rotation[axis] = prevVal;
  prevBone = null;
}

function showBone(idx) {
  resetPrev();

  if (idx < 0) idx = 0;
  currentIdx = idx;

  if (idx >= available.length) {
    boneNameEl.textContent  = '✅ All done!';
    progressEl.textContent  = `Finished — ${Object.keys(results).length} bones evaluated`;
    doneMsgEl.style.display = 'block';
    return;
  }

  const name = available[idx];
  const bone = bones[name];
  progressEl.textContent = `Bone ${idx + 1} / ${available.length}`;
  boneNameEl.textContent = name;

  if (!bone) { boneNameEl.textContent = name + '  ⚠ not found'; return; }

  const axis = currentAxis.startsWith('-') ? currentAxis.slice(1) : currentAxis;
  const sign = currentAxis.startsWith('-') ? -1 : 1;

  prevBone = bone;
  prevAxis = currentAxis;
  prevVal  = bone.rotation[axis];

  bone.rotation[axis] = sign * amplitude;
}

function applyLabel(tag) {
  if (available[currentIdx]) results[available[currentIdx]] = tag;
  refreshResults();
  showBone(currentIdx + 1);
}

// ── Button wiring ──────────────────────────────────────────────────────────
document.getElementById('btn-jaw') .addEventListener('click', () => applyLabel('jaw'));
document.getElementById('btn-lipl').addEventListener('click', () => applyLabel('lowerLip'));
document.getElementById('btn-lipu').addEventListener('click', () => applyLabel('upperLip'));
document.getElementById('btn-chin').addEventListener('click', () => applyLabel('chin'));
document.getElementById('btn-skip').addEventListener('click', () => applyLabel('skip'));
document.getElementById('btn-prev').addEventListener('click', () => {
  resetPrev();
  showBone(Math.max(0, currentIdx - 1));
});

document.getElementById('copy-btn').addEventListener('click', () => {
  const labeled = Object.fromEntries(
    Object.entries(results).filter(([, v]) => v !== 'skip')
  );
  navigator.clipboard.writeText(JSON.stringify(labeled, null, 2))
    .then(() => alert('Copied to clipboard!'))
    .catch(() => alert('Copy failed — select the text in the box manually.'));
});

// Axis toggle
document.querySelectorAll('.axis-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.axis-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentAxis = btn.dataset.axis;
    // Re-apply to current bone with new axis
    const idx = currentIdx;
    resetPrev();
    currentIdx = idx - 1; // showBone will increment correctly
    showBone(idx);
  });
});

// Amplitude slider
const slider = document.getElementById('amp-slider');
const ampVal = document.getElementById('amp-val');
slider.addEventListener('input', () => {
  amplitude = parseFloat(slider.value);
  ampVal.textContent = amplitude.toFixed(2) + ' rad';
  // Re-apply immediately
  const idx = currentIdx;
  resetPrev();
  currentIdx = idx - 1;
  showBone(idx);
});

// ── Load model ─────────────────────────────────────────────────────────────
const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
draco.setDecoderConfig({ type: 'js' });
draco.preload();

const loader = new GLTFLoader();
loader.setDRACOLoader(draco);

loader.load(MODEL_URL, (gltf) => {
  const model = gltf.scene;
  model.rotation.y = Math.PI; // face camera

  model.traverse(n => {
    if (!n.isMesh && !n.isSkinnedMesh) return;
    if (n.name.startsWith('WGT-')) { n.visible = false; return; }
    if (HIDE_MESHES.has(n.name))   { n.visible = false; return; }
    if (n.isMesh && !n.isSkinnedMesh) {
      const sz = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3()).y;
      if (sz > 0.3) { n.visible = false; return; }
    }
    if (n.material) n.material.side = THREE.FrontSide;
  });

  // Scale & centre
  const box  = new THREE.Box3().setFromObject(model);
  const s    = 1.85 / (box.getSize(new THREE.Vector3()).y || 1);
  model.scale.setScalar(s);
  const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  model.position.set(-centre.x, -box.min.y * s, -centre.z);

  // Collect bones — skeleton.bones are authoritative for skinning
  model.traverse(n => { if (n.isBone) bones[n.name] = n; });
  model.traverse(n => {
    if (n.isSkinnedMesh && n.skeleton)
      n.skeleton.bones.forEach(b => { if (b?.name) bones[b.name] = b; });
  });

  scene.add(model);

  // Aim camera at the head bone
  const headBone = bones['head'];
  let headY = 1.65;
  if (headBone) {
    const wp = new THREE.Vector3();
    headBone.getWorldPosition(wp);
    headY = wp.y;
  }
  camera.position.set(0, headY + 0.05, 1.25);
  controls.target.set(0, headY - 0.05, 0);
  controls.update();

  // Filter to bones actually in the model
  available = TEST_BONES.filter(name => !!bones[name]);
  console.info(`[BonePicker] ${available.length} / ${TEST_BONES.length} test bones found in model`);
  console.info('[BonePicker] bones not found:', TEST_BONES.filter(n => !bones[n]));

  draco.dispose();
  loadingEl.style.display = 'none';
  showBone(0);

}, undefined, err => {
  loadingEl.querySelector('span').textContent = 'Load error: ' + err.message;
  draco.dispose();
});

// ── Render loop ─────────────────────────────────────────────────────────────
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();

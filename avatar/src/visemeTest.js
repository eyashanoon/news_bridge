/**
 * visemeTest.js — Slow viseme debug tool
 * Cycles through each viseme shape key one at a time,
 * speaks a sample word, and shows the morph influence values live.
 */
import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }   from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ── Viseme definitions ────────────────────────────────────────────────────
const VISEMES = [
  { key: 'A', name: 'Open Vowel',     phonemes: 'a · ah · ay · are · far · "cat"',  sample: 'aaah'  },
  { key: 'B', name: 'Bilabial',       phonemes: 'b · m · p · "map" · "pop"',         sample: 'mmmm'  },
  { key: 'C', name: 'Dental / Alv',   phonemes: 's · z · n · l · "see" · "zone"',   sample: 'sss'   },
  { key: 'D', name: 'Dental Stop',    phonemes: 'd · t · th · "the" · "that"',       sample: 'the'   },
  { key: 'E', name: 'Closed Vowel',   phonemes: 'e · ee · i · y · "feet" · "key"',  sample: 'eeee'  },
  { key: 'F', name: 'Labiodental',    phonemes: 'f · v · ph · "fee" · "five"',       sample: 'ffff'  },
  { key: 'G', name: 'Velar',          phonemes: 'k · g · ng · "go" · "king"',        sample: 'kk'    },
  { key: 'H', name: 'Rounded Vowel',  phonemes: 'o · u · w · "oh" · "you" · "who"', sample: 'oooh'  },
  { key: 'X', name: 'Silence / Rest', phonemes: '(neutral rest position)',            sample: null    },
];

// ── Three.js setup ────────────────────────────────────────────────────────
const canvas   = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
renderer.outputColorSpace  = THREE.SRGBColorSpace;
renderer.toneMapping       = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d0d12);
scene.fog = new THREE.FogExp2(0x0d0d12, 0.04);

// Lighting
scene.add(new THREE.AmbientLight(0xffffff, 0.55));
const key = new THREE.DirectionalLight(0xffeedd, 1.9);
key.position.set(1.5, 3.5, 3);
key.castShadow = true;
key.shadow.mapSize.set(1024, 1024);
scene.add(key);
const fill = new THREE.DirectionalLight(0xaabbff, 0.45);
fill.position.set(-3, 2, 1);
scene.add(fill);
const back = new THREE.DirectionalLight(0xffffff, 0.25);
back.position.set(0, 2, -3);
scene.add(back);

// Camera — face close-up
const camera = new THREE.PerspectiveCamera(28, window.innerWidth / window.innerHeight, 0.01, 100);
camera.position.set(-0.1, 1.62, 2.8);

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 1.56, 0);
controls.enableDamping  = true;
controls.dampingFactor  = 0.08;
controls.minDistance    = 0.5;
controls.maxDistance    = 8;
controls.update();

// Floor
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(5, 32),
  new THREE.MeshStandardMaterial({ color: 0x101015 })
);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});

// ── Load GLB ──────────────────────────────────────────────────────────────
const HIDE = new Set([
  'tripo_node_56ade3d9-b439-4635-8683-30df461950d1',
  'tripo_mesh_56ade3d9-b439-4635-8683-30df461950d1',
  'tripo_node_f9169681',
  'tripo_mesh_f9169681',
]);

let morphMesh = null;
let morphDict = null;
let morphInfl = null;
let avatarLoaded = false;

const draco = new DRACOLoader();
draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
draco.setDecoderConfig({ type: 'js' });

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(draco);

gltfLoader.load('/models/avatar.glb', (gltf) => {
  const model = gltf.scene;
  model.rotation.y = Math.PI;

  model.traverse(n => {
    if (!n.isMesh && !n.isSkinnedMesh) return;
    if (n.name.startsWith('WGT-')) { n.visible = false; return; }
    if (HIDE.has(n.name))          { n.visible = false; return; }
    if (n.isMesh && !n.isSkinnedMesh) {
      const h = new THREE.Box3().setFromObject(n).getSize(new THREE.Vector3()).y;
      if (h > 0.3) { n.visible = false; return; }
    }
    n.castShadow = n.receiveShadow = true;
    if (n.material) { n.material.side = THREE.FrontSide; n.material.needsUpdate = true; }
  });

  const box = new THREE.Box3().setFromObject(model);
  const s   = 1.85 / (box.getSize(new THREE.Vector3()).y || 1);
  model.scale.setScalar(s);
  const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
  model.position.set(-centre.x, -box.min.y * s, -centre.z);

  model.traverse(n => {
    if (!n.isSkinnedMesh || !n.morphTargetDictionary) return;
    if (Object.keys(n.morphTargetDictionary).length === 0) return;
    if (!morphMesh || n.name.toLowerCase().includes('retopo')) {
      morphMesh = n;
      morphDict = n.morphTargetDictionary;
      morphInfl = n.morphTargetInfluences;
    }
  });

  scene.add(model);
  draco.dispose();
  avatarLoaded = true;

  if (morphMesh) {
    setStatus(`Shape keys: ${Object.keys(morphDict).join(' · ')}`);
    buildBars();
    applyViseme(0, false);
  } else {
    setStatus('ERROR: No shape keys found in GLB!');
  }
}, (xhr) => {
  const pct = xhr.total ? Math.round(xhr.loaded / xhr.total * 100) : '…';
  setStatus(`Loading GLB… ${pct}%`);
}, (err) => {
  setStatus('Load error: ' + err.message);
});

// ── State ─────────────────────────────────────────────────────────────────
let currentIdx = 0;
let autoPlay   = true;
let holdTime   = 2.5;
let blendSpeed = 4;
let elapsed    = 0;
const smooth   = {};
VISEMES.forEach(v => (smooth[v.key] = 0));
smooth['X'] = 1; // start at rest

// ── Build bars ────────────────────────────────────────────────────────────
function buildBars() {
  const container = document.getElementById('bars');
  container.innerHTML = '';
  VISEMES.forEach(v => {
    const row = document.createElement('div');
    row.className = 'bar-row';
    row.id = `bar-${v.key}`;
    row.innerHTML =
      `<div class="bar-key">${v.key}</div>` +
      `<div class="bar-track"><div class="bar-fill" id="fill-${v.key}" style="width:0%"></div></div>` +
      `<div class="bar-val" id="val-${v.key}">0.00</div>`;
    container.appendChild(row);
  });
}

function updateBars() {
  const active = VISEMES[currentIdx]?.key;
  VISEMES.forEach(v => {
    const pct   = (smooth[v.key] * 100).toFixed(0);
    const fill  = document.getElementById(`fill-${v.key}`);
    const valEl = document.getElementById(`val-${v.key}`);
    const row   = document.getElementById(`bar-${v.key}`);
    if (fill)  fill.style.width     = pct + '%';
    if (valEl) valEl.textContent    = smooth[v.key].toFixed(2);
    if (row)   row.classList.toggle('active', v.key === active);
  });
}

// ── Apply viseme ──────────────────────────────────────────────────────────
function applyViseme(idx, speak = true) {
  currentIdx = ((idx % VISEMES.length) + VISEMES.length) % VISEMES.length;
  elapsed    = 0;
  const v    = VISEMES[currentIdx];

  document.getElementById('vis-letter').textContent   = v.key;
  document.getElementById('vis-name').textContent     = v.name;
  document.getElementById('vis-phonemes').textContent = v.phonemes;
  document.getElementById('vis-sample').textContent   = v.sample ? `"${v.sample}"` : '';
  document.getElementById('vis-index').textContent    = `${currentIdx + 1} / ${VISEMES.length}`;

  if (speak && v.sample) sayWord(v.sample);
}

function sayWord(word) {
  speechSynthesis.cancel();
  const utt    = new SpeechSynthesisUtterance(word);
  utt.rate     = 0.55;
  utt.pitch    = 1.0;
  utt.volume   = 1.0;
  const voices = speechSynthesis.getVoices();
  const male   = voices.find(v => /male|david|mark|richard|george|aaron/i.test(v.name));
  if (male) utt.voice = male;
  speechSynthesis.speak(utt);
}

// ── Controls ──────────────────────────────────────────────────────────────
document.getElementById('btn-prev').addEventListener('click', () => applyViseme(currentIdx - 1));
document.getElementById('btn-next').addEventListener('click', () => applyViseme(currentIdx + 1));
document.getElementById('btn-speak').addEventListener('click', () => applyViseme(currentIdx, true));

document.getElementById('btn-auto').addEventListener('click', () => {
  autoPlay = !autoPlay;
  const btn = document.getElementById('btn-auto');
  btn.classList.toggle('active', autoPlay);
  btn.textContent = autoPlay ? '⏵ Auto' : '⏸ Paused';
});

document.getElementById('speed').addEventListener('input', function () {
  holdTime = parseFloat(this.value);
  document.getElementById('speed-val').textContent = holdTime.toFixed(1) + 's';
});

document.getElementById('blend').addEventListener('input', function () {
  blendSpeed = parseInt(this.value, 10);
  document.getElementById('blend-val').textContent = blendSpeed;
});

// ── Render loop ───────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.1);

  controls.update();

  // Smooth blend toward target viseme
  VISEMES.forEach(v => {
    const want  = v.key === VISEMES[currentIdx]?.key ? 1.0 : 0.0;
    const cur   = smooth[v.key];
    smooth[v.key] = cur + (want - cur) * Math.min(dt * blendSpeed, 1);
    if (morphDict && morphInfl) {
      const i = morphDict[v.key];
      if (i !== undefined) morphInfl[i] = smooth[v.key];
    }
  });

  // Update live bars
  if (avatarLoaded) updateBars();

  // Auto-advance progress
  if (autoPlay && avatarLoaded) {
    elapsed += dt;
    const pct = Math.min(elapsed / holdTime * 100, 100);
    document.getElementById('progress-fill').style.width = pct + '%';
    if (elapsed >= holdTime) applyViseme(currentIdx + 1);
  }

  renderer.render(scene, camera);
}

animate();

// ── Helpers ───────────────────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('status').textContent = msg;
}

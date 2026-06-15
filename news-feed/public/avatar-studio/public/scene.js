/**
 * scene.js
 * ─────────────────────────────────────────────────────────────
 * Responsible for:
 *   - Creating the Three.js renderer, scene, camera, and lights
 *   - Loading character.glb and locating the mesh that carries
 *     the Rhubarb morphTargets (A, B, C, D, E, F, G, H, X)
 *   - Exposing setMorphTarget() for the lip-sync system
 *   - Running the render loop
 * ─────────────────────────────────────────────────────────────
 */

import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { GLTFLoader } from 'https://unpkg.com/three@0.160.0/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

// ── Rhubarb mouth-shape names that exist in the model ──────
const MORPH_NAMES = ['Basis', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];

// ── Bone / pose animation ────────────────────────────────────
const ANIM_BONES = [
  // Head / Neck
  'DEF-spine004', 'DEF-spine006',
  // Left arm chain
  'DEF-upper_armL', 'DEF-forearmL', 'DEF-handL',
  // Left fingers
  'DEF-thumb01L',    'DEF-thumb02L',    'DEF-thumb03L',
  'DEF-f_index01L',  'DEF-f_index02L',  'DEF-f_index03L',
  'DEF-f_middle01L', 'DEF-f_middle02L', 'DEF-f_middle03L',
  'DEF-f_ring01L',   'DEF-f_ring02L',   'DEF-f_ring03L',
  'DEF-f_pinky01L',  'DEF-f_pinky02L',  'DEF-f_pinky03L',
  // Right arm chain
  'DEF-upper_armR', 'DEF-forearmR', 'DEF-handR',
  // Right fingers
  'DEF-thumb01R',    'DEF-thumb02R',    'DEF-thumb03R',
  'DEF-f_index01R',  'DEF-f_index02R',  'DEF-f_index03R',
  'DEF-f_middle01R', 'DEF-f_middle02R', 'DEF-f_middle03R',
  'DEF-f_ring01R',   'DEF-f_ring02R',   'DEF-f_ring03R',
  'DEF-f_pinky01R',  'DEF-f_pinky02R',  'DEF-f_pinky03R',
];
// Per-part bone lists and sets for independent animation slots
const BONES_L    = ANIM_BONES.filter(n => n.endsWith('L'));
const BONES_R    = ANIM_BONES.filter(n => n.endsWith('R'));
const BONES_H    = ['DEF-spine004', 'DEF-spine006'];
const BONES_SET_L = new Set(BONES_L);
const BONES_SET_R = new Set(BONES_R);
const BONES_SET_H = new Set(BONES_H);
export const PART_BONES = { L: BONES_L, R: BONES_R, H: BONES_H };

const boneMap     = {};   // name → Three.js Object3D
const boneRest    = {};   // name → rest Euler {x,y,z}
const boneTarget  = {};   // name → target Euler {x,y,z}
const boneCurrent = {};   // name → current lerped Euler {x,y,z}
const BONE_LERP   = 4;    // smooth, purposeful movement

let _waveActive = false;
let _waveSide   = 'R';   // 'L' | 'R'
let _waveTime   = 0;

// ── Right-screen canvas state (updated on speech) ──────────
let _rightScreenCanvas = null;
let _rightScreenCtx    = null;
let _rightScreenTex    = null;

// ── Left-screen canvas state (for news brief images) ───────
let _leftScreenCanvas = null;
let _leftScreenCtx    = null;
let _leftScreenTex    = null;

// ── Module-level references ─────────────────────────────────
let renderer, scene, camera, controls, clock;
let morphMesh = null;          // The mesh that owns the morph targets
let characterRoot = null;      // Loaded GLTF root for vertical position adjustments
let currentInfluences = {};    // name → current influence value (lerp source)
let targetInfluences  = {};    // name → desired influence value (lerp target)

// Initialise all influences to 0, then set X=1 (closed-mouth rest pose).
// NOTE: This model's Basis shape key is an OPEN mouth.
//       'X' is the CLOSED mouth and is the correct idle/rest state.
MORPH_NAMES.forEach(n => { currentInfluences[n] = 0; targetInfluences[n] = 0; });
currentInfluences['X'] = 1;
targetInfluences['X']  = 1;

// ── Detect portrait / mobile orientation ─────────────────────
function isPortrait() {
  return window.innerHeight > window.innerWidth;
}

// ── Public: initialise the scene ───────────────────────────
export function initScene(container) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = isPortrait();

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.setSize(w, h);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  container.appendChild(renderer.domElement);

  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x08080f);

  // Camera – responsive to orientation
  // Portrait (mobile): wider FOV + far back to fit all screens + presenter
  // Landscape (desktop): standard framing
  const baseFov = portrait ? 60 : 40;
  const camDist = portrait ? 12.0 : 5.5;
  const camY    = portrait ? 1.5 : 1.0;
  camera = new THREE.PerspectiveCamera(
    baseFov,
    w / h,
    0.1,
    100
  );
  camera.position.set(0, camY, camDist);
  camera.lookAt(0, camY, 0);

  // ── Lighting ───────────────────────────────────────────
  // Strong ambient so no part of the model falls into full black
  const ambient = new THREE.AmbientLight(0xffffff, 2.5);
  scene.add(ambient);

  // Key light – warm, front-slightly-above
  const keyLight = new THREE.DirectionalLight(0xfff4e0, 4.0);
  keyLight.position.set(1.5, 4, 4);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 0.5;
  keyLight.shadow.camera.far  = 20;
  keyLight.shadow.bias = -0.001;
  scene.add(keyLight);

  // Fill light – left side, neutral
  const fillLight = new THREE.DirectionalLight(0xddeeff, 2.0);
  fillLight.position.set(-3, 2, 2);
  scene.add(fillLight);

  // Rim / back light – cool blue edge highlight
  const rimLight = new THREE.DirectionalLight(0x88aaff, 1.8);
  rimLight.position.set(-1, 3, -4);
  scene.add(rimLight);

  // Orbit controls (disabled during recording – purely for dev)
  controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, camY, 0);
  controls.enablePan = false;
  controls.minDistance = 2;
  controls.maxDistance = 10;
  controls.update();

  // Clock for delta-time in lerping
  clock = new THREE.Clock();

  // Build studio environment (floor, desk, screen)
  buildStudio();

  // Resize handler
  window.addEventListener('resize', onResize);

  // Start render loop
  renderer.setAnimationLoop(renderLoop);
}

// ── Public: push speech text to right studio screen ─────────────────
export function updateScreenText(text) {
  if (!_rightScreenCtx || !_rightScreenTex) return;
  _drawRightScreen(text);
  _rightScreenTex.needsUpdate = true;
}

function _drawRightScreen(text) {
  const ctx = _rightScreenCtx;
  const W = _rightScreenCanvas.width;
  const H = _rightScreenCanvas.height;
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#030312'); bg.addColorStop(1, '#06061e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(60,55,180,0.13)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
  const hdr = ctx.createLinearGradient(0, 0, W, 0);
  hdr.addColorStop(0,'rgba(30,25,180,0)'); hdr.addColorStop(0.5,'rgba(55,45,220,0.88)'); hdr.addColorStop(1,'rgba(30,25,180,0)');
  ctx.fillStyle = hdr; ctx.fillRect(0, 0, W, 72);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif'; ctx.fillText('NOW SAYING', W / 2, 46);
  ctx.strokeStyle = 'rgba(120,100,255,0.65)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 78); ctx.lineTo(W - 80, 78); ctx.stroke();
  if (text && text.trim()) {
    ctx.fillStyle = '#dcdcff'; ctx.textAlign = 'center'; ctx.font = '36px sans-serif';
    const maxW = W - 100;
    const words = text.split(' ');
    let line = '', lines = [];
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = word; }
      else line = test;
    }
    if (line) lines.push(line);
    let ty = 148;
    for (const l of lines) { ctx.fillText(l, W / 2, ty); ty += 58; }
  } else {
    ctx.fillStyle = 'rgba(120,115,200,0.45)'; ctx.textAlign = 'center';
    ctx.font = '26px sans-serif'; ctx.fillText('— speech will appear here —', W / 2, 300);
  }
}

// ── Private: build studio set ───────────────────────────────
function buildStudio() {
  // ── Floor ─────────────────────────────────────────────────
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(18, 14),
    new THREE.MeshStandardMaterial({ color: 0x090910, roughness: 0.87, metalness: 0.15 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // ── Back wall ─────────────────────────────────────────────
  const wall = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 9),
    new THREE.MeshStandardMaterial({ color: 0x070714, roughness: 1, metalness: 0 })
  );
  wall.position.set(0, 3.0, -3.5);
  scene.add(wall);

  // ── Shared materials ────────────────────────────────────────────
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.45, metalness: 0.80 });

  // ── News desk ───────────────────────────────────────────────
  const TABLE_Y  = 1.13;
  const TABLE_Z  = 0.58;   // centre z — close to character with small gap
  const TABLE_W  = 2.85;
  const TABLE_D  = 0.80;
  const TABLE_TH = 0.065;
  const NEAR_Z   = TABLE_Z + TABLE_D / 2;   // front (camera-facing) edge
  const FAR_Z    = TABLE_Z - TABLE_D / 2;   // back (character-facing) edge

  const wood = new THREE.MeshStandardMaterial({ color: 0x100c1e, roughness: 0.65, metalness: 0.05 });
  const tableTop = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W, TABLE_TH, TABLE_D), wood);
  tableTop.position.set(0, TABLE_Y, TABLE_Z);
  tableTop.castShadow = true; tableTop.receiveShadow = true;
  scene.add(tableTop);

  // Chrome front-edge trim
  const trim = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_W, TABLE_TH + 0.01, 0.012),
    new THREE.MeshStandardMaterial({ color: 0x5a5a8a, roughness: 0.18, metalness: 0.96 })
  );
  trim.position.set(0, TABLE_Y, NEAR_Z);
  scene.add(trim);

  // Four slim metal legs
  const legH   = TABLE_Y - TABLE_TH;
  const legGeo = new THREE.BoxGeometry(0.046, legH, 0.046);
  [
    [-(TABLE_W/2 - 0.07), FAR_Z  + 0.07],
    [-(TABLE_W/2 - 0.07), NEAR_Z - 0.07],
    [ (TABLE_W/2 - 0.07), FAR_Z  + 0.07],
    [ (TABLE_W/2 - 0.07), NEAR_Z - 0.07],
  ].forEach(([lx, lz]) => {
    const leg = new THREE.Mesh(legGeo, darkMetal);
    leg.position.set(lx, legH / 2, lz);
    scene.add(leg);
  });

  // Back stretcher bar (behind modesty panel — hidden from camera)
  const bar = new THREE.Mesh(new THREE.BoxGeometry(TABLE_W - 0.12, 0.04, 0.04), darkMetal);
  bar.position.set(0, 0.26, FAR_Z + 0.07);
  scene.add(bar);

  // ── Modesty panel — solid front face, blocks legs, carries logo ─────────
  const panelH = TABLE_Y - TABLE_TH;
  const PC_W = 1024, PC_H = 320;
  const pc = document.createElement('canvas');
  pc.width = PC_W; pc.height = PC_H;
  const ptx = pc.getContext('2d');

  const pbg = ptx.createLinearGradient(0, 0, 0, PC_H);
  pbg.addColorStop(0, '#0c0a22'); pbg.addColorStop(1, '#060616');
  ptx.fillStyle = pbg; ptx.fillRect(0, 0, PC_W, PC_H);

  ptx.strokeStyle = 'rgba(90,80,200,0.1)'; ptx.lineWidth = 1;
  for (let y2 = 0; y2 < PC_H; y2 += 18) { ptx.beginPath(); ptx.moveTo(0, y2); ptx.lineTo(PC_W, y2); ptx.stroke(); }

  const stripe = ptx.createLinearGradient(0, 0, PC_W, 0);
  stripe.addColorStop(0, 'rgba(50,35,240,0)');
  stripe.addColorStop(0.3, 'rgba(70,55,255,0.9)');
  stripe.addColorStop(0.7, 'rgba(70,55,255,0.9)');
  stripe.addColorStop(1, 'rgba(50,35,240,0)');
  ptx.fillStyle = stripe; ptx.fillRect(0, 0, PC_W, 5);

  // Bridge icon
  const icx = PC_W / 2, icy = 96;
  ptx.strokeStyle = 'rgba(155,135,255,0.9)'; ptx.lineWidth = 5;
  ptx.beginPath(); ptx.arc(icx, icy + 34, 54, Math.PI, 0, false); ptx.stroke();
  ptx.beginPath(); ptx.moveTo(icx - 82, icy + 34); ptx.lineTo(icx + 82, icy + 34); ptx.stroke();
  ptx.lineWidth = 4;
  ptx.beginPath(); ptx.moveTo(icx - 50, icy + 34); ptx.lineTo(icx - 50, icy - 18); ptx.stroke();
  ptx.beginPath(); ptx.moveTo(icx + 50, icy + 34); ptx.lineTo(icx + 50, icy - 18); ptx.stroke();
  ptx.lineWidth = 2;
  [[icx - 50, icy - 18, icx,      icy + 34],
   [icx + 50, icy - 18, icx,      icy + 34],
   [icx - 50, icy - 18, icx - 26, icy + 34],
   [icx + 50, icy - 18, icx + 26, icy + 34]].forEach(([x1,y1,x2,y2]) => {
    ptx.beginPath(); ptx.moveTo(x1,y1); ptx.lineTo(x2,y2); ptx.stroke();
  });

  ptx.textAlign = 'center';
  ptx.fillStyle = '#ffffff'; ptx.font = 'bold 48px sans-serif'; ptx.fillText('NEWS BRIDGE', icx, 220);
  ptx.fillStyle = 'rgba(175,160,255,0.85)'; ptx.font = '22px sans-serif'; ptx.fillText('LIVE', icx, 256);

  const panelTex = new THREE.CanvasTexture(pc);
  panelTex.colorSpace = THREE.SRGBColorSpace;
  // Front-facing branded plane
  const modesty = new THREE.Mesh(
    new THREE.PlaneGeometry(TABLE_W, panelH),
    new THREE.MeshStandardMaterial({
      map: panelTex, emissiveMap: panelTex,
      emissive: new THREE.Color(1,1,1), emissiveIntensity: 0.30,
      roughness: 0.9, metalness: 0.1,
    })
  );
  // Face +Z (toward camera) — front of the desk
  modesty.position.set(0, panelH / 2, NEAR_Z - 0.001);
  scene.add(modesty);
  // Solid backing box so back/sides are opaque dark
  const modBox = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE_W, panelH, 0.07),
    new THREE.MeshStandardMaterial({ color: 0x08061a, roughness: 0.9 })
  );
  modBox.position.set(0, panelH / 2, NEAR_Z - 0.06);
  scene.add(modBox);

  // ── Three curved screens — responsive to orientation ──────────
  // Portrait: screens are narrower and closer together
  // Landscape: wider spread
  const inPortrait = isPortrait();
  const SCR_RAD = inPortrait ? 2.40 : 3.20;
  const SCR_ANG = inPortrait ? 40 : 52;
  const SCR_Y   = inPortrait ? 1.50 : 1.88;
  const SCR_W   = inPortrait ? 1.80 : 2.50;
  const SCR_H   = inPortrait ? 1.01 : 1.41;

  function makeScreenGroup(texObj, angleDeg) {
    const ang = angleDeg * Math.PI / 180;
    const px  = SCR_RAD * Math.sin(ang);
    const pz  = -SCR_RAD * Math.cos(ang);

    const group = new THREE.Group();
    group.position.set(px, 0, pz);
    group.rotation.y = -ang;    // face toward origin / camera
    scene.add(group);

    const mat = new THREE.MeshStandardMaterial({
      map: texObj.tex, emissiveMap: texObj.tex,
      emissive: new THREE.Color(1,1,1), emissiveIntensity: 0.72,
      roughness: 1, metalness: 0,
    });
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(SCR_W, SCR_H), mat);
    panel.position.set(0, SCR_Y, 0);
    group.add(panel);

    // Bezel
    const bezelMat = new THREE.MeshStandardMaterial({ color: 0x0d0d0d, roughness: 0.9, metalness: 0.5 });
    const bw = SCR_W + 0.13, bh = SCR_H + 0.09;
    [
      [new THREE.BoxGeometry(bw, 0.055, 0.03), 0,       SCR_Y + bh/2, 0],
      [new THREE.BoxGeometry(bw, 0.055, 0.03), 0,       SCR_Y - bh/2, 0],
      [new THREE.BoxGeometry(0.055, bh, 0.03), -bw/2,   SCR_Y,        0],
      [new THREE.BoxGeometry(0.055, bh, 0.03),  bw/2,   SCR_Y,        0],
    ].forEach(([geo, ox, oy, oz]) => {
      const b = new THREE.Mesh(geo, bezelMat);
      b.position.set(ox, oy, oz);
      group.add(b);
    });

    // Stand
    const standMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.4, metalness: 0.85 });
    const colH = SCR_Y - SCR_H / 2 - 0.02;
    const col  = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, colH, 10), standMat);
    col.position.set(0, colH / 2, 0);
    group.add(col);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.20, 0.24, 0.04, 18), standMat);
    base.position.set(0, 0.02, 0);
    group.add(base);
  }

  // Center: News Bridge logo
  function makeCenterTex() {
    const c = document.createElement('canvas'); c.width = 1024; c.height = 576;
    const t = c.getContext('2d');
    const bg = t.createLinearGradient(0,0,0,576);
    bg.addColorStop(0,'#04041a'); bg.addColorStop(0.5,'#090836'); bg.addColorStop(1,'#04041a');
    t.fillStyle = bg; t.fillRect(0,0,1024,576);
    t.strokeStyle = 'rgba(60,55,190,0.14)'; t.lineWidth = 1;
    for (let x=0;x<1024;x+=64){t.beginPath();t.moveTo(x,0);t.lineTo(x,576);t.stroke();}
    for (let y=0;y<576;y+=64){t.beginPath();t.moveTo(0,y);t.lineTo(1024,y);t.stroke();}
    const gl = t.createRadialGradient(512,260,0,512,260,360);
    gl.addColorStop(0,'rgba(65,45,255,0.55)'); gl.addColorStop(1,'rgba(0,0,0,0)');
    t.fillStyle = gl; t.fillRect(0,0,1024,576);
    // Bridge icon
    const bx=512, by=218;
    t.strokeStyle='rgba(170,150,255,0.95)'; t.lineWidth=7;
    t.beginPath(); t.arc(bx,by+55,100,Math.PI,0,false); t.stroke();
    t.beginPath(); t.moveTo(bx-145,by+55); t.lineTo(bx+145,by+55); t.stroke();
    t.lineWidth=5;
    t.beginPath(); t.moveTo(bx-88,by+55); t.lineTo(bx-88,by-28); t.stroke();
    t.beginPath(); t.moveTo(bx+88,by+55); t.lineTo(bx+88,by-28); t.stroke();
    t.lineWidth=2.5;
    [[bx-88,by-28,bx,by+55],[bx+88,by-28,bx,by+55],
     [bx-88,by-28,bx-44,by+55],[bx+88,by-28,bx+44,by+55]].forEach(([x1,y1,x2,y2])=>{
      t.beginPath();t.moveTo(x1,y1);t.lineTo(x2,y2);t.stroke();
    });
    t.textAlign='center';
    t.fillStyle='#ffffff'; t.font='bold 76px sans-serif'; t.fillText('NEWS BRIDGE',512,388);
    t.fillStyle='rgba(185,170,255,0.88)'; t.font='30px sans-serif'; t.fillText('LIVE BROADCAST',512,436);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    return { tex };
  }

  // Left: image placeholder — uses module-level canvas for dynamic updates
  function makeLeftTex() {
    // Create module-level left screen canvas so it can be updated later
    _leftScreenCanvas = document.createElement('canvas');
    _leftScreenCanvas.width = 1024; _leftScreenCanvas.height = 576;
    _leftScreenCtx = _leftScreenCanvas.getContext('2d');
    clearLeftScreen();
    _leftScreenTex = new THREE.CanvasTexture(_leftScreenCanvas);
    _leftScreenTex.colorSpace = THREE.SRGBColorSpace;
    return { tex: _leftScreenTex };
  }

  // Right: speech text (module-level canvas so updateScreenText can update it)
  _rightScreenCanvas = document.createElement('canvas');
  _rightScreenCanvas.width = 1024; _rightScreenCanvas.height = 576;
  _rightScreenCtx = _rightScreenCanvas.getContext('2d');
  _drawRightScreen('');
  _rightScreenTex = new THREE.CanvasTexture(_rightScreenCanvas);
  _rightScreenTex.colorSpace = THREE.SRGBColorSpace;

  makeScreenGroup(makeCenterTex(), 0);
  makeScreenGroup(makeLeftTex(),  -SCR_ANG);
  makeScreenGroup({ tex: _rightScreenTex }, SCR_ANG);

  // Screen glow lights
  const glowC = new THREE.PointLight(0x3828dd, 1.6, 5.0, 1.6);
  glowC.position.set(0, SCR_Y, -1.1); scene.add(glowC);
  const glowL = new THREE.PointLight(0x2418bb, 0.8, 4.2, 2.0);
  glowL.position.set(-1.6, SCR_Y, -0.7); scene.add(glowL);
  const glowR = new THREE.PointLight(0x2418bb, 0.8, 4.2, 2.0);
  glowR.position.set( 1.6, SCR_Y, -0.7); scene.add(glowR);

  // Overhead studio spot
  const spot = new THREE.SpotLight(0xfff0e0, 2.2, 8, Math.PI / 6, 0.4, 1.5);
  spot.position.set(0, 4.5, 0.6);
  spot.target.position.set(0, 0.5, 0);
  spot.castShadow = false;
  scene.add(spot); scene.add(spot.target);
}

// ── Public: load the GLB character ─────────────────────────
export function loadCharacter(url, onReady, onError) {
  const loader = new GLTFLoader();
  loader.load(
    url,
    gltf => {
      const model = gltf.scene;
      characterRoot = model;

      // Auto-centre and scale the model
      const box    = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const scale  = 0.5 / maxDim;            // fit into ~0.5-unit height
      model.scale.setScalar(scale);
      model.position.sub(centre.multiplyScalar(scale));
      model.position.y += size.y * scale * 0.5; // align lowest model point with ground
      // Restore full 3D position from localStorage (x, y, z)
      try {
        const saved = JSON.parse(localStorage.getItem('avatar-character-position'));
        if (saved && typeof saved.x === 'number') {
          model.position.x = saved.x;
          model.position.y = saved.y;
          model.position.z = saved.z;
        }
      } catch {}

      // Re-centre camera to look at vertical midpoint of the model
      // so the whole body is framed properly.
      const midY = size.y * scale * 0.5;
      const portrait = isPortrait();
      const camDist = portrait ? 12.0 : 5.5;
      camera.position.set(0, midY, camDist);
      camera.lookAt(0, midY, 0);
      controls.target.set(0, midY, 0);
      controls.update();

      // Face the character toward the camera (+Z).
      model.rotation.y = Math.PI;

      scene.add(model);

      // Find morph mesh AND collect animation bones from skeletons
      model.traverse(node => {
        if (node.isMesh && node.morphTargetDictionary) {
          const keys = Object.keys(node.morphTargetDictionary);
          const hasRhubarb = MORPH_NAMES.some(n => keys.includes(n));
          if (hasRhubarb) {
            morphMesh = node;
            morphMesh.morphTargetInfluences.fill(0);
            const xIdx = morphMesh.morphTargetDictionary['X'];
            if (xIdx !== undefined) morphMesh.morphTargetInfluences[xIdx] = 1;
            console.log('[scene] Morph mesh found:', node.name);
            console.log('[scene] Available morph targets:', keys);
          }
        }

        // --- Bones via skeleton (most reliable for skinned meshes) ---
        if (node.isSkinnedMesh && node.skeleton) {
          node.skeleton.bones.forEach(bone => {
            if (ANIM_BONES.includes(bone.name) && !boneMap[bone.name]) {
              boneMap[bone.name] = bone;
              const r = { x: bone.rotation.x, y: bone.rotation.y, z: bone.rotation.z };
              boneRest[bone.name]    = { ...r };
              boneTarget[bone.name]  = { ...r };
              boneCurrent[bone.name] = { ...r };
              console.log('[scene] Bone found (skeleton):', bone.name, r);
            }
          });
        }

        // --- Fallback: also check traverse nodes directly ---
        if (ANIM_BONES.includes(node.name) && !boneMap[node.name]) {
          boneMap[node.name] = node;
          const r = { x: node.rotation.x, y: node.rotation.y, z: node.rotation.z };
          boneRest[node.name]    = { ...r };
          boneTarget[node.name]  = { ...r };
          boneCurrent[node.name] = { ...r };
          console.log('[scene] Bone found (traverse):', node.name, r);
        }
      });

      if (!morphMesh) {
        console.warn('[scene] No mesh with Rhubarb morph targets found. Check shape-key names.');
      }

      const foundBones = Object.keys(boneMap);
      const missing    = ANIM_BONES.filter(n => !boneMap[n]);
      console.log('[scene] Animation bones found:', foundBones);
      if (missing.length) console.warn('[scene] Bones NOT found:', missing);

      // Expose globally so devtools console can inspect/test
      window.__bones       = boneMap;
      window.__boneTarget  = boneTarget;
      window.__boneCurrent = boneCurrent;
      window.__boneRest    = boneRest;

      if (onReady) onReady(model);
    },
    undefined,
    err => {
      console.error('[scene] GLB load error:', err);
      if (onError) onError(err);
    }
  );
}

// ── Public: move the loaded character model in 3D ───────
export function raiseCharacter(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.y += amount;
}

export function lowerCharacter(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.y = Math.max(0, characterRoot.position.y - amount);
}

export function moveCharacterLeft(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.x -= amount;
}

export function moveCharacterRight(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.x += amount;
}

export function moveCharacterForward(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.z += amount;
}

export function moveCharacterBack(amount = 0.05) {
  if (!characterRoot) return;
  characterRoot.position.z -= amount;
}

export function saveCharacterPosition() {
  if (!characterRoot) return;
  const pos = characterRoot.position;
  localStorage.setItem('avatar-character-position', JSON.stringify({ x: pos.x, y: pos.y, z: pos.z }));
}

// ── Public: set the target mouth shape ─────────────────────
/**
 * @param {string} shapeName  - Rhubarb shape letter (A–X) or 'Basis'
 * @param {number} influence  - 0.0 … 1.0
 */
export function setMorphTarget(shapeName, influence) {
  if (!MORPH_NAMES.includes(shapeName)) return;
  targetInfluences[shapeName] = Math.max(0, Math.min(1, influence));
}

// ── Public: reset to closed-mouth rest pose ────────────────
// X = 1.0 (closed), all speech shapes A-H = 0.0.
// Snaps BOTH current and target influences so the mouth stops
// moving immediately — no visible lerp-back after speech ends.
export function resetMorphTargets() {
  MORPH_NAMES.forEach(n => {
    targetInfluences[n]  = 0;
    currentInfluences[n] = 0; // snap — bypass the lerp entirely
  });
  targetInfluences['X']  = 1.0;
  currentInfluences['X'] = 1.0; // snap closed, no movement
}
// Alias used by lipsync.js for readability.
export { resetMorphTargets as resetMouth };

// ── Private: main render loop ───────────────────────────────
function renderLoop() {
  const delta = clock.getDelta();

  controls.update();
  applyLerpedMorphs(delta);  _applyBonePose(delta);  renderer.render(scene, camera);
}

// ── Private: smooth morph application via dual-speed lerp ───
const LERP_OPEN  = 60;
const LERP_CLOSE = 22;
const INFLUENCE_MULTIPLIER = 1.2;

function applyLerpedMorphs(delta) {
  if (!morphMesh) return;

  MORPH_NAMES.forEach(name => {
    const idx = morphMesh.morphTargetDictionary[name];
    if (idx === undefined) return;

    const opening = targetInfluences[name] > currentInfluences[name];
    const speed   = opening ? LERP_OPEN : LERP_CLOSE;

    currentInfluences[name] = THREE.MathUtils.lerp(
      currentInfluences[name],
      targetInfluences[name],
      1 - Math.exp(-speed * delta)
    );

    const isSpeechShape = name !== 'X' && name !== 'Basis';
    const applied = (isSpeechShape && currentInfluences[name] > 0.001)
      ? currentInfluences[name] * INFLUENCE_MULTIPLIER
      : currentInfluences[name];
    morphMesh.morphTargetInfluences[idx] = applied;
  });
}

export function forceResetNonActive(activeShapeName) {
  MORPH_NAMES.forEach(name => {
    if (name !== activeShapeName) {
      currentInfluences[name] = 0;
      targetInfluences[name]  = 0;
    }
  });
}

function onResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const portrait = window.innerHeight > window.innerWidth;

  // Adjust camera FOV and distance for portrait
  camera.fov = portrait ? 60 : 40;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);

  // If not in static camera mode, adjust camera position for orientation
  if (!_staticCameraActive) {
    const midY = 1.0;
    const dist = portrait ? 12.0 : 5.5;
    camera.position.set(0, midY, dist);
    controls.target.set(0, midY, 0);
    controls.update();
  }
}

export function getCanvas() { return renderer.domElement; }

// ── Private: smooth bone pose lerp + wave oscillation ────────
function _applyBonePose(delta) {
  const now = performance.now();

  const tL = _poseAnimL ? Math.min(1, (now - _poseAnimL.startTime) / _poseAnimL.durationMs) : null;
  const tR = _poseAnimR ? Math.min(1, (now - _poseAnimR.startTime) / _poseAnimR.durationMs) : null;
  const tH = _poseAnimH ? Math.min(1, (now - _poseAnimH.startTime) / _poseAnimH.durationMs) : null;

  if (_waveActive) {
    _waveTime += delta;
    const fore = 'DEF-forearm' + _waveSide;
    if (boneRest[fore]) {
      boneTarget[fore].z = boneRest[fore].z + Math.sin(_waveTime * 7) * 0.65;
    }
  }

  const k = 1 - Math.exp(-BONE_LERP * delta);
  for (const name of ANIM_BONES) {
    const bone = boneMap[name];
    if (!bone) continue;

    let anim = null, t = null;
    if      (BONES_SET_L.has(name) && tL !== null) { anim = _poseAnimL; t = tL; }
    else if (BONES_SET_R.has(name) && tR !== null) { anim = _poseAnimR; t = tR; }
    else if (BONES_SET_H.has(name) && tH !== null) { anim = _poseAnimH; t = tH; }

    if (anim) {
      const te   = easeInOut(t);
      const from = anim.from[name];
      const to   = anim.to[name];
      if (!from || !to) continue;
      const x = from.x + (to.x - from.x) * te;
      const y = from.y + (to.y - from.y) * te;
      const z = from.z + (to.z - from.z) * te;
      boneCurrent[name] = { x, y, z };
      boneTarget[name]  = { x, y, z };
      bone.rotation.set(x, y, z);
    } else {
      const tgt = boneTarget[name];
      const cur = boneCurrent[name];
      cur.x = THREE.MathUtils.lerp(cur.x, tgt.x, k);
      cur.y = THREE.MathUtils.lerp(cur.y, tgt.y, k);
      cur.z = THREE.MathUtils.lerp(cur.z, tgt.z, k);
      bone.rotation.set(cur.x, cur.y, cur.z);
    }
  }

  if (tL >= 1) { const cb = _poseAnimL.onComplete; _poseAnimL = null; if (cb) cb(); }
  if (tR >= 1) { const cb = _poseAnimR.onComplete; _poseAnimR = null; if (cb) cb(); }
  if (tH >= 1) { const cb = _poseAnimH.onComplete; _poseAnimH = null; if (cb) cb(); }
}

// ── Public: named pose / animation exports ───────────────────
export function headTurnLeft() {
  const n = 'DEF-spine006';
  if (!boneTarget[n]) return;
  boneTarget[n].y = boneRest[n].y + 0.55;
}

export function headTurnRight() {
  const n = 'DEF-spine006';
  if (!boneTarget[n]) return;
  boneTarget[n].y = boneRest[n].y - 0.55;
}

export function headCenter() {
  const n = 'DEF-spine006';
  if (!boneRest[n]) return;
  boneTarget[n] = { ...boneRest[n] };
}

export function raiseArm(side) {
  setArmPose(side, { up: 0.93 });
}

export function armsIdle() {
  stopWave();
  for (const name of ANIM_BONES) {
    if (name !== 'DEF-spine006' && boneRest[name]) {
      boneTarget[name] = { ...boneRest[name] };
    }
  }
}

export function startWave(side = 'R') {
  const arm  = 'DEF-upper_arm' + side;
  const fore = 'DEF-forearm'   + side;
  if (!boneRest[arm]) return;
  stopWave();
  _waveActive = true;
  _waveSide   = side;
  _waveTime   = 0;
  const dir = side === 'L' ? 1 : -1;
  boneTarget[arm] = { ...boneRest[arm], z: boneRest[arm].z + dir * 1.1 };
  if (boneRest[fore]) boneTarget[fore] = { ...boneRest[fore] };
}

export function stopWave() {
  if (!_waveActive) return;
  _waveActive = false;
  const fore = 'DEF-forearm' + _waveSide;
  if (boneRest[fore]) boneTarget[fore] = { ...boneRest[fore] };
}

// ── Pose Studio engine ───────────────────────────────────────
function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

let _poseAnimL = null;
let _poseAnimR = null;
let _poseAnimH = null;

export function tweakJoint(boneName, axis, delta) {
  if (!boneTarget[boneName]) return;
  if      (BONES_SET_L.has(boneName)) _poseAnimL = null;
  else if (BONES_SET_R.has(boneName)) _poseAnimR = null;
  else                                _poseAnimH = null;
  boneTarget[boneName][axis] = (boneTarget[boneName][axis] || 0) + delta;
}

export function resetJoint(boneName) {
  if (!boneRest[boneName] || !boneTarget[boneName]) return;
  if      (BONES_SET_L.has(boneName)) _poseAnimL = null;
  else if (BONES_SET_R.has(boneName)) _poseAnimR = null;
  else                                _poseAnimH = null;
  boneTarget[boneName] = { ...boneRest[boneName] };
}

export function captureCurrentPose() {
  const snap = {};
  for (const name of ANIM_BONES) {
    if (boneTarget[name]) snap[name] = { ...boneTarget[name] };
  }
  return snap;
}

export function applyPose(poseData) {
  stopWave();
  for (const name of Object.keys(poseData)) {
    if      (BONES_SET_L.has(name)) _poseAnimL = null;
    else if (BONES_SET_R.has(name)) _poseAnimR = null;
    else if (BONES_SET_H.has(name)) _poseAnimH = null;
  }
  for (const name of ANIM_BONES) {
    if (poseData[name]) boneTarget[name] = { ...poseData[name] };
  }
}

export function animatePose(fromPose, toPose, durationMs = 1500, onComplete = null) {
  stopWave();
  animatePartPose('L', fromPose, toPose, durationMs, null);
  animatePartPose('R', fromPose, toPose, durationMs, null);
  animatePartPose('H', fromPose, toPose, durationMs, onComplete);
}

export function stopPoseAnim() {
  stopPartPoseAnim('L');
  stopPartPoseAnim('R');
  stopPartPoseAnim('H');
}

export function capturePartialPose(boneNames) {
  const snap = {};
  for (const name of boneNames) {
    if (boneTarget[name]) snap[name] = { ...boneTarget[name] };
  }
  return snap;
}

export function animatePartPose(part, fromPose, toPose, durationMs = 1500, onComplete = null) {
  const bones = part === 'L' ? BONES_L : part === 'R' ? BONES_R : BONES_H;
  const from = {}, to = {};
  for (const name of bones) {
    const rest = boneRest[name] || null;
    from[name] = fromPose[name] ? { ...fromPose[name] } : (rest ? { ...rest } : null);
    to[name]   = toPose[name]   ? { ...toPose[name]   } : (rest ? { ...rest } : null);
  }
  for (const name of bones) {
    const f = from[name];
    if (!f || !boneMap[name]) continue;
    boneCurrent[name] = { ...f };
    boneTarget[name]  = { ...f };
    boneMap[name].rotation.set(f.x, f.y, f.z);
  }
  const slot = { from, to, startTime: performance.now(), durationMs, onComplete };
  if (part === 'L')      _poseAnimL = slot;
  else if (part === 'R') _poseAnimR = slot;
  else                   _poseAnimH = slot;
}

export function stopPartPoseAnim(part) {
  let slot;
  if (part === 'L')      { slot = _poseAnimL; _poseAnimL = null; }
  else if (part === 'R') { slot = _poseAnimR; _poseAnimR = null; }
  else                   { slot = _poseAnimH; _poseAnimH = null; }
  if (!slot) return;
  const bones = part === 'L' ? BONES_L : part === 'R' ? BONES_R : BONES_H;
  for (const name of bones) {
    if (boneCurrent[name]) boneTarget[name] = { ...boneCurrent[name] };
  }
}

export function setArmPose(side, opts = {}) {
  const { up = 0, forward = 0, elbowBend = 0, wristFlex = 0, wristTwist = 0 } = opts;
  stopWave();
  const dir = side === 'L' ? 1 : -1;
  const arm = 'DEF-upper_arm' + side;
  if (boneRest[arm]) {
    boneTarget[arm] = {
      x: boneRest[arm].x + forward  * 1.2,
      y: boneRest[arm].y,
      z: boneRest[arm].z + dir * up * 1.45,
    };
  }
  const fore = 'DEF-forearm' + side;
  if (boneRest[fore]) {
    boneTarget[fore] = {
      x: boneRest[fore].x + elbowBend * 2.1,
      y: boneRest[fore].y,
      z: boneRest[fore].z,
    };
  }
  const hand = 'DEF-hand' + side;
  if (boneRest[hand]) {
    boneTarget[hand] = {
      x: boneRest[hand].x,
      y: boneRest[hand].y + wristTwist * 1.2,
      z: boneRest[hand].z + wristFlex  * 0.75,
    };
  }
}

export function setFingers(side, opts = {}) {
  const { thumb = 0, index = 0, middle = 0, ring = 0, pinky = 0 } = opts;
  const CURL  = [0.65, 1.35, 1.2];
  const THUMB = [0.5,  0.9,  0.7];
  const apply = (prefix, amount, maxCurl) => {
    for (let seg = 1; seg <= 3; seg++) {
      const name = prefix + '0' + seg + side;
      if (boneRest[name]) {
        boneTarget[name] = {
          x: boneRest[name].x + amount * maxCurl[seg - 1],
          y: boneRest[name].y,
          z: boneRest[name].z,
        };
      }
    }
  };
  apply('DEF-thumb',    thumb,  THUMB);
  apply('DEF-f_index',  index,  CURL);
  apply('DEF-f_middle', middle, CURL);
  apply('DEF-f_ring',   ring,   CURL);
  apply('DEF-f_pinky',  pinky,  CURL);
}

// ═══════════════════════════════════════════════════════════════
// News Brief Extensions
// ═══════════════════════════════════════════════════════════════

// ── Public: update right screen with title + scrolling summary ─
// The title stays fixed at top in bold. The summary scrolls based on
// progress (0..1) so the currently-spoken portion is visible.
// Optional titleIndex/titleTotal show a "Title N of M" progress footer.
export function updateScreenTextNewsBrief(title, summary, progress = 0, titleIndex = 0, titleTotal = 0) {
  if (!_rightScreenCtx || !_rightScreenTex) return;
  _drawRightScreenNewsBrief(title, summary, progress, titleIndex, titleTotal);
  _rightScreenTex.needsUpdate = true;
}

function _drawRightScreenNewsBrief(title, summary, progress, titleIndex, titleTotal) {
  const ctx = _rightScreenCtx;
  const W = _rightScreenCanvas.width;
  const H = _rightScreenCanvas.height;

  // Background
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#030312'); bg.addColorStop(1, '#06061e');
  ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = 'rgba(60,55,180,0.13)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 64) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Header bar
  const hdr = ctx.createLinearGradient(0, 0, W, 0);
  hdr.addColorStop(0,'rgba(30,25,180,0)'); hdr.addColorStop(0.5,'rgba(55,45,220,0.88)'); hdr.addColorStop(1,'rgba(30,25,180,0)');
  ctx.fillStyle = hdr; ctx.fillRect(0, 0, W, 72);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 30px sans-serif'; ctx.fillText('NOW SAYING', W / 2, 46);
  ctx.strokeStyle = 'rgba(120,100,255,0.65)'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(80, 78); ctx.lineTo(W - 80, 78); ctx.stroke();

  // Progress footer bar (shows when reading multiple titles)
  if (titleTotal > 0) {
    const fBarY = H - 36;
    const fBarH = 28;
    const fBarW = W - 160;
    const fBarX = 80;

    // Background track
    ctx.fillStyle = 'rgba(55,45,220,0.15)';
    ctx.beginPath(); ctx.roundRect(fBarX, fBarY, fBarW, fBarH, 14);
    ctx.fill();

    // Progress fill
    const fillFrac = titleIndex / titleTotal;
    if (fillFrac > 0) {
      ctx.fillStyle = 'rgba(74,74,255,0.5)';
      ctx.beginPath();
      const fillW = Math.max(fBarH, fillFrac * fBarW);
      ctx.roundRect(fBarX, fBarY, fillW, fBarH, 14);
      ctx.fill();
    }

    // Text overlay
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(`📍 Title ${titleIndex} of ${titleTotal}`, W / 2, fBarY + 19);
  }

  if (!title && !summary) {
    ctx.fillStyle = 'rgba(120,115,200,0.45)'; ctx.textAlign = 'center';
    ctx.font = '26px sans-serif'; ctx.fillText('— speech will appear here —', W / 2, 300);
    return;
  }

  // ── Title (always visible, bold, large) ─────────────────────
  const titleY = 130;
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = 'bold 38px sans-serif';

  // Word-wrap title
  const maxW = W - 80;
  const titleWords = (title || '').split(' ');
  let titleLine = '', titleLines = [];
  for (const word of titleWords) {
    const test = titleLine ? titleLine + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && titleLine) {
      titleLines.push(titleLine);
      titleLine = word;
    } else titleLine = test;
  }
  if (titleLine) titleLines.push(titleLine);

  // Draw title lines
  let ty = titleY;
  for (const l of titleLines) {
    ctx.fillText(l, W / 2, ty);
    ty += 48;
  }

  // Separator line after title
  const sepY = ty + 8;
  ctx.strokeStyle = 'rgba(120,100,255,0.35)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(120, sepY); ctx.lineTo(W - 120, sepY); ctx.stroke();

  // ── Summary (progress-based scrolling) ────────────────────
  if (!summary) return;

  ctx.fillStyle = '#c8c8f0';
  ctx.font = '30px sans-serif';

  // Word-wrap the entire summary to know total height
  const summaryWords = summary.split(' ');
  let si = 0, summaryLines = [];
  for (const word of summaryWords) {
    const test = summaryLines[si] ? summaryLines[si] + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && summaryLines[si]) {
      si++;
      summaryLines[si] = word;
    } else {
      if (!summaryLines[si]) summaryLines[si] = '';
      summaryLines[si] = summaryLines[si] ? summaryLines[si] + ' ' + word : word;
    }
  }

  const totalLines = summaryLines.length;
  const lineH = 44;
  const availableH = H - sepY - 20; // space from separator to bottom
  const visibleLines = Math.max(1, Math.floor(availableH / lineH));
  const maxScrollStart = Math.max(0, totalLines - visibleLines);

  // Progress determines which line is at the top of the visible window
  const scrollLine = Math.round(progress * maxScrollStart);

  // Draw visible lines
  let sy = sepY + 16;
  for (let i = scrollLine; i < Math.min(totalLines, scrollLine + visibleLines); i++) {
    ctx.fillText(summaryLines[i], W / 2, sy);
    sy += lineH;
  }

  // Scroll progress bar (thin indicator on the right edge)
  if (totalLines > visibleLines) {
    const barX = W - 14;
    const barH = availableH;
    const barTop = sepY + 10;
    const thumbH = Math.max(20, barH * (visibleLines / totalLines));
    const thumbPos = barTop + (barH - thumbH) * progress;

    ctx.fillStyle = 'rgba(55,45,220,0.2)';
    ctx.fillRect(barX, barTop, 6, barH);
    ctx.fillStyle = 'rgba(80,70,255,0.5)';
    ctx.fillRect(barX, thumbPos, 6, thumbH);
  }
}

// ── Public: set an image on the left screen ───────────────────
export function setLeftScreenImage(imageUrl) {
  if (!_leftScreenCtx || !_leftScreenTex) return;
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.onload = () => {
    const W = _leftScreenCanvas.width;
    const H = _leftScreenCanvas.height;
    // Draw a dark background first
    _leftScreenCtx.fillStyle = '#05051c';
    _leftScreenCtx.fillRect(0, 0, W, H);
    // Calculate aspect-ratio fit
    const scale = Math.min(W / img.width, H / img.height);
    const iw = img.width * scale;
    const ih = img.height * scale;
    const ix = (W - iw) / 2;
    const iy = (H - ih) / 2;
    // Draw rounded-rect clip
    _leftScreenCtx.save();
    _leftScreenCtx.beginPath();
    _leftScreenCtx.roundRect(12, 12, W - 24, H - 24, 8);
    _leftScreenCtx.clip();
    _leftScreenCtx.drawImage(img, ix, iy, iw, ih);
    _leftScreenCtx.restore();
    // Header overlay
    _leftScreenCtx.fillStyle = 'rgba(55,45,220,0.80)';
    _leftScreenCtx.fillRect(0, 0, W, 72);
    _leftScreenCtx.textAlign = 'center';
    _leftScreenCtx.fillStyle = '#ffffff';
    _leftScreenCtx.font = 'bold 30px sans-serif';
    _leftScreenCtx.fillText('FEATURED IMAGE', W / 2, 46);
    _leftScreenTex.needsUpdate = true;
  };
  img.onerror = () => {
    clearLeftScreen();
  };
  img.src = imageUrl;
}

// ── Public: clear the left screen ─────────────────────────────
export function clearLeftScreen() {
  if (!_leftScreenCtx || !_leftScreenTex) return;
  const W = _leftScreenCanvas.width;
  const H = _leftScreenCanvas.height;
  const bg = _leftScreenCtx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#030312'); bg.addColorStop(1, '#05051c');
  _leftScreenCtx.fillStyle = bg; _leftScreenCtx.fillRect(0, 0, W, H);
  _leftScreenCtx.strokeStyle = 'rgba(55,50,160,0.15)'; _leftScreenCtx.lineWidth = 1;
  for (let x = 0; x < W; x += 64) { _leftScreenCtx.beginPath(); _leftScreenCtx.moveTo(x,0); _leftScreenCtx.lineTo(x,H); _leftScreenCtx.stroke(); }
  for (let y = 0; y < H; y += 64) { _leftScreenCtx.beginPath(); _leftScreenCtx.moveTo(0,y); _leftScreenCtx.lineTo(W,y); _leftScreenCtx.stroke(); }
  const hdr = _leftScreenCtx.createLinearGradient(0, 0, W, 0);
  hdr.addColorStop(0, 'rgba(30,25,180,0)'); hdr.addColorStop(0.5, 'rgba(55,45,220,0.88)'); hdr.addColorStop(1, 'rgba(30,25,180,0)');
  _leftScreenCtx.fillStyle = hdr; _leftScreenCtx.fillRect(0, 0, W, 72);
  _leftScreenCtx.fillStyle = '#ffffff'; _leftScreenCtx.textAlign = 'center'; _leftScreenCtx.font = 'bold 30px sans-serif';
  _leftScreenCtx.fillText('FEATURED IMAGE', W / 2, 46);
  _leftScreenCtx.strokeStyle = 'rgba(120,100,255,0.65)'; _leftScreenCtx.lineWidth = 2;
  _leftScreenCtx.beginPath(); _leftScreenCtx.moveTo(80, 78); _leftScreenCtx.lineTo(W - 80, 78); _leftScreenCtx.stroke();
  _leftScreenCtx.fillStyle = 'rgba(140,130,255,0.50)'; _leftScreenCtx.font = '24px sans-serif';
  _leftScreenCtx.textAlign = 'center';
  _leftScreenCtx.fillText('— no image —', W / 2, H / 2 + 20);
  _leftScreenTex.needsUpdate = true;
}

// ── Public: set static camera for news presentation ───────────
let _savedCameraPos = null;
let _savedTarget = null;
let _staticCameraActive = false;

export function setStaticCamera() {
  if (_staticCameraActive) return;
  _savedCameraPos = { x: camera.position.x, y: camera.position.y, z: camera.position.z };
  _savedTarget = { x: controls.target.x, y: controls.target.y, z: controls.target.z };
  // Static camera — responsive to orientation, wide FOV + far back for mobile
  const portrait = isPortrait();
  const camY = portrait ? 1.8 : 1.6;
  const camZ = portrait ? 10.0 : 4.5;
  camera.position.set(0, camY, camZ);
  camera.lookAt(0, portrait ? 1.2 : 1.1, 0);
  controls.target.set(0, portrait ? 1.2 : 1.1, 0);
  controls.update();
  _staticCameraActive = true;
}

export function resetCamera() {
  if (!_staticCameraActive) return;
  if (_savedCameraPos) {
    camera.position.set(_savedCameraPos.x, _savedCameraPos.y, _savedCameraPos.z);
  }
  if (_savedTarget) {
    controls.target.set(_savedTarget.x, _savedTarget.y, _savedTarget.z);
  }
  controls.update();
  _staticCameraActive = false;
  _savedCameraPos = null;
  _savedTarget = null;
}

export function disableOrbitControls() {
  if (controls) controls.enabled = false;
}

export function enableOrbitControls() {
  if (controls) controls.enabled = true;
}

// ── Left-screen slideshow ─────────────────────────────────────
export function setLeftScreenSlideshow(imageUrls, intervalMs = 1000) {
  stopLeftScreenSlideshow();
  if (!imageUrls || imageUrls.length === 0) {
    clearLeftScreen();
    return;
  }
  let idx = 0;
  setLeftScreenImage(imageUrls[0]);
  window.__slideshowTimer = setInterval(() => {
    idx = (idx + 1) % imageUrls.length;
    setLeftScreenImage(imageUrls[idx]);
  }, intervalMs);
}

export function stopLeftScreenSlideshow() {
  if (window.__slideshowTimer) {
    clearInterval(window.__slideshowTimer);
    window.__slideshowTimer = null;
  }
}
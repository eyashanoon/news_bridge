/**
 * scene.js
 * Creates the Three.js renderer, scene, camera, lights, and OrbitControls.
 */
import * as THREE from 'three';
import { OrbitControls }  from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export function createScene(canvas) {
  // ── Renderer ────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type    = THREE.PCFSoftShadowMap;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace  = THREE.SRGBColorSpace;

  // ── Scene ───────────────────────────────────────────────────
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#0d1b3e');
  scene.fog        = new THREE.FogExp2('#0d1b3e', 0.06);

  // PBR-quality ambient from a simple room environment
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  // ── Lights ──────────────────────────────────────────────────
  scene.add(new THREE.AmbientLight(0xffffff, 0.35));

  const keyLight = new THREE.DirectionalLight(0xfff4e0, 3.0);
  keyLight.position.set(2, 4, 3);
  keyLight.castShadow = true;
  keyLight.shadow.camera.near = 0.1;
  keyLight.shadow.camera.far  = 25;
  keyLight.shadow.camera.top    =  3;
  keyLight.shadow.camera.bottom = -3;
  keyLight.shadow.camera.left   = -3;
  keyLight.shadow.camera.right  =  3;
  keyLight.shadow.mapSize.set(1024, 1024); // 2048 was too heavy; 1024 looks fine
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0xaac8ff, 1.0);
  fillLight.position.set(-3, 2, 1);
  scene.add(fillLight);

  const rimLight = new THREE.PointLight(0x7c6af7, 2.5, 12);
  rimLight.position.set(0, 2.5, -2.5);
  scene.add(rimLight);

  // ── Ground (shadow catcher only) ────────────────────────────
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(20, 20),
    new THREE.ShadowMaterial({ opacity: 0.25 }),
  );
  ground.rotation.x    = -Math.PI / 2;
  ground.position.y    = 0;
  ground.receiveShadow = true;
  scene.add(ground);

  // Subtle glow disc under avatar
  const glow = new THREE.Mesh(
    new THREE.CircleGeometry(0.75, 64),
    new THREE.MeshBasicMaterial({
      color: 0x7c6af7,
      transparent: true,
      opacity: 0.12,
    }),
  );
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.001;
  scene.add(glow);

  // ── Camera ──────────────────────────────────────────────────
  const camera = new THREE.PerspectiveCamera(
    28, window.innerWidth / window.innerHeight, 0.01, 100,
  );
  // Frame: head + upper body visible, face centred
  camera.position.set(0, 1.55, 4.0);

  // ── OrbitControls (limited to gentle horizontal arc) ────────
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 1.30, 0);   // aim at chest/face height
  controls.enablePan  = false;
  controls.enableZoom = false;
  controls.minPolarAngle  = Math.PI * 0.3;
  controls.maxPolarAngle  = Math.PI * 0.58;
  controls.minAzimuthAngle = -Math.PI / 6;
  controls.maxAzimuthAngle =  Math.PI / 6;
  controls.enableDamping = true;
  controls.dampingFactor = 0.07;
  controls.update();

  // ── Resize ──────────────────────────────────────────────────
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, controls };
}

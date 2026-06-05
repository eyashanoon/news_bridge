/**
 * avatar.js
 * LIP SYNC: 9 shape keys baked from Blender pose assets (AAA→A, BBB→B, CCC→C, DDD→D, EEE→E, FFF→F, GGG→G, HHH→H, XXX→X)
 * MESH: Retopo_tripo_node_56ade3d9-b439-4635-8683-30df461950d1.001 (SkinnedMesh with shape keys)
 */
import * as THREE from 'three';
import { GLTFLoader }   from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }  from 'three/addons/loaders/DRACOLoader.js';

const MODEL_URL = '/models/avatar.glb';

const HIDE_MESHES = new Set([
  'tripo_node_f9169681',
  'tripo_mesh_f9169681',
  'tripo_node_56ade3d9-b439-4635-8683-30df461950d1',
  'tripo_mesh_56ade3d9-b439-4635-8683-30df461950d1',
]);

// Bone names for idle animation (GLTF exporter strips dots: lid.T.L -> lidTL)
const B = {
  head:  'head',
  lidTL: 'lidTL', lidTR: 'lidTR',
  lidBL: 'lidBL', lidBR: 'lidBR',
};

export class Avatar {
  constructor(scene) {
    this.scene = scene;
    this.root  = new THREE.Group();
    scene.add(this.root);
    this.ready      = false;
    this.bones      = {};
    this.morphMesh  = null;
    this._blinkTimer = 0;
    this._blinkNext  = 1.5 + Math.random() * 3.5;
    this._blinkPhase = 0;
    this._t          = 0;
  }

  async load(_url, onProgress) {
    return new Promise((resolve, reject) => {
      const draco = new DRACOLoader();
      draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
      draco.setDecoderConfig({ type: 'js' });
      draco.preload();

      const loader = new GLTFLoader();
      loader.setDRACOLoader(draco);

      loader.load(MODEL_URL, (gltf) => {
        const model = gltf.scene;
        model.rotation.y = Math.PI;

        model.traverse(n => {
          if (!n.isMesh && !n.isSkinnedMesh) return;
          // Hide weight/widget visualisation bones
          if (n.name.startsWith('WGT-') || n.name.startsWith('DEF-')) { n.visible = false; return; }
          // Hide explicitly listed duplicate meshes (no rig / no shape keys)
          if (HIDE_MESHES.has(n.name)) { n.visible = false; return; }
          n.castShadow = n.receiveShadow = true;
          const mats = Array.isArray(n.material) ? n.material : (n.material ? [n.material] : []);
          for (const mat of mats) {
            // Respect double-sided flag set by the GLTF exporter — do NOT override to FrontSide
            // Only force DoubleSide for hair/lash cards that may export as single-sided
            if (mat.side !== THREE.DoubleSide) {
              const nm = n.name.toLowerCase();
              if (nm.includes('hair') || nm.includes('lash') || nm.includes('brow') || nm.includes('eye'))
                mat.side = THREE.DoubleSide;
            }
            mat.needsUpdate = true;
          }
        });

        const box = new THREE.Box3().setFromObject(model);
        const s   = 1.85 / (box.getSize(new THREE.Vector3()).y || 1);
        model.scale.setScalar(s);
        const centre = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
        model.position.set(-centre.x, -box.min.y * s, -centre.z);

        model.traverse(n => { if (n.isBone) this.bones[n.name] = n; });
        model.traverse(n => {
          if (n.isSkinnedMesh && n.skeleton)
            n.skeleton.bones.forEach(b => { if (b?.name) this.bones[b.name] = b; });
        });

        model.traverse(n => {
          if (!n.isSkinnedMesh || !n.morphTargetDictionary) return;
          if (Object.keys(n.morphTargetDictionary).length === 0) return;
          if (!this.morphMesh || n.name.toLowerCase().includes('retopo'))
            this.morphMesh = n;
        });

        const dict = this.morphMesh?.morphTargetDictionary ?? {};
        console.info('[Avatar] morph mesh:', this.morphMesh?.name ?? 'NONE',
          '| shape keys:', Object.keys(dict));
        console.info('[Avatar] bones:', Object.keys(this.bones).length,
          '| head:', !!this.bones['head']);

        this.root.add(model);
        this.ready = true;
        draco.dispose();

        resolve({
          _isProcedural: true,
          _avatar: this,
          morphTargetDictionary: dict,
          morphTargetInfluences: this.morphMesh?.morphTargetInfluences ?? [],
        });
      }, onProgress, err => {
        console.error('[Avatar] load error:', err);
        draco.dispose();
        reject(err);
      });
    });
  }

  setJawOpen(_v) {}
  setSmile(_v)   {}

  _b(key) { return this.bones[B[key]] ?? null; }

  _lerp(bone, axis, target, dt, speed = 8) {
    if (!bone) return;
    bone.rotation[axis] += (target - bone.rotation[axis]) * Math.min(dt * speed, 1);
  }

  update(dt) {
    if (!this.ready) return;
    this._t += dt;
    const t = this._t;

    this._lerp(this._b('head'), 'y', Math.sin(t * 0.22) * 0.022, dt, 2);
    this._lerp(this._b('head'), 'x', Math.sin(t * 0.17) * 0.010, dt, 2);

    this._blinkTimer += dt;
    if (this._blinkPhase === 0 && this._blinkTimer >= this._blinkNext) {
      this._blinkPhase = 0.001;
      this._blinkTimer = 0;
      this._blinkNext  = 2.0 + Math.random() * 5.0;
    }
    if (this._blinkPhase > 0) {
      this._blinkPhase += dt * 10;
      const v = Math.max(0, Math.sin(this._blinkPhase * Math.PI));
      const tL = this._b('lidTL'); if (tL) tL.rotation.x =  v * 0.52;
      const tR = this._b('lidTR'); if (tR) tR.rotation.x =  v * 0.52;
      const bL = this._b('lidBL'); if (bL) bL.rotation.x = -v * 0.26;
      const bR = this._b('lidBR'); if (bR) bR.rotation.x = -v * 0.26;
      if (this._blinkPhase >= 1) {
        this._blinkPhase = 0;
        ['lidTL','lidTR','lidBL','lidBR'].forEach(k => {
          const b = this._b(k); if (b) b.rotation.x = 0;
        });
      }
    }
  }
}

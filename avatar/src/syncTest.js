/**
 * syncTest.js — Lip Sync Analyzer
 *
 * Features:
 *  - Enter any phrase → analyze into words, syllables, phoneme→viseme traces
 *  - 3D avatar shows the current viseme
 *  - Timeline of clickable word cards and syllable chips
 *  - Full playback with TTS boundary events (real timing)
 *  - Step through words / syllables with buttons or keyboard
 *  - Live morph bars
 */

import * as THREE from 'three';
import { GLTFLoader }    from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader }   from 'three/addons/loaders/DRACOLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ─── Phoneme / Viseme tables (mirrors lipSync.js) ─────────────────────────────

const CHAR_VIS = {
  a:'A', e:'E', i:'E', o:'H', u:'H',
  b:'B', m:'B', p:'B',
  f:'F', v:'F',
  t:'D', d:'D', s:'C', z:'C', n:'C', l:'C',
  k:'G', g:'G', c:'C',
  r:'A', j:'C', x:'C', q:'C',
  h:'X', y:'E', w:'H',
};
const DIGRAPH_VIS = { th:'D', sh:'C', ch:'C', ph:'F', wh:'H', ng:'G' };
const ALL_VIS = ['A','B','C','D','E','F','G','H','X'];
const VIS_RANK = { A:9, H:8, E:7, F:5, D:4, B:4, C:3, G:3, X:0 };
const VIS_DESC = {
  A:'Open vowel (a / r)',  B:'Bilabial (b / m / p)', C:'Sibilant (s / z / n)',
  D:'Dental (t / d / th)', E:'Front vowel (e / i)',   F:'Labiodental (f / v)',
  G:'Velar (k / g / ng)',  H:'Round vowel (o / u / w)', X:'Rest / silence',
};
const EST_MS  = 110;  // estimated ms per viseme when real timing unknown
const MAX_VIS = 5;
const VOWELS  = new Set('aeiou');

// ─── Phoneme analysis helpers ──────────────────────────────────────────────────

/** Full character-by-character phoneme trace (not pruned). */
function phonemeTrace(raw) {
  const w = raw.toLowerCase().replace(/[^a-z]/g, '');
  const trace = [];
  let i = 0;
  while (i < w.length) {
    const pair = w.slice(i, i + 2);
    if (DIGRAPH_VIS[pair]) {
      trace.push({ chars: pair, vis: DIGRAPH_VIS[pair] });
      i += 2;
    } else if (CHAR_VIS[w[i]]) {
      trace.push({ chars: w[i], vis: CHAR_VIS[w[i]] });
      i++;
    } else {
      i++;
    }
  }
  return trace;
}

/** Deduped + pruned viseme sequence used for playback. */
function wordToVisemes(raw) {
  const trace = phonemeTrace(raw);
  const vis = [];
  for (const { vis: v } of trace) {
    if (!vis.length || vis[vis.length - 1] !== v) vis.push(v);
  }
  if (!vis.length) return ['X'];
  if (vis.length > MAX_VIS) {
    const ranked = vis
      .map((v, idx) => ({ v, idx, r: VIS_RANK[v] ?? 0 }))
      .sort((a, b) => b.r - a.r)
      .slice(0, MAX_VIS)
      .sort((a, b) => a.idx - b.idx);
    return ranked.map(x => x.v);
  }
  return vis;
}

/**
 * Simple English syllabifier.
 * Splits at the first consonant after each vowel when the next char is also a vowel
 * (CV.CV pattern). Good enough to show meaningful chunks for a debug UI.
 */
function syllabify(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return [word];
  const syls = [];
  let cur = '';
  for (let i = 0; i < w.length; i++) {
    cur += w[i];
    if (VOWELS.has(w[i]) && i + 2 < w.length && !VOWELS.has(w[i + 1]) && VOWELS.has(w[i + 2])) {
      cur += w[i + 1];
      i++;
      syls.push(cur);
      cur = '';
    }
  }
  if (cur) syls.push(cur);
  return syls.length ? syls : [word];
}

/** Analyze a full phrase into word objects. */
function analyzePhrase(text) {
  const re = /\S+/g;
  let m;
  const words = [];
  while ((m = re.exec(text)) !== null) {
    const raw   = m[0];
    const clean = raw.replace(/[^a-zA-Z']/g, '');
    if (!clean) continue;
    const trace  = phonemeTrace(clean);
    const visSeq = wordToVisemes(clean);
    const syls   = syllabify(clean).map(s => ({
      text:    s,
      visemes: wordToVisemes(s),
      trace:   phonemeTrace(s),
    }));
    words.push({
      word:      raw,
      clean,
      charIndex: m.index,
      visemes:   visSeq,
      trace,
      syllables: syls,
      estDurMs:  visSeq.length * EST_MS,
      realDurMs: null,
      startMs:   null,
      _timers:   [],
    });
  }
  return words;
}

// ─── Avatar view (Three.js) ───────────────────────────────────────────────────

const HIDE_MESHES = new Set([
  'tripo_node_f9169681', 'tripo_mesh_f9169681',
  'tripo_node_56ade3d9-b439-4635-8683-30df461950d1',
]);

class AvatarView {
  constructor(canvas) {
    this.canvas     = canvas;
    this.morphProxy = null;
    this.smooth     = Object.fromEntries(ALL_VIS.map(v => [v, v === 'X' ? 1 : 0]));
    this.targetVis  = 'X';
    this._bones     = {};
    this._t         = 0;
    this._blinkT    = 0;
    this._blinkNext = 2 + Math.random() * 3;
    this._blinkAnim = 0;
    this.ready      = false;
    this._initScene();
    this._loadModel();
  }

  _initScene() {
    const wrap = this.canvas.parentElement;
    const w = wrap.clientWidth, h = wrap.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.setSize(w, h);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type    = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x09090f);
    this.scene.fog = new THREE.Fog(0x09090f, 8, 20);

    this.camera = new THREE.PerspectiveCamera(38, w / h, 0.01, 100);
    this.camera.position.set(0, 1.55, 3.2);

    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.set(0, 1.30, 0);
    this.controls.enableDamping  = true;
    this.controls.dampingFactor  = 0.1;
    this.controls.update();

    const ambi = new THREE.AmbientLight(0xffffff, 0.6);
    const key  = new THREE.DirectionalLight(0xffeedd, 1.2);
    key.position.set(1.5, 4, 3);
    key.castShadow = true;
    const fill = new THREE.DirectionalLight(0xccddff, 0.4);
    fill.position.set(-2, 2, -1);
    this.scene.add(ambi, key, fill);

    window.addEventListener('resize', () => {
      const w2 = wrap.clientWidth, h2 = wrap.clientHeight;
      this.camera.aspect = w2 / h2;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w2, h2);
    });
  }

  _loadModel() {
    const draco = new DRACOLoader();
    draco.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
    draco.setDecoderConfig({ type: 'js' });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);

    loader.load('/models/avatar.glb', (gltf) => {
      const model = gltf.scene;
      model.rotation.y = Math.PI;

      model.traverse(n => {
        if (!n.isMesh && !n.isSkinnedMesh) return;
        if (n.name.startsWith('WGT-') || n.name.startsWith('DEF-')) { n.visible = false; return; }
        if (HIDE_MESHES.has(n.name)) { n.visible = false; return; }
        n.castShadow = n.receiveShadow = true;
        const mats = Array.isArray(n.material) ? n.material : (n.material ? [n.material] : []);
        for (const mat of mats) {
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
      const c = box.getCenter(new THREE.Vector3()).multiplyScalar(s);
      model.position.set(-c.x, -box.min.y * s, -c.z);

      model.traverse(n => { if (n.isBone) this._bones[n.name] = n; });
      model.traverse(n => {
        if (n.isSkinnedMesh && n.skeleton)
          n.skeleton.bones.forEach(b => { if (b?.name) this._bones[b.name] = b; });
      });

      let morphMesh = null;
      model.traverse(n => {
        if (!n.isSkinnedMesh || !n.morphTargetDictionary) return;
        if (!Object.keys(n.morphTargetDictionary).length) return;
        if (!morphMesh || n.name.toLowerCase().includes('retopo')) morphMesh = n;
      });

      if (morphMesh) {
        this.morphProxy = {
          morphTargetDictionary: morphMesh.morphTargetDictionary,
          morphTargetInfluences: morphMesh.morphTargetInfluences,
        };
        console.info('[SyncTest] shape keys:', Object.keys(morphMesh.morphTargetDictionary));
      }

      this.scene.add(model);
      this.ready = true;
      draco.dispose();
      document.getElementById('loading-overlay').style.display = 'none';
    }, undefined, err => {
      console.error('[SyncTest] load error', err);
      document.getElementById('loading-overlay').textContent = 'Failed to load avatar.';
    });
  }

  setViseme(v) { this.targetVis = ALL_VIS.includes(v) ? v : 'X'; }

  update(dt) {
    this._t      += dt;
    this._blinkT += dt;

    // Blink
    if (this._blinkT >= this._blinkNext) {
      this._blinkT = 0; this._blinkNext = 2 + Math.random() * 4; this._blinkAnim = 0.14;
    }
    if (this._blinkAnim > 0) {
      this._blinkAnim -= dt;
      const phase  = this._blinkAnim / 0.14;
      const lidVal = phase > 0.5 ? (1 - phase) * 1.2 : phase * 1.2;
      ['lidTL','lidTR','lidBL','lidBR'].forEach(n => {
        const b = this._bones[n]; if (b) b.rotation.x = Math.max(0, lidVal);
      });
    }

    // Head sway
    const head = this._bones['head'];
    if (head) {
      head.rotation.y += (Math.sin(this._t * 0.22) * 0.022 - head.rotation.y) * Math.min(dt * 2, 1);
      head.rotation.x += (Math.sin(this._t * 0.15) * 0.008 - head.rotation.x) * Math.min(dt * 2, 1);
    }

    // Morph blend
    if (this.morphProxy) {
      const { morphTargetDictionary: dict, morphTargetInfluences: infl } = this.morphProxy;
      for (const v of ALL_VIS) {
        const want = v === this.targetVis ? 1 : 0;
        const cur  = this.smooth[v];
        const spd  = want > cur ? 14 : 18;
        this.smooth[v] = cur + (want - cur) * Math.min(dt * spd, 1);
        const idx = dict[v];
        if (idx !== undefined) infl[idx] = this.smooth[v];
      }
    }

    this.controls.update();
    this.renderer.render(this.scene, this.camera);
  }
}

// ─── App ──────────────────────────────────────────────────────────────────────

class SyncTestApp {
  constructor() {
    this.words         = [];
    this.curWordIdx    = 0;
    this.curSylIdx     = 0;
    this.playing       = false;
    this._speechStart  = 0;   // performance.now() when TTS onstart fired
    this._startWordIdx = 0;   // word index we started speaking from
    this.synth         = window.speechSynthesis;
    this.voice         = null;
    this._morphEls     = {};
    this._cardEls      = [];

    this.avatarView = new AvatarView(document.getElementById('avatar-canvas'));
    this._buildMorphBars();
    this._bindUI();
    this._loadVoice();
    this._loop();
  }

  // ── Voice ──────────────────────────────────────────────────────────────────

  _loadVoice() {
    const pick = () => {
      const voices = this.synth.getVoices();
      if (!voices.length) return false;
      const tests = [
        v => /en-US/i.test(v.lang) && /guy|christopher|davis|andrew|brian/i.test(v.name),
        v => /en-US/i.test(v.lang) && /david/i.test(v.name),
        v => /en-US/i.test(v.lang) && !/(zira|susan|cortana)/i.test(v.name),
        v => v.lang.startsWith('en'),
        () => true,
      ];
      for (const t of tests) { const v = voices.find(t); if (v) { this.voice = v; return true; } }
      return false;
    };
    if (!pick()) this.synth.addEventListener('voiceschanged', pick, { once: true });
  }

  // ── Morph bars ─────────────────────────────────────────────────────────────

  _buildMorphBars() {
    const container = document.getElementById('morph-bars');
    container.innerHTML = '';
    for (const v of ALL_VIS) {
      container.insertAdjacentHTML('beforeend', `
        <div class="mrow">
          <span class="mlbl" id="ml-${v}">${v}</span>
          <div class="mtrack"><div class="mfill" id="mf-${v}"></div></div>
          <span class="mval"  id="mv-${v}">0.00</span>
        </div>`);
      this._morphEls[v] = {
        lbl:  document.getElementById(`ml-${v}`),
        fill: document.getElementById(`mf-${v}`),
        val:  document.getElementById(`mv-${v}`),
      };
    }
  }

  _refreshMorphBars() {
    const proxy = this.avatarView.morphProxy;
    if (!proxy) return;
    const { morphTargetDictionary: dict, morphTargetInfluences: infl } = proxy;
    const cur = this.avatarView.targetVis;
    for (const v of ALL_VIS) {
      const idx = dict[v];
      if (idx === undefined) continue;
      const val = infl[idx] ?? 0;
      const els = this._morphEls[v];
      els.fill.style.width      = `${(val * 100).toFixed(1)}%`;
      els.fill.className        = `mfill${v === cur ? ' warm' : ''}`;
      els.val.textContent       = val.toFixed(2);
      els.lbl.className         = `mlbl${v === cur ? ' on' : ''}`;
    }
  }

  // ── UI binding ─────────────────────────────────────────────────────────────

  _bindUI() {
    document.getElementById('btn-analyze').addEventListener('click', () => this._analyze());
    document.getElementById('btn-play')  .addEventListener('click', () => this._playFull());
    document.getElementById('btn-stop')  .addEventListener('click', () => this._stop());
    document.getElementById('btn-first') .addEventListener('click', () => this._jumpWord(0));
    document.getElementById('btn-last')  .addEventListener('click', () => this._jumpWord(this.words.length - 1));
    document.getElementById('btn-prevw') .addEventListener('click', () => this._jumpWord(this.curWordIdx - 1));
    document.getElementById('btn-nextw') .addEventListener('click', () => this._jumpWord(this.curWordIdx + 1));
    document.getElementById('btn-prevs') .addEventListener('click', () => this._stepSyl(-1));
    document.getElementById('btn-nexts') .addEventListener('click', () => this._stepSyl(1));
    document.getElementById('btn-speak') .addEventListener('click', () => this._speakCurrentWord());

    document.addEventListener('keydown', e => {
      if (e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') { e.preventDefault(); this._jumpWord(this.curWordIdx + 1); }
      if (e.key === 'ArrowLeft')  { e.preventDefault(); this._jumpWord(this.curWordIdx - 1); }
      if (e.key === 'ArrowDown')  { e.preventDefault(); this._stepSyl(1); }
      if (e.key === 'ArrowUp')    { e.preventDefault(); this._stepSyl(-1); }
      if (e.key === ' ')          { e.preventDefault(); this.playing ? this._stop() : this._playFull(); }
      if (e.key === 's' || e.key === 'S') this._speakCurrentWord();
    });
  }

  _setPlay(on) {
    this.playing = on;
    document.getElementById('btn-play')   .classList.toggle('playing', on);
    document.getElementById('btn-play')   .disabled = on;
    document.getElementById('btn-stop')   .disabled = !on;
    document.getElementById('btn-analyze').disabled = on;
  }

  // ── Analysis ───────────────────────────────────────────────────────────────

  _analyze() {
    const text = document.getElementById('phrase-input').value.trim();
    if (!text) return;
    this._stop();
    this.words      = analyzePhrase(text);
    this.curWordIdx = 0;
    this.curSylIdx  = 0;
    document.getElementById('btn-play').disabled = this.words.length === 0;
    this._buildTimeline();
    if (this.words.length) this._focusWord(0, 0);
    this._setStatus(`${this.words.length} word(s) — click a card or syllable to preview`);
  }

  // ── Timeline ───────────────────────────────────────────────────────────────

  _buildTimeline() {
    const tl = document.getElementById('timeline');
    tl.innerHTML = '';
    this._cardEls = [];

    if (!this.words.length) {
      tl.insertAdjacentHTML('beforeend', '<p id="tl-empty">No words found.</p>');
      return;
    }

    this.words.forEach((w, wi) => {
      const visBadges = w.visemes.map(v =>
        `<span class="vbadge" id="vb-${wi}-${v}" title="${VIS_DESC[v]}">${v}</span>`
      ).join('');

      const sylChips = w.syllables.map((s, si) =>
        `<span class="schip" data-wi="${wi}" data-si="${si}"
          title="${s.trace.map(p=>`${p.chars}→${p.vis}`).join(' ')}"
        >${escHtml(s.text)}<span class="sv">${s.visemes[0] ?? 'X'}</span></span>`
      ).join('');

      const card = document.createElement('div');
      card.className    = 'wcard';
      card.dataset.wi   = wi;
      card.innerHTML = `
        <div class="wc-txt">${escHtml(w.word)}</div>
        <div class="wc-vis">${visBadges}</div>
        <div class="wc-bar"><div class="wc-fill" id="dur-${wi}"></div></div>
        <div class="wc-dur" id="durtext-${wi}">~<span>${w.estDurMs}</span>ms</div>
        <div class="wc-syls">${sylChips}</div>`;

      card.addEventListener('click', e => {
        const sc = e.target.closest('.schip');
        if (sc) this._focusSyllable(+sc.dataset.wi, +sc.dataset.si);
        else    this._jumpWord(wi);
      });

      tl.appendChild(card);
      this._cardEls.push(card);
    });
  }

  // ── Focus helpers ──────────────────────────────────────────────────────────

  _jumpWord(wi) {
    if (!this.words.length) return;
    wi = Math.max(0, Math.min(this.words.length - 1, wi));
    if (this.playing) {
      // Re-speak from this word
      this.synth.cancel();
      const fullText = document.getElementById('phrase-input').value.trim();
      this._speakText(fullText.slice(this.words[wi].charIndex), wi);
    } else {
      this._focusWord(wi, 0);
    }
  }

  _stepSyl(dir) {
    if (!this.words.length) return;
    const nSyls = this.words[this.curWordIdx].syllables.length;
    let si = this.curSylIdx + dir;
    if (si < 0) {
      if (this.curWordIdx > 0) { this.curWordIdx--; si = this.words[this.curWordIdx].syllables.length - 1; }
      else si = 0;
    } else if (si >= nSyls) {
      if (this.curWordIdx < this.words.length - 1) { this.curWordIdx++; si = 0; }
      else si = nSyls - 1;
    }
    this._focusSyllable(this.curWordIdx, si);
  }

  _focusWord(wi, si = 0) {
    this.curWordIdx = wi;
    this.curSylIdx  = si;
    const word = this.words[wi];
    const syl  = word.syllables[si] ?? word.syllables[0];
    const vis  = syl?.visemes[0] ?? word.visemes[0] ?? 'X';
    this.avatarView.setViseme(vis);
    this._refreshInfoPanel(word, syl ?? { text: word.clean, visemes: word.visemes, trace: word.trace });
    this._refreshTimeline(wi, si);
  }

  _focusSyllable(wi, si) {
    this.curWordIdx = wi;
    this.curSylIdx  = si;
    const word = this.words[wi];
    const syl  = word.syllables[si];
    const vis  = syl.visemes[0] ?? 'X';
    this.avatarView.setViseme(vis);
    this._refreshInfoPanel(word, syl);
    this._refreshTimeline(wi, si);
  }

  // ── Info panel ─────────────────────────────────────────────────────────────

  _refreshInfoPanel(word, syl) {
    const mainVis = syl.visemes[0] ?? 'X';
    document.getElementById('cur-word').textContent = word.word;
    document.getElementById('cur-syl').textContent  =
      `Syllable: ${syl.text}  ·  ${word.syllables.map(s => s.text).join(' · ')}`;
    document.getElementById('cur-vis-big').textContent = mainVis;
    document.getElementById('vis-desc').textContent    = VIS_DESC[mainVis] ?? '';
    document.getElementById('phoneme-row').innerHTML   = syl.trace.map(p =>
      `<span class="pchip">${escHtml(p.chars)}<span class="pv">→${p.vis}</span></span>`
    ).join('');
  }

  // ── Timeline highlight ─────────────────────────────────────────────────────

  _refreshTimeline(activeWi, activeSi) {
    this._cardEls.forEach((card, wi) => {
      card.classList.toggle('active',  wi === activeWi);
      card.classList.toggle('done',    wi < activeWi && !this.playing);

      // vis badges
      ALL_VIS.forEach(v => {
        const el = document.getElementById(`vb-${wi}-${v}`);
        if (el) el.classList.remove('lit');
      });

      // syllable chips
      card.querySelectorAll('.schip').forEach((sc, si) =>
        sc.classList.toggle('slit', wi === activeWi && si === activeSi)
      );
    });

    // light up the active viseme badge in current word
    if (this.words[activeWi]) {
      const syl = this.words[activeWi].syllables[activeSi] ?? this.words[activeWi].syllables[0];
      const vis = syl?.visemes[0] ?? this.words[activeWi].visemes[0];
      const el  = document.getElementById(`vb-${activeWi}-${vis}`);
      if (el) el.classList.add('lit');
    }

    // Scroll active card into view
    if (this._cardEls[activeWi])
      this._cardEls[activeWi].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  /** Light up a specific viseme badge during playback (by vis letter). */
  _lightViseme(wi, vis) {
    ALL_VIS.forEach(v => {
      const el = document.getElementById(`vb-${wi}-${v}`);
      if (el) el.classList.toggle('lit', v === vis);
    });
    document.getElementById('cur-vis-big').textContent = vis;
    document.getElementById('vis-desc').textContent    = VIS_DESC[vis] ?? '';
  }

  // ── Playback ───────────────────────────────────────────────────────────────

  _playFull() {
    if (!this.words.length) return;
    const text = document.getElementById('phrase-input').value.trim();
    this._speakText(text, 0);
  }

  _speakText(text, startWordIdx) {
    this.synth.cancel();
    this._startWordIdx = startWordIdx;
    this._setPlay(true);
    this._setStatus('Speaking…');

    const utt   = new SpeechSynthesisUtterance(text);
    utt.voice   = this.voice;
    utt.rate    = 0.88;
    utt.pitch   = 0.78;
    utt.volume  = 1.0;

    utt.onstart = () => {
      this._speechStart = performance.now();
    };

    utt.onboundary = (e) => {
      if (e.name !== 'word') return;

      // Map e.charIndex (relative to `text`) back to our words array
      const baseOffset = this.words[this._startWordIdx]?.charIndex ?? 0;
      const absIdx     = baseOffset + e.charIndex;

      let wi = this.words.findIndex(w => w.charIndex === absIdx);
      if (wi < 0) wi = this.words.findIndex(w => Math.abs(w.charIndex - absIdx) <= 3);
      if (wi < 0) return;

      const word    = this.words[wi];
      word.startMs  = e.elapsedTime;

      // Previous word: now we know its REAL duration
      if (wi > 0 && this.words[wi - 1].startMs !== null) {
        const prev      = this.words[wi - 1];
        prev.realDurMs  = word.startMs - prev.startMs;
        this._updateCardTiming(wi - 1);
        this._scheduleWordVisemes(prev, prev.realDurMs);   // reschedule with real timing
      }

      // Current word: estimated timing until next boundary
      this._scheduleWordVisemes(word, word.visemes.length * EST_MS);

      // Update timeline
      this.curWordIdx = wi;
      this._cardEls.forEach((c, i) => {
        c.classList.toggle('active', i === wi);
        c.classList.toggle('done',   i < wi);
      });
      if (this._cardEls[wi])
        this._cardEls[wi].scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });

      document.getElementById('cur-word').textContent = word.word;
      this._setStatus(`Word ${wi + 1} / ${this.words.length}: "${word.word}"`);
    };

    utt.onend = () => {
      this._setPlay(false);
      this._setStatus('Done — click a card to step through');
      setTimeout(() => this.avatarView.setViseme('X'), 350);
    };

    utt.onerror = e => {
      if (e.error === 'canceled' || e.error === 'interrupted') return;
      console.warn('[SyncTest] TTS error:', e.error);
      this._stop();
    };

    this.synth.speak(utt);
  }

  /** Schedule viseme changes for `word` spread over `durationMs`. */
  _scheduleWordVisemes(word, durationMs) {
    // Cancel previous timers for this word
    word._timers.forEach(clearTimeout);
    word._timers = [];

    const n   = word.visemes.length;
    const now = performance.now() - this._speechStart;

    for (let i = 0; i < n; i++) {
      const atMs  = word.startMs + (i / n) * durationMs;
      const delay = Math.max(0, atMs - now);
      const vis   = word.visemes[i];
      const wi    = this.words.indexOf(word);
      word._timers.push(setTimeout(() => {
        if (!this.playing) return;
        this.avatarView.setViseme(vis);
        this._lightViseme(wi, vis);
      }, delay));
    }

    // Rest after word ends
    const endDelay = Math.max(0, word.startMs + durationMs - now) + 30;
    word._timers.push(setTimeout(() => {
      if (!this.playing) return;
      this.avatarView.setViseme('X');
    }, endDelay));
  }

  _updateCardTiming(wi) {
    const word = this.words[wi];
    if (!word?.realDurMs) return;
    const dt = document.getElementById(`durtext-${wi}`);
    if (dt) dt.innerHTML = `<span>${Math.round(word.realDurMs)}</span>ms`;
    const df = document.getElementById(`dur-${wi}`);
    if (df) df.style.width = '100%';
  }

  _stop() {
    this.synth.cancel();
    this.words.forEach(w => { w._timers.forEach(clearTimeout); w._timers = []; });
    this._setPlay(false);
    this.avatarView.setViseme('X');
    this._setStatus('Stopped');
  }

  // ── Speak single word ──────────────────────────────────────────────────────

  _speakCurrentWord() {
    if (!this.words.length) return;
    const word = this.words[this.curWordIdx];
    const n    = word.visemes.length;
    const dur  = Math.max(n * EST_MS, 280);
    this.synth.cancel();

    const utt = new SpeechSynthesisUtterance(word.word);
    utt.voice = this.voice; utt.rate = 0.88; utt.pitch = 0.78; utt.volume = 1.0;

    utt.onstart = () => {
      word.visemes.forEach((v, i) => {
        setTimeout(() => {
          this.avatarView.setViseme(v);
          this._lightViseme(this.curWordIdx, v);
        }, (i / n) * dur);
      });
      setTimeout(() => {
        this.avatarView.setViseme('X');
        document.getElementById('cur-vis-big').textContent = 'X';
        // Restore info panel to current word/syllable
        const syl = word.syllables[this.curSylIdx] ?? word.syllables[0];
        if (syl) this._refreshInfoPanel(word, syl);
      }, dur + 80);
    };

    this.synth.speak(utt);
    this._setStatus(`Speaking: "${word.word}"`);
  }

  // ── Status & utilities ─────────────────────────────────────────────────────

  _setStatus(msg) { document.getElementById('status').textContent = msg; }

  // ── Render loop ─────────────────────────────────────────────────────────────

  _loop() {
    let last = performance.now();
    const tick = () => {
      requestAnimationFrame(tick);
      const now = performance.now();
      const dt  = Math.min((now - last) / 1000, 0.05);
      last = now;
      this.avatarView.update(dt);
      this._refreshMorphBars();
    };
    tick();
  }
}

// ── Helper ─────────────────────────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Boot ───────────────────────────────────────────────────────────────────────
new SyncTestApp();

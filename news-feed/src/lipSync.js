/**
 * lipSync.js — Audio-driven lip sync using Rhubarb mouth cues
 *
 * The backend (server.js) generates a WAV with Windows SAPI TTS, then runs
 * Rhubarb Lip Sync on it to produce a precise array of mouth-shape cues:
 *   [ { start: number, end: number, value: "A"|"B"|…|"X" }, … ]
 *
 * Rhubarb mouth shapes map 1-to-1 onto our GLB shape keys:
 *   A = MBP (closed)        B = EE/IH (slightly open)
 *   C = EH/AE (open)        D = AI/AY (open)
 *   E = AA (wide open)      F = F/V (teeth on lip)
 *   G = OO/UH (rounded)     H = TH/L/K (slightly open)
 *   X = rest / silence
 *
 * SILENCE GUARANTEE:
 *   If the audio element is paused, ended, or not loaded, _cur is forced to
 *   "X" every single frame — no exceptions, no timers, no fallbacks.
 *   Lip movement is ONLY possible when audio.currentTime is advancing.
 */

const ALL_VIS  = ['A','B','C','D','E','F','G','H','X'];
const VIS_JAW  = { A:0.80, B:0.05, C:0.18, D:0.20, E:0.25, F:0.08, G:0.12, H:0.48, X:0.00 };

// Blend speeds — open quickly, close a bit faster (crisper return to rest)
const SPD_OPEN  = 12;
const SPD_CLOSE = 20;

export class LipSync {
  constructor() {
    this.mesh    = null;
    this._audio  = null;      // HTMLAudioElement — authoritative timing source
    this._cues   = [];        // [{start, end, value}] — sorted by time
    this._cueIdx = 0;         // cached forward-scan index
    this._cur    = 'X';
    this._smooth = Object.fromEntries(ALL_VIS.map(v => [v, v === 'X' ? 1 : 0]));
    this._jawS   = 0;
  }

  setMesh(m) { this.mesh = m; }

  /**
   * Called by speech.js once the server has responded with audio + cues.
   * @param {Array<{start:number,end:number,value:string}>} cues  Rhubarb output
   * @param {HTMLAudioElement} audio  The audio element that will be played
   */
  start(cues, audio) {
    this._dropAudio();          // release any previous audio element
    this._cues   = cues;
    this._cueIdx = 0;
    this._audio  = audio;
    this._cur    = 'X';
  }

  /** Called by speech.js on end / cancel / error. */
  stop() {
    this._dropAudio();
    this._cur = 'X';
  }

  _dropAudio() {
    if (this._audio) {
      this._audio.pause();
      this._audio.onended = null;
      this._audio.onerror = null;
      this._audio = null;
    }
    this._cues   = [];
    this._cueIdx = 0;
  }

  /**
   * Called every animation frame. dt = seconds since last frame.
   */
  update(dt) {
    if (!this.mesh) return;

    const audio   = this._audio;
    // "playing" = element exists AND is not paused AND has not ended
    const playing = audio && !audio.paused && !audio.ended;

    if (!playing) {
      // ── STRICT SILENCE ────────────────────────────────────────────────────
      this._cur = 'X';
    } else {
      // ── Lookup current Rhubarb cue by audio.currentTime ───────────────────
      const t = audio.currentTime;

      // Forward-scan the cached index (cues are time-ordered, audio advances)
      while (
        this._cueIdx < this._cues.length - 1 &&
        t >= this._cues[this._cueIdx + 1].start
      ) {
        this._cueIdx++;
      }

      const cue  = this._cues[this._cueIdx];
      this._cur  = (cue && t >= cue.start && t < cue.end) ? cue.value : 'X';
    }

    // ── Smooth morph-target blending ─────────────────────────────────────────
    const dict = this.mesh.morphTargetDictionary;
    const infl = this.mesh.morphTargetInfluences;
    if (!dict || !infl) return;

    for (const v of ALL_VIS) {
      const want = v === this._cur ? 1.0 : 0.0;
      const cur  = this._smooth[v];
      const spd  = want > cur ? SPD_OPEN : SPD_CLOSE;
      this._smooth[v] = cur + (want - cur) * Math.min(dt * spd, 1);
      const idx = dict[v];
      if (idx !== undefined) infl[idx] = this._smooth[v];
    }

    // Jaw helper (setJawOpen is a no-op in avatar.js but kept for extensibility)
    const av = this.mesh._avatar;
    if (av) {
      const jaw = VIS_JAW[this._cur] ?? 0;
      this._jawS += (jaw - this._jawS) * Math.min(dt * 9, 1);
      av.setJawOpen(this._jawS);
    }
  }
}

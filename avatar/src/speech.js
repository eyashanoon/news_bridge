/**
 * speech.js — Server-backed TTS + Rhubarb lip-sync
 *
 * POSTs text to the Express server (server.js on :3001, proxied via Vite at /api).
 * The server generates a WAV with Windows SAPI and analyses it with Rhubarb
 * Lip Sync, returning:
 *   { audioUrl: "/audio/uuid.wav", cues: [{start, end, value}], duration }
 *
 * We create an HTMLAudioElement, hand both the audio and the cues to LipSync,
 * then play. Lip movement is driven entirely by audio.currentTime — no timers.
 */
export class SpeechManager {
  /**
   * @param {{
   *   onStart?(text:string, cues:Array, audio:HTMLAudioElement):void,
   *   onEnd?():void
   * }} callbacks
   */
  constructor({ onStart, onEnd } = {}) {
    this.onStart  = onStart;
    this.onEnd    = onEnd;
    this.speaking = false;
    this._audio   = null;
    this._currentText = '';
    // Vite proxies /api and /audio to http://localhost:3001
    this._base = '';
  }

  /**
   * Send text to server, receive audio+cues, start playback.
   * @param {string} text
   */
  async speak(text) {
    text = String(text ?? '').trim();
    if (!text) return;

    // Cancel previous speech immediately (before await so UI stays responsive)
    this._cancel(false);   // false = don't fire onEnd yet

    this.speaking = true;
    this._currentText = text;

    try {
      const res = await fetch(`${this._base}/api/speak`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error(`Server error: ${res.status} ${res.statusText}`);
      const { audioUrl, cues } = await res.json();

      // If speak() was called again while we were waiting, abort silently
      if (!this.speaking || this._currentText !== text) return;

      // Create an HTMLAudioElement for the returned WAV
      const audio = new Audio(`${this._base}${audioUrl}`);
      audio.volume = 1.0;
      this._audio  = audio;

      audio.onended = () => {
        this.speaking     = false;
        this._audio       = null;
        this.onEnd?.();
      };

      audio.onerror = (e) => {
        console.error('[speech] Audio error', e);
        this.speaking = false;
        this._audio   = null;
        this.onEnd?.();
      };

      // Hand cues + audio element to LipSync BEFORE playing
      // so the first frame after play() can already look up cues
      this.onStart?.(text, cues, audio);

      await audio.play();

    } catch (err) {
      console.error('[speech] speak() error:', err);
      this.speaking = false;
      this._audio   = null;
      this.onEnd?.();
    }
  }

  /**
   * Stop current speech immediately.
   */
  cancel() {
    this._cancel(true);
  }

  _cancel(fireEnd = true) {
    if (this._audio) {
      this._audio.pause();
      this._audio.onended = null;
      this._audio.onerror = null;
      this._audio = null;
    }
    if (this.speaking) {
      this.speaking = false;
      if (fireEnd) this.onEnd?.();
    }
  }

  get isSpeaking() {
    return this.speaking;
  }
}

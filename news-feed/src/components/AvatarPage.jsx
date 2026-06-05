/**
 * AvatarPage.jsx — Reuses the original avatar modules (avatar.js, scene.js, speech.js, lipSync.js)
 * from the `avatar/` folder, adapted to work in the news-feed project.
 */
import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { createScene } from '../scene.js';
import { Avatar } from '../avatar.js';
import { SpeechManager } from '../speech.js';
import { LipSync } from '../lipSync.js';
import '../avatar-style.css';

const API_BASE = 'http://localhost:3001';

const ICON_PLAY = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
       stroke-linecap="round" stroke-linejoin="round">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>`;
const ICON_STOP = `
  <svg viewBox="0 0 24 24" fill="currentColor">
    <rect x="5" y="5" width="14" height="14" rx="2"/>
  </svg>`;

export default function AvatarPage() {
  const navigate = useNavigate();
  const canvasRef = useRef(null);
  const subtitleRef = useRef(null);
  const inputRef = useRef(null);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [showUI, setShowUI] = useState(false);
  const avatarRef = useRef(null);
  const lipSyncRef = useRef(null);
  const speechRef = useRef(null);
  const sceneRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    async function init() {
      try {
        const { renderer, scene, camera, controls } = createScene(canvas);
        sceneRef.current = { renderer, scene, camera, controls };

        const avatar = new Avatar(scene);
        const lipSync = new LipSync();
        const speech = new SpeechManager({
          base: API_BASE,
          onStart(text, cues, audio) {
            lipSync.start(cues, audio);
            if (subtitleRef.current) subtitleRef.current.textContent = text;
            setSpeaking(true);
          },
          onEnd() {
            lipSync.stop();
            setSpeaking(false);
            setTimeout(() => {
              if (subtitleRef.current) subtitleRef.current.textContent = '';
            }, 2500);
          },
        });

        avatarRef.current = avatar;
        lipSyncRef.current = lipSync;
        speechRef.current = speech;

        // Load avatar model
        const proxy = await avatar.load(null, (xhr) => {
          if (xhr.total && xhr.loaded) {
            const pct = Math.round((xhr.loaded / xhr.total) * 100);
            console.log(`[AvatarPage] Loading: ${pct}%`);
          }
        });
        if (proxy) lipSync.setMesh(proxy);

        setLoading(false);
      } catch (err) {
        console.error('[AvatarPage] Init error:', err);
        setLoadError(err.message || 'Failed to load avatar');
        setLoading(false);
      }
    }

    init();

    return () => {
      const s = sceneRef.current;
      if (s) {
        s.renderer?.dispose();
      }
    };
  }, []);

  // ── Render loop ──────────────────────────────────────────────────────────
  useEffect(() => {
    let animId;
    let lastTime = performance.now();

    function animate(now) {
      animId = requestAnimationFrame(animate);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = sceneRef.current;
      const av = avatarRef.current;
      const ls = lipSyncRef.current;

      if (s) {
        s.controls?.update();
        av?.update(dt);
        ls?.update(dt);
        s.renderer?.render(s.scene, s.camera);
      }
    }

    animate(performance.now());
    return () => cancelAnimationFrame(animId);
  }, []);

  const triggerSpeak = useCallback(() => {
    const speech = speechRef.current;
    if (!speech) return;

    if (speech.isSpeaking) {
      speech.cancel();
      return;
    }
    const text = inputRef.current?.value?.trim();
    if (!text) return;
    inputRef.current.value = '';
    speech.speak(text);
  }, []);

  const handleStart = useCallback(() => {
    setShowUI(true);
    // Play greeting
    const speech = speechRef.current;
    const avatar = avatarRef.current;
    if (speech && avatar) {
      avatar.setSmile?.(0.45);
      speech.speak("Good evening. Welcome to the broadcast. I'm your news presenter.");
      setTimeout(() => avatar.setSmile?.(0), 4500);
    }
  }, []);

  if (loadError) {
    return (
      <div style={{
        position: 'relative', width: '100%', height: '100%',
        background: '#0a0f1e', display: 'flex', alignItems: 'center',
        justifyContent: 'center', flexDirection: 'column', gap: '16px',
        color: '#fff', fontFamily: 'system-ui, sans-serif',
      }}>
        <div style={{ fontSize: '2rem' }}>❌</div>
        <p>{loadError}</p>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.9rem' }}>
          Make sure the avatar Express server is running on port 3001
        </p>
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: '#0a0f1e', overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <canvas
        ref={canvasRef}
        id="canvas"
        style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', display: 'block' }}
      />

      {loading && (
        <div id="loading" style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center', gap: '20px',
          background: '#0a0f1e', zIndex: 200,
        }}>
          <div className="loader-ring" />
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.95rem' }}>Loading assistant&hellip;</p>
        </div>
      )}

      {!loading && !showUI && (
        <div
          id="start-overlay"
          onClick={handleStart}
          style={{
            position: 'fixed', inset: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', cursor: 'pointer', zIndex: 100,
            background: 'rgba(10,15,30,0.55)', backdropFilter: 'blur(3px)',
          }}
        >
          <div className="start-content" style={{ textAlign: 'center', userSelect: 'none' }}>
            <div className="pulse-ring" style={{
              width: 72, height: 72, borderRadius: '50%', margin: '0 auto 24px',
              border: '2px solid rgba(124,106,247,0.6)',
              animation: 'pulse-ring 2s ease-in-out infinite',
            }} />
            <h2 style={{ fontSize: '2.2rem', fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              AI News Presenter
            </h2>
            <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '1.05rem' }}>
              Click anywhere to begin
            </p>
          </div>
        </div>
      )}

      {showUI && (
        <div id="ui" style={{
          position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
          justifyContent: 'flex-end', pointerEvents: 'none', zIndex: 10,
        }}>
          <div id="subtitle-wrap" style={{ display: 'flex', justifyContent: 'center', padding: '0 32px 14px' }}>
            <p
              ref={subtitleRef}
              id="subtitle"
              style={{
                maxWidth: 700, textAlign: 'center', fontSize: '1.15rem',
                lineHeight: 1.6, color: '#fff',
                textShadow: '0 2px 12px rgba(0,0,0,0.95)', minHeight: '1.6em',
              }}
            />
          </div>

          <div id="chat-bar" style={{
            pointerEvents: 'all', display: 'flex', gap: 12, alignItems: 'center',
            padding: '16px 24px 36px',
            background: 'linear-gradient(to top, rgba(10,15,30,0.92) 60%, transparent)',
          }}>
            <input
              ref={inputRef}
              id="user-input"
              type="text"
              placeholder="Type something for the avatar to say&hellip;"
              disabled={speaking}
              onKeyDown={(e) => { if (e.key === 'Enter') triggerSpeak(); }}
              style={{
                flex: 1, padding: '14px 18px', borderRadius: 14,
                border: '1px solid rgba(255,255,255,0.13)',
                background: 'rgba(255,255,255,0.06)', color: '#fff',
                fontSize: '1rem', fontFamily: 'inherit', outline: 'none',
                backdropFilter: 'blur(10px)',
                opacity: speaking ? 0.5 : 1, cursor: speaking ? 'not-allowed' : 'auto',
              }}
            />
            <button
              id="speak-btn"
              onClick={triggerSpeak}
              className={speaking ? 'speaking' : ''}
              style={{
                flexShrink: 0, width: 52, height: 52, borderRadius: '50%',
                border: 'none', cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                background: speaking ? '#e05c5c' : '#7c6af7', color: '#fff',
              }}
              dangerouslySetInnerHTML={{ __html: speaking ? ICON_STOP : ICON_PLAY }}
            />
          </div>
        </div>
      )}

      {/* Back button */}
      {showUI && (
        <div style={{ position: 'fixed', top: 16, left: 16, zIndex: 50 }}>
          <button
            onClick={() => navigate("/news")}
            style={{
              background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, color: '#fff', padding: '8px 16px', cursor: 'pointer',
              fontSize: '0.9rem', backdropFilter: 'blur(4px)',
            }}
          >
            ← Back
          </button>
        </div>
      )}
    </div>
  );
}
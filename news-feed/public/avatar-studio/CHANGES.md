# Avatar Studio — integration changes (session notes)

Summary of changes made to wire Avatar Studio into **news-feed** and fix TTS / Rhubarb lip-sync.

---

## 1. TTS 403 fix (`/api/tts-edge`)

**Problem:** Vite proxied all `/api/*` to the Java backend (`:8080`).  
`/api/tts-edge` does not exist there → **403 Forbidden**.

**Fix:**
- Added `news-feed/vite-plugins/avatarStudioApi.js` — dev middleware for:
  - `GET /api/tts-edge` — Edge neural TTS (`edge-tts-universal`)
  - `GET /api/azure-tts` — returns 503 (client falls back to Edge)
  - `POST /api/rhubarb` — Rhubarb lip-sync
  - `GET /api/tts` — Google TTS proxy (optional)
- Updated `news-feed/vite.config.js`:
  - Register `avatarStudioApi()` plugin
  - Proxy `bypass` so the routes above are **not** sent to Java

**Requires:** Restart `npm run dev` after config changes.

---

## 2. Rhubarb lip-sync (required, no silent fallback)

**Problem:**
- `rhubarb.exe` was copied without the `res/` acoustic models → Rhubarb failed
- Client-side WAV encoding was often invalid
- `rhubarb.js` silently fell back to **energy-based** mouth animation

**Fix:**
- Downloaded full packages:
  - Linux: `news-feed/tools/Rhubarb-Lip-Sync-1.14.0-Linux/` (`rhubarb` + `res/`)
  - Windows: `news-feed/tools/Rhubarb-Lip-Sync-1.14.0-Windows/` (`rhubarb.exe` + `res/`)
- `avatarStudioApi.js` picks the platform binary first (Linux on Linux, Windows on Windows)
- Server converts **MP3 → WAV** with `audio-decode` before running Rhubarb
- `rhubarb.js`: POST the **TTS MP3 blob** to `/api/rhubarb`; **throw** on failure (no energy fallback)
- `main.js`: status text `Analyzing lip sync…` during Rhubarb

**Dependency:** `edge-tts-universal`, `audio-decode` (devDependencies in `news-feed/package.json`).

---

## 3. AI Presenter popup (React)

**Problem:** Sidebar “AI Presenter” called `onOpenAvatar()` but `HomePage` never passed it; `AvatarPage` returned `null`.

**Fix:**
- `src/components/AvatarPage.jsx` — modal with `AvatarStudioFrame` iframe
- `src/pages/HomePage.jsx`:
  - `avatarOpen` state
  - `onOpenAvatar` / `isAvatarOpen` on `LeftSidebar`
  - Render `<AvatarPage open={…} onClose={…} />` (overlay, not full-page swap)

Uses existing CSS: `.modal-overlay`, `.avatar-modal-content`, `.avatar-modal-close` in `App.css`.

---

## 4. Lip Sync Lab frontend (`public/test.html` + `test.js`)

**Problem:** HTML was missing elements and styles that `test.js` expected → crashes / broken UI.

**Fix:**
- `test.html`: tab nav, `#phoneme-overlay`, `#emotion-toggle-test`, timeline/cue/manual-anim CSS, layout
- `test.js`:
  - `setPhonemeOverlay()` — safe overlay updates
  - `buildLipSyncCues()` from `rhubarb.js` (same pipeline as main avatar)
  - Timeline / active-cue UI fixes; mouth-lead slider wired to playback

**URL:** `/avatar-studio/public/test.html` (or Lip Sync Lab tab from `legacy.html`).

---

## File checklist

| File | Change |
|------|--------|
| `vite-plugins/avatarStudioApi.js` | **New** — TTS + Rhubarb dev APIs |
| `vite.config.js` | Plugin + proxy bypass |
| `public/avatar-studio/public/rhubarb.js` | MP3 → Rhubarb; no energy fallback |
| `public/avatar-studio/public/main.js` | Pass `audioBlob` to Rhubarb; status message |
| `src/components/AvatarPage.jsx` | Modal host for iframe |
| `src/pages/HomePage.jsx` | Popup wiring |
| `public/avatar-studio/public/test.html` | Lab UI + styles |
| `public/avatar-studio/public/test.js` | Lab logic + Rhubarb import |
| `tools/Rhubarb-Lip-Sync-1.14.0-Linux/` | **New** — full Rhubarb distribution (Linux) |
| `tools/Rhubarb-Lip-Sync-1.14.0-Windows/` | **New** — full Rhubarb distribution (Windows) |
| `avatar-studio-component/public/rhubarb.js` | Source: Rhubarb-only lip-sync (no energy fallback) |

---

## Quick test

1. `cd news-feed && npm run dev`
2. Open app → **AI Presenter** → type text → **Speak**
3. Console should show `[rhubarb] cues: N` (not energy fallback warning)
4. Lip Sync Lab: `/avatar-studio/public/test.html` → **Generate** → timeline + Play

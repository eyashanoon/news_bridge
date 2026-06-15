# Avatar System

## 1. Overview

The Avatar System is a self-contained **3D news presenter** built with Three.js, embedded in the News Feed web application via an iframe. It renders an animated character that can speak news text with lip-sync animation, gestures, and emotional expression.

| Property | Value |
|----------|-------|
| **Source package** | `avatar-studio-component/` |
| **Embedded copy** | `news-feed/src/avatar-studio-component/` |
| **Runtime assets** | `news-feed/public/avatar-studio/` |
| **React wrapper** | `AvatarStudioFrame.jsx` |
| **Integration point** | `news-feed/src/components/AvatarPage.jsx` |

---

## 2. Package Structure

```
avatar-studio-component/
├── src/
│   ├── AvatarStudioFrame.jsx    # React iframe wrapper
│   └── index.js                  # Barrel export
├── public/
│   ├── legacy.html               # Full embedded app entry
│   ├── main.js                   # App bootstrap
│   ├── scene.js                  # Three.js scene & character
│   ├── tts.js                    # Text-to-speech module
│   ├── lipsync.js                # Lip-sync animation driver
│   ├── rhubarb.js                # Rhubarb phoneme analyzer
│   ├── gestures.js               # Hand gesture choreography
│   ├── pose-studio.js            # Pose editor UI
│   ├── emotion.js                # Emotion analysis
│   ├── style.css                 # Stylesheet
│   └── character.glb             # 3D character model
├── README.md
├── SETUP.md
└── EXAMPLES.md
```

---

## 3. Avatar Rendering Pipeline

### 3.1 Scene Initialization

**File:** `public/scene.js` — `initScene(container)`

```
1. Create WebGLRenderer (antialias, shadow mapping, ACES tone mapping)
2. Create Scene with dark background (0x08080f)
3. Create PerspectiveCamera (FOV 40°)
4. Add OrbitControls for user camera manipulation
5. Setup lighting:
   - Ambient light (soft fill)
   - Directional light (key light with shadows)
   - Rim/back light
6. Load character.glb via GLTFLoader
7. Locate morphTarget mesh (mouth shapes)
8. Initialize bone animation system
9. Start render loop via requestAnimationFrame
```

### 3.2 3D Model Handling

**Model format:** GLB (binary glTF)

**Character rig:**
- Armature with named bones for head, neck, arms, fingers
- Morph targets (blend shapes) for mouth phonemes
- Rhubarb-compatible mouth shapes: `Basis, A, B, C, D, E, F, G, H, X`

**Bone animation sets:**
```javascript
PART_BONES = {
  L: [left arm + finger bones],
  R: [right arm + finger bones],
  H: ['DEF-spine004', 'DEF-spine006']  // head/neck
}
```

**Morph target idle state:**
```javascript
// 'X' = closed mouth (rest pose)
// 'Basis' = open mouth (NOT used as idle)
currentInfluences['X'] = 1;
```

### 3.3 Render Loop

```javascript
function animate() {
  requestAnimationFrame(animate);
  
  // Lerp morph target influences toward targets
  updateMorphTargets(delta);
  
  // Lerp bone rotations for gestures/poses
  updateBoneAnimations(delta);
  
  // Update right-screen canvas texture (news display)
  updateScreenTexture();
  
  controls.update();
  renderer.render(scene, camera);
}
```

---

## 4. Animation System

### 4.1 Lip-Sync Animation

**Files:** `lipsync.js`, `rhubarb.js`

Pipeline:
```
Text input
    │
    ▼
TTS generates audio (tts.js)
    │
    ▼
Rhubarb analyzes audio → phoneme timeline
  [{start: 0.0, end: 0.1, value: "A"}, ...]
    │
    ▼
lipsync.js maps phonemes → morph targets
  A→A, B→B, C→C, etc.
    │
    ▼
scene.setMorphTarget(name, influence)
    │
    ▼
Render loop lerps influences smoothly
```

**Morph target mapping:**
```javascript
const MORPH_NAMES = ['Basis', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'X'];
```

Each frame, current influence values lerp toward target values for smooth mouth movement.

### 4.2 Gesture System

**File:** `gestures.js`

- Choreographed hand/arm movements during speech
- Wave animation triggered on speech start
- Bone rotation targets with smooth lerp (`BONE_LERP = 4`)

```javascript
let _waveActive = false;
let _waveSide = 'R';  // waving hand
```

Gestures synchronized with speech events from TTS module.

### 4.3 Pose Studio

**File:** `pose-studio.js`

- UI for editing character poses
- Saves/restores bone rotation presets
- Used for customizing presenter stance

### 4.4 Emotion Analysis

**File:** `emotion.js`

- Analyzes text sentiment
- Adjusts character expression/animation intensity
- Can modify gesture selection based on content tone

---

## 5. Text-to-Speech Pipeline

**File:** `public/tts.js`

### 5.1 TTS Flow

```
User enters news text (or bound from feed)
    │
    ▼
POST /api/tts-edge (dev middleware)
    │
    ▼
Edge TTS or browser SpeechSynthesis API
    │
    ▼
Audio blob generated
    │
    ▼
POST /api/rhubarb (dev middleware)
    │
    ▼
Rhubarb Lip Sync CLI → phoneme JSON
    │
    ▼
lipsync.js drives morph targets in sync with audio playback
```

### 5.2 Dev Server Middleware

**File:** `news-feed/vite-plugins/avatarStudioApi.js`

Because the Java backend lacks TTS/Rhubarb endpoints, Vite dev server provides:

| Route | Purpose |
|-------|---------|
| `/api/tts-edge` | Microsoft Edge TTS synthesis |
| `/api/rhubarb` | Rhubarb lip-sync analysis |
| `/api/poses/*` | Pose preset save/load |

These routes bypass the Java proxy and are handled locally during development.

---

## 6. News Binding to Avatar Presentation

### 6.1 Current Integration

The avatar studio operates as a **standalone creative tool** within the news feed:

1. User opens AI Presenter from LeftSidebar
2. `AvatarPage` modal displays iframe with avatar studio
3. User manually enters text or uses studio UI to create presentation
4. Character speaks entered text with lip-sync

### 6.2 Potential News Feed Binding

Architecture supports binding via:

```javascript
// postMessage from parent React app to iframe
iframe.contentWindow.postMessage({
  type: 'SPEAK_NEWS',
  payload: {
    title: post.title,
    content: post.summary,
    language: 'en'
  }
}, '*');
```

The iframe `main.js` can listen for messages and trigger TTS pipeline automatically.

### 6.3 Right-Screen Display

**File:** `scene.js`

```javascript
let _rightScreenCanvas = null;  // Canvas texture on character's screen prop
let _rightScreenTex = null;
```

During speech, news headlines/text can be rendered onto an in-scene display panel on the character model, creating a "presenter with teleprompter" effect.

---

## 7. Rendering Lifecycle

```
1. User clicks "AI Presenter" in LeftSidebar
2. HomePage sets avatarModalOpen = true
3. AvatarPage renders modal overlay
4. AvatarStudioFrame creates iframe → /avatar-studio/public/legacy.html
5. legacy.html loads main.js
6. main.js calls initScene(container)
7. GLTFLoader fetches character.glb
8. Model added to scene, morph mesh identified
9. Render loop starts (60fps requestAnimationFrame)
10. User interacts: enter text, click "Speak"
11. TTS → Rhubarb → lip-sync animation plays
12. User closes modal (Escape or ✕ button)
13. iframe destroyed, WebGL context released
```

---

## 8. Frontend Integration

### 8.1 React Wrapper

**File:** `AvatarStudioFrame.jsx`

```jsx
export function AvatarStudioFrame({ src, title, width, height, sandbox, wrapperStyle }) {
  return (
    <iframe
      src={src}
      title={title}
      width={width}
      height={height}
      sandbox={sandbox}
      style={{ border: 'none', ...wrapperStyle }}
      allow="autoplay"
    />
  );
}
```

### 8.2 Modal Host

**File:** `news-feed/src/components/AvatarPage.jsx`

```jsx
<AvatarStudioFrame
  src="/avatar-studio/public/legacy.html"
  title="AI Presenter"
  width="100%"
  height="100%"
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
/>
```

- Escape key closes modal
- Click outside modal closes
- Full-screen modal overlay

### 8.3 Navigation Trigger

**File:** `news-feed/src/components/LeftSidebar.jsx`

```javascript
onOpenAvatar={() => setAvatarModalOpen(true)}
```

Also accessible via route `/news/avatar` (modal-driven, not separate page).

### 8.4 Static Asset Serving

Assets copied to `news-feed/public/avatar-studio/` for production serving. Vite serves these at `/avatar-studio/public/legacy.html`.

---

## 9. Interaction Logic

### 9.1 User Interactions

| Action | Handler |
|--------|---------|
| Enter text | Text input in legacy.html UI |
| Click Speak | Triggers TTS + lip-sync pipeline |
| Camera orbit | OrbitControls (mouse drag) |
| Zoom | Mouse wheel |
| Edit pose | Pose Studio UI panel |
| Close modal | Escape key or overlay click |

### 9.2 Audio Playback Sync

```javascript
// lipsync.js
audioElement.addEventListener('timeupdate', () => {
  const currentTime = audioElement.currentTime;
  const phoneme = getPhonemeAtTime(timeline, currentTime);
  setMorphTarget(phonemeToMorph(phoneme), 1.0);
});
```

Morph targets updated in real-time sync with audio playback position.

---

## 10. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| Three.js | 0.160.0 | 3D rendering (CDN import) |
| GLTFLoader | Three.js addon | Model loading |
| OrbitControls | Three.js addon | Camera control |
| Rhubarb Lip Sync | CLI tool | Phoneme extraction |
| Edge TTS | API | Speech synthesis |

---

## 11. Deployment Considerations

1. **Static assets** must be copied to `public/avatar-studio/` for production
2. **TTS/Rhubarb APIs** require dev middleware or separate backend deployment
3. **character.glb** model file must be accessible at expected path
4. **iframe sandbox** allows scripts and same-origin for postMessage
5. **Not available on mobile** — web-only feature (no Expo integration)

---

## 12. Inputs and Outputs

### Inputs
| Input | Source | Description |
|-------|--------|-------------|
| Text | User input or postMessage | News text to speak |
| Language | UI selection | TTS voice language |
| Pose presets | Pose Studio | Character stance |

### Outputs
| Output | Description |
|--------|-------------|
| Animated 3D character | WebGL canvas in iframe |
| Synthesized audio | TTS audio playback |
| Lip-sync animation | Morph target driven mouth movement |
| Gesture animation | Bone rotation driven arm movement |

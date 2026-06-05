# Avatar Studio Component Package

A complete, self-contained React component package for embedding the Avatar Studio (Three.js + Speech Animation) into any React project.

## 📦 What's Included

```
avatar-studio-component/
├── src/
│   ├── AvatarStudioFrame.jsx    # React component (drop-in ready)
│   └── index.js                  # Barrel export
├── public/
│   ├── legacy.html               # Full embedded app (served in iframe)
│   ├── main.js                   # App entry point
│   ├── scene.js                  # Three.js scene & character
│   ├── tts.js                    # Text-to-speech module
│   ├── lipsync.js                # Lip-sync animation driver
│   ├── rhubarb.js                # Rhubarb phoneme analyzer
│   ├── gestures.js               # Hand gesture choreography
│   ├── pose-studio.js            # Pose editor UI
│   ├── emotion.js                # Emotion analysis
│   ├── style.css                 # Stylesheet
│   └── *.js                      # Other support modules
├── README.md                     # This file
└── SETUP.md                      # Detailed setup instructions

```

## ⚡ Quick Start (2 minutes)

### 1. Copy the Folder

```bash
cp -r avatar-studio-component your-react-project/public/avatar-studio
```

### 2. Import & Use

```jsx
import { AvatarStudioFrame } from './components/AvatarStudioFrame';

export default function Dashboard() {
  return (
    <div>
      <h1>My Dashboard</h1>
      <AvatarStudioFrame 
        width="100%"
        height="600px"
        src="/avatar-studio/public/legacy.html"
      />
    </div>
  );
}
```

### 3. Add to Your App

Place the component **anywhere** in your React layout:

```jsx
// page.jsx
import { AvatarStudioFrame } from '@/components/AvatarStudioFrame';

export default function AvatarPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <header>
        <h1>Avatar Studio</h1>
        <p>Create animated character videos</p>
      </header>
      
      <AvatarStudioFrame 
        width="100%"
        height="calc(100vh - 200px)"
        wrapperStyle={{ borderRadius: '8px', overflow: 'hidden' }}
      />
    </div>
  );
}
```

## 🔧 Installation

### Option A: Next.js Project

```bash
# Copy the folder to your public directory
cp -r avatar-studio-component your-nextjs-project/public/avatar-studio

# Copy the React component
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-nextjs-project/app/components/
```

**Usage in a Next.js page:**

```jsx
// app/avatar/page.jsx
import { AvatarStudioFrame } from '@/components/AvatarStudioFrame';

export default function AvatarPage() {
  return (
    <AvatarStudioFrame 
      src="/avatar-studio/public/legacy.html"
      width="100%"
      height="100vh"
    />
  );
}
```

### Option B: Create React App (CRA)

```bash
# Copy the folder to your public directory
cp -r avatar-studio-component your-cra-project/public/avatar-studio

# Copy the React component
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-cra-project/src/components/
```

**Usage in a CRA app:**

```jsx
// src/pages/AvatarPage.jsx
import { AvatarStudioFrame } from '../components/AvatarStudioFrame';

export default function AvatarPage() {
  return (
    <AvatarStudioFrame 
      src="/avatar-studio/public/legacy.html"
      width="1024px"
      height="768px"
    />
  );
}
```

### Option C: Vite React Project

```bash
# Copy the folder
cp -r avatar-studio-component your-vite-project/public/avatar-studio

# Copy the component
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-vite-project/src/components/
```

**Usage:**

```jsx
// src/pages/Avatar.jsx
import { AvatarStudioFrame } from '../components/AvatarStudioFrame';

export default function Avatar() {
  return <AvatarStudioFrame src="/avatar-studio/public/legacy.html" />;
}
```

## 📋 Required Files

Ensure these files are in your `public/avatar-studio/public/` directory:

- ✅ `legacy.html` – Main app container
- ✅ `main.js` – App entry point
- ✅ `scene.js` – Three.js setup
- ✅ `tts.js` – Text-to-speech
- ✅ `lipsync.js` – Mouth animation
- ✅ `rhubarb.js` – Phoneme analysis
- ✅ `gestures.js` – Hand choreography
- ✅ `pose-studio.js` – Pose UI
- ✅ `emotion.js` – Emotion detection
- ✅ `style.css` – Styling
- ⚠️ `character.glb` – **YOU MUST ADD THIS** (see setup steps below)

## 🎨 Props Reference

```jsx
<AvatarStudioFrame
  src="/avatar-studio/public/legacy.html"    // URL to legacy app
  title="Avatar Studio"                      // Iframe title
  width="100%"                               // Width (string or number)
  height="600px"                             // Height (string or number)
  style={{ opacity: 0.95 }}                  // Extra iframe CSS
  wrapperStyle={{ 
    borderRadius: '8px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
  }}                                         // Wrapper div CSS
  className="my-avatar"                      // CSS class for wrapper
  sandbox="allow-scripts allow-same-origin"  // Iframe permissions
  allowFullscreen={true}                     // Enable fullscreen button
/>
```

## ⚙️ Configuration

### 1. Add character.glb

The character model is required for the app to work.

**Option A: Use your own model**
- Place a `character.glb` file in `public/avatar-studio/public/`
- Update `src="/avatar-studio/public/legacy.html"` if paths differ

**Option B: Download sample model**
- Get a sample from the original project
- Save to `public/avatar-studio/public/character.glb`

### 2. API Endpoints (Optional)

The legacy app expects these endpoints on the same domain:

```
GET  /api/poses/L              # Load left-hand poses
GET  /api/poses/R              # Load right-hand poses
GET  /api/poses/H              # Load head poses
POST /api/poses/L              # Save poses
POST /api/rhubarb              # Lip-sync analysis
GET  /api/tts-edge?q=...       # Text-to-speech
GET  /api/azure-tts?q=...      # Azure TTS (optional)
```

**Most projects can skip this** – the app gracefully degrades without these.

### 3. Environment Variables (Optional)

If using Azure Speech Service:

```env
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus
```

(Add these to your server-side config if proxying API calls)

## 🚀 Usage Examples

### Full Screen (Default)

```jsx
<AvatarStudioFrame src="/avatar-studio/public/legacy.html" />
```

### Sidebar Component

```jsx
<AvatarStudioFrame
  width="350px"
  height="400px"
  wrapperStyle={{ 
    borderRadius: '8px',
    border: '1px solid #ddd'
  }}
/>
```

### Modal

```jsx
<div style={{ 
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  width: '80vw',
  height: '80vh',
  background: 'white',
  borderRadius: '12px',
  boxShadow: '0 10px 40px rgba(0,0,0,0.3)',
  zIndex: 1000
}}>
  <AvatarStudioFrame 
    src="/avatar-studio/public/legacy.html"
    width="100%"
    height="100%"
  />
</div>
```

### Responsive Grid

```jsx
<div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
  <AvatarStudioFrame width="100%" height="500px" />
  <AvatarStudioFrame width="100%" height="500px" />
</div>
```

## ⚠️ Troubleshooting

### Iframe shows blank

- Check browser console for errors
- Verify `src` path is correct (relative to public folder)
- Ensure CORS headers are set if on different domain
- Check Network tab in DevTools – verify legacy.html loads

### Character model not loading

- Ensure `character.glb` is in `public/avatar-studio/public/`
- Check browser console: `'Could not load character.glb'`
- Verify file permissions

### TTS not working

- Audio requires user interaction first (click "Speak")
- Check browser autoplay policies
- Verify Rhubarb or Azure speech is configured

### Poses not saving

- Check Network tab for POST requests to `/api/poses/`
- Ensure your backend accepts and stores pose data
- Poses are stored in-memory by default

### Sandbox errors

If you see security errors, adjust sandbox permissions:

```jsx
<AvatarStudioFrame
  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
/>
```

## 🔐 Security Notes

The iframe is sandboxed with minimal permissions:
- ✅ Scripts allowed (Three.js needs this)
- ✅ Same-origin allowed (API calls)
- ✅ Forms allowed (pose saves)
- ❌ Top-level navigation blocked
- ❌ Plugins blocked
- ❌ Payment APIs blocked

This keeps the embedded app isolated from your main app.

## 📱 Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Mobile)

## 💡 Tips

1. **Lazy load the component** for better initial page load:
   ```jsx
   const AvatarStudio = lazy(() => import('./AvatarStudio'));
   ```

2. **Add loading state** while iframe loads:
   ```jsx
   <Suspense fallback={<div>Loading...</div>}>
     <AvatarStudioFrame />
   </Suspense>
   ```

3. **Customize styling** without modifying legacy.html:
   ```jsx
   <AvatarStudioFrame
     style={{ filter: 'hue-rotate(10deg)' }}
   />
   ```

4. **Hide nav tabs** by modifying CSS injection if needed

## 📞 Support

For issues:
1. Check the troubleshooting section
2. Verify all files are present
3. Check browser console for errors
4. Ensure `character.glb` is available

## 📄 License

This component wraps the Avatar Studio application. See the main project LICENSE for terms.

---

**Ready to integrate?** Copy the folder to your project and start using it!

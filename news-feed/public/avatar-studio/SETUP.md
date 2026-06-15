# Installation Guide

Step-by-step guide to install and use the Avatar Studio Component in your React project.

## Prerequisites

- React 16.8+ (Hooks compatible)
- A React project (Next.js, Create React App, Vite, etc.)
- The `character.glb` file (3D model - **download or provide your own**)

## Installation Steps

### Step 1: Copy the Component Files

Choose your project type:

#### For Next.js (App Router):
```bash
# Copy the entire folder to public/
cp -r avatar-studio-component your-nextjs-project/public/avatar-studio

# Create components directory if it doesn't exist
mkdir -p your-nextjs-project/app/components

# Copy the React component
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-nextjs-project/app/components/
```

#### For Create React App (CRA):
```bash
cp -r avatar-studio-component your-cra-project/public/avatar-studio
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-cra-project/src/components/
```

#### For Vite React:
```bash
cp -r avatar-studio-component your-vite-project/public/avatar-studio
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-vite-project/src/components/
```

### Step 2: Add Character Model

The app requires a 3D character model in glTF/GLB format.

**Option A: Get a sample model**
1. Find a free `.glb` character model (search "free 3d character glb")
2. Save it as `public/avatar-studio/public/character.glb`

**Option B: Use your own**
- Place your custom `character.glb` in `public/avatar-studio/public/`

### Step 3: Import and Use

In your React page/component:

```jsx
import { AvatarStudioFrame } from '@/components/AvatarStudioFrame';
// or: import { AvatarStudioFrame } from '../components/AvatarStudioFrame';

export default function MyPage() {
  return (
    <div>
      <h1>Avatar Studio</h1>
      <AvatarStudioFrame 
        src="/avatar-studio/public/legacy.html"
        width="100%"
        height="600px"
      />
    </div>
  );
}
```

## File Structure After Installation

Your project should look like this:

```
your-project/
├── public/
│   └── avatar-studio/
│       └── public/
│           ├── legacy.html
│           ├── main.js
│           ├── scene.js
│           ├── tts.js
│           ├── lipsync.js
│           ├── rhubarb.js
│           ├── gestures.js
│           ├── pose-studio.js
│           ├── emotion.js
│           ├── style.css
│           ├── recorder.js
│           ├── test.js
│           └── character.glb   ⚠️ REQUIRED - YOU ADD THIS
├── src/ (or app/ for Next.js)
│   ├── components/
│   │   └── AvatarStudioFrame.jsx
│   └── pages/
│       └── avatar.jsx
└── ...
```

## Troubleshooting Installation

### "Module not found" error
- Check file paths in the import statement
- Ensure `AvatarStudioFrame.jsx` is in the correct directory
- Use relative path if absolute imports aren't set up

### Blank iframe
- Verify `src="/avatar-studio/public/legacy.html"` path
- Check Network tab in browser DevTools
- Ensure public folder is being served

### "character.glb not found"
- Download or create a `.glb` file
- Place it in `public/avatar-studio/public/character.glb`
- Restart dev server

### CORS errors
- If avatar-studio is on a different domain, CORS headers must be set
- For same-domain, this usually works automatically

## Configuring API Endpoints (Optional)

If your app has its own backend for poses/TTS, update these in `public/avatar-studio/public/pose-studio.js`:

```javascript
// Change these URLs to your API endpoints:
const res = await fetch(`YOUR_API_URL/api/poses/${part}`);
```

Or use reverse proxy in your dev server config.

## Environment Variables (Optional)

For Azure Speech Service:

```env
AZURE_SPEECH_KEY=your_key_here
AZURE_SPEECH_REGION=eastus
```

These go in your main project's `.env` file, then proxy through your backend if needed.

## Verification Checklist

- ✅ Component file copied: `src/components/AvatarStudioFrame.jsx`
- ✅ All files in `public/avatar-studio/public/`:
  - ✅ legacy.html
  - ✅ main.js
  - ✅ scene.js, tts.js, lipsync.js, rhubarb.js, gestures.js, pose-studio.js, emotion.js
  - ✅ style.css
  - ✅ character.glb ⚠️ (download/provide yourself)
- ✅ Import statement in your page
- ✅ Dev server running
- ✅ No errors in browser console

## What's Next?

- Customize appearance with `wrapperStyle` prop
- Add to multiple pages
- Configure custom API endpoints
- Set up environment variables for TTS
- Read the main [README.md](README.md) for all props and examples

## Need Help?

1. Check the main README for prop documentation
2. Open browser DevTools → Console for errors
3. Verify file paths and folder structure
4. Ensure character.glb is present and valid

---

**Installation complete!** Your Avatar Studio is ready to use.

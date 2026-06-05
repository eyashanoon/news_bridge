# 📦 Avatar Studio Component Package

## ✅ Package Contents

Your ready-to-use component folder is complete:

```
avatar-studio-component/
├── 📄 README.md              ← START HERE: Full documentation
├── 📄 SETUP.md               ← Installation guide (step-by-step)
├── 📄 EXAMPLES.md            ← Copy-paste code examples
├── 📄 package.json           ← Dependencies & metadata
│
├── src/
│   ├── AvatarStudioFrame.jsx ← React component (use this!)
│   └── index.js              ← Barrel export
│
└── public/                   ← Embedded app files
    ├── legacy.html           ← Main app container
    ├── main.js               ← App entry point
    ├── scene.js              ← Three.js scene
    ├── tts.js                ← Text-to-speech
    ├── lipsync.js            ← Mouth animation
    ├── rhubarb.js            ← Phoneme analysis
    ├── gestures.js           ← Hand choreography
    ├── pose-studio.js        ← Pose editor UI
    ├── emotion.js            ← Emotion detection
    ├── style.css             ← Styling
    ├── recorder.js           ← Audio recording
    ├── test.js               ← Tests
    └── [character.glb]       ← ⚠️ YOU NEED TO ADD THIS
```

## 🚀 Quick Start (3 Steps)

### 1️⃣ Copy Folder to Your Project

```bash
# Copy to your React project's public folder
cp -r avatar-studio-component your-project/public/avatar-studio

# Copy the React component
cp avatar-studio-component/src/AvatarStudioFrame.jsx your-project/src/components/
```

### 2️⃣ Add Character Model

The app needs a 3D model file (`character.glb`):

```bash
# Place it in the public folder:
# your-project/public/avatar-studio/public/character.glb
```

**Don't have one?**
- Search for "free 3d character glb" online
- Download any `.glb` file and rename it `character.glb`
- Save to the location above

### 3️⃣ Use in Your React App

```jsx
import { AvatarStudioFrame } from '@/components/AvatarStudioFrame';

export default function MyPage() {
  return (
    <AvatarStudioFrame 
      src="/avatar-studio/public/legacy.html"
      width="100%"
      height="600px"
    />
  );
}
```

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| **README.md** | Complete feature documentation, props reference, examples |
| **SETUP.md** | Step-by-step installation for different project types |
| **EXAMPLES.md** | Copy-paste ready code examples (Next.js, CRA, Vite, etc.) |
| **package.json** | Dependencies and package metadata |

## ✨ Component Features

✅ **Drop-in ready** – Works in any React project  
✅ **Fully customizable** – Width, height, styling, position  
✅ **Isolated** – Sandboxed iframe (safe to embed)  
✅ **Responsive** – Works on desktop and mobile  
✅ **No code changes needed** – Original app logic untouched  
✅ **Easy integration** – Place it anywhere in your UI  

## 🎯 What Can You Do With It?

- Place on a dedicated page
- Embed in a dashboard
- Add to a sidebar panel
- Use in a modal
- Create multiple instances
- Customize size and styling
- Use in Next.js, React, Vite, CRA
- Deploy to any hosting platform

## ⚙️ What's Next?

1. **Read** → `README.md` (2-3 min read)
2. **Install** → `SETUP.md` (follow the steps for your project type)
3. **Copy Example** → `EXAMPLES.md` (pick your framework, copy-paste code)
4. **Add Model** → Download `character.glb` and place in the correct folder
5. **Test** → Run your dev server and see it work!

## 🔧 Component Props

```jsx
<AvatarStudioFrame
  src="/avatar-studio/public/legacy.html"    // URL to app
  title="Avatar Studio"                      // Iframe title
  width="100%"                               // Width
  height="600px"                             // Height
  style={{}}                                 // Iframe CSS
  wrapperStyle={{}}                          // Container CSS
  className="my-class"                       // CSS class
  allowFullscreen={false}                    // Fullscreen mode
/>
```

**All props are optional!** Defaults work out of the box.

## ⚠️ Important Notes

1. **Character model required** → Download/provide `character.glb` file
2. **Path must be correct** → `src="/avatar-studio/public/legacy.html"`
3. **Works in iframe** → Sandboxed for security (this is by design)
4. **Same-origin APIs** → Pose saves work on same domain by default
5. **User interaction required** → Audio needs user to click first

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| Blank iframe | Check `src` path, verify file exists |
| No character | Add `character.glb` to `public/avatar-studio/public/` |
| Audio not playing | User must click first (browser autoplay policy) |
| Module not found | Check file path in import statement |
| CORS errors | Same-domain setup usually works automatically |

See **README.md** for full troubleshooting guide.

## 📋 Installation Checklist

Before using the component, verify:

- [ ] Folder copied to your project
- [ ] `AvatarStudioFrame.jsx` in your components directory
- [ ] All files in `public/avatar-studio/public/`:
  - [ ] legacy.html
  - [ ] main.js, scene.js, tts.js, lipsync.js, rhubarb.js
  - [ ] gestures.js, pose-studio.js, emotion.js, style.css
  - [ ] recorder.js, test.js
- [ ] `character.glb` downloaded and placed in correct folder
- [ ] Import statement in your page: `import { AvatarStudioFrame } from ...`
- [ ] Dev server running
- [ ] No errors in browser console
- [ ] Iframe loads and shows character

## 🎓 Recommended Reading Order

1. **This file** (you're reading it now!) ✓
2. **README.md** – Learn what it does and all options
3. **SETUP.md** – Follow step-by-step for your project type
4. **EXAMPLES.md** – Copy code for your framework
5. Start building! 🚀

## 💡 Pro Tips

- **Lazy load** for better page performance
- **Add loading state** while iframe loads
- **Customize styling** with `wrapperStyle` prop
- **Use in multiple places** – component is reusable
- **Mobile friendly** – responsive by default

## 🤝 Support

**Problem?** → Check README.md troubleshooting section  
**Want examples?** → See EXAMPLES.md  
**Need help installing?** → Follow SETUP.md step-by-step  
**Questions about props?** → README.md has full API documentation  

## 📄 License

This component wraps the Avatar Studio application. See main project LICENSE for terms.

---

## 🎉 You're All Set!

The component is **production-ready** and **fully documented**.

**Next step:** Open `SETUP.md` and follow the installation instructions for your project type.

**Happy coding!** 🚀

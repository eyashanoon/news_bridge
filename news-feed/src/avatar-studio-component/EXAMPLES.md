# Integration Examples

Quick copy-paste examples for different React frameworks.

## Next.js (App Router)

**File: `app/avatar/page.jsx`**

```jsx
'use client';

import { AvatarStudioFrame } from '@/components/AvatarStudioFrame';

export default function AvatarPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', padding: '2rem' }}>
      <header>
        <h1>🎬 Avatar Studio</h1>
        <p>Create animated character videos with AI</p>
      </header>

      <AvatarStudioFrame
        src="/avatar-studio/public/legacy.html"
        width="100%"
        height="calc(100vh - 300px)"
        wrapperStyle={{
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        }}
      />
    </div>
  );
}
```

## Create React App (CRA)

**File: `src/pages/AvatarPage.jsx`**

```jsx
import { AvatarStudioFrame } from '../components/AvatarStudioFrame';

export default function AvatarPage() {
  return (
    <div className="avatar-page">
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

**File: `src/App.jsx`** (if using as main component):

```jsx
import { AvatarStudioFrame } from './components/AvatarStudioFrame';
import './App.css';

function App() {
  return (
    <div className="App">
      <AvatarStudioFrame src="/avatar-studio/public/legacy.html" />
    </div>
  );
}

export default App;
```

## Vite React

**File: `src/pages/Avatar.jsx`**

```jsx
import { AvatarStudioFrame } from '../components/AvatarStudioFrame';

export default function Avatar() {
  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <AvatarStudioFrame src="/avatar-studio/public/legacy.html" />
    </div>
  );
}
```

## Within a Dashboard

**File: `src/components/Dashboard.jsx`**

```jsx
import { AvatarStudioFrame } from './AvatarStudioFrame';
import { useState } from 'react';

export default function Dashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: sidebarOpen ? '250px' : '0px', overflow: 'hidden' }}>
        <nav>Navigation items...</nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <header>Dashboard</header>
        
        <div style={{ flex: 1 }}>
          <AvatarStudioFrame
            src="/avatar-studio/public/legacy.html"
            width="100%"
            height="100%"
          />
        </div>
      </main>
    </div>
  );
}
```

## With Responsive Sizing

```jsx
import { AvatarStudioFrame } from './AvatarStudioFrame';
import { useEffect, useState } from 'react';

export default function ResponsiveAvatar() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <AvatarStudioFrame
      width={isMobile ? '100%' : '800px'}
      height={isMobile ? '500px' : '600px'}
      wrapperStyle={{
        margin: '0 auto',
        borderRadius: isMobile ? '0px' : '8px',
      }}
    />
  );
}
```

## As a Modal

```jsx
import { useState } from 'react';
import { AvatarStudioFrame } from './AvatarStudioFrame';

export default function AvatarModal() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button onClick={() => setOpen(true)}>Open Avatar Studio</button>

      {open && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
        }}>
          <div style={{
            width: '90vw',
            height: '90vh',
            background: 'white',
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '1rem',
              borderBottom: '1px solid #eee',
            }}>
              <h2>Avatar Studio</h2>
              <button onClick={() => setOpen(false)}>✕ Close</button>
            </div>

            <div style={{ flex: 1 }}>
              <AvatarStudioFrame
                src="/avatar-studio/public/legacy.html"
                width="100%"
                height="100%"
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

## With Lazy Loading

```jsx
import { lazy, Suspense } from 'react';

const AvatarStudioFrame = lazy(() =>
  import('./AvatarStudioFrame').then(mod => ({ default: mod.AvatarStudioFrame }))
);

export default function LazyAvatar() {
  return (
    <Suspense fallback={<div>Loading Avatar Studio...</div>}>
      <AvatarStudioFrame src="/avatar-studio/public/legacy.html" />
    </Suspense>
  );
}
```

## In a Tab Component

```jsx
import { useState } from 'react';
import { AvatarStudioFrame } from './AvatarStudioFrame';

export default function TabbedInterface() {
  const [activeTab, setActiveTab] = useState('avatar');

  return (
    <div>
      <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid #ddd' }}>
        <button
          onClick={() => setActiveTab('avatar')}
          style={{ background: activeTab === 'avatar' ? '#4a4aff' : 'transparent' }}
        >
          Avatar Studio
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          style={{ background: activeTab === 'settings' ? '#4a4aff' : 'transparent' }}
        >
          Settings
        </button>
      </div>

      {activeTab === 'avatar' && (
        <AvatarStudioFrame
          src="/avatar-studio/public/legacy.html"
          width="100%"
          height="600px"
        />
      )}

      {activeTab === 'settings' && (
        <div>Settings content...</div>
      )}
    </div>
  );
}
```

## With Custom Styling

```jsx
import { AvatarStudioFrame } from './AvatarStudioFrame';

export default function StyledAvatar() {
  return (
    <div className="avatar-container">
      <AvatarStudioFrame
        src="/avatar-studio/public/legacy.html"
        width="100%"
        height="600px"
        className="custom-avatar"
        wrapperStyle={{
          border: '3px solid #4a4aff',
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 0 20px rgba(74, 74, 255, 0.3)',
          transition: 'all 0.3s ease',
        }}
        style={{
          filter: 'drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2))',
        }}
      />
    </div>
  );
}
```

---

Copy any of these examples and customize to fit your project!

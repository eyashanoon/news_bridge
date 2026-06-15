# News Bridge — Frontend Applications Overview

## 1. Introduction

News Bridge exposes three active client applications plus an embeddable avatar component. All consumers communicate with the Spring Boot backend on port 8080; the news feed additionally integrates with the AI Assistant service on port 9000.

| Application | Path | Port | Purpose |
|-------------|------|------|---------|
| Admin Frontend | `frontend/` | 5173 | Administration console + legacy public feed |
| News Feed Web | `news-feed/` | 5174 | Primary consumer platform |
| Mobile App | `news-feed/mobile/` | Expo | Mobile consumer experience |
| Avatar Studio | `avatar-studio-component/` | iframe | 3D news presenter |

---

## 2. Admin Frontend (`frontend/`)

### 2.1 Technology Stack

- React 19, Vite 8, React Router 7, axios
- Entry: `frontend/src/main.jsx` → `App.jsx`
- No API proxy; direct calls to `http://localhost:8080`

### 2.2 Routing Structure

| Route | Component | Access |
|-------|-----------|--------|
| `/admin/login` | `AdminLoginPage.jsx` | Public |
| `/admin` | `DashboardPage.jsx` | ADMIN |
| `/admin/admins` | `AdminsPage.jsx` | ADMIN + roles |
| `/admin/users` | `UsersPage.jsx` | ADMIN + `MANAGE_USERS` |
| `/admin/articles` | `ArticlesPage.jsx` | ADMIN + article roles |
| `/admin/roots`, `/admin/endpoints` | `SourcesPage.jsx` | ADMIN |
| `/admin/crawler` | `CrawlerPage.jsx` | ADMIN |
| `/admin/telegram` | `TelegramPage.jsx` | ADMIN |
| `/admin/topics`, `/admin/fields` | `TopicsFieldsPage.jsx` | ADMIN |
| `/admin/editor-requests` | `EditorRequestsPage.jsx` | ADMIN |
| `/` | `FeedPage.jsx` | Public (legacy article feed) |
| `/auth/login`, `/auth/signup` | `AuthPage.jsx` | Public |
| `/editor/workspace` | `EditorPage.jsx` | EDITOR |

**Navigation config:** `frontend/src/admin/constants/navConfig.js`  
**Layout shell:** `frontend/src/admin/layout/AdminLayout.jsx`

### 2.3 State Management

No global store (Redux/Zustand). Uses React Context:

| Context | File | State |
|---------|------|-------|
| `SessionContext` | `frontend/src/context/SessionContext.jsx` | JWT session, booting, logout |

**Token storage:** Cookie `fp_token` via `frontend/src/auth.js`

**Local hooks:** `useTableState.js`, `useDebouncedValue.js`, `useConfirmDialog.jsx`

### 2.4 API Communication

**Base client:** `frontend/src/api.js` — axios with `authConfig(token)` Bearer headers.

**Admin services** (`frontend/src/admin/services/`):

| Service | Endpoints |
|---------|-----------|
| `dashboardService.js` | `GET /api/admin/dashboard/stats` |
| `adminsService.js` | Admin users, activity logs, analytics |
| `usersService.js` | User management, analytics |
| `articlesService.js` | `/articles/admin`, blocks |
| `rootsService.js` | `/roots`, `/endpoints` |
| `crawlerService.js` | Crawler + Telegram crawler control |
| `telegramService.js` | Telegram channels and posts |

**Pattern:** Page → feature component → service → `api.get/post(..., authConfig(session.token))`

### 2.5 Key Admin Features

| Feature | Components |
|---------|------------|
| Dashboard | `DashboardOverview.jsx`, analytics charts |
| User management | `ManageUsers.jsx`, `ManageAdmins.jsx` |
| Content | `ManageTopics.jsx`, `ManageFields.jsx`, `ManageArticles.jsx` |
| Infrastructure | `ManageRoots.jsx`, `ManageEndpoints.jsx`, `ManageCrawler.jsx` |
| Telegram | `ManageTelegram.jsx`, `TelegramCrawlerPanel.jsx` |
| Design system | `frontend/src/admin/design-system/` |

### 2.6 Admin User Journey

1. Navigate to `/admin/login`
2. `POST /auth/admin/login` → JWT stored in cookie
3. Dashboard shows aggregate stats from `/api/admin/dashboard/stats`
4. Sources page: register roots, trigger endpoint discovery, manage endpoints
5. Crawler page: start/stop site crawler, view logs, run individual endpoints
6. Telegram page: manage channels, control Telegram crawler
7. Users page: search registered/editor users, modify roles and status

---

## 3. News Feed Web Application (`news-feed/`)

### 3.1 Technology Stack

- React 19, Vite 7, Tailwind CSS 4, i18next, framer-motion, Three.js
- Entry: `news-feed/src/main.jsx`
- Dev proxy: `/api`, `/auth` → `:8080`; `/ai` → `:9000`

### 3.2 Routing Structure

Most navigation uses a **single-page hub pattern** on `HomePage.jsx`:

| Route | Handler | View |
|-------|---------|------|
| `/` | Redirect → `/news` | |
| `/news` | `HomePage.jsx` | Main feed |
| `/news/trending` | HomePage | Trending topics |
| `/news/saved` | HomePage | Saved posts (localStorage) |
| `/news/telegram` | HomePage | Telegram feed |
| `/news/topics/:topicId` | HomePage | Topic detail |
| `/news/category/:categoryName` | HomePage | Category filter |
| `/news/avatar` | HomePage | Avatar modal |
| `/auth/*` | `AuthPage.jsx` | Login/signup with device fingerprint |
| `/profile/:username` | `ProfilePage.jsx` | User profile |
| `/editor/workspace` | `EditorPage.jsx` | EDITOR only |

**Layout:** `SiteLayout.jsx` — header with SearchBar, LanguageToggle, dark mode.

**Three-column grid:** LeftSidebar | Feed content | AI panel (ChatWidget + NewsBrief)

### 3.3 State Management

| Layer | File | Responsibility |
|-------|------|----------------|
| `SessionContext` | `context/SessionContext.jsx` | JWT; auto guest via `POST /auth/limited` |
| `ThemeContext` | `context/ThemeContext.jsx` | Dark mode + category CSS variables |
| i18n | `i18n/i18n.js` | EN/AR, RTL, `newsbridge_lang` in localStorage |
| Component state | HomePage, Feed, ChatWidget | Posts, pagination, modals, selected post |

### 3.4 API Communication Patterns

**Dual HTTP strategy:**

1. **axios** (`api.js`) — authenticated POSTs (topic creation)
2. **fetch wrapper** (`utils/apiFetch.js`) — auto-attaches Bearer, handles 401 logout

**Domain APIs:**
- `api/searchApi.js` — `/api/posts/search`
- `api/topicsApi.js` — `/api/topics`, editor requests

**AI integration:**
- `utils/aiFetch.js` — base `/ai` (dev proxy) or `VITE_AI_BASE_URL`
- `ChatWidget.jsx` → `POST /query`
- `NewsBrief.jsx` → `POST /news-brief`

**Auth:** `utils/auth.js` — localStorage keys + cookie `nf_token`

**Avatar dev APIs:** `vite-plugins/avatarStudioApi.js` — TTS, Rhubarb lip-sync (local middleware)

### 3.5 Key Components

| Component | Role |
|-----------|------|
| `Feed.jsx` | Infinite scroll via `/api/feed` |
| `TelegramFeed.jsx` | `/api/telegram/feed` |
| `TrendingTopics.jsx` | Topic list with stats |
| `TopicDetails.jsx` | Single topic + associated posts |
| `LeftSidebar.jsx` | Navigation, geolocation (Nominatim), avatar trigger |
| `SearchBar.jsx` | Search + post modal event dispatch |
| `Post.jsx`, `PostModal.jsx` | Post display and detail |
| `ChatWidget.jsx` | AI Q&A sidebar with post context |
| `NewsBrief.jsx` | AI-generated personalized summary |
| `AvatarPage.jsx` | Modal embedding avatar iframe |
| `CategoryBar.jsx` | General, Politics, Sports, etc. |
| `SavedNews.jsx` | Local saved posts |
| `GuestSignupPrompt.jsx` | Guest-to-registered upsell |

### 3.6 User Journeys

**Guest browsing:**
1. App boot → `POST /auth/limited` → PRIMITIVE session
2. Browse `/news` with category filters
3. Optional location detection for geo-aware feed

**Registered user:**
1. Signup/login at `/auth/signup` or `/auth/login`
2. Personalized feed with preference-weighted content
3. React to posts, save locally, comment
4. Apply for editor role at `/apply-editor`

**AI interaction:**
1. Click "Ask AI" on post → ChatWidget receives `selectedPost`
2. `aiFetch("/query", { query, postId })` → RAG answer
3. NewsBrief panel auto-fetches on mount/language change

**Avatar presenter:**
1. LeftSidebar → "AI Presenter"
2. Opens `AvatarPage` modal
3. iframe loads `/avatar-studio/public/legacy.html`
4. Three.js character with TTS narration

**Internationalization:**
1. LanguageToggle switches EN/AR
2. Document direction flips to RTL for Arabic
3. AI brief requests Arabic generation when language set

---

## 4. Mobile Application (`news-feed/mobile/`)

### 4.1 Technology Stack

- Expo 56, React Native 0.85, React Navigation 7
- Entry: `news-feed/mobile/index.js` → `App.js`
- Config: `news-feed/mobile/app.json`

### 4.2 Navigation (React Navigation Stack)

| Screen | Component |
|--------|-----------|
| `NewsFeed` | `src/pages/HomePage.jsx` (default) |
| `Auth` | `src/pages/AuthPage.jsx` |
| `AdvancedSearch` | `src/pages/AdvancedSearchPage.jsx` |
| `TrendingTopics` | `src/pages/TrendingTopicsPage.jsx` |
| `TopicDetails` | `src/pages/TopicDetailsPage.jsx` |
| `SavedNews` | `src/pages/SavedNewsPage.jsx` |
| `AIAssistant` | `src/pages/AIAssistantPage.jsx` |
| `ApplyEditor` | `src/pages/ApplyEditorPage.jsx` |
| `Profile` | `src/pages/ProfilePage.jsx` |

**Drawer navigation:** `LeftSidebar.jsx` via `ThemeContext.menuOpen`

### 4.3 State & API

| Context | File |
|---------|------|
| `SessionContext` | AsyncStorage token, guest bootstrap with fetch timeout |
| `ThemeContext` | Dark mode, category, menuOpen |

**API config:** `src/api/config.js` — host `192.168.1.29` (Android) / `localhost` (iOS), port 8080

**AI:** Direct to `http://{host}:9000` in `AIAssistantPage.jsx` (no Vite proxy)

### 4.4 Mobile vs Web Parity

| Feature | Web | Mobile |
|---------|-----|--------|
| Feed API | `/api/feed` | `/api/feed` |
| AI Q&A | ChatWidget sidebar | AIAssistantPage |
| Avatar | iframe modal | Not available |
| Auth storage | localStorage + cookie | AsyncStorage |
| i18n | EN/AR + RTL | EN/AR |

---

## 5. Avatar Studio Component

Three copies exist in the repository:

| Copy | Path |
|------|------|
| Standalone package | `avatar-studio-component/` |
| Vendored in news-feed | `news-feed/src/avatar-studio-component/` |
| Runtime assets | `news-feed/public/avatar-studio/` |

**React wrapper:** `AvatarStudioFrame.jsx` — iframe with sandbox permissions pointing to `legacy.html`.

**Core modules** (in `public/`):

| File | Purpose |
|------|---------|
| `scene.js` | Three.js 3D character rendering |
| `tts.js` | Text-to-speech |
| `lipsync.js`, `rhubarb.js` | Lip-sync animation |
| `gestures.js` | Hand gesture choreography |
| `emotion.js` | Emotion analysis |
| `pose-studio.js` | Pose editor UI |

See `avatar_system.md` for full rendering pipeline documentation.

---

## 6. Cross-Application Comparison

| Concern | Admin (`frontend/`) | News Feed (`news-feed/`) | Mobile |
|---------|---------------------|--------------------------|--------|
| Router | React Router URL paths | HomePage sub-routing | React Navigation stack |
| Auth token | Cookie `fp_token` | localStorage + `nf_token` | AsyncStorage |
| Guest mode | Manual login prompt | Auto `POST /auth/limited` | Auto guest bootstrap |
| Feed API | `/articles/ids` (legacy) | `/api/feed` (personalized) | `/api/feed` |
| AI integration | None | ChatWidget + NewsBrief | AIAssistantPage |
| i18n | None | EN/AR + RTL | EN/AR |
| Admin features | Full console | None | None |

---

## 7. Vite Development Proxy (News Feed)

From `news-feed/vite.config.js`:

```javascript
proxy: {
  '/api': 'http://localhost:8080',
  '/auth': 'http://localhost:8080',
  '/ai': 'http://localhost:9000'  // AI Assistant service
}
```

Avatar TTS/Rhubarb routes handled by custom plugin `vite-plugins/avatarStudioApi.js` (not proxied to Java).

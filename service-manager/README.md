# News Bridge — Service Manager

Desktop app to start, stop, and monitor all News Bridge services. Each running service gets its own embedded terminal tab.

## Requirements

- [Node.js](https://nodejs.org/) 18+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for MySQL)
- Java / Maven, Python, npm — same as running the project manually

## Install

```powershell
cd c:\Users\eyash\news_bridge\service-manager
npm install
```

The first `npm install` runs `electron-rebuild` for `node-pty` (native terminal support on Windows).

## Run

```powershell
npm start
```

## Services

| Service | Port | Command |
|---------|------|---------|
| MySQL | 3307 | `docker compose up mysql` |
| Spring Boot API | 8080 | `mvn spring-boot:run` |
| Site Crawler | 8000 | `uvicorn` on `crawler_server` |
| Endpoint Discovery | 8004 | `uvicorn endpoint_discovery.service:app` in `backend` |
| Telegram Crawler | 8200 | `uvicorn` on `telegram_crawler` |
| Admin Frontend | 5173 | `npm run dev` in `frontend/` |
| News Feed | 5174 | `npm run dev -- --port 5174` |
| AI Assistant | 9000 | `uvicorn` on `ai-assistant-service` |
| Ollama | 11434 | `ollama serve` |

Edit commands in `electron/services.json`.

## Usage

- **Start** — launches the service in a new terminal tab
- **Stop** — kills the process
- **Restart** — stop then start
- **Terminal** — switch to that service's tab
- **Start Core Stack** — starts MySQL → Backend → Crawlers → Admin in order
- **Stop All** — stops every managed process

Status badges:
- **Healthy** — health check passed (port/HTTP reachable)
- **Running** — managed by this app but health check not yet green
- **Stopped** — not running

## Troubleshooting

**Start button does nothing**

1. Close any old Service Manager windows and run `npm start` again.
2. A red error banner at the top shows the exact failure (e.g. missing directory, spawn error).
3. DevTools opens automatically in dev mode — check the Console tab for errors.

**`node-pty` build fails**

```powershell
npm install --global windows-build-tools
npm rebuild node-pty
```

**Service won't start**

Check that `docker`, `mvn`, `python`, `npm`, and `ollama` are on your PATH in PowerShell.

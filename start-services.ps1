$Root = $PSScriptRoot
$Tmp  = "$env:TEMP\news-bridge-services"

New-Item -ItemType Directory -Force -Path $Tmp | Out-Null

Set-Content "$Tmp\springboot.ps1" "Set-Location '$Root\backend'`nmvn spring-boot:run"
Set-Content "$Tmp\crawler.ps1"   "Set-Location '$Root\backend\crawler_server'`npython -m uvicorn main:app --port 8000 --host 0.0.0.0 --reload"
Set-Content "$Tmp\discovery.ps1" "Set-Location '$Root\backend'`npython -m uvicorn endpoint_discovery.service:app --port 8004 --host 0.0.0.0"
Set-Content "$Tmp\telegram.ps1"  "Set-Location '$Root\backend\telegram_crawler'`npython -m uvicorn main:app --port 8200 --host 0.0.0.0 --reload"
Set-Content "$Tmp\frontend.ps1"  "Set-Location '$Root\frontend'`nnpm run dev"
Set-Content "$Tmp\newsfeed.ps1"  "Set-Location '$Root\news-feed'`nnpm run dev -- --port 5174"
Set-Content "$Tmp\ai.ps1"        "Set-Location '$Root\backend\ai-assistant-service'`npython -m uvicorn main:app --port 9000 --host 0.0.0.0 --reload"

Write-Host "Starting MySQL (Docker)..." -ForegroundColor Cyan
docker compose -f "$Root\backend\docker-compose.yml" up -d mysql

$bat = "@echo off`r`n"
$bat += "wt "
$bat += "new-tab --title ""Spring Boot""        -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\springboot.ps1"" "
$bat += "; new-tab --title ""Crawler Server""     -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\crawler.ps1"" "
$bat += "; new-tab --title ""Telegram Crawler""   -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\telegram.ps1"" "
$bat += "; new-tab --title ""Endpoint Discovery"" -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\discovery.ps1"" "
$bat += "; new-tab --title ""Frontend Admin""     -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\frontend.ps1"" "
$bat += "; new-tab --title ""News Feed""          -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\newsfeed.ps1"" "
$bat += "; new-tab --title ""AI Assistant""      -- powershell -NoExit -ExecutionPolicy Bypass -File ""$Tmp\ai.ps1"""
Set-Content "$Tmp\launch.bat" $bat

Write-Host "Opening services in Windows Terminal tabs..." -ForegroundColor Cyan
Start-Process "$Tmp\launch.bat"
Write-Host "All services launched." -ForegroundColor Green

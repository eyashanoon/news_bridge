# Free News Bridge dev ports left behind by crashed or orphaned processes.
# Usage: .\free-ports.ps1          # AI + Ollama only
#        .\free-ports.ps1 -All    # All managed service ports

param([switch]$All)

$Ports = if ($All) {
    @(3307, 5173, 5174, 8000, 8001, 8002, 8004, 8080, 8200, 9000, 9001, 11434)
} else {
    @(9000, 11434)
}

function Stop-PortListeners([int]$Port) {
    $pids = @()
    netstat -ano -p tcp | ForEach-Object {
        if ($_ -match "LISTENING" -and $_ -match ":$Port\s") {
            $parts = $_ -split '\s+'
            $pid = [int]$parts[-1]
            if ($pid -gt 0) { $pids += $pid }
        }
    }
    $pids = $pids | Select-Object -Unique
    foreach ($pid in $pids) {
        Write-Host "Killing PID $pid (port $Port)..." -ForegroundColor Yellow
        taskkill /PID $pid /T /F 2>$null | Out-Null
    }
    return $pids.Count
}

Write-Host "Stopping Ollama tray app (if running)..." -ForegroundColor Cyan
taskkill /IM "ollama app.exe" /F /T 2>$null | Out-Null
taskkill /IM ollama.exe /F /T 2>$null | Out-Null

foreach ($port in $Ports) {
    $killed = Stop-PortListeners $port
    if ($killed -eq 0) {
        Write-Host "Port $port is free." -ForegroundColor Green
    }
}

Write-Host "Done." -ForegroundColor Green

# One-time setup for discovery/crawler anti-bot fetching.
# Uses the same Python that runs the backend services.
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

Write-Host "Python:" -NoNewline
python -c "import sys; print(' ' + sys.executable)"

Write-Host "Installing fetch dependencies..."
python -m pip install curl_cffi playwright brotli

Write-Host "Installing Playwright Chromium browser..."
python -m playwright install chromium

Write-Host "Verifying fetch stack..."
python -c "import sys; sys.path.insert(0,'endpoint_discovery'); from service import _fetch_stack_status; import json; print(json.dumps(_fetch_stack_status(), indent=2))"

Write-Host "Done. Restart the discovery service."

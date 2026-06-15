$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir
python -m uvicorn main:app --port 8200 --host 0.0.0.0 --reload

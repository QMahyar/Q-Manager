# Telethon Worker Build Script (Windows)
param(
    [string]$OutputDir = "",
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

function Write-Info { Write-Host "[INFO] $args" -ForegroundColor Cyan }
function Write-Success { Write-Host "[SUCCESS] $args" -ForegroundColor Green }
function Write-Warn { Write-Host "[WARN] $args" -ForegroundColor Yellow }
function Write-Err { Write-Host "[ERROR] $args" -ForegroundColor Red }

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$WorkerRoot = Split-Path -Parent $ScriptDir
$WorkerScript = Join-Path $ScriptDir "telethon_worker.py"

if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
    throw "python is not installed or not in PATH"
}

if (-not (Test-Path $WorkerScript)) {
    throw "telethon_worker.py not found at $WorkerScript"
}

Write-Info "Building Telethon worker..."

if ($Clean -or (Test-Path (Join-Path $ScriptDir "dist"))) {
    Write-Info "Cleaning previous build artifacts..."
    Remove-Item -Recurse -Force (Join-Path $ScriptDir "build") -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force (Join-Path $ScriptDir "dist") -ErrorAction SilentlyContinue
}

python -m pip install --upgrade pip | Out-Null
python -m pip install telethon pyinstaller cryptg | Out-Null

$DistDir = if ($OutputDir -ne "") { $OutputDir } else { Join-Path $ScriptDir "dist" }

python -m PyInstaller --clean --noconfirm --onefile `
    --name telethon-worker `
    --distpath $DistDir `
    $WorkerScript

$WorkerExe = Join-Path $DistDir "telethon-worker.exe"
$WorkerNoExt = Join-Path $DistDir "telethon-worker"

if (-not (Test-Path $WorkerExe) -and (Test-Path $WorkerNoExt)) {
    Rename-Item $WorkerNoExt "telethon-worker.exe"
}

if (-not (Test-Path $WorkerExe)) {
    throw "Failed to build telethon-worker.exe"
}

# Validate the executable format (Windows PE should start with MZ)
$magic = [System.IO.File]::ReadAllBytes($WorkerExe)[0..1]
if (-not ($magic[0] -eq 0x4D -and $magic[1] -eq 0x5A)) {
    throw "telethon-worker.exe is not a Windows executable (MZ header missing). Ensure PyInstaller ran on Windows."
}

Write-Success "Telethon worker built at: $WorkerExe"

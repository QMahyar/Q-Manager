# Q Manager - Release Build Script (Windows)
# This script builds the application for distribution

param(
    [switch]$Installer,
    [switch]$Portable,
    [switch]$All
)

# Colors for output
function Write-Info { param($msg) Write-Host "[INFO] $msg" -ForegroundColor Cyan }
function Write-Success { param($msg) Write-Host "[SUCCESS] $msg" -ForegroundColor Green }
function Write-Warn { param($msg) Write-Host "[WARN] $msg" -ForegroundColor Yellow }
function Write-Error { param($msg) Write-Host "[ERROR] $msg" -ForegroundColor Red }

# Default to all if nothing specified
if (-not $Installer -and -not $Portable) {
    $All = $true
}

# Get script directory and project root
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir

Write-Info "Q Manager Release Build"
Write-Info "======================="
Write-Info "Project root: $ProjectRoot"

Set-Location $ProjectRoot

# Check prerequisites
Write-Info "Checking prerequisites..."

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "npm is not installed or not in PATH"
    exit 1
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Error "Rust/Cargo is not installed or not in PATH"
    exit 1
}

# Install npm dependencies if needed
if (-not (Test-Path "node_modules")) {
    Write-Info "Installing npm dependencies..."
    npm ci
}

# Build Telethon worker
Write-Info "Building Telethon worker..."
$telethonScript = Join-Path $ProjectRoot "telethon-worker\build-telethon.ps1"
$telethonOutput = Join-Path $ProjectRoot "telethon-worker\dist"
& $telethonScript -Output $telethonOutput -Clean

# Build the application
Write-Info "Building Tauri application..."
npm run tauri build

# Output directories
$ReleaseDir = Join-Path $ProjectRoot "src-tauri\target\release"
$BundleDir = Join-Path $ReleaseDir "bundle"
$OutputDir = Join-Path $ProjectRoot "dist-release"

# Create output directory
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Info "Collecting build artifacts..."

# Get version from tauri.conf.json
$tauriConfig = Get-Content "src-tauri\tauri.conf.json" | ConvertFrom-Json
$Version = $tauriConfig.version
$ProductName = $tauriConfig.productName -replace ' ', '-'

Write-Info "Version: $Version"
Write-Info "Product: $ProductName"

# Copy MSI installer if exists and requested
if ($All -or $Installer) {
    $MsiPath = Get-ChildItem -Path "$BundleDir\msi" -Filter "*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($MsiPath) {
        $MsiDest = Join-Path $OutputDir "${ProductName}-${Version}-x64.msi"
        Copy-Item $MsiPath.FullName -Destination $MsiDest
        Write-Success "MSI Installer: $MsiDest"
    }
    
    # Copy NSIS installer if exists
    $NsisPath = Get-ChildItem -Path "$BundleDir\nsis" -Filter "*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($NsisPath) {
        $NsisDest = Join-Path $OutputDir "${ProductName}-${Version}-x64-setup.exe"
        Copy-Item $NsisPath.FullName -Destination $NsisDest
        Write-Success "NSIS Installer: $NsisDest"
    }
}

# Create portable ZIP if requested
if ($All -or $Portable) {
    Write-Info "Creating portable ZIP..."
    
    $ExePath = Join-Path $ReleaseDir "q-manager.exe"
    
    if (Test-Path $ExePath) {
        $PortableDir = Join-Path $OutputDir "${ProductName}-${Version}-portable-win-x64"
        
        # Create temp directory
        if (Test-Path $PortableDir) {
            Remove-Item -Recurse -Force $PortableDir
        }
        New-Item -ItemType Directory -Force -Path $PortableDir | Out-Null
        
        # Copy executable
        Copy-Item $ExePath -Destination $PortableDir
        
        # Copy Telethon worker
        $TelethonWorker = Join-Path $ProjectRoot "telethon-worker\dist\telethon-worker.exe"
        if (Test-Path $TelethonWorker) {
            Copy-Item $TelethonWorker -Destination $PortableDir
        } else {
            Write-Warn "Telethon worker not found at: $TelethonWorker"
        }
        
        # Create sessions directory placeholder
        New-Item -ItemType Directory -Force -Path "$PortableDir\sessions" | Out-Null
        New-Item -ItemType File -Force -Path "$PortableDir\sessions\.gitkeep" | Out-Null
        
        # Create README
        $ReadmeContent = @"
Q Manager v$Version - Portable Edition (Windows)
================================================

This is the portable version of Q Manager.

USAGE:
1. Run q-manager.exe to start the application
2. Sessions and database will be stored in this folder
3. You can move this entire folder to another location

REQUIREMENTS:
- Windows 10/11 (x64)
- WebView2 Runtime (usually pre-installed)

For more information, visit the project repository.
"@
        Set-Content -Path "$PortableDir\README.txt" -Value $ReadmeContent
        
        # Create ZIP
        $ZipPath = Join-Path $OutputDir "${ProductName}-${Version}-portable-win-x64.zip"
        Compress-Archive -Path $PortableDir -DestinationPath $ZipPath -Force
        
        # Cleanup temp directory
        Remove-Item -Recurse -Force $PortableDir
        
        Write-Success "Portable ZIP: $ZipPath"
    } else {
        Write-Warn "Executable not found at: $ExePath"
    }
}

Write-Host ""
Write-Success "Build complete! Output directory: $OutputDir"
Write-Host ""
Write-Info "Distribution files:"
Get-ChildItem $OutputDir | ForEach-Object {
    $size = if ($_.PSIsContainer) { "DIR" } else { "{0:N2} MB" -f ($_.Length / 1MB) }
    Write-Info "  $($_.Name) - $size"
}

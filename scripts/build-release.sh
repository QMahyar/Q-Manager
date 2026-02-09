#!/bin/bash
# Q Manager - Release Build Script (Linux)
# This script builds the application for distribution

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

info() { echo -e "${CYAN}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# Parse arguments
BUILD_INSTALLER=false
BUILD_PORTABLE=false
BUILD_ALL=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --installer) BUILD_INSTALLER=true; shift ;;
        --portable) BUILD_PORTABLE=true; shift ;;
        --all) BUILD_ALL=true; shift ;;
        *) echo "Unknown option: $1"; exit 1 ;;
    esac
done

# Default to all if nothing specified
if [ "$BUILD_INSTALLER" = false ] && [ "$BUILD_PORTABLE" = false ]; then
    BUILD_ALL=true
fi

# Get script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

info "Q Manager Release Build"
info "======================="
info "Project root: $PROJECT_ROOT"

cd "$PROJECT_ROOT"

# Check prerequisites
info "Checking prerequisites..."

if ! command -v npm &> /dev/null; then
    error "npm is not installed or not in PATH"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    error "Rust/Cargo is not installed or not in PATH"
    exit 1
fi

# Install npm dependencies if needed
if [ ! -d "node_modules" ]; then
    info "Installing npm dependencies..."
    npm ci
fi

# Build Telethon worker
info "Building Telethon worker..."
"$PROJECT_ROOT/telethon-worker/build-telethon.sh" --output "$PROJECT_ROOT/telethon-worker/dist" --clean

# Build the application
info "Building Tauri application..."
npm run tauri build

# Output directories
RELEASE_DIR="$PROJECT_ROOT/src-tauri/target/release"
BUNDLE_DIR="$RELEASE_DIR/bundle"
OUTPUT_DIR="$PROJECT_ROOT/dist-release"

# Create output directory
mkdir -p "$OUTPUT_DIR"

info "Collecting build artifacts..."

# Get version from tauri.conf.json
VERSION=$(grep -o '"version": "[^"]*"' src-tauri/tauri.conf.json | cut -d'"' -f4)
PRODUCT_NAME=$(grep -o '"productName": "[^"]*"' src-tauri/tauri.conf.json | cut -d'"' -f4 | tr ' ' '-')

info "Version: $VERSION"
info "Product: $PRODUCT_NAME"

# Copy DEB package if exists and requested
if [ "$BUILD_ALL" = true ] || [ "$BUILD_INSTALLER" = true ]; then
    DEB_PATH=$(find "$BUNDLE_DIR/deb" -name "*.deb" 2>/dev/null | head -1)
    if [ -n "$DEB_PATH" ]; then
        DEB_DEST="$OUTPUT_DIR/${PRODUCT_NAME}-${VERSION}-amd64.deb"
        cp "$DEB_PATH" "$DEB_DEST"
        success "DEB Package: $DEB_DEST"
    fi
    
    # Copy RPM package if exists
    RPM_PATH=$(find "$BUNDLE_DIR/rpm" -name "*.rpm" 2>/dev/null | head -1)
    if [ -n "$RPM_PATH" ]; then
        RPM_DEST="$OUTPUT_DIR/${PRODUCT_NAME}-${VERSION}-x86_64.rpm"
        cp "$RPM_PATH" "$RPM_DEST"
        success "RPM Package: $RPM_DEST"
    fi
    
    # Copy AppImage if exists
    APPIMAGE_PATH=$(find "$BUNDLE_DIR/appimage" -name "*.AppImage" 2>/dev/null | head -1)
    if [ -n "$APPIMAGE_PATH" ]; then
        APPIMAGE_DEST="$OUTPUT_DIR/${PRODUCT_NAME}-${VERSION}-x86_64.AppImage"
        cp "$APPIMAGE_PATH" "$APPIMAGE_DEST"
        chmod +x "$APPIMAGE_DEST"
        success "AppImage: $APPIMAGE_DEST"
    fi
fi

# Create portable tarball if requested
if [ "$BUILD_ALL" = true ] || [ "$BUILD_PORTABLE" = true ]; then
    info "Creating portable tarball..."
    
    EXE_PATH="$RELEASE_DIR/q-manager"
    
    if [ -f "$EXE_PATH" ]; then
        PORTABLE_DIR="$OUTPUT_DIR/${PRODUCT_NAME}-${VERSION}-portable-linux-x64"
        
        # Create temp directory
        rm -rf "$PORTABLE_DIR"
        mkdir -p "$PORTABLE_DIR"
        
        # Copy executable
        cp "$EXE_PATH" "$PORTABLE_DIR/"
        chmod +x "$PORTABLE_DIR/q-manager"
        
        # Copy Telethon worker
        TELETHON_WORKER="$PROJECT_ROOT/telethon-worker/dist/telethon-worker"
        if [ -f "$TELETHON_WORKER" ]; then
            cp "$TELETHON_WORKER" "$PORTABLE_DIR/"
            chmod +x "$PORTABLE_DIR/telethon-worker"
        else
            warn "Telethon worker not found at: $TELETHON_WORKER"
        fi
        
        # Create sessions directory placeholder
        mkdir -p "$PORTABLE_DIR/sessions"
        touch "$PORTABLE_DIR/sessions/.gitkeep"
        
        # Create README
        cat > "$PORTABLE_DIR/README.txt" << EOF
Q Manager v$VERSION - Portable Edition (Linux)
==============================================

This is the portable version of Q Manager.

USAGE:
1. Run ./q-manager to start the application
2. Sessions and database will be stored in this folder
3. You can move this entire folder to another location

REQUIREMENTS:
- Linux x86_64
- GTK 3, WebKit2GTK 4.1

For more information, visit the project repository.
EOF
        
        # Create tarball
        TAR_PATH="$OUTPUT_DIR/${PRODUCT_NAME}-${VERSION}-portable-linux-x64.tar.gz"
        tar -czf "$TAR_PATH" -C "$OUTPUT_DIR" "${PRODUCT_NAME}-${VERSION}-portable-linux-x64"
        
        # Cleanup temp directory
        rm -rf "$PORTABLE_DIR"
        
        success "Portable tarball: $TAR_PATH"
    else
        warn "Executable not found at: $EXE_PATH"
    fi
fi

echo ""
success "Build complete! Output directory: $OUTPUT_DIR"
echo ""
info "Distribution files:"
ls -lh "$OUTPUT_DIR" | tail -n +2 | while read line; do
    info "  $line"
done

#!/bin/bash
set -e

echo "========================================="
echo "🐧 Q-Manager Linux Build Script (WSL)"
echo "========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}📦 Step 1: Installing Python dependencies...${NC}"
pip3 install --user telethon pyinstaller cryptg || {
    echo -e "${YELLOW}Using system packages instead...${NC}"
    sudo apt-get update
    sudo apt-get install -y python3-pip
    pip3 install --user --break-system-packages telethon pyinstaller cryptg
}

echo -e "${GREEN}✓ Python dependencies installed${NC}"
echo ""

echo -e "${YELLOW}📦 Step 2: Building Telethon worker...${NC}"
cd telethon-worker
bash build-telethon.sh --output dist --clean
echo -e "${GREEN}✓ Telethon worker built${NC}"
cd ..
echo ""

echo -e "${YELLOW}📦 Step 3: Installing npm dependencies...${NC}"
npm ci
echo -e "${GREEN}✓ npm dependencies installed${NC}"
echo ""

echo -e "${YELLOW}📦 Step 4: Building Tauri app for Linux...${NC}"
source ~/.cargo/env
npm run tauri build
echo -e "${GREEN}✓ Tauri app built${NC}"
echo ""

echo "========================================="
echo -e "${GREEN}✅ Build Complete!${NC}"
echo "========================================="
echo ""
echo "📦 Build artifacts location:"
echo "  • DEB package: src-tauri/target/release/bundle/deb/"
echo "  • RPM package: src-tauri/target/release/bundle/rpm/"
echo "  • AppImage: src-tauri/target/release/bundle/appimage/"
echo ""
echo "🚀 To test the app:"
echo "  ./src-tauri/target/release/q-manager"
echo ""

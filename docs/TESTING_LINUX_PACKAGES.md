# Testing Linux Packages

This guide covers how to test Q-Manager Linux packages (DEB, RPM, AppImage) before releasing.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Testing DEB Package (Debian/Ubuntu)](#testing-deb-package-debianubuntu)
- [Testing RPM Package (Fedora/RHEL)](#testing-rpm-package-fedorarhel)
- [Testing AppImage (Universal)](#testing-appimage-universal)
- [Verification Checklist](#verification-checklist)
- [Common Issues](#common-issues)
- [Automated Testing](#automated-testing)

---

## Prerequisites

### System Requirements

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libwebkit2gtk-4.1-0 librsvg2-2 libayatana-appindicator3-1
```

**Fedora/RHEL:**
```bash
sudo dnf install -y gtk3 webkit2gtk4.1 librsvg2 libappindicator-gtk3
```

**Arch Linux:**
```bash
sudo pacman -S gtk3 webkit2gtk librsvg libappindicator-gtk3
```

### Testing Tools

```bash
# Install testing utilities
sudo apt-get install -y file ldd binutils dpkg-sig

# Or on Fedora/RHEL
sudo dnf install -y file ldd binutils rpm-sign
```

---

## Testing DEB Package (Debian/Ubuntu)

### 1. Package Information

```bash
# Navigate to package location
cd src-tauri/target/release/bundle/deb/

# List package contents
dpkg-deb -c q-manager_*.deb

# Show package information
dpkg-deb -I q-manager_*.deb

# Check package architecture
dpkg-deb --info q-manager_*.deb | grep Architecture
```

### 2. Install Package

```bash
# Install the DEB package
sudo dpkg -i q-manager_*.deb

# If dependencies are missing, fix them
sudo apt-get install -f
```

### 3. Verify Installation

```bash
# Check if installed
dpkg -l | grep q-manager

# Verify binary location
which q-manager

# Check file permissions
ls -lh /usr/bin/q-manager

# Verify desktop entry
ls -lh /usr/share/applications/q-manager.desktop
cat /usr/share/applications/q-manager.desktop

# Check icon installation
ls -lh /usr/share/icons/hicolor/*/apps/q-manager.*
```

### 4. Run Application

```bash
# Run from terminal
q-manager

# Or run from application menu
# Search for "Q Manager" in your app launcher
```

### 5. Test System Tray

```bash
# Q-Manager should appear in system tray with icon
# Verify tray menu works (Show/Hide, Start/Stop, Exit)

# Check tray icon process
ps aux | grep q-manager
```

### 6. Uninstall

```bash
# Remove package
sudo dpkg -r q-manager

# Or purge (remove config files too)
sudo dpkg -P q-manager

# Verify removal
dpkg -l | grep q-manager
```

---

## Testing RPM Package (Fedora/RHEL)

### 1. Package Information

```bash
# Navigate to package location
cd src-tauri/target/release/bundle/rpm/

# List package contents
rpm -qlp q-manager-*.rpm

# Show package information
rpm -qip q-manager-*.rpm

# Verify package signature (if signed)
rpm --checksig q-manager-*.rpm
```

### 2. Install Package

```bash
# Install the RPM package
sudo rpm -ivh q-manager-*.rpm

# Or using dnf
sudo dnf install ./q-manager-*.rpm
```

### 3. Verify Installation

```bash
# Check if installed
rpm -qa | grep q-manager

# List installed files
rpm -ql q-manager

# Verify binary
which q-manager

# Check desktop entry
rpm -ql q-manager | grep .desktop
```

### 4. Run Application

```bash
# Run from terminal
q-manager

# Or from application menu
```

### 5. Uninstall

```bash
# Remove package
sudo rpm -e q-manager

# Or using dnf
sudo dnf remove q-manager
```

---

## Testing AppImage (Universal)

### 1. Prepare AppImage

```bash
# Navigate to AppImage location
cd src-tauri/target/release/bundle/appimage/

# Make executable
chmod +x q-manager_*.AppImage

# Check file type
file q-manager_*.AppImage
```

### 2. Extract and Inspect (Optional)

```bash
# Extract AppImage contents
./q-manager_*.AppImage --appimage-extract

# Inspect extracted files
ls -lh squashfs-root/
tree squashfs-root/ | head -20

# Check dependencies
ldd squashfs-root/usr/bin/q-manager
```

### 3. Run AppImage

```bash
# Run directly
./q-manager_*.AppImage

# Run with verbose output
./q-manager_*.AppImage --verbose

# Run in foreground (see logs)
./q-manager_*.AppImage 2>&1 | tee appimage-test.log
```

### 4. Test Desktop Integration

```bash
# Install desktop integration (creates .desktop file)
./q-manager_*.AppImage --appimage-integrate

# Verify desktop entry created
ls -lh ~/.local/share/applications/appimagekit-*.desktop

# Search in app menu for "Q Manager"

# Remove desktop integration
./q-manager_*.AppImage --appimage-unintegrate
```

### 5. Test Sandboxing (Optional)

```bash
# Run in sandbox mode if AppImage supports it
./q-manager_*.AppImage --appimage-sandbox
```

---

## Verification Checklist

Use this checklist for each package type:

### ✅ Installation

- [ ] Package installs without errors
- [ ] Dependencies are satisfied
- [ ] Binary is executable
- [ ] Desktop entry is created
- [ ] Icons are installed
- [ ] File permissions are correct

### ✅ Launch & UI

- [ ] Application launches successfully
- [ ] UI renders correctly
- [ ] No console errors
- [ ] Window is resizable/maximizable
- [ ] All pages load (Accounts, Actions, Targets, Settings, etc.)

### ✅ System Integration

- [ ] System tray icon appears
- [ ] Tray menu is functional
- [ ] Application appears in app launcher
- [ ] Can start from command line
- [ ] Can start from desktop/menu

### ✅ Core Functionality

- [ ] Database initializes correctly
- [ ] Can create/edit accounts
- [ ] Can configure actions
- [ ] Can set targets
- [ ] Settings persist across restarts

### ✅ Telethon Worker

- [ ] Telethon worker binary exists
- [ ] Worker process starts correctly
- [ ] Can initiate login flow
- [ ] Session files are created

### ✅ Cleanup

- [ ] Application closes cleanly
- [ ] No orphaned processes
- [ ] Uninstall removes all files
- [ ] No leftover config files (after purge)

---

## Common Issues

### Issue: Missing Dependencies

**Symptoms:** Package won't install or app won't run

**Solution:**
```bash
# Ubuntu/Debian
sudo apt-get install -f

# Fedora/RHEL
sudo dnf install <missing-package>
```

### Issue: AppImage Won't Execute

**Symptoms:** `Permission denied` or `cannot execute binary file`

**Solution:**
```bash
chmod +x q-manager_*.AppImage
./q-manager_*.AppImage
```

### Issue: System Tray Icon Not Showing

**Symptoms:** App runs but no tray icon

**Check:**
```bash
# Verify libayatana-appindicator is installed
dpkg -l | grep libayatana-appindicator

# Install if missing
sudo apt-get install libayatana-appindicator3-1
```

### Issue: Database Permission Errors

**Symptoms:** Cannot create/access database

**Solution:**
```bash
# Check database location permissions
ls -lh ~/.local/share/q-manager/

# Fix permissions
chmod 755 ~/.local/share/q-manager/
chmod 644 ~/.local/share/q-manager/*.sqlite
```

### Issue: Telethon Worker Not Found

**Symptoms:** Login fails, worker process errors

**Check:**
```bash
# Verify worker exists in bundle
ls -lh /usr/lib/q-manager/telethon-worker

# Or in AppImage
./q-manager_*.AppImage --appimage-extract
ls -lh squashfs-root/usr/bin/telethon-worker
```

---

## Automated Testing

### Quick Test Script

Create `test-linux-package.sh`:

```bash
#!/bin/bash

set -e

PACKAGE_TYPE=$1  # deb, rpm, or appimage
PACKAGE_PATH=$2

echo "========================================="
echo "Testing $PACKAGE_TYPE package"
echo "========================================="

case $PACKAGE_TYPE in
  deb)
    echo "Installing DEB package..."
    sudo dpkg -i "$PACKAGE_PATH"
    sudo apt-get install -f -y
    
    echo "Verifying installation..."
    dpkg -l | grep q-manager
    which q-manager
    
    echo "Testing launch..."
    timeout 10s q-manager --help || true
    
    echo "Uninstalling..."
    sudo dpkg -P q-manager
    ;;
    
  rpm)
    echo "Installing RPM package..."
    sudo dnf install -y "$PACKAGE_PATH"
    
    echo "Verifying installation..."
    rpm -qa | grep q-manager
    which q-manager
    
    echo "Testing launch..."
    timeout 10s q-manager --help || true
    
    echo "Uninstalling..."
    sudo dnf remove -y q-manager
    ;;
    
  appimage)
    echo "Preparing AppImage..."
    chmod +x "$PACKAGE_PATH"
    
    echo "Testing launch..."
    timeout 10s "$PACKAGE_PATH" --help || true
    
    echo "Testing desktop integration..."
    "$PACKAGE_PATH" --appimage-integrate
    ls ~/.local/share/applications/appimagekit-*.desktop
    "$PACKAGE_PATH" --appimage-unintegrate
    ;;
    
  *)
    echo "Unknown package type: $PACKAGE_TYPE"
    echo "Usage: $0 {deb|rpm|appimage} <package-path>"
    exit 1
    ;;
esac

echo ""
echo "✅ Testing complete!"
```

**Usage:**
```bash
chmod +x test-linux-package.sh

# Test DEB
./test-linux-package.sh deb src-tauri/target/release/bundle/deb/q-manager_*.deb

# Test RPM
./test-linux-package.sh rpm src-tauri/target/release/bundle/rpm/q-manager-*.rpm

# Test AppImage
./test-linux-package.sh appimage src-tauri/target/release/bundle/appimage/q-manager_*.AppImage
```

---

## Testing in Virtual Machines

For thorough testing across distributions:

### Using Multipass

```bash
# Ubuntu 24.04
multipass launch 24.04 -n test-ubuntu
multipass mount . test-ubuntu:/workspace
multipass shell test-ubuntu

# Inside VM
cd /workspace
sudo dpkg -i src-tauri/target/release/bundle/deb/q-manager_*.deb
q-manager
```

### Using Docker

```bash
# Ubuntu
docker run -it --rm ubuntu:24.04 bash
# ... install and test DEB

# Fedora
docker run -it --rm fedora:latest bash
# ... install and test RPM
```

---

## Next Steps After Testing

1. ✅ Verify all checklist items
2. 📸 Take screenshots of working app
3. 📝 Document any issues found
4. 🐛 Create issues for bugs
5. 🚀 Upload packages to GitHub Release
6. 📢 Update release notes with tested platforms

---

For questions or issues, please open a GitHub issue: https://github.com/QMahyar/Q-Manager/issues

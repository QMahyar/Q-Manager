# Release v{VERSION}

> **Release Date:** {DATE}  
> **Release Type:** {Major/Minor/Patch}

## 🎉 Highlights

<!-- Brief summary of the most important changes -->

---

## ✨ New Features

<!-- List new features added in this release -->

- **Feature Name:** Description of what it does and why it's useful
  - Additional details or sub-features
  - Usage example or benefit

---

## 🐛 Bug Fixes

<!-- List bugs fixed in this release -->

- **Issue #XXX:** Fixed description of the bug
  - What was causing it
  - How it's fixed now

---

## 🔧 Improvements

<!-- List improvements and enhancements -->

- **Area:** Description of improvement
  - Performance gain or UX improvement
  - Impact on users

---

## 📝 Changes

<!-- List breaking changes, deprecations, or notable changes -->

### Breaking Changes

- **Change:** Description and migration guide

### Deprecations

- **Deprecated Feature:** What's deprecated and what to use instead

---

## 📦 Assets

Download the appropriate package for your platform:

### Windows

- **MSI Installer** (Recommended)
  - File: `Q-Manager-{VERSION}-x64.msi`
  - Use for system-wide installation
  
- **NSIS Setup Executable**
  - File: `Q-Manager-{VERSION}-x64-setup.exe`
  - Alternative installer
  
- **Portable ZIP**
  - File: `Q-Manager-{VERSION}-portable-win-x64.zip`
  - No installation required, run directly

**Requirements:**
- Windows 10/11 (x64)
- WebView2 Runtime (usually pre-installed)
- Microsoft Visual C++ Redistributable

### Linux

- **DEB Package** (Ubuntu/Debian)
  - File: `q-manager_{VERSION}_amd64.deb`
  - `sudo dpkg -i q-manager_{VERSION}_amd64.deb`
  
- **RPM Package** (Fedora/RHEL)
  - File: `q-manager-{VERSION}.x86_64.rpm`
  - `sudo dnf install q-manager-{VERSION}.x86_64.rpm`
  
- **AppImage** (Universal)
  - File: `q-manager_{VERSION}_amd64.AppImage`
  - `chmod +x q-manager_{VERSION}_amd64.AppImage && ./q-manager_{VERSION}_amd64.AppImage`

**Requirements:**
- GTK 3, WebKit2GTK 4.1, librsvg2
- libayatana-appindicator3 (for system tray)

**Install dependencies:**
```bash
# Ubuntu/Debian
sudo apt-get install libgtk-3-0 libwebkit2gtk-4.1-0 librsvg2-2 libayatana-appindicator3-1

# Fedora
sudo dnf install gtk3 webkit2gtk4.1 librsvg2 libappindicator-gtk3
```

---

## 📋 Installation

### Windows

1. Download the MSI installer
2. Double-click to run
3. Follow the installation wizard
4. Launch from Start Menu or Desktop

### Linux (DEB)

```bash
# Download the DEB file
wget https://github.com/QMahyar/Q-Manager/releases/download/v{VERSION}/q-manager_{VERSION}_amd64.deb

# Install dependencies
sudo apt-get update
sudo apt-get install -y libgtk-3-0 libwebkit2gtk-4.1-0 librsvg2-2 libayatana-appindicator3-1

# Install package
sudo dpkg -i q-manager_{VERSION}_amd64.deb

# Fix any missing dependencies
sudo apt-get install -f

# Run
q-manager
```

### Linux (AppImage)

```bash
# Download AppImage
wget https://github.com/QMahyar/Q-Manager/releases/download/v{VERSION}/q-manager_{VERSION}_amd64.AppImage

# Make executable
chmod +x q-manager_{VERSION}_amd64.AppImage

# Run
./q-manager_{VERSION}_amd64.AppImage
```

---

## 🔍 Verification

### Checksums

**SHA256:**
```
{SHA256_MSI}  Q-Manager-{VERSION}-x64.msi
{SHA256_NSIS}  Q-Manager-{VERSION}-x64-setup.exe
{SHA256_ZIP}  Q-Manager-{VERSION}-portable-win-x64.zip
{SHA256_DEB}  q-manager_{VERSION}_amd64.deb
{SHA256_RPM}  q-manager-{VERSION}.x86_64.rpm
{SHA256_APPIMAGE}  q-manager_{VERSION}_amd64.AppImage
```

**Verify:**
```bash
# Windows (PowerShell)
Get-FileHash Q-Manager-{VERSION}-x64.msi -Algorithm SHA256

# Linux
sha256sum q-manager_{VERSION}_amd64.deb
```

---

## 🧪 Testing

For detailed testing instructions, see:
- [Testing Linux Packages](https://github.com/QMahyar/Q-Manager/blob/main/docs/TESTING_LINUX_PACKAGES.md)

---

## 📚 Documentation

- [README](https://github.com/QMahyar/Q-Manager/blob/main/README.md) - Overview and quick start
- [CONTRIBUTING](https://github.com/QMahyar/Q-Manager/blob/main/CONTRIBUTING.md) - Contribution guidelines
- [CHANGELOG](https://github.com/QMahyar/Q-Manager/blob/main/CHANGELOG.md) - Full version history
- [DEPLOYMENT](https://github.com/QMahyar/Q-Manager/blob/main/docs/DEPLOYMENT.md) - Build and release guide

---

## 🐛 Known Issues

<!-- List any known issues or limitations in this release -->

- **Issue:** Description and workaround (if available)

---

## 🔄 Upgrading

### From v{PREVIOUS_VERSION}

<!-- Instructions for upgrading from the previous version -->

1. Close Q-Manager completely
2. Install the new version
3. Your data will be preserved in:
   - Windows: `%APPDATA%\q-manager\`
   - Linux: `~/.local/share/q-manager/`

**Database migrations:** {Auto/Manual} - {Description}

---

## 🙏 Contributors

<!-- Thank contributors to this release -->

- @{username} - {contribution}

---

## 📞 Support

If you encounter any issues:

1. Check [Known Issues](#known-issues)
2. Search [existing issues](https://github.com/QMahyar/Q-Manager/issues)
3. [Open a new issue](https://github.com/QMahyar/Q-Manager/issues/new/choose)

---

## 🔗 Links

- **Repository:** https://github.com/QMahyar/Q-Manager
- **Issues:** https://github.com/QMahyar/Q-Manager/issues
- **Discussions:** https://github.com/QMahyar/Q-Manager/discussions
- **Releases:** https://github.com/QMahyar/Q-Manager/releases

---

**Full Changelog:** https://github.com/QMahyar/Q-Manager/compare/v{PREVIOUS_VERSION}...v{VERSION}

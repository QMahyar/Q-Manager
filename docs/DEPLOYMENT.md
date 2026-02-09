# Deployment Guide

This guide covers how to build, test, and deploy Q-Manager releases across all platforms.

## Table of Contents

- [Build Environments](#build-environments)
- [Building for Windows](#building-for-windows)
- [Building for Linux](#building-for-linux)
- [GitHub Actions Releases](#github-actions-releases)
- [Manual Release Process](#manual-release-process)
- [Release Checklist](#release-checklist)
- [Versioning](#versioning)

---

## Build Environments

### Windows Build Requirements

**Software:**
- Node.js 20+
- Rust 1.70+
- Python 3.8+
- Visual Studio Build Tools or Visual Studio 2022

**Python Dependencies:**
```powershell
pip install telethon pyinstaller cryptg
```

**Build Commands:**
```powershell
# Full release build
npm run release:win

# Or step-by-step
cd telethon-worker
.\build-telethon.ps1 -Output dist -Clean
cd ..
npm ci
npm run tauri build
```

**Output:**
- `dist-release/Q-Manager-{version}-x64.msi` (MSI installer)
- `dist-release/Q-Manager-{version}-x64-setup.exe` (NSIS installer)
- `dist-release/Q-Manager-{version}-portable-win-x64.zip` (Portable)

---

### Linux Build Requirements (WSL or Native)

**System Dependencies:**
```bash
# Ubuntu/Debian
sudo apt-get install -y \
  libgtk-3-dev \
  libwebkit2gtk-4.1-dev \
  librsvg2-dev \
  libayatana-appindicator3-dev \
  patchelf \
  build-essential

# Fedora
sudo dnf install -y \
  gtk3-devel \
  webkit2gtk4.1-devel \
  librsvg2-devel \
  libappindicator-gtk3-devel \
  patchelf
```

**Rust & Node.js:**
```bash
# Install Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Python Dependencies:**
```bash
pip3 install --user --break-system-packages telethon pyinstaller cryptg
```

**Build Commands:**
```bash
# Use the automated script
./build-linux-wsl.sh

# Or step-by-step
cd telethon-worker
bash build-telethon.sh --output dist --clean
cd ..
npm ci
source ~/.cargo/env
npm run tauri build
```

**Output:**
- `src-tauri/target/release/bundle/deb/q-manager_{version}_amd64.deb`
- `src-tauri/target/release/bundle/rpm/q-manager-{version}.x86_64.rpm`
- `src-tauri/target/release/bundle/appimage/q-manager_{version}_amd64.AppImage`

---

## Building for Windows

### Using PowerShell Release Script

```powershell
# Navigate to project
cd q-manager

# Build release packages
npm run release:win

# Packages will be in dist-release/
```

### Manual Build Steps

```powershell
# 1. Clean previous builds
Remove-Item -Recurse -Force dist-release, src-tauri\target\release\bundle -ErrorAction SilentlyContinue

# 2. Build Telethon worker
cd telethon-worker
.\build-telethon.ps1 -Output dist -Clean
cd ..

# 3. Install dependencies
npm ci

# 4. Build Tauri app
npm run tauri build

# 5. Create portable package
.\scripts\build-release.ps1 -Portable
```

---

## Building for Linux

### Using WSL (Recommended for Windows Users)

```bash
# Start WSL
wsl

# Navigate to project
cd "/mnt/e/AI code/WerewolfBot/q-manager"

# Fix line endings (first time only)
sed -i 's/\r$//' build-linux-wsl.sh
sed -i 's/\r$//' telethon-worker/build-telethon.sh

# Run build
./build-linux-wsl.sh
```

### Using Native Linux

Same as WSL but without the `/mnt/` path prefix.

---

## GitHub Actions Releases

GitHub Actions automatically builds and publishes releases when you push a version tag.

### Automated Release Process

1. **Update version numbers:**
   ```bash
   # Edit these files
   vim package.json          # "version": "1.1.0"
   vim src-tauri/Cargo.toml  # version = "1.1.0"
   vim src-tauri/tauri.conf.json  # "version": "1.1.0"
   ```

2. **Update CHANGELOG.md:**
   ```bash
   vim CHANGELOG.md
   # Add new version section with changes
   ```

3. **Commit changes:**
   ```bash
   git add package.json src-tauri/Cargo.toml src-tauri/tauri.conf.json CHANGELOG.md
   git commit -m "chore: bump version to 1.1.0"
   git push
   ```

4. **Create and push tag:**
   ```bash
   git tag v1.1.0
   git push origin v1.1.0
   ```

5. **GitHub Actions will automatically:**
   - Build Windows installers (MSI + NSIS)
   - Build Linux packages (DEB + RPM + AppImage)
   - Create GitHub Release
   - Upload all artifacts

6. **Monitor build progress:**
   - Go to: https://github.com/QMahyar/Q-Manager/actions
   - Watch the "Release Build" workflow

### What GitHub Actions Builds

**Windows (windows-latest runner):**
- MSI installer
- NSIS setup.exe
- Portable ZIP (via Tauri bundler)

**Linux (ubuntu-latest runner):**
- DEB package (Debian/Ubuntu)
- RPM package (Fedora/RHEL)
- AppImage (Universal)

---

## Manual Release Process

If GitHub Actions fails or you want to create a manual release:

### 1. Build Locally

**Windows:**
```powershell
npm run release:win
```

**Linux (WSL):**
```bash
./build-linux-wsl.sh
```

### 2. Create GitHub Release

```bash
# Create tag
git tag v1.1.0
git push origin v1.1.0

# Create release using gh CLI
gh release create v1.1.0 \
  --title "v1.1.0 - Feature Release" \
  --notes-file release-notes.md \
  dist-release/Q-Manager-1.1.0-x64.msi \
  dist-release/Q-Manager-1.1.0-x64-setup.exe \
  dist-release/Q-Manager-1.1.0-portable-win-x64.zip \
  src-tauri/target/release/bundle/deb/q-manager_1.1.0_amd64.deb \
  src-tauri/target/release/bundle/rpm/q-manager-1.1.0.x86_64.rpm \
  src-tauri/target/release/bundle/appimage/q-manager_1.1.0_amd64.AppImage
```

### 3. Verify Release

- Check https://github.com/QMahyar/Q-Manager/releases
- Download and test each artifact
- Update release notes if needed

---

## Release Checklist

### Pre-Release

- [ ] All features tested and working
- [ ] No critical bugs
- [ ] Version bumped in all files
- [ ] CHANGELOG.md updated
- [ ] README.md updated (if needed)
- [ ] Tests passing locally
- [ ] CI/CD workflows passing

### Build

- [ ] Windows build completes successfully
- [ ] Linux build completes successfully
- [ ] All artifacts generated
- [ ] No build warnings or errors

### Testing

- [ ] Windows MSI installs correctly
- [ ] Windows NSIS installer works
- [ ] Windows portable ZIP runs
- [ ] Linux DEB installs on Ubuntu
- [ ] Linux RPM installs on Fedora
- [ ] AppImage runs on multiple distros
- [ ] System tray works on all platforms
- [ ] Core features functional on all platforms

### Deployment

- [ ] Git tag created and pushed
- [ ] GitHub Release created
- [ ] All artifacts uploaded
- [ ] Release notes published
- [ ] Release marked as latest
- [ ] Release announcement posted (if applicable)

### Post-Release

- [ ] Download and verify release artifacts
- [ ] Test installation from release page
- [ ] Monitor GitHub issues for problems
- [ ] Update documentation if needed
- [ ] Plan next release

---

## Versioning

Q-Manager follows [Semantic Versioning](https://semver.org/):

**Format:** `MAJOR.MINOR.PATCH`

### Version Bump Guidelines

**MAJOR (1.x.x → 2.0.0):**
- Breaking changes
- Major architectural changes
- Incompatible API changes

**MINOR (1.0.x → 1.1.0):**
- New features
- Backward-compatible functionality
- Significant improvements

**PATCH (1.0.0 → 1.0.1):**
- Bug fixes
- Minor improvements
- Security patches

### Version Files to Update

When bumping version, update these files:

1. **package.json**
   ```json
   {
     "version": "1.1.0"
   }
   ```

2. **src-tauri/Cargo.toml**
   ```toml
   [package]
   version = "1.1.0"
   ```

3. **src-tauri/tauri.conf.json**
   ```json
   {
     "version": "1.1.0"
   }
   ```

4. **CHANGELOG.md**
   ```markdown
   ## [1.1.0] - 2025-02-09
   
   ### Added
   - New feature description
   
   ### Fixed
   - Bug fix description
   ```

### Version Tag Format

Always use `v` prefix for tags:
```bash
git tag v1.1.0
git push origin v1.1.0
```

This triggers the GitHub Actions release workflow.

---

## Troubleshooting Releases

### Build Fails on Windows

**Check:**
- Rust toolchain installed
- Python dependencies installed
- Visual Studio Build Tools present
- Telethon worker built successfully

**Fix:**
```powershell
rustup update
pip install --upgrade telethon pyinstaller cryptg
npm ci
```

### Build Fails on Linux

**Check:**
- All system dependencies installed
- libayatana-appindicator3-dev present
- Rust toolchain installed

**Fix:**
```bash
sudo apt-get update
sudo apt-get install -y libgtk-3-dev libwebkit2gtk-4.1-dev librsvg2-dev libayatana-appindicator3-dev patchelf
rustup update
npm ci
```

### GitHub Actions Fails

**Check:**
- Workflow permissions (contents: write)
- GITHUB_TOKEN has access
- Dependencies installed correctly

**View logs:**
```bash
gh run list
gh run view <run-id> --log-failed
```

### Release Asset Upload Fails

**Manual upload:**
```bash
gh release upload v1.1.0 path/to/artifact.msi
```

---

## Additional Resources

- [Tauri Build Documentation](https://tauri.app/v1/guides/building/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Semantic Versioning Spec](https://semver.org/)
- [Testing Linux Packages](./TESTING_LINUX_PACKAGES.md)

---

For questions or issues, open a GitHub issue: https://github.com/QMahyar/Q-Manager/issues

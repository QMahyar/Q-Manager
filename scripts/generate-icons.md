# Icon Generation Guide

This guide explains how to generate application icons from the source SVG file.

## Source File
- `src-tauri/icons/icon.svg` - The master SVG icon

## Required Output Files

### macOS
- `icon.icns` - macOS application icon (multiple sizes bundled)

### Windows
- `icon.ico` - Windows application icon (multiple sizes bundled)
- `icon.png` - 256x256 PNG for Windows

### Linux
- `32x32.png` - 32x32 PNG
- `128x128.png` - 128x128 PNG
- `128x128@2x.png` - 256x256 PNG (Retina)

### Windows Store
- `Square30x30Logo.png`
- `Square44x44Logo.png`
- `Square71x71Logo.png`
- `Square89x89Logo.png`
- `Square107x107Logo.png`
- `Square142x142Logo.png`
- `Square150x150Logo.png`
- `Square284x284Logo.png`
- `Square310x310Logo.png`
- `StoreLogo.png` (50x50)

## Generation Methods

### Method 1: Online Tools (Recommended for quick generation)
1. Go to https://realfavicongenerator.net/ or https://www.favicon-generator.org/
2. Upload the SVG file
3. Download the generated icon pack
4. Copy files to `src-tauri/icons/`

### Method 2: Using ImageMagick (Command Line)

```bash
# Install ImageMagick first
# Windows: choco install imagemagick
# macOS: brew install imagemagick
# Linux: sudo apt install imagemagick

cd src-tauri/icons

# Generate PNG files from SVG
convert -background none icon.svg -resize 32x32 32x32.png
convert -background none icon.svg -resize 128x128 128x128.png
convert -background none icon.svg -resize 256x256 128x128@2x.png
convert -background none icon.svg -resize 256x256 icon.png

# Windows Store logos
convert -background none icon.svg -resize 30x30 Square30x30Logo.png
convert -background none icon.svg -resize 44x44 Square44x44Logo.png
convert -background none icon.svg -resize 71x71 Square71x71Logo.png
convert -background none icon.svg -resize 89x89 Square89x89Logo.png
convert -background none icon.svg -resize 107x107 Square107x107Logo.png
convert -background none icon.svg -resize 142x142 Square142x142Logo.png
convert -background none icon.svg -resize 150x150 Square150x150Logo.png
convert -background none icon.svg -resize 284x284 Square284x284Logo.png
convert -background none icon.svg -resize 310x310 Square310x310Logo.png
convert -background none icon.svg -resize 50x50 StoreLogo.png

# Generate ICO (Windows)
convert icon.svg -define icon:auto-resize=256,128,64,48,32,16 icon.ico

# Generate ICNS (macOS) - requires iconutil on macOS
mkdir icon.iconset
convert -background none icon.svg -resize 16x16 icon.iconset/icon_16x16.png
convert -background none icon.svg -resize 32x32 icon.iconset/icon_16x16@2x.png
convert -background none icon.svg -resize 32x32 icon.iconset/icon_32x32.png
convert -background none icon.svg -resize 64x64 icon.iconset/icon_32x32@2x.png
convert -background none icon.svg -resize 128x128 icon.iconset/icon_128x128.png
convert -background none icon.svg -resize 256x256 icon.iconset/icon_128x128@2x.png
convert -background none icon.svg -resize 256x256 icon.iconset/icon_256x256.png
convert -background none icon.svg -resize 512x512 icon.iconset/icon_256x256@2x.png
convert -background none icon.svg -resize 512x512 icon.iconset/icon_512x512.png
convert -background none icon.svg -resize 1024x1024 icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset
rm -rf icon.iconset
```

### Method 3: Using Inkscape (GUI)

1. Open `icon.svg` in Inkscape
2. File → Export PNG Image
3. Set the desired dimensions
4. Export each required size

## Icon Design Notes

The Q Manager icon features:
- A stylized "Q" shape representing the app name
- Wolf ears integrated into the design (Werewolf theme)
- Wolf eyes and nose inside the Q
- Sky blue gradient background (matching the app's color scheme)
- Clean, modern design suitable for various sizes

## After Generation

After generating new icons, rebuild the application:
```bash
npm run tauri build
```

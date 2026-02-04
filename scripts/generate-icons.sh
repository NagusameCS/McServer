#!/bin/bash

# Icon Generation Script for McServer
# Requires: Inkscape or ImageMagick (convert)

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_DIR/build"
ASSETS_DIR="$PROJECT_DIR/assets"

echo "Generating app icons..."

# Check for required tools
if command -v convert &> /dev/null; then
    CONVERTER="imagemagick"
elif command -v inkscape &> /dev/null; then
    CONVERTER="inkscape"
elif command -v sips &> /dev/null; then
    CONVERTER="sips"
else
    echo "Warning: No image converter found. Please install ImageMagick or Inkscape."
    echo "Or use an online SVG to icon converter with build/icon.svg"
    exit 0
fi

# Create directories
mkdir -p "$BUILD_DIR/icons"
mkdir -p "$ASSETS_DIR"

# Source SVG
SVG_FILE="$BUILD_DIR/icon.svg"

if [ ! -f "$SVG_FILE" ]; then
    echo "Error: icon.svg not found in build directory"
    exit 1
fi

echo "Using $CONVERTER for conversion..."

# Generate PNG at various sizes
SIZES="16 32 48 64 128 256 512 1024"

for SIZE in $SIZES; do
    OUTPUT="$BUILD_DIR/icons/icon_${SIZE}x${SIZE}.png"
    
    if [ "$CONVERTER" = "imagemagick" ]; then
        convert -background none -resize ${SIZE}x${SIZE} "$SVG_FILE" "$OUTPUT"
    elif [ "$CONVERTER" = "inkscape" ]; then
        inkscape --export-type=png --export-filename="$OUTPUT" -w $SIZE -h $SIZE "$SVG_FILE" 2>/dev/null
    fi
    
    echo "  Generated ${SIZE}x${SIZE}"
done

# Copy main icon to assets
if [ -f "$BUILD_DIR/icons/icon_256x256.png" ]; then
    cp "$BUILD_DIR/icons/icon_256x256.png" "$ASSETS_DIR/icon.png"
    echo "  Copied icon.png to assets"
fi

# Copy tray icon
if [ -f "$BUILD_DIR/icons/icon_32x32.png" ]; then
    cp "$BUILD_DIR/icons/icon_32x32.png" "$ASSETS_DIR/tray-icon.png"
    echo "  Copied tray-icon.png to assets"
fi

# Generate macOS .icns (requires macOS)
if [ "$(uname)" = "Darwin" ]; then
    echo "Generating macOS .icns..."
    
    ICONSET_DIR="$BUILD_DIR/McServer.iconset"
    mkdir -p "$ICONSET_DIR"
    
    # macOS iconset requires specific naming
    cp "$BUILD_DIR/icons/icon_16x16.png" "$ICONSET_DIR/icon_16x16.png"
    cp "$BUILD_DIR/icons/icon_32x32.png" "$ICONSET_DIR/icon_16x16@2x.png"
    cp "$BUILD_DIR/icons/icon_32x32.png" "$ICONSET_DIR/icon_32x32.png"
    cp "$BUILD_DIR/icons/icon_64x64.png" "$ICONSET_DIR/icon_32x32@2x.png"
    cp "$BUILD_DIR/icons/icon_128x128.png" "$ICONSET_DIR/icon_128x128.png"
    cp "$BUILD_DIR/icons/icon_256x256.png" "$ICONSET_DIR/icon_128x128@2x.png"
    cp "$BUILD_DIR/icons/icon_256x256.png" "$ICONSET_DIR/icon_256x256.png"
    cp "$BUILD_DIR/icons/icon_512x512.png" "$ICONSET_DIR/icon_256x256@2x.png"
    cp "$BUILD_DIR/icons/icon_512x512.png" "$ICONSET_DIR/icon_512x512.png"
    cp "$BUILD_DIR/icons/icon_1024x1024.png" "$ICONSET_DIR/icon_512x512@2x.png"
    
    iconutil -c icns "$ICONSET_DIR" -o "$BUILD_DIR/icon.icns"
    rm -rf "$ICONSET_DIR"
    
    echo "  Generated icon.icns"
fi

# Generate Windows .ico (requires ImageMagick)
if [ "$CONVERTER" = "imagemagick" ]; then
    echo "Generating Windows .ico..."
    
    convert "$BUILD_DIR/icons/icon_16x16.png" \
            "$BUILD_DIR/icons/icon_32x32.png" \
            "$BUILD_DIR/icons/icon_48x48.png" \
            "$BUILD_DIR/icons/icon_64x64.png" \
            "$BUILD_DIR/icons/icon_128x128.png" \
            "$BUILD_DIR/icons/icon_256x256.png" \
            "$BUILD_DIR/icon.ico"
    
    echo "  Generated icon.ico"
fi

echo ""
echo "Icon generation complete!"
echo ""
echo "Generated files:"
ls -la "$BUILD_DIR"/icon.* 2>/dev/null || true
ls -la "$ASSETS_DIR"/*.png 2>/dev/null || true

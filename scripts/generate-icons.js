/**
 * McServer Icon Generator
 * 
 * This script generates PNG icons from the SVG source.
 * Run with: node scripts/generate-icons.js
 * 
 * Requires: sharp (npm install sharp)
 */

const fs = require('fs');
const path = require('path');

// Check if sharp is available
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('Sharp not installed. Install with: npm install sharp');
  console.log('Alternatively, use an online SVG to PNG converter.');
  console.log('');
  console.log('Required icons:');
  console.log('  - build/icon.png (1024x1024)');
  console.log('  - build/icon.icns (macOS app icon)');
  console.log('  - build/icon.ico (Windows app icon)');
  console.log('  - assets/icon.png (512x512)');
  console.log('  - assets/tray-icon.png (32x32)');
  process.exit(0);
}

const svgPath = path.join(__dirname, '../build/icon.svg');
const svg = fs.readFileSync(svgPath);

const sizes = [
  { name: 'build/icon.png', size: 1024 },
  { name: 'assets/icon.png', size: 512 },
  { name: 'assets/tray-icon.png', size: 32 },
  { name: 'build/icons/icon_16x16.png', size: 16 },
  { name: 'build/icons/icon_32x32.png', size: 32 },
  { name: 'build/icons/icon_48x48.png', size: 48 },
  { name: 'build/icons/icon_64x64.png', size: 64 },
  { name: 'build/icons/icon_128x128.png', size: 128 },
  { name: 'build/icons/icon_256x256.png', size: 256 },
  { name: 'build/icons/icon_512x512.png', size: 512 },
  { name: 'build/icons/icon_1024x1024.png', size: 1024 },
];

async function generateIcons() {
  // Ensure directories exist
  fs.mkdirSync(path.join(__dirname, '../build/icons'), { recursive: true });
  fs.mkdirSync(path.join(__dirname, '../assets'), { recursive: true });
  
  for (const { name, size } of sizes) {
    const outputPath = path.join(__dirname, '..', name);
    await sharp(svg)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    console.log(`Generated: ${name} (${size}x${size})`);
  }
  
  console.log('');
  console.log('PNG icons generated!');
  console.log('');
  console.log('For macOS .icns and Windows .ico files:');
  console.log('  macOS: Use iconutil to create .icns from iconset folder');
  console.log('  Windows: Use a tool like png2ico or online converter');
}

generateIcons().catch(console.error);

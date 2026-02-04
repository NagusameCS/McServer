# Building McServer Desktop App

This document covers building McServer as a native desktop application for distribution.

## Quick Start (Development)

```bash
# Install dependencies
npm install

# Build and run in Electron
npm run dev:electron
```

## Distribution Builds

### Prerequisites

- Node.js 18+
- npm or yarn
- For macOS: Xcode Command Line Tools
- For Windows: Visual Studio Build Tools
- For code signing: Apple Developer account / Windows code signing certificate

### Building for All Platforms

```bash
# Build for all platforms (from macOS only)
npm run electron:all
```

### Platform-Specific Builds

```bash
# macOS (DMG for direct distribution)
npm run electron:mac

# macOS App Store
npm run electron:mac:mas

# Windows (NSIS installer + portable)
npm run electron:win

# Linux (AppImage + deb)
npm run electron:linux
```

## macOS Distribution

### Direct Distribution (DMG)

1. **Generate Icons** (run on macOS):
   ```bash
   ./scripts/generate-icons.sh
   ```

2. **Set up Code Signing**:
   - Get a Developer ID Application certificate from Apple Developer Portal
   - Install it in your Keychain

3. **Set up Notarization** (required for Gatekeeper):
   Create a `.env` file with:
   ```
   APPLE_ID=your@email.com
   APPLE_APP_SPECIFIC_PASSWORD=xxxx-xxxx-xxxx-xxxx
   APPLE_TEAM_ID=XXXXXXXXXX
   ```
   
   Generate app-specific password at: https://appleid.apple.com/account/manage

4. **Build**:
   ```bash
   npm run electron:mac
   ```

5. Output will be in `release/` directory

### Mac App Store Distribution

1. **Create App in App Store Connect**:
   - Go to https://appstoreconnect.apple.com
   - Create new app with bundle ID `com.nagusamecs.mcserver`

2. **Generate Provisioning Profile**:
   - Go to Apple Developer Portal > Certificates, Identifiers & Profiles
   - Create Mac App Store provisioning profile
   - Download and save as `build/embedded.provisionprofile`

3. **Set Environment Variables**:
   ```bash
   export CSC_IDENTITY_AUTO_DISCOVERY=false
   export CSC_NAME="3rd Party Mac Developer Application: Your Name (TEAM_ID)"
   export CSC_INSTALLER_NAME="3rd Party Mac Developer Installer: Your Name (TEAM_ID)"
   ```

4. **Build**:
   ```bash
   npm run electron:mac:mas
   ```

5. **Upload to App Store Connect**:
   ```bash
   xcrun altool --upload-app -f "release/McServer-1.0.0-beta.1-universal.pkg" \
     -t macos -u your@email.com -p @keychain:AC_PASSWORD
   ```

## Windows Distribution

### Prerequisites

- Windows 10/11 or cross-compile from macOS/Linux using Wine
- Optional: EV Code Signing Certificate for SmartScreen reputation

### Building

```bash
npm run electron:win
```

### Code Signing (Optional but Recommended)

Set environment variables:
```bash
export WIN_CSC_LINK=/path/to/certificate.pfx
export WIN_CSC_KEY_PASSWORD=your_password
```

## Linux Distribution

### Building

```bash
npm run electron:linux
```

### Output Formats

- **AppImage**: Universal, runs on most distributions
- **deb**: For Debian/Ubuntu-based systems
- **rpm**: For Fedora/RHEL (add to package.json if needed)

## Icon Generation

Icons must be generated on macOS for best results:

```bash
# On macOS with ImageMagick installed
brew install imagemagick
./scripts/generate-icons.sh
```

This generates:
- `build/icon.icns` - macOS app icon
- `build/icon.ico` - Windows app icon
- `build/icons/` - Various PNG sizes for Linux
- `assets/icon.png` - App icon (256x256)
- `assets/tray-icon.png` - System tray icon (32x32)

## Troubleshooting

### "App is damaged" on macOS

The app wasn't notarized. Either:
1. Set up notarization (see above)
2. Users can bypass with: `xattr -cr /Applications/McServer.app`

### Windows SmartScreen Warning

Without an EV code signing certificate, users will see a warning. They can click "More info" > "Run anyway".

### Linux "Permission denied"

AppImages need to be made executable:
```bash
chmod +x McServer-*.AppImage
```

## CI/CD Integration

See `.github/workflows/` for automated builds. You'll need to set up secrets:

- `APPLE_ID` - Apple ID email
- `APPLE_APP_SPECIFIC_PASSWORD` - App-specific password
- `APPLE_TEAM_ID` - Team ID
- `CSC_LINK` - Base64-encoded .p12 certificate
- `CSC_KEY_PASSWORD` - Certificate password
- `WIN_CSC_LINK` - Windows certificate (base64)
- `WIN_CSC_KEY_PASSWORD` - Windows certificate password

## Development Tips

### Running in Development Mode

```bash
# Terminal 1: Start backend with hot reload
npm run dev

# Terminal 2: Start dashboard dev server
npm run dev:dashboard

# Terminal 3: Run Electron pointing to dev servers
npm run dev:electron
```

### Debugging Electron

Press `Cmd+Option+I` (macOS) or `Ctrl+Shift+I` (Windows/Linux) to open DevTools.

For main process debugging, use VS Code's Electron debugging configuration.

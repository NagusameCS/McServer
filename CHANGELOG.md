# Changelog

All notable changes to McServer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0-beta.1] - 2026-02-04

### Added
- **Web-based Setup Wizard**: Graphical setup wizard in the dashboard replacing CLI wizard
  - 5-step guided setup: Welcome, Java Check, GitHub Config, Server Profile, Complete
  - Auto-detects Java installation
  - Optional GitHub sync configuration
  - Server profile creation with loader selection (Vanilla/Fabric/Forge)
- **Custom SVG Logo**: Minecraft-themed server block design with animated elements
- **Redesigned GitHub Pages**: Modern landing page with SVG icons and responsive design
- **Easy Launchers**: One-click start scripts for Windows (.bat) and macOS/Linux (.sh)
  - Automatic dependency checking (Node.js, Git, Java)
  - Auto-install prompts for missing software
  - Auto-launches dashboard with browser opening

### Changed
- **UI Polish**: Replaced all emoji usage with SVG icons for professional app appearance
- **Simplified Startup**: Launchers now auto-start the dashboard (wizard appears on first run)
- **Documentation**: Updated README with cleaner formatting (removed emojis)

### Technical
- Added setup status API endpoints for wizard flow
- Created reusable Icons component with 15+ SVG icons
- All 34 unit tests passing
- TypeScript strict mode compliant

## [0.1.0] - 2026-02-03

### Added
- Initial release with core functionality
- Multi-loader support (Vanilla, Forge, Fabric)
- GitHub-based world synchronization
- Lock mechanism for single-host guarantee
- NAT traversal via playit.gg, ngrok, or Cloudflare tunnels
- Mod management with compatibility checking
- Automatic versioned backups
- Web dashboard with real-time status
- CLI interface with full control
- Role-based access control (owner, admin, member)
- Encrypted credential storage

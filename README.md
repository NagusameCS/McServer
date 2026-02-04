# McServer

**Cross-platform Minecraft server hosting with world sync and NAT traversal.**

McServer allows a group of friends to host and share a single persistent Minecraft Java Edition world. Any user can locally host the server, and players anywhere in the world can connect without port forwarding.

## ✨ Features

- 🎮 **Multi-loader support**: Vanilla, Forge, and Fabric servers
- 🔄 **World synchronization**: Uses GitHub as turn-based persistent storage
- 🔒 **Lock mechanism**: Ensures only one host is active at any time
- 🌐 **NAT traversal**: Players can connect without port forwarding (via playit.gg, ngrok, or Cloudflare)
- 📦 **Mod management**: Integrated mod support with compatibility checking
- 💾 **Automatic backups**: Versioned world backups with easy recovery
- 🖥️ **Web dashboard**: Real-time server status, player list, and controls
- ⌨️ **CLI interface**: Full command-line control

## 🚀 Quick Start (5 minutes)

### Prerequisites

- **Java 17 or newer** - [Download from Adoptium](https://adoptium.net/)
- **Git** - [Download from git-scm.com](https://git-scm.com/)
- **GitHub account** - For world synchronization

### Installation

1. Download the latest release for your platform:
   - `mcserver-win.exe` for Windows
   - `mcserver-macos` for macOS
   - `mcserver-linux` for Linux

2. Open a terminal and initialize McServer:

```bash
mcserver init
```

3. Configure GitHub for world sync:

```bash
mcserver config github
```

You'll need:
- Your GitHub username
- A repository name (will be created if it doesn't exist)
- A personal access token with `repo` permissions

4. Create a server profile:

```bash
mcserver profile create
```

5. Start the server:

```bash
mcserver start
```

That's it! 🎉 Share the connection address with your friends.

## 📖 Usage

### CLI Commands

```bash
# Initialize McServer
mcserver init

# Create a new server profile
mcserver profile create

# List all profiles
mcserver profile list

# Start the server
mcserver start [profileId]

# Stop the server
mcserver stop

# Check server status
mcserver status

# Start web dashboard
mcserver dashboard

# Configure GitHub sync
mcserver config github

# Configure tunnel
mcserver config tunnel

# Emergency unlock (use with caution)
mcserver unlock
```

### Web Dashboard

Start the dashboard:

```bash
mcserver dashboard --port 3847
```

Open http://localhost:3847 in your browser.

Features:
- Real-time server status
- Player list with join/leave notifications
- Start/stop server controls
- Console output streaming
- Mod management
- Sync history

### Server Types

| Type | Description | Best For |
|------|-------------|----------|
| **Vanilla** | Official Minecraft server | Simple multiplayer |
| **Forge** | Full mod support | Heavy modpacks |
| **Fabric** | Lightweight mods | Performance + mods |

### Mod Management

For Forge/Fabric servers:

1. Add mods to the `mods/` folder in your profile directory
2. McServer automatically checks compatibility
3. View mod list in the web dashboard or CLI

Compatibility checks:
- Loader type mismatch detection
- Minecraft version verification
- Duplicate mod detection
- Missing dependency warnings

## 🔧 Configuration

### GitHub Sync

World data is synchronized using GitHub. When you start hosting:

1. McServer acquires a lock (prevents concurrent hosts)
2. Pulls the latest world from GitHub
3. Starts the Minecraft server
4. When you stop, pushes changes back to GitHub
5. Releases the lock

### NAT Traversal

McServer supports three tunnel providers:

| Provider | Free Tier | Setup |
|----------|-----------|-------|
| **playit.gg** | Yes, unlimited | Auto-setup, no account needed |
| **ngrok** | Yes, limited | Requires account + token |
| **Cloudflare** | Yes | Requires account + tunnel setup |

Configure with:

```bash
mcserver config tunnel
```

### Backups

Automatic backups are created:
- Before every sync operation
- Every 30 minutes while running (configurable)
- Manually via CLI or dashboard

Restore from backup:

```bash
# List backups
mcserver backup list

# Restore specific backup
mcserver backup restore <backupId>
```

## 🏗️ Architecture

```
McServer/
├── data/                    # User data directory
│   ├── config.yaml          # Configuration
│   ├── profiles/            # Server profiles
│   │   └── <profile-id>/    # Individual profile
│   │       ├── server.jar   # Minecraft server
│   │       ├── world/       # World data
│   │       ├── mods/        # Mods (Forge/Fabric)
│   │       └── ...
│   ├── sync/                # Git repository clone
│   └── backups/             # World backups
└── logs/                    # Application logs
```

## 🔐 Security

- GitHub tokens are encrypted using AES-256-GCM with a machine-specific key
- Web dashboard supports authentication with JWT tokens
- Role-based access control (owner, admin, member)

## 🐛 Troubleshooting

### "Lock is held by another user"

Another user is currently hosting. Either:
- Wait for them to finish
- Contact them to release the lock
- Use `mcserver unlock` (emergency only, may cause data loss)

### "Java not found"

Install Java 17 or newer and ensure it's in your PATH.

### "Failed to connect to tunnel"

- Check your internet connection
- Try a different tunnel provider
- Ensure firewall isn't blocking the connection

### "Mod compatibility errors"

- Ensure all mods are for the correct Minecraft version
- Ensure all mods are for the correct loader (Forge vs Fabric)
- Check for duplicate mods
- Install missing dependencies

## 🛠️ Development

### Building from source

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development
npm run dev

# Package for distribution
npm run package
```

### Project Structure

```
src/
├── index.ts          # Main entry point
├── cli/              # CLI commands (Commander.js)
├── web/              # Web dashboard (Express + Socket.IO)
├── server/           # Minecraft server management
├── sync/             # GitHub sync and locking
├── mods/             # Mod parsing and compatibility
├── tunnel/           # NAT traversal (playit, ngrok, cloudflare)
├── backup/           # Backup and recovery
├── config/           # Configuration management
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── constants.ts      # Application constants
```

## 🤝 Contributing

Contributions are welcome! Please read the contributing guidelines first.

## 📄 License

MIT License - see [LICENSE](LICENSE) for details.

---

Made with ❤️ for Minecraft communities everywhere
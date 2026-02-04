/**
 * McServer - Electron Server Entry Point
 * 
 * This file starts the web server when running inside Electron.
 * It's a standalone entry point that doesn't use the CLI.
 */

const path = require('path');
const fs = require('fs');

// Determine if we're in a packaged app or development
const isPackaged = !process.defaultApp;

// Set up paths based on environment
let basePath;
if (isPackaged) {
  // In packaged app, resources are in app.asar or resourcesPath
  basePath = path.join(process.resourcesPath, 'app');
} else {
  // In development, use the project root
  basePath = path.join(__dirname, '..');
}

// Set environment variables for the server
process.env.MCSERVER_BASE_PATH = basePath;
process.env.MCSERVER_DASHBOARD_PATH = path.join(basePath, 'dashboard', 'dist');
process.env.PORT = process.env.PORT || '3847';
process.env.ELECTRON = 'true';

// Ensure dist path exists
const distPath = path.join(basePath, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('Error: dist folder not found at', distPath);
  process.exit(1);
}

// Import and start the web server
async function startServer() {
  try {
    // Load the compiled server code
    const { WebServer } = require(path.join(distPath, 'web', 'index.js'));
    const { serverManager } = require(path.join(distPath, 'server', 'index.js'));
    const configManager = require(path.join(distPath, 'config', 'index.js')).default;
    
    // Initialize
    await configManager.initialize();
    await serverManager.initialize();
    
    // Start web server
    const port = parseInt(process.env.PORT);
    const webServer = new WebServer(port);
    await webServer.initialize();
    await webServer.start();
    
    console.log(`[McServer] Dashboard running at http://localhost:${port}`);
    
    // Signal ready to parent process
    if (process.send) {
      process.send({ type: 'ready', port });
    }
    
    // Handle shutdown
    process.on('SIGTERM', async () => {
      console.log('[McServer] Shutting down...');
      await webServer.stop();
      process.exit(0);
    });
    
    process.on('SIGINT', async () => {
      console.log('[McServer] Shutting down...');
      await webServer.stop();
      process.exit(0);
    });
    
  } catch (error) {
    console.error('[McServer] Failed to start:', error);
    if (process.send) {
      process.send({ type: 'error', message: error.message });
    }
    process.exit(1);
  }
}

startServer();

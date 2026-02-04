const { app, BrowserWindow, shell, Menu, Tray, nativeImage, dialog } = require('electron');
const path = require('path');
const { spawn, fork } = require('child_process');
const http = require('http');

// Keep references to prevent garbage collection
let mainWindow = null;
let tray = null;
let serverProcess = null;
let isQuitting = false;

const PORT = 3847;
const isDev = process.env.NODE_ENV === 'development';

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// Get icon path that works in both dev and packaged app
function getIconPath(iconName) {
  const isPackaged = app.isPackaged;
  const possiblePaths = isPackaged ? [
    path.join(process.resourcesPath, 'app', 'assets', iconName),
    path.join(process.resourcesPath, 'assets', iconName),
    path.join(__dirname, '..', 'assets', iconName),
  ] : [
    path.join(__dirname, '..', 'assets', iconName),
    path.join(__dirname, '..', 'build', 'icons', iconName),
  ];
  
  for (const p of possiblePaths) {
    try {
      if (require('fs').existsSync(p)) {
        return p;
      }
    } catch (e) {}
  }
  return possiblePaths[0]; // Fallback
}

// Create the main application window
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'McServer',
    icon: getIconPath('icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for some features
    },
    backgroundColor: '#1a1a2e',
    show: false, // Don't show until ready
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Load the dashboard
  mainWindow.loadURL(`http://localhost:${PORT}`);

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Prevent closing, minimize to tray instead
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
      return false;
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create system tray
function createTray() {
  const iconPath = getIconPath('tray-icon.png');
  let icon = null;
  
  try {
    if (require('fs').existsSync(iconPath)) {
      icon = nativeImage.createFromPath(iconPath);
    }
  } catch (e) {
    console.log('Could not load tray icon:', e.message);
  }
  
  // Create empty icon if none found
  if (!icon || icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }
  
  tray = new Tray(icon.resize({ width: 16, height: 16 }));
  tray.setToolTip('McServer');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Open McServer',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Dashboard',
      click: () => {
        shell.openExternal(`http://localhost:${PORT}`);
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

// Create application menu
function createMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    }] : []),
    {
      label: 'File',
      submenu: [
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'zoom' },
        ...(process.platform === 'darwin' ? [
          { type: 'separator' },
          { role: 'front' }
        ] : [
          { role: 'close' }
        ])
      ]
    },
    {
      role: 'help',
      submenu: [
        {
          label: 'Documentation',
          click: () => {
            shell.openExternal('https://nagusamecs.github.io/McServer/');
          }
        },
        {
          label: 'Report Issue',
          click: () => {
            shell.openExternal('https://github.com/NagusameCS/McServer/issues');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Wait for server to be ready
function waitForServer(maxAttempts = 30) {
  return new Promise((resolve, reject) => {
    let attempts = 0;
    
    const check = () => {
      attempts++;
      
      const req = http.get(`http://localhost:${PORT}/api/health`, (res) => {
        if (res.statusCode === 200) {
          resolve();
        } else if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Server failed to respond'));
        }
      });
      
      req.on('error', () => {
        if (attempts < maxAttempts) {
          setTimeout(check, 500);
        } else {
          reject(new Error('Server failed to start'));
        }
      });
      
      req.end();
    };
    
    check();
  });
}

// Start the backend server
async function startServer() {
  return new Promise((resolve, reject) => {
    // Use the dedicated server entry point
    const serverPath = path.join(__dirname, 'server.js');
    
    console.log('Starting server from:', serverPath);
    console.log('isDev:', isDev);
    console.log('resourcesPath:', process.resourcesPath);
    
    serverProcess = fork(serverPath, [], {
      env: {
        ...process.env,
        PORT: PORT.toString(),
        ELECTRON: 'true',
        NODE_ENV: isDev ? 'development' : 'production'
      },
      stdio: ['pipe', 'pipe', 'pipe', 'ipc']
    });
    
    // Listen for ready message from server
    serverProcess.on('message', (msg) => {
      if (msg.type === 'ready') {
        console.log('Server ready on port:', msg.port);
        resolve();
      } else if (msg.type === 'error') {
        console.error('Server error:', msg.message);
        reject(new Error(msg.message));
      }
    });
    
    serverProcess.stdout?.on('data', (data) => {
      console.log('[Server]', data.toString().trim());
    });
    
    serverProcess.stderr?.on('data', (data) => {
      console.error('[Server Error]', data.toString().trim());
    });
    
    serverProcess.on('error', (err) => {
      console.error('Failed to start server:', err);
      reject(err);
    });
    
    serverProcess.on('exit', (code) => {
      console.log('Server exited with code:', code);
      if (!isQuitting && code !== 0) {
        // Server crashed, show error
        dialog.showErrorBox('Server Error', 'The McServer backend has stopped unexpectedly.');
      }
    });
    
    // Fallback: wait for HTTP server if IPC message doesn't arrive
    setTimeout(() => {
      if (serverProcess && !serverProcess.killed) {
        waitForServer()
          .then(resolve)
          .catch(reject);
      }
    }, 2000);
  });
}

// Stop the backend server
function stopServer() {
  if (serverProcess) {
    serverProcess.kill();
    serverProcess = null;
  }
}

// App lifecycle
app.whenReady().then(async () => {
  try {
    // Start backend server
    await startServer();
    
    // Create UI
    createMenu();
    createWindow();
    createTray();
  } catch (error) {
    console.error('Failed to initialize:', error);
    dialog.showErrorBox('Startup Error', `Failed to start McServer: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  // On macOS, keep app running in menu bar
  if (process.platform !== 'darwin') {
    isQuitting = true;
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  } else {
    mainWindow.show();
  }
});

app.on('before-quit', () => {
  isQuitting = true;
  stopServer();
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', error.message);
});

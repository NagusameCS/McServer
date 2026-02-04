/**
 * McServer - Server Manager
 * 
 * High-level server management coordinating process, sync, and tunnel.
 */

import path from 'path';
import fs from 'fs-extra';
import { EventEmitter } from 'events';
import { ServerProcess } from './process';
import { downloadServer } from './downloader';
import { SyncManager } from '../sync';
import configManager from '../config';
import { 
  ServerProfile, 
  ServerState, 
  ServerType,
  ServerSettings,
  SyncResult,
  DashboardState
} from '../types';
import { DEFAULT_SERVER_SETTINGS, DEFAULT_PROFILE } from '../constants';
import { createLogger, generateId, findJava, getJavaVersion } from '../utils';

const logger = createLogger('ServerManager');

export class ServerManager extends EventEmitter {
  private serverProcess: ServerProcess | null = null;
  private syncManager: SyncManager | null = null;
  private initialized: boolean = false;
  private currentProfile: ServerProfile | null = null;

  constructor() {
    super();
  }

  /**
   * Initialize server manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Ensure config is loaded
    await configManager.initialize();

    // Initialize sync if GitHub is configured
    if (configManager.isGitHubConfigured()) {
      this.syncManager = new SyncManager(configManager.github!);
      await this.syncManager.initialize();
    }

    this.initialized = true;
    logger.info('Server manager initialized');
  }

  /**
   * Create a new server profile
   */
  async createProfile(options: {
    name: string;
    type: ServerType;
    minecraftVersion: string;
    loaderVersion?: string;
    settings?: Partial<ServerSettings>;
  }): Promise<ServerProfile> {
    const profile: ServerProfile = {
      id: generateId(),
      name: options.name,
      type: options.type,
      minecraftVersion: options.minecraftVersion,
      loaderVersion: options.loaderVersion,
      createdAt: new Date(),
      updatedAt: new Date(),
      settings: {
        ...DEFAULT_SERVER_SETTINGS,
        ...options.settings
      },
      worldName: 'world',
      autoRestart: DEFAULT_PROFILE.autoRestart,
      maxRestarts: DEFAULT_PROFILE.maxRestarts
    };

    await configManager.addProfile(profile);
    
    // Create profile directories
    const profileDir = this.getProfileDir(profile.id);
    await fs.ensureDir(profileDir);
    await fs.ensureDir(path.join(profileDir, 'mods'));
    await fs.ensureDir(path.join(profileDir, 'config'));

    logger.info(`Profile created: ${profile.name} (${profile.type})`);
    
    return profile;
  }

  /**
   * Delete a server profile
   */
  async deleteProfile(profileId: string): Promise<void> {
    // Ensure server is stopped
    if (this.currentProfile?.id === profileId && this.isServerRunning()) {
      throw new Error('Cannot delete active profile while server is running');
    }

    const profileDir = this.getProfileDir(profileId);
    
    // Backup before delete
    if (this.syncManager) {
      await this.syncManager.createBackup(profileId, 'manual');
    }

    await fs.remove(profileDir);
    await configManager.deleteProfile(profileId);
    
    logger.info(`Profile deleted: ${profileId}`);
  }

  /**
   * Setup server for a profile (download JAR, etc.)
   */
  async setupServer(
    profileId: string,
    onProgress?: (message: string, progress: number) => void
  ): Promise<void> {
    const profile = configManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Check Java
    onProgress?.('Checking Java installation...', 0);
    const javaVersion = await getJavaVersion();
    if (!javaVersion) {
      throw new Error('Java not found. Please install Java 17 or newer.');
    }
    logger.info(`Java version: ${javaVersion}`);

    const profileDir = this.getProfileDir(profileId);
    await fs.ensureDir(profileDir);

    // Download server JAR
    onProgress?.('Downloading server files...', 20);
    
    const jarPath = await downloadServer(
      profile.type,
      profile.minecraftVersion,
      profileDir,
      {
        loaderVersion: profile.loaderVersion,
        onProgress: (p) => onProgress?.('Downloading server files...', 20 + (p * 0.6))
      }
    );

    // For Forge, run the installer
    if (profile.type === 'forge') {
      onProgress?.('Installing Forge...', 80);
      await this.installForge(profileDir, jarPath);
    }

    onProgress?.('Setup complete!', 100);
    logger.info(`Server setup complete for profile: ${profile.name}`);
  }

  /**
   * Install Forge using the installer JAR
   */
  private async installForge(profileDir: string, installerPath: string): Promise<void> {
    const javaPath = await findJava();
    if (!javaPath) throw new Error('Java not found');

    const { spawn } = await import('child_process');

    return new Promise((resolve, reject) => {
      const proc = spawn(javaPath, ['-jar', installerPath, '--installServer'], {
        cwd: profileDir,
        stdio: 'pipe'
      });

      let output = '';

      proc.stdout?.on('data', (data) => {
        output += data.toString();
      });

      proc.stderr?.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          logger.info('Forge installed successfully');
          resolve();
        } else {
          logger.error('Forge installation failed', { output });
          reject(new Error('Forge installation failed'));
        }
      });

      proc.on('error', reject);
    });
  }

  /**
   * Start the server for a profile
   */
  async startServer(profileId: string): Promise<void> {
    if (this.serverProcess?.isRunning()) {
      throw new Error('Server is already running');
    }

    const profile = configManager.getProfile(profileId);
    if (!profile) {
      throw new Error(`Profile not found: ${profileId}`);
    }

    // Sync: Acquire lock and download latest
    if (this.syncManager) {
      logger.info('Acquiring lock and syncing world...');
      const syncResult = await this.syncManager.acquireAndSync(profileId);
      
      if (!syncResult.success) {
        throw new Error(`Sync failed: ${syncResult.error}`);
      }
    }

    const profileDir = this.getProfileDir(profileId);
    const jarPath = await this.findServerJar(profileDir, profile.type);

    if (!jarPath) {
      throw new Error('Server JAR not found. Run setup first.');
    }

    // Create server process
    this.serverProcess = new ServerProcess(profile, profileDir, jarPath);
    this.currentProfile = profile;

    // Forward events
    this.serverProcess.on('starting', () => this.emit('server:starting'));
    this.serverProcess.on('started', () => this.emit('server:started'));
    this.serverProcess.on('stopping', () => this.emit('server:stopping'));
    this.serverProcess.on('stopped', (code) => this.emit('server:stopped', code));
    this.serverProcess.on('crashed', (info) => this.emit('server:crashed', info));
    this.serverProcess.on('player:joined', (p) => this.emit('player:joined', p));
    this.serverProcess.on('player:left', (p) => this.emit('player:left', p));
    this.serverProcess.on('log', (line) => this.emit('server:log', line));

    await this.serverProcess.start();
    await configManager.setActiveProfile(profileId);
  }

  /**
   * Stop the server
   */
  async stopServer(): Promise<SyncResult | null> {
    if (!this.serverProcess || !this.serverProcess.isRunning()) {
      return null;
    }

    const profileId = this.currentProfile?.id;

    // Stop server
    await this.serverProcess.stop();
    this.serverProcess = null;

    // Sync: Upload world and release lock
    if (this.syncManager && profileId) {
      logger.info('Uploading world and releasing lock...');
      const syncResult = await this.syncManager.syncAndRelease(profileId);
      
      if (!syncResult.success) {
        logger.error('Failed to sync world after stop', { error: syncResult.error });
      }
      
      return syncResult;
    }

    return null;
  }

  /**
   * Restart the server
   */
  async restartServer(): Promise<void> {
    if (!this.serverProcess) {
      throw new Error('No server is running');
    }

    await this.serverProcess.restart();
  }

  /**
   * Send command to server
   */
  sendCommand(command: string): void {
    if (!this.serverProcess?.isRunning()) {
      throw new Error('Server is not running');
    }
    this.serverProcess.sendCommand(command);
  }

  /**
   * Get server state
   */
  getServerState(): ServerState | null {
    return this.serverProcess?.getState() ?? null;
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.serverProcess?.isRunning() ?? false;
  }

  /**
   * Get current profile
   */
  getCurrentProfile(): ServerProfile | null {
    return this.currentProfile;
  }

  /**
   * Get sync manager
   */
  getSyncManager(): SyncManager | null {
    return this.syncManager;
  }

  /**
   * Get profile directory
   */
  getProfileDir(profileId: string): string {
    return path.join(configManager.serverDir, 'profiles', profileId);
  }

  /**
   * Find server JAR in profile directory
   */
  private async findServerJar(profileDir: string, type: ServerType): Promise<string | null> {
    const files = await fs.readdir(profileDir);

    for (const file of files) {
      if (!file.endsWith('.jar')) continue;

      // Skip installers
      if (file.includes('installer')) continue;

      const filePath = path.join(profileDir, file);

      switch (type) {
        case 'vanilla':
          if (file.includes('minecraft_server') || file.startsWith('server')) {
            return filePath;
          }
          break;
        
        case 'forge':
          // Look for forge server JAR (not installer)
          if ((file.includes('forge') || file.includes('minecraftforge')) && 
              !file.includes('installer')) {
            return filePath;
          }
          // Also check for run scripts
          const forgeJar = files.find(f => 
            f.endsWith('.jar') && 
            !f.includes('installer') && 
            (f.includes('forge') || f.startsWith('minecraft_server'))
          );
          if (forgeJar) return path.join(profileDir, forgeJar);
          break;
        
        case 'fabric':
          if (file.includes('fabric-server') || file.includes('fabric-mc')) {
            return filePath;
          }
          break;
      }
    }

    // Fallback: first JAR that's not an installer
    const fallback = files.find(f => 
      f.endsWith('.jar') && !f.includes('installer')
    );
    
    return fallback ? path.join(profileDir, fallback) : null;
  }

  /**
   * Emergency cleanup
   */
  async emergencyCleanup(): Promise<void> {
    logger.warn('Emergency cleanup initiated');

    // Kill server if running
    if (this.serverProcess) {
      this.serverProcess.kill();
    }

    // Release lock
    if (this.syncManager) {
      await this.syncManager.emergencyRelease('Emergency cleanup');
    }
  }

  /**
   * Graceful shutdown
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down server manager...');

    if (this.serverProcess?.isRunning()) {
      await this.stopServer();
    }

    if (this.syncManager) {
      await this.syncManager.cleanup();
    }

    logger.info('Server manager shut down');
  }

  /**
   * Get dashboard state
   */
  async getDashboardState(): Promise<DashboardState> {
    const serverState = this.getServerState() || {
      status: 'stopped' as const,
      profileId: null,
      startTime: null,
      players: [],
      lastCrash: null,
      restartCount: 0,
      pid: null
    };

    const syncState = this.syncManager?.getSyncState() || {
      lastSyncTime: null,
      lastCommitHash: null,
      pendingChanges: false,
      syncInProgress: false,
      lastError: null
    };

    const lockState = await this.syncManager?.getLockState() || {
      locked: false,
      lockedBy: null,
      lockedAt: null,
      machineId: null,
      reason: null,
      expiresAt: null
    };

    const javaVersion = await getJavaVersion();
    const os = await import('os');

    return {
      server: serverState,
      sync: syncState,
      lock: lockState,
      tunnel: {
        status: 'disconnected',
        publicAddress: null,
        localPort: 25565,
        startTime: null,
        lastError: null,
        bytesIn: 0,
        bytesOut: 0
      },
      currentProfile: this.currentProfile,
      recentEvents: [],
      systemInfo: {
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        appVersion: '1.0.0',
        javaVersion,
        memoryUsage: {
          used: process.memoryUsage().heapUsed,
          total: process.memoryUsage().heapTotal
        },
        diskUsage: {
          used: 0,
          total: 0
        }
      }
    };
  }
}

// Export singleton instance
export const serverManager = new ServerManager();
export default serverManager;

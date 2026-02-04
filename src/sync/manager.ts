/**
 * McServer - Sync Manager
 * 
 * Coordinates world synchronization and lock management.
 */

import path from 'path';
import fs from 'fs-extra';
import { GitManager } from './git';
import { LockManager } from './lock';
import { 
  GitHubConfig, 
  SyncState, 
  SyncResult, 
  LockState, 
  WorldVersion,
  BackupInfo 
} from '../types';
import { DEFAULT_SERVER_DIR, DEFAULT_BACKUP_DIR, STATE_FILE } from '../constants';
import { createLogger, hashFile, getDirectorySize, atomicWrite, generateId } from '../utils';

const logger = createLogger('Sync');

interface SyncStateFile {
  lastSyncTime: string | null;
  lastCommitHash: string | null;
  lastError: string | null;
  profileId: string | null;
}

export class SyncManager {
  private gitManager: GitManager;
  private lockManager: LockManager;
  private config: GitHubConfig;
  private repoPath: string;
  private state: SyncState;
  private profileId: string | null = null;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.repoPath = path.join(DEFAULT_SERVER_DIR, 'repo');
    this.gitManager = new GitManager(this.repoPath, config);
    this.lockManager = new LockManager(config);
    this.state = {
      lastSyncTime: null,
      lastCommitHash: null,
      pendingChanges: false,
      syncInProgress: false,
      lastError: null
    };
  }

  /**
   * Initialize sync manager
   */
  async initialize(): Promise<void> {
    await this.lockManager.initialize();
    await this.gitManager.initialize();
    await this.loadState();
    logger.info('Sync manager initialized');
  }

  /**
   * Load sync state from disk
   */
  private async loadState(): Promise<void> {
    const statePath = path.join(DEFAULT_SERVER_DIR, STATE_FILE);
    
    try {
      if (await fs.pathExists(statePath)) {
        const content = await fs.readFile(statePath, 'utf-8');
        const savedState = JSON.parse(content) as SyncStateFile;
        
        this.state = {
          lastSyncTime: savedState.lastSyncTime ? new Date(savedState.lastSyncTime) : null,
          lastCommitHash: savedState.lastCommitHash,
          pendingChanges: false,
          syncInProgress: false,
          lastError: savedState.lastError
        };
        
        this.profileId = savedState.profileId;
      }
    } catch (error) {
      logger.warn('Failed to load sync state', { error });
    }
  }

  /**
   * Save sync state to disk
   */
  private async saveState(): Promise<void> {
    const statePath = path.join(DEFAULT_SERVER_DIR, STATE_FILE);
    
    const stateToSave: SyncStateFile = {
      lastSyncTime: this.state.lastSyncTime?.toISOString() || null,
      lastCommitHash: this.state.lastCommitHash,
      lastError: this.state.lastError,
      profileId: this.profileId
    };

    await atomicWrite(statePath, JSON.stringify(stateToSave, null, 2));
  }

  /**
   * Acquire lock and download latest world
   */
  async acquireAndSync(profileId: string): Promise<SyncResult> {
    this.profileId = profileId;

    // First check lock availability
    const isAvailable = await this.lockManager.isAvailable();
    if (!isAvailable) {
      const lockState = await this.lockManager.getState();
      return {
        success: false,
        error: `Server is locked by ${lockState.lockedBy} since ${lockState.lockedAt?.toISOString()}`
      };
    }

    // Acquire lock
    const lockAcquired = await this.lockManager.acquire(`Hosting profile: ${profileId}`);
    if (!lockAcquired) {
      return {
        success: false,
        error: 'Failed to acquire lock - another host may have just started'
      };
    }

    // Pull latest changes
    this.state.syncInProgress = true;
    logger.info('Downloading latest world data...');

    try {
      const pullResult = await this.gitManager.pull();
      
      if (!pullResult.success) {
        await this.lockManager.release();
        this.state.syncInProgress = false;
        return {
          success: false,
          error: `Failed to download world: ${pullResult.error}`
        };
      }

      // Verify world integrity
      const worldPath = this.getWorldPath(profileId);
      if (await fs.pathExists(worldPath)) {
        const isValid = await this.verifyWorldIntegrity(worldPath);
        if (!isValid) {
          logger.warn('World integrity check failed - proceeding with caution');
        }
      }

      this.state.lastSyncTime = new Date();
      this.state.lastCommitHash = pullResult.commitHash || null;
      this.state.syncInProgress = false;
      this.state.lastError = null;
      
      await this.saveState();

      logger.info('World synchronized successfully');
      
      return {
        success: true,
        commitHash: pullResult.commitHash,
        filesChanged: pullResult.filesChanged
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.syncInProgress = false;
      this.state.lastError = message;
      
      await this.lockManager.release();
      
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Upload world and release lock
   */
  async syncAndRelease(profileId: string): Promise<SyncResult> {
    // Verify we hold the lock
    const isHolder = await this.lockManager.isLockHolder();
    if (!isHolder) {
      return {
        success: false,
        error: 'Cannot sync - we do not hold the lock'
      };
    }

    this.state.syncInProgress = true;
    logger.info('Uploading world data...');

    try {
      // Create backup before upload
      await this.createBackup(profileId, 'pre-shutdown');

      // Calculate world hash for verification
      const worldPath = this.getWorldPath(profileId);
      const worldHash = await this.calculateWorldHash(worldPath);

      // Push changes
      const timestamp = new Date().toISOString();
      const message = `[profile:${profileId}] World save - ${timestamp}\n\nHash: ${worldHash}`;
      
      const pushResult = await this.gitManager.push(message);

      if (!pushResult.success) {
        this.state.syncInProgress = false;
        return {
          success: false,
          error: `Failed to upload world: ${pushResult.error}`
        };
      }

      // Release lock
      await this.lockManager.release();

      this.state.lastSyncTime = new Date();
      this.state.lastCommitHash = pushResult.commitHash || null;
      this.state.pendingChanges = false;
      this.state.syncInProgress = false;
      this.state.lastError = null;

      await this.saveState();

      logger.info('World uploaded and lock released');

      return {
        success: true,
        commitHash: pushResult.commitHash,
        filesChanged: pushResult.filesChanged
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.syncInProgress = false;
      this.state.lastError = message;
      
      logger.error('Sync failed', { error: message });
      
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Emergency release lock (e.g., after crash)
   */
  async emergencyRelease(reason: string): Promise<boolean> {
    logger.warn('Emergency lock release requested', { reason });
    return await this.lockManager.forceRelease(reason);
  }

  /**
   * Get world path for a profile
   */
  getWorldPath(profileId: string): string {
    return path.join(this.repoPath, 'worlds', profileId);
  }

  /**
   * Get mods path for a profile
   */
  getModsPath(profileId: string): string {
    return path.join(this.repoPath, 'mods', profileId);
  }

  /**
   * Get config path for a profile
   */
  getConfigPath(profileId: string): string {
    return path.join(this.repoPath, 'config', profileId);
  }

  /**
   * Create a backup of the current world
   */
  async createBackup(profileId: string, type: 'auto' | 'manual' | 'pre-shutdown'): Promise<BackupInfo> {
    const worldPath = this.getWorldPath(profileId);
    const backupId = generateId();
    const backupPath = path.join(DEFAULT_BACKUP_DIR, profileId, backupId);

    await fs.ensureDir(backupPath);
    await fs.copy(worldPath, backupPath);

    const size = await getDirectorySize(backupPath);
    const hash = await this.calculateWorldHash(backupPath);

    const backup: BackupInfo = {
      id: backupId,
      profileId,
      commitHash: this.state.lastCommitHash || '',
      timestamp: new Date(),
      size,
      description: `${type} backup`,
      type,
      verified: true,
      hash
    };

    // Save backup info
    const infoPath = path.join(backupPath, 'backup.json');
    await atomicWrite(infoPath, JSON.stringify(backup, null, 2));

    logger.info(`Backup created: ${backupId}`, { type, size });

    return backup;
  }

  /**
   * Restore from a backup
   */
  async restoreBackup(profileId: string, backupId: string): Promise<SyncResult> {
    const backupPath = path.join(DEFAULT_BACKUP_DIR, profileId, backupId);
    const worldPath = this.getWorldPath(profileId);

    if (!await fs.pathExists(backupPath)) {
      return {
        success: false,
        error: `Backup not found: ${backupId}`
      };
    }

    // Create a backup of current state first
    await this.createBackup(profileId, 'pre-shutdown');

    // Restore
    await fs.emptyDir(worldPath);
    await fs.copy(backupPath, worldPath, {
      filter: (src) => !src.endsWith('backup.json')
    });

    logger.info(`Restored from backup: ${backupId}`);

    return { success: true };
  }

  /**
   * Get version history
   */
  async getHistory(limit: number = 50): Promise<WorldVersion[]> {
    return await this.gitManager.getHistory(limit);
  }

  /**
   * Restore to a specific version
   */
  async restoreVersion(commitHash: string): Promise<SyncResult> {
    const isHolder = await this.lockManager.isLockHolder();
    if (!isHolder) {
      return {
        success: false,
        error: 'Must hold lock to restore versions'
      };
    }

    return await this.gitManager.restore(commitHash);
  }

  /**
   * Verify world integrity
   */
  private async verifyWorldIntegrity(worldPath: string): Promise<boolean> {
    try {
      // Check for essential files
      const levelDat = path.join(worldPath, 'level.dat');
      
      if (!await fs.pathExists(levelDat)) {
        logger.warn('level.dat not found - may be a new world');
        return true; // New world is OK
      }

      // Check file is not empty/corrupted
      const stat = await fs.stat(levelDat);
      if (stat.size < 100) {
        logger.error('level.dat appears corrupted (too small)');
        return false;
      }

      return true;
    } catch (error) {
      logger.error('World integrity check failed', { error });
      return false;
    }
  }

  /**
   * Calculate hash of world directory
   */
  private async calculateWorldHash(worldPath: string): Promise<string> {
    try {
      const levelDat = path.join(worldPath, 'level.dat');
      if (await fs.pathExists(levelDat)) {
        return await hashFile(levelDat);
      }
      return 'empty';
    } catch {
      return 'unknown';
    }
  }

  /**
   * Get current states
   */
  getSyncState(): SyncState {
    return { ...this.state };
  }

  async getLockState(): Promise<LockState> {
    return await this.lockManager.getState();
  }

  /**
   * Check if sync is in progress
   */
  isSyncing(): boolean {
    return this.state.syncInProgress;
  }

  /**
   * Mark that there are pending changes
   */
  markPendingChanges(): void {
    this.state.pendingChanges = true;
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.lockManager.cleanup();
    await this.saveState();
  }
}

export default SyncManager;

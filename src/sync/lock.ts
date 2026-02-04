/**
 * McServer - Lock Manager
 * 
 * Distributed lock mechanism using GitHub to prevent concurrent server hosting.
 * Only one host can be active at a time.
 */

import axios from 'axios';
import { LockState, GitHubConfig } from '../types';
import { LOCK_TIMEOUT, LOCK_REFRESH_INTERVAL, LOCK_FILE } from '../constants';
import { createLogger, getMachineId, generateToken } from '../utils';

const logger = createLogger('Lock');

interface LockFileContent {
  locked: boolean;
  lockedBy: string;
  lockedAt: string;
  machineId: string;
  reason: string;
  expiresAt: string;
  sessionId: string;
}

export class LockManager {
  private config: GitHubConfig;
  private currentLock: LockState | null = null;
  private refreshInterval: NodeJS.Timeout | null = null;
  private machineId: string | null = null;
  private sessionId: string;

  constructor(config: GitHubConfig) {
    this.config = config;
    this.sessionId = generateToken(16);
  }

  /**
   * Initialize lock manager
   */
  async initialize(): Promise<void> {
    this.machineId = await getMachineId();
    logger.info('Lock manager initialized', { machineId: this.machineId });
  }

  /**
   * Get GitHub API headers
   */
  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.config.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'X-GitHub-Api-Version': '2022-11-28'
    };
  }

  /**
   * Get lock file URL
   */
  private getLockUrl(): string {
    return `https://api.github.com/repos/${this.config.owner}/${this.config.repo}/contents/${LOCK_FILE}`;
  }

  /**
   * Acquire lock
   */
  async acquire(reason: string = 'Hosting server'): Promise<boolean> {
    try {
      // Check current lock state
      const currentState = await this.getState();

      if (currentState.locked) {
        // Check if lock is expired
        if (currentState.expiresAt && new Date(currentState.expiresAt) < new Date()) {
          logger.info('Existing lock has expired, taking over...');
          await this.forceRelease('Lock expired');
        } else if (currentState.machineId === this.machineId) {
          // We already hold the lock (maybe from a crash recovery)
          logger.info('Recovering existing lock from same machine');
          this.currentLock = currentState;
          this.startRefreshInterval();
          return true;
        } else {
          logger.warn('Lock held by another host', { 
            lockedBy: currentState.lockedBy,
            machineId: currentState.machineId 
          });
          return false;
        }
      }

      // Create lock
      const lockContent: LockFileContent = {
        locked: true,
        lockedBy: require('os').hostname(),
        lockedAt: new Date().toISOString(),
        machineId: this.machineId!,
        reason,
        expiresAt: new Date(Date.now() + LOCK_TIMEOUT).toISOString(),
        sessionId: this.sessionId
      };

      const success = await this.writeLockFile(lockContent);

      if (success) {
        this.currentLock = {
          locked: true,
          lockedBy: lockContent.lockedBy,
          lockedAt: new Date(lockContent.lockedAt),
          machineId: lockContent.machineId,
          reason: lockContent.reason,
          expiresAt: new Date(lockContent.expiresAt)
        };

        this.startRefreshInterval();
        logger.info('Lock acquired successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to acquire lock', { error });
      return false;
    }
  }

  /**
   * Release lock
   */
  async release(): Promise<boolean> {
    try {
      this.stopRefreshInterval();

      // Verify we hold the lock
      const currentState = await this.getState();
      
      if (!currentState.locked) {
        logger.info('Lock already released');
        this.currentLock = null;
        return true;
      }

      if (currentState.machineId !== this.machineId) {
        logger.warn('Cannot release lock - held by different machine');
        return false;
      }

      // Delete lock file
      const success = await this.deleteLockFile();

      if (success) {
        this.currentLock = null;
        logger.info('Lock released successfully');
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to release lock', { error });
      return false;
    }
  }

  /**
   * Force release lock (for emergencies/crashes)
   */
  async forceRelease(reason: string): Promise<boolean> {
    logger.warn('Force releasing lock', { reason });
    this.stopRefreshInterval();

    try {
      const success = await this.deleteLockFile();
      this.currentLock = null;
      return success;
    } catch (error) {
      logger.error('Failed to force release lock', { error });
      return false;
    }
  }

  /**
   * Get current lock state from GitHub
   */
  async getState(): Promise<LockState> {
    try {
      const response = await axios.get(this.getLockUrl(), {
        headers: this.getHeaders(),
        validateStatus: (status) => status === 200 || status === 404
      });

      if (response.status === 404) {
        return {
          locked: false,
          lockedBy: null,
          lockedAt: null,
          machineId: null,
          reason: null,
          expiresAt: null
        };
      }

      const content = Buffer.from(response.data.content, 'base64').toString('utf-8');
      const lockData = JSON.parse(content) as LockFileContent;

      return {
        locked: lockData.locked,
        lockedBy: lockData.lockedBy,
        lockedAt: new Date(lockData.lockedAt),
        machineId: lockData.machineId,
        reason: lockData.reason,
        expiresAt: new Date(lockData.expiresAt)
      };
    } catch (error) {
      logger.error('Failed to get lock state', { error });
      return {
        locked: false,
        lockedBy: null,
        lockedAt: null,
        machineId: null,
        reason: null,
        expiresAt: null
      };
    }
  }

  /**
   * Check if we hold the lock
   */
  async isLockHolder(): Promise<boolean> {
    const state = await this.getState();
    return state.locked && state.machineId === this.machineId;
  }

  /**
   * Check if server is available (not locked by others)
   */
  async isAvailable(): Promise<boolean> {
    const state = await this.getState();
    
    if (!state.locked) return true;
    
    // Check if expired
    if (state.expiresAt && new Date(state.expiresAt) < new Date()) {
      return true;
    }
    
    // Check if we hold it
    if (state.machineId === this.machineId) {
      return true;
    }
    
    return false;
  }

  /**
   * Refresh lock expiration
   */
  private async refreshLock(): Promise<void> {
    try {
      const state = await this.getState();
      
      if (!state.locked || state.machineId !== this.machineId) {
        logger.warn('Lock was lost or taken by another host');
        this.stopRefreshInterval();
        return;
      }

      const lockContent: LockFileContent = {
        locked: true,
        lockedBy: state.lockedBy!,
        lockedAt: state.lockedAt!.toISOString(),
        machineId: this.machineId!,
        reason: state.reason!,
        expiresAt: new Date(Date.now() + LOCK_TIMEOUT).toISOString(),
        sessionId: this.sessionId
      };

      await this.writeLockFile(lockContent);
      logger.debug('Lock refreshed');
    } catch (error) {
      logger.error('Failed to refresh lock', { error });
    }
  }

  /**
   * Start lock refresh interval
   */
  private startRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    
    this.refreshInterval = setInterval(() => {
      this.refreshLock();
    }, LOCK_REFRESH_INTERVAL);
  }

  /**
   * Stop lock refresh interval
   */
  private stopRefreshInterval(): void {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
      this.refreshInterval = null;
    }
  }

  /**
   * Write lock file to GitHub
   */
  private async writeLockFile(content: LockFileContent): Promise<boolean> {
    try {
      const base64Content = Buffer.from(JSON.stringify(content, null, 2)).toString('base64');
      
      // Try to get existing file SHA
      let sha: string | undefined;
      try {
        const existingResponse = await axios.get(this.getLockUrl(), {
          headers: this.getHeaders()
        });
        sha = existingResponse.data.sha;
      } catch {
        // File doesn't exist yet
      }

      const requestData: Record<string, string> = {
        message: `Lock: ${content.reason}`,
        content: base64Content,
        branch: this.config.branch
      };

      if (sha) {
        requestData.sha = sha;
      }

      await axios.put(this.getLockUrl(), requestData, {
        headers: this.getHeaders()
      });

      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        // Conflict - lock was modified by another process
        logger.warn('Lock conflict detected');
        return false;
      }
      throw error;
    }
  }

  /**
   * Delete lock file from GitHub
   */
  private async deleteLockFile(): Promise<boolean> {
    try {
      // Get file SHA
      const existingResponse = await axios.get(this.getLockUrl(), {
        headers: this.getHeaders()
      });

      await axios.delete(this.getLockUrl(), {
        headers: this.getHeaders(),
        data: {
          message: 'Release lock',
          sha: existingResponse.data.sha,
          branch: this.config.branch
        }
      });

      return true;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        // Already deleted
        return true;
      }
      throw error;
    }
  }

  /**
   * Get lock info for display
   */
  getCurrentLock(): LockState | null {
    return this.currentLock;
  }

  /**
   * Cleanup on shutdown
   */
  async cleanup(): Promise<void> {
    this.stopRefreshInterval();
    if (this.currentLock) {
      await this.release();
    }
  }
}

export default LockManager;

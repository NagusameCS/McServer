/**
 * McServer - Git Manager
 * 
 * Handles Git operations for world synchronization with LFS support.
 */

import simpleGit, { SimpleGit, SimpleGitOptions } from 'simple-git';
import fs from 'fs-extra';
import path from 'path';
import { GitHubConfig, SyncResult, WorldVersion } from '../types';
import { GIT_LFS_PATTERNS, SYNC_IGNORE_PATTERNS } from '../constants';
import { createLogger, hashFile, retry, atomicWrite } from '../utils';

const logger = createLogger('Git');

export class GitManager {
  private git: SimpleGit | null = null;
  private repoPath: string;
  private config: GitHubConfig;
  private initialized: boolean = false;

  constructor(repoPath: string, config: GitHubConfig) {
    this.repoPath = repoPath;
    this.config = config;
  }

  /**
   * Initialize Git repository
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.repoPath);

    const gitOptions: Partial<SimpleGitOptions> = {
      baseDir: this.repoPath,
      binary: 'git',
      maxConcurrentProcesses: 1,
      trimmed: true
    };

    this.git = simpleGit(gitOptions);

    // Check if repo exists
    const isRepo = await fs.pathExists(path.join(this.repoPath, '.git'));

    if (!isRepo) {
      await this.cloneRepository();
    } else {
      await this.configureRepository();
    }

    this.initialized = true;
    logger.info('Git manager initialized');
  }

  /**
   * Clone the repository
   */
  private async cloneRepository(): Promise<void> {
    const repoUrl = this.getRepoUrl();
    
    logger.info(`Cloning repository: ${this.config.owner}/${this.config.repo}`);
    
    const tempGit = simpleGit();
    
    try {
      await tempGit.clone(repoUrl, this.repoPath, ['--branch', this.config.branch]);
      
      // Reinitialize git instance for the cloned repo
      this.git = simpleGit({
        baseDir: this.repoPath,
        binary: 'git',
        maxConcurrentProcesses: 1,
        trimmed: true
      });
      
      await this.configureRepository();
      logger.info('Repository cloned successfully');
    } catch (error) {
      // If clone fails (empty repo), initialize new repo
      logger.info('Repository appears to be empty, initializing new repository');
      await this.initializeNewRepository();
    }
  }

  /**
   * Initialize a new repository
   */
  private async initializeNewRepository(): Promise<void> {
    this.git = simpleGit({
      baseDir: this.repoPath,
      binary: 'git',
      maxConcurrentProcesses: 1,
      trimmed: true
    });

    await this.git.init();
    await this.git.addRemote('origin', this.getRepoUrl());
    await this.configureRepository();
    
    // Create initial commit
    await this.createGitIgnore();
    await this.setupLFS();
    await this.git.add('.gitignore');
    await this.git.add('.gitattributes');
    await this.git.commit('Initial commit - McServer setup');
    
    try {
      await this.git.push('origin', this.config.branch, ['--set-upstream']);
    } catch (error) {
      logger.warn('Could not push initial commit - will push on first sync');
    }
  }

  /**
   * Configure repository settings
   */
  private async configureRepository(): Promise<void> {
    if (!this.git) return;

    await this.git.addConfig('user.name', 'McServer');
    await this.git.addConfig('user.email', 'mcserver@localhost');
    await this.git.addConfig('core.autocrlf', 'false');
    await this.git.addConfig('core.safecrlf', 'false');

    // Configure credential helper
    const token = this.config.token;
    const credentialUrl = `https://x-access-token:${token}@github.com`;
    await this.git.addConfig('credential.helper', 'store');

    logger.debug('Repository configured');
  }

  /**
   * Get repository URL with authentication
   */
  private getRepoUrl(): string {
    return `https://x-access-token:${this.config.token}@github.com/${this.config.owner}/${this.config.repo}.git`;
  }

  /**
   * Create .gitignore file
   */
  private async createGitIgnore(): Promise<void> {
    const gitignorePath = path.join(this.repoPath, '.gitignore');
    const content = SYNC_IGNORE_PATTERNS.join('\n');
    await atomicWrite(gitignorePath, content);
  }

  /**
   * Setup Git LFS
   */
  private async setupLFS(): Promise<void> {
    if (!this.config.lfsEnabled || !this.git) return;

    try {
      // Install LFS
      await this.git.raw(['lfs', 'install']);

      // Track large file patterns
      for (const pattern of GIT_LFS_PATTERNS) {
        await this.git.raw(['lfs', 'track', pattern]);
      }

      logger.info('Git LFS configured');
    } catch (error) {
      logger.warn('Git LFS not available - large files may cause issues', { error });
    }
  }

  /**
   * Pull latest changes from remote
   */
  async pull(): Promise<SyncResult> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      logger.info('Pulling latest changes...');
      
      // Fetch first
      await retry(async () => {
        await this.git!.fetch('origin', this.config.branch);
      });

      // Check for changes
      const status = await this.git.status();
      
      if (status.behind > 0) {
        // Pull changes
        await retry(async () => {
          await this.git!.pull('origin', this.config.branch, ['--rebase=false']);
        });
        
        logger.info(`Pulled ${status.behind} commits`);
      }

      const log = await this.git.log(['-1']);
      
      return {
        success: true,
        commitHash: log.latest?.hash,
        filesChanged: status.behind
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Pull failed', { error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Push changes to remote
   */
  async push(message: string): Promise<SyncResult> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      // Check for changes
      const status = await this.git.status();
      
      if (!status.isClean()) {
        logger.info('Staging changes...');
        
        // Add all changes
        await this.git.add('.');
        
        // Commit
        const commitResult = await this.git.commit(message);
        
        logger.info(`Committed: ${commitResult.commit}`);
      }

      // Push
      logger.info('Pushing to remote...');
      
      await retry(async () => {
        await this.git!.push('origin', this.config.branch);
      });

      const log = await this.git.log(['-1']);
      
      logger.info('Push successful');
      
      return {
        success: true,
        commitHash: log.latest?.hash,
        filesChanged: status.staged.length + status.modified.length + status.created.length
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Push failed', { error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Get world version history
   */
  async getHistory(limit: number = 50): Promise<WorldVersion[]> {
    if (!this.git) return [];

    try {
      const log = await this.git.log(['-' + limit]);
      
      return log.all.map(commit => ({
        commitHash: commit.hash,
        message: commit.message,
        timestamp: new Date(commit.date),
        author: commit.author_name,
        size: 0, // Would need to calculate
        profileId: this.extractProfileId(commit.message)
      }));
    } catch (error) {
      logger.error('Failed to get history', { error });
      return [];
    }
  }

  /**
   * Restore to a specific commit
   */
  async restore(commitHash: string): Promise<SyncResult> {
    if (!this.git) {
      return { success: false, error: 'Git not initialized' };
    }

    try {
      logger.info(`Restoring to commit: ${commitHash}`);
      
      // Create a backup branch first
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      await this.git.checkout(['-b', `backup-${timestamp}`]);
      await this.git.checkout(this.config.branch);
      
      // Reset to specified commit
      await this.git.reset(['--hard', commitHash]);
      
      // Force push (dangerous but necessary for restore)
      await this.git.push('origin', this.config.branch, ['--force']);
      
      logger.info('Restore successful');
      
      return { success: true, commitHash };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Restore failed', { error: message });
      return { success: false, error: message };
    }
  }

  /**
   * Check if there are uncommitted changes
   */
  async hasChanges(): Promise<boolean> {
    if (!this.git) return false;

    try {
      const status = await this.git.status();
      return !status.isClean();
    } catch {
      return false;
    }
  }

  /**
   * Get current commit hash
   */
  async getCurrentCommit(): Promise<string | null> {
    if (!this.git) return null;

    try {
      const log = await this.git.log(['-1']);
      return log.latest?.hash || null;
    } catch {
      return null;
    }
  }

  /**
   * Check if remote is ahead
   */
  async isRemoteAhead(): Promise<boolean> {
    if (!this.git) return false;

    try {
      await this.git.fetch('origin', this.config.branch);
      const status = await this.git.status();
      return status.behind > 0;
    } catch {
      return false;
    }
  }

  /**
   * Verify repository integrity
   */
  async verify(): Promise<boolean> {
    if (!this.git) return false;

    try {
      await this.git.raw(['fsck', '--full']);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract profile ID from commit message
   */
  private extractProfileId(message: string): string {
    const match = message.match(/\[profile:([^\]]+)\]/);
    return match ? match[1] : 'unknown';
  }

  /**
   * Get repository size
   */
  async getRepoSize(): Promise<number> {
    try {
      const { getDirectorySize } = await import('../utils/helpers');
      return await getDirectorySize(this.repoPath);
    } catch {
      return 0;
    }
  }

  /**
   * Cleanup - remove untracked files
   */
  async cleanup(): Promise<void> {
    if (!this.git) return;

    try {
      await this.git.clean('f', ['-d']);
      logger.info('Repository cleaned');
    } catch (error) {
      logger.error('Cleanup failed', { error });
    }
  }

  /**
   * Check if initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

export default GitManager;

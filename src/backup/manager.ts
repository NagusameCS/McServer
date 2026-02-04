/**
 * McServer - Backup Manager
 * 
 * Handles world backups with versioning and recovery.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createLogger } from '../utils';

const logger = createLogger('BackupManager');

export interface BackupInfo {
  id: string;
  profileId: string;
  timestamp: Date;
  size: number;
  type: 'auto' | 'manual' | 'pre-sync';
  description?: string;
  worldName: string;
  minecraftVersion: string;
}

export interface BackupConfig {
  enabled: boolean;
  maxBackups: number;
  intervalMinutes: number;
  includeConfigs: boolean;
  includeMods: boolean;
}

export class BackupManager {
  private backupDir: string;
  private config: BackupConfig;
  private autoBackupTimer: NodeJS.Timeout | null = null;

  constructor(backupDir: string, config?: Partial<BackupConfig>) {
    this.backupDir = backupDir;
    this.config = {
      enabled: true,
      maxBackups: 10,
      intervalMinutes: 30,
      includeConfigs: true,
      includeMods: false,
      ...config
    };
  }

  /**
   * Initialize backup directory
   */
  async initialize(): Promise<void> {
    await fs.promises.mkdir(this.backupDir, { recursive: true });
    logger.info('Backup manager initialized', { backupDir: this.backupDir });
  }

  /**
   * Create a backup of the world
   */
  async createBackup(
    serverDir: string,
    profileId: string,
    type: 'auto' | 'manual' | 'pre-sync',
    description?: string
  ): Promise<BackupInfo> {
    const timestamp = new Date();
    const id = `${profileId}-${timestamp.getTime()}`;
    const backupPath = path.join(this.backupDir, `${id}.tar.gz`);
    
    logger.info('Creating backup', { id, type, profileId });

    // Collect files to backup
    const filesToBackup: string[] = [];
    
    // Always backup world folder
    const worldDir = path.join(serverDir, 'world');
    if (await this.exists(worldDir)) {
      const worldFiles = await this.collectFiles(worldDir, serverDir);
      filesToBackup.push(...worldFiles);
    }

    // Backup nether and end
    const netherDir = path.join(serverDir, 'world_nether');
    if (await this.exists(netherDir)) {
      filesToBackup.push(...await this.collectFiles(netherDir, serverDir));
    }
    
    const endDir = path.join(serverDir, 'world_the_end');
    if (await this.exists(endDir)) {
      filesToBackup.push(...await this.collectFiles(endDir, serverDir));
    }

    // Backup configs if enabled
    if (this.config.includeConfigs) {
      const configFiles = ['server.properties', 'whitelist.json', 'ops.json', 'banned-players.json', 'banned-ips.json'];
      for (const file of configFiles) {
        const filePath = path.join(serverDir, file);
        if (await this.exists(filePath)) {
          filesToBackup.push(file);
        }
      }
    }

    // Backup mods if enabled
    if (this.config.includeMods) {
      const modsDir = path.join(serverDir, 'mods');
      if (await this.exists(modsDir)) {
        filesToBackup.push(...await this.collectFiles(modsDir, serverDir));
      }
    }

    // Create tarball
    await this.createTarball(serverDir, filesToBackup, backupPath);

    const stats = await fs.promises.stat(backupPath);

    // Read world metadata
    const levelDat = path.join(worldDir, 'level.dat');
    let worldName = 'world';
    let minecraftVersion = 'unknown';
    
    // Try to read server.properties for world name
    const serverProps = path.join(serverDir, 'server.properties');
    if (await this.exists(serverProps)) {
      const content = await fs.promises.readFile(serverProps, 'utf-8');
      const levelNameMatch = content.match(/^level-name=(.+)$/m);
      if (levelNameMatch) {
        worldName = levelNameMatch[1];
      }
    }

    const backupInfo: BackupInfo = {
      id,
      profileId,
      timestamp,
      size: stats.size,
      type,
      description,
      worldName,
      minecraftVersion
    };

    // Save metadata
    await this.saveBackupMetadata(backupInfo);

    // Cleanup old backups
    await this.cleanupOldBackups(profileId);

    logger.info('Backup created', { id, size: stats.size, files: filesToBackup.length });
    return backupInfo;
  }

  /**
   * Restore a backup
   */
  async restoreBackup(
    backupId: string,
    serverDir: string,
    options: { overwrite?: boolean; clearExisting?: boolean } = {}
  ): Promise<void> {
    const backup = await this.getBackup(backupId);
    if (!backup) {
      throw new Error(`Backup not found: ${backupId}`);
    }

    const backupPath = path.join(this.backupDir, `${backupId}.tar.gz`);
    if (!await this.exists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    logger.info('Restoring backup', { backupId, serverDir });

    // Clear existing world if requested
    if (options.clearExisting) {
      const worldDirs = ['world', 'world_nether', 'world_the_end'];
      for (const dir of worldDirs) {
        const dirPath = path.join(serverDir, dir);
        if (await this.exists(dirPath)) {
          await fs.promises.rm(dirPath, { recursive: true });
        }
      }
    }

    // Extract tarball
    await this.extractTarball(backupPath, serverDir);

    logger.info('Backup restored', { backupId });
  }

  /**
   * List all backups for a profile
   */
  async listBackups(profileId?: string): Promise<BackupInfo[]> {
    const metadataFile = path.join(this.backupDir, 'metadata.json');
    
    if (!await this.exists(metadataFile)) {
      return [];
    }

    const content = await fs.promises.readFile(metadataFile, 'utf-8');
    const allBackups: BackupInfo[] = JSON.parse(content);

    let backups = allBackups.map(b => ({
      ...b,
      timestamp: new Date(b.timestamp)
    }));

    if (profileId) {
      backups = backups.filter(b => b.profileId === profileId);
    }

    return backups.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get a specific backup
   */
  async getBackup(backupId: string): Promise<BackupInfo | null> {
    const backups = await this.listBackups();
    return backups.find(b => b.id === backupId) || null;
  }

  /**
   * Delete a backup
   */
  async deleteBackup(backupId: string): Promise<void> {
    const backupPath = path.join(this.backupDir, `${backupId}.tar.gz`);
    
    if (await this.exists(backupPath)) {
      await fs.promises.unlink(backupPath);
    }

    // Update metadata
    const metadataFile = path.join(this.backupDir, 'metadata.json');
    if (await this.exists(metadataFile)) {
      const content = await fs.promises.readFile(metadataFile, 'utf-8');
      const backups: BackupInfo[] = JSON.parse(content);
      const filtered = backups.filter(b => b.id !== backupId);
      await fs.promises.writeFile(metadataFile, JSON.stringify(filtered, null, 2));
    }

    logger.info('Backup deleted', { backupId });
  }

  /**
   * Start automatic backups
   */
  startAutoBackup(serverDir: string, profileId: string): void {
    if (!this.config.enabled || this.autoBackupTimer) {
      return;
    }

    const intervalMs = this.config.intervalMinutes * 60 * 1000;
    
    this.autoBackupTimer = setInterval(async () => {
      try {
        await this.createBackup(serverDir, profileId, 'auto');
      } catch (error) {
        logger.error('Auto backup failed', { error: (error as Error).message });
      }
    }, intervalMs);

    logger.info('Auto backup started', { intervalMinutes: this.config.intervalMinutes });
  }

  /**
   * Stop automatic backups
   */
  stopAutoBackup(): void {
    if (this.autoBackupTimer) {
      clearInterval(this.autoBackupTimer);
      this.autoBackupTimer = null;
      logger.info('Auto backup stopped');
    }
  }

  /**
   * Verify backup integrity
   */
  async verifyBackup(backupId: string): Promise<{ valid: boolean; error?: string }> {
    const backupPath = path.join(this.backupDir, `${backupId}.tar.gz`);
    
    if (!await this.exists(backupPath)) {
      return { valid: false, error: 'Backup file not found' };
    }

    try {
      // Try to read and decompress the file
      const tempPath = path.join(this.backupDir, '.verify-temp');
      await fs.promises.mkdir(tempPath, { recursive: true });
      
      // Just verify we can decompress the header
      const input = fs.createReadStream(backupPath, { end: 1024 * 1024 }); // First 1MB
      const gunzip = createGunzip();
      
      await new Promise<void>((resolve, reject) => {
        input.pipe(gunzip);
        gunzip.on('data', () => {});
        gunzip.on('end', resolve);
        gunzip.on('error', reject);
        input.on('error', reject);
      });

      await fs.promises.rm(tempPath, { recursive: true });
      return { valid: true };
    } catch (error) {
      return { valid: false, error: (error as Error).message };
    }
  }

  /**
   * Get backup statistics
   */
  async getStats(profileId?: string): Promise<{
    totalBackups: number;
    totalSize: number;
    oldestBackup: Date | null;
    newestBackup: Date | null;
  }> {
    const backups = await this.listBackups(profileId);
    
    return {
      totalBackups: backups.length,
      totalSize: backups.reduce((sum, b) => sum + b.size, 0),
      oldestBackup: backups.length > 0 ? backups[backups.length - 1].timestamp : null,
      newestBackup: backups.length > 0 ? backups[0].timestamp : null
    };
  }

  // Private methods

  private async exists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async collectFiles(dir: string, baseDir: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = await fs.promises.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.relative(baseDir, fullPath);
      
      if (entry.isDirectory()) {
        files.push(...await this.collectFiles(fullPath, baseDir));
      } else {
        files.push(relativePath);
      }
    }
    
    return files;
  }

  private async createTarball(sourceDir: string, files: string[], outputPath: string): Promise<void> {
    // Simple tar implementation (header + content)
    const output = fs.createWriteStream(outputPath);
    const gzip = createGzip();
    
    gzip.pipe(output);

    for (const file of files) {
      const filePath = path.join(sourceDir, file);
      const stats = await fs.promises.stat(filePath);
      
      if (stats.isFile()) {
        // Write tar header
        const header = this.createTarHeader(file, stats.size);
        gzip.write(header);
        
        // Write file content
        const content = await fs.promises.readFile(filePath);
        gzip.write(content);
        
        // Pad to 512-byte boundary
        const padding = 512 - (stats.size % 512);
        if (padding < 512) {
          gzip.write(Buffer.alloc(padding));
        }
      }
    }

    // Write end-of-archive marker
    gzip.write(Buffer.alloc(1024));
    gzip.end();

    await new Promise<void>((resolve, reject) => {
      output.on('finish', resolve);
      output.on('error', reject);
    });
  }

  private createTarHeader(name: string, size: number): Buffer {
    const header = Buffer.alloc(512);
    
    // Name (100 bytes)
    const nameBytes = Buffer.from(name.replace(/\\/g, '/'));
    nameBytes.copy(header, 0, 0, Math.min(nameBytes.length, 100));
    
    // Mode (8 bytes)
    Buffer.from('0000644\0').copy(header, 100);
    
    // UID (8 bytes)
    Buffer.from('0000000\0').copy(header, 108);
    
    // GID (8 bytes)
    Buffer.from('0000000\0').copy(header, 116);
    
    // Size (12 bytes, octal)
    const sizeStr = size.toString(8).padStart(11, '0') + '\0';
    Buffer.from(sizeStr).copy(header, 124);
    
    // Mtime (12 bytes)
    const mtime = Math.floor(Date.now() / 1000).toString(8).padStart(11, '0') + '\0';
    Buffer.from(mtime).copy(header, 136);
    
    // Checksum placeholder (8 bytes of spaces)
    Buffer.from('        ').copy(header, 148);
    
    // Type flag (1 byte) - regular file
    header[156] = 48; // '0'
    
    // Calculate and set checksum
    let checksum = 0;
    for (let i = 0; i < 512; i++) {
      checksum += header[i];
    }
    const checksumStr = checksum.toString(8).padStart(6, '0') + '\0 ';
    Buffer.from(checksumStr).copy(header, 148);
    
    return header;
  }

  private async extractTarball(tarPath: string, destDir: string): Promise<void> {
    const input = fs.createReadStream(tarPath);
    const gunzip = createGunzip();
    
    const chunks: Buffer[] = [];
    
    await new Promise<void>((resolve, reject) => {
      input.pipe(gunzip);
      gunzip.on('data', (chunk) => chunks.push(chunk));
      gunzip.on('end', resolve);
      gunzip.on('error', reject);
      input.on('error', reject);
    });

    const data = Buffer.concat(chunks);
    let offset = 0;

    while (offset < data.length - 512) {
      const header = data.subarray(offset, offset + 512);
      
      // Check for end-of-archive
      if (header.every(b => b === 0)) {
        break;
      }

      // Parse header
      const name = header.subarray(0, 100).toString().replace(/\0/g, '').trim();
      const sizeOctal = header.subarray(124, 136).toString().replace(/\0/g, '').trim();
      const size = parseInt(sizeOctal, 8);
      const typeFlag = header[156];

      offset += 512;

      if (name && size > 0 && (typeFlag === 0 || typeFlag === 48)) { // Regular file
        const content = data.subarray(offset, offset + size);
        const filePath = path.join(destDir, name);
        
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
        await fs.promises.writeFile(filePath, content);
        
        // Move to next record (512-byte aligned)
        offset += Math.ceil(size / 512) * 512;
      }
    }
  }

  private async saveBackupMetadata(backup: BackupInfo): Promise<void> {
    const metadataFile = path.join(this.backupDir, 'metadata.json');
    
    let backups: BackupInfo[] = [];
    if (await this.exists(metadataFile)) {
      const content = await fs.promises.readFile(metadataFile, 'utf-8');
      backups = JSON.parse(content);
    }
    
    backups.push(backup);
    await fs.promises.writeFile(metadataFile, JSON.stringify(backups, null, 2));
  }

  private async cleanupOldBackups(profileId: string): Promise<void> {
    const backups = await this.listBackups(profileId);
    
    // Keep maxBackups, delete the rest
    if (backups.length > this.config.maxBackups) {
      const toDelete = backups.slice(this.config.maxBackups);
      for (const backup of toDelete) {
        await this.deleteBackup(backup.id);
      }
    }
  }
}

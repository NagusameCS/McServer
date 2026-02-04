/**
 * McServer - Mod Manager
 * 
 * High-level mod management including discovery, parsing, and compatibility checking.
 */

import fs from 'fs-extra';
import path from 'path';
import { 
  ModInfo, 
  ModCompatibilityResult, 
  ServerProfile 
} from '../types';
import { modParser } from './parser';
import { modCompatibilityChecker } from './checker';
import { MOD_FILE_EXTENSIONS } from '../constants';
import { createLogger, hashFile } from '../utils';

const logger = createLogger('ModManager');

export class ModManager {
  private modsDir: string;
  private mods: Map<string, ModInfo> = new Map();
  private initialized: boolean = false;

  constructor(modsDir: string) {
    this.modsDir = modsDir;
  }

  /**
   * Initialize mod manager and scan for mods
   */
  async initialize(): Promise<void> {
    await fs.ensureDir(this.modsDir);
    await this.scanMods();
    this.initialized = true;
    logger.info(`Mod manager initialized with ${this.mods.size} mods`);
  }

  /**
   * Scan mods directory and parse all mods
   */
  async scanMods(): Promise<ModInfo[]> {
    this.mods.clear();

    if (!await fs.pathExists(this.modsDir)) {
      return [];
    }

    const files = await fs.readdir(this.modsDir);
    const modFiles = files.filter(f => 
      MOD_FILE_EXTENSIONS.some(ext => f.endsWith(ext))
    );

    for (const file of modFiles) {
      const filePath = path.join(this.modsDir, file);
      
      try {
        const modInfo = await modParser.parseMod(filePath);
        if (modInfo) {
          this.mods.set(modInfo.id, modInfo);
          logger.debug(`Parsed mod: ${modInfo.name} (${modInfo.id})`);
        }
      } catch (error) {
        logger.warn(`Failed to parse mod: ${file}`, { error });
      }
    }

    return Array.from(this.mods.values());
  }

  /**
   * Get all mods
   */
  getMods(): ModInfo[] {
    return Array.from(this.mods.values());
  }

  /**
   * Get enabled mods
   */
  getEnabledMods(): ModInfo[] {
    return Array.from(this.mods.values()).filter(m => m.enabled);
  }

  /**
   * Get mod by ID
   */
  getMod(modId: string): ModInfo | undefined {
    return this.mods.get(modId);
  }

  /**
   * Get mod by file path
   */
  getModByPath(filePath: string): ModInfo | undefined {
    return Array.from(this.mods.values()).find(m => m.filePath === filePath);
  }

  /**
   * Enable a mod
   */
  async enableMod(modId: string): Promise<boolean> {
    const mod = this.mods.get(modId);
    if (!mod) return false;

    // If mod was disabled (renamed to .disabled), restore it
    if (mod.filePath.endsWith('.disabled')) {
      const originalPath = mod.filePath.replace('.disabled', '');
      await fs.rename(mod.filePath, originalPath);
      mod.filePath = originalPath;
      mod.fileName = path.basename(originalPath);
    }

    mod.enabled = true;
    logger.info(`Mod enabled: ${mod.name}`);
    return true;
  }

  /**
   * Disable a mod
   */
  async disableMod(modId: string): Promise<boolean> {
    const mod = this.mods.get(modId);
    if (!mod) return false;

    // Rename to .disabled
    if (!mod.filePath.endsWith('.disabled')) {
      const disabledPath = mod.filePath + '.disabled';
      await fs.rename(mod.filePath, disabledPath);
      mod.filePath = disabledPath;
      mod.fileName = path.basename(disabledPath);
    }

    mod.enabled = false;
    logger.info(`Mod disabled: ${mod.name}`);
    return true;
  }

  /**
   * Remove a mod
   */
  async removeMod(modId: string): Promise<boolean> {
    const mod = this.mods.get(modId);
    if (!mod) return false;

    await fs.remove(mod.filePath);
    this.mods.delete(modId);
    
    logger.info(`Mod removed: ${mod.name}`);
    return true;
  }

  /**
   * Add a mod from a file
   */
  async addMod(sourcePath: string): Promise<ModInfo | null> {
    if (!await fs.pathExists(sourcePath)) {
      throw new Error(`File not found: ${sourcePath}`);
    }

    const fileName = path.basename(sourcePath);
    const destPath = path.join(this.modsDir, fileName);

    // Check if already exists
    if (await fs.pathExists(destPath)) {
      throw new Error(`Mod already exists: ${fileName}`);
    }

    // Copy file
    await fs.copy(sourcePath, destPath);

    // Parse mod
    const modInfo = await modParser.parseMod(destPath);
    if (!modInfo) {
      await fs.remove(destPath);
      throw new Error('Failed to parse mod file');
    }

    // Check for duplicates by mod ID
    if (this.mods.has(modInfo.id)) {
      await fs.remove(destPath);
      throw new Error(`Mod already installed: ${modInfo.name} (${modInfo.id})`);
    }

    this.mods.set(modInfo.id, modInfo);
    logger.info(`Mod added: ${modInfo.name}`);
    
    return modInfo;
  }

  /**
   * Check mod compatibility for a profile
   */
  checkCompatibility(profile: ServerProfile): ModCompatibilityResult {
    const mods = this.getEnabledMods();
    return modCompatibilityChecker.checkCompatibility(
      mods,
      profile.type,
      profile.minecraftVersion
    );
  }

  /**
   * Check if server can start with current mods
   */
  canStartServer(profile: ServerProfile): { canStart: boolean; reason?: string } {
    const result = this.checkCompatibility(profile);

    if (profile.type === 'vanilla' && this.mods.size > 0) {
      return {
        canStart: false,
        reason: 'Vanilla server does not support mods. Remove mods or switch to Forge/Fabric.'
      };
    }

    if (!modCompatibilityChecker.canLoadMods(result)) {
      return {
        canStart: false,
        reason: modCompatibilityChecker.getSummary(result)
      };
    }

    return { canStart: true };
  }

  /**
   * Get compatibility summary
   */
  getCompatibilitySummary(profile: ServerProfile): string {
    const result = this.checkCompatibility(profile);
    return modCompatibilityChecker.getSummary(result);
  }

  /**
   * Get mods grouped by loader
   */
  getModsByLoader(): { forge: ModInfo[]; fabric: ModInfo[] } {
    const mods = this.getMods();
    return {
      forge: mods.filter(m => m.loader === 'forge'),
      fabric: mods.filter(m => m.loader === 'fabric')
    };
  }

  /**
   * Verify all mod files still exist and haven't changed
   */
  async verifyMods(): Promise<{ valid: ModInfo[]; invalid: string[] }> {
    const valid: ModInfo[] = [];
    const invalid: string[] = [];

    for (const [id, mod] of this.mods) {
      if (!await fs.pathExists(mod.filePath)) {
        invalid.push(id);
        continue;
      }

      const currentHash = await hashFile(mod.filePath);
      if (currentHash !== mod.hash) {
        // File changed, re-parse
        const updatedMod = await modParser.parseMod(mod.filePath);
        if (updatedMod) {
          this.mods.set(id, updatedMod);
          valid.push(updatedMod);
        } else {
          invalid.push(id);
        }
      } else {
        valid.push(mod);
      }
    }

    // Remove invalid mods from index
    for (const id of invalid) {
      this.mods.delete(id);
    }

    return { valid, invalid };
  }

  /**
   * Export mod list to JSON
   */
  exportModList(): string {
    const mods = this.getMods().map(m => ({
      id: m.id,
      name: m.name,
      version: m.version,
      loader: m.loader,
      enabled: m.enabled,
      fileName: m.fileName
    }));

    return JSON.stringify(mods, null, 2);
  }

  /**
   * Get total size of mods
   */
  async getTotalSize(): Promise<number> {
    let total = 0;
    for (const mod of this.mods.values()) {
      try {
        const stat = await fs.stat(mod.filePath);
        total += stat.size;
      } catch {}
    }
    return total;
  }

  /**
   * Get mod count
   */
  getModCount(): number {
    return this.mods.size;
  }

  /**
   * Is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}

/**
 * Create a mod manager for a profile
 */
export function createModManager(profileDir: string): ModManager {
  return new ModManager(path.join(profileDir, 'mods'));
}

export default ModManager;

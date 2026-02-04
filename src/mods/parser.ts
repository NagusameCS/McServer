/**
 * McServer - Mod Parser
 * 
 * Parses mod JAR files to extract metadata for Forge and Fabric mods.
 */

import fs from 'fs-extra';
import path from 'path';
import yauzl from 'yauzl';
import { promisify } from 'util';
import { ModInfo, ModDependency } from '../types';
import { FABRIC_MOD_JSON, FORGE_MOD_TOML, FORGE_MOD_INFO } from '../constants';
import { createLogger, hashFile, generateId } from '../utils';

const logger = createLogger('ModParser');

// ============================================================================
// Types for mod metadata files
// ============================================================================

interface FabricModJson {
  schemaVersion: number;
  id: string;
  version: string;
  name?: string;
  description?: string;
  authors?: string[];
  depends?: Record<string, string>;
  recommends?: Record<string, string>;
  suggests?: Record<string, string>;
  breaks?: Record<string, string>;
  conflicts?: Record<string, string>;
}

interface ForgeModsToml {
  modLoader: string;
  loaderVersion: string;
  mods: Array<{
    modId: string;
    version: string;
    displayName?: string;
    description?: string;
  }>;
  dependencies?: Record<string, Array<{
    modId: string;
    mandatory: boolean;
    versionRange?: string;
    ordering?: string;
    side?: string;
  }>>;
}

interface McMmodInfo {
  modid: string;
  name: string;
  version: string;
  description?: string;
  mcversion?: string;
  dependencies?: string[];
}

// ============================================================================
// Mod Parser Class
// ============================================================================

export class ModParser {
  /**
   * Parse a mod JAR file and extract metadata
   */
  async parseMod(filePath: string): Promise<ModInfo | null> {
    if (!await fs.pathExists(filePath)) {
      logger.warn(`Mod file not found: ${filePath}`);
      return null;
    }

    if (!filePath.endsWith('.jar')) {
      logger.warn(`Not a JAR file: ${filePath}`);
      return null;
    }

    try {
      // Read entries from JAR
      const entries = await this.readZipEntries(filePath);

      // Try Fabric first
      if (entries.has(FABRIC_MOD_JSON)) {
        return await this.parseFabricMod(filePath, entries);
      }

      // Try Forge mods.toml
      if (entries.has(FORGE_MOD_TOML)) {
        return await this.parseForgeMod(filePath, entries);
      }

      // Try legacy Forge mcmod.info
      if (entries.has(FORGE_MOD_INFO)) {
        return await this.parseLegacyForgeMod(filePath, entries);
      }

      logger.warn(`Unable to identify mod type: ${filePath}`);
      return null;
    } catch (error) {
      logger.error(`Failed to parse mod: ${filePath}`, { error });
      return null;
    }
  }

  /**
   * Parse Fabric mod
   */
  private async parseFabricMod(
    filePath: string, 
    entries: Map<string, Buffer>
  ): Promise<ModInfo> {
    const content = entries.get(FABRIC_MOD_JSON)!.toString('utf-8');
    const json = JSON.parse(content) as FabricModJson;
    const hash = await hashFile(filePath);

    const dependencies: ModDependency[] = [];

    // Parse dependencies
    if (json.depends) {
      for (const [modId, versionRange] of Object.entries(json.depends)) {
        if (modId === 'fabricloader' || modId === 'minecraft' || modId === 'java') {
          continue; // Skip core dependencies
        }
        dependencies.push({
          modId,
          versionRange,
          required: true,
          type: 'required'
        });
      }
    }

    if (json.recommends) {
      for (const [modId, versionRange] of Object.entries(json.recommends)) {
        dependencies.push({
          modId,
          versionRange,
          required: false,
          type: 'optional'
        });
      }
    }

    if (json.breaks) {
      for (const [modId, versionRange] of Object.entries(json.breaks)) {
        dependencies.push({
          modId,
          versionRange,
          required: false,
          type: 'incompatible'
        });
      }
    }

    // Extract Minecraft version from depends
    const mcVersions: string[] = [];
    if (json.depends?.minecraft) {
      mcVersions.push(json.depends.minecraft);
    }

    return {
      id: json.id,
      name: json.name || json.id,
      version: json.version,
      loader: 'fabric',
      minecraftVersions: mcVersions,
      dependencies,
      filePath,
      fileName: path.basename(filePath),
      hash,
      enabled: true
    };
  }

  /**
   * Parse Forge mod (mods.toml format)
   */
  private async parseForgeMod(
    filePath: string,
    entries: Map<string, Buffer>
  ): Promise<ModInfo> {
    const content = entries.get(FORGE_MOD_TOML)!.toString('utf-8');
    const toml = this.parseToml(content);
    const hash = await hashFile(filePath);

    const modInfo = toml.mods?.[0] || {};
    const modId = modInfo.modId || 'unknown';

    const dependencies: ModDependency[] = [];

    // Parse dependencies
    const deps = toml.dependencies?.[modId] || [];
    for (const dep of deps) {
      if (dep.modId === 'forge' || dep.modId === 'minecraft') {
        continue; // Skip core dependencies
      }
      dependencies.push({
        modId: dep.modId,
        versionRange: dep.versionRange,
        required: dep.mandatory,
        type: dep.mandatory ? 'required' : 'optional'
      });
    }

    return {
      id: modId,
      name: modInfo.displayName || modId,
      version: modInfo.version || '0.0.0',
      loader: 'forge',
      minecraftVersions: [],
      dependencies,
      filePath,
      fileName: path.basename(filePath),
      hash,
      enabled: true
    };
  }

  /**
   * Parse legacy Forge mod (mcmod.info format)
   */
  private async parseLegacyForgeMod(
    filePath: string,
    entries: Map<string, Buffer>
  ): Promise<ModInfo> {
    const content = entries.get(FORGE_MOD_INFO)!.toString('utf-8');
    let json: McMmodInfo[];
    
    try {
      // mcmod.info can be an array or object
      const parsed = JSON.parse(content);
      json = Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      // Sometimes it's a modList wrapper
      const parsed = JSON.parse(content);
      json = parsed.modList || [parsed];
    }

    const modInfo = json[0] || {};
    const hash = await hashFile(filePath);

    const dependencies: ModDependency[] = [];
    if (modInfo.dependencies) {
      for (const dep of modInfo.dependencies) {
        if (typeof dep === 'string' && dep !== 'Forge' && !dep.startsWith('required-')) {
          dependencies.push({
            modId: dep,
            required: true,
            type: 'required'
          });
        }
      }
    }

    return {
      id: modInfo.modid || 'unknown',
      name: modInfo.name || modInfo.modid || 'Unknown Mod',
      version: modInfo.version || '0.0.0',
      loader: 'forge',
      minecraftVersions: modInfo.mcversion ? [modInfo.mcversion] : [],
      dependencies,
      filePath,
      fileName: path.basename(filePath),
      hash,
      enabled: true
    };
  }

  /**
   * Read all entries from a ZIP file
   */
  private async readZipEntries(filePath: string): Promise<Map<string, Buffer>> {
    return new Promise((resolve, reject) => {
      const entries = new Map<string, Buffer>();

      yauzl.open(filePath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          reject(err || new Error('Failed to open ZIP'));
          return;
        }

        zipfile.on('entry', (entry) => {
          // Only read the metadata files we care about
          if (
            entry.fileName === FABRIC_MOD_JSON ||
            entry.fileName === FORGE_MOD_TOML ||
            entry.fileName === FORGE_MOD_INFO
          ) {
            zipfile.openReadStream(entry, (err, readStream) => {
              if (err || !readStream) {
                zipfile.readEntry();
                return;
              }

              const chunks: Buffer[] = [];
              readStream.on('data', (chunk) => chunks.push(chunk));
              readStream.on('end', () => {
                entries.set(entry.fileName, Buffer.concat(chunks));
                zipfile.readEntry();
              });
            });
          } else {
            zipfile.readEntry();
          }
        });

        zipfile.on('end', () => {
          zipfile.close();
          resolve(entries);
        });

        zipfile.on('error', reject);
        zipfile.readEntry();
      });
    });
  }

  /**
   * Simple TOML parser for mods.toml
   * (A full TOML parser would be better, but this handles basic cases)
   */
  private parseToml(content: string): any {
    const result: any = { mods: [], dependencies: {} };
    let currentSection = '';
    let currentMod: any = null;
    let currentDeps: any[] = [];
    let currentDepModId = '';

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') continue;

      // Section header
      if (trimmed.startsWith('[')) {
        // Save previous section data
        if (currentMod) {
          result.mods.push(currentMod);
          currentMod = null;
        }
        if (currentDeps.length > 0 && currentDepModId) {
          result.dependencies[currentDepModId] = currentDeps;
          currentDeps = [];
        }

        if (trimmed.startsWith('[[mods]]')) {
          currentSection = 'mods';
          currentMod = {};
        } else if (trimmed.startsWith('[[dependencies.')) {
          const match = trimmed.match(/\[\[dependencies\.([^\]]+)\]\]/);
          if (match) {
            currentSection = 'dependencies';
            currentDepModId = match[1];
            currentDeps = result.dependencies[currentDepModId] || [];
            currentDeps.push({});
          }
        } else {
          currentSection = trimmed.replace(/[\[\]]/g, '');
        }
        continue;
      }

      // Key-value pair
      const kvMatch = trimmed.match(/^(\w+)\s*=\s*(.+)$/);
      if (kvMatch) {
        const [, key, rawValue] = kvMatch;
        let value: any = rawValue;

        // Parse value
        if (rawValue.startsWith('"') && rawValue.endsWith('"')) {
          value = rawValue.slice(1, -1);
        } else if (rawValue === 'true') {
          value = true;
        } else if (rawValue === 'false') {
          value = false;
        } else if (/^\d+$/.test(rawValue)) {
          value = parseInt(rawValue, 10);
        }

        if (currentSection === 'mods' && currentMod) {
          currentMod[key] = value;
        } else if (currentSection === 'dependencies' && currentDeps.length > 0) {
          currentDeps[currentDeps.length - 1][key] = value;
        } else {
          result[key] = value;
        }
      }
    }

    // Save final section data
    if (currentMod) {
      result.mods.push(currentMod);
    }
    if (currentDeps.length > 0 && currentDepModId) {
      result.dependencies[currentDepModId] = currentDeps;
    }

    return result;
  }
}

export const modParser = new ModParser();
export default modParser;

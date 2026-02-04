/**
 * McServer - Mod Compatibility Checker
 * 
 * Performs deterministic, rule-based, offline-capable mod compatibility checks.
 */

import { 
  ModInfo, 
  ModCompatibilityResult, 
  ModCompatibilityError, 
  ModCompatibilityWarning,
  ServerType 
} from '../types';
import { createLogger } from '../utils';

const logger = createLogger('ModChecker');

// ============================================================================
// Version Comparison
// ============================================================================

/**
 * Parse a semantic version string
 */
function parseVersion(version: string): { major: number; minor: number; patch: number; pre?: string } {
  const match = version.match(/^(\d+)\.(\d+)(?:\.(\d+))?(?:-(.+))?$/);
  if (!match) {
    return { major: 0, minor: 0, patch: 0 };
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3] || '0', 10),
    pre: match[4]
  };
}

/**
 * Compare two versions
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const va = parseVersion(a);
  const vb = parseVersion(b);

  if (va.major !== vb.major) return va.major > vb.major ? 1 : -1;
  if (va.minor !== vb.minor) return va.minor > vb.minor ? 1 : -1;
  if (va.patch !== vb.patch) return va.patch > vb.patch ? 1 : -1;
  
  // Pre-release versions are less than release versions
  if (va.pre && !vb.pre) return -1;
  if (!va.pre && vb.pre) return 1;
  
  return 0;
}

/**
 * Check if a version satisfies a version range
 * Supports: *, >=, <=, >, <, =, ~ (tilde), ^ (caret)
 */
function satisfiesVersionRange(version: string, range: string): boolean {
  if (!range || range === '*' || range === '') {
    return true;
  }

  // Handle comma-separated ranges (OR)
  if (range.includes(',')) {
    const parts = range.split(',').map(p => p.trim());
    return parts.some(p => satisfiesVersionRange(version, p));
  }

  // Handle space-separated ranges (AND)
  if (range.includes(' ') && !range.startsWith('[')) {
    const parts = range.split(' ').filter(p => p.trim());
    return parts.every(p => satisfiesVersionRange(version, p));
  }

  // Handle bracket notation [1.0,2.0)
  const bracketMatch = range.match(/^([\[\(])(.+?),(.*?)([\]\)])$/);
  if (bracketMatch) {
    const [, leftBracket, minVer, maxVer, rightBracket] = bracketMatch;
    const v = parseVersion(version);
    
    if (minVer) {
      const min = parseVersion(minVer);
      const cmp = compareVersions(version, minVer);
      if (leftBracket === '[' && cmp < 0) return false;
      if (leftBracket === '(' && cmp <= 0) return false;
    }
    
    if (maxVer) {
      const cmp = compareVersions(version, maxVer);
      if (rightBracket === ']' && cmp > 0) return false;
      if (rightBracket === ')' && cmp >= 0) return false;
    }
    
    return true;
  }

  // Handle comparison operators
  const opMatch = range.match(/^(>=|<=|>|<|=|~|\^)?(.+)$/);
  if (opMatch) {
    const [, op, targetVersion] = opMatch;
    const cmp = compareVersions(version, targetVersion);

    switch (op) {
      case '>=': return cmp >= 0;
      case '<=': return cmp <= 0;
      case '>': return cmp > 0;
      case '<': return cmp < 0;
      case '=': return cmp === 0;
      case '~': {
        // ~1.2.3 := >=1.2.3 <1.3.0
        const target = parseVersion(targetVersion);
        const v = parseVersion(version);
        return v.major === target.major && v.minor === target.minor && cmp >= 0;
      }
      case '^': {
        // ^1.2.3 := >=1.2.3 <2.0.0
        const target = parseVersion(targetVersion);
        const v = parseVersion(version);
        return v.major === target.major && cmp >= 0;
      }
      default:
        return cmp === 0;
    }
  }

  return version === range;
}

// ============================================================================
// Mod Compatibility Checker
// ============================================================================

export class ModCompatibilityChecker {
  /**
   * Check compatibility of a set of mods
   */
  checkCompatibility(
    mods: ModInfo[],
    serverType: ServerType,
    minecraftVersion: string
  ): ModCompatibilityResult {
    const errors: ModCompatibilityError[] = [];
    const warnings: ModCompatibilityWarning[] = [];

    // Skip checks for vanilla
    if (serverType === 'vanilla') {
      if (mods.length > 0) {
        errors.push({
          type: 'loader_mismatch',
          modId: 'all',
          message: 'Vanilla servers do not support mods',
          details: 'Switch to Forge or Fabric to use mods'
        });
      }
      return { compatible: errors.length === 0, errors, warnings };
    }

    const expectedLoader = serverType === 'forge' ? 'forge' : 'fabric';

    // Build mod index
    const modIndex = new Map<string, ModInfo>();
    for (const mod of mods) {
      if (mod.enabled) {
        modIndex.set(mod.id, mod);
      }
    }

    for (const mod of mods) {
      if (!mod.enabled) continue;

      // Check 1: Loader mismatch
      if (mod.loader !== expectedLoader) {
        errors.push({
          type: 'loader_mismatch',
          modId: mod.id,
          message: `${mod.name} is a ${mod.loader} mod but server is ${serverType}`,
          details: `This mod will not work on a ${serverType} server`
        });
      }

      // Check 2: Duplicate mods
      const duplicates = mods.filter(m => 
        m.id === mod.id && 
        m.filePath !== mod.filePath && 
        m.enabled
      );
      
      if (duplicates.length > 0) {
        errors.push({
          type: 'duplicate_mod',
          modId: mod.id,
          message: `Duplicate mod detected: ${mod.name}`,
          details: `Found in: ${mod.fileName}, ${duplicates.map(d => d.fileName).join(', ')}`
        });
      }

      // Check 3: Minecraft version compatibility
      if (mod.minecraftVersions.length > 0) {
        const compatible = mod.minecraftVersions.some(v => 
          satisfiesVersionRange(minecraftVersion, v) ||
          v === minecraftVersion ||
          v.startsWith(minecraftVersion)
        );

        if (!compatible) {
          warnings.push({
            type: 'version_mismatch',
            modId: mod.id,
            message: `${mod.name} may not be compatible with Minecraft ${minecraftVersion}`,
            details: `Mod supports: ${mod.minecraftVersions.join(', ')}`
          });
        }
      }

      // Check 4: Dependencies
      for (const dep of mod.dependencies) {
        const depMod = modIndex.get(dep.modId);

        switch (dep.type) {
          case 'required':
            if (!depMod) {
              errors.push({
                type: 'missing_dependency',
                modId: mod.id,
                message: `${mod.name} requires ${dep.modId}`,
                details: dep.versionRange 
                  ? `Required version: ${dep.versionRange}`
                  : 'Install the required mod to continue'
              });
            } else if (dep.versionRange && !satisfiesVersionRange(depMod.version, dep.versionRange)) {
              warnings.push({
                type: 'version_mismatch',
                modId: mod.id,
                message: `${mod.name} may need a different version of ${dep.modId}`,
                details: `Required: ${dep.versionRange}, Found: ${depMod.version}`
              });
            }
            break;

          case 'optional':
            if (depMod && dep.versionRange && !satisfiesVersionRange(depMod.version, dep.versionRange)) {
              warnings.push({
                type: 'version_mismatch',
                modId: mod.id,
                message: `${mod.name} recommends different version of ${dep.modId}`,
                details: `Recommended: ${dep.versionRange}, Found: ${depMod.version}`
              });
            }
            break;

          case 'incompatible':
            if (depMod) {
              if (!dep.versionRange || satisfiesVersionRange(depMod.version, dep.versionRange)) {
                errors.push({
                  type: 'incompatible_version',
                  modId: mod.id,
                  message: `${mod.name} is incompatible with ${depMod.name}`,
                  details: dep.versionRange
                    ? `Incompatible versions: ${dep.versionRange}`
                    : 'These mods cannot be used together'
                });
              }
            }
            break;
        }
      }
    }

    // Deduplicate errors and warnings
    const uniqueErrors = this.deduplicateErrors(errors);
    const uniqueWarnings = this.deduplicateWarnings(warnings);

    const compatible = uniqueErrors.length === 0;

    if (!compatible) {
      logger.warn(`Mod compatibility check failed: ${uniqueErrors.length} errors`);
    } else if (uniqueWarnings.length > 0) {
      logger.info(`Mod compatibility check passed with ${uniqueWarnings.length} warnings`);
    } else {
      logger.info('Mod compatibility check passed');
    }

    return {
      compatible,
      errors: uniqueErrors,
      warnings: uniqueWarnings
    };
  }

  /**
   * Check if mods can be loaded (hard block on critical errors)
   */
  canLoadMods(result: ModCompatibilityResult): boolean {
    // Block on loader mismatches and missing required dependencies
    const criticalErrors = result.errors.filter(e => 
      e.type === 'loader_mismatch' || 
      e.type === 'missing_dependency' ||
      e.type === 'incompatible_version'
    );

    return criticalErrors.length === 0;
  }

  /**
   * Deduplicate errors by mod and type
   */
  private deduplicateErrors(errors: ModCompatibilityError[]): ModCompatibilityError[] {
    const seen = new Set<string>();
    return errors.filter(error => {
      const key = `${error.type}:${error.modId}:${error.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Deduplicate warnings by mod and type
   */
  private deduplicateWarnings(warnings: ModCompatibilityWarning[]): ModCompatibilityWarning[] {
    const seen = new Set<string>();
    return warnings.filter(warning => {
      const key = `${warning.type}:${warning.modId}:${warning.message}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  /**
   * Get a human-readable summary of compatibility issues
   */
  getSummary(result: ModCompatibilityResult): string {
    const lines: string[] = [];

    if (result.compatible && result.warnings.length === 0) {
      lines.push('✓ All mods are compatible');
    } else if (result.compatible) {
      lines.push(`✓ Mods are compatible with ${result.warnings.length} warning(s)`);
    } else {
      lines.push(`✗ Mod compatibility issues found: ${result.errors.length} error(s)`);
    }

    for (const error of result.errors) {
      lines.push(`  ✗ ${error.message}`);
      if (error.details) {
        lines.push(`    ${error.details}`);
      }
    }

    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning.message}`);
      if (warning.details) {
        lines.push(`    ${warning.details}`);
      }
    }

    return lines.join('\n');
  }
}

export const modCompatibilityChecker = new ModCompatibilityChecker();
export default modCompatibilityChecker;

// Export version checking for testing
export { satisfiesVersionRange as matchesVersionRange };

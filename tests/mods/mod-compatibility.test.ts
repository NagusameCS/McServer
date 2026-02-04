import { describe, it, expect, beforeEach } from 'vitest';
import { matchesVersionRange } from '../../src/mods/checker';
import { ModCompatibilityChecker } from '../../src/mods/checker';
import type { ModInfo } from '../../src/types';

// Test version matching function directly
describe('Version Matching', () => {
  describe('matchesVersionRange', () => {
    it('should match exact versions', () => {
      expect(matchesVersionRange('1.0.0', '1.0.0')).toBe(true);
      expect(matchesVersionRange('1.0.0', '1.0.1')).toBe(false);
    });

    it('should match wildcard versions', () => {
      expect(matchesVersionRange('1.0.0', '*')).toBe(true);
      expect(matchesVersionRange('2.5.3', '*')).toBe(true);
    });

    it('should match >= ranges', () => {
      expect(matchesVersionRange('1.0.0', '>=1.0.0')).toBe(true);
      expect(matchesVersionRange('1.5.0', '>=1.0.0')).toBe(true);
      expect(matchesVersionRange('0.9.0', '>=1.0.0')).toBe(false);
    });

    it('should match <= ranges', () => {
      expect(matchesVersionRange('1.0.0', '<=1.0.0')).toBe(true);
      expect(matchesVersionRange('0.5.0', '<=1.0.0')).toBe(true);
      expect(matchesVersionRange('1.1.0', '<=1.0.0')).toBe(false);
    });

    it('should match ~ (tilde) ranges', () => {
      expect(matchesVersionRange('1.20.4', '~1.20.0')).toBe(true);
      expect(matchesVersionRange('1.20.99', '~1.20.0')).toBe(true);
      expect(matchesVersionRange('1.21.0', '~1.20.0')).toBe(false);
    });

    it('should match ^ (caret) ranges', () => {
      expect(matchesVersionRange('1.5.0', '^1.0.0')).toBe(true);
      expect(matchesVersionRange('1.99.99', '^1.0.0')).toBe(true);
      expect(matchesVersionRange('2.0.0', '^1.0.0')).toBe(false);
    });
  });
});

// Helper to create a valid ModInfo object
function createMod(overrides: Partial<ModInfo>): ModInfo {
  return {
    id: 'test-mod',
    name: 'Test Mod',
    version: '1.0.0',
    loader: 'fabric',
    minecraftVersions: ['1.20.4'],
    dependencies: [],
    filePath: '/mods/test.jar',
    fileName: 'test.jar',
    hash: 'abc123',
    enabled: true,
    ...overrides
  };
}

describe('ModCompatibilityChecker', () => {
  let checker: ModCompatibilityChecker;

  beforeEach(() => {
    checker = new ModCompatibilityChecker();
  });

  describe('checkCompatibility', () => {
    it('should detect loader mismatch', () => {
      const mods: ModInfo[] = [
        createMod({ id: 'forge-mod', name: 'Forge Mod', loader: 'forge' })
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'loader_mismatch')).toBe(true);
    });

    it('should detect duplicate mods', () => {
      const mods: ModInfo[] = [
        createMod({ id: 'dupe-mod', name: 'Mod v1', version: '1.0.0', filePath: '/mods/v1.jar' }),
        createMod({ id: 'dupe-mod', name: 'Mod v2', version: '2.0.0', filePath: '/mods/v2.jar' })
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'duplicate_mod')).toBe(true);
    });

    it('should detect missing dependencies', () => {
      const mods: ModInfo[] = [
        createMod({
          id: 'dependent-mod',
          name: 'Dependent Mod',
          dependencies: [
            { modId: 'missing-lib', versionRange: '>=1.0.0', required: true, type: 'required' }
          ]
        })
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'missing_dependency')).toBe(true);
    });

    it('should pass when all dependencies are met', () => {
      const mods: ModInfo[] = [
        createMod({ id: 'lib-mod', name: 'Library', version: '1.5.0' }),
        createMod({
          id: 'app-mod',
          name: 'App',
          dependencies: [
            { modId: 'lib-mod', versionRange: '>=1.0.0', required: true, type: 'required' }
          ]
        })
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

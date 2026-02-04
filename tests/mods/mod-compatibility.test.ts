import { describe, it, expect, beforeEach } from 'vitest';
import { matchesVersionRange } from '../../src/mods/checker';
import { ModCompatibilityChecker } from '../../src/mods/checker';
import type { ModInfo } from '../../src/types';

// Test version matching function directly (the core logic we can unit test)
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

describe('ModCompatibilityChecker', () => {
  let checker: ModCompatibilityChecker;

  beforeEach(() => {
    checker = new ModCompatibilityChecker();
  });

  describe('checkCompatibility', () => {
    it('should detect loader mismatch', () => {
      const mods: ModInfo[] = [
        {
          id: 'forge-mod',
          name: 'Forge Mod',
          version: '1.0.0',
          loader: 'forge',
          minecraftVersions: ['1.20.4'],
          dependencies: [],
          filePath: '/mods/forge-mod.jar',
          fileName: 'forge-mod.jar',
          enabled: true
        }
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'loader_mismatch')).toBe(true);
    });

    it('should detect duplicate mods', () => {
      const mods: ModInfo[] = [
        {
          id: 'test-mod',
          name: 'Test Mod v1',
          version: '1.0.0',
          loader: 'fabric',
          minecraftVersions: ['1.20.4'],
          dependencies: [],
          filePath: '/mods/test-mod-1.jar',
          fileName: 'test-mod-1.jar',
          enabled: true
        },
        {
          id: 'test-mod',
          name: 'Test Mod v2',
          version: '2.0.0',
          loader: 'fabric',
          minecraftVersions: ['1.20.4'],
          dependencies: [],
          filePath: '/mods/test-mod-2.jar',
          fileName: 'test-mod-2.jar',
          enabled: true
        }
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'duplicate_mod')).toBe(true);
    });

    it('should detect missing dependencies', () => {
      const mods: ModInfo[] = [
        {
          id: 'dependent-mod',
          name: 'Dependent Mod',
          version: '1.0.0',
          loader: 'fabric',
          minecraftVersions: ['1.20.4'],
          dependencies: [
            { modId: 'required-lib', versionRange: '>=1.0.0', type: 'required' }
          ],
          filePath: '/mods/dependent.jar',
          fileName: 'dependent.jar',
          enabled: true
        }
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(false);
      expect(result.errors.some(i => i.type === 'missing_dependency')).toBe(true);
    });

    it('should pass when all dependencies are met', () => {
      const mods: ModInfo[] = [
        {
          id: 'lib-mod',
          name: 'Library Mod',
          version: '1.5.0',
          loader: 'fabric',
          minecraftVersions: ['1.20.4'],
          dependencies: [],
          filePath: '/mods/lib.jar',
          fileName: 'lib.jar',
          enabled: true
        },
        {
          id: 'dependent-mod',
          name: 'Dependent Mod',
          version: '1.0.0',
          loader: 'fabric',
          minecraftVersions: ['1.20.4'],
          dependencies: [
            { modId: 'lib-mod', versionRange: '>=1.0.0', type: 'required' }
          ],
          filePath: '/mods/dependent.jar',
          fileName: 'dependent.jar',
          enabled: true
        }
      ];

      const result = checker.checkCompatibility(mods, 'fabric', '1.20.4');

      expect(result.compatible).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });
});

import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  generateToken,
  sleep,
  sanitizeFilename,
  isValidSemver,
  compareVersions
} from '../../src/utils/helpers';

describe('Helper Functions', () => {
  describe('formatBytes', () => {
    it('should format bytes correctly', () => {
      expect(formatBytes(0)).toBe('0.00 B');
      expect(formatBytes(1024)).toBe('1.00 KB');
      expect(formatBytes(1024 * 1024)).toBe('1.00 MB');
      expect(formatBytes(1024 * 1024 * 1024)).toBe('1.00 GB');
    });

    it('should handle decimal values', () => {
      expect(formatBytes(1536)).toBe('1.50 KB');
      expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.50 MB');
    });
  });

  describe('generateToken', () => {
    it('should generate tokens of correct length', () => {
      const token16 = generateToken(16);
      expect(token16).toHaveLength(32); // Hex encoding doubles length

      const token32 = generateToken(32);
      expect(token32).toHaveLength(64);
    });

    it('should generate unique tokens', () => {
      const token1 = generateToken();
      const token2 = generateToken();
      expect(token1).not.toBe(token2);
    });

    it('should only contain hex characters', () => {
      const token = generateToken();
      expect(token).toMatch(/^[0-9a-f]+$/);
    });
  });

  describe('sleep', () => {
    it('should delay for specified time', async () => {
      const start = Date.now();
      await sleep(100);
      const elapsed = Date.now() - start;
      expect(elapsed).toBeGreaterThanOrEqual(95); // Allow small variance
      expect(elapsed).toBeLessThan(150);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      expect(sanitizeFilename('test/file:name?.txt')).toBe('testfilename.txt');
      expect(sanitizeFilename('hello<world>test')).toBe('helloworldtest');
    });

    it('should preserve valid characters', () => {
      expect(sanitizeFilename('valid-file_name.txt')).toBe('valid-file_name.txt');
      expect(sanitizeFilename('test123.jar')).toBe('test123.jar');
    });

    it('should handle empty strings', () => {
      expect(sanitizeFilename('')).toBe('');
    });
  });

  describe('isValidSemver', () => {
    it('should validate correct semver versions', () => {
      expect(isValidSemver('1.0.0')).toBe(true);
      expect(isValidSemver('1.20.4')).toBe(true);
      expect(isValidSemver('0.0.1')).toBe(true);
      expect(isValidSemver('10.20.30')).toBe(true);
    });

    it('should reject invalid versions', () => {
      expect(isValidSemver('1.0')).toBe(false);
      expect(isValidSemver('1')).toBe(false);
      expect(isValidSemver('1.0.0.0')).toBe(false);
      expect(isValidSemver('abc')).toBe(false);
    });
  });

  describe('compareVersions', () => {
    it('should compare major versions', () => {
      expect(compareVersions('2.0.0', '1.0.0')).toBeGreaterThan(0);
      expect(compareVersions('1.0.0', '2.0.0')).toBeLessThan(0);
    });

    it('should compare minor versions', () => {
      expect(compareVersions('1.5.0', '1.4.0')).toBeGreaterThan(0);
      expect(compareVersions('1.4.0', '1.5.0')).toBeLessThan(0);
    });

    it('should compare patch versions', () => {
      expect(compareVersions('1.0.5', '1.0.4')).toBeGreaterThan(0);
      expect(compareVersions('1.0.4', '1.0.5')).toBeLessThan(0);
    });

    it('should return 0 for equal versions', () => {
      expect(compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(compareVersions('1.20.4', '1.20.4')).toBe(0);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { GitHubConfig, LockState } from '../../src/types';

// Mock the utils module to avoid logger file system operations
vi.mock('../../src/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }),
  getMachineId: vi.fn().mockResolvedValue('test-machine-id'),
  generateToken: vi.fn().mockReturnValue('test-token-123')
}));

// Mock axios
vi.mock('axios', () => ({
  default: {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

import axios from 'axios';
import { LockManager } from '../../src/sync/lock';

describe('LockManager', () => {
  let lockManager: LockManager;
  const mockConfig: GitHubConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main',
    lfsEnabled: false
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    lockManager = new LockManager(mockConfig);
    await lockManager.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getState', () => {
    it('should return unlocked state when lock file does not exist', async () => {
      vi.mocked(axios.get).mockResolvedValue({ status: 404 });

      const state = await lockManager.getState();

      expect(state.locked).toBe(false);
      expect(state.lockedBy).toBeNull();
    });

    it('should return locked state when lock file exists', async () => {
      const lockContent = {
        locked: true,
        lockedBy: 'other-host',
        lockedAt: new Date().toISOString(),
        machineId: 'other-machine-id',
        reason: 'Hosting server',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionId: 'test-session'
      };

      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: {
          content: Buffer.from(JSON.stringify(lockContent)).toString('base64'),
          sha: 'abc123'
        }
      });

      const state = await lockManager.getState();

      expect(state.locked).toBe(true);
      expect(state.lockedBy).toBe('other-host');
    });
  });

  describe('acquire', () => {
    it('should successfully acquire lock when not locked', async () => {
      vi.mocked(axios.get).mockResolvedValueOnce({ status: 404 });
      vi.mocked(axios.put).mockResolvedValueOnce({ status: 201 });

      const result = await lockManager.acquire('Testing');

      expect(result).toBe(true);
    });

    it('should fail when already locked by another machine', async () => {
      const lockContent = {
        locked: true,
        lockedBy: 'other-host',
        lockedAt: new Date().toISOString(),
        machineId: 'different-machine',
        reason: 'Hosting server',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionId: 'other-session'
      };

      vi.mocked(axios.get).mockResolvedValue({
        status: 200,
        data: {
          content: Buffer.from(JSON.stringify(lockContent)).toString('base64'),
          sha: 'abc123'
        }
      });

      const result = await lockManager.acquire('Testing');

      expect(result).toBe(false);
    });
  });

  describe('release', () => {
    it('should return true when lock already released', async () => {
      vi.mocked(axios.get).mockResolvedValue({ status: 404 });

      const result = await lockManager.release();

      expect(result).toBe(true);
    });
  });
});

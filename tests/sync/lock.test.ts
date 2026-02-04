import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';
import type { GitHubConfig } from '../../src/types';

// Mock axios before importing LockManager
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

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

// Import LockManager after mocks are set up
import { LockManager } from '../../src/sync/lock';

describe('LockManager', () => {
  let lockManager: LockManager;
  const mockConfig: GitHubConfig = {
    token: 'test-token',
    owner: 'test-owner',
    repo: 'test-repo',
    branch: 'main'
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    lockManager = new LockManager(mockConfig);
    // Initialize to set machineId
    await lockManager.initialize();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getState', () => {
    it('should return unlocked state when lock file does not exist', async () => {
      mockedAxios.get.mockResolvedValue({
        status: 404
      });

      const state = await lockManager.getState();

      expect(state.locked).toBe(false);
      expect(state.lockedBy).toBeNull();
      expect(mockedAxios.get).toHaveBeenCalled();
    });

    it('should return locked state when lock file exists and is valid', async () => {
      const lockContent = {
        locked: true,
        lockedBy: 'other-host',
        lockedAt: new Date().toISOString(),
        machineId: 'other-machine-id',
        reason: 'Hosting server',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
        sessionId: 'test-session'
      };

      mockedAxios.get.mockResolvedValue({
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

    it('should still report locked state for expired locks', async () => {
      const lockContent = {
        locked: true,
        lockedBy: 'other-host',
        lockedAt: new Date(Date.now() - 7200000).toISOString(), // 2 hours ago
        machineId: 'other-machine-id',
        reason: 'Hosting server',
        expiresAt: new Date(Date.now() - 3600000).toISOString(), // Expired 1 hour ago
        sessionId: 'test-session'
      };

      mockedAxios.get.mockResolvedValue({
        status: 200,
        data: {
          content: Buffer.from(JSON.stringify(lockContent)).toString('base64'),
          sha: 'abc123'
        }
      });

      const state = await lockManager.getState();
      // Expired lock still shows as locked in getState (acquire handles takeover)
      expect(state.locked).toBe(true);
    });
  });

  describe('acquire', () => {
    it('should successfully acquire lock when not locked', async () => {
      // First call: getState returns unlocked
      mockedAxios.get.mockResolvedValueOnce({ status: 404 });
      // Second call: PUT to create lock file succeeds
      mockedAxios.put.mockResolvedValueOnce({ status: 201 });

      const result = await lockManager.acquire('Testing');

      expect(result).toBe(true);
    });

    it('should fail to acquire lock when already locked by another machine', async () => {
      const lockContent = {
        locked: true,
        lockedBy: 'other-host',
        lockedAt: new Date().toISOString(),
        machineId: 'other-machine-id', // Different machine
        reason: 'Hosting server',
        expiresAt: new Date(Date.now() + 3600000).toISOString(), // Not expired
        sessionId: 'other-session'
      };

      mockedAxios.get.mockResolvedValue({
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
    it('should return true when lock is already released', async () => {
      mockedAxios.get.mockResolvedValue({ status: 404 });

      const result = await lockManager.release();

      expect(result).toBe(true);
    });
  });
});

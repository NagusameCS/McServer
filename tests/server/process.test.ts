import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ServerProfile } from '../../src/types';

// Mock child_process
vi.mock('child_process', () => ({
  spawn: vi.fn()
}));

// Mock fs-extra
vi.mock('fs-extra', () => ({
  default: {
    pathExists: vi.fn().mockResolvedValue(true),
    ensureDir: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(''),
    writeFile: vi.fn().mockResolvedValue(undefined)
  },
  pathExists: vi.fn().mockResolvedValue(true),
  ensureDir: vi.fn().mockResolvedValue(undefined)
}));

// Mock the utils module
vi.mock('../../src/utils', () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  })
}));

import { ServerProcess } from '../../src/server/process';

describe('ServerProcess', () => {
  const mockProfile: ServerProfile = {
    id: 'test-profile',
    name: 'Test Server',
    minecraftVersion: '1.20.4',
    serverType: 'vanilla',
    createdAt: new Date(),
    lastPlayed: null,
    worldPath: '/worlds/test',
    settings: {
      maxPlayers: 20,
      gamemode: 'survival',
      difficulty: 'normal',
      pvp: true,
      allowNether: true,
      spawnProtection: 16,
      viewDistance: 10,
      simulationDistance: 10,
      maxTickTime: 60000,
      motd: 'Test Server',
      whitelistEnabled: false,
      onlineMode: true,
      port: 25565,
      jvmArgs: ['-Xmx2G', '-Xms1G'],
      customProperties: {}
    }
  };

  describe('initialization', () => {
    it('should create ServerProcess with correct profile', () => {
      const process = new ServerProcess(mockProfile, '/servers/test', '/servers/test/server.jar');
      expect(process).toBeDefined();
    });

    it('should have stopped status initially', () => {
      const process = new ServerProcess(mockProfile, '/servers/test', '/servers/test/server.jar');
      const state = process.getState();
      expect(state.status).toBe('stopped');
    });

    it('should not be running initially', () => {
      const process = new ServerProcess(mockProfile, '/servers/test', '/servers/test/server.jar');
      expect(process.isRunning()).toBe(false);
    });

    it('should have empty players list initially', () => {
      const process = new ServerProcess(mockProfile, '/servers/test', '/servers/test/server.jar');
      const state = process.getState();
      expect(state.players).toEqual([]);
    });
  });
});

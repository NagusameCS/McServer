import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServerProcess } from '../../src/server/process';
import type { ServerProfile } from '../../src/types';

describe('ServerProcess', () => {
  const mockProfile: ServerProfile = {
    id: 'test-profile',
    name: 'Test Server',
    type: 'vanilla',
    minecraftVersion: '1.20.4',
    createdAt: new Date(),
    lastPlayed: null,
    worldPath: '/test/world',
    serverPath: '/test/server',
    settings: {
      minRam: '1G',
      maxRam: '4G',
      port: 25565,
      jvmArgs: [],
      serverProperties: {}
    }
  };

  const serverPath = '/test/server';
  const jarPath = '/test/server/server.jar';

  describe('constructor', () => {
    it('should initialize with correct state', () => {
      const process = new ServerProcess(mockProfile, serverPath, jarPath);
      
      const state = process.getState();
      expect(state.status).toBe('stopped');
      expect(state.players).toEqual([]);
      expect(process.isRunning()).toBe(false);
    });
  });

  describe('getState', () => {
    it('should return a copy of the state', () => {
      const process = new ServerProcess(mockProfile, serverPath, jarPath);
      
      const state1 = process.getState();
      const state2 = process.getState();
      
      expect(state1).toEqual(state2);
      expect(state1).not.toBe(state2); // Different object references
    });
  });

  describe('isRunning', () => {
    it('should return false when stopped', () => {
      const process = new ServerProcess(mockProfile, serverPath, jarPath);
      expect(process.isRunning()).toBe(false);
    });
  });

  describe('sendCommand', () => {
    it('should not throw when server not running (just logs)', () => {
      const serverProcess = new ServerProcess(mockProfile, serverPath, jarPath);
      
      // sendCommand doesn't throw when not running, it just does nothing
      expect(() => serverProcess.sendCommand('help')).not.toThrow();
    });
  });
});

/**
 * McServer - API Routes
 * 
 * REST API endpoints for the web dashboard.
 */

import { Router, Request, Response } from 'express';
import { serverManager } from '../server';
import { createModManager } from '../mods';
import configManager from '../config';
import { TunnelManager } from '../tunnel';
import { 
  authMiddleware, 
  requireRole, 
  authenticate, 
  createUser, 
  getUsers,
  deleteUser,
  changePassword,
  logout 
} from './auth';
import { ApiResponse, ServerProfile, ServerType } from '../types';
import { createLogger, getLogs, getJavaVersion } from '../utils';

const logger = createLogger('API');
const router = Router();

// ============================================================================
// Health Check & Setup Status
// ============================================================================

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Check if initial setup has been completed (no auth required)
router.get('/config/setup-status', (req: Request, res: Response) => {
  const hasProfiles = configManager.hasProfiles();
  const setupComplete = (configManager as any).config?.setupComplete === true;
  res.json({ complete: hasProfiles || setupComplete });
});

// Mark setup as complete
router.post('/config/setup-complete', (req: Request, res: Response) => {
  try {
    configManager.setSetupComplete(true);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save setup status' });
  }
});

// Check Java installation (no auth required for setup)
router.get('/system/java', async (req: Request, res: Response) => {
  try {
    const version = await getJavaVersion();
    res.json({ version });
  } catch {
    res.json({ version: null });
  }
});

// Save GitHub config (no auth required during setup)
router.post('/config/github', async (req: Request, res: Response) => {
  try {
    const { token, owner, repo, branch, lfsEnabled } = req.body;
    configManager.setGitHubConfig({ token, owner, repo, branch, lfsEnabled });
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to save GitHub config' });
  }
});

// ============================================================================
// Authentication
// ============================================================================

router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Username and password required' }
      });
    }

    const result = await authenticate(
      username, 
      password,
      req.ip,
      req.headers['user-agent']
    );

    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Authentication failed';
    res.status(401).json({
      success: false,
      error: { code: 'AUTH_FAILED', message }
    });
  }
});

router.post('/auth/logout', authMiddleware, async (req: Request, res: Response) => {
  try {
    if (req.session) {
      await logout(req.session.id);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: { code: 'LOGOUT_FAILED', message: 'Failed to logout' }
    });
  }
});

router.get('/auth/me', authMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: req.user });
});

// ============================================================================
// User Management
// ============================================================================

router.get('/users', authMiddleware, requireRole('owner', 'admin'), (req: Request, res: Response) => {
  res.json({ success: true, data: getUsers() });
});

router.post('/users', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Username and password required' }
      });
    }

    const user = await createUser(username, password, role || 'member');
    res.json({ success: true, data: user });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create user';
    res.status(400).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    });
  }
});

router.delete('/users/:id', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  try {
    await deleteUser(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete user';
    res.status(400).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    });
  }
});

router.post('/users/:id/password', authMiddleware, async (req: Request, res: Response) => {
  try {
    // Users can change their own password, owners can change anyone's
    if (req.params.id !== req.user?.id && req.user?.role !== 'owner') {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Cannot change other users\' passwords' }
      });
    }

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Password required' }
      });
    }

    await changePassword(req.params.id, password);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to change password';
    res.status(400).json({
      success: false,
      error: { code: 'CHANGE_FAILED', message }
    });
  }
});

// ============================================================================
// Dashboard State
// ============================================================================

router.get('/dashboard', authMiddleware, async (req: Request, res: Response) => {
  try {
    const state = await serverManager.getDashboardState();
    res.json({ success: true, data: state });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get dashboard state';
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message }
    });
  }
});

// ============================================================================
// Server Management
// ============================================================================

router.get('/server/status', authMiddleware, (req: Request, res: Response) => {
  const state = serverManager.getServerState();
  const profile = serverManager.getCurrentProfile();
  res.json({ 
    success: true, 
    data: { 
      state, 
      profile,
      isRunning: serverManager.isServerRunning()
    } 
  });
});

router.post('/server/start', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { profileId } = req.body;

    if (!profileId) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Profile ID required' }
      });
    }

    await serverManager.startServer(profileId);
    res.json({ success: true, data: serverManager.getServerState() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to start server';
    logger.error('Start server failed', { error: message });
    res.status(500).json({
      success: false,
      error: { code: 'START_FAILED', message }
    });
  }
});

router.post('/server/stop', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const result = await serverManager.stopServer();
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to stop server';
    logger.error('Stop server failed', { error: message });
    res.status(500).json({
      success: false,
      error: { code: 'STOP_FAILED', message }
    });
  }
});

router.post('/server/restart', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    await serverManager.restartServer();
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to restart server';
    res.status(500).json({
      success: false,
      error: { code: 'RESTART_FAILED', message }
    });
  }
});

router.post('/server/command', authMiddleware, requireRole('owner', 'admin'), (req: Request, res: Response) => {
  try {
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Command required' }
      });
    }

    serverManager.sendCommand(command);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to send command';
    res.status(500).json({
      success: false,
      error: { code: 'COMMAND_FAILED', message }
    });
  }
});

// ============================================================================
// Profile Management
// ============================================================================

router.get('/profiles', authMiddleware, (req: Request, res: Response) => {
  res.json({ success: true, data: configManager.profiles });
});

router.get('/profiles/:id', authMiddleware, (req: Request, res: Response) => {
  const profile = configManager.getProfile(req.params.id);
  if (!profile) {
    return res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Profile not found' }
    });
  }
  res.json({ success: true, data: profile });
});

router.post('/profiles', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const { name, type, minecraftVersion, loaderVersion, settings } = req.body;

    if (!name || !type || !minecraftVersion) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Name, type, and Minecraft version required' }
      });
    }

    const profile = await serverManager.createProfile({
      name,
      type: type as ServerType,
      minecraftVersion,
      loaderVersion,
      settings
    });

    res.json({ success: true, data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to create profile';
    res.status(500).json({
      success: false,
      error: { code: 'CREATE_FAILED', message }
    });
  }
});

router.put('/profiles/:id', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    await configManager.updateProfile(req.params.id, req.body);
    const profile = configManager.getProfile(req.params.id);
    res.json({ success: true, data: profile });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update profile';
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    });
  }
});

router.delete('/profiles/:id', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  try {
    await serverManager.deleteProfile(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete profile';
    res.status(500).json({
      success: false,
      error: { code: 'DELETE_FAILED', message }
    });
  }
});

router.post('/profiles/:id/setup', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    await serverManager.setupServer(req.params.id);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to setup server';
    res.status(500).json({
      success: false,
      error: { code: 'SETUP_FAILED', message }
    });
  }
});

// ============================================================================
// Sync & Lock
// ============================================================================

router.get('/sync/status', authMiddleware, async (req: Request, res: Response) => {
  const syncManager = serverManager.getSyncManager();
  if (!syncManager) {
    return res.json({ 
      success: true, 
      data: { 
        configured: false,
        syncState: null,
        lockState: null
      } 
    });
  }

  const syncState = syncManager.getSyncState();
  const lockState = await syncManager.getLockState();

  res.json({ 
    success: true, 
    data: { 
      configured: true,
      syncState,
      lockState
    } 
  });
});

router.get('/sync/history', authMiddleware, async (req: Request, res: Response) => {
  const syncManager = serverManager.getSyncManager();
  if (!syncManager) {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'GitHub sync not configured' }
    });
  }

  const limit = parseInt(req.query.limit as string) || 50;
  const history = await syncManager.getHistory(limit);

  res.json({ success: true, data: history });
});

router.post('/sync/emergency-release', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  const syncManager = serverManager.getSyncManager();
  if (!syncManager) {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'GitHub sync not configured' }
    });
  }

  const { reason } = req.body;
  const result = await syncManager.emergencyRelease(reason || 'Manual release via dashboard');

  res.json({ success: result });
});

router.post('/sync/restore/:commitHash', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  const syncManager = serverManager.getSyncManager();
  if (!syncManager) {
    return res.status(400).json({
      success: false,
      error: { code: 'NOT_CONFIGURED', message: 'GitHub sync not configured' }
    });
  }

  const result = await syncManager.restoreVersion(req.params.commitHash);
  res.json({ success: result.success, data: result });
});

// ============================================================================
// Mods
// ============================================================================

router.get('/profiles/:id/mods', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profileDir = serverManager.getProfileDir(req.params.id);
    const modManager = createModManager(profileDir);
    await modManager.initialize();

    res.json({ success: true, data: modManager.getMods() });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get mods';
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message }
    });
  }
});

router.get('/profiles/:id/mods/compatibility', authMiddleware, async (req: Request, res: Response) => {
  try {
    const profile = configManager.getProfile(req.params.id);
    if (!profile) {
      return res.status(404).json({
        success: false,
        error: { code: 'NOT_FOUND', message: 'Profile not found' }
      });
    }

    const profileDir = serverManager.getProfileDir(req.params.id);
    const modManager = createModManager(profileDir);
    await modManager.initialize();

    const result = modManager.checkCompatibility(profile);
    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to check compatibility';
    res.status(500).json({
      success: false,
      error: { code: 'CHECK_FAILED', message }
    });
  }
});

router.post('/profiles/:id/mods/:modId/enable', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const profileDir = serverManager.getProfileDir(req.params.id);
    const modManager = createModManager(profileDir);
    await modManager.initialize();
    await modManager.enableMod(req.params.modId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to enable mod';
    res.status(500).json({
      success: false,
      error: { code: 'ENABLE_FAILED', message }
    });
  }
});

router.post('/profiles/:id/mods/:modId/disable', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const profileDir = serverManager.getProfileDir(req.params.id);
    const modManager = createModManager(profileDir);
    await modManager.initialize();
    await modManager.disableMod(req.params.modId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to disable mod';
    res.status(500).json({
      success: false,
      error: { code: 'DISABLE_FAILED', message }
    });
  }
});

router.delete('/profiles/:id/mods/:modId', authMiddleware, requireRole('owner', 'admin'), async (req: Request, res: Response) => {
  try {
    const profileDir = serverManager.getProfileDir(req.params.id);
    const modManager = createModManager(profileDir);
    await modManager.initialize();
    await modManager.removeMod(req.params.modId);

    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to remove mod';
    res.status(500).json({
      success: false,
      error: { code: 'REMOVE_FAILED', message }
    });
  }
});

// ============================================================================
// Logs
// ============================================================================

router.get('/logs', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { level, source, search, limit } = req.query;

    const logs = await getLogs({
      level: level as string,
      source: source as string,
      search: search as string,
      limit: limit ? parseInt(limit as string) : 100
    });

    res.json({ success: true, data: logs });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to get logs';
    res.status(500).json({
      success: false,
      error: { code: 'FETCH_FAILED', message }
    });
  }
});

// ============================================================================
// Configuration
// ============================================================================

router.get('/config', authMiddleware, requireRole('owner', 'admin'), (req: Request, res: Response) => {
  const config = {
    githubConfigured: configManager.isGitHubConfigured(),
    tunnelConfigured: configManager.isTunnelConfigured(),
    webPort: configManager.webPort,
    preferences: configManager.preferences
  };
  res.json({ success: true, data: config });
});

router.put('/config/github', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  try {
    await configManager.setGitHubConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update GitHub config';
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    });
  }
});

router.put('/config/tunnel', authMiddleware, requireRole('owner'), async (req: Request, res: Response) => {
  try {
    await configManager.setTunnelConfig(req.body);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update tunnel config';
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    });
  }
});

router.put('/config/preferences', authMiddleware, async (req: Request, res: Response) => {
  try {
    await configManager.setPreferences(req.body);
    res.json({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update preferences';
    res.status(500).json({
      success: false,
      error: { code: 'UPDATE_FAILED', message }
    });
  }
});

export default router;

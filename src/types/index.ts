/**
 * McServer - Core Type Definitions
 * 
 * These types define the fundamental data structures used throughout the application.
 */

// ============================================================================
// Server Types
// ============================================================================

export type ServerType = 'vanilla' | 'forge' | 'fabric';
export type ServerStatus = 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed' | 'locked';

export interface ServerProfile {
  id: string;
  name: string;
  type: ServerType;
  minecraftVersion: string;
  loaderVersion?: string;
  createdAt: Date;
  updatedAt: Date;
  settings: ServerSettings;
  worldName: string;
  autoRestart: boolean;
  maxRestarts: number;
}

export interface ServerSettings {
  maxPlayers: number;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  pvp: boolean;
  allowNether: boolean;
  spawnProtection: number;
  viewDistance: number;
  simulationDistance: number;
  maxTickTime: number;
  motd: string;
  whitelistEnabled: boolean;
  onlineMode: boolean;
  port: number;
  jvmArgs: string[];
  customProperties: Record<string, string>;
}

export interface ServerState {
  status: ServerStatus;
  profileId: string | null;
  startTime: Date | null;
  players: Player[];
  lastCrash: CrashInfo | null;
  restartCount: number;
  pid: number | null;
}

export interface Player {
  username: string;
  uuid: string;
  joinedAt: Date;
  ip?: string;
}

export interface CrashInfo {
  timestamp: Date;
  reason: string;
  stackTrace?: string;
  recoverable: boolean;
}

// ============================================================================
// Mod Types
// ============================================================================

export interface ModInfo {
  id: string;
  name: string;
  version: string;
  loader: 'forge' | 'fabric';
  minecraftVersions: string[];
  dependencies: ModDependency[];
  filePath: string;
  fileName: string;
  hash: string;
  enabled: boolean;
}

export interface ModDependency {
  modId: string;
  versionRange?: string;
  required: boolean;
  type: 'required' | 'optional' | 'incompatible';
}

export interface ModCompatibilityResult {
  compatible: boolean;
  errors: ModCompatibilityError[];
  warnings: ModCompatibilityWarning[];
}

export interface ModCompatibilityError {
  type: 'loader_mismatch' | 'duplicate_mod' | 'missing_dependency' | 'incompatible_version';
  modId: string;
  message: string;
  details?: string;
}

export interface ModCompatibilityWarning {
  type: 'version_mismatch' | 'optional_missing' | 'unknown_compatibility';
  modId: string;
  message: string;
  details?: string;
}

// ============================================================================
// GitHub / Sync Types
// ============================================================================

export interface GitHubConfig {
  owner: string;
  repo: string;
  branch: string;
  token: string;
  lfsEnabled: boolean;
}

export interface LockState {
  locked: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
  machineId: string | null;
  reason: string | null;
  expiresAt: Date | null;
}

export interface SyncState {
  lastSyncTime: Date | null;
  lastCommitHash: string | null;
  pendingChanges: boolean;
  syncInProgress: boolean;
  lastError: string | null;
}

export interface WorldVersion {
  commitHash: string;
  message: string;
  timestamp: Date;
  author: string;
  size: number;
  profileId: string;
}

export interface SyncResult {
  success: boolean;
  commitHash?: string;
  error?: string;
  filesChanged?: number;
  bytesTransferred?: number;
}

// ============================================================================
// Backup Types
// ============================================================================

export interface BackupInfo {
  id: string;
  profileId: string;
  commitHash: string;
  timestamp: Date;
  size: number;
  description: string;
  type: 'auto' | 'manual' | 'pre-shutdown';
  verified: boolean;
  hash: string;
}

export interface RestoreResult {
  success: boolean;
  restoredFrom: BackupInfo;
  error?: string;
}

// ============================================================================
// Network / Tunnel Types
// ============================================================================

export type TunnelProvider = 'playit' | 'ngrok' | 'cloudflare' | 'custom';
export type TunnelStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface TunnelConfig {
  provider: TunnelProvider;
  authToken?: string;
  customDomain?: string;
  region?: string;
}

export interface TunnelState {
  status: TunnelStatus;
  publicAddress: string | null;
  localPort: number;
  startTime: Date | null;
  lastError: string | null;
  bytesIn: number;
  bytesOut: number;
}

// ============================================================================
// Auth Types
// ============================================================================

export interface User {
  id: string;
  username: string;
  email?: string;
  role: 'owner' | 'admin' | 'member';
  createdAt: Date;
  lastLogin: Date | null;
}

export interface AuthToken {
  token: string;
  userId: string;
  expiresAt: Date;
  scopes: string[];
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  createdAt: Date;
  expiresAt: Date;
  ipAddress?: string;
  userAgent?: string;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AppConfig {
  dataDir: string;
  serverDir: string;
  backupDir: string;
  logsDir: string;
  github: GitHubConfig;
  tunnel: TunnelConfig;
  webPort: number;
  autoUpdate: boolean;
  telemetry: boolean;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  notifications: boolean;
  autoStartServer: boolean;
  confirmDangerousActions: boolean;
  advancedMode: boolean;
}

// ============================================================================
// Event Types
// ============================================================================

export type ServerEventType = 
  | 'server:starting'
  | 'server:started'
  | 'server:stopping'
  | 'server:stopped'
  | 'server:crashed'
  | 'player:joined'
  | 'player:left'
  | 'sync:started'
  | 'sync:completed'
  | 'sync:failed'
  | 'lock:acquired'
  | 'lock:released'
  | 'tunnel:connected'
  | 'tunnel:disconnected'
  | 'mod:added'
  | 'mod:removed'
  | 'backup:created'
  | 'backup:restored';

export interface ServerEvent {
  type: ServerEventType;
  timestamp: Date;
  data: Record<string, unknown>;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

// ============================================================================
// Dashboard Types
// ============================================================================

export interface DashboardState {
  server: ServerState;
  sync: SyncState;
  lock: LockState;
  tunnel: TunnelState;
  currentProfile: ServerProfile | null;
  recentEvents: ServerEvent[];
  systemInfo: SystemInfo;
}

export interface SystemInfo {
  platform: string;
  arch: string;
  nodeVersion: string;
  appVersion: string;
  javaVersion: string | null;
  memoryUsage: {
    used: number;
    total: number;
  };
  diskUsage: {
    used: number;
    total: number;
  };
}

// ============================================================================
// Log Types
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
}

export interface LogFilter {
  level?: LogLevel[];
  source?: string[];
  startTime?: Date;
  endTime?: Date;
  search?: string;
}

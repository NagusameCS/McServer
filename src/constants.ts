/**
 * McServer - Constants
 * 
 * Application-wide constants and default values.
 */

import path from 'path';
import os from 'os';

// ============================================================================
// Application Info
// ============================================================================

export const APP_NAME = 'McServer';
export const APP_VERSION = '1.0.0';
export const APP_DESCRIPTION = 'Shared Minecraft server hosting with seamless world sync';

// ============================================================================
// Paths
// ============================================================================

export const DEFAULT_DATA_DIR = path.join(os.homedir(), '.mcserver');
export const DEFAULT_SERVER_DIR = path.join(DEFAULT_DATA_DIR, 'servers');
export const DEFAULT_BACKUP_DIR = path.join(DEFAULT_DATA_DIR, 'backups');
export const DEFAULT_LOGS_DIR = path.join(DEFAULT_DATA_DIR, 'logs');
export const DEFAULT_MODS_DIR = path.join(DEFAULT_DATA_DIR, 'mods');
export const CONFIG_FILE = 'config.yaml';
export const LOCK_FILE = '.mcserver.lock';
export const STATE_FILE = '.mcserver.state';

// ============================================================================
// Minecraft Versions & Downloads
// ============================================================================

export const MINECRAFT_VERSION_MANIFEST = 'https://launchermeta.mojang.com/mc/game/version_manifest.json';
export const FORGE_MAVEN_URL = 'https://maven.minecraftforge.net';
export const FABRIC_META_URL = 'https://meta.fabricmc.net/v2';
export const FABRIC_MAVEN_URL = 'https://maven.fabricmc.net';

export const DEFAULT_JVM_ARGS = [
  '-Xmx4G',
  '-Xms1G',
  '-XX:+UseG1GC',
  '-XX:+ParallelRefProcEnabled',
  '-XX:MaxGCPauseMillis=200',
  '-XX:+UnlockExperimentalVMOptions',
  '-XX:+DisableExplicitGC',
  '-XX:+AlwaysPreTouch',
  '-XX:G1NewSizePercent=30',
  '-XX:G1MaxNewSizePercent=40',
  '-XX:G1HeapRegionSize=8M',
  '-XX:G1ReservePercent=20',
  '-XX:G1HeapWastePercent=5',
  '-XX:G1MixedGCCountTarget=4',
  '-XX:InitiatingHeapOccupancyPercent=15',
  '-XX:G1MixedGCLiveThresholdPercent=90',
  '-XX:G1RSetUpdatingPauseTimePercent=5',
  '-XX:SurvivorRatio=32',
  '-XX:+PerfDisableSharedMem',
  '-XX:MaxTenuringThreshold=1'
];

// ============================================================================
// Server Defaults
// ============================================================================

export const DEFAULT_SERVER_SETTINGS = {
  maxPlayers: 20,
  gamemode: 'survival' as const,
  difficulty: 'normal' as const,
  pvp: true,
  allowNether: true,
  spawnProtection: 16,
  viewDistance: 10,
  simulationDistance: 10,
  maxTickTime: 60000,
  motd: 'A McServer Minecraft Server',
  whitelistEnabled: false,
  onlineMode: true,
  port: 25565,
  jvmArgs: DEFAULT_JVM_ARGS,
  customProperties: {}
};

export const DEFAULT_PROFILE = {
  autoRestart: true,
  maxRestarts: 3,
  worldName: 'world'
};

// ============================================================================
// Timeouts & Intervals
// ============================================================================

export const SERVER_START_TIMEOUT = 120000; // 2 minutes
export const SERVER_STOP_TIMEOUT = 30000; // 30 seconds
export const SYNC_TIMEOUT = 300000; // 5 minutes
export const LOCK_TIMEOUT = 3600000; // 1 hour
export const LOCK_REFRESH_INTERVAL = 300000; // 5 minutes
export const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds
export const LOG_ROTATION_INTERVAL = 86400000; // 24 hours

// ============================================================================
// Git / GitHub
// ============================================================================

export const GIT_LFS_PATTERNS = [
  '*.dat',
  '*.dat_old',
  '*.mca',
  '*.mcr',
  '*.nbt',
  '*.jar',
  '*.zip'
];

export const SYNC_IGNORE_PATTERNS = [
  'logs/',
  'crash-reports/',
  '*.log',
  '*.lock',
  'session.lock',
  '.git/',
  'cache/'
];

// ============================================================================
// Network
// ============================================================================

export const DEFAULT_WEB_PORT = 3847;
export const DEFAULT_MC_PORT = 25565;
export const TUNNEL_RECONNECT_DELAY = 5000;
export const TUNNEL_MAX_RETRIES = 5;

// ============================================================================
// Mod Loaders
// ============================================================================

export const FORGE_INSTALLER_PATTERN = /forge-(.+)-installer\.jar/;
export const FABRIC_INSTALLER_URL = 'https://maven.fabricmc.net/net/fabricmc/fabric-installer/';

export const MOD_FILE_EXTENSIONS = ['.jar'];
export const FABRIC_MOD_JSON = 'fabric.mod.json';
export const FORGE_MOD_TOML = 'META-INF/mods.toml';
export const FORGE_MOD_INFO = 'mcmod.info';

// ============================================================================
// Security
// ============================================================================

export const JWT_EXPIRY = '7d';
export const SESSION_EXPIRY = 604800000; // 7 days in ms
export const BCRYPT_ROUNDS = 12;
export const TOKEN_LENGTH = 32;

export const RATE_LIMIT = {
  windowMs: 60000, // 1 minute
  max: 100 // requests per window
};

// ============================================================================
// Logging
// ============================================================================

export const LOG_MAX_SIZE = 10 * 1024 * 1024; // 10 MB
export const LOG_MAX_FILES = 5;
export const LOG_DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';

// ============================================================================
// Error Codes
// ============================================================================

export const ERROR_CODES = {
  // General
  UNKNOWN_ERROR: 'E0001',
  INVALID_CONFIG: 'E0002',
  PERMISSION_DENIED: 'E0003',
  NOT_FOUND: 'E0004',
  
  // Server
  SERVER_ALREADY_RUNNING: 'E1001',
  SERVER_START_FAILED: 'E1002',
  SERVER_STOP_FAILED: 'E1003',
  SERVER_CRASHED: 'E1004',
  JAVA_NOT_FOUND: 'E1005',
  INVALID_JAR: 'E1006',
  
  // Sync
  SYNC_FAILED: 'E2001',
  LOCK_CONFLICT: 'E2002',
  LOCK_EXPIRED: 'E2003',
  MERGE_CONFLICT: 'E2004',
  UPLOAD_FAILED: 'E2005',
  DOWNLOAD_FAILED: 'E2006',
  
  // Mods
  MOD_INCOMPATIBLE: 'E3001',
  MOD_MISSING_DEP: 'E3002',
  MOD_DUPLICATE: 'E3003',
  MOD_LOADER_MISMATCH: 'E3004',
  
  // Network
  TUNNEL_FAILED: 'E4001',
  CONNECTION_LOST: 'E4002',
  
  // Auth
  AUTH_FAILED: 'E5001',
  TOKEN_EXPIRED: 'E5002',
  INVALID_TOKEN: 'E5003'
} as const;

// ============================================================================
// Messages
// ============================================================================

export const MESSAGES = {
  SERVER_STARTING: 'Starting Minecraft server...',
  SERVER_STARTED: 'Minecraft server is now running!',
  SERVER_STOPPING: 'Stopping Minecraft server...',
  SERVER_STOPPED: 'Minecraft server has stopped.',
  SERVER_CRASHED: 'Minecraft server has crashed!',
  
  SYNC_STARTING: 'Synchronizing world data...',
  SYNC_COMPLETED: 'World data synchronized successfully.',
  SYNC_FAILED: 'Failed to synchronize world data.',
  
  LOCK_ACQUIRED: 'Server lock acquired.',
  LOCK_RELEASED: 'Server lock released.',
  LOCK_CONFLICT: 'Another host is currently active.',
  
  TUNNEL_CONNECTING: 'Establishing tunnel connection...',
  TUNNEL_CONNECTED: 'Tunnel connected successfully.',
  TUNNEL_DISCONNECTED: 'Tunnel disconnected.'
} as const;

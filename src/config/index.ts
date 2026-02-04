/**
 * McServer - Configuration Manager
 * 
 * Handles application configuration with secure credential storage.
 */

import fs from 'fs-extra';
import path from 'path';
import yaml from 'yaml';
import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';
import { 
  AppConfig, 
  GitHubConfig, 
  TunnelConfig, 
  ServerProfile,
  UserPreferences 
} from '../types';
import { 
  DEFAULT_DATA_DIR, 
  DEFAULT_SERVER_DIR, 
  DEFAULT_BACKUP_DIR, 
  DEFAULT_LOGS_DIR,
  DEFAULT_WEB_PORT,
  CONFIG_FILE 
} from '../constants';
import { createLogger, getMachineId, generateToken, deepMerge } from '../utils';

const logger = createLogger('Config');
const scryptAsync = promisify(scrypt);

// ============================================================================
// Types
// ============================================================================

interface ConfigFile {
  version: string;
  github?: Partial<GitHubConfig>;
  tunnel?: Partial<TunnelConfig>;
  profiles: ServerProfile[];
  activeProfileId?: string;
  webPort: number;
  autoUpdate: boolean;
  telemetry: boolean;
  preferences: UserPreferences;
}

interface SecureStorage {
  encryptedToken?: string;
  iv?: string;
  salt?: string;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: ConfigFile = {
  version: '1.0.0',
  profiles: [],
  webPort: DEFAULT_WEB_PORT,
  autoUpdate: true,
  telemetry: false,
  preferences: {
    theme: 'system',
    notifications: true,
    autoStartServer: false,
    confirmDangerousActions: true,
    advancedMode: false
  }
};

// ============================================================================
// Configuration Manager Class
// ============================================================================

class ConfigManager {
  private configPath: string;
  private securePath: string;
  private config: ConfigFile;
  private machineId: string | null = null;

  constructor() {
    this.configPath = path.join(DEFAULT_DATA_DIR, CONFIG_FILE);
    this.securePath = path.join(DEFAULT_DATA_DIR, '.credentials');
    this.config = { ...DEFAULT_CONFIG };
  }

  /**
   * Initialize configuration manager
   */
  async initialize(): Promise<void> {
    // Ensure directories exist
    await fs.ensureDir(DEFAULT_DATA_DIR);
    await fs.ensureDir(DEFAULT_SERVER_DIR);
    await fs.ensureDir(DEFAULT_BACKUP_DIR);
    await fs.ensureDir(DEFAULT_LOGS_DIR);

    // Get machine ID for encryption
    this.machineId = await getMachineId();

    // Load existing config or create default
    if (await fs.pathExists(this.configPath)) {
      await this.load();
    } else {
      await this.save();
    }

    logger.info('Configuration manager initialized');
  }

  /**
   * Load configuration from disk
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.configPath, 'utf-8');
      const loaded = yaml.parse(content) as Partial<ConfigFile>;
      this.config = deepMerge(DEFAULT_CONFIG, loaded);

      // Load secure credentials
      if (await fs.pathExists(this.securePath)) {
        const secureContent = await fs.readFile(this.securePath, 'utf-8');
        const secure = JSON.parse(secureContent) as SecureStorage;
        
        if (secure.encryptedToken && secure.iv && secure.salt) {
          const token = await this.decryptToken(secure.encryptedToken, secure.iv, secure.salt);
          if (token && this.config.github) {
            this.config.github.token = token;
          }
        }
      }

      logger.debug('Configuration loaded');
    } catch (error) {
      logger.error('Failed to load configuration', { error });
      this.config = { ...DEFAULT_CONFIG };
    }
  }

  /**
   * Save configuration to disk
   */
  async save(): Promise<void> {
    try {
      // Prepare config without sensitive data
      const configToSave = { ...this.config };
      const githubToken = configToSave.github?.token;
      
      if (configToSave.github) {
        delete configToSave.github.token;
      }

      // Save main config
      const content = yaml.stringify(configToSave);
      await fs.writeFile(this.configPath, content);

      // Save encrypted credentials separately
      if (githubToken) {
        const { encrypted, iv, salt } = await this.encryptToken(githubToken);
        const secure: SecureStorage = {
          encryptedToken: encrypted,
          iv,
          salt
        };
        await fs.writeFile(this.securePath, JSON.stringify(secure));
        
        // Restore token in memory
        if (this.config.github) {
          this.config.github.token = githubToken;
        }
      }

      logger.debug('Configuration saved');
    } catch (error) {
      logger.error('Failed to save configuration', { error });
      throw error;
    }
  }

  /**
   * Encrypt token using machine-specific key
   */
  private async encryptToken(token: string): Promise<{ encrypted: string; iv: string; salt: string }> {
    const salt = randomBytes(16).toString('hex');
    const iv = randomBytes(16);
    const key = await scryptAsync(this.machineId || 'default', salt, 32) as Buffer;
    
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    return {
      encrypted: encrypted + ':' + authTag,
      iv: iv.toString('hex'),
      salt
    };
  }

  /**
   * Decrypt token using machine-specific key
   */
  private async decryptToken(encrypted: string, ivHex: string, salt: string): Promise<string | null> {
    try {
      const [encryptedData, authTag] = encrypted.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      const key = await scryptAsync(this.machineId || 'default', salt, 32) as Buffer;
      
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(Buffer.from(authTag, 'hex'));
      
      let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt token', { error });
      return null;
    }
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get dataDir(): string {
    return DEFAULT_DATA_DIR;
  }

  get serverDir(): string {
    return DEFAULT_SERVER_DIR;
  }

  get backupDir(): string {
    return DEFAULT_BACKUP_DIR;
  }

  get logsDir(): string {
    return DEFAULT_LOGS_DIR;
  }

  get webPort(): number {
    return this.config.webPort;
  }

  get github(): GitHubConfig | undefined {
    return this.config.github as GitHubConfig | undefined;
  }

  get tunnel(): TunnelConfig | undefined {
    return this.config.tunnel as TunnelConfig | undefined;
  }

  get profiles(): ServerProfile[] {
    return this.config.profiles;
  }

  get activeProfileId(): string | undefined {
    return this.config.activeProfileId;
  }

  get preferences(): UserPreferences {
    return this.config.preferences;
  }

  // ============================================================================
  // Setters
  // ============================================================================

  async setGitHubConfig(config: GitHubConfig): Promise<void> {
    this.config.github = config;
    await this.save();
    logger.info('GitHub configuration updated');
  }

  async setTunnelConfig(config: TunnelConfig): Promise<void> {
    this.config.tunnel = config;
    await this.save();
    logger.info('Tunnel configuration updated');
  }

  async setWebPort(port: number): Promise<void> {
    this.config.webPort = port;
    await this.save();
  }

  async setPreferences(prefs: Partial<UserPreferences>): Promise<void> {
    this.config.preferences = { ...this.config.preferences, ...prefs };
    await this.save();
  }

  async setSetupComplete(complete: boolean): Promise<void> {
    (this.config as any).setupComplete = complete;
    await this.save();
    logger.info('Setup complete status updated');
  }

  // ============================================================================
  // Profile Management
  // ============================================================================

  async addProfile(profile: ServerProfile): Promise<void> {
    this.config.profiles.push(profile);
    await this.save();
    logger.info(`Profile created: ${profile.name}`);
  }

  async updateProfile(id: string, updates: Partial<ServerProfile>): Promise<void> {
    const index = this.config.profiles.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Profile not found: ${id}`);
    }
    
    this.config.profiles[index] = { 
      ...this.config.profiles[index], 
      ...updates,
      updatedAt: new Date()
    };
    await this.save();
    logger.info(`Profile updated: ${id}`);
  }

  async deleteProfile(id: string): Promise<void> {
    const index = this.config.profiles.findIndex(p => p.id === id);
    if (index === -1) {
      throw new Error(`Profile not found: ${id}`);
    }

    this.config.profiles.splice(index, 1);
    
    if (this.config.activeProfileId === id) {
      this.config.activeProfileId = undefined;
    }
    
    await this.save();
    logger.info(`Profile deleted: ${id}`);
  }

  async setActiveProfile(id: string): Promise<void> {
    const profile = this.config.profiles.find(p => p.id === id);
    if (!profile) {
      throw new Error(`Profile not found: ${id}`);
    }

    this.config.activeProfileId = id;
    await this.save();
    logger.info(`Active profile set: ${profile.name}`);
  }

  getProfile(id: string): ServerProfile | undefined {
    return this.config.profiles.find(p => p.id === id);
  }

  getActiveProfile(): ServerProfile | undefined {
    if (!this.config.activeProfileId) return undefined;
    return this.getProfile(this.config.activeProfileId);
  }

  // ============================================================================
  // Validation
  // ============================================================================

  isGitHubConfigured(): boolean {
    return !!(
      this.config.github?.owner &&
      this.config.github?.repo &&
      this.config.github?.token
    );
  }

  isTunnelConfigured(): boolean {
    return !!(this.config.tunnel?.provider);
  }

  hasProfiles(): boolean {
    return this.config.profiles.length > 0;
  }

  /**
   * Get full application config
   */
  getAppConfig(): AppConfig {
    return {
      dataDir: DEFAULT_DATA_DIR,
      serverDir: DEFAULT_SERVER_DIR,
      backupDir: DEFAULT_BACKUP_DIR,
      logsDir: DEFAULT_LOGS_DIR,
      github: this.config.github as GitHubConfig,
      tunnel: this.config.tunnel as TunnelConfig,
      webPort: this.config.webPort,
      autoUpdate: this.config.autoUpdate,
      telemetry: this.config.telemetry
    };
  }
}

// Export singleton instance
export const configManager = new ConfigManager();
export default configManager;

/**
 * McServer - Tunnel Manager
 * 
 * Manages NAT traversal using various tunnel providers.
 * Supports playit.gg, ngrok, and Cloudflare tunnels.
 */

import { spawn, ChildProcess, exec } from 'child_process';
import { EventEmitter } from 'events';
import { promisify } from 'util';
import fs from 'fs-extra';
import path from 'path';
import axios from 'axios';
import os from 'os';
import { 
  TunnelConfig, 
  TunnelState, 
  TunnelProvider, 
  TunnelStatus 
} from '../types';
import { 
  TUNNEL_RECONNECT_DELAY, 
  TUNNEL_MAX_RETRIES,
  DEFAULT_MC_PORT,
  DEFAULT_DATA_DIR
} from '../constants';
import { createLogger, sleep, retry } from '../utils';

const logger = createLogger('Tunnel');
const execAsync = promisify(exec);

// ============================================================================
// Tunnel Provider Interface
// ============================================================================

interface TunnelProviderInterface {
  name: string;
  connect(port: number, config: TunnelConfig): Promise<string>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  getPublicAddress(): string | null;
}

// ============================================================================
// Playit.gg Provider
// ============================================================================

class PlayitProvider implements TunnelProviderInterface {
  name = 'playit';
  private process: ChildProcess | null = null;
  private publicAddress: string | null = null;
  private connected: boolean = false;

  async connect(port: number, config: TunnelConfig): Promise<string> {
    const binaryPath = await this.ensureBinary();
    
    logger.info('Starting playit.gg tunnel...');

    this.process = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PLAYIT_SECRET: config.authToken || ''
      }
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Playit connection timeout'));
      }, 60000);

      this.process!.stdout?.on('data', (data) => {
        const output = data.toString();
        logger.debug(`Playit: ${output.trim()}`);

        // Parse public address from output
        const addressMatch = output.match(/(\w+\.playit\.gg:\d+)/);
        if (addressMatch) {
          this.publicAddress = addressMatch[1];
          this.connected = true;
          clearTimeout(timeout);
          resolve(this.publicAddress!);
        }

        // Look for claim URL for initial setup
        const claimMatch = output.match(/https:\/\/playit\.gg\/claim\/\S+/);
        if (claimMatch) {
          logger.info(`Playit claim URL: ${claimMatch[0]}`);
        }
      });

      this.process!.stderr?.on('data', (data) => {
        logger.error(`Playit error: ${data.toString().trim()}`);
      });

      this.process!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.process!.on('close', (code) => {
        this.connected = false;
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Playit exited with code ${code}`));
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.publicAddress = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPublicAddress(): string | null {
    return this.publicAddress;
  }

  private async ensureBinary(): Promise<string> {
    const binDir = path.join(DEFAULT_DATA_DIR, 'bin');
    await fs.ensureDir(binDir);

    const platform = os.platform();
    const arch = os.arch();
    
    let binaryName = 'playit';
    if (platform === 'win32') {
      binaryName = 'playit.exe';
    }

    const binaryPath = path.join(binDir, binaryName);

    if (await fs.pathExists(binaryPath)) {
      return binaryPath;
    }

    // Download playit binary
    logger.info('Downloading playit.gg binary...');
    
    let downloadUrl: string;
    if (platform === 'darwin') {
      downloadUrl = arch === 'arm64' 
        ? 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-darwin-aarch64'
        : 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-darwin-amd64';
    } else if (platform === 'win32') {
      downloadUrl = 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-windows-x86_64.exe';
    } else {
      downloadUrl = arch === 'arm64'
        ? 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-linux-aarch64'
        : 'https://github.com/playit-cloud/playit-agent/releases/latest/download/playit-linux-amd64';
    }

    const response = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'arraybuffer'
    });

    await fs.writeFile(binaryPath, response.data);
    await fs.chmod(binaryPath, 0o755);

    logger.info('Playit binary downloaded');
    return binaryPath;
  }
}

// ============================================================================
// Ngrok Provider
// ============================================================================

class NgrokProvider implements TunnelProviderInterface {
  name = 'ngrok';
  private process: ChildProcess | null = null;
  private publicAddress: string | null = null;
  private connected: boolean = false;

  async connect(port: number, config: TunnelConfig): Promise<string> {
    // Check if ngrok is installed
    try {
      await execAsync('ngrok version');
    } catch {
      throw new Error('ngrok is not installed. Please install it from https://ngrok.com');
    }

    logger.info('Starting ngrok tunnel...');

    // Set auth token if provided
    if (config.authToken) {
      await execAsync(`ngrok authtoken ${config.authToken}`);
    }

    const args = ['tcp', String(port)];
    if (config.region) {
      args.push('--region', config.region);
    }

    this.process = spawn('ngrok', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    // Wait for ngrok to start and get public URL
    await sleep(3000);

    // Query ngrok API for public URL
    try {
      const response = await axios.get('http://127.0.0.1:4040/api/tunnels');
      const tunnel = response.data.tunnels.find((t: any) => t.proto === 'tcp');
      
      if (tunnel) {
        this.publicAddress = tunnel.public_url.replace('tcp://', '');
        this.connected = true;
        logger.info(`Ngrok tunnel established: ${this.publicAddress}`);
        return this.publicAddress!;
      }
    } catch (error) {
      throw new Error('Failed to get ngrok tunnel URL');
    }

    throw new Error('Failed to establish ngrok tunnel');
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.publicAddress = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPublicAddress(): string | null {
    return this.publicAddress;
  }
}

// ============================================================================
// Cloudflare Tunnel Provider
// ============================================================================

class CloudflareProvider implements TunnelProviderInterface {
  name = 'cloudflare';
  private process: ChildProcess | null = null;
  private publicAddress: string | null = null;
  private connected: boolean = false;

  async connect(port: number, config: TunnelConfig): Promise<string> {
    // Check if cloudflared is installed
    try {
      await execAsync('cloudflared version');
    } catch {
      throw new Error('cloudflared is not installed. Please install it from https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/');
    }

    logger.info('Starting Cloudflare tunnel...');

    // For Minecraft, we use TCP tunnel
    const args = ['tunnel', '--url', `tcp://localhost:${port}`];

    this.process = spawn('cloudflared', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Cloudflare tunnel connection timeout'));
      }, 60000);

      this.process!.stderr?.on('data', (data) => {
        const output = data.toString();
        logger.debug(`Cloudflare: ${output.trim()}`);

        // Parse public URL from output
        const urlMatch = output.match(/https?:\/\/[^\s]+\.trycloudflare\.com/);
        if (urlMatch) {
          // Note: Cloudflare quick tunnels are HTTP-based
          // For Minecraft TCP, users need a configured tunnel with custom domain
          this.publicAddress = config.customDomain || urlMatch[0].replace('https://', '');
          this.connected = true;
          clearTimeout(timeout);
          resolve(this.publicAddress!);
        }
      });

      this.process!.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });

      this.process!.on('close', (code) => {
        this.connected = false;
        if (code !== 0) {
          clearTimeout(timeout);
          reject(new Error(`Cloudflare tunnel exited with code ${code}`));
        }
      });
    });
  }

  async disconnect(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
    this.connected = false;
    this.publicAddress = null;
  }

  isConnected(): boolean {
    return this.connected;
  }

  getPublicAddress(): string | null {
    return this.publicAddress;
  }
}

// ============================================================================
// Tunnel Manager
// ============================================================================

export class TunnelManager extends EventEmitter {
  private provider: TunnelProviderInterface | null = null;
  private config: TunnelConfig;
  private state: TunnelState;
  private localPort: number;
  private reconnectAttempts: number = 0;
  private autoReconnect: boolean = true;

  constructor(config: TunnelConfig) {
    super();
    this.config = config;
    this.localPort = DEFAULT_MC_PORT;
    this.state = {
      status: 'disconnected',
      publicAddress: null,
      localPort: this.localPort,
      startTime: null,
      lastError: null,
      bytesIn: 0,
      bytesOut: 0
    };
  }

  /**
   * Create provider instance based on config
   */
  private createProvider(): TunnelProviderInterface {
    switch (this.config.provider) {
      case 'playit':
        return new PlayitProvider();
      case 'ngrok':
        return new NgrokProvider();
      case 'cloudflare':
        return new CloudflareProvider();
      default:
        throw new Error(`Unsupported tunnel provider: ${this.config.provider}`);
    }
  }

  /**
   * Connect the tunnel
   */
  async connect(port?: number): Promise<string> {
    if (port) {
      this.localPort = port;
      this.state.localPort = port;
    }

    if (this.state.status === 'connected') {
      return this.state.publicAddress!;
    }

    this.state.status = 'connecting';
    this.emit('connecting');
    logger.info(`Connecting tunnel (${this.config.provider}) for port ${this.localPort}...`);

    try {
      this.provider = this.createProvider();
      const publicAddress = await this.provider.connect(this.localPort, this.config);

      this.state.status = 'connected';
      this.state.publicAddress = publicAddress;
      this.state.startTime = new Date();
      this.state.lastError = null;
      this.reconnectAttempts = 0;

      logger.info(`Tunnel connected: ${publicAddress}`);
      this.emit('connected', publicAddress);

      return publicAddress;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.state.status = 'error';
      this.state.lastError = message;
      
      logger.error('Tunnel connection failed', { error: message });
      this.emit('error', error);

      // Auto-reconnect if enabled
      if (this.autoReconnect && this.reconnectAttempts < TUNNEL_MAX_RETRIES) {
        this.reconnectAttempts++;
        logger.info(`Reconnecting in ${TUNNEL_RECONNECT_DELAY}ms (attempt ${this.reconnectAttempts}/${TUNNEL_MAX_RETRIES})...`);
        await sleep(TUNNEL_RECONNECT_DELAY);
        return this.connect();
      }

      throw error;
    }
  }

  /**
   * Disconnect the tunnel
   */
  async disconnect(): Promise<void> {
    if (this.provider) {
      await this.provider.disconnect();
      this.provider = null;
    }

    this.state.status = 'disconnected';
    this.state.publicAddress = null;
    this.state.startTime = null;
    this.autoReconnect = false;

    logger.info('Tunnel disconnected');
    this.emit('disconnected');
  }

  /**
   * Get current state
   */
  getState(): TunnelState {
    return { ...this.state };
  }

  /**
   * Get public address
   */
  getPublicAddress(): string | null {
    return this.state.publicAddress;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.state.status === 'connected' && this.provider?.isConnected() === true;
  }

  /**
   * Get status
   */
  getStatus(): TunnelStatus {
    return this.state.status;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<TunnelConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable auto-reconnect
   */
  setAutoReconnect(enabled: boolean): void {
    this.autoReconnect = enabled;
  }
}

export default TunnelManager;

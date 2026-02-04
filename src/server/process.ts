/**
 * McServer - Server Process Manager
 * 
 * Manages Minecraft server process lifecycle including starting, stopping,
 * crash detection, and log capture.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import fs from 'fs-extra';
import path from 'path';
import readline from 'readline';
import { 
  ServerType, 
  ServerStatus, 
  ServerState, 
  ServerProfile, 
  ServerSettings,
  Player,
  CrashInfo 
} from '../types';
import { 
  SERVER_START_TIMEOUT, 
  SERVER_STOP_TIMEOUT,
  DEFAULT_SERVER_SETTINGS,
  DEFAULT_JVM_ARGS
} from '../constants';
import { 
  createLogger, 
  logServerOutput, 
  createServerLogger, 
  closeServerLogger,
  findJava,
  parseServerProperties,
  serializeServerProperties,
  atomicWrite,
  sleep
} from '../utils';

const logger = createLogger('Process');

// ============================================================================
// Events
// ============================================================================

export interface ServerProcessEvents {
  'starting': () => void;
  'started': () => void;
  'stopping': () => void;
  'stopped': (code: number | null) => void;
  'crashed': (info: CrashInfo) => void;
  'player:joined': (player: Player) => void;
  'player:left': (player: Player) => void;
  'log': (line: string) => void;
  'error': (error: Error) => void;
}

// ============================================================================
// Server Process Class
// ============================================================================

export class ServerProcess extends EventEmitter {
  private process: ChildProcess | null = null;
  private profile: ServerProfile;
  private serverPath: string;
  private jarPath: string;
  private state: ServerState;
  private stdinWriter: readline.Interface | null = null;
  private startPromise: Promise<void> | null = null;
  private stopPromise: Promise<void> | null = null;
  private restartCount: number = 0;

  constructor(profile: ServerProfile, serverPath: string, jarPath: string) {
    super();
    this.profile = profile;
    this.serverPath = serverPath;
    this.jarPath = jarPath;
    this.state = {
      status: 'stopped',
      profileId: profile.id,
      startTime: null,
      players: [],
      lastCrash: null,
      restartCount: 0,
      pid: null
    };
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    if (this.state.status === 'running' || this.state.status === 'starting') {
      throw new Error('Server is already running or starting');
    }

    if (this.startPromise) {
      return this.startPromise;
    }

    this.startPromise = this.doStart();

    try {
      await this.startPromise;
    } finally {
      this.startPromise = null;
    }
  }

  private async doStart(): Promise<void> {
    // Find Java
    const javaPath = await findJava();
    if (!javaPath) {
      throw new Error('Java not found. Please install Java 17 or newer.');
    }

    logger.info(`Using Java: ${javaPath}`);

    // Ensure server directory exists
    await fs.ensureDir(this.serverPath);

    // Check JAR exists
    if (!await fs.pathExists(this.jarPath)) {
      throw new Error(`Server JAR not found: ${this.jarPath}`);
    }

    // Accept EULA
    await this.acceptEula();

    // Write server.properties
    await this.writeServerProperties();

    // Build command arguments
    const args = this.buildJvmArgs();

    this.state.status = 'starting';
    this.emit('starting');

    logger.info(`Starting server with args: ${args.join(' ')}`);

    // Create server log file
    createServerLogger(this.profile.id);

    // Spawn process
    this.process = spawn(javaPath, args, {
      cwd: this.serverPath,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.state.pid = this.process.pid || null;

    // Setup output handlers
    this.setupOutputHandlers();

    // Wait for server to start
    await this.waitForStart();

    this.state.status = 'running';
    this.state.startTime = new Date();
    this.state.restartCount = this.restartCount;
    
    this.emit('started');
    logger.info('Server started successfully');
  }

  /**
   * Stop the server gracefully
   */
  async stop(): Promise<void> {
    if (this.state.status === 'stopped' || this.state.status === 'stopping') {
      return;
    }

    if (this.stopPromise) {
      return this.stopPromise;
    }

    this.stopPromise = this.doStop();

    try {
      await this.stopPromise;
    } finally {
      this.stopPromise = null;
    }
  }

  private async doStop(): Promise<void> {
    if (!this.process) {
      this.state.status = 'stopped';
      return;
    }

    this.state.status = 'stopping';
    this.emit('stopping');

    logger.info('Stopping server...');

    // Send stop command
    this.sendCommand('stop');

    // Wait for graceful shutdown
    const stopped = await this.waitForStop();

    if (!stopped) {
      logger.warn('Server did not stop gracefully, force killing...');
      this.process.kill('SIGKILL');
      await sleep(1000);
    }

    closeServerLogger();
    
    this.state.status = 'stopped';
    this.state.pid = null;
    this.state.players = [];
    
    this.emit('stopped', this.process?.exitCode ?? null);
    logger.info('Server stopped');
  }

  /**
   * Force kill the server
   */
  kill(): void {
    if (this.process) {
      this.process.kill('SIGKILL');
      closeServerLogger();
      this.state.status = 'stopped';
      this.state.pid = null;
    }
  }

  /**
   * Restart the server
   */
  async restart(): Promise<void> {
    this.restartCount++;
    await this.stop();
    await sleep(2000);
    await this.start();
  }

  /**
   * Send a command to the server console
   */
  sendCommand(command: string): void {
    if (this.process && this.process.stdin) {
      this.process.stdin.write(command + '\n');
      logger.debug(`Command sent: ${command}`);
    }
  }

  /**
   * Get current state
   */
  getState(): ServerState {
    return { ...this.state };
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.state.status === 'running';
  }

  /**
   * Build JVM arguments
   */
  private buildJvmArgs(): string[] {
    const jvmArgs = this.profile.settings.jvmArgs.length > 0 
      ? this.profile.settings.jvmArgs 
      : DEFAULT_JVM_ARGS;

    const args = [...jvmArgs];

    // Add server-specific args based on type
    switch (this.profile.type) {
      case 'forge':
        // Forge uses special args
        args.push('-jar', this.jarPath);
        args.push('--nogui');
        break;
      
      case 'fabric':
        args.push('-jar', this.jarPath);
        args.push('--nogui');
        break;
      
      default:
        args.push('-jar', this.jarPath);
        args.push('nogui');
    }

    return args;
  }

  /**
   * Accept Minecraft EULA
   */
  private async acceptEula(): Promise<void> {
    const eulaPath = path.join(this.serverPath, 'eula.txt');
    await atomicWrite(eulaPath, 'eula=true\n');
    logger.debug('EULA accepted');
  }

  /**
   * Write server.properties file
   */
  private async writeServerProperties(): Promise<void> {
    const propsPath = path.join(this.serverPath, 'server.properties');
    const settings = this.profile.settings;

    // Read existing properties if present
    let existingProps: Record<string, string> = {};
    if (await fs.pathExists(propsPath)) {
      const content = await fs.readFile(propsPath, 'utf-8');
      existingProps = parseServerProperties(content);
    }

    // Merge with profile settings
    const properties: Record<string, string> = {
      ...existingProps,
      'server-port': String(settings.port),
      'max-players': String(settings.maxPlayers),
      'gamemode': settings.gamemode,
      'difficulty': settings.difficulty,
      'pvp': String(settings.pvp),
      'allow-nether': String(settings.allowNether),
      'spawn-protection': String(settings.spawnProtection),
      'view-distance': String(settings.viewDistance),
      'simulation-distance': String(settings.simulationDistance),
      'max-tick-time': String(settings.maxTickTime),
      'motd': settings.motd,
      'white-list': String(settings.whitelistEnabled),
      'online-mode': String(settings.onlineMode),
      'level-name': this.profile.worldName,
      ...settings.customProperties
    };

    await atomicWrite(propsPath, serializeServerProperties(properties));
    logger.debug('server.properties written');
  }

  /**
   * Setup stdout/stderr handlers
   */
  private setupOutputHandlers(): void {
    if (!this.process) return;

    const handleLine = (line: string) => {
      logServerOutput(line + '\n');
      this.emit('log', line);
      this.parseLogLine(line);
    };

    if (this.process.stdout) {
      const stdout = readline.createInterface({ input: this.process.stdout });
      stdout.on('line', handleLine);
    }

    if (this.process.stderr) {
      const stderr = readline.createInterface({ input: this.process.stderr });
      stderr.on('line', handleLine);
    }

    this.process.on('exit', (code, signal) => {
      logger.info(`Server process exited with code ${code}, signal ${signal}`);
      
      if (this.state.status === 'running' && code !== 0) {
        // Unexpected exit - crash
        this.handleCrash(code, signal);
      }
    });

    this.process.on('error', (error) => {
      logger.error('Server process error', { error: error.message });
      this.emit('error', error);
    });
  }

  /**
   * Parse log line for events
   */
  private parseLogLine(line: string): void {
    // Player joined
    const joinMatch = line.match(/\[Server thread\/INFO\].*?: (\w+)\[\/[\d.:]+\] logged in/);
    if (joinMatch) {
      const player: Player = {
        username: joinMatch[1],
        uuid: '',
        joinedAt: new Date()
      };
      this.state.players.push(player);
      this.emit('player:joined', player);
      logger.info(`Player joined: ${player.username}`);
    }

    // Player left
    const leaveMatch = line.match(/\[Server thread\/INFO\].*?: (\w+) left the game/);
    if (leaveMatch) {
      const username = leaveMatch[1];
      const playerIndex = this.state.players.findIndex(p => p.username === username);
      if (playerIndex !== -1) {
        const player = this.state.players[playerIndex];
        this.state.players.splice(playerIndex, 1);
        this.emit('player:left', player);
        logger.info(`Player left: ${username}`);
      }
    }
  }

  /**
   * Wait for server to start
   */
  private async waitForStart(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Server start timeout'));
      }, SERVER_START_TIMEOUT);

      const checkStarted = (line: string) => {
        // Look for "Done" message indicating server is ready
        if (line.includes('Done') && line.includes('For help, type "help"')) {
          clearTimeout(timeout);
          this.off('log', checkStarted);
          resolve();
        }

        // Check for common errors
        if (line.includes('Failed to start the minecraft server') ||
            line.includes('Exception in server tick loop') ||
            line.includes('Encountered an unexpected exception')) {
          clearTimeout(timeout);
          this.off('log', checkStarted);
          reject(new Error('Server failed to start'));
        }
      };

      this.on('log', checkStarted);
    });
  }

  /**
   * Wait for server to stop
   */
  private async waitForStop(): Promise<boolean> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve(false);
      }, SERVER_STOP_TIMEOUT);

      if (this.process) {
        this.process.once('exit', () => {
          clearTimeout(timeout);
          resolve(true);
        });
      } else {
        clearTimeout(timeout);
        resolve(true);
      }
    });
  }

  /**
   * Handle server crash
   */
  private handleCrash(code: number | null, signal: string | null): void {
    const crashInfo: CrashInfo = {
      timestamp: new Date(),
      reason: `Exited with code ${code}, signal ${signal}`,
      recoverable: true
    };

    this.state.status = 'crashed';
    this.state.lastCrash = crashInfo;

    logger.error('Server crashed', { code, signal });
    this.emit('crashed', crashInfo);

    // Check if we should auto-restart
    if (this.profile.autoRestart && this.restartCount < this.profile.maxRestarts) {
      logger.info(`Auto-restarting (attempt ${this.restartCount + 1}/${this.profile.maxRestarts})...`);
      setTimeout(() => {
        this.restart().catch(err => {
          logger.error('Auto-restart failed', { error: err.message });
        });
      }, 5000);
    }
  }

  /**
   * Get online players
   */
  getPlayers(): Player[] {
    return [...this.state.players];
  }

  /**
   * Get player count
   */
  getPlayerCount(): number {
    return this.state.players.length;
  }
}

export default ServerProcess;

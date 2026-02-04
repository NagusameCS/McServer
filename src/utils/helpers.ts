/**
 * McServer - Utility Functions
 * 
 * Common utility functions used throughout the application.
 */

import { createHash, randomBytes } from 'crypto';
import fs from 'fs-extra';
import path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import { v4 as uuidv4 } from 'uuid';

const execAsync = promisify(exec);

/**
 * Generate a unique machine ID based on hardware identifiers
 */
export async function getMachineId(): Promise<string> {
  const parts: string[] = [];
  
  // Get hostname
  parts.push(os.hostname());
  
  // Get platform-specific identifier
  try {
    if (os.platform() === 'darwin') {
      const { stdout } = await execAsync('ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID');
      const match = stdout.match(/"IOPlatformUUID" = "([^"]+)"/);
      if (match) parts.push(match[1]);
    } else if (os.platform() === 'win32') {
      const { stdout } = await execAsync('wmic csproduct get uuid');
      const lines = stdout.trim().split('\n');
      if (lines.length > 1) parts.push(lines[1].trim());
    } else {
      // Linux - try machine-id
      try {
        const machineId = await fs.readFile('/etc/machine-id', 'utf-8');
        parts.push(machineId.trim());
      } catch {
        parts.push(os.userInfo().username);
      }
    }
  } catch {
    parts.push(os.userInfo().username);
  }

  // Hash the combined parts
  return createHash('sha256').update(parts.join('-')).digest('hex').substring(0, 16);
}

/**
 * Generate a random token
 */
export function generateToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Generate a UUID
 */
export function generateId(): string {
  return uuidv4();
}

/**
 * Calculate SHA-256 hash of a file
 */
export async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = fs.createReadStream(filePath);
  
  return new Promise((resolve, reject) => {
    stream.on('data', data => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Calculate SHA-256 hash of a string
 */
export function hashString(str: string): string {
  return createHash('sha256').update(str).digest('hex');
}

/**
 * Get directory size recursively
 */
export async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0;

  if (!await fs.pathExists(dirPath)) {
    return 0;
  }

  const items = await fs.readdir(dirPath, { withFileTypes: true });

  for (const item of items) {
    const itemPath = path.join(dirPath, item.name);
    
    if (item.isDirectory()) {
      totalSize += await getDirectorySize(itemPath);
    } else {
      const stat = await fs.stat(itemPath);
      totalSize += stat.size;
    }
  }

  return totalSize;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  
  while (bytes >= 1024 && i < units.length - 1) {
    bytes /= 1024;
    i++;
  }
  
  return `${bytes.toFixed(2)} ${units[i]}`;
}

/**
 * Sleep for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    factor?: number;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    factor = 2
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelay;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt < maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * factor, maxDelay);
      }
    }
  }

  throw lastError;
}

/**
 * Check if a port is available
 */
export async function isPortAvailable(port: number): Promise<boolean> {
  const net = await import('net');
  
  return new Promise(resolve => {
    const server = net.createServer();
    
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close();
      resolve(true);
    });
    
    server.listen(port, '127.0.0.1');
  });
}

/**
 * Find an available port starting from the given port
 */
export async function findAvailablePort(startPort: number): Promise<number> {
  let port = startPort;
  
  while (port < 65535) {
    if (await isPortAvailable(port)) {
      return port;
    }
    port++;
  }
  
  throw new Error('No available ports found');
}

/**
 * Find Java executable
 */
export async function findJava(): Promise<string | null> {
  const javaCommands = ['java'];
  
  // Check JAVA_HOME
  if (process.env.JAVA_HOME) {
    const javaPath = path.join(process.env.JAVA_HOME, 'bin', os.platform() === 'win32' ? 'java.exe' : 'java');
    if (await fs.pathExists(javaPath)) {
      return javaPath;
    }
  }

  // Check PATH
  for (const cmd of javaCommands) {
    try {
      const { stdout } = await execAsync(os.platform() === 'win32' ? `where ${cmd}` : `which ${cmd}`);
      const javaPath = stdout.trim().split('\n')[0];
      if (javaPath && await fs.pathExists(javaPath)) {
        return javaPath;
      }
    } catch {
      continue;
    }
  }

  return null;
}

/**
 * Get Java version
 */
export async function getJavaVersion(): Promise<string | null> {
  const javaPath = await findJava();
  if (!javaPath) return null;

  try {
    const { stderr } = await execAsync(`"${javaPath}" -version`);
    const match = stderr.match(/version "([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

/**
 * Validate Minecraft server JAR
 */
export async function isValidServerJar(jarPath: string): Promise<boolean> {
  try {
    const yauzl = await import('yauzl');
    
    return new Promise(resolve => {
      yauzl.open(jarPath, { lazyEntries: true }, (err, zipfile) => {
        if (err || !zipfile) {
          resolve(false);
          return;
        }

        let foundMainClass = false;
        
        zipfile.on('entry', entry => {
          if (entry.fileName.endsWith('.class') || entry.fileName === 'META-INF/MANIFEST.MF') {
            foundMainClass = true;
          }
          zipfile.readEntry();
        });

        zipfile.on('end', () => {
          zipfile.close();
          resolve(foundMainClass);
        });

        zipfile.on('error', () => resolve(false));
        zipfile.readEntry();
      });
    });
  } catch {
    return false;
  }
}

/**
 * Copy directory with progress callback
 */
export async function copyDirectory(
  src: string,
  dest: string,
  options?: {
    filter?: (src: string) => boolean;
    onProgress?: (copied: number, total: number) => void;
  }
): Promise<void> {
  await fs.copy(src, dest, {
    filter: options?.filter
  });
}

/**
 * Atomic write to file (write to temp then rename)
 */
export async function atomicWrite(filePath: string, content: string | Buffer): Promise<void> {
  const tempPath = `${filePath}.tmp.${generateId()}`;
  
  try {
    await fs.writeFile(tempPath, content);
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.remove(tempPath);
    } catch {}
    throw error;
  }
}

/**
 * Parse Minecraft server properties file
 */
export function parseServerProperties(content: string): Record<string, string> {
  const properties: Record<string, string> = {};
  const lines = content.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key) {
        properties[key.trim()] = valueParts.join('=').trim();
      }
    }
  }

  return properties;
}

/**
 * Serialize to Minecraft server properties format
 */
export function serializeServerProperties(properties: Record<string, string>): string {
  const lines = ['#Minecraft server properties', `#Generated by McServer on ${new Date().toISOString()}`];
  
  for (const [key, value] of Object.entries(properties).sort()) {
    lines.push(`${key}=${value}`);
  }

  return lines.join('\n');
}

/**
 * Ensure directory exists and is empty
 */
export async function ensureEmptyDir(dirPath: string): Promise<void> {
  await fs.emptyDir(dirPath);
}

/**
 * Get system info
 */
export function getSystemInfo() {
  return {
    platform: os.platform(),
    arch: os.arch(),
    release: os.release(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpus: os.cpus().length,
    hostname: os.hostname(),
    uptime: os.uptime()
  };
}

/**
 * Deep merge objects
 */
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target } as T;

  for (const key of Object.keys(source as object) as (keyof T)[]) {
    const sourceValue = source[key];
    const targetValue = target[key];

    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      (result as Record<string, unknown>)[key as string] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      );
    } else if (sourceValue !== undefined) {
      (result as Record<string, unknown>)[key as string] = sourceValue;
    }
  }

  return result;
}

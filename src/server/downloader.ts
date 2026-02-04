/**
 * McServer - Server Jar Downloader
 * 
 * Downloads Minecraft server JARs for Vanilla, Forge, and Fabric.
 */

import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { ServerType } from '../types';
import { 
  MINECRAFT_VERSION_MANIFEST, 
  FORGE_MAVEN_URL, 
  FABRIC_META_URL,
  FABRIC_MAVEN_URL 
} from '../constants';
import { createLogger, retry } from '../utils';

const logger = createLogger('Downloader');

// ============================================================================
// Types
// ============================================================================

interface MinecraftVersionManifest {
  latest: {
    release: string;
    snapshot: string;
  };
  versions: Array<{
    id: string;
    type: 'release' | 'snapshot' | 'old_beta' | 'old_alpha';
    url: string;
    releaseTime: string;
  }>;
}

interface MinecraftVersionDetails {
  downloads: {
    server: {
      sha1: string;
      size: number;
      url: string;
    };
  };
}

interface ForgeVersion {
  version: string;
  build: number;
  mcversion: string;
  downloadUrl: string;
}

interface FabricVersion {
  loader: string;
  installer: string;
}

// ============================================================================
// Version Fetching
// ============================================================================

/**
 * Get available Minecraft versions
 */
export async function getMinecraftVersions(): Promise<string[]> {
  try {
    const response = await axios.get<MinecraftVersionManifest>(MINECRAFT_VERSION_MANIFEST);
    return response.data.versions
      .filter(v => v.type === 'release')
      .map(v => v.id);
  } catch (error) {
    logger.error('Failed to fetch Minecraft versions', { error });
    throw error;
  }
}

/**
 * Get latest Minecraft release version
 */
export async function getLatestMinecraftVersion(): Promise<string> {
  const response = await axios.get<MinecraftVersionManifest>(MINECRAFT_VERSION_MANIFEST);
  return response.data.latest.release;
}

/**
 * Get available Forge versions for a Minecraft version
 */
export async function getForgeVersions(mcVersion: string): Promise<string[]> {
  try {
    const url = `${FORGE_MAVEN_URL}/net/minecraftforge/forge/maven-metadata.xml`;
    const response = await axios.get(url);
    
    // Parse XML to find versions matching the MC version
    const versionRegex = new RegExp(`${mcVersion}-([\\d.]+)`, 'g');
    const matches = response.data.match(versionRegex) || [];
    
    return [...new Set(matches as string[])].sort().reverse();
  } catch (error) {
    logger.error('Failed to fetch Forge versions', { error });
    return [];
  }
}

/**
 * Get available Fabric loader versions
 */
export async function getFabricLoaderVersions(): Promise<string[]> {
  try {
    const response = await axios.get(`${FABRIC_META_URL}/versions/loader`);
    return response.data.map((v: { version: string }) => v.version);
  } catch (error) {
    logger.error('Failed to fetch Fabric loader versions', { error });
    return [];
  }
}

/**
 * Get available Fabric installer versions
 */
export async function getFabricInstallerVersions(): Promise<string[]> {
  try {
    const response = await axios.get(`${FABRIC_META_URL}/versions/installer`);
    return response.data.map((v: { version: string }) => v.version);
  } catch (error) {
    logger.error('Failed to fetch Fabric installer versions', { error });
    return [];
  }
}

// ============================================================================
// Download Functions
// ============================================================================

/**
 * Download vanilla Minecraft server
 */
export async function downloadVanillaServer(
  version: string, 
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  logger.info(`Downloading Vanilla server ${version}...`);

  // Get version manifest
  const manifestResponse = await axios.get<MinecraftVersionManifest>(MINECRAFT_VERSION_MANIFEST);
  const versionInfo = manifestResponse.data.versions.find(v => v.id === version);
  
  if (!versionInfo) {
    throw new Error(`Minecraft version ${version} not found`);
  }

  // Get version details
  const detailsResponse = await axios.get<MinecraftVersionDetails>(versionInfo.url);
  const serverDownload = detailsResponse.data.downloads.server;

  if (!serverDownload) {
    throw new Error(`No server download available for ${version}`);
  }

  // Download server JAR
  const jarPath = path.join(destPath, `minecraft_server.${version}.jar`);
  await downloadFile(serverDownload.url, jarPath, onProgress);

  logger.info(`Vanilla server ${version} downloaded to ${jarPath}`);
  return jarPath;
}

/**
 * Download Forge server installer
 */
export async function downloadForgeServer(
  mcVersion: string,
  forgeVersion: string,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  const fullVersion = forgeVersion.includes('-') ? forgeVersion : `${mcVersion}-${forgeVersion}`;
  logger.info(`Downloading Forge server ${fullVersion}...`);

  // Forge installer URL
  const installerUrl = `${FORGE_MAVEN_URL}/net/minecraftforge/forge/${fullVersion}/forge-${fullVersion}-installer.jar`;
  
  const installerPath = path.join(destPath, `forge-${fullVersion}-installer.jar`);
  await downloadFile(installerUrl, installerPath, onProgress);

  logger.info(`Forge installer downloaded to ${installerPath}`);
  return installerPath;
}

/**
 * Download Fabric server launcher
 */
export async function downloadFabricServer(
  mcVersion: string,
  loaderVersion: string,
  installerVersion: string,
  destPath: string,
  onProgress?: (progress: number) => void
): Promise<string> {
  logger.info(`Downloading Fabric server ${mcVersion} with loader ${loaderVersion}...`);

  // Fabric server launcher JAR URL
  const launcherUrl = `${FABRIC_META_URL}/versions/loader/${mcVersion}/${loaderVersion}/${installerVersion}/server/jar`;
  
  const jarPath = path.join(destPath, `fabric-server-mc.${mcVersion}-loader.${loaderVersion}-launcher.${installerVersion}.jar`);
  await downloadFile(launcherUrl, jarPath, onProgress);

  logger.info(`Fabric server downloaded to ${jarPath}`);
  return jarPath;
}

/**
 * Download a file with progress callback
 */
async function downloadFile(
  url: string, 
  destPath: string, 
  onProgress?: (progress: number) => void
): Promise<void> {
  await fs.ensureDir(path.dirname(destPath));

  await retry(async () => {
    const response = await axios({
      method: 'GET',
      url,
      responseType: 'stream'
    });

    const totalLength = parseInt(response.headers['content-length'] || '0', 10);
    let downloadedLength = 0;

    const writer = fs.createWriteStream(destPath);

    response.data.on('data', (chunk: Buffer) => {
      downloadedLength += chunk.length;
      if (onProgress && totalLength > 0) {
        onProgress((downloadedLength / totalLength) * 100);
      }
    });

    response.data.pipe(writer);

    return new Promise<void>((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
  }, { maxAttempts: 3 });
}

/**
 * Download server based on type
 */
export async function downloadServer(
  type: ServerType,
  mcVersion: string,
  destPath: string,
  options?: {
    loaderVersion?: string;
    installerVersion?: string;
    onProgress?: (progress: number) => void;
  }
): Promise<string> {
  switch (type) {
    case 'vanilla':
      return downloadVanillaServer(mcVersion, destPath, options?.onProgress);
    
    case 'forge':
      if (!options?.loaderVersion) {
        throw new Error('Forge version is required');
      }
      return downloadForgeServer(mcVersion, options.loaderVersion, destPath, options?.onProgress);
    
    case 'fabric':
      const loaderVersion = options?.loaderVersion || (await getFabricLoaderVersions())[0];
      const installerVersion = options?.installerVersion || (await getFabricInstallerVersions())[0];
      return downloadFabricServer(mcVersion, loaderVersion, installerVersion, destPath, options?.onProgress);
    
    default:
      throw new Error(`Unknown server type: ${type}`);
  }
}

export default {
  getMinecraftVersions,
  getLatestMinecraftVersion,
  getForgeVersions,
  getFabricLoaderVersions,
  getFabricInstallerVersions,
  downloadVanillaServer,
  downloadForgeServer,
  downloadFabricServer,
  downloadServer
};

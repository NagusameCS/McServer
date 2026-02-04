/**
 * McServer - Logger
 * 
 * Centralized logging with multiple transports and log rotation.
 */

import winston from 'winston';
import path from 'path';
import fs from 'fs-extra';
import { DEFAULT_LOGS_DIR, LOG_MAX_SIZE, LOG_MAX_FILES, LOG_DATE_FORMAT } from '../constants';
import { format } from 'date-fns';

// Ensure logs directory exists
fs.ensureDirSync(DEFAULT_LOGS_DIR);

const customFormat = winston.format.printf(({ level, message, timestamp, source, ...meta }) => {
  const src = source ? `[${source}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} ${level.toUpperCase().padEnd(5)} ${src} ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: LOG_DATE_FORMAT }),
    winston.format.errors({ stack: true }),
    customFormat
  ),
  defaultMeta: { service: 'mcserver' },
  transports: [
    // Console transport
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp({ format: LOG_DATE_FORMAT }),
        customFormat
      )
    }),
    // File transport - all logs
    new winston.transports.File({
      filename: path.join(DEFAULT_LOGS_DIR, 'mcserver.log'),
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      tailable: true
    }),
    // File transport - errors only
    new winston.transports.File({
      filename: path.join(DEFAULT_LOGS_DIR, 'error.log'),
      level: 'error',
      maxsize: LOG_MAX_SIZE,
      maxFiles: LOG_MAX_FILES,
      tailable: true
    })
  ]
});

// Server-specific log file
let serverLogStream: fs.WriteStream | null = null;

export function createServerLogger(profileId: string): void {
  const logFile = path.join(DEFAULT_LOGS_DIR, `server-${profileId}-${format(new Date(), 'yyyy-MM-dd-HHmmss')}.log`);
  serverLogStream = fs.createWriteStream(logFile, { flags: 'a' });
  logger.info(`Server log file created: ${logFile}`, { source: 'Logger' });
}

export function logServerOutput(data: string): void {
  if (serverLogStream) {
    serverLogStream.write(data);
  }
}

export function closeServerLogger(): void {
  if (serverLogStream) {
    serverLogStream.end();
    serverLogStream = null;
  }
}

/**
 * Create a child logger with a specific source
 */
export function createLogger(source: string): winston.Logger {
  return logger.child({ source });
}

/**
 * Get all log entries matching a filter
 */
export async function getLogs(options: {
  level?: string;
  source?: string;
  startTime?: Date;
  endTime?: Date;
  search?: string;
  limit?: number;
}): Promise<string[]> {
  const logFile = path.join(DEFAULT_LOGS_DIR, 'mcserver.log');
  
  if (!await fs.pathExists(logFile)) {
    return [];
  }

  const content = await fs.readFile(logFile, 'utf-8');
  let lines = content.split('\n').filter(line => line.trim());

  if (options.level) {
    lines = lines.filter(line => line.includes(options.level!.toUpperCase()));
  }

  if (options.source) {
    lines = lines.filter(line => line.includes(`[${options.source}]`));
  }

  if (options.search) {
    const searchLower = options.search.toLowerCase();
    lines = lines.filter(line => line.toLowerCase().includes(searchLower));
  }

  if (options.limit) {
    lines = lines.slice(-options.limit);
  }

  return lines;
}

/**
 * Export logs to a file
 */
export async function exportLogs(outputPath: string, options?: {
  startTime?: Date;
  endTime?: Date;
  includeServer?: boolean;
}): Promise<void> {
  const logs = await getLogs({});
  await fs.writeFile(outputPath, logs.join('\n'));
  logger.info(`Logs exported to ${outputPath}`, { source: 'Logger' });
}

/**
 * Clean old log files
 */
export async function cleanOldLogs(maxAgeDays: number = 30): Promise<number> {
  const files = await fs.readdir(DEFAULT_LOGS_DIR);
  const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
  const now = Date.now();
  let cleaned = 0;

  for (const file of files) {
    const filePath = path.join(DEFAULT_LOGS_DIR, file);
    const stat = await fs.stat(filePath);
    
    if (now - stat.mtime.getTime() > maxAge) {
      await fs.remove(filePath);
      cleaned++;
    }
  }

  if (cleaned > 0) {
    logger.info(`Cleaned ${cleaned} old log files`, { source: 'Logger' });
  }

  return cleaned;
}

export default logger;

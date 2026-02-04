/**
 * McServer - Web Server
 * 
 * Express-based web server for the dashboard and API.
 */

import express, { Application, Request, Response, NextFunction } from 'express';
import { createServer, Server as HttpServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs-extra';
import { Server as SocketServer } from 'socket.io';
import apiRoutes from './routes';
import { initializeAuth } from './auth';
import { setupWebSocket } from './websocket';
import configManager from '../config';
import { RATE_LIMIT, DEFAULT_DATA_DIR } from '../constants';
import { createLogger } from '../utils';

const logger = createLogger('WebServer');

export class WebServer {
  private app: Application;
  private httpServer: HttpServer;
  private io: SocketServer | null = null;
  private port: number;
  private running: boolean = false;

  constructor(port?: number) {
    this.app = express();
    this.httpServer = createServer(this.app);
    this.port = port || configManager.webPort;
  }

  /**
   * Initialize and configure the web server
   */
  async initialize(): Promise<void> {
    // Initialize authentication
    await initializeAuth();

    // Configure middleware
    this.setupMiddleware();

    // Setup routes
    this.setupRoutes();

    // Setup WebSocket
    this.io = setupWebSocket(this.httpServer);

    logger.info('Web server initialized');
  }

  /**
   * Configure Express middleware
   */
  private setupMiddleware(): void {
    // Security headers
    this.app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:']
        }
      }
    }));

    // CORS
    this.app.use(cors({
      origin: true,
      credentials: true
    }));

    // Compression
    this.app.use(compression());

    // Rate limiting
    this.app.use('/api', rateLimit({
      windowMs: RATE_LIMIT.windowMs,
      max: RATE_LIMIT.max,
      message: {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests' }
      }
    }));

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req: Request, res: Response, next: NextFunction) => {
      const start = Date.now();
      res.on('finish', () => {
        const duration = Date.now() - start;
        if (!req.path.includes('/health')) {
          logger.debug(`${req.method} ${req.path} ${res.statusCode} ${duration}ms`);
        }
      });
      next();
    });
  }

  /**
   * Setup routes
   */
  private setupRoutes(): void {
    // API routes
    this.app.use('/api', apiRoutes);

    // Serve static dashboard files
    const dashboardPath = path.join(__dirname, '../../dashboard/dist');
    if (fs.existsSync(dashboardPath)) {
      this.app.use(express.static(dashboardPath));

      // SPA fallback
      this.app.get('*', (req: Request, res: Response) => {
        res.sendFile(path.join(dashboardPath, 'index.html'));
      });
    } else {
      // Dashboard not built - serve simple status page
      this.app.get('/', (req: Request, res: Response) => {
        res.send(`
          <!DOCTYPE html>
          <html>
          <head>
            <title>McServer Dashboard</title>
            <style>
              body { font-family: system-ui, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
              h1 { color: #333; }
              .status { padding: 20px; background: #f0f0f0; border-radius: 8px; }
              code { background: #e0e0e0; padding: 2px 6px; border-radius: 4px; }
            </style>
          </head>
          <body>
            <h1>🎮 McServer</h1>
            <div class="status">
              <p>Dashboard is running. API available at <code>/api</code></p>
              <p>To build the full dashboard, run: <code>cd dashboard && npm install && npm run build</code></p>
            </div>
          </body>
          </html>
        `);
      });
    }

    // Error handling
    this.app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
      logger.error('Unhandled error', { error: err.message, stack: err.stack });
      res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred' }
      });
    });
  }

  /**
   * Start the web server
   */
  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.httpServer.listen(this.port, () => {
        this.running = true;
        logger.info(`Web server started on port ${this.port}`);
        logger.info(`Dashboard: http://localhost:${this.port}`);
        logger.info(`API: http://localhost:${this.port}/api`);
        resolve();
      });

      this.httpServer.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          logger.error(`Port ${this.port} is already in use`);
        }
        reject(error);
      });
    });
  }

  /**
   * Stop the web server
   */
  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.io) {
        this.io.close();
      }

      this.httpServer.close(() => {
        this.running = false;
        logger.info('Web server stopped');
        resolve();
      });
    });
  }

  /**
   * Get Express app instance
   */
  getApp(): Application {
    return this.app;
  }

  /**
   * Get Socket.IO instance
   */
  getIO(): SocketServer | null {
    return this.io;
  }

  /**
   * Check if running
   */
  isRunning(): boolean {
    return this.running;
  }

  /**
   * Get port
   */
  getPort(): number {
    return this.port;
  }
}

export default WebServer;

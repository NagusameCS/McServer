/**
 * McServer - WebSocket Handler
 * 
 * Real-time communication for the web dashboard.
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyToken, getUser } from './auth';
import { serverManager } from '../server';
import { createLogger } from '../utils';
import { User, ServerEvent } from '../types';

const logger = createLogger('WebSocket');

interface AuthenticatedSocket extends Socket {
  user?: User;
}

export function setupWebSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST']
    },
    pingTimeout: 60000
  });

  // Authentication middleware
  io.use((socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.query.token;

    if (!token) {
      return next(new Error('Authentication required'));
    }

    const decoded = verifyToken(token as string);
    if (!decoded) {
      return next(new Error('Invalid token'));
    }

    const user = getUser(decoded.userId);
    if (!user) {
      return next(new Error('User not found'));
    }

    socket.user = user;
    next();
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info(`Client connected: ${socket.user?.username}`);

    // Join user-specific room
    if (socket.user) {
      socket.join(`user:${socket.user.id}`);
    }

    // Join server events room
    socket.join('server-events');

    // Send initial state
    serverManager.getDashboardState().then(state => {
      socket.emit('dashboard:state', state);
    });

    // Handle commands
    socket.on('server:command', (command: string) => {
      if (socket.user?.role === 'owner' || socket.user?.role === 'admin') {
        try {
          serverManager.sendCommand(command);
          socket.emit('command:sent', { command });
        } catch (error) {
          socket.emit('command:error', { error: (error as Error).message });
        }
      } else {
        socket.emit('command:error', { error: 'Insufficient permissions' });
      }
    });

    // Handle server control
    socket.on('server:start', async (profileId: string) => {
      if (socket.user?.role !== 'owner' && socket.user?.role !== 'admin') {
        socket.emit('server:error', { error: 'Insufficient permissions' });
        return;
      }

      try {
        await serverManager.startServer(profileId);
      } catch (error) {
        socket.emit('server:error', { error: (error as Error).message });
      }
    });

    socket.on('server:stop', async () => {
      if (socket.user?.role !== 'owner' && socket.user?.role !== 'admin') {
        socket.emit('server:error', { error: 'Insufficient permissions' });
        return;
      }

      try {
        await serverManager.stopServer();
      } catch (error) {
        socket.emit('server:error', { error: (error as Error).message });
      }
    });

    socket.on('disconnect', () => {
      logger.info(`Client disconnected: ${socket.user?.username}`);
    });
  });

  // Forward server events to WebSocket clients
  setupServerEventForwarding(io);

  logger.info('WebSocket server initialized');

  return io;
}

/**
 * Setup forwarding of server events to WebSocket clients
 */
function setupServerEventForwarding(io: SocketServer): void {
  // Server lifecycle events
  serverManager.on('server:starting', () => {
    io.to('server-events').emit('server:starting');
    emitStateUpdate(io);
  });

  serverManager.on('server:started', () => {
    io.to('server-events').emit('server:started');
    emitStateUpdate(io);
  });

  serverManager.on('server:stopping', () => {
    io.to('server-events').emit('server:stopping');
    emitStateUpdate(io);
  });

  serverManager.on('server:stopped', (code: number | null) => {
    io.to('server-events').emit('server:stopped', { code });
    emitStateUpdate(io);
  });

  serverManager.on('server:crashed', (info: any) => {
    io.to('server-events').emit('server:crashed', info);
    emitStateUpdate(io);
  });

  // Player events
  serverManager.on('player:joined', (player: any) => {
    io.to('server-events').emit('player:joined', player);
    emitStateUpdate(io);
  });

  serverManager.on('player:left', (player: any) => {
    io.to('server-events').emit('player:left', player);
    emitStateUpdate(io);
  });

  // Log events
  serverManager.on('server:log', (line: string) => {
    io.to('server-events').emit('server:log', { line, timestamp: new Date() });
  });
}

/**
 * Emit full state update to all clients
 */
async function emitStateUpdate(io: SocketServer): Promise<void> {
  try {
    const state = await serverManager.getDashboardState();
    io.to('server-events').emit('dashboard:state', state);
  } catch (error) {
    logger.error('Failed to emit state update', { error });
  }
}

export default setupWebSocket;

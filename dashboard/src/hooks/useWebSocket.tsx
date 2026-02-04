import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface ServerState {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';
  profileId: string | null;
  startTime: string | null;
  players: { username: string; uuid: string; joinedAt: string }[];
  pid: number | null;
}

interface SyncState {
  lastSyncTime: string | null;
  lastCommitHash: string | null;
  pendingChanges: boolean;
  syncInProgress: boolean;
}

interface LockState {
  locked: boolean;
  lockedBy: string | null;
  lockedAt: string | null;
  machineId: string | null;
}

interface TunnelState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error';
  publicAddress: string | null;
  localPort: number;
}

interface DashboardState {
  server: ServerState;
  sync: SyncState;
  lock: LockState;
  tunnel: TunnelState;
  currentProfile: any | null;
}

export function useWebSocket() {
  const { token } = useAuth();
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<DashboardState | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;

    const socket = io({
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      setConnected(false);
      console.log('WebSocket disconnected');
    });

    socket.on('state', (newState: DashboardState) => {
      setState(newState);
    });

    socket.on('server:log', (line: string) => {
      setLogs(prev => [...prev.slice(-500), line]);
    });

    socket.on('server:started', () => {
      console.log('Server started');
    });

    socket.on('server:stopped', () => {
      console.log('Server stopped');
    });

    socket.on('player:joined', (player: { username: string }) => {
      console.log('Player joined:', player.username);
    });

    socket.on('player:left', (player: { username: string }) => {
      console.log('Player left:', player.username);
    });

    return () => {
      socket.disconnect();
    };
  }, [token]);

  const sendCommand = useCallback((command: string) => {
    socketRef.current?.emit('command', command);
  }, []);

  const startServer = useCallback((profileId: string) => {
    socketRef.current?.emit('server:start', profileId);
  }, []);

  const stopServer = useCallback(() => {
    socketRef.current?.emit('server:stop');
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  return {
    connected,
    state,
    logs,
    sendCommand,
    startServer,
    stopServer,
    clearLogs
  };
}

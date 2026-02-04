import { useState, useRef, useEffect } from 'react';
import { 
  Play, 
  Square, 
  RefreshCw, 
  Users, 
  Clock, 
  Globe, 
  HardDrive,
  Terminal,
  Send,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Dashboard() {
  const { state, logs, sendCommand, startServer, stopServer, clearLogs } = useWebSocket();
  const [command, setCommand] = useState('');
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleSendCommand = (e: React.FormEvent) => {
    e.preventDefault();
    if (command.trim()) {
      sendCommand(command);
      setCommand('');
    }
  };

  const isRunning = state?.server?.status === 'running';
  const isStarting = state?.server?.status === 'starting';
  const isStopping = state?.server?.status === 'stopping';
  const isCrashed = state?.server?.status === 'crashed';

  const formatUptime = (startTime: string | null) => {
    if (!startTime) return 'N/A';
    const start = new Date(startTime);
    const now = new Date();
    const diff = now.getTime() - start.getTime();
    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        {state?.currentProfile && (
          <span className="text-sm text-gray-400">
            Profile: {state.currentProfile.name}
          </span>
        )}
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Server Status */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <span className="text-gray-400">Server Status</span>
            <div className={`
              w-3 h-3 rounded-full
              ${isRunning ? 'bg-green-500 animate-pulse' : ''}
              ${isStarting || isStopping ? 'bg-yellow-500 animate-pulse' : ''}
              ${isCrashed ? 'bg-red-500' : ''}
              ${!isRunning && !isStarting && !isStopping && !isCrashed ? 'bg-gray-500' : ''}
            `} />
          </div>
          <div className="text-2xl font-bold capitalize">
            {state?.server?.status || 'Offline'}
          </div>
          {state?.lock?.locked && (
            <div className="mt-2 text-sm text-gray-400">
              Host: {state.lock.lockedBy}
            </div>
          )}
        </div>

        {/* Players */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Users size={18} />
            <span>Players Online</span>
          </div>
          <div className="text-2xl font-bold">
            {state?.server?.players?.length || 0}
          </div>
          {state?.server?.players && state.server.players.length > 0 && (
            <div className="mt-2 text-sm text-gray-400">
              {state.server.players.map(p => p.username).join(', ')}
            </div>
          )}
        </div>

        {/* Uptime */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Clock size={18} />
            <span>Uptime</span>
          </div>
          <div className="text-2xl font-bold">
            {formatUptime(state?.server?.startTime || null)}
          </div>
        </div>

        {/* Tunnel */}
        <div className="card">
          <div className="flex items-center gap-2 mb-4 text-gray-400">
            <Globe size={18} />
            <span>Public Address</span>
          </div>
          <div className="text-lg font-mono truncate">
            {state?.tunnel?.publicAddress || 'Not connected'}
          </div>
          <div className="mt-2 text-sm text-gray-400 capitalize">
            {state?.tunnel?.status || 'disconnected'}
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Server Controls</h2>
        <div className="flex flex-wrap gap-3">
          {!isRunning && !isStarting ? (
            <button
              onClick={() => state?.currentProfile && startServer(state.currentProfile.id)}
              disabled={!state?.currentProfile || isStarting}
              className="btn-minecraft flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play size={18} />
              Start Server
            </button>
          ) : (
            <button
              onClick={stopServer}
              disabled={isStopping}
              className="btn-minecraft-danger flex items-center gap-2 disabled:opacity-50"
            >
              <Square size={18} />
              Stop Server
            </button>
          )}

          <button
            onClick={() => {/* restart */}}
            disabled={!isRunning}
            className="btn-minecraft-secondary flex items-center gap-2 disabled:opacity-50"
          >
            <RefreshCw size={18} />
            Restart
          </button>
        </div>

        {isCrashed && (
          <div className="mt-4 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertTriangle className="text-red-500" size={20} />
            <div>
              <div className="font-semibold text-red-400">Server Crashed</div>
              <div className="text-sm text-gray-400">
                Check the logs below for more information
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Console */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Terminal size={18} />
            <h2 className="text-lg font-semibold">Console</h2>
          </div>
          <button
            onClick={clearLogs}
            className="p-2 text-gray-400 hover:text-white transition-colors"
            title="Clear logs"
          >
            <Trash2 size={18} />
          </button>
        </div>

        {/* Log output */}
        <div className="bg-black/50 rounded-lg p-4 h-80 overflow-y-auto font-mono text-sm">
          {logs.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            logs.map((line, i) => (
              <div key={i} className="text-gray-300 whitespace-pre-wrap break-all">
                {line}
              </div>
            ))
          )}
          <div ref={logsEndRef} />
        </div>

        {/* Command input */}
        <form onSubmit={handleSendCommand} className="mt-4 flex gap-2">
          <input
            type="text"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            placeholder="Enter command..."
            disabled={!isRunning}
            className="flex-1 bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-minecraft-grass disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!isRunning || !command.trim()}
            className="btn-minecraft flex items-center gap-2 disabled:opacity-50"
          >
            <Send size={18} />
            Send
          </button>
        </form>
      </div>

      {/* Sync Status */}
      <div className="card">
        <div className="flex items-center gap-2 mb-4">
          <HardDrive size={18} />
          <h2 className="text-lg font-semibold">Sync Status</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-gray-400">Last Sync</div>
            <div className="font-medium">
              {state?.sync?.lastSyncTime 
                ? new Date(state.sync.lastSyncTime).toLocaleString()
                : 'Never'
              }
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Last Commit</div>
            <div className="font-mono text-sm">
              {state?.sync?.lastCommitHash?.substring(0, 8) || 'N/A'}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400">Status</div>
            <div className="font-medium">
              {state?.sync?.syncInProgress 
                ? 'Syncing...' 
                : state?.sync?.pendingChanges 
                  ? 'Pending changes' 
                  : 'Up to date'
              }
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

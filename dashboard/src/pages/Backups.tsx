import { useState, useEffect } from 'react';
import { Archive, RotateCcw, Trash2, Clock, HardDrive } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface Backup {
  id: string;
  profileId: string;
  timestamp: string;
  size: number;
  description: string;
  type: 'auto' | 'manual' | 'pre-shutdown';
  commitHash: string;
}

interface WorldVersion {
  commitHash: string;
  message: string;
  timestamp: string;
  author: string;
}

export default function Backups() {
  const { token } = useAuth();
  const { state } = useWebSocket();
  const [backups, setBackups] = useState<Backup[]>([]);
  const [history, setHistory] = useState<WorldVersion[]>([]);
  const [activeTab, setActiveTab] = useState<'backups' | 'history'>('backups');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBackups();
    fetchHistory();
  }, [token]);

  const fetchBackups = async () => {
    try {
      const response = await fetch('/api/backups', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setBackups(data.backups || []);
      }
    } catch (error) {
      console.error('Failed to fetch backups', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch('/api/history', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHistory(data.versions || []);
      }
    } catch (error) {
      console.error('Failed to fetch history', error);
    }
  };

  const handleCreateBackup = async () => {
    try {
      await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBackups();
    } catch (error) {
      console.error('Failed to create backup', error);
    }
  };

  const handleRestoreBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to restore this backup? Current world data will be replaced.')) {
      return;
    }

    try {
      await fetch(`/api/backups/${backupId}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Backup restored successfully');
    } catch (error) {
      console.error('Failed to restore backup', error);
    }
  };

  const handleRestoreVersion = async (commitHash: string) => {
    if (!confirm('Are you sure you want to restore to this version? This cannot be undone.')) {
      return;
    }

    try {
      await fetch(`/api/history/${commitHash}/restore`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Version restored successfully');
    } catch (error) {
      console.error('Failed to restore version', error);
    }
  };

  const handleDeleteBackup = async (backupId: string) => {
    if (!confirm('Are you sure you want to delete this backup?')) {
      return;
    }

    try {
      await fetch(`/api/backups/${backupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchBackups();
    } catch (error) {
      console.error('Failed to delete backup', error);
    }
  };

  const formatSize = (bytes: number) => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let i = 0;
    while (bytes >= 1024 && i < units.length - 1) {
      bytes /= 1024;
      i++;
    }
    return `${bytes.toFixed(2)} ${units[i]}`;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'manual': return 'bg-blue-600';
      case 'auto': return 'bg-minecraft-grass';
      case 'pre-shutdown': return 'bg-yellow-600';
      default: return 'bg-gray-600';
    }
  };

  const isRunning = state?.server?.status === 'running';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-minecraft-grass"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Backups & History</h1>
        <button
          onClick={handleCreateBackup}
          disabled={!state?.currentProfile}
          className="btn-minecraft flex items-center gap-2 disabled:opacity-50"
        >
          <Archive size={18} />
          Create Backup
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveTab('backups')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'backups'
              ? 'text-minecraft-grass border-b-2 border-minecraft-grass'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Local Backups
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'history'
              ? 'text-minecraft-grass border-b-2 border-minecraft-grass'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Version History
        </button>
      </div>

      {/* Backups Tab */}
      {activeTab === 'backups' && (
        <div className="card">
          {backups.length === 0 ? (
            <div className="text-center py-12">
              <Archive size={48} className="mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No backups yet</h3>
              <p className="text-gray-400">Backups are created automatically when stopping the server</p>
            </div>
          ) : (
            <div className="space-y-3">
              {backups.map((backup) => (
                <div
                  key={backup.id}
                  className="flex items-center justify-between p-4 bg-black/30 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <Archive size={24} className="text-gray-400" />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{backup.description}</span>
                        <span className={`text-xs px-2 py-0.5 rounded ${getTypeColor(backup.type)}`}>
                          {backup.type}
                        </span>
                      </div>
                      <div className="text-sm text-gray-400 flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <Clock size={14} />
                          {new Date(backup.timestamp).toLocaleString()}
                        </span>
                        <span className="flex items-center gap-1">
                          <HardDrive size={14} />
                          {formatSize(backup.size)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleRestoreBackup(backup.id)}
                      disabled={isRunning}
                      className="btn-minecraft-secondary flex items-center gap-2 disabled:opacity-50"
                      title={isRunning ? 'Stop server to restore' : 'Restore backup'}
                    >
                      <RotateCcw size={16} />
                      Restore
                    </button>
                    <button
                      onClick={() => handleDeleteBackup(backup.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                      title="Delete backup"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && (
        <div className="card">
          {history.length === 0 ? (
            <div className="text-center py-12">
              <Clock size={48} className="mx-auto text-gray-500 mb-4" />
              <h3 className="text-lg font-semibold mb-2">No version history</h3>
              <p className="text-gray-400">Version history will appear after syncing with GitHub</p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((version, index) => (
                <div
                  key={version.commitHash}
                  className="flex items-center justify-between p-4 bg-black/30 rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-3 h-3 rounded-full bg-minecraft-grass" />
                      {index < history.length - 1 && (
                        <div className="absolute top-3 left-1.5 w-0.5 h-8 bg-gray-700 -translate-x-1/2" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{version.message}</div>
                      <div className="text-sm text-gray-400 flex items-center gap-4">
                        <span className="font-mono">{version.commitHash.substring(0, 8)}</span>
                        <span>{new Date(version.timestamp).toLocaleString()}</span>
                        <span>{version.author}</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRestoreVersion(version.commitHash)}
                    disabled={isRunning}
                    className="btn-minecraft-secondary flex items-center gap-2 disabled:opacity-50"
                    title={isRunning ? 'Stop server to restore' : 'Restore to this version'}
                  >
                    <RotateCcw size={16} />
                    Restore
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Package, Upload, Trash2, Check, X, AlertTriangle } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface Mod {
  id: string;
  name: string;
  version: string;
  loader: 'forge' | 'fabric';
  enabled: boolean;
  fileName: string;
}

interface CompatibilityResult {
  compatible: boolean;
  errors: { type: string; modId: string; message: string }[];
  warnings: { type: string; modId: string; message: string }[];
}

export default function Mods() {
  const { token } = useAuth();
  const { state } = useWebSocket();
  const [mods, setMods] = useState<Mod[]>([]);
  const [loading, setLoading] = useState(true);
  const [compatibility, setCompatibility] = useState<CompatibilityResult | null>(null);

  useEffect(() => {
    fetchMods();
  }, [token]);

  const fetchMods = async () => {
    try {
      const response = await fetch('/api/mods', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setMods(data.mods || []);
        setCompatibility(data.compatibility || null);
      }
    } catch (error) {
      console.error('Failed to fetch mods', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleMod = async (modId: string, enabled: boolean) => {
    try {
      await fetch(`/api/mods/${modId}/${enabled ? 'enable' : 'disable'}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMods();
    } catch (error) {
      console.error('Failed to toggle mod', error);
    }
  };

  const handleDeleteMod = async (modId: string) => {
    if (!confirm('Are you sure you want to remove this mod?')) return;

    try {
      await fetch(`/api/mods/${modId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchMods();
    } catch (error) {
      console.error('Failed to delete mod', error);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('mod', file);

    try {
      const response = await fetch('/api/mods/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });

      if (response.ok) {
        fetchMods();
      } else {
        const error = await response.json();
        alert(error.message || 'Failed to upload mod');
      }
    } catch (error) {
      console.error('Failed to upload mod', error);
    }
  };

  const currentProfile = state?.currentProfile;
  const isVanilla = currentProfile?.type === 'vanilla';

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
        <div>
          <h1 className="text-2xl font-bold">Mod Manager</h1>
          {currentProfile && (
            <p className="text-gray-400">
              Profile: {currentProfile.name} ({currentProfile.type})
            </p>
          )}
        </div>
        <label className="btn-minecraft flex items-center gap-2 cursor-pointer">
          <Upload size={18} />
          Upload Mod
          <input
            type="file"
            accept=".jar"
            onChange={handleUpload}
            className="hidden"
          />
        </label>
      </div>

      {/* Vanilla warning */}
      {isVanilla && (
        <div className="card bg-yellow-900/30 border-yellow-700">
          <div className="flex items-center gap-3">
            <AlertTriangle className="text-yellow-500" size={24} />
            <div>
              <div className="font-semibold text-yellow-400">Vanilla Server</div>
              <div className="text-sm text-gray-400">
                Mods are not supported on vanilla servers. Switch to Forge or Fabric to use mods.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Compatibility Status */}
      {compatibility && !isVanilla && (
        <div className={`card ${compatibility.compatible ? 'border-green-700' : 'border-red-700'}`}>
          <div className="flex items-center gap-3 mb-3">
            {compatibility.compatible ? (
              <Check className="text-green-500" size={24} />
            ) : (
              <AlertTriangle className="text-red-500" size={24} />
            )}
            <div className="font-semibold">
              {compatibility.compatible ? 'All mods compatible' : 'Compatibility issues found'}
            </div>
          </div>

          {compatibility.errors.length > 0 && (
            <div className="space-y-2 mb-3">
              {compatibility.errors.map((error, i) => (
                <div key={i} className="text-sm text-red-400 flex items-start gap-2">
                  <X size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{error.message}</span>
                </div>
              ))}
            </div>
          )}

          {compatibility.warnings.length > 0 && (
            <div className="space-y-2">
              {compatibility.warnings.map((warning, i) => (
                <div key={i} className="text-sm text-yellow-400 flex items-start gap-2">
                  <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mods List */}
      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Installed Mods ({mods.length})</h2>
        
        {mods.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No mods installed</h3>
            <p className="text-gray-400">Upload a mod JAR file to get started</p>
          </div>
        ) : (
          <div className="space-y-2">
            {mods.map((mod) => (
              <div
                key={mod.id}
                className={`flex items-center justify-between p-4 rounded-lg ${
                  mod.enabled ? 'bg-black/30' : 'bg-black/10 opacity-60'
                }`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded ${
                    mod.loader === 'forge' ? 'bg-orange-600' : 'bg-blue-600'
                  }`}>
                    <Package size={20} />
                  </div>
                  <div>
                    <div className="font-medium">{mod.name}</div>
                    <div className="text-sm text-gray-400">
                      v{mod.version} • {mod.loader} • {mod.fileName}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleMod(mod.id, !mod.enabled)}
                    className={`px-3 py-1 rounded text-sm ${
                      mod.enabled
                        ? 'bg-minecraft-grass hover:bg-green-700'
                        : 'bg-gray-600 hover:bg-gray-500'
                    }`}
                  >
                    {mod.enabled ? 'Enabled' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDeleteMod(mod.id)}
                    className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    title="Remove mod"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

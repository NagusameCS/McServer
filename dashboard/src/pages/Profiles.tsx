import { useState, useEffect } from 'react';
import { Plus, Server, Play, Trash2, Settings } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';
import { useAuth } from '../hooks/useAuth';

interface Profile {
  id: string;
  name: string;
  type: 'vanilla' | 'forge' | 'fabric';
  minecraftVersion: string;
  loaderVersion?: string;
  createdAt: string;
}

export default function Profiles() {
  const { token } = useAuth();
  const { state, startServer } = useWebSocket();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newProfile, setNewProfile] = useState({
    name: '',
    type: 'vanilla' as 'vanilla' | 'forge' | 'fabric',
    minecraftVersion: '1.20.4',
    loaderVersion: ''
  });

  useEffect(() => {
    fetchProfiles();
  }, [token]);

  const fetchProfiles = async () => {
    try {
      const response = await fetch('/api/profiles', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProfiles(data.profiles || []);
      }
    } catch (error) {
      console.error('Failed to fetch profiles', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/profiles', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newProfile)
      });

      if (response.ok) {
        setShowCreate(false);
        setNewProfile({ name: '', type: 'vanilla', minecraftVersion: '1.20.4', loaderVersion: '' });
        fetchProfiles();
      }
    } catch (error) {
      console.error('Failed to create profile', error);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    if (!confirm('Are you sure you want to delete this profile?')) return;

    try {
      await fetch(`/api/profiles/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      fetchProfiles();
    } catch (error) {
      console.error('Failed to delete profile', error);
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'forge': return 'bg-orange-600';
      case 'fabric': return 'bg-blue-600';
      default: return 'bg-minecraft-grass';
    }
  };

  const isRunning = state?.server?.status === 'running';
  const activeProfileId = state?.currentProfile?.id;

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
        <h1 className="text-2xl font-bold">Server Profiles</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-minecraft flex items-center gap-2"
        >
          <Plus size={18} />
          New Profile
        </button>
      </div>

      {/* Profiles Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className={`card relative ${activeProfileId === profile.id ? 'ring-2 ring-minecraft-grass' : ''}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${getTypeColor(profile.type)}`}>
                  <Server size={24} />
                </div>
                <div>
                  <h3 className="font-semibold">{profile.name}</h3>
                  <span className={`text-xs px-2 py-1 rounded ${getTypeColor(profile.type)}`}>
                    {profile.type}
                  </span>
                </div>
              </div>
              {activeProfileId === profile.id && isRunning && (
                <div className="status-online" />
              )}
            </div>

            <div className="text-sm text-gray-400 space-y-1 mb-4">
              <div>Minecraft: {profile.minecraftVersion}</div>
              {profile.loaderVersion && (
                <div>Loader: {profile.loaderVersion}</div>
              )}
              <div>Created: {new Date(profile.createdAt).toLocaleDateString()}</div>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => startServer(profile.id)}
                disabled={isRunning}
                className="btn-minecraft flex-1 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Play size={16} />
                Start
              </button>
              <button
                className="btn-minecraft-secondary p-2"
                title="Settings"
              >
                <Settings size={16} />
              </button>
              <button
                onClick={() => handleDeleteProfile(profile.id)}
                disabled={activeProfileId === profile.id && isRunning}
                className="btn-minecraft-danger p-2 disabled:opacity-50"
                title="Delete"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}

        {profiles.length === 0 && (
          <div className="col-span-full card text-center py-12">
            <Server size={48} className="mx-auto text-gray-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">No profiles yet</h3>
            <p className="text-gray-400 mb-4">Create your first server profile to get started</p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn-minecraft"
            >
              Create Profile
            </button>
          </div>
        )}
      </div>

      {/* Create Profile Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-minecraft-dark rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Create Profile</h2>
            
            <form onSubmit={handleCreateProfile} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Profile Name</label>
                <input
                  type="text"
                  value={newProfile.name}
                  onChange={(e) => setNewProfile({ ...newProfile, name: e.target.value })}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-minecraft-grass"
                  placeholder="My Server"
                  required
                />
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Server Type</label>
                <select
                  value={newProfile.type}
                  onChange={(e) => setNewProfile({ ...newProfile, type: e.target.value as any })}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-minecraft-grass"
                >
                  <option value="vanilla">Vanilla</option>
                  <option value="forge">Forge</option>
                  <option value="fabric">Fabric</option>
                </select>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-1">Minecraft Version</label>
                <input
                  type="text"
                  value={newProfile.minecraftVersion}
                  onChange={(e) => setNewProfile({ ...newProfile, minecraftVersion: e.target.value })}
                  className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-minecraft-grass"
                  placeholder="1.20.4"
                  required
                />
              </div>

              {newProfile.type !== 'vanilla' && (
                <div>
                  <label className="block text-sm text-gray-400 mb-1">
                    {newProfile.type === 'forge' ? 'Forge' : 'Fabric Loader'} Version
                  </label>
                  <input
                    type="text"
                    value={newProfile.loaderVersion}
                    onChange={(e) => setNewProfile({ ...newProfile, loaderVersion: e.target.value })}
                    className="w-full bg-black/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-minecraft-grass"
                    placeholder="Leave empty for latest"
                  />
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <button type="submit" className="btn-minecraft flex-1">
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => setShowCreate(false)}
                  className="btn-minecraft-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

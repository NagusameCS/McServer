import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, Wifi, Github, Shield, Server, Terminal, RefreshCw } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface Settings {
  github: {
    repoUrl: string;
    branch: string;
    username: string;
    hasToken: boolean;
  };
  server: {
    jvmArgs: string;
    maxRam: string;
    minRam: string;
    autoRestart: boolean;
    autoBackup: boolean;
    backupInterval: number;
  };
  tunnel: {
    provider: string;
    customDomain: string;
  };
  dashboard: {
    port: number;
    requireAuth: boolean;
    sessionTimeout: number;
  };
}

export default function Settings() {
  const { token, logout } = useAuth();
  useWebSocket(); // Keep WebSocket connection active
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [githubToken, setGithubToken] = useState('');
  const [activeSection, setActiveSection] = useState('github');
  const [changePassword, setChangePassword] = useState({
    current: '',
    new: '',
    confirm: ''
  });

  useEffect(() => {
    fetchSettings();
  }, [token]);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
      }
    } catch (error) {
      console.error('Failed to fetch settings', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const payload = {
        ...settings,
        github: {
          ...settings.github,
          token: githubToken || undefined
        }
      };

      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        alert('Settings saved successfully');
        setGithubToken('');
        fetchSettings();
      } else {
        alert('Failed to save settings');
      }
    } catch (error) {
      console.error('Failed to save settings', error);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (changePassword.new !== changePassword.confirm) {
      alert('New passwords do not match');
      return;
    }

    if (changePassword.new.length < 8) {
      alert('Password must be at least 8 characters');
      return;
    }

    try {
      const response = await fetch('/api/auth/password', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          currentPassword: changePassword.current,
          newPassword: changePassword.new
        })
      });

      if (response.ok) {
        alert('Password changed successfully');
        setChangePassword({ current: '', new: '', confirm: '' });
        logout();
      } else {
        alert('Failed to change password. Check current password.');
      }
    } catch (error) {
      console.error('Failed to change password', error);
      alert('Failed to change password');
    }
  };

  const updateSetting = <K extends keyof Settings>(
    section: K,
    key: keyof Settings[K],
    value: Settings[K][keyof Settings[K]]
  ) => {
    if (!settings) return;
    setSettings({
      ...settings,
      [section]: {
        ...settings[section],
        [key]: value
      }
    });
  };

  const sections = [
    { id: 'github', label: 'GitHub', icon: Github },
    { id: 'server', label: 'Server', icon: Server },
    { id: 'tunnel', label: 'Tunnel', icon: Wifi },
    { id: 'dashboard', label: 'Dashboard', icon: Terminal },
    { id: 'security', label: 'Security', icon: Shield }
  ];

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
        <h1 className="text-2xl font-bold">Settings</h1>
        <button
          onClick={saveSettings}
          disabled={saving}
          className="btn-minecraft flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <RefreshCw size={18} className="animate-spin" /> : <Save size={18} />}
          Save Settings
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-48 shrink-0">
          <div className="card p-2">
            {sections.map((section) => (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                  activeSection === section.id
                    ? 'bg-minecraft-grass text-white'
                    : 'text-gray-400 hover:text-white hover:bg-black/30'
                }`}
              >
                <section.icon size={18} />
                {section.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 card">
          {settings && (
            <>
              {/* GitHub Settings */}
              {activeSection === 'github' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Github size={20} />
                    GitHub Configuration
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Repository URL</label>
                      <input
                        type="text"
                        value={settings.github.repoUrl}
                        onChange={(e) => updateSetting('github', 'repoUrl', e.target.value)}
                        placeholder="https://github.com/username/minecraft-world"
                        className="input"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        The GitHub repository for syncing world data
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Branch</label>
                      <input
                        type="text"
                        value={settings.github.branch}
                        onChange={(e) => updateSetting('github', 'branch', e.target.value)}
                        placeholder="main"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Username</label>
                      <input
                        type="text"
                        value={settings.github.username}
                        onChange={(e) => updateSetting('github', 'username', e.target.value)}
                        placeholder="Your GitHub username"
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Personal Access Token
                        {settings.github.hasToken && (
                          <span className="text-xs text-minecraft-grass ml-2">(configured)</span>
                        )}
                      </label>
                      <div className="relative">
                        <input
                          type={showToken ? 'text' : 'password'}
                          value={githubToken}
                          onChange={(e) => setGithubToken(e.target.value)}
                          placeholder={settings.github.hasToken ? '••••••••••••••••' : 'ghp_...'}
                          className="input pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowToken(!showToken)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                        >
                          {showToken ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-xs text-gray-400 mt-1">
                        Token requires repo scope. Stored encrypted on this machine.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Server Settings */}
              {activeSection === 'server' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Server size={20} />
                    Server Configuration
                  </h2>

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium mb-2">Minimum RAM</label>
                        <input
                          type="text"
                          value={settings.server.minRam}
                          onChange={(e) => updateSetting('server', 'minRam', e.target.value)}
                          placeholder="1G"
                          className="input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium mb-2">Maximum RAM</label>
                        <input
                          type="text"
                          value={settings.server.maxRam}
                          onChange={(e) => updateSetting('server', 'maxRam', e.target.value)}
                          placeholder="4G"
                          className="input"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">JVM Arguments</label>
                      <input
                        type="text"
                        value={settings.server.jvmArgs}
                        onChange={(e) => updateSetting('server', 'jvmArgs', e.target.value)}
                        placeholder="-XX:+UseG1GC -XX:+ParallelRefProcEnabled"
                        className="input font-mono text-sm"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Additional JVM arguments (memory flags are added automatically)
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Auto Restart on Crash</div>
                        <p className="text-sm text-gray-400">Automatically restart if server crashes</p>
                      </div>
                      <button
                        onClick={() => updateSetting('server', 'autoRestart', !settings.server.autoRestart)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.server.autoRestart ? 'bg-minecraft-grass' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.server.autoRestart ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Auto Backup</div>
                        <p className="text-sm text-gray-400">Create periodic backups while running</p>
                      </div>
                      <button
                        onClick={() => updateSetting('server', 'autoBackup', !settings.server.autoBackup)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.server.autoBackup ? 'bg-minecraft-grass' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.server.autoBackup ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    {settings.server.autoBackup && (
                      <div>
                        <label className="block text-sm font-medium mb-2">
                          Backup Interval (minutes)
                        </label>
                        <input
                          type="number"
                          value={settings.server.backupInterval}
                          onChange={(e) => updateSetting('server', 'backupInterval', parseInt(e.target.value))}
                          min={5}
                          className="input w-32"
                        />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Tunnel Settings */}
              {activeSection === 'tunnel' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Wifi size={20} />
                    Tunnel Configuration
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Tunnel Provider</label>
                      <select
                        value={settings.tunnel.provider}
                        onChange={(e) => updateSetting('tunnel', 'provider', e.target.value)}
                        className="input"
                      >
                        <option value="playit">playit.gg (Recommended)</option>
                        <option value="ngrok">ngrok</option>
                        <option value="cloudflared">Cloudflare Tunnel</option>
                      </select>
                      <p className="text-xs text-gray-400 mt-1">
                        playit.gg is free and optimized for Minecraft
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Custom Domain (optional)</label>
                      <input
                        type="text"
                        value={settings.tunnel.customDomain}
                        onChange={(e) => updateSetting('tunnel', 'customDomain', e.target.value)}
                        placeholder="minecraft.example.com"
                        className="input"
                      />
                      <p className="text-xs text-gray-400 mt-1">
                        Requires playit.gg Pro or Cloudflare Tunnel
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Dashboard Settings */}
              {activeSection === 'dashboard' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Terminal size={20} />
                    Dashboard Configuration
                  </h2>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Dashboard Port</label>
                      <input
                        type="number"
                        value={settings.dashboard.port}
                        onChange={(e) => updateSetting('dashboard', 'port', parseInt(e.target.value))}
                        min={1024}
                        max={65535}
                        className="input w-32"
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">Require Authentication</div>
                        <p className="text-sm text-gray-400">Require login to access dashboard</p>
                      </div>
                      <button
                        onClick={() => updateSetting('dashboard', 'requireAuth', !settings.dashboard.requireAuth)}
                        className={`w-12 h-6 rounded-full transition-colors ${
                          settings.dashboard.requireAuth ? 'bg-minecraft-grass' : 'bg-gray-600'
                        }`}
                      >
                        <div
                          className={`w-5 h-5 rounded-full bg-white transition-transform ${
                            settings.dashboard.requireAuth ? 'translate-x-6' : 'translate-x-0.5'
                          }`}
                        />
                      </button>
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Session Timeout (hours)</label>
                      <input
                        type="number"
                        value={settings.dashboard.sessionTimeout}
                        onChange={(e) => updateSetting('dashboard', 'sessionTimeout', parseInt(e.target.value))}
                        min={1}
                        max={168}
                        className="input w-32"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Security Settings */}
              {activeSection === 'security' && (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Shield size={20} />
                    Security
                  </h2>

                  <div className="space-y-4">
                    <h3 className="font-medium">Change Password</h3>

                    <div>
                      <label className="block text-sm font-medium mb-2">Current Password</label>
                      <input
                        type="password"
                        value={changePassword.current}
                        onChange={(e) => setChangePassword({ ...changePassword, current: e.target.value })}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">New Password</label>
                      <input
                        type="password"
                        value={changePassword.new}
                        onChange={(e) => setChangePassword({ ...changePassword, new: e.target.value })}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">Confirm New Password</label>
                      <input
                        type="password"
                        value={changePassword.confirm}
                        onChange={(e) => setChangePassword({ ...changePassword, confirm: e.target.value })}
                        className="input"
                      />
                    </div>

                    <button
                      onClick={handleChangePassword}
                      disabled={!changePassword.current || !changePassword.new || !changePassword.confirm}
                      className="btn-minecraft disabled:opacity-50"
                    >
                      Change Password
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

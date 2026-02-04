import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Home, 
  Server, 
  Package, 
  Archive, 
  Settings, 
  LogOut,
  Menu,
  X,
  Globe
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useWebSocket } from '../hooks/useWebSocket';

interface LayoutProps {
  children: React.ReactNode;
}

export default function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { connected, state } = useWebSocket();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: Home },
    { name: 'Profiles', href: '/profiles', icon: Server },
    { name: 'Mods', href: '/mods', icon: Package },
    { name: 'Backups', href: '/backups', icon: Archive },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running': return 'status-online';
      case 'starting': 
      case 'stopping': return 'status-starting';
      case 'crashed': return 'status-error';
      default: return 'status-offline';
    }
  };

  return (
    <div className="min-h-screen bg-minecraft-darker">
      {/* Mobile sidebar toggle */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-minecraft-dark border-b border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-gray-400 hover:text-white"
            >
              {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
            <span className="text-xl font-bold text-minecraft-grass">McServer</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={getStatusColor(state?.server?.status || 'stopped')} />
            <span className="text-sm text-gray-400 capitalize">
              {state?.server?.status || 'Offline'}
            </span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 z-40 w-64 h-screen bg-minecraft-dark border-r border-gray-800
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-800">
            <h1 className="text-2xl font-bold text-minecraft-grass">McServer</h1>
            <p className="text-sm text-gray-500">Server Dashboard</p>
          </div>

          {/* Status */}
          <div className="p-4 border-b border-gray-800">
            <div className="flex items-center gap-3 mb-3">
              <div className={getStatusColor(state?.server?.status || 'stopped')} />
              <span className="text-sm capitalize">
                Server: {state?.server?.status || 'Offline'}
              </span>
            </div>
            
            {state?.tunnel?.publicAddress && (
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Globe size={14} />
                <span className="truncate">{state.tunnel.publicAddress}</span>
              </div>
            )}

            {state?.server?.players && state.server.players.length > 0 && (
              <div className="mt-2 text-sm text-gray-400">
                {state.server.players.length} player(s) online
              </div>
            )}

            <div className="mt-2 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${connected ? 'bg-green-500' : 'bg-red-500'}`} />
              <span className="text-xs text-gray-500">
                {connected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg transition-colors
                    ${isActive 
                      ? 'bg-minecraft-grass text-white' 
                      : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                    }
                  `}
                >
                  <item.icon size={20} />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-gray-800">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{user?.username}</div>
                <div className="text-xs text-gray-500 capitalize">{user?.role}</div>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOut size={20} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="lg:ml-64 min-h-screen pt-16 lg:pt-0">
        <div className="p-6">
          {children}
        </div>
      </main>

      {/* Overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/50"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}

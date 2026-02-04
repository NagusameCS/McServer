import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Profiles from './pages/Profiles';
import Mods from './pages/Mods';
import Backups from './pages/Backups';
import Settings from './pages/Settings';
import Login from './pages/Login';
import SetupWizard from './pages/SetupWizard';
import { AuthProvider, useAuth } from './hooks/useAuth';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();
  const [setupComplete, setSetupComplete] = useState<boolean | null>(null);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    // Check if setup has been completed
    const checkSetup = async () => {
      try {
        const response = await fetch('/api/config/setup-status');
        const data = await response.json();
        setSetupComplete(data.complete);
      } catch {
        // If API fails, assume setup is needed
        setSetupComplete(false);
      } finally {
        setCheckingSetup(false);
      }
    };
    checkSetup();
  }, []);

  if (loading || checkingSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <img src="/logo.svg" alt="McServer" className="w-16 h-16 mx-auto mb-4 animate-pulse" />
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-minecraft-grass mx-auto"></div>
        </div>
      </div>
    );
  }

  // Show setup wizard if not complete
  if (setupComplete === false) {
    return <SetupWizard onComplete={() => setSetupComplete(true)} />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <Layout>
                  <Routes>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/profiles" element={<Profiles />} />
                    <Route path="/mods" element={<Mods />} />
                    <Route path="/backups" element={<Backups />} />
                    <Route path="/settings" element={<Settings />} />
                  </Routes>
                </Layout>
              </ProtectedRoute>
            }
          />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

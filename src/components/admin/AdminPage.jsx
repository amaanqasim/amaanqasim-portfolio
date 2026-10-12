import { useState, useEffect } from 'react';
import { checkAdminSession } from '../../auth/adminAuth';
import AdminLogin from './AdminLogin';
import AdminDashboard from './AdminDashboard';
import { useTheme } from '../../hooks/usePortfolioData';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  useTheme();

  useEffect(() => {
    checkAdminSession().then(setAuthenticated).catch(() => setAuthenticated(false)).finally(() => setCheckingSession(false));
  }, []);

  if (checkingSession) return <div className="admin-login"><p>Checking admin session…</p></div>;
  if (!authenticated) return <AdminLogin onLogin={() => setAuthenticated(true)} />;
  return <AdminDashboard onLogout={() => setAuthenticated(false)} />;
}

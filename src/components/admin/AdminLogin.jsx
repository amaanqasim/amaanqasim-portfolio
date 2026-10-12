import { useState } from 'react';
import { motion } from 'framer-motion';
import { FiLock, FiEye, FiEyeOff } from 'react-icons/fi';
import { loginAdmin } from '../../auth/adminAuth';

export default function AdminLogin({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await loginAdmin(username, password);
      if (result.success) onLogin();
      else setError(result.error || 'Invalid username or password.');
    } catch {
      setError('The sign-in service is unavailable. Try again shortly.');
    } finally { setLoading(false); }
  };

  return (
    <div className="admin-login">
      <motion.div className="admin-login__card" initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ duration: 0.5 }} style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ width: 50, height: 50, borderRadius: 'var(--radius-md)', background: 'hsla(var(--primary-hsl), 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem', color: 'hsl(var(--primary-hsl))' }}><FiLock size={22} /></div>
        <h1 className="admin-login__title">Admin Access</h1>
        <p className="admin-login__subtitle">Sign in to manage your portfolio content.</p>
        <form className="admin-login__form" onSubmit={handleSubmit}>
          <input type="text" placeholder="Username" value={username} onChange={(event) => setUsername(event.target.value)} required autoComplete="username" maxLength={100} />
          <div style={{ position: 'relative' }}>
            <input type={showPassword ? 'text' : 'password'} placeholder="Password" value={password} onChange={(event) => setPassword(event.target.value)} required autoComplete="current-password" maxLength={1024} />
            <button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', padding: '0.25rem' }}>
              {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
            </button>
          </div>
          {error && <div className="admin-login__error" role="alert">{error}</div>}
          <button type="submit" className="btn btn--primary" disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}>{loading ? 'Authenticating…' : 'Login'}</button>
        </form>
      </motion.div>
    </div>
  );
}

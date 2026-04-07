import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lock, Mail, ShieldAlert } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export function AdminLogin() {
  const navigate  = useNavigate();
  const [loading, setLoading]   = useState(false);
  const [error,   setError]     = useState('');
  const [isLocked, setIsLocked] = useState(false);
  const [formData, setFormData] = useState({ email: '', password: '' });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setIsLocked(false);

    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email:    formData.email,
          password: formData.password,
        }),
      });

      let result: any;
      try {
        result = await response.json();
      } catch {
        throw new Error('Server returned an unexpected response. Please try again.');
      }

      if (!result.success) {
        // 429 means rate-limited / locked out
        if (response.status === 429) setIsLocked(true);
        throw new Error(result.error || 'Failed to sign in.');
      }

      if (result.session?.access_token) {
        localStorage.setItem('admin_token', result.session.access_token);
        navigate('/admin');
      } else {
        throw new Error('No session token received from server.');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-6">
      {/* subtle radial glow */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 30%, rgba(124,58,237,0.12) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-md">
        {/* Logo / heading */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
            <Lock className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">Admin Login</h1>
          <p className="text-white/40 text-sm">Fastoosh content management</p>
        </div>

        <GlassCard neonBorder className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  type="email"
                  placeholder="admin@fastoosh.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={isLocked || loading}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-violet-500/50"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-white/60 mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                <Input
                  type="password"
                  placeholder="••••••••"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  disabled={isLocked || loading}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-white/20 focus:border-violet-500/50"
                />
              </div>
            </div>

            {/* Error / lockout message */}
            {error && (
              <div className={`flex items-start gap-3 p-4 rounded-xl border text-sm ${
                isLocked
                  ? 'bg-red-500/10 border-red-500/30 text-red-400'
                  : 'bg-amber-500/10 border-amber-500/20 text-amber-300'
              }`}>
                <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button
              type="submit"
              disabled={loading || isLocked}
              className="w-full h-11 font-semibold text-white disabled:opacity-50"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Signing in…
                </span>
              ) : isLocked ? 'Account Locked' : 'Sign In'}
            </Button>
          </form>
        </GlassCard>

        <p className="text-center text-white/20 text-xs mt-6">
          Fastoosh Admin · Restricted access
        </p>
      </div>
    </div>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Lock, Mail } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { getSupabaseClient } from '../utils/supabase-client';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export function AdminLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    name: '',
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Attempting login via /login endpoint...');
      console.log('API_BASE:', API_BASE);
      console.log('Email:', formData.email);
      
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      console.log('Response status:', response.status);
      console.log('Response ok:', response.ok);
      
      // Try to get the response text first
      const responseText = await response.text();
      console.log('Raw response text:', responseText);
      
      // Try to parse as JSON
      let result;
      try {
        result = JSON.parse(responseText);
        console.log('Parsed response:', result);
      } catch (parseError) {
        console.error('Failed to parse response as JSON:', parseError);
        throw new Error(`Server returned invalid JSON: ${responseText}`);
      }

      if (!result.success) {
        throw new Error(result.error || 'Failed to login');
      }

      // Store the access token from the new backend response
      if (result.session?.access_token) {
        console.log('Access token received (first 20 chars):', result.session.access_token.substring(0, 20) + '...');
        localStorage.setItem('admin_token', result.session.access_token);
        console.log('Token saved to localStorage, navigating to /admin');
        navigate('/admin');
      } else {
        throw new Error('No access token received from server');
      }
    } catch (err: any) {
      console.error('Login error:', err);
      console.error('Error message:', err.message);
      setError(err.message || 'Failed to login');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // First create the account
      const response = await fetch(`${API_BASE}/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          name: formData.name,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to create account');
      }

      // After signup, log in via our /login endpoint to create a session
      console.log('Account created, now logging in...');
      
      const loginResponse = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
        }),
      });

      const loginResult = await loginResponse.json();

      if (!loginResult.success) {
        throw new Error(loginResult.error || 'Failed to login after signup');
      }

      // Store the access token from the new backend response
      if (loginResult.session?.access_token) {
        console.log('Access token received after signup');
        localStorage.setItem('admin_token', loginResult.session.access_token);
        navigate('/admin');
      } else {
        throw new Error('No access token received from server');
      }
    } catch (err: any) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black/90 backdrop-blur-3xl flex items-center justify-center p-6">
      <GlassCard className="w-full max-w-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            {mode === 'login' ? 'Admin Login' : 'Create Admin Account'}
          </h1>
          <p className="text-gray-400">
            {mode === 'login'
              ? 'Sign in to manage your Fastoosh content'
              : 'Create an account to access the admin panel'}
          </p>
        </div>

        <form onSubmit={mode === 'login' ? handleLogin : handleSignup} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
              <Input
                type="text"
                placeholder="Your name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                className="bg-black/30 backdrop-blur-xl border-white/20 text-white"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="email"
                placeholder="admin@fastoosh.com"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
                className="bg-black/30 backdrop-blur-xl border-white/20 text-white pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="password"
                placeholder="••••••••"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required
                minLength={6}
                className="bg-black/30 backdrop-blur-xl border-white/20 text-white pl-10"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError('');
            }}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {mode === 'login'
              ? "Don't have an account? Sign up"
              : 'Already have an account? Sign in'}
          </button>
        </div>
      </GlassCard>
    </div>
  );
}
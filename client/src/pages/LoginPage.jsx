import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Workflow, ArrowRight, Loader2, Shield, Code, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (demoEmail) => {
    setEmail(demoEmail);
    setPassword('password123');
    setLoading(true);
    setError('');
    try {
      await login(demoEmail, 'password123');
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex w-10 h-10 rounded-xl bg-devflow-600 items-center justify-center text-white mb-3">
            <Workflow className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Sign in to DevFlow
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Issue tracking and development workflow platform
          </p>
        </div>

        <div className="rounded-2xl bg-dark-surface border border-dark-border p-6 shadow-xl">
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@company.com"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 transition-colors"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  Password
                </label>
              </div>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3.5 py-2.5 rounded-xl bg-dark-card border border-dark-border text-sm text-white placeholder-slate-500 focus:outline-none focus:border-devflow-500 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-devflow-600 hover:bg-devflow-500 text-white font-semibold text-sm transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Login Presets */}
          <div className="mt-6 pt-5 border-t border-dark-border/70">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 text-center">
              Demo Accounts
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('astha@devflow.ai')}
                className="p-2 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-left transition-colors group"
              >
                <div className="flex items-center space-x-1.5 text-purple-400 font-semibold text-[11px] mb-0.5">
                  <Shield className="w-3 h-3" />
                  <span>Astha</span>
                </div>
                <div className="text-[10px] text-slate-400">Admin</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('rahul@devflow.ai')}
                className="p-2 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-left transition-colors group"
              >
                <div className="flex items-center space-x-1.5 text-devflow-400 font-semibold text-[11px] mb-0.5">
                  <Code className="w-3 h-3" />
                  <span>Rahul</span>
                </div>
                <div className="text-[10px] text-slate-400">Developer</div>
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('ananya@devflow.ai')}
                className="p-2 rounded-lg bg-dark-card hover:bg-dark-hover border border-dark-border text-left transition-colors group"
              >
                <div className="flex items-center space-x-1.5 text-emerald-400 font-semibold text-[11px] mb-0.5">
                  <UserCheck className="w-3 h-3" />
                  <span>Ananya</span>
                </div>
                <div className="text-[10px] text-slate-400">Developer</div>
              </button>
            </div>
          </div>
        </div>

        <div className="text-center text-xs text-slate-400 mt-6">
          Don't have an account?{' '}
          <Link to="/register" className="text-devflow-400 font-semibold hover:underline">
            Register now
          </Link>
        </div>
      </div>
    </div>
  );
}

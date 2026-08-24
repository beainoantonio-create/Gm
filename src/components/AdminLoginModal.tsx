import React, { useState } from 'react';
import { Shield, KeyRound, Lock, User, Eye, EyeOff, AlertCircle, X, ArrowRight } from 'lucide-react';
import { Logo } from './Logo';
import { api } from '../services/api';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoginSuccess: (adminData: { email: string; name: string }) => void;
  customLogo?: string;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onLoginSuccess,
  customLogo,
}) => {
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanIdentity = identity.trim();
    const cleanPassword = password.trim();

    if (!cleanIdentity) {
      setError('Please enter your admin email or username.');
      return;
    }
    if (!cleanPassword) {
      setError('Please enter your admin password.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.adminLogin({
        email: cleanIdentity,
        password: cleanPassword,
      });

      if (rememberMe) {
        localStorage.setItem('gm_admin_auth', 'true');
        localStorage.setItem('gm_admin_user', JSON.stringify(res.user));
      } else {
        sessionStorage.setItem('gm_admin_auth', 'true');
      }

      onLoginSuccess(res.user);
    } catch (err: any) {
      console.error('Admin login error:', err);
      setError(err.message || 'Invalid credentials. Please verify your credentials and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      id="admin-login-modal-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 text-slate-100 rounded-3xl shadow-2xl overflow-hidden p-6 sm:p-8 animate-in zoom-in-95 duration-200"
        id="admin-login-modal-container"
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          aria-label="Close login dialog"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Top Header & Branding */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="p-3 rounded-2xl bg-slate-800/60 border border-slate-700/50 mb-3 shadow-inner">
            <Logo size="md" customLogo={customLogo} />
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/20 text-[#FF385C] text-xs font-bold tracking-wide uppercase mb-1">
            <Shield className="w-3.5 h-3.5" />
            <span>Staff Portal Authentication</span>
          </div>
          <h2 className="text-xl font-extrabold text-white tracking-tight">Admin Sign In</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Enter your administrative credentials to manage properties, availability calendars, reservations, and system settings.
          </p>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-5 p-3.5 rounded-2xl bg-rose-950/60 border border-rose-800/50 text-rose-300 text-xs flex items-start gap-2.5 animate-in shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{error}</div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Email or Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <User className="w-4 h-4" />
              </div>
              <input
                type="text"
                required
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                placeholder="admin@gmmanagement.com"
                className="w-full pl-10 pr-4 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                autoComplete="username"
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Admin Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                <Lock className="w-4 h-4" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full pl-10 pr-11 py-3 bg-slate-950/80 border border-slate-800 rounded-2xl text-xs font-medium text-white placeholder-slate-500 focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200 transition cursor-pointer"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1 text-xs">
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded bg-slate-950 border-slate-700 text-rose-600 focus:ring-rose-500 focus:ring-offset-slate-900 cursor-pointer"
              />
              <span>Remember this session</span>
            </label>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-2xl bg-[#FF385C] hover:bg-[#E00B41] text-white text-xs font-bold transition shadow-lg shadow-rose-950/50 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            id="submit-admin-login-btn"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <KeyRound className="w-4 h-4" />
                <span>Sign In to Admin Portal</span>
                <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

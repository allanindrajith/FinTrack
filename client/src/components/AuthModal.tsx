import React, { useState } from 'react';
import { X, Lock, Mail, User as UserIcon, Sparkles, AlertCircle, ArrowRight, KeyRound, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api.js';
import { cryptoService } from '../services/crypto.js';
import { User } from '../types.js';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: User) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const [mode, setMode] = useState<'login' | 'register' | 'forgot'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    if (mode === 'forgot') {
      if (!resetSent) {
        if (!email.trim()) {
          setErrorMessage('Please enter your email address');
          return;
        }
        setLoading(true);
        try {
          const res = await api.forgotPassword(email.trim());
          setResetSent(true);
          setSuccessMessage(res.message);
          if (res.resetToken) {
            setResetToken(res.resetToken);
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Failed to request password reset.');
        } finally {
          setLoading(false);
        }
      } else {
        if (!resetToken.trim() || newPassword.length < 6) {
          setErrorMessage('Please enter valid reset token and a new password (min 6 chars)');
          return;
        }
        setLoading(true);
        try {
          const res = await api.resetPassword(resetToken.trim(), newPassword);
          setSuccessMessage(res.message + ' You can now log in.');
          setMode('login');
          setPassword(newPassword);
          setResetSent(false);
        } catch (err: any) {
          setErrorMessage(err.message || 'Password reset failed.');
        } finally {
          setLoading(false);
        }
      }
      return;
    }

    if (mode === 'register') {
      if (!name.trim()) {
        setErrorMessage('Please enter your full name');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long');
        return;
      }
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.login(email.trim(), password);
        // Initialize client-side zero-knowledge vault
        await cryptoService.deriveKeyFromPassphrase(password, email.trim());
        onAuthSuccess(res.user);
        onClose();
      } else {
        const res = await api.register(name.trim(), email.trim(), password);
        // Initialize client-side zero-knowledge vault
        await cryptoService.deriveKeyFromPassphrase(password, email.trim());
        onAuthSuccess(res.user);
        onClose();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const res = await api.loginDemo();
      // Derive demo vault key for zero-knowledge encryption demo
      await cryptoService.deriveKeyFromPassphrase('demo123456', 'demo@fintrack.app');
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Demo login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      // In production environment with Google Identity Services loaded, standard google.accounts.id.prompt() is invoked.
      // Here we simulate the credential flow or use Google OAuth endpoint.
      const simulatedGoogleToken = 'google_oauth_token_' + Math.random().toString(36).substring(2);
      const res = await api.loginGoogle(simulatedGoogleToken);
      await cryptoService.deriveKeyFromPassphrase('google_oauth_vault_pass', res.user.email);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setErrorMessage('');
    setLoading(true);
    try {
      const simulatedAppleToken = 'apple_oauth_token_' + Math.random().toString(36).substring(2);
      const res = await api.loginApple(simulatedAppleToken, { name: { firstName: 'Apple', lastName: 'User' } });
      await cryptoService.deriveKeyFromPassphrase('apple_oauth_vault_pass', res.user.email);
      onAuthSuccess(res.user);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Apple Sign-In failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0e0f0c]/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-white border border-[#e8ebe6] rounded-[24px] w-full max-w-md overflow-hidden shadow-modal animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#e8ebe6]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#9fe870] flex items-center justify-center text-[#0e0f0c]">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-[900] text-[#0e0f0c] tracking-tight">
                {mode === 'login' ? 'Sign in to FinTrack' : mode === 'register' ? 'Create FinTrack Account' : 'Reset FinTrack Password'}
              </h2>
              <p className="text-xs text-[#5f655b]">Zero-Knowledge End-to-End Encrypted</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 text-[#5f655b] hover:text-[#0e0f0c] rounded-full hover:bg-[#e8ebe6] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        {mode !== 'forgot' && (
          <div className="flex border-b border-[#e8ebe6] bg-[#e8ebe6]/40 p-1">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'login'
                  ? 'bg-white text-[#0e0f0c] shadow-sm'
                  : 'text-[#5f655b] hover:text-[#0e0f0c]'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMessage('');
                setSuccessMessage('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                mode === 'register'
                  ? 'bg-white text-[#0e0f0c] shadow-sm'
                  : 'text-[#5f655b] hover:text-[#0e0f0c]'
              }`}
            >
              Create Account
            </button>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMessage && (
            <div className="p-3.5 bg-[#fce8e8] border border-[#d03238]/30 rounded-xl text-xs text-[#a72027] font-semibold flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="p-3.5 bg-[#eaf8e2] border border-[#9fe870]/50 rounded-xl text-xs text-[#1e460d] font-semibold flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5 text-[#1e460d]" />
              <span>{successMessage}</span>
            </div>
          )}

          {mode === 'forgot' ? (
            <div className="space-y-4">
              {!resetSent ? (
                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Enter your registered email</label>
                  <div className="relative flex items-center">
                    <Mail className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                    <input
                      type="email"
                      required
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                    />
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Reset Security Token</label>
                    <div className="relative flex items-center">
                      <KeyRound className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                      <input
                        type="text"
                        required
                        placeholder="Paste reset token from email"
                        value={resetToken}
                        onChange={(e) => setResetToken(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#0e0f0c] mb-1">New Password</label>
                    <div className="relative flex items-center">
                      <Lock className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                      <input
                        type="password"
                        required
                        placeholder="••••••••"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                      />
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Sending...' : !resetSent ? 'Send Reset Instructions' : 'Update Password'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setResetSent(false);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                className="w-full text-center text-xs font-semibold text-[#5f655b] hover:text-[#0e0f0c] transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          ) : (
            <>
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Full Name</label>
                  <div className="relative flex items-center">
                    <UserIcon className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Alex Morgan"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-[#0e0f0c] mb-1">Email Address</label>
                <div className="relative flex items-center">
                  <Mail className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                  <input
                    type="email"
                    required
                    placeholder="name@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-[#0e0f0c]">Password</label>
                  {mode === 'login' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMode('forgot');
                        setErrorMessage('');
                        setSuccessMessage('');
                      }}
                      className="text-[11px] font-semibold text-[#5f655b] hover:text-[#0e0f0c] transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="relative flex items-center">
                  <Lock className="w-4 h-4 text-[#5f655b] absolute left-3.5 pointer-events-none" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3.5 py-2.5 bg-[#e8ebe6] rounded-xl text-xs font-semibold text-[#0e0f0c] placeholder-[#5f655b] focus:outline-none focus:border-[#0e0f0c] border border-transparent"
                  />
                </div>
                {mode === 'register' && (
                  <p className="text-[11px] text-[#5f655b] mt-1">
                    Your password derives your client-side AES-256-GCM encryption key. The server never stores your key.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#9fe870] hover:bg-[#cdffad] text-[#0e0f0c] font-bold text-xs rounded-full shadow-sm active:scale-[0.99] transition-all flex items-center justify-center gap-2"
              >
                <span>{loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Create Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#e8ebe6]" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-[#5f655b] font-medium">or continue with</span>
                </div>
              </div>

              {/* OAuth Buttons: Google & Apple */}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                  className="py-2.5 px-3 bg-white hover:bg-[#f3f5f1] border border-[#e8ebe6] text-[#0e0f0c] font-bold text-xs rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={handleAppleSignIn}
                  disabled={loading}
                  className="py-2.5 px-3 bg-[#0e0f0c] hover:bg-[#252822] text-white font-bold text-xs rounded-full transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 170 170">
                    <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12-14.42-6-9.12-10.74-19.53-14.22-31.25-3.48-11.72-5.22-22.95-5.22-33.69 0-14.73 3.75-26.68 11.24-35.85 7.5-9.18 16.74-13.88 27.73-14.12 4.47 0 9.53 1.2 15.18 3.6 5.66 2.4 9.48 3.66 11.46 3.78 1.63-.12 5.56-1.42 11.79-3.9 6.23-2.48 11.38-3.66 15.45-3.54 11.48.59 20.89 4.8 28.23 12.63-10.02 6.09-14.92 14.54-14.7 25.35.22 8.35 3.44 15.34 9.66 20.97 6.22 5.63 13.67 9.07 22.35 10.32-2.39 7.4-5.32 14.7-8.8 21.9zM119.22 33.64c0-7.25 2.65-13.9 7.95-19.95 5.3-6.05 11.83-9.87 19.59-11.46.22 1.41.33 2.7.33 3.88 0 7.28-2.67 14.07-8.01 20.37-5.34 6.3-11.97 10.07-19.86 11.31-.07-1.4-.1-2.79-.1-4.15z" />
                  </svg>
                  <span>Apple</span>
                </button>
              </div>

              {/* Instant One-Click Demo Button */}
              <button
                type="button"
                onClick={handleDemoLogin}
                disabled={loading}
                className="w-full py-2.5 bg-[#e8ebe6] hover:bg-[#dbe0d8] text-[#0e0f0c] font-bold text-xs rounded-full transition-all flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#0e0f0c]" />
                <span>Instant Demo Session</span>
              </button>
            </>
          )}
        </form>
      </div>
    </div>
  );
};

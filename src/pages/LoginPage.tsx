import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../utils/api';
import ThemeToggle from '../components/ThemeToggle';
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowLeft,
  KeyRound,
  Mail,
  CheckCircle2,
  RotateCw,
  ShieldCheck,
} from 'lucide-react';

interface LoginPageProps {
  initialMode?: 'login' | 'forgot';
}

export default function LoginPage({ initialMode = 'login' }: LoginPageProps) {
  const { login } = useAuth();
  const navigate = useNavigate();

  // Mode: 'login' | 'forgot' | 'verify' | 'success'
  const [mode, setMode] = useState<'login' | 'forgot' | 'verify' | 'success'>(initialMode);

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Forgot password flow state
  const [identifier, setIdentifier] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Metadata returned by server
  const [maskedEmail, setMaskedEmail] = useState('');
  const [targetUsername, setTargetUsername] = useState('');

  // UI state
  const [error, setError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  // Standard Login handler
  const handleLoginSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');
    setLoading(true);
    try {
      await login(username.trim(), password);
      navigate('/');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  // Step 1: Send OTP to user's registered email
  const handleRequestOtp = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    if (!identifier.trim()) {
      setError('Please enter your username or registered email');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/api/auth/forgot-password', {
        identifier: identifier.trim(),
      });

      setMaskedEmail(res.maskedEmail || '');
      setTargetUsername(res.username || identifier.trim());
      setInfoMessage(res.message || 'Verification code sent to your email.');
      setMode('verify');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to send verification code');
    } finally {
      setLoading(false);
    }
  };

  // Step 1b: Resend OTP
  const handleResendOtp = async () => {
    setError('');
    setInfoMessage('');
    setResending(true);
    try {
      const res = await api.post('/api/auth/forgot-password', {
        identifier: targetUsername || identifier.trim(),
      });
      setInfoMessage(res.message || 'A fresh verification code has been sent to your email.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  // Step 2: Verify OTP and submit New Password
  const handleResetSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfoMessage('');

    const cleanCode = resetCode.trim();
    if (!cleanCode || cleanCode.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    if (!newPassword || newPassword.length < 4) {
      setError('New password must be at least 4 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/api/auth/reset-password', {
        username: targetUsername || identifier.trim(),
        code: cleanCode,
        newPassword,
      });

      setMode('success');
      // Pre-fill username for quick login
      if (targetUsername) {
        setUsername(targetUsername);
      }
      setPassword('');
      setResetCode('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reset password');
    } finally {
      setLoading(false);
    }
  };

  const switchToLogin = () => {
    setMode('login');
    setError('');
    setInfoMessage('');
  };

  const switchToForgot = () => {
    setMode('forgot');
    setError('');
    setInfoMessage('');
    if (username.trim()) {
      setIdentifier(username.trim());
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4 relative transition-colors duration-200">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle showLabel />
      </div>

      <div className="w-full max-w-md">
        {/* Logo & Brand Header */}
        <div className="text-center mb-8">
          <div className="bg-white/95 p-3 rounded-2xl inline-block mx-auto mb-4 shadow-xl shadow-teal-500/10 border border-slate-700">
            <img src="/logo.png" alt="RSB Logo" className="h-10 sm:h-12 w-auto object-contain" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">RSB Dispatch</h1>
          <p className="text-sm text-slate-400 mt-1">
            {mode === 'login' && 'Sign in to your account'}
            {mode === 'forgot' && 'Reset your account password'}
            {mode === 'verify' && 'Verify code & set new password'}
            {mode === 'success' && 'Password updated successfully'}
          </p>
        </div>

        {/* Form Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl transition-all duration-200">
          {/* Notification Messages */}
          {error && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5 font-bold">⚠️</span>
              <span className="flex-1">{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-5 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 text-sm flex items-start gap-2.5">
              <span className="text-base leading-none mt-0.5">ℹ️</span>
              <span className="flex-1">{infoMessage}</span>
            </div>
          )}

          {/* ============================================================== */}
          {/* MODE: LOGIN                                                   */}
          {/* ============================================================== */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">Username</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="Enter username"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-400">Password</label>
                  <button
                    type="button"
                    onClick={switchToForgot}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 hover:underline transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all pr-12"
                    placeholder="Enter password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>
          )}

          {/* ============================================================== */}
          {/* MODE: FORGOT (Request OTP)                                    */}
          {/* ============================================================== */}
          {mode === 'forgot' && (
            <form onSubmit={handleRequestOtp} className="space-y-5">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-teal-500/10 border border-teal-500/20 text-teal-300 mb-2">
                <Mail className="w-5 h-5 shrink-0 text-teal-400" />
                <p className="text-xs leading-relaxed text-slate-300">
                  Enter your RSB username or registered email. We will send a 6-digit OTP code to verify your identity.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Username or Registered Email
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  autoFocus
                  className="w-full px-4 py-3 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                  placeholder="e.g. 10004327 or user@rsbglobal.com"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-[0.99] cursor-pointer"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Sending Code...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Send Verification Code
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* MODE: VERIFY & RESET PASSWORD                                 */}
          {/* ============================================================== */}
          {mode === 'verify' && (
            <form onSubmit={handleResetSubmit} className="space-y-4">
              {maskedEmail && (
                <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-300 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 overflow-hidden">
                    <ShieldCheck className="w-4 h-4 text-teal-400 shrink-0" />
                    <span className="truncate">
                      Code sent to: <strong className="text-teal-400 font-mono">{maskedEmail}</strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={resending}
                    className="text-xs font-semibold text-teal-400 hover:text-teal-300 disabled:opacity-50 inline-flex items-center gap-1 shrink-0 cursor-pointer"
                    title="Resend verification code"
                  >
                    <RotateCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
                    Resend
                  </button>
                </div>
              )}

              {/* 6-Digit OTP */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={resetCode}
                  onChange={(e) => setResetCode(e.target.value.replace(/[^0-9]/g, ''))}
                  required
                  autoFocus
                  placeholder="000000"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-teal-400 placeholder-slate-600 font-mono text-center text-2xl tracking-[0.4em] focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all"
                />
                <p className="text-[11px] text-slate-500 text-center mt-1">
                  Valid for 15 minutes. Check your spam folder if not received.
                </p>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={4}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all pr-12 text-sm"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-medium text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={4}
                    className="w-full px-4 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all pr-12 text-sm"
                    placeholder="Re-enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors p-1"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold hover:from-teal-500 hover:to-emerald-500 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-[0.99] cursor-pointer mt-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" />
                    Reset Password
                  </>
                )}
              </button>

              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={switchToLogin}
                  className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-medium text-slate-400 hover:text-white transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Cancel & Back to Sign In
                </button>
              </div>
            </form>
          )}

          {/* ============================================================== */}
          {/* MODE: SUCCESS                                                 */}
          {/* ============================================================== */}
          {mode === 'success' && (
            <div className="text-center py-4 space-y-5">
              <div className="w-16 h-16 rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 flex items-center justify-center mx-auto shadow-lg shadow-teal-500/10">
                <CheckCircle2 className="w-9 h-9" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">Password Reset Complete!</h3>
                <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                  Your password has been successfully updated. You can now sign in with your new password.
                </p>
              </div>

              <button
                type="button"
                onClick={switchToLogin}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 text-white font-semibold hover:from-teal-500 hover:to-emerald-500 transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/20 active:scale-[0.99] cursor-pointer"
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>

        <p className="text-center text-xs text-slate-600 mt-6">
          RSB Group — Dispatch Management System
        </p>
      </div>
    </div>
  );
}
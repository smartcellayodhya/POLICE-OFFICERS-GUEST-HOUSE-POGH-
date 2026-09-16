'use client';

import React, { useState, useEffect } from 'react';
import { AuthUser, authenticate } from '@/lib/auth';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight, Loader2, ShieldAlert, Clock } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
  logoutReason?: 'manual' | 'inactivity' | null;
}

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 60 * 1000; // 60 Seconds cooldown

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess, logoutReason }) => {
  const { language, setLanguage } = useLanguage();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [lockoutSecondsLeft, setLockoutSecondsLeft] = useState<number>(0);

  // Check existing lockout on mount and tick countdown
  useEffect(() => {
    const checkLockout = () => {
      try {
        const lockoutUntil = parseInt(localStorage.getItem('pogh_login_lockout_until') || '0', 10);
        const now = Date.now();
        if (lockoutUntil > now) {
          setLockoutSecondsLeft(Math.ceil((lockoutUntil - now) / 1000));
        } else {
          setLockoutSecondsLeft(0);
          localStorage.removeItem('pogh_login_lockout_until');
        }
      } catch {
        setLockoutSecondsLeft(0);
      }
    };

    checkLockout();
    const timer = setInterval(checkLockout, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (lockoutSecondsLeft > 0) return;

    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = authenticate(username, password);
      if (user) {
        // Reset brute-force counter on successful login
        try {
          localStorage.removeItem('pogh_login_failed_attempts');
          localStorage.removeItem('pogh_login_lockout_until');
        } catch {}
        onLoginSuccess(user);
      } else {
        try {
          const prev = parseInt(localStorage.getItem('pogh_login_failed_attempts') || '0', 10);
          const currentAttempts = prev + 1;
          localStorage.setItem('pogh_login_failed_attempts', currentAttempts.toString());

          if (currentAttempts >= MAX_FAILED_ATTEMPTS) {
            const lockoutUntil = Date.now() + LOCKOUT_DURATION_MS;
            localStorage.setItem('pogh_login_lockout_until', lockoutUntil.toString());
            localStorage.removeItem('pogh_login_failed_attempts');
            setLockoutSecondsLeft(60);
            setError(
              language === 'hi'
                ? `अत्यधिक असफल प्रयासों (${MAX_FAILED_ATTEMPTS} बार) के कारण लॉगिन 60 सेकंड के लिए ब्लॉक कर दिया गया है।`
                : `Login temporarily locked for 60 seconds due to ${MAX_FAILED_ATTEMPTS} consecutive failed attempts.`
            );
          } else {
            const remaining = MAX_FAILED_ATTEMPTS - currentAttempts;
            setError(
              language === 'hi'
                ? `अमान्य उपयोगकर्ता नाम या पासवर्ड दर्ज किया गया है। (${remaining} प्रयास शेष)`
                : `Invalid username or password entered. (${remaining} attempts remaining)`
            );
          }
        } catch {
          setError(
            language === 'hi'
              ? 'अमान्य उपयोगकर्ता नाम या पासवर्ड दर्ज किया गया है।'
              : 'Invalid username or password entered.'
          );
        }
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden font-sans">
      
      {/* Top Right Language Switcher */}
      <div className="absolute top-4 right-4 z-20">
        <div className="flex items-center gap-1 bg-slate-900/80 backdrop-blur-md p-1 rounded-xl border border-slate-700">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
              language === 'en'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('hi')}
            className={`px-2.5 py-1 text-xs font-bold rounded-lg transition ${
              language === 'hi'
                ? 'bg-amber-400 text-slate-950 shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            हिन्दी
          </button>
        </div>
      </div>

      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header with Crest */}
        <div className="p-5 sm:p-8 pb-4 sm:pb-5 text-center border-b border-slate-800 relative bg-gradient-to-b from-slate-800/60 to-transparent">
          <div className="w-20 h-20 sm:w-24 sm:h-24 mx-auto mb-3 rounded-full bg-white p-2 sm:p-2.5 shadow-xl flex items-center justify-center border-2 border-amber-400/50">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/up_police_logo.png"
              alt="Ayodhya Police Official Crest"
              className="w-full h-full object-contain"
            />
          </div>
          
          <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">
            {language === 'hi' ? 'पुलिस ऑफिसर्स गेस्ट हाउस' : 'POLICE OFFICERS GUEST HOUSE'}
          </h1>
          <p className="text-amber-400 font-bold text-xs tracking-widest mt-0.5">
            {language === 'hi' ? 'अयोध्या पुलिस' : 'Ayodhya Police'}
          </p>
          <p className="text-slate-400 text-xs font-hindi mt-1">
            {language === 'hi' ? 'कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या' : 'Office of SSP, Ayodhya District'}
          </p>
        </div>

        {/* Inactivity Auto-Logout Alert Banner */}
        {logoutReason === 'inactivity' && (
          <div className="mx-5 sm:mx-8 mt-5 p-3.5 rounded-2xl bg-amber-500/15 border border-amber-400/30 text-amber-200 text-xs flex items-start gap-2.5 animate-in fade-in slide-in-from-top-2 duration-200">
            <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">
                {language === 'hi' ? 'सुरक्षा सूचना: सत्र स्वतः समाप्त (Auto Logged Out)' : 'Security Notice: Session Timed Out'}
              </p>
              <p className="text-[11px] text-amber-200/80 mt-0.5 leading-relaxed">
                {language === 'hi'
                  ? 'अक्रियता (15 मिनट निष्क्रिय रहने) के कारण आपका सत्र सुरक्षा कारणों से स्वतः समाप्त कर दिया गया है। कृपया पुनः लॉगिन करें।'
                  : 'Your session was automatically logged out after 15 minutes of inactivity for security. Please sign in again.'}
              </p>
            </div>
          </div>
        )}

        {/* Lockout Banner */}
        {lockoutSecondsLeft > 0 && (
          <div className="mx-5 sm:mx-8 mt-5 p-3.5 rounded-2xl bg-rose-950/80 border border-rose-700/80 text-rose-200 text-xs flex items-center gap-2.5 animate-in fade-in duration-200">
            <Clock className="w-5 h-5 text-rose-400 shrink-0 animate-pulse" />
            <div>
              <p className="font-bold text-rose-300">
                {language === 'hi' ? 'लॉगिन अस्थायी रूप से अवरुद्ध है' : 'Login Temporarily Locked'}
              </p>
              <p className="text-[11px] text-rose-200/80 mt-0.5">
                {language === 'hi'
                  ? `अत्यधिक गलत प्रयासों के कारण प्रतीक्षा करें: ${lockoutSecondsLeft} सेकंड शेष`
                  : `Too many failed attempts. Cooldown: ${lockoutSecondsLeft}s remaining`}
              </p>
            </div>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-8 space-y-3.5 sm:space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              {language === 'hi' ? 'उपयोगकर्ता नाम' : 'Username'}
            </label>
            <input
              type="text"
              required
              autoFocus
              disabled={lockoutSecondsLeft > 0}
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={language === 'hi' ? 'उपयोगकर्ता नाम दर्ज करें' : 'Enter username'}
              className="w-full px-4 py-2.5 text-sm bg-slate-950/90 text-white placeholder-slate-500 rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition disabled:opacity-40 disabled:cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              {language === 'hi' ? 'पासवर्ड' : 'Password'}
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                disabled={lockoutSecondsLeft > 0}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={language === 'hi' ? 'पासवर्ड दर्ज करें' : 'Enter password'}
                className="w-full pl-4 pr-11 py-2.5 text-sm bg-slate-950/90 text-white placeholder-slate-500 rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition disabled:opacity-40 disabled:cursor-not-allowed"
              />
              <button
                type="button"
                disabled={lockoutSecondsLeft > 0}
                onClick={() => setShowPassword(!showPassword)}
                title={showPassword ? (language === 'hi' ? 'पासवर्ड छुपाएं' : 'Hide password') : (language === 'hi' ? 'पासवर्ड देखें' : 'Show password')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition disabled:opacity-40"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && lockoutSecondsLeft === 0 && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading || lockoutSecondsLeft > 0}
            className="w-full py-3 mt-3 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
                <span>{language === 'hi' ? 'सत्यापित किया जा रहा है...' : 'Authenticating...'}</span>
              </>
            ) : lockoutSecondsLeft > 0 ? (
              <>
                <Clock className="w-4 h-4" />
                <span>{language === 'hi' ? `प्रतीक्षा करें (${lockoutSecondsLeft}s)` : `Please wait (${lockoutSecondsLeft}s)`}</span>
              </>
            ) : (
              <>
                <span>{language === 'hi' ? 'लॉगिन करें' : 'Sign In'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

      </div>

      {/* Footer info below login card */}
      <footer className="mt-6 text-center z-10 select-none space-y-1">
        <p className="text-xs text-slate-500 font-medium tracking-wide">
          &copy; {new Date().getFullYear()} {language === 'hi' ? 'अयोध्या पुलिस • सर्वाधिकार सुरक्षित' : 'Ayodhya Police • All Rights Reserved'}
        </p>
        <p className="text-xs text-amber-400 font-semibold tracking-wide">
          Designed & Developed by Rahul Yadav
        </p>
      </footer>
    </div>
  );
};

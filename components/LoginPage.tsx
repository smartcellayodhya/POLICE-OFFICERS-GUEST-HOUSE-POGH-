'use client';

import React, { useState } from 'react';
import { AuthUser, authenticate } from '@/lib/auth';
import { Lock, User, Eye, EyeOff, AlertCircle, ArrowRight } from 'lucide-react';

interface LoginPageProps {
  onLoginSuccess: (user: AuthUser) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLoginSuccess }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin@pogh2026');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = authenticate(username, password);
      if (user) {
        onLoginSuccess(user);
      } else {
        setError('अमान्य उपयोगकर्ता नाम या पासवर्ड (Invalid Username or Password).');
        setLoading(false);
      }
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden font-sans">
      
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/95 backdrop-blur-xl border border-slate-800 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header with Crest */}
        <div className="p-8 pb-6 text-center border-b border-slate-800 relative bg-gradient-to-b from-slate-800/60 to-transparent">
          <div className="w-24 h-24 mx-auto mb-3 bg-white rounded-full border-2 border-amber-400 shadow-xl overflow-hidden flex items-center justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/up_police_logo.png"
              alt="Ayodhya Police Official Crest"
              className="w-full h-full object-contain p-1"
            />
          </div>
          
          <h1 className="text-xl font-black text-white tracking-wide">
            POLICE OFFICERS GUEST HOUSE
          </h1>
          <p className="text-amber-400 font-bold text-xs tracking-widest mt-0.5">
            AYODHYA POLICE • अयोध्या पुलिस
          </p>
          <p className="text-slate-400 text-xs font-hindi mt-1">
            कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 space-y-4">
          
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              उपयोगकर्ता नाम (Username)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-4 py-2.5 text-sm bg-slate-950/90 text-white rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              पासवर्ड (Password)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-4 pr-11 py-2.5 text-sm bg-slate-950/90 text-white rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>सत्यापित किया जा रहा है...</span>
            ) : (
              <>
                <span>सुरक्षित प्रवेश करें (Sign In)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="px-8 py-3 bg-slate-950/80 border-t border-slate-800/80 text-center">
          <p className="text-[11px] text-slate-400">
            अयोध्या पुलिस आधिकारिक आंतरिक पोर्टल • अनधिकृत प्रवेश वर्जित है
          </p>
        </div>

      </div>

      {/* Footer info below login card */}
      <footer className="mt-6 text-center z-10 select-none space-y-1">
        <p className="text-xs sm:text-sm text-slate-400 font-medium tracking-wide">
          &copy; {new Date().getFullYear()} Ayodhya Police. All Rights Reserved.
        </p>
        <p className="text-xs sm:text-[13px] text-slate-500 font-normal">
          Designed &amp; Developed by Rahul Yadav
        </p>
      </footer>
    </div>
  );
};

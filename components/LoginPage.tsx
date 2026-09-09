'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { AuthUser, authenticate, PRESET_ACCOUNTS } from '@/lib/auth';
import { Shield, Lock, User, Eye, EyeOff, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

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
        setError('अमान्य उपयोगकर्ता नाम या पासवर्ड (Invalid Username or Password). Please try again.');
        setLoading(false);
      }
    }, 400);
  };

  const handleSelectPreset = (role: 'admin' | 'officer') => {
    const acc = PRESET_ACCOUNTS.find((a) => a.role === role);
    if (acc) {
      setUsername(acc.username);
      setPassword(acc.password);
      setError('');
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      
      {/* Background Decorative Rings */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Login Card */}
      <div className="w-full max-w-md bg-slate-900/90 backdrop-blur-xl border border-slate-700/80 rounded-3xl shadow-2xl overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header with Crest */}
        <div className="p-8 pb-6 text-center border-b border-slate-800 relative bg-gradient-to-b from-slate-800/60 to-transparent">
          <div className="relative w-24 h-24 mx-auto mb-3 bg-white rounded-full p-2 border-2 border-amber-400 shadow-xl flex items-center justify-center">
            <Image
              src="/up_police_logo.png"
              alt="UP Police Official Crest"
              width={80}
              height={80}
              className="object-contain"
              priority
            />
          </div>
          
          <h1 className="text-xl font-extrabold text-white tracking-wide">
            POLICE OFFICERS GUEST HOUSE
          </h1>
          <p className="text-amber-400 font-bold text-xs tracking-widest mt-0.5">
            AYODHYA • उत्तर प्रदेश पुलिस
          </p>
          <p className="text-slate-400 text-xs font-hindi mt-1">
            कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
          </p>
        </div>

        {/* Role Fast Switcher Buttons */}
        <div className="px-8 pt-6 pb-2">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2 text-center">
            Select Role to Login (लॉगिन प्रकार चुनें)
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={() => handleSelectPreset('admin')}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                username === 'admin'
                  ? 'bg-amber-500/15 border-amber-400 text-amber-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1">
                  <Shield className="w-3.5 h-3.5 text-amber-400" />
                  Admin
                </span>
                {username === 'admin' && <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />}
              </div>
              <span className="text-[10px] opacity-80 mt-1">Full Control</span>
            </button>

            <button
              type="button"
              onClick={() => handleSelectPreset('officer')}
              className={`p-2.5 rounded-xl border text-left transition flex flex-col justify-between ${
                username === 'officer'
                  ? 'bg-blue-500/15 border-blue-400 text-blue-300 shadow-sm'
                  : 'bg-slate-800/60 border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-blue-400" />
                  Officer
                </span>
                {username === 'officer' && <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />}
              </div>
              <span className="text-[10px] opacity-80 mt-1">Report & Occupancy</span>
            </button>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-4">
          
          {/* Username Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Username (उपयोगकर्ता नाम)
            </label>
            <input
              type="text"
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Username"
              className="w-full px-4 py-2.5 text-sm bg-slate-950/80 text-white rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
            />
          </div>

          {/* Password Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Password (पासवर्ड)
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full pl-4 pr-11 py-2.5 text-sm bg-slate-950/80 text-white rounded-xl border border-slate-700 focus:border-amber-400 focus:ring-2 focus:ring-amber-400/20 outline-none transition"
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

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2 animate-in fade-in duration-150">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 mt-2 rounded-xl text-sm font-bold text-slate-950 bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition active:scale-98 flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : (
              <>
                <span>सुरक्षित लॉगिन करें (Sign In)</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {/* Preset Credentials Help */}
          <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 text-center space-y-1">
            <p>
              Admin: <span className="text-amber-400 font-mono">admin</span> / <span className="text-amber-400 font-mono">admin@pogh2026</span>
            </p>
            <p>
              Officer: <span className="text-blue-400 font-mono">officer</span> / <span className="text-blue-400 font-mono">officer@2026</span>
            </p>
          </div>
        </form>

        {/* Footer */}
        <div className="px-8 py-3.5 bg-slate-950/60 border-t border-slate-800/80 text-center">
          <p className="text-[10px] text-slate-500 tracking-wide">
            Official Portal • Police Officers Guest House, Ayodhya
          </p>
        </div>

      </div>
    </div>
  );
};

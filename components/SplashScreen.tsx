'use client';

import React, { useState, useEffect } from 'react';

interface SplashScreenProps {
  onFinish?: () => void;
  minDurationMs?: number;
}

export const SplashScreen: React.FC<SplashScreenProps> = ({
  onFinish,
  minDurationMs = 1500,
}) => {
  const [fadingOut, setFadingOut] = useState(false);
  const [removed, setRemoved] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFadingOut(true);
      setTimeout(() => {
        setRemoved(true);
        if (onFinish) onFinish();
      }, 500);
    }, minDurationMs);

    return () => clearTimeout(timer);
  }, [minDurationMs, onFinish]);

  if (removed) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 select-none font-sans transition-opacity duration-500 ${
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Ambient background glow rings */}
      <div className="absolute w-80 h-80 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-96 h-96 rounded-full bg-blue-600/10 blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center px-4">
        {/* Animated Pop Logo in White Circle */}
        <div className="w-28 h-28 sm:w-32 sm:h-32 rounded-full bg-white p-3 shadow-2xl flex items-center justify-center border-2 border-amber-400/80 animate-logo-pop animate-pulse-glow">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/up_police_logo.png"
            alt="Ayodhya Police Emblem"
            className="w-full h-full object-contain"
          />
        </div>

        {/* Title and Branding */}
        <div className="mt-5 space-y-1 animate-in fade-in slide-in-from-bottom-3 duration-700 delay-200 fill-mode-forwards">
          <h1 className="text-lg sm:text-xl font-black text-white tracking-wider">
            POLICE OFFICERS GUEST HOUSE
          </h1>
          <p className="text-xs sm:text-sm font-bold text-amber-400 tracking-widest">
            अयोध्या पुलिस • Ayodhya Police
          </p>
          <p className="text-[11px] text-slate-400 font-hindi mt-1">
            कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
          </p>
        </div>

        {/* Subtle Loading indicator */}
        <div className="mt-8 w-36 h-1 bg-slate-800 rounded-full overflow-hidden">
          <div className="w-full h-full bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 rounded-full animate-pulse" />
        </div>
      </div>
    </div>
  );
};

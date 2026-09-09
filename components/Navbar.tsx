'use client';

import React from 'react';
import Image from 'next/image';
import { Database, Plus, FileSpreadsheet, Radio, Sparkles } from 'lucide-react';

interface NavbarProps {
  isRealtimeActive: boolean;
  isSupabaseConfigured: boolean;
  onOpenBookingModal: () => void;
  onOpenConfigModal: () => void;
  onExportExcel: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  isRealtimeActive,
  isSupabaseConfigured,
  onOpenBookingModal,
  onOpenConfigModal,
  onExportExcel,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-900 border-b-2 border-amber-500 shadow-xl backdrop-blur-md bg-opacity-95">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          
          {/* Brand & Emblem */}
          <div className="flex items-center gap-3.5">
            <div className="relative w-12 h-12 flex-shrink-0 bg-white/10 rounded-full p-1 border border-white/20 shadow-inner flex items-center justify-center">
              <Image
                src="/up_police_logo.png"
                alt="UP Police Emblem"
                width={40}
                height={40}
                className="object-contain"
                priority
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg md:text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  POLICE OFFICERS GUEST HOUSE
                  <span className="text-amber-400 text-xs font-semibold px-2 py-0.5 rounded bg-amber-400/10 border border-amber-400/30">
                    AYODHYA
                  </span>
                </h1>
              </div>
              <p className="text-xs text-slate-300 font-hindi flex items-center gap-1">
                कार्यालय वरिष्ठ पुलिस अधीक्षक, जनपद अयोध्या
                <span className="text-slate-400">•</span>
                <span className="text-amber-300/90 font-sans text-[11px] font-medium">Real-time Portal</span>
              </p>
            </div>
          </div>

          {/* Controls & Badges */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Realtime Status Badge */}
            <div
              className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${
                isRealtimeActive
                  ? 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40'
                  : isSupabaseConfigured
                  ? 'bg-blue-950/80 text-blue-300 border-blue-500/40'
                  : 'bg-amber-950/80 text-amber-300 border-amber-500/40'
              }`}
            >
              <span className="relative flex h-2 w-2">
                <span
                  className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                    isRealtimeActive ? 'bg-emerald-400' : 'bg-amber-400'
                  }`}
                />
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${
                    isRealtimeActive ? 'bg-emerald-500' : 'bg-amber-500'
                  }`}
                />
              </span>
              <span className="hidden sm:inline">
                {isRealtimeActive ? 'Live Realtime Active' : isSupabaseConfigured ? 'Supabase Connected' : 'Local Storage Mode'}
              </span>
            </div>

            {/* Supabase Config Button */}
            <button
              onClick={onOpenConfigModal}
              title="Database & Supabase Configuration"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition shadow-sm"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden sm:inline">Supabase Setup</span>
            </button>

            {/* Export Excel Button */}
            <button
              onClick={onExportExcel}
              title="Export filtered records to Excel"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-emerald-100 bg-emerald-700/80 hover:bg-emerald-600 border border-emerald-500/50 transition shadow-sm"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Excel Export</span>
            </button>

            {/* New Booking Button */}
            <button
              onClick={onOpenBookingModal}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs md:text-sm font-semibold text-slate-900 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-md hover:shadow-amber-500/20 transition active:scale-95"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Booking</span>
            </button>
          </div>

        </div>
      </div>
    </header>
  );
};

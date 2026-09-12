'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Building2, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4 text-center font-sans">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mb-4 shadow-xl">
        <Building2 className="w-8 h-8 text-amber-400" />
      </div>
      <h1 className="text-2xl sm:text-3xl font-black mb-2 tracking-wide">
        पुलिस ऑफिसर्स गेस्ट हाउस (POGH)
      </h1>
      <p className="text-slate-400 text-xs sm:text-sm mb-6 max-w-md">
        पेज लोड हो रहा है... आपको मुख्य पोर्टल डैशबोर्ड पर भेजा जा रहा है।
      </p>
      <button
        onClick={() => router.push('/')}
        className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm rounded-xl transition shadow-lg active:scale-95"
      >
        <Home className="w-4 h-4" />
        <span>मुख्य डैशबोर्ड पर जाएं (Go to Dashboard)</span>
      </button>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseConfig, saveSupabaseConfig } from '@/lib/supabase';
import { X, Database, CheckCircle2, AlertCircle, Shield } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

interface SupabaseConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigSaved: () => void;
}

export const SupabaseConfigModal: React.FC<SupabaseConfigModalProps> = ({
  isOpen,
  onClose,
  onConfigSaved,
}) => {
  const [url, setUrl] = useState('');
  const [anonKey, setAnonKey] = useState('');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      const cfg = getSupabaseConfig();
      setUrl(cfg.url || '');
      setAnonKey(cfg.anonKey || '');
      setTestResult(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTestAndSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setTesting(true);
    setTestResult(null);

    const cleanUrl = url.trim();
    const cleanKey = anonKey.trim();

    if (!cleanUrl.startsWith('https://')) {
      setTestResult({
        success: false,
        message: 'कृपया वैध डेटाबेस URL दर्ज करें (https:// से शुरू होना चाहिए)।',
      });
      setTesting(false);
      return;
    }

    try {
      const client = createClient(cleanUrl, cleanKey);
      const { data, error } = await client.from('pogh_bookings').select('id').limit(1);

      if (error) {
        setTestResult({
          success: false,
          message: `डेटाबेस त्रुटि: ${error.message}`,
        });
      } else {
        saveSupabaseConfig({ url: cleanUrl, anonKey: cleanKey });
        setTestResult({
          success: true,
          message: 'डेटाबेस सफलतापूर्वक कनेक्ट हो गया है!',
        });
        setTimeout(() => {
          onConfigSaved();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `कनेक्शन विफल: ${err?.message || 'कृपया नेटवर्क जांचें।'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">डेटाबेस विन्यास (Database Settings)</h3>
              <p className="text-xs text-slate-300">आधिकारिक क्लाउड डेटाबेस कनेक्शन</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <div className="p-6 space-y-4">
          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                डेटाबेस प्रोजेक्ट URL (Database URL)
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project.supabase.co"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                सुरक्षा एक्सेस कुंजी (Security Access Key)
              </label>
              <input
                type="password"
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="Access Key"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-xl border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-xl border text-xs flex items-start gap-2 ${
                  testResult.success
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                    : 'bg-rose-50 text-rose-800 border-rose-300'
                }`}
              >
                {testResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
                )}
                <span>{testResult.message}</span>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition"
              >
                रद्द करें (Cancel)
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-xl shadow transition disabled:opacity-50"
              >
                {testing ? 'जांच हो रही है...' : 'जांचें एवं सुरक्षित करें'}
              </button>
            </div>
          </form>
        </div>

      </div>
    </div>
  );
};

'use client';

import React, { useState, useEffect } from 'react';
import { getSupabaseConfig, saveSupabaseConfig, isSupabaseConfigured } from '@/lib/supabase';
import { X, Database, CheckCircle2, AlertCircle, Copy, Check, ExternalLink, Shield } from 'lucide-react';
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
  const [copiedSql, setCopiedSql] = useState(false);

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
        message: 'Invalid Supabase URL. It must start with https:// (e.g. https://xyz.supabase.co)',
      });
      setTesting(false);
      return;
    }

    try {
      const client = createClient(cleanUrl, cleanKey);
      // Attempt to query the table
      const { data, error } = await client.from('pogh_bookings').select('id').limit(1);

      if (error) {
        // Check if table missing
        if (error.code === '42P01' || error.message.includes('does not exist')) {
          setTestResult({
            success: false,
            message: 'Connected to Supabase, but "pogh_bookings" table not found! Please run the SQL schema script below in Supabase SQL editor.',
          });
        } else {
          setTestResult({
            success: false,
            message: `Supabase error: ${error.message} (Code: ${error.code})`,
          });
        }
      } else {
        saveSupabaseConfig({ url: cleanUrl, anonKey: cleanKey });
        setTestResult({
          success: true,
          message: 'Connection Successful! Realtime database linked successfully.',
        });
        setTimeout(() => {
          onConfigSaved();
          onClose();
        }, 1200);
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Connection failed: ${err?.message || 'Check network or credentials.'}`,
      });
    } finally {
      setTesting(false);
    }
  };

  const sqlSchemaText = `-- 1. Create pogh_bookings table
CREATE TABLE IF NOT EXISTS public.pogh_bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_date DATE NOT NULL,
    guest_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL,
    reference TEXT NOT NULL DEFAULT 'SSP SIR',
    suit_1 NUMERIC(10, 2) DEFAULT 0.00,
    suit_2 NUMERIC(10, 2) DEFAULT 0.00,
    suit_3 NUMERIC(10, 2) DEFAULT 0.00,
    suit_4 NUMERIC(10, 2) DEFAULT 0.00,
    total_amount NUMERIC(10, 2) DEFAULT 0.00,
    meal_type_status TEXT NOT NULL DEFAULT 'PAID',
    status TEXT NOT NULL DEFAULT 'CONFIRMED',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now()),
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('Asia/Kolkata', now())
);

-- 2. Enable Row Level Security & Allow full access
ALTER TABLE public.pogh_bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public full access" ON public.pogh_bookings FOR ALL USING (true) WITH CHECK (true);

-- 3. Enable Realtime Publications
ALTER PUBLICATION supabase_realtime ADD TABLE public.pogh_bookings;`;

  const copySql = () => {
    navigator.clipboard.writeText(sqlSchemaText);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full border border-slate-200 overflow-hidden my-8">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between border-b border-amber-500">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold">Supabase Cloud Database Setup</h3>
              <p className="text-xs text-slate-300">Connect your PostgreSQL Realtime database</p>
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
        <div className="p-6 space-y-5">
          
          {/* Instructions banner */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 space-y-2">
            <div className="font-bold text-slate-800 flex items-center gap-1.5">
              <span>Quick 2-Step Supabase Guide:</span>
              <a
                href="https://supabase.com/dashboard"
                target="_blank"
                rel="noreferrer"
                className="text-amber-600 hover:underline flex items-center gap-0.5 ml-auto font-medium"
              >
                <span>Open Supabase</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <ol className="list-decimal pl-4 space-y-1">
              <li>Create a free project on Supabase and go to <strong>SQL Editor</strong>.</li>
              <li>Copy and run the SQL schema below to create the table and enable real-time sync.</li>
              <li>Copy your <strong>Project URL</strong> and <strong>anon key</strong> (from Settings &gt; API) and paste here.</li>
            </ol>
          </div>

          <form onSubmit={handleTestAndSave} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://your-project-id.supabase.co"
                className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Supabase Anon / Public API Key
              </label>
              <input
                type="password"
                required
                value={anonKey}
                onChange={(e) => setAnonKey(e.target.value)}
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                className="w-full px-3.5 py-2 text-xs font-mono rounded-lg border border-slate-300 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 outline-none transition"
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
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={testing}
                className="px-5 py-2 text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 rounded-lg shadow-md transition disabled:opacity-50"
              >
                {testing ? 'Testing Connection...' : 'Test & Connect'}
              </button>
            </div>
          </form>

          {/* Copyable SQL Accordion */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-700">Supabase SQL Schema Script:</span>
              <button
                onClick={copySql}
                className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-semibold"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copied SQL!' : 'Copy SQL Script'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg text-[11px] font-mono overflow-x-auto max-h-36">
              {sqlSchemaText}
            </pre>
          </div>

        </div>

      </div>
    </div>
  );
};

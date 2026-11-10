'use client';

import React, { useState, useEffect } from 'react';
import { Navbar } from '@/components/navbar';
import {
  Settings,
  CreditCard,
  Cpu,
  RefreshCw,
  Trash2,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingPayPal, setTestingPayPal] = useState(false);
  const [resettingDemo, setResettingDemo] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // Form states
  const [displayName, setDisplayName] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    setLoading(true);
    try {
      const res = await fetch('/api/settings');
      const json = await res.json();
      setData(json);
      if (json.workspace) {
        setDisplayName(json.workspace.displayName || 'Freelancer Studio');
        setDefaultCurrency(json.workspace.defaultCurrency || 'USD');
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleTestPayPal() {
    setTestingPayPal(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_PAYPAL' }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({ text: json.message, type: 'success' });
      } else {
        setActionMessage({ text: json.message, type: 'error' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setTestingPayPal(false);
    }
  }

  async function handleResetDemo() {
    if (!confirm('Reset local database with fresh sample invoices for hackathon demo?')) return;
    setResettingDemo(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_DEMO' }),
      });
      if (res.ok) {
        setActionMessage({ text: 'Sample invoices reset successfully.', type: 'success' });
        fetchSettings();
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setResettingDemo(false);
    }
  }

  async function handleClearAll() {
    if (!confirm('Permanently delete all invoices and briefs from local database?')) return;
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CLEAR_ALL' }),
      });
      if (res.ok) {
        setActionMessage({ text: 'All local records deleted.', type: 'success' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    }
  }

  async function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName, defaultCurrency }),
      });
      if (res.ok) {
        setActionMessage({ text: 'Workspace preferences updated.', type: 'success' });
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2">
            <Settings className="w-7 h-7 text-cyan-400" />
            Integrations &amp; Workspace Settings
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Review PayPal sandbox connection status, AI model configuration, and demo safeguards.
          </p>
        </div>

        {actionMessage && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-3 border ${
              actionMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}

        {/* Integration Status Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* PayPal Card */}
          <div className="glass-panel-elevated rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <CreditCard className="w-5 h-5 text-blue-400" />
                <span>PayPal Invoicing API v2</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  data?.envStatus?.paypalConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}
              >
                {data?.envStatus?.paypalConfigured ? 'CONNECTED' : 'DEMO FALLBACK'}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Uses official PayPal REST sandbox endpoints to create drafts, send hosted links, and synchronize payment states.
            </p>

            <div className="space-y-2 text-xs font-mono bg-midnight-950 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between text-slate-400">
                <span>Client ID:</span>
                <span className="text-slate-200">
                  {data?.envStatus?.paypalClientIdMasked || 'Not set (using demo fallback)'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Endpoint:</span>
                <span className="text-cyan-400 truncate max-w-[220px]">
                  {data?.envStatus?.paypalBaseUrl}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Webhook ID:</span>
                <span className="text-slate-200">
                  {data?.envStatus?.paypalWebhookConfigured ? 'Configured' : 'Optional (Sync fallback active)'}
                </span>
              </div>
            </div>

            <button
              onClick={handleTestPayPal}
              disabled={testingPayPal}
              className="w-full py-2 px-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingPayPal ? 'animate-spin' : ''}`} />
              <span>Test PayPal Sandbox Authentication</span>
            </button>
          </div>

          {/* AI Provider Card */}
          <div className="glass-panel-elevated rounded-2xl p-6 border border-white/10 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-base">
                <Cpu className="w-5 h-5 text-cyan-400" />
                <span>AI Billing Intelligence</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                  data?.envStatus?.geminiConfigured
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                }`}
              >
                {data?.envStatus?.geminiConfigured ? 'GEMINI API' : 'DETERMINISTIC COPILOT'}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Processes unstructured project briefs into structured facts, checks consistency, and validates source evidence.
            </p>

            <div className="space-y-2 text-xs font-mono bg-midnight-950 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between text-slate-400">
                <span>AI Model:</span>
                <span className="text-slate-200">
                  {data?.envStatus?.geminiConfigured ? 'Google Gemini 2.0 Flash' : 'Deterministic Billing Engine'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Arithmetic Calculator:</span>
                <span className="text-emerald-400">Deterministic Server Code</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Source Traceability:</span>
                <span className="text-cyan-400">Offset &amp; Quote Verifier</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400 bg-white/5 p-2.5 rounded-lg border border-white/5">
              💡 To enable live Gemini calls, add <code className="text-cyan-300">GEMINI_API_KEY</code> to your <code className="text-cyan-300">.env</code>. The built-in deterministic engine provides complete fidelity if no key is supplied.
            </div>
          </div>
        </div>

        {/* Workspace Form */}
        <div className="glass-panel rounded-2xl p-6 border border-white/10">
          <h2 className="text-base font-bold text-white mb-4">Workspace Preferences</h2>
          <form onSubmit={handleSaveWorkspace} className="space-y-4 max-w-lg">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Freelancer / Studio Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-midnight-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                placeholder="e.g. Apex Design Studio"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Default Currency Code
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl bg-midnight-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
              >
                <option value="USD">USD — United States Dollar ($)</option>
                <option value="EUR">EUR — Euro (€)</option>
                <option value="GBP">GBP — British Pound (£)</option>
                <option value="CAD">CAD — Canadian Dollar (CA$)</option>
                <option value="AUD">AUD — Australian Dollar (A$)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
            </button>
          </form>
        </div>

        {/* Data Retention & Demo Reset Controls (Page 14 compliance) */}
        <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-950/5 space-y-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Demo Data Management &amp; Privacy Retention</span>
          </div>
          <p className="text-xs text-slate-400">
            TrustFlow AI stores invoice records in your local SQLite database (<code className="text-slate-300">dev.db</code>).
            You can reseed default invoices to evaluate the 3-minute hackathon demo or purge all records.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={handleResetDemo}
              disabled={resettingDemo}
              className="px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-semibold border border-white/10 transition-colors flex items-center gap-2"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${resettingDemo ? 'animate-spin' : ''}`} />
              <span>Reset Sample Demo Invoices</span>
            </button>

            <button
              onClick={handleClearAll}
              className="px-3.5 py-2 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 text-xs font-semibold border border-rose-500/30 transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete All Invoices &amp; Briefs</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

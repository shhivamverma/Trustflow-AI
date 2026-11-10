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
  AlertCircle,
  XCircle,
  Save,
} from 'lucide-react';

export default function SettingsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [testingPayPal, setTestingPayPal] = useState(false);
  const [testingGemini, setTestingGemini] = useState(false);
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

  async function handleTestGemini() {
    setTestingGemini(true);
    setActionMessage(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TEST_GEMINI' }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({ text: json.message, type: 'success' });
      } else {
        setActionMessage({ text: json.message || 'Gemini connection failed.', type: 'error' });
      }
      if (json.geminiStatus) {
        setData((prev: any) => ({
          ...prev,
          envStatus: {
            ...prev?.envStatus,
            geminiStatus: json.geminiStatus,
          },
        }));
      }
    } catch (err: any) {
      setActionMessage({ text: err.message, type: 'error' });
    } finally {
      setTestingGemini(false);
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
                className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold tracking-wide uppercase ${
                  data?.envStatus?.geminiStatus?.status === 'CONNECTED'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : data?.envStatus?.geminiStatus?.status === 'KEY_MISSING'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : data?.envStatus?.geminiStatus?.status === 'AUTH_ERROR'
                    ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                    : data?.envStatus?.geminiStatus?.status === 'RATE_LIMITED'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                    : 'bg-red-500/20 text-red-300 border border-red-500/40'
                }`}
              >
                {data?.envStatus?.geminiStatus?.status === 'CONNECTED' && 'GEMINI API CONNECTED'}
                {data?.envStatus?.geminiStatus?.status === 'KEY_MISSING' && 'GEMINI API KEY MISSING'}
                {data?.envStatus?.geminiStatus?.status === 'AUTH_ERROR' && 'AUTHENTICATION FAILED'}
                {data?.envStatus?.geminiStatus?.status === 'RATE_LIMITED' && 'RATE LIMIT EXCEEDED'}
                {data?.envStatus?.geminiStatus?.status === 'API_ERROR' && 'API REQUEST ERROR'}
                {!data?.envStatus?.geminiStatus && (data?.envStatus?.geminiConfigured ? 'CHECKING...' : 'KEY MISSING')}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Processes unstructured project briefs into structured facts, checks consistency, and validates verbatim source evidence.
            </p>

            <div className="space-y-2 text-xs font-mono bg-midnight-950 p-3 rounded-xl border border-white/5">
              <div className="flex justify-between items-center text-slate-400">
                <span>Connection:</span>
                <span className="font-semibold flex items-center gap-1.5">
                  {data?.envStatus?.geminiStatus?.status === 'CONNECTED' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      <span className="text-emerald-400">Gemini API Connected</span>
                    </>
                  ) : data?.envStatus?.geminiStatus?.status === 'KEY_MISSING' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      <span className="text-amber-400">Gemini API Key Missing</span>
                    </>
                  ) : data?.envStatus?.geminiStatus?.status === 'AUTH_ERROR' ? (
                    <>
                      <span className="w-2 h-2 rounded-full bg-rose-400" />
                      <span className="text-rose-400">Authentication Failed</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 rounded-full bg-red-400" />
                      <span className="text-red-400">API Error</span>
                    </>
                  )}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Active Model:</span>
                <span className="text-slate-200">
                  {data?.envStatus?.geminiStatus?.status === 'CONNECTED'
                    ? `Google Gemini (${data?.envStatus?.geminiStatus?.model || 'gemini-3-flash-preview'})`
                    : 'Deterministic Billing Engine'}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>API Key:</span>
                <span className="text-slate-200">
                  {data?.envStatus?.geminiStatus?.keyMasked ||
                    (data?.envStatus?.geminiConfigured ? 'Configured in .env' : 'Not set in .env')}
                </span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Failover Safeguard:</span>
                <span className="text-emerald-400">Deterministic Engine Active</span>
              </div>

              <div className="flex justify-between text-slate-400">
                <span>Arithmetic Calculator:</span>
                <span className="text-cyan-400">Deterministic Server Code</span>
              </div>
            </div>

            {/* Diagnostic Message Box (Replaces hardcoded helper message) */}
            <div
              className={`text-[11px] p-3 rounded-xl border leading-relaxed ${
                data?.envStatus?.geminiStatus?.status === 'CONNECTED'
                  ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-200'
                  : data?.envStatus?.geminiStatus?.status === 'KEY_MISSING'
                  ? 'bg-amber-500/10 border-amber-500/25 text-amber-200'
                  : 'bg-rose-500/10 border-rose-500/25 text-rose-200'
              }`}
            >
              <div className="flex items-start gap-2">
                {data?.envStatus?.geminiStatus?.status === 'CONNECTED' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold text-white">
                    {data?.envStatus?.geminiStatus?.status === 'CONNECTED'
                      ? 'Gemini Live Extraction Ready'
                      : data?.envStatus?.geminiStatus?.status === 'KEY_MISSING'
                      ? 'Deterministic Standalone Copilot Mode'
                      : 'Gemini Diagnostic Notice'}
                  </div>
                  <div>
                    {data?.envStatus?.geminiStatus?.message ||
                      (data?.envStatus?.geminiConfigured
                        ? 'Gemini API is configured in environment.'
                        : 'GEMINI_API_KEY is missing from environment. Using local deterministic billing engine.')}
                  </div>
                </div>
              </div>
            </div>

            {/* Test Gemini Button */}
            <button
              onClick={handleTestGemini}
              disabled={testingGemini}
              className="w-full py-2 px-3 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/40 font-semibold text-xs transition-colors flex items-center justify-center gap-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testingGemini ? 'animate-spin' : ''}`} />
              <span>Test Gemini API Connection</span>
            </button>
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

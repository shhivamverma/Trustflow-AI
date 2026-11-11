'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { StatusBadge } from '@/components/status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import {
  PlusCircle,
  Search,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  FileText,
  TrendingUp,
  Bell,
  ExternalLink,
} from 'lucide-react';

interface InvoiceItem {
  id: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  total: string;
  dueDate: string | null;
  localStatus: string;
  projectRef: string | null;
  paypalInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  createdAt: string;
}

interface DashboardMetrics {
  totalOutstandingByCurrency: Record<string, string>;
  totalCollectedByCurrency: Record<string, string>;
  overdueCount: number;
  upcomingDueDatesCount: number;
  countsByStatus: Record<string, number>;
}

export default function DashboardPage() {
  const [invoices, setInvoices] = useState<InvoiceItem[]>([]);
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const fetchDashboardData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const res = await fetch(`/api/invoices`);
      if (!res.ok) throw new Error('Failed to load invoices');
      const data = await res.json();
      setInvoices(data.invoices || []);
      setMetrics(data.metrics || null);
      setError(null);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Error fetching data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  // Filter invoices based on status tab and search
  const filteredInvoices = invoices.filter((inv) => {
    const matchesTab =
      activeTab === 'ALL' ||
      inv.localStatus.toUpperCase() === activeTab.toUpperCase() ||
      (activeTab === 'SENT' && (inv.localStatus === 'SENT' || inv.localStatus === 'UNPAID'));

    const query = searchQuery.toLowerCase().trim();
    const matchesSearch =
      !query ||
      inv.clientName.toLowerCase().includes(query) ||
      inv.clientEmail.toLowerCase().includes(query) ||
      (inv.projectRef && inv.projectRef.toLowerCase().includes(query)) ||
      (inv.paypalInvoiceId && inv.paypalInvoiceId.toLowerCase().includes(query));

    return matchesTab && matchesSearch;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Top Header & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Freelancer Billing Workspace
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950 text-cyan-300 border border-cyan-500/40">
                SANDBOX
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Deterministic invoicing, AI billing verification, and PayPal payment reconciliation.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => fetchDashboardData(true)}
              disabled={refreshing}
              className="p-2.5 rounded-xl glass-card hover:bg-white/10 text-slate-300 border border-white/10 hover:border-cyan-400/40 transition-all flex items-center gap-2 text-xs font-medium"
              title="Refresh invoice records from database"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-cyan-400' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <Link
              href="/invoices/new"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
            >
              <PlusCircle className="w-4 h-4 stroke-[2.2]" />
              <span>New Invoice from Brief</span>
            </Link>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Financial Metrics Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Outstanding */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Total Outstanding
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Clock className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white">
              {metrics && Object.keys(metrics.totalOutstandingByCurrency).length > 0 ? (
                Object.entries(metrics.totalOutstandingByCurrency).map(([curr, amt]) => (
                  <CurrencyDisplay key={curr} amount={amt} currency={curr} size="lg" />
                ))
              ) : (
                <span className="text-slate-500 font-mono text-lg">$0.00 USD</span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
              Sent &amp; awaiting client payment
            </p>
          </div>

          {/* Card 2: Collected */}
          <div className="glass-card rounded-2xl p-5 border border-emerald-500/20 bg-emerald-950/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-emerald-400 uppercase tracking-wider">
                Total Collected
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-emerald-300">
              {metrics && Object.keys(metrics.totalCollectedByCurrency).length > 0 ? (
                Object.entries(metrics.totalCollectedByCurrency).map(([curr, amt]) => (
                  <CurrencyDisplay key={curr} amount={amt} currency={curr} size="lg" className="text-emerald-300" />
                ))
              ) : (
                <span className="text-slate-500 font-mono text-lg">$0.00 USD</span>
              )}
            </div>
            <p className="text-[11px] text-emerald-400/80 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Confirmed by PayPal Sandbox
            </p>
          </div>

          {/* Card 3: Overdue Count */}
          <div className="glass-card rounded-2xl p-5 border border-rose-500/20 bg-rose-950/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-rose-400 uppercase tracking-wider">
                Overdue (Derived)
              </span>
              <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-rose-300 font-mono">
              {metrics ? metrics.overdueCount : 0}
            </div>
            <p className="text-[11px] text-rose-400/80 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Eligible for context-aware reminder
            </p>
          </div>

          {/* Card 4: Upcoming Due */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">
                Upcoming Due
              </span>
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-black text-white font-mono">
              {metrics ? metrics.upcomingDueDatesCount : 0}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              Due within active cycle
            </p>
          </div>
        </div>

        {/* Status Filter Tabs & Search Bar */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 pt-2">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 md:pb-0 scrollbar-none" role="tablist">
            {[
              { id: 'ALL', label: 'All Invoices', count: invoices.length },
              { id: 'DRAFT', label: 'Drafts', count: metrics?.countsByStatus.DRAFT || 0 },
              { id: 'SENT', label: 'Sent / Unpaid', count: metrics?.countsByStatus.SENT || 0 },
              { id: 'OVERDUE', label: 'Overdue', count: metrics?.overdueCount || 0 },
              { id: 'PAID', label: 'Paid', count: metrics?.countsByStatus.PAID || 0 },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  role="tab"
                  aria-selected={active}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap flex items-center gap-2 ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                      active ? 'bg-cyan-400 text-slate-950 font-bold' : 'bg-white/10 text-slate-400'
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search box */}
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search client, project, or ID..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-midnight-900 border border-white/10 text-slate-200 placeholder-slate-500 text-xs focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all"
            />
          </div>
        </div>

        {/* Invoices List / Table */}
        <div className="glass-panel-elevated rounded-2xl border border-white/10 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-slate-400 space-y-3">
              <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin mx-auto" />
              <p className="text-sm font-medium">Loading workspace invoices...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-12 text-center text-slate-400 space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-500">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-white">No invoices found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchQuery
                    ? `No invoice matched "${searchQuery}". Try clearing your search.`
                    : 'Transform a freelance brief into your first reviewed PayPal invoice.'}
                </p>
              </div>
              <Link
                href="/invoices/new"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs shadow-md transition-all"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Create Invoice Now</span>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                  <tr>
                    <th className="py-3.5 px-6">Client &amp; Project</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Total Amount</th>
                    <th className="py-3.5 px-4">PayPal ID</th>
                    <th className="py-3.5 px-6 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filteredInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      className="hover:bg-white/[0.03] transition-colors group"
                    >
                      <td className="py-4 px-6">
                        <div className="font-semibold text-white text-sm">
                          {inv.clientName}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                          {inv.projectRef || inv.clientEmail}
                        </div>
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <StatusBadge status={inv.localStatus} size="sm" />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap text-slate-300 font-mono text-[11px]">
                        {inv.dueDate ? (
                          <span
                            className={
                              inv.localStatus === 'OVERDUE'
                                ? 'text-rose-400 font-bold flex items-center gap-1'
                                : ''
                            }
                          >
                            {inv.localStatus === 'OVERDUE' && (
                              <AlertCircle className="w-3 h-3 text-rose-400" />
                            )}
                            {inv.dueDate}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Not set</span>
                        )}
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap">
                        <CurrencyDisplay
                          amount={inv.total}
                          currency={inv.currency}
                          size="md"
                          className="text-white font-bold"
                        />
                      </td>

                      <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px] text-slate-400">
                        {inv.paypalInvoiceId ? (
                          <div className="flex flex-col gap-1 items-start">
                            <span className="bg-midnight-900 border border-white/10 px-2 py-0.5 rounded text-cyan-300">
                              {inv.paypalInvoiceId}
                            </span>
                            {inv.paypalInvoiceId.startsWith('INV2-DEMO-') ? (
                              <span className="text-[9px] font-mono font-bold text-indigo-300 bg-indigo-500/20 border border-indigo-500/30 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-indigo-400" />
                                Demo Mock
                              </span>
                            ) : (
                              <span className="text-[9px] font-mono font-bold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-[0_0_8px_rgba(16,185,129,0.2)]">
                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" />
                                Real Sandbox
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-600">&mdash;</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          {inv.localStatus === 'OVERDUE' && (
                            <Link
                              href={`/invoices/${inv.id}?action=reminder`}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-colors font-medium flex items-center gap-1"
                              title="Draft polite payment follow-up"
                            >
                              <Bell className="w-3 h-3" />
                              <span>Reminder</span>
                            </Link>
                          )}

                          {inv.hostedInvoiceUrl && (
                            <a
                              href={inv.hostedInvoiceUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-300 hover:bg-white/5 transition-colors"
                              title="Open official PayPal hosted invoice in new tab"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}

                          <Link
                            href={`/invoices/${inv.id}`}
                            className="px-3 py-1 rounded-lg bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 hover:bg-cyan-500/20 transition-all font-semibold flex items-center gap-1"
                          >
                            <span>Open</span>
                            <ArrowUpRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

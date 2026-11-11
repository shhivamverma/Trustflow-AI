'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { StatusBadge } from '@/components/status-badge';
import { CurrencyDisplay } from '@/components/currency-display';
import {
  ShieldCheck,
  Send,
  RefreshCw,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  ShieldAlert,
  Bell,
  ArrowLeft,
  Copy,
  Check,
  CreditCard,
  History,
  Sparkles,
} from 'lucide-react';
import { isInvoiceApprovalBlocked, extractAmountInCents, fromCents } from '@/lib/billing-math';

interface InvoiceData {
  id: string;
  clientName: string;
  clientEmail: string;
  currency: string;
  subtotal: string;
  total: string;
  dueDate: string | null;
  terms: string | null;
  projectRef: string | null;
  localStatus: string;
  paypalInvoiceId: string | null;
  hostedInvoiceUrl: string | null;
  lastSyncedAt: string | null;
  createdAt: string;
  lineItems: Array<{
    id: string;
    description: string;
    quantity: string;
    unitAmount: string;
    amount: string;
    sourceQuote?: string | null;
  }>;
  evidence: Array<{
    id: string;
    fieldReference: string;
    sourceQuote: string;
    startOffset?: number | null;
    endOffset?: number | null;
    status?: string | null;
    verified: boolean;
  }>;
  statusHistory: Array<{
    id: string;
    previousStatus: string | null;
    newStatus: string;
    source: string;
    reason: string | null;
    createdAt: string;
  }>;
}

export default function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = use(params);
  const searchParams = useSearchParams();
  const id = resolvedParams.id;

  const [invoice, setInvoice] = useState<InvoiceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Send Confirmation Modal State
  const [showSendModal, setShowSendModal] = useState(false);

  // Reminder Modal State
  const [reminderDraft, setReminderDraft] = useState<string | null>(null);
  const [copiedReminder, setCopiedReminder] = useState(false);
  const [reminderLoading, setReminderLoading] = useState(false);

  // Fetch invoice details
  const fetchInvoice = async () => {
    try {
      const res = await fetch(`/api/invoices/${id}`);
      if (!res.ok) throw new Error('Invoice not found');
      const data = await res.json();
      setInvoice(data.invoice);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [id]);

  // Evaluate if PayPal approval is blocked due to an unresolved arithmetic discrepancy
  const totalEvidence = invoice?.evidence?.find((e) => e.fieldReference === 'statedProjectTotal');
  const quotedCents = totalEvidence?.sourceQuote ? extractAmountInCents(totalEvidence.sourceQuote) : null;
  const statedTotal = quotedCents !== null ? fromCents(quotedCents) : null;
  const approvalBlock = isInvoiceApprovalBlocked({
    statedProjectTotal: statedTotal,
    calculatedSubtotal: invoice?.total,
  });
  const isApprovalBlocked = approvalBlock.isBlocked;

  // Handle URL query action shortcuts (e.g. ?action=reminder or ?action=create_paypal)
  useEffect(() => {
    if (!invoice) return;
    const action = searchParams.get('action');
    if (action === 'reminder' && !reminderDraft) {
      handleGenerateReminder();
    } else if (action === 'create_paypal' && !invoice.paypalInvoiceId && !isApprovalBlocked) {
      handleCreatePayPalDraft();
    }
  }, [invoice, searchParams, isApprovalBlocked]);

  // Create PayPal Draft
  async function handleCreatePayPalDraft() {
    if (isApprovalBlocked) {
      setErrorMsg(
        approvalBlock.reason ||
          'PayPal draft creation blocked: Invoice total conflicts with quoted fee. Reconcile discrepancy before drafting.'
      );
      return;
    }

    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/paypal/create`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create PayPal draft');
      setSuccessMsg(data.message || 'PayPal Draft Created!');
      await fetchInvoice();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Send Invoice via PayPal
  async function handleConfirmSend() {
    setShowSendModal(false);
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/paypal/send`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send invoice');
      setSuccessMsg('Invoice officially sent to client through PayPal Invoicing!');
      await fetchInvoice();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // User-triggered Sync with PayPal
  async function handleSync() {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/sync`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Sync failed');
      const amountMatches = data.remoteAmount && invoice ? parseFloat(data.remoteAmount) === parseFloat(invoice.total) : false;
      const currencyMatches = invoice ? data.currency === invoice.currency : false;
      const statusMatches = invoice ? data.remoteStatus === invoice.localStatus : false;

      const verificationInfo = data.remoteAmount
        ? ` — Remote PayPal Verified: Status: ${data.remoteStatus}${statusMatches ? ' ✓' : ''}, Total: ${data.currency} ${data.remoteAmount}${amountMatches && currencyMatches ? ' ✓ (Exact Match)' : ''}`
        : '';
      setSuccessMsg((data.message || 'Invoice status synchronized with PayPal.') + verificationInfo);
      await fetchInvoice();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Sandbox Payment Simulator
  async function handleSimulatePayment() {
    setActionLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/simulate-payment`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Payment simulation failed');
      setSuccessMsg('Sandbox payment simulated! Status reconciled to PAID.');
      await fetchInvoice();
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setActionLoading(false);
    }
  }

  // Generate Follow-up Reminder
  async function handleGenerateReminder() {
    setReminderLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/invoices/${id}/reminder-draft`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.reason || data.error || 'Failed to draft reminder');
      setReminderDraft(data.draft);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setReminderLoading(false);
    }
  }

  function handleCopyReminder() {
    if (!reminderDraft) return;
    navigator.clipboard.writeText(reminderDraft);
    setCopiedReminder(true);
    setTimeout(() => setCopiedReminder(false), 2500);
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060A12] flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center text-slate-400">
          <RefreshCw className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="min-h-screen bg-[#060A12] flex flex-col">
        <Navbar />
        <div className="flex-1 max-w-lg mx-auto py-20 text-center px-4">
          <h2 className="text-xl font-bold text-white mb-2">Invoice Not Found</h2>
          <p className="text-xs text-slate-400 mb-6">The requested invoice ID does not exist.</p>
          <Link
            href="/dashboard"
            className="px-4 py-2 rounded-xl bg-cyan-500 text-slate-950 font-bold text-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const isDraft = invoice.localStatus === 'DRAFT';
  const isSent = invoice.localStatus === 'SENT' || invoice.localStatus === 'UNPAID';
  const isOverdue = invoice.localStatus === 'OVERDUE';
  const isPaid = invoice.localStatus === 'PAID';

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-cyan-300 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Invoices</span>
          </Link>

          <div className="flex items-center gap-3">
            {invoice.lastSyncedAt && (
              <span className="text-[11px] font-mono text-slate-400">
                Last synced: {new Date(invoice.lastSyncedAt).toLocaleTimeString()}
              </span>
            )}
            <button
              onClick={handleSync}
              disabled={actionLoading || !invoice.paypalInvoiceId}
              className="p-2 rounded-lg glass-card hover:bg-white/10 text-slate-300 border border-white/10 flex items-center gap-1.5 text-xs transition-all disabled:opacity-40"
              title="Sync status with PayPal Sandbox"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${actionLoading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Sync</span>
            </button>
          </div>
        </div>

        {/* Banners */}
        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Invoice Header Card */}
        <div className="glass-panel-elevated rounded-2xl p-6 sm:p-8 border border-white/10 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <StatusBadge status={invoice.localStatus} size="lg" />
                {invoice.paypalInvoiceId && (
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-mono bg-blue-950/80 text-blue-300 border border-blue-500/30">
                      {invoice.paypalInvoiceId}
                    </span>
                    {invoice.paypalInvoiceId.startsWith('INV2-DEMO-') ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                        Demo Mock Fallback
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5 shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        Real PayPal Sandbox Draft
                      </span>
                    )}
                  </div>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {invoice.clientName}
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-mono">
                {invoice.projectRef || 'Invoice Details'} &bull; Created {new Date(invoice.createdAt).toLocaleDateString()}
              </p>
            </div>

            {/* Total Balance Due */}
            <div className="sm:text-right bg-midnight-950/80 p-4 rounded-xl border border-white/5 sm:bg-transparent sm:p-0 sm:border-none">
              <div className="text-[11px] font-mono text-slate-400 uppercase">Total Amount</div>
              <CurrencyDisplay
                amount={invoice.total}
                currency={invoice.currency}
                size="xl"
                className={isPaid ? 'text-emerald-400' : 'text-cyan-300'}
              />
              <div className="text-[11px] text-slate-400 mt-1 font-mono">
                Due: {invoice.dueDate || 'Upon receipt'}
              </div>
            </div>
          </div>

          {/* Mismatch Warning & Approval Block Banner */}
          {isApprovalBlocked && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2.5">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                Deterministic Billing Discrepancy Detected — PayPal draft creation blocked: Invoice line items total ({invoice.currency} {invoice.total}) conflicts with quoted project fee ({invoice.currency} {statedTotal}). Reconcile the discrepancy before creating a PayPal draft.
              </span>
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {/* If no PayPal draft created yet */}
              {!invoice.paypalInvoiceId && isDraft && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleCreatePayPalDraft}
                    disabled={actionLoading || isApprovalBlocked}
                    className={`px-4 py-2.5 rounded-xl font-bold text-xs shadow-md transition-all flex items-center gap-2 ${
                      isApprovalBlocked
                        ? 'bg-slate-800 text-slate-400 border border-white/10 cursor-not-allowed opacity-60'
                        : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 shadow-cyan-500/20'
                    }`}
                    title={isApprovalBlocked ? approvalBlock.reason : 'Create PayPal Sandbox Draft'}
                  >
                    {isApprovalBlocked ? (
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                    ) : (
                      <CreditCard className="w-4 h-4 stroke-[2.2]" />
                    )}
                    <span>Create PayPal Sandbox Draft</span>
                  </button>
                  {isApprovalBlocked && (
                    <span className="text-[10px] font-mono text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 rounded-lg flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400" />
                      <span>Approval locked ({invoice.currency} {approvalBlock.discrepancy} mismatch)</span>
                    </span>
                  )}
                </div>
              )}

              {/* If PayPal draft exists but not yet sent */}
              {invoice.paypalInvoiceId && isDraft && (
                <button
                  onClick={() => setShowSendModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-md shadow-emerald-500/20 transition-all flex items-center gap-2"
                >
                  <Send className="w-4 h-4 stroke-[2.2]" />
                  <span>Send Invoice via PayPal</span>
                </button>
              )}

              {/* If invoice is Sent/Unpaid or Overdue, allow sandbox simulation or reminder */}
              {(isSent || isOverdue) && (
                <>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={actionLoading}
                    className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 font-semibold text-xs transition-colors flex items-center gap-2"
                    title="Simulate client payment in sandbox to test reconciliation"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Simulate Sandbox Payment</span>
                  </button>

                  <button
                    onClick={handleGenerateReminder}
                    disabled={reminderLoading}
                    className="px-3.5 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-semibold text-xs transition-colors flex items-center gap-2"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Draft AI Payment Reminder</span>
                  </button>
                </>
              )}

              {/* If Paid */}
              {isPaid && (
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <span>Payment Fully Reconciled via PayPal</span>
                </div>
              )}
            </div>

            {/* Hosted Link */}
            {invoice.hostedInvoiceUrl && (
              <a
                href={invoice.hostedInvoiceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 border border-blue-500/30 text-xs font-medium transition-colors"
              >
                <span>View PayPal Hosted Invoice</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>

        {/* 2-Column Content: Line Items (Left) vs Traceability & History (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Line Items & Terms */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                Invoice Deliverables &amp; Milestones
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/[0.02] border-b border-white/10 text-slate-400 font-mono uppercase text-[10px]">
                    <tr>
                      <th className="py-2.5 px-3">Description</th>
                      <th className="py-2.5 px-3">Qty</th>
                      <th className="py-2.5 px-3">Rate</th>
                      <th className="py-2.5 px-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {invoice.lineItems.map((item) => (
                      <tr key={item.id}>
                        <td className="py-3 px-3">
                          <div className="font-medium text-white">{item.description}</div>
                          {item.sourceQuote && (
                            <div className="text-[10px] text-cyan-400 font-mono mt-0.5">
                              Evidence: &ldquo;{item.sourceQuote}&rdquo;
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-300">{item.quantity}</td>
                        <td className="py-3 px-3 font-mono text-slate-300">
                          {invoice.currency} {item.unitAmount}
                        </td>
                        <td className="py-3 px-3 font-mono text-white font-bold text-right">
                          {invoice.currency} {item.amount}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-white/10 text-xs font-mono font-bold">
                    <tr>
                      <td colSpan={3} className="py-3 px-3 text-slate-400">
                        Total Amount Due
                      </td>
                      <td className="py-3 px-3 text-right text-cyan-300 text-sm">
                        {invoice.currency} {invoice.total}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Notes & Terms */}
              <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
                <div className="text-slate-400 font-mono text-[10px] uppercase">
                  Payment Terms &amp; Recipient
                </div>
                <div className="text-slate-200">
                  <strong>Terms:</strong> {invoice.terms || 'Payment due as specified.'}
                </div>
                <div className="text-slate-200">
                  <strong>Recipient Email:</strong> {invoice.clientEmail}
                </div>
              </div>
            </div>

            {/* AI Payment Follow-Up Reminder Box (if generated) */}
            {reminderDraft && (
              <div className="glass-panel-elevated rounded-2xl p-6 border border-amber-500/30 bg-amber-950/10 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span>AI Context-Aware Follow-Up Reminder</span>
                  </div>
                  <span className="text-[10px] font-mono bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-bold">
                    DRAFT ONLY
                  </span>
                </div>

                <p className="text-xs text-slate-400">
                  Polite, non-coercive reminder based solely on verified invoice facts. Never auto-sent behind your back.
                </p>

                <textarea
                  readOnly
                  rows={8}
                  value={reminderDraft}
                  className="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-slate-200 text-xs font-mono leading-relaxed focus:outline-none"
                />

                <div className="flex items-center justify-between pt-2">
                  <span className="text-[11px] text-slate-500">
                    Copy and send via your preferred email or Slack channel.
                  </span>
                  <button
                    onClick={handleCopyReminder}
                    className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md"
                  >
                    {copiedReminder ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copied to Clipboard!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Message</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Status History & Evidence Traceability */}
          <div className="lg:col-span-5 space-y-6">
            {/* Status History Timeline */}
            <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-4">
              <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider font-mono">
                <History className="w-4 h-4 text-cyan-400" />
                <span>Payment Lifecycle &amp; Audit Trail</span>
              </div>

              <div className="space-y-4 relative pl-4 border-l border-white/10">
                {invoice.statusHistory.length === 0 ? (
                  <p className="text-xs text-slate-500">No status events recorded yet.</p>
                ) : (
                  invoice.statusHistory.map((hist) => (
                    <div key={hist.id} className="relative group">
                      <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-cyan-400 ring-4 ring-midnight-950" />
                      <div className="text-xs font-semibold text-white flex items-center gap-2">
                        <span>{hist.newStatus}</span>
                        {hist.source === 'paypal' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                            PayPal Sandbox API
                          </span>
                        ) : hist.source === 'demo-fallback' ? (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Demo Fallback Mock
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-white/10 text-slate-400">
                            {hist.source}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{hist.reason}</div>
                      <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                        {new Date(hist.createdAt).toLocaleString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Source Evidence Cards */}
            {invoice.evidence && invoice.evidence.length > 0 && (
              <div className="glass-panel rounded-2xl p-6 border border-white/10 space-y-3">
                <div className="text-xs font-bold text-white uppercase tracking-wider font-mono flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-400" />
                  <span>Verified Source Evidence</span>
                </div>
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {invoice.evidence.map((ev) => (
                    <div
                      key={ev.id}
                      className="p-2.5 rounded-xl bg-midnight-950/70 border border-white/5 text-[11px] font-mono text-slate-300 space-y-1"
                    >
                      <div className="flex items-center justify-between text-[10px] text-cyan-400">
                        <span>{ev.fieldReference}</span>
                        <span className={ev.verified ? "text-emerald-400 font-bold" : "text-amber-400 font-bold"}>
                          {ev.verified ? "✓ VERIFIED IN SOURCE" : "⚠ UNVERIFIED"}
                        </span>
                      </div>
                      <div className="text-slate-200">&ldquo;{ev.sourceQuote}&rdquo;</div>
                      {ev.startOffset !== null && ev.startOffset !== undefined && (
                        <div className="text-[9px] text-slate-500 font-mono">
                          Source range: [{ev.startOffset}–{ev.endOffset}]
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Explicit Confirmation Modal for Sending Invoice */}
        {showSendModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
            <div className="glass-panel-elevated max-w-md w-full rounded-2xl p-6 border border-cyan-500/30 space-y-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Confirm PayPal Invoice Delivery</h3>
                  <p className="text-xs text-slate-400">Explicit human confirmation gate</p>
                </div>
              </div>

              <div className="bg-midnight-950 p-4 rounded-xl border border-white/5 space-y-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Recipient:</span>
                  <span className="text-white font-bold">{invoice.clientEmail}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Amount:</span>
                  <span className="text-cyan-300 font-bold">
                    {invoice.currency} {invoice.total}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">PayPal ID:</span>
                  <span className="text-slate-300">{invoice.paypalInvoiceId}</span>
                </div>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed">
                TrustFlow AI will now invoke PayPal Invoicing v2 API to send this invoice directly to the client.
                The client will receive an official PayPal email with hosted payment link.
              </p>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  onClick={() => setShowSendModal(false)}
                  className="px-4 py-2 rounded-xl glass-card hover:bg-white/10 text-slate-300 text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfirmSend}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-md transition-all"
                >
                  Confirm &amp; Send to Client
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

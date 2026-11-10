'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { CurrencyDisplay } from '@/components/currency-display';
import {
  FileText,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Search,
  Info,
} from 'lucide-react';
import { LineItem, AIExtractionOutput } from '@/lib/types';
import { calculateItemTotal, calculateSubtotal } from '@/lib/billing-math';

const SAMPLE_BRIEFS = {
  balanced: `Project Agreement: Acme Corp Mobile & Web Portal
Client: Acme Corp
Billing Contact: billing@acme.com
Project Reference: Mobile & Web Portal Redesign 2026

Scope and agreed milestones:
- Frontend Development & Interactive UI: 1 @ $1,800.00 USD
- RESTful Backend API & Database Schema: 1 @ $1,100.00 USD
- PayPal Sandbox Payment Integration & Webhook Handling: 1 @ $500.00 USD

Total project fee is USD 3400.00.
Payment terms: Payment due within 14 calendar days upon invoice delivery (2026-11-24).`,

  mismatch: `Consulting Engagement Agreement
Client: Apex Cloud Services
Project Reference: Infrastructure & Payment Modernization

Agreed scope breakdown:
- Frontend user dashboard: $200.00
- Backend microservices integration: $400.00
- PayPal payment flow integration: $200.00
- Cloud infrastructure & automated deployment: $150.00

Note: "Total project fee is USD 800: frontend $200, backend $400 and payment integration $200."
Client email is not yet confirmed. Payment due upon receipt.`,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [briefText, setBriefText] = useState(SAMPLE_BRIEFS.balanced);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractionResult, setExtractionResult] = useState<AIExtractionOutput | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);
  const [highlightedQuote, setHighlightedQuote] = useState<string | null>(null);

  // Editable invoice fields (User edits are authoritative!)
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [dueDate, setDueDate] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [projectRef, setProjectRef] = useState('');
  const [lineItems, setLineItems] = useState<LineItem[]>([]);
  const [userEdited, setUserEdited] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Recalculate totals dynamically
  const liveSubtotal = calculateSubtotal(lineItems);

  // Handle AI extraction trigger
  async function handleExtract() {
    if (!briefText.trim()) return;
    if (userEdited) {
      const confirmReplace = window.confirm(
        'You have manual edits in the review form. Re-extracting will replace them with newly extracted data. Proceed?'
      );
      if (!confirmReplace) return;
    }

    setExtracting(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/ai/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief: briefText }),
      });

      if (!res.ok) {
        const errJson = await res.json();
        throw new Error(errJson.error || 'Failed to extract billing data');
      }

      const json = await res.json();
      const output: AIExtractionOutput = json.extraction;
      setExtractionResult(output);
      setBriefId(json.briefId);

      // Populate editable fields
      setClientName(output.clientName || '');
      setClientEmail(output.clientEmail || '');
      setCurrency(output.currency || 'USD');
      setDueDate(output.dueDate || '');
      setPaymentTerms(output.paymentTerms || '');
      setProjectRef(output.projectReference || '');
      setLineItems(output.lineItems || []);
      setUserEdited(false);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error running AI extraction');
    } finally {
      setExtracting(false);
    }
  }

  // Line item manipulation
  function handleItemChange(index: number, field: keyof LineItem, val: string) {
    setUserEdited(true);
    const updated = [...lineItems];
    const item = { ...updated[index], [field]: val };

    if (field === 'quantity' || field === 'unitAmount') {
      item.amount = calculateItemTotal(
        field === 'quantity' ? val : item.quantity,
        field === 'unitAmount' ? val : item.unitAmount
      );
    }
    updated[index] = item;
    setLineItems(updated);
  }

  function handleAddItem() {
    setUserEdited(true);
    setLineItems([
      ...lineItems,
      {
        description: 'New Deliverable or Milestone',
        quantity: '1',
        unitAmount: '100.00',
        amount: '100.00',
        sourceQuote: null,
      },
    ]);
  }

  function handleRemoveItem(index: number) {
    setUserEdited(true);
    setLineItems(lineItems.filter((_, i) => i !== index));
  }

  // Save reviewed invoice and proceed to PayPal draft
  async function handleSaveAndProceed(createPayPalDraft = false) {
    if (!clientName.trim()) {
      setErrorMsg('Client name is required.');
      return;
    }
    if (!clientEmail.trim() || !clientEmail.includes('@')) {
      setErrorMsg('A valid client email is required to create a PayPal invoice.');
      return;
    }
    if (lineItems.length === 0) {
      setErrorMsg('Please add at least one line item.');
      return;
    }

    setSaving(true);
    setErrorMsg(null);

    try {
      const payload = {
        clientName,
        clientEmail,
        currency,
        dueDate: dueDate || null,
        terms: paymentTerms || null,
        projectRef: projectRef || null,
        lineItems,
        briefId,
        evidence: extractionResult?.evidence || [],
      };

      const res = await fetch('/api/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save invoice draft');
      }

      const json = await res.json();
      const invoiceId = json.invoice.id;

      if (createPayPalDraft) {
        // Redirect directly to invoice detail page with paypal create prompt
        router.push(`/invoices/${invoiceId}?action=create_paypal`);
      } else {
        router.push(`/invoices/${invoiceId}`);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error persisting invoice');
    } finally {
      setSaving(false);
    }
  }

  // Stated total vs Calculated total warning check
  const statedTotal = extractionResult?.statedProjectTotal;
  const isMismatch = statedTotal && statedTotal !== liveSubtotal;

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-white/10">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                AI Billing Intelligence &amp; Intake
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Extract structured invoice items, verify line-item arithmetic, and inspect verbatim source evidence.
            </p>
          </div>

          {/* Preset Buttons for Judges */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">DEMO PRESETS:</span>
            <button
              onClick={() => {
                setBriefText(SAMPLE_BRIEFS.balanced);
                setExtractionResult(null);
                setLineItems([]);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
            >
              1. Balanced Brief ($3.4k)
            </button>
            <button
              onClick={() => {
                setBriefText(SAMPLE_BRIEFS.mismatch);
                setExtractionResult(null);
                setLineItems([]);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              2. Math Mismatch Brief
            </button>
          </div>
        </div>

        {errorMsg && (
          <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* 2-Column Split Workspace: Source Brief (Left) vs Structured Invoice (Right) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Project Brief Input & Evidence Viewer */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="glass-panel-elevated rounded-2xl p-5 border border-white/10 flex-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider font-mono">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Original Project Brief</span>
                  </div>
                  <span className="text-[11px] font-mono text-slate-500">
                    {briefText.length} characters
                  </span>
                </div>

                <div className="relative">
                  <textarea
                    rows={12}
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder="Paste freelance agreement, email thread, or statement of work..."
                    className="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-slate-200 placeholder-slate-500 text-xs font-mono leading-relaxed focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all resize-y"
                  />

                  {/* Highlight indicator if quote selected */}
                  {highlightedQuote && (
                    <div className="mt-2 p-2.5 rounded-lg bg-cyan-950/60 border border-cyan-500/40 text-[11px] text-cyan-300 font-mono">
                      <div className="text-[10px] text-cyan-400 font-bold uppercase mb-0.5">
                        Highlighted Source Evidence:
                      </div>
                      &ldquo;{highlightedQuote}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* Extraction Trigger */}
              <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">
                  {extractionResult ? (
                    <span className="text-cyan-300 font-mono flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                      Extracted via {extractionResult.provider}
                    </span>
                  ) : (
                    'Ready to parse structured facts'
                  )}
                </span>

                <button
                  onClick={handleExtract}
                  disabled={extracting || !briefText.trim()}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Cpu className={`w-3.5 h-3.5 ${extracting ? 'animate-spin' : ''}`} />
                  <span>{extracting ? 'Verifying & Extracting...' : 'Extract Invoice'}</span>
                </button>
              </div>
            </div>

            {/* Source Evidence Traceability Drawer */}
            {extractionResult && extractionResult.evidence.length > 0 && (
              <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 font-mono text-cyan-300">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    Source Evidence Quotes ({extractionResult.evidence.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Click quote to verify</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {extractionResult.evidence.map((ev, i) => (
                    <button
                      key={i}
                      onClick={() => setHighlightedQuote(ev.sourceQuote)}
                      className="w-full text-left p-2 rounded-lg bg-midnight-950/70 hover:bg-cyan-950/30 border border-white/5 hover:border-cyan-400/30 text-[11px] font-mono text-slate-300 transition-colors flex items-center justify-between gap-2"
                    >
                      <span className="truncate">&ldquo;{ev.sourceQuote}&rdquo;</span>
                      <span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/20 text-emerald-300 font-bold">
                        VERIFIED
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: Structured Invoice Review & Human Approval */}
          <div className="lg:col-span-7 space-y-4">
            {/* AI Billing Intelligence Alert Banner */}
            {extractionResult && (
              <div className="space-y-2">
                {/* Mismatch Warning */}
                {isMismatch && (
                  <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/40 text-amber-200 text-xs space-y-1">
                    <div className="flex items-center gap-2 font-bold text-amber-300">
                      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                      <span>Deterministic Billing Discrepancy Detected</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      Invoice line items total <strong className="text-white">{currency} {liveSubtotal}</strong>,
                      but the project agreement explicitly quoted <strong className="text-white">{currency} {statedTotal}</strong>.
                      Review the <strong className="text-amber-300">{currency} {Math.abs(parseFloat(liveSubtotal) - parseFloat(statedTotal)).toFixed(2)}</strong> difference
                      before submitting to PayPal.
                    </p>
                  </div>
                )}

                {/* Missing Email Alert */}
                {(!clientEmail || !clientEmail.includes('@')) && (
                  <div className="p-3.5 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-200 text-xs flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-blue-400 shrink-0" />
                    <span>
                      Client email is missing or unconfirmed in the brief. Please input the recipient email below for PayPal Invoicing.
                    </span>
                  </div>
                )}

                {/* Arithmetic Match Notification */}
                {!isMismatch && statedTotal && (
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>
                      Deterministic Arithmetic Verified: Line items sum ({currency} {liveSubtotal}) matches the quoted project fee.
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Editable Invoice Form */}
            <div className="glass-panel-elevated rounded-2xl p-6 border border-white/10 space-y-6">
              <div className="flex items-center justify-between border-b border-white/10 pb-4">
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-cyan-400" />
                    Invoice Review &amp; Approval
                  </h2>
                  <p className="text-xs text-slate-400">
                    User edits are authoritative and override AI drafts.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-[10px] font-mono text-slate-400">CALCULATED TOTAL</div>
                  <CurrencyDisplay amount={liveSubtotal} currency={currency} size="lg" className="text-cyan-300" />
                </div>
              </div>

              {/* Client & Currency Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Client Name *
                  </label>
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => {
                      setUserEdited(true);
                      setClientName(e.target.value);
                    }}
                    placeholder="e.g. Acme Corp"
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Client Email (PayPal Recipient) *
                  </label>
                  <input
                    type="email"
                    value={clientEmail}
                    onChange={(e) => {
                      setUserEdited(true);
                      setClientEmail(e.target.value);
                    }}
                    placeholder="billing@client.com"
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Currency
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => {
                      setUserEdited(true);
                      setCurrency(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD (CA$)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>
              </div>

              {/* Terms, Due Date & Project Ref */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => {
                      setUserEdited(true);
                      setDueDate(e.target.value);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Payment Terms
                  </label>
                  <input
                    type="text"
                    value={paymentTerms}
                    onChange={(e) => {
                      setUserEdited(true);
                      setPaymentTerms(e.target.value);
                    }}
                    placeholder="e.g. Net 14 days"
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Project Reference
                  </label>
                  <input
                    type="text"
                    value={projectRef}
                    onChange={(e) => {
                      setUserEdited(true);
                      setProjectRef(e.target.value);
                    }}
                    placeholder="e.g. Mobile Portal Redesign"
                    className="w-full px-3 py-2 rounded-xl bg-midnight-950 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              {/* Line Items Table */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Invoice Line Items ({lineItems.length})
                  </span>
                  <button
                    onClick={handleAddItem}
                    className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-semibold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Item</span>
                  </button>
                </div>

                <div className="space-y-3">
                  {lineItems.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 border border-dashed border-white/10 rounded-xl text-xs">
                      No line items yet. Click &ldquo;Extract Invoice&rdquo; or &ldquo;Add Item&rdquo;.
                    </div>
                  ) : (
                    lineItems.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-xl bg-midnight-950/80 border border-white/5 space-y-2 hover:border-cyan-500/20 transition-all"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleItemChange(idx, 'description', e.target.value)}
                            placeholder="Deliverable description..."
                            className="flex-1 px-3 py-1.5 rounded-lg bg-midnight-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                          />
                          <button
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 transition-colors"
                            title="Remove item"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="flex items-center gap-4 text-xs font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={item.quantity}
                              onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                              className="w-16 px-2 py-1 rounded bg-midnight-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-slate-400">Unit ({currency}):</span>
                            <input
                              type="text"
                              value={item.unitAmount}
                              onChange={(e) => handleItemChange(idx, 'unitAmount', e.target.value)}
                              className="w-24 px-2 py-1 rounded bg-midnight-900 border border-white/10 text-white text-xs focus:outline-none focus:border-cyan-400"
                            />
                          </div>

                          <div className="ml-auto text-right">
                            <span className="text-slate-400 mr-1.5 text-[11px]">Total:</span>
                            <span className="text-white font-bold">{currency} {item.amount}</span>
                          </div>
                        </div>

                        {item.sourceQuote && (
                          <div className="text-[10px] text-slate-500 font-mono flex items-center gap-1 truncate">
                            <span className="text-cyan-400">Source:</span> &ldquo;{item.sourceQuote}&rdquo;
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Total Summary & Approval Gates */}
              <div className="pt-4 border-t border-white/10 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
                <div>
                  <div className="text-xs text-slate-400">Subtotal &amp; Balance Due:</div>
                  <CurrencyDisplay amount={liveSubtotal} currency={currency} size="xl" className="text-white" />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleSaveAndProceed(false)}
                    disabled={saving || lineItems.length === 0}
                    className="px-4 py-2.5 rounded-xl glass-card hover:bg-white/10 text-slate-200 font-semibold text-xs border border-white/15 transition-all"
                  >
                    Save Local Draft
                  </button>

                  <button
                    onClick={() => handleSaveAndProceed(true)}
                    disabled={saving || lineItems.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2"
                  >
                    <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                    <span>Approve &amp; Create PayPal Draft</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

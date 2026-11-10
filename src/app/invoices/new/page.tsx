'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { CurrencyDisplay } from '@/components/currency-display';
import {
  FileText,
  Cpu,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  XCircle,
  Plus,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Search,
  Info,
  ExternalLink,
  Edit3,
  Eye,
} from 'lucide-react';
import { LineItem, AIExtractionOutput, SourceEvidence, EvidenceStatus } from '@/lib/types';
import {
  calculateItemTotal,
  calculateSubtotal,
  verifyLineItemEvidence,
  verifyQuoteInSource,
} from '@/lib/billing-math';

const SAMPLE_BRIEFS = {
  balanced: `Project Agreement: Acme Corp Mobile & Web Portal
Client: Acme Corp
Billing Contact: billing@acme.com
Project Reference: Mobile & Web Portal Redesign 2026

Scope and agreed milestones:
Frontend Development: $1,800
Backend API Development: $1,100
PayPal Integration: $500

Total project fee: $3,400
Payment terms: Payment due within 14 calendar days upon invoice delivery (2026-11-24).`,

  mismatch: `Consulting Engagement Agreement
Client: Apex Cloud Services
Billing Contact: billing@apexcloud.io
Project Reference: Infrastructure & Payment Modernization

Agreed scope breakdown:
Frontend user dashboard: $200.00
Backend microservices integration: $400.00
PayPal payment flow integration: $200.00
Cloud infrastructure & automated deployment: $150.00

Note: "Total project fee is USD 800: frontend $200, backend $400 and payment integration $200."
Payment due upon receipt.`,

  ambiguous: `Freelance Web Application Contract
Client: Stellar Media Labs
Billing Contact: accounts@stellarmedia.com
Project Reference: Interactive 3D Platform Prototype

Agreed deliverables:
- UI Concept & Wireframing: $800.00
- Custom WebGL & 3D Shaders: $1,200.00
- Additional client revision rounds (rate to be negotiated based on scope)
- Performance profiling and cloud hosting setup

Total project fee: $2,000.00`,
};

export default function NewInvoicePage() {
  const router = useRouter();
  const [briefText, setBriefText] = useState(SAMPLE_BRIEFS.balanced);
  const [extracting, setExtracting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [extractionResult, setExtractionResult] = useState<AIExtractionOutput | null>(null);
  const [briefId, setBriefId] = useState<string | null>(null);

  // Evidence Inspection & Visual Highlighting State
  const [activeEvidenceIndex, setActiveEvidenceIndex] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<'interactive' | 'edit'>('interactive');

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
      setViewMode('interactive');

      // Auto-select first evidence item if present
      if (output.evidence && output.evidence.length > 0) {
        setActiveEvidenceIndex(0);
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error running AI extraction');
    } finally {
      setExtracting(false);
    }
  }

  // Line item manipulation with real-time evidence re-verification
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

    // Live re-verify this item's evidence against raw brief!
    const evRes = verifyLineItemEvidence({ item, rawBrief: briefText });
    item.evidenceStatus = evRes.status;
    item.startOffset = evRes.startOffset;
    item.endOffset = evRes.endOffset;

    updated[index] = item;
    setLineItems(updated);

    // Also update extractionResult.evidence if present
    if (extractionResult) {
      const updatedEvidence = extractionResult.evidence.map((ev) => {
        if (ev.lineItemIndex === index || ev.fieldReference === `lineItems[${index}].description`) {
          return {
            ...ev,
            status: evRes.status,
            verified: evRes.verified,
            quotedAmount: evRes.quotedAmount,
            message: evRes.message,
          };
        }
        return ev;
      });
      setExtractionResult({
        ...extractionResult,
        evidence: updatedEvidence,
      });
    }
  }

  function handleAddItem() {
    setUserEdited(true);
    const newItem: LineItem = {
      description: 'New Deliverable or Milestone',
      quantity: '1',
      unitAmount: '100.00',
      amount: '100.00',
      sourceQuote: null,
      evidenceStatus: 'NOT FOUND',
    };
    setLineItems([...lineItems, newItem]);
  }

  function handleRemoveItem(index: number) {
    setUserEdited(true);
    setLineItems(lineItems.filter((_, i) => i !== index));
    if (activeEvidenceIndex === index) {
      setActiveEvidenceIndex(null);
    }
  }

  // Select an evidence quote, switch to interactive view, and scroll directly to the highlighted text in the brief
  function handleSelectEvidence(index: number) {
    setActiveEvidenceIndex(index);
    setViewMode('interactive');

    setTimeout(() => {
      const el = document.getElementById(`brief-quote-${index}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 60);
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

  // Active selected evidence item
  const currentEvidence =
    activeEvidenceIndex !== null && extractionResult?.evidence
      ? extractionResult.evidence[activeEvidenceIndex]
      : null;

  // Compute non-overlapping character segments for rich in-brief highlighting
  const annotatedSegments = useMemo<
    Array<{
      type: 'text' | 'highlight';
      text: string;
      evidence?: SourceEvidence;
      evidenceIndex?: number;
      startOffset?: number;
      endOffset?: number;
    }>
  >(() => {
    if (!extractionResult?.evidence || extractionResult.evidence.length === 0) {
      return [{ type: 'text', text: briefText }];
    }

    // Collect valid evidence quotes and resolve their exact offsets in briefText
    const itemsWithOffsets = extractionResult.evidence
      .map((ev, originalIndex) => {
        let start = ev.startOffset ?? null;
        let end = ev.endOffset ?? null;

        // Verify offset or locate quote in current briefText
        if (start === null || end === null || briefText.substring(start, end) !== ev.sourceQuote) {
          const idx = briefText.indexOf(ev.sourceQuote);
          if (idx !== -1) {
            start = idx;
            end = idx + ev.sourceQuote.length;
          }
        }

        return {
          ev,
          originalIndex,
          startOffset: start,
          endOffset: end,
          isValid: start !== null && end !== null && start >= 0 && end > start && end <= briefText.length,
        };
      })
      .filter((item) => item.isValid);

    // Sort by startOffset ascending
    itemsWithOffsets.sort((a, b) => a.startOffset! - b.startOffset!);

    const segments: Array<{
      type: 'text' | 'highlight';
      text: string;
      evidence?: SourceEvidence;
      evidenceIndex?: number;
      startOffset?: number;
      endOffset?: number;
    }> = [];

    let cursor = 0;
    for (const item of itemsWithOffsets) {
      const start = item.startOffset!;
      const end = item.endOffset!;

      if (start > cursor) {
        segments.push({
          type: 'text',
          text: briefText.substring(cursor, start),
        });
      }

      if (end > cursor) {
        const segStart = Math.max(cursor, start);
        segments.push({
          type: 'highlight',
          text: briefText.substring(segStart, end),
          evidence: item.ev,
          evidenceIndex: item.originalIndex,
          startOffset: start,
          endOffset: end,
        });
        cursor = end;
      }
    }

    if (cursor < briefText.length) {
      segments.push({
        type: 'text',
        text: briefText.substring(cursor),
      });
    }

    return segments;
  }, [briefText, extractionResult?.evidence]);

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header & Demo Presets */}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400 mr-1 hidden sm:inline">DEMO PRESETS:</span>
            <button
              onClick={() => {
                setBriefText(SAMPLE_BRIEFS.balanced);
                setExtractionResult(null);
                setLineItems([]);
                setActiveEvidenceIndex(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-300 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
            >
              1. Balanced ($3.4k Verified)
            </button>
            <button
              onClick={() => {
                setBriefText(SAMPLE_BRIEFS.mismatch);
                setExtractionResult(null);
                setLineItems([]);
                setActiveEvidenceIndex(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-colors"
            >
              2. Math Mismatch ($800 vs $950)
            </button>
            <button
              onClick={() => {
                setBriefText(SAMPLE_BRIEFS.ambiguous);
                setExtractionResult(null);
                setLineItems([]);
                setActiveEvidenceIndex(null);
              }}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/10 text-purple-300 border border-purple-500/30 hover:bg-purple-500/20 transition-colors"
            >
              3. Ambiguous Scope
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
          {/* LEFT: Project Brief Input & Interactive Evidence Viewer */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="glass-panel-elevated rounded-2xl p-5 border border-white/10 flex-1 flex flex-col justify-between">
              <div>
                {/* Brief Title and View/Edit Mode Toggle */}
                <div className="flex items-center justify-between mb-3 pb-2 border-b border-white/10">
                  <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-wider font-mono">
                    <FileText className="w-4 h-4 text-cyan-400" />
                    <span>Original Project Brief</span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setViewMode('interactive')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all flex items-center gap-1 ${
                        viewMode === 'interactive'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Inspect interactive highlighted source evidence"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Evidence View</span>
                    </button>
                    <button
                      onClick={() => setViewMode('edit')}
                      className={`px-2.5 py-1 rounded-md text-[10px] font-mono font-semibold transition-all flex items-center gap-1 ${
                        viewMode === 'edit'
                          ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Edit raw text"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Text</span>
                    </button>
                  </div>
                </div>

                {/* Brief Display (Interactive Annotated View or Raw Textarea) */}
                <div className="relative">
                  {viewMode === 'interactive' ? (
                    <div className="w-full min-h-[280px] max-h-[360px] overflow-y-auto p-4 rounded-xl bg-midnight-950 border border-white/10 text-slate-300 text-xs font-mono leading-relaxed whitespace-pre-wrap select-text scroll-smooth">
                      {annotatedSegments.map((seg, idx) => {
                        if (seg.type === 'text') {
                          return <span key={idx}>{seg.text}</span>;
                        }

                        const ev = seg.evidence!;
                        const evIdx = seg.evidenceIndex!;
                        const isSelected = activeEvidenceIndex === evIdx;

                        // Visual styling based on actual evidence status
                        let statusClasses = 'bg-cyan-500/20 text-cyan-200 border-b-2 border-cyan-400';
                        if (ev.status === 'VERIFIED') {
                          statusClasses =
                            'bg-emerald-500/20 text-emerald-100 border-b-2 border-emerald-400 hover:bg-emerald-500/35';
                        } else if (ev.status === 'MISMATCH') {
                          statusClasses =
                            'bg-rose-500/30 text-rose-100 border-b-2 border-rose-400 hover:bg-rose-500/40';
                        } else if (ev.status === 'AMBIGUOUS') {
                          statusClasses =
                            'bg-amber-500/25 text-amber-100 border-b-2 border-amber-400 hover:bg-amber-500/35';
                        } else if (ev.status === 'NOT FOUND') {
                          statusClasses =
                            'bg-red-500/25 text-red-100 line-through border-b-2 border-red-400';
                        }

                        return (
                          <mark
                            key={idx}
                            id={`brief-quote-${evIdx}`}
                            onClick={() => handleSelectEvidence(evIdx)}
                            className={`px-1 py-0.5 rounded cursor-pointer transition-all duration-200 ${statusClasses} ${
                              isSelected
                                ? 'ring-2 ring-cyan-400 shadow-lg shadow-cyan-500/30 font-bold'
                                : 'hover:scale-[1.02]'
                            }`}
                            title={`Status: ${ev.status} — Click to inspect`}
                          >
                            {seg.text}
                          </mark>
                        );
                      })}
                    </div>
                  ) : (
                    <textarea
                      rows={12}
                      value={briefText}
                      onChange={(e) => setBriefText(e.target.value)}
                      placeholder="Paste freelance agreement, email thread, or statement of work..."
                      className="w-full p-3.5 rounded-xl bg-midnight-950 border border-white/10 text-slate-200 placeholder-slate-500 text-xs font-mono leading-relaxed focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all resize-y"
                    />
                  )}
                </div>

                {/* Highlighted Source Evidence Verification Inspector */}
                {currentEvidence && (
                  <div
                    className={`mt-3 p-3.5 rounded-xl border transition-all ${
                      currentEvidence.status === 'VERIFIED'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-200'
                        : currentEvidence.status === 'MISMATCH'
                        ? 'bg-rose-950/40 border-rose-500/40 text-rose-200'
                        : currentEvidence.status === 'AMBIGUOUS'
                        ? 'bg-amber-950/40 border-amber-500/40 text-amber-200'
                        : 'bg-slate-900/60 border-slate-700 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] font-mono font-bold tracking-wider uppercase flex items-center gap-1.5">
                        {currentEvidence.status === 'VERIFIED' && (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        )}
                        {currentEvidence.status === 'MISMATCH' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                        )}
                        {currentEvidence.status === 'AMBIGUOUS' && (
                          <AlertCircle className="w-3.5 h-3.5 text-amber-400" />
                        )}
                        {currentEvidence.status === 'NOT FOUND' && (
                          <XCircle className="w-3.5 h-3.5 text-red-400" />
                        )}
                        <span>Evidence Verification Status:</span>
                      </span>

                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                          currentEvidence.status === 'VERIFIED'
                            ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                            : currentEvidence.status === 'MISMATCH'
                            ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                            : currentEvidence.status === 'AMBIGUOUS'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-red-500/20 text-red-300 border-red-500/40'
                        }`}
                      >
                        {currentEvidence.status}
                      </span>
                    </div>

                    <div className="text-xs font-mono text-white mb-1.5 bg-black/40 p-2 rounded-lg border border-white/5">
                      &ldquo;{currentEvidence.sourceQuote}&rdquo;
                    </div>

                    <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-300 gap-2">
                      <span className="font-mono text-slate-400 text-[10px]">
                        Chars [{currentEvidence.startOffset ?? 0}–{currentEvidence.endOffset ?? 0}] in original brief
                      </span>
                      {currentEvidence.quotedAmount && (
                        <span className="font-mono text-cyan-300 text-[10px]">
                          Quoted in source: ${currentEvidence.quotedAmount}
                        </span>
                      )}
                    </div>

                    {currentEvidence.message && (
                      <div className="mt-1.5 pt-1.5 border-t border-white/10 text-[11px] leading-tight text-slate-300">
                        {currentEvidence.message}
                      </div>
                    )}
                  </div>
                )}
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

            {/* Source Evidence Quotes Drawer */}
            {extractionResult && extractionResult.evidence.length > 0 && (
              <div className="glass-card rounded-2xl p-4 border border-white/10 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-white">
                  <span className="flex items-center gap-1.5 font-mono text-cyan-300">
                    <Search className="w-3.5 h-3.5 text-cyan-400" />
                    Source Evidence Quotes ({extractionResult.evidence.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Click quote to locate in brief</span>
                </div>

                <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                  {extractionResult.evidence.map((ev, i) => {
                    const isSelected = activeEvidenceIndex === i;
                    let badgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
                    if (ev.status === 'MISMATCH') {
                      badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/30';
                    } else if (ev.status === 'AMBIGUOUS') {
                      badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/30';
                    } else if (ev.status === 'NOT FOUND') {
                      badgeClass = 'bg-red-500/20 text-red-300 border-red-500/30';
                    }

                    return (
                      <button
                        key={i}
                        onClick={() => handleSelectEvidence(i)}
                        className={`w-full text-left p-2.5 rounded-lg border text-[11px] font-mono transition-all flex items-center justify-between gap-2 ${
                          isSelected
                            ? 'bg-cyan-950/50 border-cyan-400 text-white shadow-sm'
                            : 'bg-midnight-950/70 hover:bg-slate-900 border-white/5 hover:border-white/20 text-slate-300'
                        }`}
                      >
                        <div className="truncate flex-1">
                          <span className="text-slate-400 mr-1.5">[{ev.startOffset ?? 0}–{ev.endOffset ?? 0}]</span>
                          <span>&ldquo;{ev.sourceQuote}&rdquo;</span>
                        </div>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold border shrink-0 ${badgeClass}`}
                        >
                          {ev.status}
                        </span>
                      </button>
                    );
                  })}
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

              {/* Line Items Table with Live Real-Time Evidence Verification */}
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
                    lineItems.map((item, idx) => {
                      const status = item.evidenceStatus || 'NOT FOUND';
                      let statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
                      if (status === 'MISMATCH') {
                        statusBadgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
                      } else if (status === 'AMBIGUOUS') {
                        statusBadgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
                      } else if (status === 'NOT FOUND') {
                        statusBadgeClass = 'bg-red-500/20 text-red-300 border-red-500/40';
                      }

                      return (
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

                          {/* Line Item Source Evidence Bar */}
                          <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[10px] font-mono">
                            {item.sourceQuote ? (
                              <button
                                type="button"
                                onClick={() => handleSelectEvidence(idx)}
                                className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 truncate max-w-[70%] text-left"
                                title="Locate and highlight this evidence in the brief"
                              >
                                <Search className="w-3 h-3 shrink-0" />
                                <span className="truncate">&ldquo;{item.sourceQuote}&rdquo;</span>
                              </button>
                            ) : (
                              <span className="text-slate-500">Manual item (no source quote)</span>
                            )}

                            <button
                              type="button"
                              onClick={() => handleSelectEvidence(idx)}
                              className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${statusBadgeClass} transition-transform hover:scale-105`}
                              title={`Evidence Verification Status: ${status}`}
                            >
                              {status}
                            </button>
                          </div>
                        </div>
                      );
                    })
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
                    Save Draft Locally
                  </button>

                  <button
                    onClick={() => handleSaveAndProceed(true)}
                    disabled={saving || lineItems.length === 0}
                    className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/25 transition-all flex items-center gap-2 disabled:opacity-50"
                  >
                    <span>Approve &amp; Draft in PayPal</span>
                    <ArrowRight className="w-4 h-4" />
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

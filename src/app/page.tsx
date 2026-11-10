'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '@/components/navbar';
import { Hero3D } from '@/components/hero-3d';
import { StorytellingHero } from '@/components/storytelling-hero';
import {
  FileText,
  Cpu,
  ShieldCheck,
  ArrowRight,
  Sparkles,
  AlertTriangle,
  Bell,
  Code,
  Check,
  Layers,
} from 'lucide-react';

export default function LandingPage() {
  const steps = [
    {
      num: '01',
      title: 'Understand',
      tagline: 'Extracts without guessing',
      desc: 'Paste any unstructured brief, email thread, or client chat. TrustFlow extracts client names, currencies, deliverables, and terms into a structured draft.',
      icon: FileText,
      accent: 'border-blue-500/40 text-blue-400 bg-blue-500/10',
      bullets: [
        'Client name & contact extraction',
        'Automatic line-item structuring',
        'Zero hallucination: unstated fields left null',
      ],
    },
    {
      num: '02',
      title: 'Verify',
      tagline: 'AI Billing Intelligence & Math Check',
      desc: 'The LLM is never the calculator of record. Deterministic server-side code verifies totals, flags discrepancies between items and quoted fees, and traces quotes back to source.',
      icon: Cpu,
      accent: 'border-cyan-500/40 text-cyan-400 bg-cyan-500/10',
      badge: 'Core Differentiator',
      bullets: [
        'Deterministic arithmetic verification ($0.10 + $0.20 = $0.30)',
        'Verbatim source quote back-referencing',
        'Discrepancy alarms for conflicting amounts',
      ],
    },
    {
      num: '03',
      title: 'Get Paid',
      tagline: 'Official PayPal Invoicing v2 Workflow',
      desc: 'Draft PayPal invoices with explicit human review. Send official hosted invoice links, track live payment status, and verify webhooks with zero guesswork.',
      icon: ShieldCheck,
      accent: 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10',
      bullets: [
        'PayPal Sandbox Invoicing API v2',
        'Explicit 2-step review before sending',
        'Real-time status synchronization & webhooks',
      ],
    },
    {
      num: '04',
      title: 'Follow Up',
      tagline: 'Context-Aware AI Payment Reminders',
      desc: 'When an invoice is genuinely overdue, TrustFlow crafts polite, professional, and editable reminder drafts based only on verified PayPal facts.',
      icon: Bell,
      accent: 'border-amber-500/40 text-amber-400 bg-amber-500/10',
      bullets: [
        'Derived overdue status (unpaid + past due date)',
        'Polite, non-coercive tone with copy-to-clipboard',
        'Draft-only guarantee: never auto-sends behind your back',
      ],
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#060A12] selection:bg-cyan-500/30 selection:text-cyan-200">
      <Navbar />

      {/* ------------------------------------------------------------------ */}
      {/* 1. Cinematic Story-Driven Photographic Slideshow Hero              */}
      {/* ------------------------------------------------------------------ */}
      <StorytellingHero />

      {/* ------------------------------------------------------------------ */}
      {/* 2. Cohesive Transition to 3D PayPal Architecture Engine            */}
      {/* ------------------------------------------------------------------ */}
      <section
        id="pipeline-3d-section"
        className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-white/5 scroll-mt-20"
      >
        <div className="text-center max-w-3xl mx-auto mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono bg-blue-950/70 text-cyan-300 border border-blue-500/30 mb-4 shadow-sm shadow-cyan-500/10 backdrop-blur-md">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>INTERACTIVE ARCHITECTURE</span>
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight mb-4 leading-tight">
            See the Engine in Motion
          </h2>

          <p className="text-sm sm:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed">
            From the scattered client brief on the left, through deterministic AI audit and arithmetic verification, directly into the official PayPal Invoicing v2 core.
          </p>
        </div>

        {/* 3D Interactive Hero Canvas */}
        <div className="mt-2">
          <Hero3D />
        </div>
      </section>

      {/* 4-Stage Storytelling Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full border-t border-white/5">
        <div className="text-center max-w-2xl mx-auto mb-16">
          <span className="text-xs font-mono text-cyan-400 uppercase tracking-widest">
            The TrustFlow Blueprint
          </span>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-white mt-2 mb-4">
            Understand. Verify. Get Paid. Follow Up.
          </h2>
          <p className="text-sm sm:text-base text-slate-400">
            A reliable pipeline engineered to eliminate invoice errors, prevent billing disputes, and accelerate PayPal cash flow.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.num}
                className="glass-card rounded-2xl p-6 border border-white/10 flex flex-col justify-between relative group hover:border-cyan-500/40"
              >
                {step.badge && (
                  <span className="absolute -top-3 right-4 px-2.5 py-0.5 rounded-full bg-cyan-500 text-[10px] font-bold text-slate-950 uppercase tracking-wider shadow-md">
                    {step.badge}
                  </span>
                )}

                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-mono text-xs text-slate-400">STAGE {step.num}</span>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${step.accent}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">{step.title}</h3>
                  <div className="text-xs font-medium text-cyan-400 mb-3">{step.tagline}</div>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">{step.desc}</p>
                </div>

                <div className="pt-4 border-t border-white/5 space-y-2">
                  {step.bullets.map((b, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-slate-300">
                      <Check className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                      <span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Differentiator Comparison: Generic AI vs TrustFlow AI */}
      <section className="py-16 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full">
        <div className="glass-panel-elevated rounded-3xl p-8 sm:p-12 border border-cyan-500/20">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-mono text-cyan-400 uppercase tracking-wider">
              Why TrustFlow AI Differentiates
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-white mt-2">
              Billing Intelligence vs. Generic Chatbots
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Generic Invoice Generators */}
            <div className="glass-card rounded-2xl p-6 border border-rose-500/20 bg-rose-950/10">
              <div className="flex items-center gap-2 text-rose-400 text-sm font-semibold mb-4">
                <AlertTriangle className="w-4 h-4" />
                <span>Ordinary AI Invoice Generators</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">&#10005;</span>
                  <span>Hallucinates client emails and unstated payment terms when missing.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">&#10005;</span>
                  <span>Relies on LLM arithmetic, prone to rounding and multiplication errors.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">&#10005;</span>
                  <span>Provides zero source traceability; no way to verify where numbers came from.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-rose-400 font-bold">&#10005;</span>
                  <span>Outputs static PDFs or mock data with no real payment rails.</span>
                </li>
              </ul>
            </div>

            {/* TrustFlow AI */}
            <div className="glass-card rounded-2xl p-6 border border-cyan-500/40 bg-cyan-950/20 relative">
              <div className="flex items-center gap-2 text-cyan-300 text-sm font-semibold mb-4">
                <ShieldCheck className="w-4 h-4 text-cyan-400" />
                <span>TrustFlow AI Copilot</span>
              </div>
              <ul className="space-y-3 text-xs text-slate-200">
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">&#10003;</span>
                  <span>Leaves missing fields explicitly null and flags ambiguities for freelancer review.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">&#10003;</span>
                  <span>Deterministic code of record calculates all item extensions and total balances.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">&#10003;</span>
                  <span>Extracts verbatim quotes with character offsets; verifies quote exists before display.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-cyan-400 font-bold">&#10003;</span>
                  <span>Real PayPal Invoicing API sandbox workflow with live payment tracking and webhook sync.</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Code className="w-4 h-4 text-cyan-400" />
              <span>Full TypeScript &bull; Prisma &bull; Next.js 15 &bull; PayPal REST Invoicing v2</span>
            </div>
            <Link
              href="/invoices/new"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition-all shadow-md shadow-cyan-500/20"
            >
              Test with Sample Brief
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10 py-8 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full text-xs text-slate-400 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span className="text-white font-medium">TrustFlow AI</span>
          <span>&mdash; PayPal AI Hackathon Prototype</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="hover:text-cyan-300 transition-colors">
            Dashboard
          </Link>
          <Link href="/invoices/new" className="hover:text-cyan-300 transition-colors">
            AI Intake
          </Link>
          <Link href="/settings" className="hover:text-cyan-300 transition-colors">
            Settings &amp; Fallback
          </Link>
        </div>
      </footer>
    </div>
  );
}

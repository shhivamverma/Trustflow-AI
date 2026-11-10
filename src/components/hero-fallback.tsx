'use client';

import React from 'react';
import { FileText, Cpu, CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

interface HeroFallbackProps {
  onCtaClick?: () => void;
}

export const HeroFallback: React.FC<HeroFallbackProps> = ({ onCtaClick }) => {
  return (
    <div className="relative w-full h-[460px] md:h-[540px] rounded-3xl overflow-hidden glass-panel-elevated border border-cyan-500/20 p-8 flex flex-col justify-between">
      {/* Background radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/30 via-slate-950/60 to-midnight-950 pointer-events-none" />
      <div className="absolute -top-24 -right-24 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

      {/* Decorative Grid */}
      <div
        className="absolute inset-0 opacity-10 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, #00E5FF 1px, transparent 1px), linear-gradient(to bottom, #00E5FF 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Top flow indicator */}
      <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          TRUSTFLOW PIPELINE VISUALIZATION
        </span>
        <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded text-[11px]">
          INTERACTIVE ARCHITECTURE
        </span>
      </div>

      {/* Center 4-stage data pipeline card visualization */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-4 gap-4 my-auto">
        {/* Stage 1: Brief */}
        <div className="glass-card p-4 rounded-xl border border-white/10 hover:border-cyan-400/50 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3 group-hover:scale-110 transition-transform">
            <FileText className="w-5 h-5" />
          </div>
          <div className="text-xs font-mono text-cyan-400 mb-1">STAGE 01</div>
          <h4 className="text-sm font-semibold text-white">Project Brief</h4>
          <p className="text-xs text-slate-400 mt-1">
            Raw email, Slack message, or statement of work.
          </p>
        </div>

        {/* Stage 2: AI Verify */}
        <div className="glass-card p-4 rounded-xl border border-cyan-500/30 bg-cyan-950/20 hover:border-cyan-400/60 transition-all group relative">
          <div className="absolute -top-2 -right-2 px-1.5 py-0.5 rounded bg-cyan-500 text-[9px] font-bold text-slate-950 uppercase tracking-wider">
            Intelligence
          </div>
          <div className="w-10 h-10 rounded-lg bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300 mb-3 group-hover:scale-110 transition-transform">
            <Cpu className="w-5 h-5" />
          </div>
          <div className="text-xs font-mono text-cyan-400 mb-1">STAGE 02</div>
          <h4 className="text-sm font-semibold text-white">AI Billing Check</h4>
          <p className="text-xs text-slate-400 mt-1">
            Math validation, quote evidence &amp; mismatch alarms.
          </p>
        </div>

        {/* Stage 3: Invoice */}
        <div className="glass-card p-4 rounded-xl border border-white/10 hover:border-cyan-400/50 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-3 group-hover:scale-110 transition-transform">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div className="text-xs font-mono text-indigo-400 mb-1">STAGE 03</div>
          <h4 className="text-sm font-semibold text-white">Human Approval</h4>
          <p className="text-xs text-slate-400 mt-1">
            Freelancer reviews and authorizes official invoice.
          </p>
        </div>

        {/* Stage 4: PayPal Settlement */}
        <div className="glass-card p-4 rounded-xl border border-emerald-500/20 hover:border-emerald-400/50 transition-all group">
          <div className="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3 group-hover:scale-110 transition-transform">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="text-xs font-mono text-emerald-400 mb-1">STAGE 04</div>
          <h4 className="text-sm font-semibold text-white">PayPal Sandbox</h4>
          <p className="text-xs text-slate-400 mt-1">
            Draft creation, verified send, webhook sync &amp; reminder.
          </p>
        </div>
      </div>

      {/* Bottom status & interaction */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-white/10 text-xs">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Deterministic Math
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            Source Traceability
          </span>
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            PayPal Invoicing v2
          </span>
        </div>

        {onCtaClick && (
          <button
            onClick={onCtaClick}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors"
          >
            Launch Live Intake
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};


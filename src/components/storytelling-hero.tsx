'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  FileText,
  Sparkles,
  Pause,
  Play,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  Cpu,
  ShieldCheck,
  ArrowDown,
} from 'lucide-react';

export interface StoryScene {
  id: number;
  stageNumber: string;
  stageBadge: string;
  headline: string;
  subheadline: string;
  bulletPoints: string[];
  imageSrc: string;
  fallbackGradient: string;
  icon: React.ElementType;
  accentColor: string;
  badgeBg: string;
  badgeBorder: string;
  badgeText: string;
}

export const STORY_SCENES: StoryScene[] = [
  {
    id: 0,
    stageNumber: '01',
    stageBadge: 'THE CLIENT CHAOS',
    headline: 'One project. Twenty confusing messages.',
    subheadline:
      'WhatsApp voice notes, conflicting email threads, messy PDFs, and sudden scope changes. Freelancers waste hours trying to decipher what was actually agreed upon.',
    bulletPoints: [
      'Scattered communication across 3+ apps',
      'Conflicting prices ($800 vs $950) in chat history',
      'Unclear deliverables without formal acceptance',
    ],
    imageSrc: '/images/story/scene-1-confusion.jpg',
    fallbackGradient: 'from-amber-950/40 via-slate-950 to-[#060A12]',
    icon: AlertTriangle,
    accentColor: '#F59E0B',
    badgeBg: 'bg-amber-950/70',
    badgeBorder: 'border-amber-500/40',
    badgeText: 'text-amber-300',
  },
  {
    id: 1,
    stageNumber: '02',
    stageBadge: 'THE BILLING NIGHTMARE',
    headline: 'Are the numbers even correct?',
    subheadline:
      'Manual calculations, missing payment details, and forgotten expense line items. When totals mismatch client expectations, invoice disputes and delayed payouts follow.',
    bulletPoints: [
      'Manual calculator math prone to rounding errors',
      'Unclear hourly rates vs fixed milestone charges',
      'Zero verification between notes and final balance',
    ],
    imageSrc: '/images/story/scene-2-billing-nightmare.jpg',
    fallbackGradient: 'from-rose-950/40 via-slate-950 to-[#060A12]',
    icon: FileText,
    accentColor: '#F43F5E',
    badgeBg: 'bg-rose-950/70',
    badgeBorder: 'border-rose-500/40',
    badgeText: 'text-rose-300',
  },
  {
    id: 2,
    stageNumber: '03',
    stageBadge: 'AI BILLING CLARITY',
    headline: 'AI turns scattered details into billing intelligence.',
    subheadline:
      'TrustFlow AI reads raw client conversations, validates item arithmetic with deterministic code of record, and links every dollar back to verbatim source quotes.',
    bulletPoints: [
      'Structured line-item extraction with null safety',
      'Deterministic arithmetic: $0.10 + $0.20 = $0.30 precision',
      'Verbatim source quotes with character offsets',
    ],
    imageSrc: '/images/story/scene-3-ai-clarity.jpg',
    fallbackGradient: 'from-cyan-950/40 via-slate-950 to-[#060A12]',
    icon: Cpu,
    accentColor: '#00E5FF',
    badgeBg: 'bg-cyan-950/70',
    badgeBorder: 'border-cyan-500/40',
    badgeText: 'text-cyan-300',
  },
  {
    id: 3,
    stageNumber: '04',
    stageBadge: 'PAYPAL SETTLEMENT',
    headline: 'From confusion to payment clarity.',
    subheadline:
      'Human approval always in command. 1-click PayPal sandbox draft creation, official hosted invoice payment links, and authoritative real-time webhook status sync.',
    bulletPoints: [
      'Official PayPal Invoicing API v2 sandbox rails',
      'Explicit freelancer review before confirmed send',
      'Real-time status synchronization & overdue drafting',
    ],
    imageSrc: '/images/story/scene-4-resolution.jpg',
    fallbackGradient: 'from-emerald-950/40 via-slate-950 to-[#060A12]',
    icon: ShieldCheck,
    accentColor: '#10B981',
    badgeBg: 'bg-emerald-950/70',
    badgeBorder: 'border-emerald-500/40',
    badgeText: 'text-emerald-300',
  },
];

// 6-second slide duration as requested
const SCENE_DURATION_MS = 6000;

export function StorytellingHero() {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const startTimeRef = useRef<number>(Date.now());
  const animationFrameRef = useRef<number | null>(null);

  // Check reduced motion
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(media.matches);
    const listener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    media.addEventListener('change', listener);
    return () => media.removeEventListener('change', listener);
  }, []);

  const handleNext = useCallback(() => {
    setCurrentIdx((prev) => (prev + 1) % STORY_SCENES.length);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentIdx((prev) => (prev - 1 + STORY_SCENES.length) % STORY_SCENES.length);
    setProgress(0);
    startTimeRef.current = Date.now();
  }, []);

  const goToScene = (index: number) => {
    setCurrentIdx(index);
    setProgress(0);
    startTimeRef.current = Date.now();
  };

  // Subtle mouse parallax handler
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const { clientX, clientY, currentTarget } = e;
    const rect = currentTarget.getBoundingClientRect();
    const x = (clientX - rect.left) / rect.width - 0.5;
    const y = (clientY - rect.top) / rect.height - 0.5;
    setMouseOffset({ x: -x * 12, y: -y * 8 });
  };

  // Timer loop for auto transition and continuous progress bar
  useEffect(() => {
    if (prefersReducedMotion || !isPlaying || isHovered) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    startTimeRef.current = Date.now() - progress * SCENE_DURATION_MS;

    const tick = () => {
      const elapsed = Date.now() - startTimeRef.current;
      const currentProgress = Math.min(1, elapsed / SCENE_DURATION_MS);
      setProgress(currentProgress);

      if (currentProgress >= 1) {
        handleNext();
      } else {
        animationFrameRef.current = requestAnimationFrame(tick);
      }
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [currentIdx, isPlaying, isHovered, prefersReducedMotion, handleNext, progress]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') handleNext();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === ' ') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  const activeScene = STORY_SCENES[currentIdx];

  const scrollTo3D = () => {
    const el = document.getElementById('pipeline-3d-section');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      className="relative w-full min-h-[92vh] lg:min-h-[96vh] flex flex-col justify-between overflow-hidden bg-[#060A12] select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={() => setIsHovered(true)}
      onTouchEnd={() => setIsHovered(false)}
      onMouseMove={handleMouseMove}
      aria-label="TrustFlow AI Problem and Solution Storytelling"
    >
      {/* -------------------------------------------------------------------- */}
      {/* 1. Seamless Cinematic Background Crossfading & Ken Burns Zoom       */}
      {/* -------------------------------------------------------------------- */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        {STORY_SCENES.map((scene, idx) => {
          const isCurrent = idx === currentIdx;
          const kenBurnsScale = prefersReducedMotion
            ? 1.0
            : isCurrent
            ? 1.0 + progress * 0.045
            : 1.0;

          return (
            <div
              key={scene.id}
              className={`absolute inset-0 w-full h-full transition-opacity duration-1000 ease-in-out ${
                isCurrent ? 'opacity-100 z-10 pointer-events-auto' : 'opacity-0 z-0 pointer-events-none'
              }`}
            >
              <div
                className="relative w-full h-full transition-transform ease-out"
                style={{
                  transform: `scale(${kenBurnsScale}) translate(${isCurrent ? mouseOffset.x : 0}px, ${
                    isCurrent ? mouseOffset.y : 0
                  }px)`,
                  transitionDuration: isCurrent ? '120ms' : '1000ms',
                }}
              >
                <Image
                  src={scene.imageSrc}
                  alt={scene.headline}
                  fill
                  priority={idx <= 1}
                  sizes="100vw"
                  className="object-cover object-center filter brightness-[0.84] contrast-[1.06]"
                />
              </div>
            </div>
          );
        })}

        {/* Cinematic Vignette Overlays: Balanced for photograph visibility + text readability */}
        {/* Bottom gradient specifically behind cards and navigation */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#060A12] via-[#060A12]/55 to-transparent z-15 pointer-events-none" />

        {/* Left-hand horizontal scrim behind typography column */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#060A12]/92 via-[#060A12]/55 to-transparent max-w-3xl z-15 pointer-events-none" />

        {/* Top gradient for navbar blending */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#060A12]/75 via-transparent to-transparent h-32 z-15 pointer-events-none" />

        {/* Subtle cyan ambient rim */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-cyan-900/15 via-transparent to-transparent z-15 pointer-events-none" />
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 2. Top Header Space & Hackathon Badge                                */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-20 pt-24 sm:pt-28 md:pt-32 px-5 sm:px-8 lg:px-12 max-w-7xl mx-auto w-full">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono bg-cyan-950/70 text-cyan-300 border border-cyan-500/30 shadow-lg shadow-cyan-500/10 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
            <span className="tracking-wide">THE REAL FREELANCER PROBLEM &rarr; TRUSTFLOW SOLUTION</span>
          </div>

          <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-300 bg-slate-950/70 backdrop-blur-md px-3.5 py-1.5 rounded-full border border-white/15 shadow-sm">
            <span>SCENE {activeScene.stageNumber} OF 04</span>
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="text-white font-medium">{activeScene.stageBadge}</span>
          </div>
        </div>

        {/* -------------------------------------------------------------------- */}
        {/* 3. Hero Story Content (Headline, Subhead, Bullet Evidence, CTAs)      */}
        {/* -------------------------------------------------------------------- */}
        <div className="max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeScene.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
            >
              {/* Scene Indicator Pill */}
              <div
                className="inline-flex items-center gap-2 px-3 py-1 rounded-md text-xs font-mono font-semibold uppercase tracking-wider mb-4 border backdrop-blur-md transition-colors"
                style={{
                  backgroundColor: `${activeScene.accentColor}22`,
                  borderColor: `${activeScene.accentColor}55`,
                  color: activeScene.accentColor,
                }}
              >
                <activeScene.icon className="w-3.5 h-3.5" />
                <span>
                  Stage {activeScene.stageNumber}: {activeScene.stageBadge}
                </span>
              </div>

              {/* Dynamic Big Cinematic Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-white tracking-tight leading-[1.12] mb-5 drop-shadow-md">
                {activeScene.headline}
              </h1>

              {/* Story Narrative Paragraph */}
              <p className="text-base sm:text-lg text-slate-200 leading-relaxed font-normal mb-6 max-w-2xl drop-shadow">
                {activeScene.subheadline}
              </p>

              {/* Key Story Point Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 sm:gap-3 mb-8">
                {activeScene.bulletPoints.map((point, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-2 p-2.5 sm:p-3 rounded-xl bg-slate-950/75 backdrop-blur-md border border-white/15 text-xs text-slate-100 shadow-sm"
                  >
                    <CheckCircle2
                      className="w-4 h-4 shrink-0 mt-0.5"
                      style={{ color: activeScene.accentColor }}
                    />
                    <span className="leading-snug">{point}</span>
                  </div>
                ))}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/invoices/new"
              className="px-6 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-400 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/25 transition-all hover:scale-105 active:scale-95 flex items-center gap-2 group"
            >
              <FileText className="w-4 h-4 stroke-[2.5]" />
              <span>Paste Brief &amp; Extract Invoice</span>
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <button
              onClick={scrollTo3D}
              className="px-5 py-3.5 rounded-xl bg-slate-950/70 hover:bg-white/10 text-slate-200 font-semibold text-sm border border-white/20 transition-all hover:scale-105 backdrop-blur-md flex items-center gap-2"
            >
              <span>Explore 3D Pipeline</span>
              <ArrowDown className="w-4 h-4 text-cyan-400 animate-bounce" />
            </button>

            <Link
              href="/dashboard"
              className="px-4 py-3.5 text-xs text-slate-300 hover:text-white font-medium transition-colors"
            >
              Open Freelancer Dashboard &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* 4. Bottom Slice-Inspired Storytelling Navigation Bar                  */}
      {/* -------------------------------------------------------------------- */}
      <div className="relative z-20 px-5 sm:px-8 lg:px-12 pb-6 sm:pb-8 pt-8 max-w-7xl mx-auto w-full">
        {/* Playback Controls & Status */}
        <div className="flex items-center justify-between gap-4 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrev}
              aria-label="Previous story scene"
              className="w-8 h-8 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-white/15 transition-colors backdrop-blur-md shadow-sm"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pause slideshow' : 'Play slideshow'}
              className="w-8 h-8 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-white/15 transition-colors backdrop-blur-md shadow-sm"
            >
              {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5 ml-0.5" />}
            </button>

            <button
              onClick={handleNext}
              aria-label="Next story scene"
              className="w-8 h-8 rounded-full bg-slate-900/85 hover:bg-slate-800 text-slate-300 hover:text-white flex items-center justify-center border border-white/15 transition-colors backdrop-blur-md shadow-sm"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <span className="text-xs font-mono text-slate-400 ml-2 hidden sm:inline">
              {isPlaying ? 'Auto-advancing story (6s)' : 'Paused'}
            </span>
          </div>

          <div className="text-xs font-mono text-slate-400">
            Interactive Problem Walkthrough
          </div>
        </div>

        {/* 4 Story Segment Progress Cards (Slice-Inspired, No Text Truncation)  */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 sm:gap-3.5">
          {STORY_SCENES.map((scene, idx) => {
            const isActive = idx === currentIdx;
            const isCompleted = idx < currentIdx;

            return (
              <button
                key={scene.id}
                onClick={() => goToScene(idx)}
                className={`text-left p-3 sm:p-3.5 rounded-xl transition-all duration-300 border relative overflow-hidden backdrop-blur-md flex flex-col justify-between min-h-[96px] sm:min-h-[104px] ${
                  isActive
                    ? 'bg-slate-900/95 border-cyan-400/60 shadow-lg shadow-cyan-500/15 ring-1 ring-cyan-400/25'
                    : 'bg-slate-950/70 hover:bg-slate-900/80 border-white/15'
                }`}
              >
                {/* Horizontal Progress Bar Line */}
                <div className="w-full h-1 bg-white/15 rounded-full mb-2.5 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-75 ease-linear"
                    style={{
                      backgroundColor: scene.accentColor,
                      width: isActive
                        ? `${progress * 100}%`
                        : isCompleted
                        ? '100%'
                        : '0%',
                    }}
                  />
                </div>

                {/* Stage Number & Stage Badge */}
                <div className="flex items-center justify-between text-[10px] font-mono mb-1.5 gap-1">
                  <span className={isActive ? 'text-white font-bold' : 'text-slate-400'}>
                    STAGE {scene.stageNumber}
                  </span>
                  <span
                    className="text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 font-medium"
                    style={{
                      color: scene.accentColor,
                      backgroundColor: `${scene.accentColor}22`,
                    }}
                  >
                    {scene.stageBadge}
                  </span>
                </div>

                {/* Stage Title: Multi-line, No Truncation, Fully Readable */}
                <div
                  className={`text-xs font-semibold leading-snug line-clamp-2 ${
                    isActive ? 'text-white font-bold' : 'text-slate-200'
                  }`}
                  title={scene.headline}
                >
                  {scene.headline}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

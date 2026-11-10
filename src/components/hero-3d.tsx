'use client';

import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HeroFallback } from './hero-fallback';
import { CheckCircle2, ShieldCheck, Cpu, ArrowRight, Sparkles, Check } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* 3D PayPal Payment Core (Reduced ~20%, Fine Rings, Authentic Proportions)   */
/* -------------------------------------------------------------------------- */

interface PayPalPaymentCoreProps {
  isPulsing?: boolean;
}

function PayPalPaymentCore({ isPulsing = false }: PayPalPaymentCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);

  // Load the authentic transparent 3D PayPal badge
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/images/paypal-core-transparent.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Gentle floating bob (always mostly front-facing, never tumbles)
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.3) * 0.06;
      groupRef.current.rotation.y = Math.sin(t * 0.7) * 0.04;
      groupRef.current.rotation.x = Math.cos(t * 0.8) * 0.03;
    }

    // Ultra-fine holographic rings rotate with smooth, continuous motion
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.28;
      ring1Ref.current.rotation.x += delta * 0.16;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 0.36;
      ring2Ref.current.rotation.y += delta * 0.2;
    }

    // Confirmation pulse shockwave
    if (pulseRingRef.current) {
      const pulseSpeed = isPulsing ? 3.2 : 1.1;
      const pulseCycle = (t * pulseSpeed) % 2.4;
      const scale = 0.95 + pulseCycle * 0.75;
      pulseRingRef.current.scale.set(scale, scale, 1);
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 0.75 - pulseCycle * 0.32);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. Beveled Glass Backdrop Slab (scaled down ~20% from 2.45 to 1.96) */}
      <mesh position={[0, 0, -0.07]}>
        <boxGeometry args={[1.96, 1.72, 0.18]} />
        <meshPhysicalMaterial
          color="#001844"
          emissive="#003087"
          emissiveIntensity={0.55}
          roughness={0.1}
          metalness={0.2}
          transmission={0.88}
          thickness={0.8}
          transparent
          opacity={0.9}
        />
      </mesh>

      {/* 2. Delicate Glass Rim Outline */}
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[2.0, 1.76, 0.2]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive="#0066FF"
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.3}
        />
      </mesh>

      {/* 3. Authentic 3D Embossed PayPal Logo Badge (scaled ~20% down, 1.94 x 1.68) */}
      <mesh position={[0, 0, 0.04]}>
        <planeGeometry args={[1.94, 1.68]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.02}
          roughness={0.16}
          metalness={0.65}
          emissive="#002b66"
          emissiveIntensity={0.28}
        />
      </mesh>

      {/* 4. Thinner, More Elegant Holographic Orbital Rings */}
      <mesh ref={ring1Ref} position={[0, 0, 0]} rotation={[0.65, 0.35, 0]}>
        <torusGeometry args={[1.5, 0.007, 16, 96]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive="#00E5FF"
          emissiveIntensity={0.9}
          transparent
          opacity={0.75}
        />
      </mesh>

      <mesh ref={ring2Ref} position={[0, 0, 0]} rotation={[-0.45, 0.65, 0]}>
        <torusGeometry args={[1.7, 0.0055, 16, 96]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#0066FF"
          emissiveIntensity={0.8}
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* 5. Elegant Confirmation Pulse Shockwave Ring */}
      <mesh ref={pulseRingRef} position={[0, 0, -0.02]}>
        <ringGeometry args={[1.05, 1.1, 64]} />
        <meshBasicMaterial
          color="#00E5FF"
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 6. Refined Specular Point Lights */}
      <pointLight color="#00E5FF" intensity={2.6} distance={5.5} position={[0, 0, 1.1]} />
      <pointLight color="#003087" intensity={2.2} distance={6.5} position={[0, -0.8, -0.7]} />
      <pointLight color="#ffffff" intensity={1.2} distance={4.5} position={[0.8, 0.8, 0.9]} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* 3D Workflow Data Stream: Brief Anchor -> AI Audit Anchor -> PayPal Core    */
/* -------------------------------------------------------------------------- */

function PipelineDataStream() {
  const streamPointsRef = useRef<THREE.Points>(null);
  const particleCount = 44;

  const { curve, progressArray } = useMemo(() => {
    // Stage 1: Brief Anchor [-2.4, 0.85, 0.3]
    const p0 = new THREE.Vector3(-2.4, 0.85, 0.3);
    const p1 = new THREE.Vector3(-0.8, 1.6, 0.4);
    // Stage 2: AI Verification Anchor [2.3, 1.1, -0.1]
    const p2 = new THREE.Vector3(2.3, 1.1, -0.1);
    const p3 = new THREE.Vector3(1.1, 0.2, 0.2);
    // Stage 3: PayPal Payment Core [0, 0, 0.05]
    const p4 = new THREE.Vector3(0, 0, 0.05);

    const curvePath = new THREE.CurvePath<THREE.Vector3>();
    curvePath.add(new THREE.CubicBezierCurve3(p0, p1, p2, p2));
    curvePath.add(new THREE.QuadraticBezierCurve3(p2, p3, p4));

    const progress = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i++) {
      progress[i] = i / particleCount;
    }

    return { curve: curvePath, progressArray: progress };
  }, []);

  const [positions] = useState(() => new Float32Array(particleCount * 3));

  useFrame((_, delta) => {
    for (let i = 0; i < particleCount; i++) {
      progressArray[i] = (progressArray[i] + delta * 0.24) % 1.0;
      const pt = curve.getPoint(progressArray[i]);
      if (pt) {
        positions[i * 3] = pt.x;
        positions[i * 3 + 1] = pt.y;
        positions[i * 3 + 2] = pt.z;
      }
    }

    if (streamPointsRef.current) {
      streamPointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <points ref={streamPointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.075}
        color="#00E5FF"
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Subtle Currency Sparkles around Core                                       */
/* -------------------------------------------------------------------------- */

function CurrencySparkles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 70;

  const [positions] = useState(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 4;
      const radius = 1.6 + (Math.random() - 0.5) * 1.3;
      coords[i * 3] = Math.cos(angle) * radius;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 2.1;
      coords[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return coords;
  });

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.1;
      pointsRef.current.rotation.x = Math.sin(pointsRef.current.rotation.y * 0.4) * 0.06;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.045}
        color="#38BDF8"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* 3D Milestone Anchor Nodes (Brief & Audit)                                  */
/* -------------------------------------------------------------------------- */

function HologramNodes() {
  const node1Ref = useRef<THREE.Mesh>(null);
  const node2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (node1Ref.current) {
      node1Ref.current.rotation.y = t * 0.4;
      node1Ref.current.position.y = 0.85 + Math.sin(t * 1.4) * 0.06;
    }
    if (node2Ref.current) {
      node2Ref.current.rotation.y = -t * 0.5;
      node2Ref.current.position.y = 1.1 + Math.cos(t * 1.6) * 0.06;
    }
  });

  return (
    <group>
      {/* Node 1: Brief Anchor (Left) */}
      <mesh ref={node1Ref} position={[-2.4, 0.85, 0.3]}>
        <torusGeometry args={[0.28, 0.02, 16, 32]} />
        <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={0.8} />
      </mesh>

      {/* Node 2: AI Verification Anchor (Top Right) */}
      <mesh ref={node2Ref} position={[2.3, 1.1, -0.1]}>
        <octahedronGeometry args={[0.26, 0]} />
        <meshStandardMaterial color="#38BDF8" emissive="#0066FF" emissiveIntensity={0.85} wireframe />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Scene Container with Gentle Parallax                                       */
/* -------------------------------------------------------------------------- */

function SceneContainer({
  mousePos,
  isPulsing,
}: {
  mousePos: { x: number; y: number };
  isPulsing: boolean;
}) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mousePos.x * 0.2,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mousePos.y * 0.1,
        0.05
      );
    }
  });

  return (
    <group ref={groupRef}>
      <PayPalPaymentCore isPulsing={isPulsing} />
      <HologramNodes />
      <PipelineDataStream />
      <CurrencySparkles />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Exported Hero 3D Component with Interactive Cards & Previews          */
/* -------------------------------------------------------------------------- */

interface Hero3DProps {
  onCtaClick?: () => void;
}

export function Hero3D({ onCtaClick }: Hero3DProps) {
  const [mounted, setMounted] = useState(false);
  const [hasWebGL, setHasWebGL] = useState(true);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isPulsing, setIsPulsing] = useState(false);

  // Active card preview hover states
  const [activeCard, setActiveCard] = useState<string | null>(null);

  useEffect(() => {
    setMounted(true);

    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionListener);

    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setHasWebGL(false);
    } catch {
      setHasWebGL(false);
    }

    return () => {
      motionQuery.removeEventListener('change', motionListener);
    };
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    setMousePos({ x, y });
  };

  const handleTriggerPulse = () => {
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 2000);
    if (onCtaClick) onCtaClick();
  };

  if (!mounted) {
    return <HeroFallback onCtaClick={onCtaClick} />;
  }

  if (prefersReducedMotion || !hasWebGL || hasError) {
    return <HeroFallback onCtaClick={onCtaClick} />;
  }

  // Perspective tilt values
  const cardTiltX = -mousePos.y * 10;
  const cardTiltY = mousePos.x * 10;

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-full h-[500px] sm:h-[530px] md:h-[570px] rounded-3xl overflow-hidden glass-panel-elevated border border-cyan-500/25 select-none"
      aria-label="Interactive 3D TrustFlow PayPal Invoicing Flow"
      style={{ perspective: '1200px' }}
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/30 via-slate-950/85 to-midnight-950 pointer-events-none" />

      {/* Top Banner / Pipeline Label */}
      <div className="absolute top-4 left-5 right-5 z-20 flex items-center justify-between text-xs text-slate-400 font-mono pointer-events-none">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          <span className="hidden sm:inline">TRUSTFLOW 3D PIPELINE:</span> BRIEF &rarr; AI VERIFY &rarr; PAYPAL SETTLE
        </span>
        <span className="bg-blue-950/70 text-cyan-300 border border-blue-500/40 px-2.5 py-0.5 rounded text-[11px] backdrop-blur-md font-mono">
          PAYPAL INVOICING v2
        </span>
      </div>

      {/* Three.js Canvas */}
      <Canvas
        className="w-full h-full cursor-grab active:cursor-grabbing"
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onError={() => setHasError(true)}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 7.5]} fov={45} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[5, 6, 5]} intensity={1.3} color="#ffffff" />
        <directionalLight position={[-5, -4, -2]} intensity={0.9} color="#00E5FF" />

        <Suspense fallback={null}>
          <SceneContainer mousePos={mousePos} isPulsing={isPulsing} />
        </Suspense>
      </Canvas>

      {/* ---------------------------------------------------------------------- */}
      {/* Floating Holographic Cards Layer (Interactive, No Overlap, Previews)   */}
      {/* ---------------------------------------------------------------------- */}
      <div className="absolute inset-0 pointer-events-none z-10 p-4 sm:p-8">
        <div className="relative w-full h-full">
          {/* Card 1: Input Brief (Left) */}
          <div
            onMouseEnter={() => setActiveCard('brief')}
            onMouseLeave={() => setActiveCard(null)}
            className={`pointer-events-auto absolute left-2 sm:left-4 md:left-6 top-12 sm:top-16 w-44 sm:w-56 p-3 sm:p-4 rounded-2xl glass-panel-elevated border text-left shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out cursor-pointer ${
              activeCard === 'brief'
                ? 'border-cyan-400 scale-[1.04] shadow-cyan-500/25 ring-1 ring-cyan-400/40 z-30'
                : 'border-cyan-400/40 hover:border-cyan-400/70'
            } animate-float-slow`}
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(25px)`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5 sm:mb-2">
              <span className="flex items-center gap-1.5 text-[9px] sm:text-[10px] font-mono text-cyan-400 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                INPUT BRIEF
              </span>
              <span className="text-[9px] sm:text-[10px] text-slate-400 font-mono">#BR-804</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white truncate">
              Acme Mobile Redesign
            </div>
            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300">
              <span>Frontend + API</span>
              <span className="text-cyan-300 font-mono font-medium">$3,400 USD</span>
            </div>

            {/* Meaningful Information Preview Badge on Hover */}
            <div
              className={`mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 space-y-1 transition-all duration-200 ${
                activeCard === 'brief' ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden'
              }`}
            >
              <div className="text-cyan-400 font-mono flex items-center gap-1">
                <Check className="w-3 h-3 text-cyan-400" />
                <span>3 deliverables parsed</span>
              </div>
              <div className="text-slate-400 truncate">Quote offsets verified in text</div>
            </div>
          </div>

          {/* Card 2: AI Verification Badge (Top Right) */}
          <div
            onMouseEnter={() => setActiveCard('audit')}
            onMouseLeave={() => setActiveCard(null)}
            className={`pointer-events-auto absolute right-2 sm:right-4 md:right-6 top-12 sm:top-14 w-44 sm:w-56 p-3 sm:p-4 rounded-2xl glass-panel-elevated border text-left shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out cursor-pointer ${
              activeCard === 'audit'
                ? 'border-blue-400 scale-[1.04] shadow-blue-500/25 ring-1 ring-blue-400/40 z-30'
                : 'border-blue-400/40 hover:border-blue-400/70'
            } animate-float-slow [animation-delay:1.5s]`}
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(35px)`,
            }}
          >
            <div className="flex items-center gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
              <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Cpu className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
              </div>
              <span className="text-[9px] sm:text-[10px] font-mono text-cyan-400 font-bold tracking-wider">
                BILLING AUDIT
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs font-medium text-emerald-400">
              <CheckCircle2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400 shrink-0" />
              <span>Arithmetic Verified</span>
            </div>
            <div className="mt-1 text-[9px] sm:text-[10px] text-slate-400">
              Quotes linked to agreement
            </div>

            {/* Meaningful Information Preview Badge on Hover */}
            <div
              className={`mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 space-y-1 transition-all duration-200 ${
                activeCard === 'audit' ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden'
              }`}
            >
              <div className="text-emerald-400 font-mono flex items-center gap-1">
                <Check className="w-3 h-3 text-emerald-400" />
                <span>Zero math discrepancies</span>
              </div>
              <div className="text-slate-400 truncate">Deterministic cents arithmetic</div>
            </div>
          </div>

          {/* Card 3: PayPal Settlement (Bottom Right) */}
          <div
            onMouseEnter={() => setActiveCard('paypal')}
            onMouseLeave={() => setActiveCard(null)}
            className={`pointer-events-auto absolute right-2 sm:right-6 md:right-10 bottom-14 sm:bottom-16 w-48 sm:w-60 p-3 sm:p-4 rounded-2xl glass-panel-elevated border text-left shadow-2xl backdrop-blur-xl transition-all duration-300 ease-out cursor-pointer ${
              activeCard === 'paypal'
                ? 'border-emerald-400 scale-[1.04] shadow-emerald-500/25 ring-1 ring-emerald-400/40 z-30'
                : 'border-emerald-400/40 hover:border-emerald-400/70'
            } animate-float-slow [animation-delay:3s]`}
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(30px)`,
            }}
          >
            <div className="flex items-center justify-between mb-1 sm:mb-1.5">
              <span className="flex items-center gap-1 text-[9px] sm:text-[10px] font-mono text-emerald-400 font-bold">
                <ShieldCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-emerald-400" />
                PAYPAL INVOICING v2
              </span>
              <span className="text-[8px] sm:text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono font-bold">
                SANDBOX
              </span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white">Status: Confirmed &amp; Sent</div>
            <div className="mt-1 flex items-center justify-between text-[10px] sm:text-[11px] text-slate-300">
              <span>Authoritative sync</span>
              <span className="text-emerald-300 font-mono font-bold">$3,400.00</span>
            </div>

            {/* Meaningful Information Preview Badge on Hover */}
            <div
              className={`mt-2 pt-2 border-t border-white/10 text-[10px] text-slate-300 space-y-1 transition-all duration-200 ${
                activeCard === 'paypal' ? 'opacity-100 max-h-16' : 'opacity-0 max-h-0 overflow-hidden'
              }`}
            >
              <div className="text-cyan-400 font-mono flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Hosted payment link ready</span>
              </div>
              <div className="text-slate-400 truncate">Explicit human send confirmation</div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar & Action */}
      <div className="absolute bottom-4 left-5 right-5 z-20 flex flex-wrap items-center justify-between gap-3 text-xs pointer-events-none">
        <div className="flex items-center gap-3 sm:gap-4 bg-midnight-950/85 backdrop-blur-md px-3 sm:px-3.5 py-1.5 rounded-xl border border-white/10 text-slate-300 text-[11px] sm:text-xs">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-cyan-400" />
            AI Intelligence
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-blue-400" />
            PayPal Invoicing v2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-emerald-400" />
            Exact Math
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerPulse();
          }}
          className="pointer-events-auto inline-flex items-center gap-2 px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <span>Trigger Payment Pulse</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

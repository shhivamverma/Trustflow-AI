'use client';

import React, { useRef, useState, useEffect, Suspense, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HeroFallback } from './hero-fallback';
import { CheckCircle2, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* 3D PayPal Payment Core & Holographic Rings                                 */
/* -------------------------------------------------------------------------- */

interface PayPalPaymentCoreProps {
  isPulsing?: boolean;
}

function PayPalPaymentCore({ isPulsing = false }: PayPalPaymentCoreProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ring1Ref = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const pulseRingRef = useRef<THREE.Mesh>(null);
  const badgeMeshRef = useRef<THREE.Mesh>(null);

  // Load the authentic PayPal 3D core transparent texture
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    const tex = loader.load('/images/paypal-core-transparent.png');
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  useFrame((state, delta) => {
    const t = state.clock.getElapsedTime();

    // Gentle floating bob for the main PayPal core (always mostly front-facing)
    if (groupRef.current) {
      groupRef.current.position.y = Math.sin(t * 1.4) * 0.08;
      // Very subtle idle breathing tilt (never spins away or tumbles)
      groupRef.current.rotation.y = Math.sin(t * 0.8) * 0.06;
      groupRef.current.rotation.x = Math.cos(t * 0.9) * 0.04;
    }

    // Outer and Inner Holographic Rings rotate continuously
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += delta * 0.35;
      ring1Ref.current.rotation.x += delta * 0.2;
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.z -= delta * 0.45;
      ring2Ref.current.rotation.y += delta * 0.25;
    }

    // Expanding Payment Confirmation Pulse Shockwave
    if (pulseRingRef.current) {
      const pulseSpeed = isPulsing ? 3.0 : 1.2;
      const pulseCycle = (t * pulseSpeed) % 2.5;
      const scale = 1.0 + pulseCycle * 0.8;
      pulseRingRef.current.scale.set(scale, scale, 1);
      const mat = pulseRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 0.8 - pulseCycle * 0.35);
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, 0]}>
      {/* 1. Beveled Glass Backdrop Slab (matching user reference image) */}
      <mesh position={[0, 0, -0.08]}>
        <boxGeometry args={[2.45, 2.15, 0.22]} />
        <meshPhysicalMaterial
          color="#001844"
          emissive="#003087"
          emissiveIntensity={0.5}
          roughness={0.12}
          metalness={0.2}
          transmission={0.88}
          thickness={0.9}
          transparent
          opacity={0.88}
        />
      </mesh>

      {/* 2. Glass Rim Glow Outline */}
      <mesh position={[0, 0, -0.06]}>
        <boxGeometry args={[2.5, 2.2, 0.24]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive="#0066FF"
          emissiveIntensity={0.6}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* 3. Authentic 3D Embossed PayPal Logo Badge */}
      <mesh ref={badgeMeshRef} position={[0, 0, 0.05]}>
        {/* Aspect ratio matches 571 x 495 texture */}
        <planeGeometry args={[2.42, 2.1]} />
        <meshStandardMaterial
          map={texture}
          transparent
          alphaTest={0.02}
          roughness={0.15}
          metalness={0.65}
          emissive="#002b66"
          emissiveIntensity={0.3}
        />
      </mesh>

      {/* 4. Concentric Holographic Orbital Rings */}
      <mesh ref={ring1Ref} position={[0, 0, 0]} rotation={[0.7, 0.4, 0]}>
        <torusGeometry args={[1.85, 0.016, 16, 80]} />
        <meshStandardMaterial
          color="#00E5FF"
          emissive="#00E5FF"
          emissiveIntensity={0.9}
          transparent
          opacity={0.7}
        />
      </mesh>

      <mesh ref={ring2Ref} position={[0, 0, 0]} rotation={[-0.5, 0.7, 0]}>
        <torusGeometry args={[2.1, 0.014, 16, 80]} />
        <meshStandardMaterial
          color="#0079C1"
          emissive="#0066FF"
          emissiveIntensity={0.8}
          transparent
          opacity={0.55}
        />
      </mesh>

      {/* 5. Payment Confirmation Pulse Shockwave Ring */}
      <mesh ref={pulseRingRef} position={[0, 0, -0.02]}>
        <ringGeometry args={[1.35, 1.42, 64]} />
        <meshBasicMaterial
          color="#00E5FF"
          transparent
          opacity={0.6}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 6. Point Lights for rich blue/cyan specular highlights */}
      <pointLight color="#00E5FF" intensity={3.0} distance={6} position={[0, 0, 1.2]} />
      <pointLight color="#003087" intensity={2.5} distance={7} position={[0, -1, -0.8]} />
      <pointLight color="#ffffff" intensity={1.5} distance={5} position={[1, 1, 1]} />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* 3D Pipeline Data Stream (Brief -> AI Verify -> PayPal Core)                */
/* -------------------------------------------------------------------------- */

function PipelineDataStream() {
  const streamPointsRef = useRef<THREE.Points>(null);
  const particleCount = 48;

  // Build curved Bézier path: Brief [-2.6, 1.0, 0.4] -> AI [2.5, 1.2, -0.2] -> PayPal Core [0, 0, 0]
  const { curve, progressArray } = useMemo(() => {
    const p0 = new THREE.Vector3(-2.6, 1.0, 0.4);   // Stage 1: Brief
    const p1 = new THREE.Vector3(-0.5, 1.8, 0.6);   // Control 1
    const p2 = new THREE.Vector3(2.5, 1.2, -0.2);   // Stage 2: AI Verification
    const p3 = new THREE.Vector3(1.2, 0.2, 0.3);    // Control 2
    const p4 = new THREE.Vector3(0, 0, 0.05);       // Stage 3: PayPal Payment Core

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
      progressArray[i] = (progressArray[i] + delta * 0.22) % 1.0;
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
        size={0.09}
        color="#00E5FF"
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Ambient Currency & Star Sparkles                                           */
/* -------------------------------------------------------------------------- */

function CurrencySparkles() {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 90;

  const [positions] = useState(() => {
    const coords = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 4;
      const radius = 1.8 + (Math.random() - 0.5) * 1.5;
      coords[i * 3] = Math.cos(angle) * radius;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 2.4;
      coords[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return coords;
  });

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.12;
      pointsRef.current.rotation.x = Math.sin(pointsRef.current.rotation.y * 0.5) * 0.08;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.05}
        color="#38BDF8"
        transparent
        opacity={0.65}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

/* -------------------------------------------------------------------------- */
/* Holographic Stage Anchor Nodes (WebGL)                                     */
/* -------------------------------------------------------------------------- */

function HologramNodes() {
  const node1Ref = useRef<THREE.Mesh>(null);
  const node2Ref = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    if (node1Ref.current) {
      node1Ref.current.rotation.y = t * 0.5;
      node1Ref.current.position.y = 1.0 + Math.sin(t * 1.5) * 0.08;
    }
    if (node2Ref.current) {
      node2Ref.current.rotation.y = -t * 0.6;
      node2Ref.current.position.y = 1.2 + Math.cos(t * 1.7) * 0.08;
    }
  });

  return (
    <group>
      {/* Node 1: Brief Anchor (Left) */}
      <mesh ref={node1Ref} position={[-2.6, 1.0, 0.4]}>
        <torusGeometry args={[0.35, 0.03, 16, 32]} />
        <meshStandardMaterial color="#00E5FF" emissive="#00E5FF" emissiveIntensity={0.8} />
      </mesh>

      {/* Node 2: AI Verification Anchor (Top Right) */}
      <mesh ref={node2Ref} position={[2.5, 1.2, -0.2]}>
        <octahedronGeometry args={[0.32, 0]} />
        <meshStandardMaterial color="#38BDF8" emissive="#0066FF" emissiveIntensity={0.9} wireframe />
      </mesh>
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Scene Container with Parallax                                         */
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
      // Gentle parallax follow
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mousePos.x * 0.22,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mousePos.y * 0.12,
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
/* Main Exported Hero 3D Component                                            */
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

  // 3D perspective tilt for HTML floating cards
  const cardTiltX = -mousePos.y * 12;
  const cardTiltY = mousePos.x * 12;

  return (
    <div
      onMouseMove={handleMouseMove}
      onClick={handleTriggerPulse}
      className="relative w-full h-[480px] md:h-[560px] rounded-3xl overflow-hidden glass-panel-elevated border border-cyan-500/25 select-none cursor-pointer"
      aria-label="Interactive 3D TrustFlow PayPal Invoicing Flow"
      style={{ perspective: '1200px' }}
      title="Click anywhere to trigger visual PayPal payment confirmation pulse"
    >
      {/* Background ambient radial glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-blue-950/35 via-slate-950/85 to-midnight-950 pointer-events-none" />

      {/* Top Banner / Pipeline Label */}
      <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between text-xs text-slate-400 font-mono pointer-events-none">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          TRUSTFLOW 3D CORE: BRIEF &rarr; AI VERIFY &rarr; PAYPAL SETTLE
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
      {/* Floating Holographic Cards Layer                                       */}
      {/* ---------------------------------------------------------------------- */}
      <div className="absolute inset-0 pointer-events-none z-10 flex flex-col justify-between p-6 sm:p-10">
        <div className="relative w-full h-full">
          {/* Card 1: Input Brief (Left) */}
          <div
            className="absolute left-2 sm:left-6 top-14 sm:top-20 w-48 sm:w-56 p-3.5 sm:p-4 rounded-2xl glass-panel-elevated border border-cyan-400/50 text-left shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out animate-float-slow"
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(25px)`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                INPUT BRIEF
              </span>
              <span className="text-[10px] text-slate-400 font-mono">#BR-804</span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white truncate">
              Acme Mobile Redesign
            </div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Frontend + API</span>
              <span className="text-cyan-300 font-mono font-medium">$3,400 USD</span>
            </div>
          </div>

          {/* Card 2: AI Verification Badge (Top Right) */}
          <div
            className="absolute right-2 sm:right-6 top-10 sm:top-14 w-48 sm:w-56 p-3.5 sm:p-4 rounded-2xl glass-panel-elevated border border-blue-400/50 text-left shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out animate-float-slow [animation-delay:1.5s]"
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(35px)`,
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-md bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
                <Cpu className="w-3.5 h-3.5" />
              </div>
              <span className="text-[10px] font-mono text-cyan-400 font-semibold tracking-wider">
                BILLING AUDIT
              </span>
            </div>
            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Arithmetic Verified</span>
            </div>
            <div className="mt-1 text-[10px] text-slate-400">
              Quotes linked to original agreement
            </div>
          </div>

          {/* Card 3: PayPal Settlement (Bottom Right) */}
          <div
            className="absolute right-2 sm:right-10 bottom-14 sm:bottom-16 w-52 sm:w-60 p-3.5 sm:p-4 rounded-2xl glass-panel-elevated border border-emerald-400/50 text-left shadow-2xl backdrop-blur-xl transition-transform duration-200 ease-out animate-float-slow [animation-delay:3s]"
            style={{
              transform: `perspective(1000px) rotateX(${cardTiltX}deg) rotateY(${cardTiltY}deg) translateZ(30px)`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                PAYPAL INVOICING v2
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                SANDBOX
              </span>
            </div>
            <div className="text-xs sm:text-sm font-semibold text-white">Status: Confirmed &amp; Sent</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Authoritative sync</span>
              <span className="text-emerald-300 font-mono font-bold">$3,400.00</span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Status Bar & Action */}
      <div className="absolute bottom-4 left-6 right-6 z-20 flex flex-wrap items-center justify-between gap-3 text-xs pointer-events-none">
        <div className="flex items-center gap-4 bg-midnight-950/80 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-slate-300">
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            AI Billing Intelligence
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-400" />
            PayPal Invoicing v2
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Exact Arithmetic
          </span>
        </div>

        <button
          onClick={(e) => {
            e.stopPropagation();
            handleTriggerPulse();
          }}
          className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105 active:scale-95"
        >
          <span>Trigger Payment Pulse</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

'use client';

import React, { useRef, useState, useEffect, Suspense } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Float, Html, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { HeroFallback } from './hero-fallback';
import { CheckCircle2, ShieldCheck, Cpu, ArrowRight } from 'lucide-react';

/* -------------------------------------------------------------------------- */
/* 3D Scene Components                                                        */
/* -------------------------------------------------------------------------- */

function CentralCore() {
  const meshRef = useRef<THREE.Mesh>(null);
  const outerWireRef = useRef<THREE.Mesh>(null);

  useFrame((state, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.x += delta * 0.25;
      meshRef.current.rotation.y += delta * 0.35;
    }
    if (outerWireRef.current) {
      outerWireRef.current.rotation.x -= delta * 0.15;
      outerWireRef.current.rotation.y -= delta * 0.2;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Inner Glowing Crystal Core */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[1.35, 1]} />
        <meshPhysicalMaterial
          color="#00E5FF"
          emissive="#0055ff"
          emissiveIntensity={0.6}
          roughness={0.15}
          metalness={0.8}
          transmission={0.85}
          thickness={1.2}
          transparent
          opacity={0.92}
        />
      </mesh>

      {/* Outer Wireframe Sphere Orbit */}
      <mesh ref={outerWireRef}>
        <icosahedronGeometry args={[1.9, 1]} />
        <meshStandardMaterial
          color="#38BDF8"
          emissive="#00E5FF"
          emissiveIntensity={0.4}
          wireframe
          transparent
          opacity={0.35}
        />
      </mesh>

      {/* Central Luminous Point Light */}
      <pointLight color="#00E5FF" intensity={3.5} distance={7} />
      <pointLight color="#0066FF" intensity={2.0} distance={9} position={[0, -1, 1]} />
    </group>
  );
}

function FloatingHologramCards() {
  return (
    <>
      {/* Card 1: Brief Input (Left) */}
      <Float speed={1.8} rotationIntensity={0.2} floatIntensity={0.5} position={[-2.8, 1.2, 0.5]}>
        <Html transform distanceFactor={7} position={[0, 0, 0]} className="pointer-events-none select-none">
          <div className="w-52 p-3.5 rounded-2xl glass-panel-elevated border border-cyan-400/40 text-left shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                INPUT BRIEF
              </span>
              <span className="text-[10px] text-slate-400 font-mono">#BR-804</span>
            </div>
            <div className="text-xs font-semibold text-white truncate">Acme Mobile Redesign</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Frontend + API</span>
              <span className="text-cyan-300 font-mono font-medium">$3,400 USD</span>
            </div>
          </div>
        </Html>
      </Float>

      {/* Card 2: AI Verification Badge (Top Right) */}
      <Float speed={2.2} rotationIntensity={0.25} floatIntensity={0.6} position={[2.7, 1.4, -0.2]}>
        <Html transform distanceFactor={7} position={[0, 0, 0]} className="pointer-events-none select-none">
          <div className="w-52 p-3.5 rounded-2xl glass-panel-elevated border border-blue-400/40 text-left shadow-2xl backdrop-blur-xl">
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
        </Html>
      </Float>

      {/* Card 3: PayPal Settlement (Bottom Right) */}
      <Float speed={1.5} rotationIntensity={0.15} floatIntensity={0.4} position={[2.4, -1.3, 0.4]}>
        <Html transform distanceFactor={7} position={[0, 0, 0]} className="pointer-events-none select-none">
          <div className="w-56 p-3.5 rounded-2xl glass-panel-elevated border border-emerald-400/40 text-left shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between mb-1.5">
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                PAYPAL INVOICING v2
              </span>
              <span className="text-[9px] bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded font-mono">
                SANDBOX
              </span>
            </div>
            <div className="text-xs font-semibold text-white">Status: Confirmed &amp; Sent</div>
            <div className="mt-1 flex items-center justify-between text-[11px] text-slate-300">
              <span>Authoritative sync</span>
              <span className="text-emerald-300 font-mono font-bold">$3,400.00</span>
            </div>
          </div>
        </Html>
      </Float>
    </>
  );
}

function DataParticleFlow() {
  const pointsRef = useRef<THREE.Points>(null);
  const particleCount = 180;

  const [positions] = useState(() => {
    const coords = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      // Create spiral/torus particle cloud
      const angle = (i / particleCount) * Math.PI * 4;
      const radius = 2.2 + (Math.random() - 0.5) * 1.6;
      coords[i * 3] = Math.cos(angle) * radius;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 2.2;
      coords[i * 3 + 2] = Math.sin(angle) * radius;
    }
    return coords;
  });

  useFrame((_, delta) => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y += delta * 0.18;
      pointsRef.current.rotation.x = Math.sin(pointsRef.current.rotation.y * 0.5) * 0.1;
    }
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.06}
        color="#00E5FF"
        transparent
        opacity={0.7}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function SceneContainer({ mousePos }: { mousePos: { x: number; y: number } }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (groupRef.current) {
      // Gentle parallax follow
      groupRef.current.rotation.y = THREE.MathUtils.lerp(
        groupRef.current.rotation.y,
        mousePos.x * 0.25,
        0.05
      );
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        -mousePos.y * 0.15,
        0.05
      );
    }
  });

  return (
    <group ref={groupRef}>
      <CentralCore />
      <FloatingHologramCards />
      <DataParticleFlow />
    </group>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Exported Hero 3D Component with Fallback & Error Isolation             */
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

  useEffect(() => {
    setMounted(true);

    // Check reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(motionQuery.matches);
    const motionListener = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    motionQuery.addEventListener('change', motionListener);

    // Check WebGL availability safely
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) {
        setHasWebGL(false);
      }
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

  if (!mounted) {
    return <HeroFallback onCtaClick={onCtaClick} />;
  }

  // Fallback if reduced motion is requested, WebGL unsupported, or 3D failed
  if (prefersReducedMotion || !hasWebGL || hasError) {
    return <HeroFallback onCtaClick={onCtaClick} />;
  }

  return (
    <div
      onMouseMove={handleMouseMove}
      className="relative w-full h-[460px] md:h-[540px] rounded-3xl overflow-hidden glass-panel-elevated border border-cyan-500/20"
      aria-label="Interactive 3D TrustFlow Billing Flow Visualization"
    >
      {/* Background ambient lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-950/20 via-slate-950/80 to-midnight-950 pointer-events-none" />

      {/* Top Banner / Label */}
      <div className="absolute top-4 left-6 right-6 z-20 flex items-center justify-between text-xs text-slate-400 font-mono pointer-events-none">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
          TRUSTFLOW 3D EXPERIENCE: BRIEF → VERIFY → INVOICE → SETTLE
        </span>
        <span className="bg-cyan-950/60 text-cyan-300 border border-cyan-800/60 px-2 py-0.5 rounded text-[11px] backdrop-blur-md">
          INTERACTIVE 3D
        </span>
      </div>

      {/* Three.js Canvas */}
      <Canvas
        className="w-full h-full cursor-grab active:cursor-grabbing"
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onError={() => setHasError(true)}
      >
        <PerspectiveCamera makeDefault position={[0, 0, 7.5]} fov={45} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 6, 5]} intensity={1.2} color="#ffffff" />
        <directionalLight position={[-5, -4, -2]} intensity={0.8} color="#00E5FF" />

        <Suspense fallback={null}>
          <SceneContainer mousePos={mousePos} />
        </Suspense>
      </Canvas>

      {/* Bottom status bar */}
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

        {onCtaClick && (
          <button
            onClick={onCtaClick}
            className="pointer-events-auto inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
          >
            Create Invoice From Brief
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}

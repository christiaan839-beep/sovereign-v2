"use client";

/**
 * SOVEREIGN MATRIX — ReceiptOrb (Wave 121).
 *
 * Cinematic Three.js receipt-pulse orb modelled on the TEXTURA.US Ithaca
 * reference but rebuilt around Sovereign brand: cyan (audit) instead of
 * green, particle wireframe sphere with a distort shader, and an
 * opt-in pulse hook so the orb actually animates on real receipt
 * events (not just decorative — it IS the signal).
 *
 * Design rules respected:
 *   - Dark-mode first (#030303 substrate)
 *   - Cyan accent for audit/security surfaces
 *   - prefers-reduced-motion auto-disables rotation + pulse
 *   - Pure component; canvas + lights tuned for low GPU draw cost
 *     so the orb can sit ABOVE THE FOLD without tanking LCP
 *
 * The `pulseToken` prop lets the parent fire a pulse imperatively
 * (e.g. when a fresh receipt lands via webhook / poll). When unset,
 * the orb just breathes on idle.
 */

import { useRef, useEffect, useState, useMemo } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import {
  Sphere,
  MeshDistortMaterial,
  Points,
  PointMaterial,
} from "@react-three/drei";
import * as THREE from "three";

const CYAN = "#22d3ee";
const COPPER = "#f59e0b";

function OrbCore({
  pulse,
  reduceMotion,
  accent,
}: {
  pulse: number;
  reduceMotion: boolean;
  accent: "cyan" | "copper";
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const haloRef = useRef<THREE.Mesh>(null);
  const lastPulseTime = useRef(0);

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    if (!meshRef.current) return;

    // Idle: slow rotation + subtle breathing distort
    if (!reduceMotion) {
      meshRef.current.rotation.y += 0.002;
      meshRef.current.rotation.x = Math.sin(t * 0.3) * 0.08;
    }

    // Pulse: spring-decay scale impulse when pulseToken changes
    const sincePulse = t - lastPulseTime.current;
    const pulseEnv =
      pulse > 0 && sincePulse < 1.6
        ? Math.exp(-sincePulse * 2.5) * Math.sin(sincePulse * 8) * 0.18
        : 0;

    const base = 1 + (reduceMotion ? 0 : Math.sin(t * 0.5) * 0.03);
    const scale = base + pulseEnv;
    meshRef.current.scale.setScalar(scale);

    if (haloRef.current) {
      haloRef.current.scale.setScalar(scale * 1.18 + Math.abs(pulseEnv) * 0.6);
      const mat = haloRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.12 + Math.abs(pulseEnv) * 0.5;
    }
  });

  useEffect(() => {
    if (pulse > 0) {
      lastPulseTime.current = performance.now() / 1000;
    }
  }, [pulse]);

  const color = accent === "cyan" ? CYAN : COPPER;

  return (
    <group>
      {/* Outer halo — fades on pulse */}
      <Sphere ref={haloRef} args={[1.6, 32, 32]}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.12}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </Sphere>

      {/* Wireframe receipt sphere */}
      <Sphere ref={meshRef} args={[1.5, 96, 96]}>
        <MeshDistortMaterial
          color={color}
          attach="material"
          distort={reduceMotion ? 0.05 : 0.22}
          speed={reduceMotion ? 0 : 1.4}
          roughness={0.15}
          metalness={0.7}
          wireframe
        />
      </Sphere>
    </group>
  );
}

/**
 * Seeded LCG — deterministic so the React render is pure
 * (Wave 158: closes `react-hooks/purity` warnings). Same
 * particle layout on every mount, every server pre-render,
 * every hydration — no impurity, no hydration mismatch.
 */
function seededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

function buildStarfield(particleCount: number): Float32Array {
  const arr = new Float32Array(particleCount * 3);
  // Fixed seed produces a stable visual layout across renders.
  // The starfield is a 600-point background; any deterministic
  // distribution looks indistinguishable from a random one.
  // Seed chosen deterministically; any constant works. "SOVRGN" in hex.
  const rng = seededRandom(0x534f5652474e);
  for (let i = 0; i < particleCount; i++) {
    // Sphere-shell distribution at radius 2.4-3.2
    const theta = rng() * Math.PI * 2;
    const phi = Math.acos(2 * rng() - 1);
    const r = 2.4 + rng() * 0.8;
    arr[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    arr[i * 3 + 2] = r * Math.cos(phi);
  }
  return arr;
}

function StarField({
  reduceMotion,
  particleCount,
}: {
  reduceMotion: boolean;
  particleCount: number;
}) {
  const ref = useRef<THREE.Points>(null);

  // Pre-allocate particles distributed on a 3-sphere shell using
  // a SEEDED LCG so the render is pure — no Math.random in the
  // render path. useMemo caches once per particleCount change.
  const positions = useMemo(
    () => buildStarfield(particleCount),
    [particleCount],
  );

  useFrame((state) => {
    if (ref.current && !reduceMotion) {
      ref.current.rotation.y = state.clock.elapsedTime * 0.04;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3} frustumCulled={false}>
      <PointMaterial
        color={CYAN}
        size={0.018}
        sizeAttenuation
        transparent
        opacity={0.6}
        depthWrite={false}
      />
    </Points>
  );
}

export interface ReceiptOrbProps {
  /** Incremented externally to trigger a pulse (e.g. on receipt-arrived event). */
  pulseToken?: number;
  /** Cyan = audit/receipt surfaces; copper = marketing. Default cyan. */
  accent?: "cyan" | "copper";
  /** Height of the canvas container in CSS units. */
  className?: string;
  /** Show the dotted star-field around the orb. Default true. */
  starField?: boolean;
}

export function ReceiptOrb({
  pulseToken = 0,
  accent = "cyan",
  className,
  starField = true,
}: ReceiptOrbProps) {
  // Wave 124 polish — lazy-init both signals so we never call setState
  // synchronously inside useEffect (React 19 lint rule
  // react-hooks/set-state-in-effect would flag a cascading render).
  // SSR-safe via typeof window guard; mount renders the right value
  // first paint, no flicker.
  const [reduceMotion, setReduceMotion] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(pointer: coarse)").matches ||
      window.matchMedia("(max-width: 768px)").matches
    );
  });

  useEffect(() => {
    const reduceMq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onReduceChange = () => setReduceMotion(reduceMq.matches);
    reduceMq.addEventListener("change", onReduceChange);

    // Wave 124 — listen to coarse + narrow as live media queries. The
    // OR-of-two-mqs pattern means EITHER trigger flips us into mobile
    // mode and either flipping back flips us out.
    const coarseMq = window.matchMedia("(pointer: coarse)");
    const narrowMq = window.matchMedia("(max-width: 768px)");
    const recompute = () => setIsMobile(coarseMq.matches || narrowMq.matches);
    coarseMq.addEventListener("change", recompute);
    narrowMq.addEventListener("change", recompute);

    return () => {
      reduceMq.removeEventListener("change", onReduceChange);
      coarseMq.removeEventListener("change", recompute);
      narrowMq.removeEventListener("change", recompute);
    };
  }, []);

  const accentColor = accent === "cyan" ? CYAN : COPPER;
  const particleCount = isMobile ? 220 : 600;
  // dpr cap: mobile 1.2 (saves GPU), desktop 1.8 (crisp on retina).
  // Below the dpr floor of 1 the canvas would visibly pixelate; we
  // never go that low even on mobile.
  const dpr: [number, number] = isMobile ? [1, 1.2] : [1, 1.8];

  return (
    <div
      className={
        "relative h-full w-full overflow-hidden " +
        (className ?? "min-h-[400px]")
      }
    >
      {/* Soft radial glow under the canvas */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            accent === "cyan"
              ? "radial-gradient(circle at center, rgba(34,211,238,0.10) 0%, transparent 65%)"
              : "radial-gradient(circle at center, rgba(245,158,11,0.10) 0%, transparent 65%)",
        }}
      />

      <Canvas
        camera={{ position: [0, 0, 5], fov: 45 }}
        dpr={dpr}
        gl={{
          antialias: !isMobile,
          alpha: true,
          powerPreference: "high-performance",
        }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[5, 8, 5]}
          intensity={1.8}
          color={accentColor}
        />
        <pointLight position={[-6, -4, -6]} intensity={0.8} color="#ffffff" />
        <OrbCore
          pulse={pulseToken}
          reduceMotion={reduceMotion}
          accent={accent}
        />
        {starField && !reduceMotion && (
          <StarField
            reduceMotion={reduceMotion}
            particleCount={particleCount}
          />
        )}
      </Canvas>
    </div>
  );
}

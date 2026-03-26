"use client";

import { useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";

/* ── Wireframe Icosahedron (outer, emerald) ── */
function OuterIcosahedron() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    ref.current.rotation.y += 0.001;
    ref.current.rotation.x += 0.0005;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[2.5, 1]} />
      <meshBasicMaterial wireframe color="#10B981" opacity={0.3} transparent />
    </mesh>
  );
}

/* ── Inner Icosahedron (smaller, cyan, counter-rotating) ── */
function InnerIcosahedron() {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    ref.current.rotation.y -= 0.0015;
    ref.current.rotation.x -= 0.0008;
  });
  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[1.8, 0]} />
      <meshBasicMaterial wireframe color="#00B7FF" opacity={0.15} transparent />
    </mesh>
  );
}

/* ── Particle Ring — 200 points on a sphere shell ── */
function ParticleRing() {
  const ref = useRef<THREE.Points>(null!);

  const [positions] = useState(() => {
    const count = 200;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Fibonacci sphere distribution, radius 4-6
      const t = i / count;
      const radius = 4 + Math.random() * 2;
      const phi = Math.acos(1 - 2 * t);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      pos[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = radius * Math.cos(phi);
    }
    return pos;
  });

  useFrame(() => {
    ref.current.rotation.y += 0.0003;
  });

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
          count={200}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#10B981" size={0.02} transparent opacity={0.5} sizeAttenuation />
    </points>
  );
}

/* ── Ambient glow sphere ── */
function AmbientGlow() {
  return (
    <mesh>
      <sphereGeometry args={[8, 16, 16]} />
      <meshBasicMaterial color="#10B981" opacity={0.02} transparent side={THREE.BackSide} />
    </mesh>
  );
}

/* ── Main exported scene ── */
export function HeroScene() {
  return (
    <div className="absolute inset-0 pointer-events-none z-0">
      <Canvas
        camera={{ position: [0, 0, 8], fov: 45 }}
        style={{ position: "absolute", inset: 0 }}
        gl={{ alpha: true, antialias: true }}
        dpr={[1, 1.5]}
      >
        <OuterIcosahedron />
        <InnerIcosahedron />
        <ParticleRing />
        <AmbientGlow />
      </Canvas>
    </div>
  );
}

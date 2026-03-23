"use client";

import { useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Upgraded particle system with multi-layer depth, cleaner cool-toned colors,
 * and orbital ring geometry for a premium $100M aesthetic.
 */

function CoreParticles() {
  const ref = useRef<THREE.Points>(null);
  const count = 3000;
  const [positions] = useState(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
       const u = Math.random();
       const v = Math.random();
       const theta = u * 2.0 * Math.PI;
       const phi = Math.acos(2.0 * v - 1.0);
       const r = Math.cbrt(Math.random()) * 2.2;
       p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
       p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
       p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  });

  const geomRef = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [positions]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta / 25;
      ref.current.rotation.x -= delta / 40;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial
        size={0.012}
        color="#60A5FA"
        transparent
        opacity={0.4}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function OuterHaze() {
  const ref = useRef<THREE.Points>(null);
  const count = 2000;
  const [positions] = useState(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
       const u = Math.random();
       const v = Math.random();
       const theta = u * 2.0 * Math.PI;
       const phi = Math.acos(2.0 * v - 1.0);
       const r = 2.5 + Math.random() * 2.0;
       p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
       p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
       p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  });

  const geomRef = useRef<THREE.BufferGeometry>(null);
  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [positions]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta / 50;
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial
        size={0.008}
        color="#818CF8"
        transparent
        opacity={0.15}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}

function OrbitalRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z += delta * 0.08;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[3.2, 0.004, 8, 128]} />
      <meshBasicMaterial 
        color="#60A5FA" 
        transparent 
        opacity={0.12} 
      />
    </mesh>
  );
}

function OrbitalRingSecondary() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.z -= delta * 0.06;
    }
  });

  return (
    <mesh ref={ref} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
      <torusGeometry args={[3.6, 0.003, 8, 128]} />
      <meshBasicMaterial 
        color="#34D399" 
        transparent 
        opacity={0.06} 
      />
    </mesh>
  );
}

export function ImmersiveNodeLayer() {
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
       {/* Depth fade overlays for premium blending */}
       <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black z-10" />
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_80%)] z-10 opacity-60" />
       
       <Canvas camera={{ position: [0, 0, 7], fov: 55 }}>
         <ambientLight intensity={0.3} />
         <OrbitalRing />
         <OrbitalRingSecondary />
         <CoreParticles />
         <OuterHaze />
       </Canvas>
    </div>
  );
}

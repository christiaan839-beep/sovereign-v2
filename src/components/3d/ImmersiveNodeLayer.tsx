"use client";

import { useRef, useEffect, useState, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/**
 * SOVEREIGN MATRIX — Enhanced Hero Background
 *
 * Features:
 * - 3000 core particles + 2000 outer haze with additive blending
 * - Bloom post-processing for cinematic glow
 * - Connection lines between nearby particles (neural network aesthetic)
 * - Mouse-reactive color shifting (blue → emerald near cursor)
 * - Scroll parallax (core 1x, haze 0.5x)
 * - Animated grid floor for depth
 * - Orbital ring geometry
 */

function useScrollY() {
  const scrollY = useRef(0);
  useEffect(() => {
    const handler = () => { scrollY.current = window.scrollY; };
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);
  return scrollY;
}

function useMouseNDC() {
  const mouse = useRef({ x: 0, y: 0 });
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handler);
    return () => window.removeEventListener("mousemove", handler);
  }, []);
  return mouse;
}

// ─── Core Particles with Mouse Color Reactivity ───
function CoreParticles({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const mouse = useMouseNDC();
  const count = 3000;

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = Math.cbrt(Math.random()) * 2.2;
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  const initColors = useMemo(() => {
    const c = new Float32Array(count * 3);
    const blue = new THREE.Color("#10B981");
    for (let i = 0; i < count; i++) {
      c[i * 3] = blue.r;
      c[i * 3 + 1] = blue.g;
      c[i * 3 + 2] = blue.b;
    }
    return c;
  }, []);

  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geomRef.current.setAttribute('color', new THREE.BufferAttribute(initColors.slice(), 3));
    }
  }, [positions, initColors]);

  const blue = useMemo(() => new THREE.Color("#10B981"), []);
  const emerald = useMemo(() => new THREE.Color("#34D399"), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const pv = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!ref.current || !geomRef.current) return;
    ref.current.rotation.y -= delta / 25;
    ref.current.rotation.x -= delta / 40;
    ref.current.position.y = -(scrollY.current * 0.0008);

    // Mouse-reactive colors
    const dir = new THREE.Vector3(mouse.current.x * 3, mouse.current.y * 3, 0)
      .unproject(camera).sub(camera.position).normalize();
    mouseWorld.copy(camera.position).add(dir.multiplyScalar(7));

    const colorAttr = geomRef.current.getAttribute('color') as THREE.BufferAttribute;
    const posAttr = geomRef.current.getAttribute('position') as THREE.BufferAttribute;
    if (!colorAttr || !posAttr) return;

    // Only update every 3rd frame for performance
    const frame = Math.round(performance.now() / 16);
    if (frame % 3 !== 0) return;

    for (let i = 0; i < count; i++) {
      pv.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
        .applyMatrix4(ref.current.matrixWorld);
      const dist = pv.distanceTo(mouseWorld);
      const influence = Math.max(0, 1 - dist / 2.5);
      tmp.copy(blue).lerp(emerald, influence * influence);
      colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.014} vertexColors transparent opacity={0.5} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Connection Lines ───
function ConnectionLines({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.LineSegments>(null);

  const linePositions = useMemo(() => {
    const nodeCount = 500;
    const maxDist = 0.55;
    const nodes = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = Math.cbrt(Math.random()) * 2.0;
      nodes[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      nodes[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      nodes[i * 3 + 2] = r * Math.cos(phi);
    }
    const lines: number[] = [];
    for (let i = 0; i < nodeCount && lines.length < 6000; i++) {
      for (let j = i + 1; j < nodeCount && lines.length < 6000; j++) {
        const dx = nodes[i * 3] - nodes[j * 3];
        const dy = nodes[i * 3 + 1] - nodes[j * 3 + 1];
        const dz = nodes[i * 3 + 2] - nodes[j * 3 + 2];
        if (dx * dx + dy * dy + dz * dz < maxDist * maxDist) {
          lines.push(nodes[i*3], nodes[i*3+1], nodes[i*3+2], nodes[j*3], nodes[j*3+1], nodes[j*3+2]);
        }
      }
    }
    return new Float32Array(lines);
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta / 25;
      ref.current.rotation.x -= delta / 40;
      ref.current.position.y = -(scrollY.current * 0.0008);
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        {/* @ts-expect-error — R3F declarative bufferAttribute type mismatch */}
        <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#10B981" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// ─── Outer Haze ───
function OuterHaze({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const count = 2000;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 2.5 + Math.random() * 2.0;
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  useEffect(() => {
    if (geomRef.current) geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  }, [positions]);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y += delta / 50;
      ref.current.position.y = -(scrollY.current * 0.0004);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.008} color="#34D399" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Orbital Rings ───
function OrbitalRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * 0.08; });
  return (
    <mesh ref={ref} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[3.2, 0.004, 8, 128]} />
      <meshBasicMaterial color="#10B981" transparent opacity={0.12} />
    </mesh>
  );
}

function OrbitalRingSecondary() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z -= d * 0.06; });
  return (
    <mesh ref={ref} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
      <torusGeometry args={[3.6, 0.003, 8, 128]} />
      <meshBasicMaterial color="#34D399" transparent opacity={0.06} />
    </mesh>
  );
}

// ─── Energy Pulse Rings ───
function EnergyPulse() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);
  const ring3 = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Each ring pulses outward on a staggered cycle
    [ring1, ring2, ring3].forEach((ref, i) => {
      if (!ref.current) return;
      const phase = (t * 0.4 + i * 2.1) % 6; // 6-second cycle
      const scale = 0.3 + phase * 0.7;
      const opacity = Math.max(0, 1 - phase / 6) * 0.15;
      ref.current.scale.set(scale, scale, scale);
      (ref.current.material as THREE.MeshBasicMaterial).opacity = opacity;
    });
  });

  return (
    <>
      {[ring1, ring2, ring3].map((ref, i) => (
        <mesh key={i} ref={ref} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.8, 0.008, 8, 96]} />
          <meshBasicMaterial color={i === 1 ? "#34D399" : "#10B981"} transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
        </mesh>
      ))}
    </>
  );
}

// ─── Flowing Data Stream Particles ───
function DataStreams() {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const count = 400;

  // Create particles along spiral paths
  const { positions, velocities } = useMemo(() => {
    const p = new Float32Array(count * 3);
    const v = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const r = 0.5 + Math.random() * 2.5;
      p[i * 3] = Math.cos(angle) * r;
      p[i * 3 + 1] = (Math.random() - 0.5) * 3;
      p[i * 3 + 2] = Math.sin(angle) * r;
      // Velocity: spiral inward
      const speed = 0.002 + Math.random() * 0.004;
      v[i * 3] = -Math.sin(angle) * speed;
      v[i * 3 + 1] = (Math.random() - 0.5) * speed * 0.5;
      v[i * 3 + 2] = Math.cos(angle) * speed;
    }
    return { positions: p, velocities: v };
  }, []);

  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    }
  }, [positions]);

  useFrame(() => {
    if (!geomRef.current) return;
    const posAttr = geomRef.current.getAttribute('position') as THREE.BufferAttribute;
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      arr[i * 3] += velocities[i * 3];
      arr[i * 3 + 1] += velocities[i * 3 + 1];
      arr[i * 3 + 2] += velocities[i * 3 + 2];

      // Reset particles that get too close to center
      const dist = Math.sqrt(arr[i * 3] ** 2 + arr[i * 3 + 2] ** 2);
      if (dist < 0.3 || dist > 4) {
        const angle = Math.random() * Math.PI * 2;
        const r = 2 + Math.random() * 1.5;
        arr[i * 3] = Math.cos(angle) * r;
        arr[i * 3 + 1] = (Math.random() - 0.5) * 3;
        arr[i * 3 + 2] = Math.sin(angle) * r;
      }
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.018} color="#6EE7B7" transparent opacity={0.3} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Grid Floor ───
function GridFloor({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0.06 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta * 0.3;
    if (ref.current) ref.current.position.y = -2.5 - scrollY.current * 0.0006;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <planeGeometry args={[20, 20, 1, 1]} />
      <shaderMaterial ref={matRef} transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime; uniform float uOpacity; varying vec2 vUv;
          void main() {
            vec2 uv = (vUv - 0.5) * 20.0; uv.y += uTime;
            float gx = abs(fract(uv.x) - 0.5) * 2.0;
            float gy = abs(fract(uv.y) - 0.5) * 2.0;
            float line = 1.0 - min(smoothstep(0.0, 0.06, gx), smoothstep(0.0, 0.06, gy));
            float fade = 1.0 - length(vUv - 0.5) * 1.8;
            gl_FragColor = vec4(0.063, 0.725, 0.506, line * clamp(fade, 0.0, 1.0) * uOpacity);
          }
        `}
      />
    </mesh>
  );
}

// ─── Scene ───
function Scene({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  return (
    <>
      <ambientLight intensity={0.3} />
      <OrbitalRing />
      <OrbitalRingSecondary />
      <EnergyPulse />
      <DataStreams />
      <ConnectionLines scrollY={scrollY} />
      <CoreParticles scrollY={scrollY} />
      <OuterHaze scrollY={scrollY} />
      <GridFloor scrollY={scrollY} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.15} luminanceSmoothing={0.9} intensity={0.6} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function ImmersiveNodeLayer() {
  const scrollY = useScrollY();
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-black z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_80%)] z-10 opacity-60" />
      <Canvas camera={{ position: [0, 0, 7], fov: 55 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene scrollY={scrollY} />
      </Canvas>
    </div>
  );
}

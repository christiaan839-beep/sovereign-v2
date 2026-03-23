"use client";

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/**
 * SOVEREIGN MATRIX — Clean Immersive Background
 * Inspired by NVIDIA's smooth, subtle WebGL aesthetics.
 *
 * - Smooth particle field (no flashing)
 * - Soft connection lines (neural mesh)
 * - Single gentle orbital ring
 * - Mouse-reactive glow (emerald shift)
 * - Scroll parallax
 * - Subtle grid floor
 * - Low bloom for cinematic depth
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

// ─── Core Particle Field ───
function ParticleField({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const mouse = useMouseNDC();
  const count = 2000;

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = Math.cbrt(Math.random()) * 3.0;
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  const initColors = useMemo(() => {
    const c = new Float32Array(count * 3);
    const base = new THREE.Color("#10B981");
    for (let i = 0; i < count; i++) {
      c[i * 3] = base.r;
      c[i * 3 + 1] = base.g;
      c[i * 3 + 2] = base.b;
    }
    return c;
  }, []);

  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geomRef.current.setAttribute('color', new THREE.BufferAttribute(initColors.slice(), 3));
    }
  }, [positions, initColors]);

  const baseColor = useMemo(() => new THREE.Color("#10B981"), []);
  const hoverColor = useMemo(() => new THREE.Color("#6EE7B7"), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const pv = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!ref.current || !geomRef.current) return;
    // Very slow rotation — smooth and clean
    ref.current.rotation.y -= delta * 0.02;
    ref.current.rotation.x -= delta * 0.01;
    ref.current.position.y = -(scrollY.current * 0.0006);

    // Mouse glow — update every 4th frame for performance
    const frame = Math.round(performance.now() / 16);
    if (frame % 4 !== 0) return;

    const dir = new THREE.Vector3(mouse.current.x * 3, mouse.current.y * 3, 0)
      .unproject(camera).sub(camera.position).normalize();
    mouseWorld.copy(camera.position).add(dir.multiplyScalar(7));

    const colorAttr = geomRef.current.getAttribute('color') as THREE.BufferAttribute;
    const posAttr = geomRef.current.getAttribute('position') as THREE.BufferAttribute;
    if (!colorAttr || !posAttr) return;

    for (let i = 0; i < count; i++) {
      pv.set(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
        .applyMatrix4(ref.current.matrixWorld);
      const dist = pv.distanceTo(mouseWorld);
      const influence = Math.max(0, 1 - dist / 3);
      tmp.copy(baseColor).lerp(hoverColor, influence * influence);
      colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.012} vertexColors transparent opacity={0.4} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Soft Connection Mesh ───
function ConnectionMesh({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.LineSegments>(null);

  const linePositions = useMemo(() => {
    const nodeCount = 300;
    const maxDist = 0.7;
    const nodes = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = Math.cbrt(Math.random()) * 2.5;
      nodes[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      nodes[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      nodes[i * 3 + 2] = r * Math.cos(phi);
    }
    const lines: number[] = [];
    for (let i = 0; i < nodeCount && lines.length < 3000; i++) {
      for (let j = i + 1; j < nodeCount && lines.length < 3000; j++) {
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
      ref.current.rotation.y -= delta * 0.02;
      ref.current.rotation.x -= delta * 0.01;
      ref.current.position.y = -(scrollY.current * 0.0006);
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        {/* @ts-expect-error — R3F declarative bufferAttribute type mismatch */}
        <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#10B981" transparent opacity={0.04} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// ─── Ambient Haze ───
function AmbientHaze({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const count = 800;

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 2.5;
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
      ref.current.rotation.y += delta * 0.008;
      ref.current.position.y = -(scrollY.current * 0.0003);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.006} color="#34D399" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Single Orbital Ring ───
function OrbitalRing() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, d) => { if (ref.current) ref.current.rotation.z += d * 0.03; });
  return (
    <mesh ref={ref} rotation={[Math.PI / 3, 0, 0]}>
      <torusGeometry args={[3.5, 0.003, 8, 160]} />
      <meshBasicMaterial color="#10B981" transparent opacity={0.08} depthWrite={false} />
    </mesh>
  );
}

// ─── Subtle Grid Floor ───
function GridFloor({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0.03 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta * 0.15;
    if (ref.current) ref.current.position.y = -3 - scrollY.current * 0.0004;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -3, 0]}>
      <planeGeometry args={[24, 24, 1, 1]} />
      <shaderMaterial ref={matRef} transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime; uniform float uOpacity; varying vec2 vUv;
          void main() {
            vec2 uv = (vUv - 0.5) * 24.0; uv.y += uTime;
            float gx = abs(fract(uv.x) - 0.5) * 2.0;
            float gy = abs(fract(uv.y) - 0.5) * 2.0;
            float line = 1.0 - min(smoothstep(0.0, 0.04, gx), smoothstep(0.0, 0.04, gy));
            float fade = 1.0 - length(vUv - 0.5) * 1.6;
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
      <ambientLight intensity={0.2} />
      <OrbitalRing />
      <ConnectionMesh scrollY={scrollY} />
      <ParticleField scrollY={scrollY} />
      <AmbientHaze scrollY={scrollY} />
      <GridFloor scrollY={scrollY} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.2} luminanceSmoothing={0.95} intensity={0.4} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function ImmersiveNodeLayer() {
  const scrollY = useScrollY();
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_75%)] z-10 opacity-50" />
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene scrollY={scrollY} />
      </Canvas>
    </div>
  );
}

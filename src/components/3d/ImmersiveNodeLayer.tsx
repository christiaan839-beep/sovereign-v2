"use client";

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/**
 * SOVEREIGN MATRIX — Glowing Immersive Background
 *
 * - Rich emerald particle field with color variation
 * - Glowing glass core sphere (frosted emerald)
 * - Two orbital rings (different angles, subtle glow)
 * - Neural connection mesh with higher visibility
 * - Mouse-reactive brightening
 * - Scroll parallax
 * - Grid floor with more presence
 * - Strong bloom for cinematic glow
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

// ─── Glowing Glass Core Sphere ───
function GlassCore() {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
  }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
    if (ref.current) ref.current.rotation.y += delta * 0.05;
  });

  return (
    <mesh ref={ref}>
      <icosahedronGeometry args={[0.8, 4]} />
      <shaderMaterial
        ref={matRef}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        uniforms={uniforms}
        vertexShader={`
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = position;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec3 vNormal;
          varying vec3 vPosition;
          void main() {
            // Fresnel edge glow
            float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
            // Emerald color with subtle pulse
            float pulse = 0.7 + 0.3 * sin(uTime * 0.8);
            vec3 emerald = vec3(0.063, 0.725, 0.506);
            vec3 bright = vec3(0.208, 0.91, 0.624);
            vec3 color = mix(emerald, bright, fresnel * pulse);
            // Glass-like transparency: edges glow, center is mostly clear
            float alpha = fresnel * 0.25 + 0.02;
            gl_FragColor = vec4(color, alpha);
          }
        `}
      />
    </mesh>
  );
}

// ─── Core Particle Field with Color Variation ───
function ParticleField({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const mouse = useMouseNDC();
  const count = 2500;

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = 0.5 + Math.cbrt(Math.random()) * 3.0;
      p[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      p[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      p[i * 3 + 2] = r * Math.cos(phi);
    }
    return p;
  }, []);

  // Color variation: mix of deep emerald, bright emerald, and teal
  const initColors = useMemo(() => {
    const c = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#10B981"), // emerald
      new THREE.Color("#34D399"), // light emerald
      new THREE.Color("#059669"), // deep emerald
      new THREE.Color("#0D9488"), // teal hint
      new THREE.Color("#6EE7B7"), // bright mint
    ];
    const tmp = new THREE.Color();
    for (let i = 0; i < count; i++) {
      const base = palette[Math.floor(Math.random() * palette.length)];
      tmp.copy(base);
      // Slight random brightness variation
      tmp.multiplyScalar(0.6 + Math.random() * 0.6);
      c[i * 3] = tmp.r;
      c[i * 3 + 1] = tmp.g;
      c[i * 3 + 2] = tmp.b;
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
  const hoverColor = useMemo(() => new THREE.Color("#A7F3D0"), []); // brighter on hover
  const tmp = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const pv = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!ref.current || !geomRef.current) return;
    ref.current.rotation.y -= delta * 0.025;
    ref.current.rotation.x -= delta * 0.012;
    ref.current.position.y = -(scrollY.current * 0.0006);

    const frame = Math.round(performance.now() / 16);
    if (frame % 3 !== 0) return;

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
      const influence = Math.max(0, 1 - dist / 2.5);
      if (influence > 0.01) {
        // Brighten particles near mouse
        tmp.set(initColors[i * 3], initColors[i * 3 + 1], initColors[i * 3 + 2]);
        tmp.lerp(hoverColor, influence * influence);
        colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
      }
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.015} vertexColors transparent opacity={0.55} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Neural Connection Mesh ───
function ConnectionMesh({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.LineSegments>(null);

  const linePositions = useMemo(() => {
    const nodeCount = 400;
    const maxDist = 0.6;
    const nodes = new Float32Array(nodeCount * 3);
    for (let i = 0; i < nodeCount; i++) {
      const theta = Math.random() * 2.0 * Math.PI;
      const phi = Math.acos(2.0 * Math.random() - 1.0);
      const r = Math.cbrt(Math.random()) * 2.8;
      nodes[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      nodes[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      nodes[i * 3 + 2] = r * Math.cos(phi);
    }
    const lines: number[] = [];
    for (let i = 0; i < nodeCount && lines.length < 4500; i++) {
      for (let j = i + 1; j < nodeCount && lines.length < 4500; j++) {
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
      ref.current.rotation.y -= delta * 0.025;
      ref.current.rotation.x -= delta * 0.012;
      ref.current.position.y = -(scrollY.current * 0.0006);
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        {/* @ts-expect-error — R3F declarative bufferAttribute type mismatch */}
        <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#10B981" transparent opacity={0.07} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// ─── Ambient Outer Glow ───
function AmbientHaze({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const count = 1200;

  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * 2 * Math.PI;
      const phi = Math.acos(2 * Math.random() - 1);
      const r = 3 + Math.random() * 3;
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
      ref.current.rotation.y += delta * 0.01;
      ref.current.position.y = -(scrollY.current * 0.0003);
    }
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.008} color="#34D399" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Two Orbital Rings ───
function OrbitalRings() {
  const ring1 = useRef<THREE.Mesh>(null);
  const ring2 = useRef<THREE.Mesh>(null);

  useFrame((_, d) => {
    if (ring1.current) ring1.current.rotation.z += d * 0.04;
    if (ring2.current) ring2.current.rotation.z -= d * 0.025;
  });

  return (
    <>
      <mesh ref={ring1} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3.2, 0.004, 8, 160]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.15} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
        <torusGeometry args={[3.8, 0.003, 8, 160]} />
        <meshBasicMaterial color="#34D399" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

// ─── Grid Floor ───
function GridFloor({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 }, uOpacity: { value: 0.05 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta * 0.2;
    if (ref.current) ref.current.position.y = -2.8 - scrollY.current * 0.0004;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.8, 0]}>
      <planeGeometry args={[24, 24, 1, 1]} />
      <shaderMaterial ref={matRef} transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime; uniform float uOpacity; varying vec2 vUv;
          void main() {
            vec2 uv = (vUv - 0.5) * 24.0; uv.y += uTime;
            float gx = abs(fract(uv.x) - 0.5) * 2.0;
            float gy = abs(fract(uv.y) - 0.5) * 2.0;
            float line = 1.0 - min(smoothstep(0.0, 0.05, gx), smoothstep(0.0, 0.05, gy));
            float fade = 1.0 - length(vUv - 0.5) * 1.5;
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
      <ambientLight intensity={0.15} />
      <GlassCore />
      <OrbitalRings />
      <ConnectionMesh scrollY={scrollY} />
      <ParticleField scrollY={scrollY} />
      <AmbientHaze scrollY={scrollY} />
      <GridFloor scrollY={scrollY} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.1} luminanceSmoothing={0.9} intensity={0.8} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function ImmersiveNodeLayer() {
  const scrollY = useScrollY();
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_70%)] z-10 opacity-40" />
      <Canvas camera={{ position: [0, 0, 8], fov: 50 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene scrollY={scrollY} />
      </Canvas>
    </div>
  );
}

"use client";

import { useRef, useEffect, useMemo } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

/**
 * SOVEREIGN MATRIX — Circuit Matrix Background
 * Inspired by the hexagonal S logo with circuit board traces.
 *
 * - Circuit grid floor with pulsing data lines
 * - Hexagonal node network (not random spherical particles)
 * - Glowing connection lines between hex nodes
 * - Central glowing hexagonal core
 * - Floating data motes along circuit paths
 * - Deep emerald neon on pure black
 * - Mouse-reactive node brightening
 * - Smooth, instant, no flash
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

// ─── Hexagonal Core Structure ───
function HexCore() {
  const groupRef = useRef<THREE.Group>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.08;
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
  });

  // Create hexagonal wireframe geometry
  const hexEdges = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(1.2, 1);
    return new THREE.EdgesGeometry(geo);
  }, []);

  return (
    <group ref={groupRef}>
      {/* Outer hex wireframe */}
      <lineSegments geometry={hexEdges}>
        <shaderMaterial
          ref={matRef}
          transparent
          depthWrite={false}
          blending={THREE.AdditiveBlending}
          uniforms={uniforms}
          vertexShader={`
            varying vec3 vPos;
            void main() {
              vPos = position;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            varying vec3 vPos;
            void main() {
              float pulse = 0.6 + 0.4 * sin(uTime * 0.5 + vPos.y * 3.0);
              vec3 emerald = vec3(0.063, 0.725, 0.506);
              vec3 bright = vec3(0.431, 0.953, 0.733);
              vec3 color = mix(emerald, bright, pulse * 0.5);
              gl_FragColor = vec4(color, 0.4 * pulse);
            }
          `}
        />
      </lineSegments>

      {/* Inner glow sphere */}
      <mesh>
        <icosahedronGeometry args={[0.6, 2]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.08} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>

      {/* Core point light effect — brighter */}
      <mesh>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color="#6EE7B7" transparent opacity={1.0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </group>
  );
}

// ─── Circuit Node Network (hex grid in 3D space) ───
function CircuitNodes({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Points>(null);
  const geomRef = useRef<THREE.BufferGeometry>(null);
  const mouse = useMouseNDC();

  // Place nodes on a hex-inspired lattice, not random sphere
  const { positions, count } = useMemo(() => {
    const nodes: number[] = [];
    const spacing = 0.8;
    for (let layer = -3; layer <= 3; layer++) {
      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const x = col * spacing + (row % 2) * spacing * 0.5;
          const y = layer * spacing * 0.9;
          const z = row * spacing * 0.866;
          const dist = Math.sqrt(x * x + y * y + z * z);
          // Only keep nodes within a sphere, skip center (hex core lives there)
          if (dist > 1.5 && dist < 4.0) {
            // Slight random offset for organic feel
            nodes.push(
              x + (Math.random() - 0.5) * 0.15,
              y + (Math.random() - 0.5) * 0.15,
              z + (Math.random() - 0.5) * 0.15
            );
          }
        }
      }
    }
    return { positions: new Float32Array(nodes), count: nodes.length / 3 };
  }, []);

  const initColors = useMemo(() => {
    const c = new Float32Array(count * 3);
    const palette = [
      new THREE.Color("#10B981"),
      new THREE.Color("#059669"),
      new THREE.Color("#34D399"),
      new THREE.Color("#0D9488"),
    ];
    for (let i = 0; i < count; i++) {
      const col = palette[Math.floor(Math.random() * palette.length)];
      const brightness = 0.5 + Math.random() * 0.5;
      c[i * 3] = col.r * brightness;
      c[i * 3 + 1] = col.g * brightness;
      c[i * 3 + 2] = col.b * brightness;
    }
    return c;
  }, [count]);

  useEffect(() => {
    if (geomRef.current) {
      geomRef.current.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geomRef.current.setAttribute('color', new THREE.BufferAttribute(initColors.slice(), 3));
    }
  }, [positions, initColors]);

  const hoverColor = useMemo(() => new THREE.Color("#A7F3D0"), []);
  const tmp = useMemo(() => new THREE.Color(), []);
  const mouseWorld = useMemo(() => new THREE.Vector3(), []);
  const pv = useMemo(() => new THREE.Vector3(), []);
  const { camera } = useThree();

  useFrame((_, delta) => {
    if (!ref.current || !geomRef.current) return;
    ref.current.rotation.y -= delta * 0.015;
    ref.current.position.y = -(scrollY.current * 0.0005);

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
      tmp.set(initColors[i * 3], initColors[i * 3 + 1], initColors[i * 3 + 2]);
      if (influence > 0.01) {
        tmp.lerp(hoverColor, influence * influence * 0.8);
      }
      colorAttr.setXYZ(i, tmp.r, tmp.g, tmp.b);
    }
    colorAttr.needsUpdate = true;
  });

  return (
    <points ref={ref}>
      <bufferGeometry ref={geomRef} />
      <pointsMaterial size={0.03} vertexColors transparent opacity={0.85} depthWrite={false} blending={THREE.AdditiveBlending} />
    </points>
  );
}

// ─── Circuit Trace Lines (connecting nearby hex nodes) ───
function CircuitTraces({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.LineSegments>(null);

  const linePositions = useMemo(() => {
    const spacing = 0.8;
    const nodes: [number, number, number][] = [];
    for (let layer = -3; layer <= 3; layer++) {
      for (let row = -4; row <= 4; row++) {
        for (let col = -4; col <= 4; col++) {
          const x = col * spacing + (row % 2) * spacing * 0.5;
          const y = layer * spacing * 0.9;
          const z = row * spacing * 0.866;
          const dist = Math.sqrt(x * x + y * y + z * z);
          if (dist > 1.5 && dist < 4.0) {
            nodes.push([
              x + (Math.random() - 0.5) * 0.08,
              y + (Math.random() - 0.5) * 0.08,
              z + (Math.random() - 0.5) * 0.08
            ]);
          }
        }
      }
    }

    const lines: number[] = [];
    const maxDist = 1.0;
    for (let i = 0; i < nodes.length && lines.length < 9000; i++) {
      for (let j = i + 1; j < nodes.length && lines.length < 9000; j++) {
        const dx = nodes[i][0] - nodes[j][0];
        const dy = nodes[i][1] - nodes[j][1];
        const dz = nodes[i][2] - nodes[j][2];
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < maxDist * maxDist && d2 > 0.3 * 0.3) {
          lines.push(...nodes[i], ...nodes[j]);
        }
      }
    }
    return new Float32Array(lines);
  }, []);

  useFrame((_, delta) => {
    if (ref.current) {
      ref.current.rotation.y -= delta * 0.015;
      ref.current.position.y = -(scrollY.current * 0.0005);
    }
  });

  return (
    <lineSegments ref={ref}>
      <bufferGeometry>
        {/* @ts-expect-error — R3F declarative bufferAttribute type mismatch */}
        <bufferAttribute attach="attributes-position" count={linePositions.length / 3} array={linePositions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color="#10B981" transparent opacity={0.12} depthWrite={false} blending={THREE.AdditiveBlending} />
    </lineSegments>
  );
}

// ─── Orbital Rings ───
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
        <torusGeometry args={[3.2, 0.005, 8, 160]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.18} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
      <mesh ref={ring2} rotation={[Math.PI / 5, Math.PI / 4, 0]}>
        <torusGeometry args={[3.8, 0.003, 8, 160]} />
        <meshBasicMaterial color="#34D399" transparent opacity={0.1} depthWrite={false} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
}

// ─── Circuit Grid Floor ───
function CircuitFloor({ scrollY }: { scrollY: React.MutableRefObject<number> }) {
  const ref = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((_, delta) => {
    if (matRef.current) matRef.current.uniforms.uTime.value += delta;
    if (ref.current) ref.current.position.y = -2.5 - scrollY.current * 0.0004;
  });

  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, -2.5, 0]}>
      <planeGeometry args={[30, 30, 1, 1]} />
      <shaderMaterial ref={matRef} transparent depthWrite={false} uniforms={uniforms}
        vertexShader={`varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          void main() {
            vec2 uv = (vUv - 0.5) * 30.0;

            // Main grid
            float gx = abs(fract(uv.x) - 0.5) * 2.0;
            float gy = abs(fract(uv.y + uTime * 0.3) - 0.5) * 2.0;
            float grid = 1.0 - min(smoothstep(0.0, 0.04, gx), smoothstep(0.0, 0.04, gy));

            // Sub-grid (circuit detail)
            float sgx = abs(fract(uv.x * 4.0) - 0.5) * 2.0;
            float sgy = abs(fract((uv.y + uTime * 0.3) * 4.0) - 0.5) * 2.0;
            float subgrid = 1.0 - min(smoothstep(0.0, 0.15, sgx), smoothstep(0.0, 0.15, sgy));

            // Pulse lines (data flowing through circuits)
            float pulse1 = smoothstep(0.48, 0.5, fract(uv.y * 0.5 + uTime * 0.8)) *
                           smoothstep(0.52, 0.5, fract(uv.y * 0.5 + uTime * 0.8));
            float pulse2 = smoothstep(0.48, 0.5, fract(uv.x * 0.3 + uTime * 0.5)) *
                           smoothstep(0.52, 0.5, fract(uv.x * 0.3 + uTime * 0.5));

            // Fade from center
            float fade = 1.0 - length(vUv - 0.5) * 1.4;
            fade = clamp(fade, 0.0, 1.0);

            // Combine
            float alpha = (grid * 0.1 + subgrid * 0.025 + (pulse1 + pulse2) * 0.15) * fade;
            vec3 color = vec3(0.063, 0.725, 0.506);

            gl_FragColor = vec4(color, alpha);
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
      <ambientLight intensity={0.1} />
      <HexCore />
      <OrbitalRings />
      <CircuitTraces scrollY={scrollY} />
      <CircuitNodes scrollY={scrollY} />
      <CircuitFloor scrollY={scrollY} />
      <EffectComposer>
        <Bloom luminanceThreshold={0.05} luminanceSmoothing={0.85} intensity={1.4} mipmapBlur />
      </EffectComposer>
    </>
  );
}

export function ImmersiveNodeLayer() {
  const scrollY = useScrollY();
  return (
    <div className="absolute inset-0 z-0 pointer-events-none">
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/80 z-10" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,black_70%)] z-10 opacity-25" />
      <Canvas camera={{ position: [0, 0.5, 7], fov: 52 }} gl={{ antialias: true, alpha: true }} dpr={[1, 1.5]}>
        <Scene scrollY={scrollY} />
      </Canvas>
    </div>
  );
}

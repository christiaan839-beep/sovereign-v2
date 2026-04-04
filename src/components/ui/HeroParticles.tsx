"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 600;
const CONNECTION_DISTANCE = 2.5;
const MAX_CONNECTIONS = 100;

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const linesRef = useRef<THREE.LineSegments>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 18,
        y: (Math.random() - 0.5) * 10,
        z: (Math.random() - 0.5) * 6,
        ox: 0, oy: 0, oz: 0,
        speed: 0.002 + Math.random() * 0.004,
        scale: 0.015 + Math.random() * 0.035,
      });
    }
    temp.forEach(p => { p.ox = p.x; p.oy = p.y; p.oz = p.z; });
    return temp;
  }, []);

  // Line geometry for connections
  const linePositions = useMemo(() => new Float32Array(MAX_CONNECTIONS * 6), []);
  const lineColors = useMemo(() => new Float32Array(MAX_CONNECTIONS * 6), []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame((state) => {
    if (!mesh.current) return;
    const time = state.clock.elapsedTime;
    const mx = mouse.current.x * viewport.width * 0.5;
    const my = mouse.current.y * viewport.height * 0.5;

    // Update particle positions
    particles.forEach((p, i) => {
      p.x = p.ox + Math.sin(time * p.speed * 50 + i) * 0.3;
      p.y = p.oy + Math.cos(time * p.speed * 30 + i * 0.5) * 0.2;
      p.z = p.oz + Math.sin(time * p.speed * 20 + i * 0.3) * 0.15;

      // Mouse repulsion
      const dx = p.x - mx;
      const dy = p.y - my;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 3) {
        const force = (3 - dist) / 3 * 0.8;
        p.x += dx * force * 0.05;
        p.y += dy * force * 0.05;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(i, dummy.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;

    // Update connection lines (check subset for performance)
    if (linesRef.current) {
      let lineIdx = 0;
      const step = Math.max(1, Math.floor(PARTICLE_COUNT / 80));

      for (let i = 0; i < PARTICLE_COUNT && lineIdx < MAX_CONNECTIONS; i += step) {
        for (let j = i + step; j < PARTICLE_COUNT && lineIdx < MAX_CONNECTIONS; j += step) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dz = particles[i].z - particles[j].z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < CONNECTION_DISTANCE) {
            const opacity = 1 - dist / CONNECTION_DISTANCE;
            const idx = lineIdx * 6;
            /* eslint-disable react-hooks/immutability -- WebGL Float32Array buffer mutation is intentional */
            linePositions[idx] = particles[i].x;
            linePositions[idx + 1] = particles[i].y;
            linePositions[idx + 2] = particles[i].z;
            linePositions[idx + 3] = particles[j].x;
            linePositions[idx + 4] = particles[j].y;
            linePositions[idx + 5] = particles[j].z;

            // Emerald color with distance-based opacity
            const g = 0.73 * opacity;
            const r = 0.06 * opacity;
            const b = 0.51 * opacity;
            lineColors[idx] = r;
            lineColors[idx + 1] = g;
            lineColors[idx + 2] = b;
            lineColors[idx + 3] = r;
            lineColors[idx + 4] = g;
            lineColors[idx + 5] = b;

            /* eslint-enable react-hooks/immutability */
            lineIdx++;
          }
        }
      }

      // Zero out unused lines
       
      for (let i = lineIdx * 6; i < MAX_CONNECTIONS * 6; i++) {
        linePositions[i] = 0;
        lineColors[i] = 0;
      }
       

      linesRef.current.geometry.attributes.position.needsUpdate = true;
      linesRef.current.geometry.attributes.color.needsUpdate = true;
    }
  });

  return (
    <>
      <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
        <sphereGeometry args={[1, 6, 6]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.5} />
      </instancedMesh>

      <lineSegments ref={linesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[linePositions, 3]}
          />
          <bufferAttribute
            attach="attributes-color"
            args={[lineColors, 3]}
          />
        </bufferGeometry>
        <lineBasicMaterial vertexColors transparent opacity={0.3} />
      </lineSegments>
    </>
  );
}

export function HeroParticles() {
  return (
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
      <Canvas
        camera={{ position: [0, 0, 8], fov: 60 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, alpha: true, powerPreference: "high-performance" }}
        style={{ background: "transparent" }}
      >
        <Particles />
      </Canvas>
    </div>
  );
}

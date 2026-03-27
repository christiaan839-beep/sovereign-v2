"use client";

import { useRef, useMemo, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

const PARTICLE_COUNT = 800;

function Particles() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const { viewport } = useThree();

  const particles = useMemo(() => {
    const temp = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      temp.push({
        x: (Math.random() - 0.5) * 20,
        y: (Math.random() - 0.5) * 12,
        z: (Math.random() - 0.5) * 8,
        ox: 0, oy: 0, oz: 0,
        speed: 0.002 + Math.random() * 0.005,
        scale: 0.02 + Math.random() * 0.04,
      });
    }
    // Store original positions
    temp.forEach(p => { p.ox = p.x; p.oy = p.y; p.oz = p.z; });
    return temp;
  }, []);

  // Track mouse
  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, []);

  const dummy = useMemo(() => new THREE.Object3D(), []);
  const color = useMemo(() => new THREE.Color("#10B981"), []);

  useFrame((state) => {
    if (!mesh.current) return;
    const time = state.clock.elapsedTime;
    const mx = mouse.current.x * viewport.width * 0.5;
    const my = mouse.current.y * viewport.height * 0.5;

    particles.forEach((p, i) => {
      // Gentle float
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
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, PARTICLE_COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.4} />
    </instancedMesh>
  );
}

function ConnectionLines() {
  const ref = useRef<THREE.LineSegments>(null);
  const positions = useMemo(() => new Float32Array(PARTICLE_COUNT * 6), []);

  useFrame(() => {
    // Lines are handled by the particle drift — keeping this minimal for performance
    if (ref.current) {
      ref.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return null; // Connection lines disabled for performance — particles alone look great
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

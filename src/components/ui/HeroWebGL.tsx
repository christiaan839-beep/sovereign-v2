"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * HeroWebGL — Cinematic 3D background inspired by the Sovereign Matrix
 * holographic cube logo. Features:
 *
 * 1. Rotating wireframe hexagonal geometry (the "S cube")
 * 2. Emerald circuit board grid lines
 * 3. Floating particle field with depth
 * 4. Volumetric glow and bloom effect
 * 5. Mouse-reactive camera parallax
 *
 * Renders at device pixel ratio for HD/4K sharpness.
 */

export function HeroWebGL() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // ─── Scene Setup ─────────────────────────────────────
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x010101, 0.08);

    const camera = new THREE.PerspectiveCamera(60, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(0, 0, 5);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    container.appendChild(renderer.domElement);

    // ─── Colors ──────────────────────────────────────────
    const EMERALD = new THREE.Color(0x10b981);
    const EMERALD_DIM = new THREE.Color(0x059669);
    const CYAN = new THREE.Color(0x06b6d4);

    // ─── Central Hexagonal Wireframe (the "cube") ────────
    const hexGeometry = new THREE.IcosahedronGeometry(1.8, 1);
    const hexWireframe = new THREE.LineSegments(
      new THREE.WireframeGeometry(hexGeometry),
      new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.15 })
    );
    scene.add(hexWireframe);

    // Inner icosahedron
    const innerGeo = new THREE.IcosahedronGeometry(1.0, 0);
    const innerWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(innerGeo),
      new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.25 })
    );
    scene.add(innerWire);

    // Core icosahedron
    const coreGeo = new THREE.IcosahedronGeometry(0.5, 0);
    const coreWire = new THREE.LineSegments(
      new THREE.WireframeGeometry(coreGeo),
      new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.3 })
    );
    scene.add(coreWire);

    // ─── Central Glow Sphere ─────────────────────────────
    const glowGeo = new THREE.SphereGeometry(0.3, 32, 32);
    const glowMat = new THREE.MeshBasicMaterial({
      color: EMERALD,
      transparent: true,
      opacity: 0.08,
    });
    const glowSphere = new THREE.Mesh(glowGeo, glowMat);
    scene.add(glowSphere);

    // ─── Circuit Grid Lines ──────────────────────────────
    const gridGroup = new THREE.Group();
    const gridMat = new THREE.LineBasicMaterial({ color: EMERALD_DIM, transparent: true, opacity: 0.06 });

    // Horizontal lines
    for (let i = -8; i <= 8; i++) {
      const points = [new THREE.Vector3(-12, i * 0.8, -3), new THREE.Vector3(12, i * 0.8, -3)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }
    // Vertical lines
    for (let i = -15; i <= 15; i++) {
      const points = [new THREE.Vector3(i * 0.8, -8, -3), new THREE.Vector3(i * 0.8, 8, -3)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, gridMat));
    }
    scene.add(gridGroup);

    // ─── Diagonal Circuit Traces ─────────────────────────
    const traceMat = new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.04 });
    for (let i = 0; i < 12; i++) {
      const x1 = (Math.random() - 0.5) * 16;
      const y1 = (Math.random() - 0.5) * 10;
      const x2 = x1 + (Math.random() - 0.5) * 4;
      const y2 = y1 + (Math.random() - 0.5) * 4;
      // L-shaped circuit trace
      const points = [
        new THREE.Vector3(x1, y1, -2.5),
        new THREE.Vector3(x2, y1, -2.5),
        new THREE.Vector3(x2, y2, -2.5),
      ];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      gridGroup.add(new THREE.Line(geo, traceMat));
    }

    // ─── Floating Particles ──────────────────────────────
    const particleCount = 300;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleSizes = new Float32Array(particleCount);
    const particleColors = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 20;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 14;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
      particleSizes[i] = Math.random() * 3 + 0.5;

      // Mix of emerald and cyan particles
      if (Math.random() > 0.3) {
        particleColors[i * 3] = 0.063;     // R
        particleColors[i * 3 + 1] = 0.725; // G
        particleColors[i * 3 + 2] = 0.506; // B
      } else {
        particleColors[i * 3] = 0.024;
        particleColors[i * 3 + 1] = 0.714;
        particleColors[i * 3 + 2] = 0.831;
      }
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    particleGeo.setAttribute("size", new THREE.BufferAttribute(particleSizes, 1));
    particleGeo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.03,
      transparent: true,
      opacity: 0.6,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // ─── Floating Hexagon Nodes ──────────────────────────
    const nodeGroup = new THREE.Group();
    const nodeMat = new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.12 });

    for (let i = 0; i < 8; i++) {
      const hexShape = new THREE.CircleGeometry(0.15 + Math.random() * 0.15, 6);
      const hexEdges = new THREE.EdgesGeometry(hexShape);
      const hexLine = new THREE.LineSegments(hexEdges, nodeMat.clone());
      hexLine.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 7,
        (Math.random() - 0.5) * 4 - 1
      );
      hexLine.userData.speed = 0.2 + Math.random() * 0.5;
      hexLine.userData.offset = Math.random() * Math.PI * 2;
      nodeGroup.add(hexLine);
    }
    scene.add(nodeGroup);

    // ─── Connection Lines Between Nodes ────────────────────
    const connectionGroup = new THREE.Group();
    const connMat = new THREE.LineBasicMaterial({ color: EMERALD, transparent: true, opacity: 0.06 });
    const nodes = nodeGroup.children;
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const dist = nodes[i].position.distanceTo(nodes[j].position);
        if (dist < 6) {
          const points = [nodes[i].position.clone(), nodes[j].position.clone()];
          const geo = new THREE.BufferGeometry().setFromPoints(points);
          connectionGroup.add(new THREE.Line(geo, connMat.clone()));
        }
      }
    }
    scene.add(connectionGroup);

    // ─── Pulsing Energy Rings ────────────────────────────
    const ringGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ringGeo = new THREE.RingGeometry(2.2 + i * 0.8, 2.25 + i * 0.8, 64);
      const ringMat = new THREE.MeshBasicMaterial({
        color: i === 1 ? CYAN : EMERALD,
        transparent: true,
        opacity: 0.04,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.userData.speed = 0.3 + i * 0.15;
      ring.userData.axis = i;
      ringGroup.add(ring);
    }
    scene.add(ringGroup);

    // ─── Mouse Tracking ──────────────────────────────────
    const onMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = (e.clientX / window.innerWidth - 0.5) * 2;
      mouseRef.current.y = (e.clientY / window.innerHeight - 0.5) * 2;
    };
    window.addEventListener("mousemove", onMouseMove);

    // ─── Animation Loop ──────────────────────────────────
    let frame = 0;
    const clock = new THREE.Clock();

    function animate() {
      frame = requestAnimationFrame(animate);
      const t = clock.getElapsedTime();

      // Rotate central geometry
      hexWireframe.rotation.x = t * 0.08;
      hexWireframe.rotation.y = t * 0.12;
      innerWire.rotation.x = -t * 0.15;
      innerWire.rotation.y = t * 0.1;
      coreWire.rotation.x = t * 0.25;
      coreWire.rotation.z = t * 0.2;

      // Pulse the glow
      glowSphere.scale.setScalar(1 + Math.sin(t * 2) * 0.15);
      (glowMat as THREE.MeshBasicMaterial).opacity = 0.05 + Math.sin(t * 1.5) * 0.03;

      // Animate floating hex nodes
      nodeGroup.children.forEach((node) => {
        const s = node.userData.speed;
        const o = node.userData.offset;
        node.position.y += Math.sin(t * s + o) * 0.001;
        node.rotation.z = t * s * 0.3;
      });

      // Animate energy rings
      ringGroup.children.forEach((ring, i) => {
        const s = ring.userData.speed;
        if (i === 0) ring.rotation.x = t * s;
        else if (i === 1) ring.rotation.y = t * s;
        else ring.rotation.z = t * s;
        (ring as THREE.Mesh).material && ((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity !== undefined &&
          (((ring as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.03 + Math.sin(t * 1.5 + i) * 0.02);
      });

      // Update connection line opacity
      connectionGroup.children.forEach((line, i) => {
        ((line as THREE.Line).material as THREE.LineBasicMaterial).opacity = 0.04 + Math.sin(t * 0.8 + i * 0.5) * 0.03;
      });

      // Drift particles
      const pos = particles.geometry.attributes.position;
      for (let i = 0; i < particleCount; i++) {
        const idx = i * 3 + 1;
        (pos.array as Float32Array)[idx] += Math.sin(t * 0.3 + i) * 0.0005;
      }
      pos.needsUpdate = true;

      // Mouse parallax camera
      const targetX = mouseRef.current.x * 0.3;
      const targetY = -mouseRef.current.y * 0.3;
      camera.position.x += (targetX - camera.position.x) * 0.02;
      camera.position.y += (targetY - camera.position.y) * 0.02;
      camera.lookAt(0, 0, 0);

      renderer.render(scene, camera);
    }
    animate();

    // ─── Resize Handler ──────────────────────────────────
    const onResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };
    window.addEventListener("resize", onResize);

    // ─── Cleanup — dispose ALL GPU resources ──────────────
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("resize", onResize);

      // Traverse scene and dispose all geometries + materials
      scene.traverse((obj) => {
        if ("geometry" in obj && obj.geometry) {
          (obj.geometry as THREE.BufferGeometry).dispose();
        }
        if ("material" in obj && obj.material) {
          const mat = obj.material;
          if (Array.isArray(mat)) {
            mat.forEach((m: THREE.Material) => m.dispose());
          } else {
            (mat as THREE.Material).dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none"
      style={{ zIndex: 0 }}
    />
  );
}

"use client";

import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Sphere, MeshDistortMaterial } from '@react-three/drei';
import * as THREE from 'three';

function AgentCore({ isSpeaking }: { isSpeaking: boolean }) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const meshRef = useRef<any>(null);
  
  useFrame((state) => {
    if (meshRef.current) {
      // Organic floating rotation
      meshRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.2;
      meshRef.current.rotation.y += 0.01;
      
      // Pulse scale if speaking
      const baseScale = 1;
      const speakPulse = isSpeaking ? Math.sin(state.clock.elapsedTime * 15) * 0.1 : 0;
      const newScale = baseScale + speakPulse;
      meshRef.current.scale.set(newScale, newScale, newScale);
    }
  });

  return (
    <Sphere ref={meshRef} args={[1.5, 64, 64]}>
      <MeshDistortMaterial
        color="#00ff66"
        attach="material"
        distort={isSpeaking ? 0.6 : 0.2}
        speed={isSpeaking ? 5 : 1}
        roughness={0.2}
        metalness={0.8}
        wireframe={true}
      />
    </Sphere>
  );
}

export function HolographicAgent({ isSpeaking = false }: { isSpeaking?: boolean }) {
  return (
    <div className="w-full h-full min-h-[400px] relative rounded-2xl overflow-hidden bg-black/50 border border-[#00ff66]/20">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,#00ff6610_0%,transparent_100%)] pointer-events-none" />
      <Canvas camera={{ position: [0, 0, 5] }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 10]} intensity={2} color="#00ff66" />
        <pointLight position={[-10, -10, -10]} intensity={1} color="#ffffff" />
        
        <AgentCore isSpeaking={isSpeaking} />
        
        <OrbitControls 
          enableZoom={false} 
          enablePan={false} 
          autoRotate 
          autoRotateSpeed={0.5} 
          maxPolarAngle={Math.PI / 2 + 0.2}
          minPolarAngle={Math.PI / 2 - 0.2}
        />
      </Canvas>
      
      {/* Cyberpunk Telemetry Overlay */}
      <div className="absolute top-4 left-4 font-mono text-[10px] text-[#00ff66] flex flex-col gap-1">
        <p>SYS.AUDIO2FACE_RELAY: {isSpeaking ? 'ACTIVE' : 'STANDBY'}</p>
        <p>TENSOR_LATENCY: 14ms</p>
        <p>LIPSYNC_CONFIDENCE: 99.8%</p>
      </div>
    </div>
  );
}

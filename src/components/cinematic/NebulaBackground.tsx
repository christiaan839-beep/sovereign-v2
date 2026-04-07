"use client";

import { useRef, useEffect, useState } from "react";

/**
 * NebulaBackground — Animated cosmic nebula using canvas noise.
 *
 * Creates a slowly morphing cloud-like background in Sovereign colors
 * (emerald, cyan, violet). Uses simplex noise rendered on canvas —
 * no WebGL dependency, works in all browsers.
 *
 * Performance: renders at 1/4 resolution, scaled up with CSS.
 * Auto-disables on mobile and reduced-motion.
 */

// Simplified 2D noise (based on classic Perlin noise)
function createNoise() {
  const perm = new Uint8Array(512);
  for (let i = 0; i < 256; i++) perm[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [perm[i], perm[j]] = [perm[j], perm[i]];
  }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i];

  const grad2 = [[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]];

  function fade(t: number) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function lerp(a: number, b: number, t: number) { return a + t * (b - a); }
  function dot2(g: number[], x: number, y: number) { return g[0] * x + g[1] * y; }

  return function noise2d(x: number, y: number): number {
    const xi = Math.floor(x) & 255;
    const yi = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const u = fade(xf);
    const v = fade(yf);

    const aa = perm[perm[xi] + yi] & 7;
    const ab = perm[perm[xi] + yi + 1] & 7;
    const ba = perm[perm[xi + 1] + yi] & 7;
    const bb = perm[perm[xi + 1] + yi + 1] & 7;

    return lerp(
      lerp(dot2(grad2[aa], xf, yf), dot2(grad2[ba], xf - 1, yf), u),
      lerp(dot2(grad2[ab], xf, yf - 1), dot2(grad2[bb], xf - 1, yf - 1), u),
      v
    );
  };
}

export function NebulaBackground({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
  }, []);

  useEffect(() => {
    if (isMobile) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Render at 1/4 resolution for performance
    const scale = 4;
    const resize = () => {
      canvas.width = Math.floor(canvas.offsetWidth / scale);
      canvas.height = Math.floor(canvas.offsetHeight / scale);
    };
    resize();
    window.addEventListener("resize", resize);

    const noise = createNoise();
    let frame: number;
    let time = 0;

    // Sovereign color palette as RGB
    const colors = [
      { r: 16, g: 185, b: 129 },   // emerald
      { r: 6, g: 182, b: 212 },    // cyan
      { r: 139, g: 92, b: 246 },   // violet
    ];

    const animate = () => {
      const w = canvas.width;
      const h = canvas.height;
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      time += 0.003;

      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const idx = (y * w + x) * 4;

          // Multi-octave noise for cloud-like texture
          const nx = x * 0.008;
          const ny = y * 0.008;
          const n1 = noise(nx + time, ny + time * 0.7) * 0.5 + 0.5;
          const n2 = noise(nx * 2 + time * 1.3, ny * 2 - time * 0.5) * 0.5 + 0.5;
          const n3 = noise(nx * 0.5 - time * 0.4, ny * 0.5 + time * 0.3) * 0.5 + 0.5;

          // Blend noise layers
          const combined = (n1 * 0.5 + n2 * 0.3 + n3 * 0.2);

          // Map to color based on noise value
          const colorIdx = Math.floor(combined * 2.99);
          const c = colors[colorIdx];

          // Intensity varies with noise, very subtle
          const intensity = combined * combined * 0.06;

          // Radial falloff — brighter near center
          const cx = x / w - 0.5;
          const cy = y / h - 0.5;
          const distFromCenter = Math.sqrt(cx * cx + cy * cy);
          const radialFade = Math.max(0, 1 - distFromCenter * 1.8);

          const alpha = intensity * radialFade * 255;

          data[idx] = c.r;
          data[idx + 1] = c.g;
          data[idx + 2] = c.b;
          data[idx + 3] = alpha;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 pointer-events-none ${className}`}
      style={{
        width: "100%",
        height: "100%",
        imageRendering: "auto",
        filter: "blur(2px)",
      }}
    />
  );
}

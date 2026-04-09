"use client";

import dynamic from "next/dynamic";

const CustomCursor = dynamic(() => import("@/components/cinematic/CustomCursor").then(m => ({ default: m.CustomCursor })), { ssr: false });
const CursorGlow = dynamic(() => import("@/components/cinematic/CursorGlow").then(m => ({ default: m.CursorGlow })), { ssr: false });
const ScrollProgress = dynamic(() => import("@/components/cinematic/ScrollProgress").then(m => ({ default: m.ScrollProgress })), { ssr: false });
const BackToTop = dynamic(() => import("@/components/cinematic/BackToTop").then(m => ({ default: m.BackToTop })), { ssr: false });

export function ClientOnlyEffects() {
  return (
    <>
      <CustomCursor />
      <CursorGlow />
      <ScrollProgress />
      <BackToTop />
    </>
  );
}

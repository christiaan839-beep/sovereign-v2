"use client";

import dynamic from "next/dynamic";

const HeroScene = dynamic(
  () => import("./HeroScene").then((m) => ({ default: m.HeroScene })),
  {
    ssr: false,
    loading: () => null,
  }
);

export function HeroSceneWrapper() {
  return <HeroScene />;
}

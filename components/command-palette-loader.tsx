"use client";

import dynamic from "next/dynamic";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => ({ default: mod.CommandPalette })),
  { ssr: false },
);

export function CommandPaletteLoader() {
  return <CommandPalette />;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const CommandPalette = dynamic(
  () => import("@/components/command-palette").then((mod) => ({ default: mod.CommandPalette })),
  { ssr: false },
);

export function CommandPaletteLoader() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [openOnLoad, setOpenOnLoad] = useState(false);

  useEffect(() => {
    function requestOpen() {
      setShouldLoad(true);
      setOpenOnLoad(true);
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        requestOpen();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("motian-command-palette-open", requestOpen);

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("motian-command-palette-open", requestOpen);
    };
  }, []);

  if (!shouldLoad) {
    return null;
  }

  return <CommandPalette initialOpen={openOnLoad} />;
}

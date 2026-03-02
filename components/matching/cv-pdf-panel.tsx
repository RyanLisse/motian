"use client";

import { X } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

const CvDocumentViewer = dynamic(
  () => import("@/components/cv-document-viewer").then((m) => m.CvDocumentViewer),
  { ssr: false },
);

interface CvPdfPanelProps {
  url: string;
  candidateName: string;
  open: boolean;
  onClose: () => void;
}

export function CvPdfPanel({ url, candidateName, open, onClose }: CvPdfPanelProps) {
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop (mobile only) */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Side panel */}
      <div
        className="fixed top-0 right-0 z-40 h-full w-full md:w-[400px] bg-background border-l border-border shadow-xl animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label={`CV — ${candidateName}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <h3 className="text-sm font-semibold truncate">CV — {candidateName}</h3>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Sluiten">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* PDF Viewer */}
        <div className="overflow-y-auto h-[calc(100%-57px)] p-4">
          <CvDocumentViewer url={url} candidateName={candidateName} />
        </div>
      </div>
    </>
  );
}

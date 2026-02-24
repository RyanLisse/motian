"use client";

import dynamic from "next/dynamic";

const CvDocumentViewer = dynamic(
  () => import("@/components/cv-document-viewer").then((m) => m.CvDocumentViewer),
  { ssr: false },
);

export function CvDocumentViewerLazy(props: { url: string; candidateName: string }) {
  return <CvDocumentViewer {...props} />;
}

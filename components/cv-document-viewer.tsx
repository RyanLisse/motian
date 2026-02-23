"use client";

import { Download, FileText, X } from "lucide-react";
import { useCallback, useState } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button } from "@/components/ui/button";

// Use CDN worker to avoid Next.js bundling issues
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface CvDocumentViewerProps {
  url: string;
  candidateName: string;
}

export function CvDocumentViewer({ url, candidateName }: CvDocumentViewerProps) {
  const [open, setOpen] = useState(false);
  const [numPages, setNumPages] = useState<number>(0);

  const isPdf = url.toLowerCase().endsWith(".pdf") || url.includes("application/pdf");
  const isWord =
    url.toLowerCase().endsWith(".docx") ||
    url.includes("application/vnd.openxmlformats-officedocument");

  const onDocumentLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  }, []);

  // Word documents: download link (browsers can't render .docx inline)
  if (isWord) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">CV van {candidateName}</p>
              <p className="text-xs text-muted-foreground">Word document (.docx)</p>
            </div>
          </div>
          <Button variant="outline" size="sm" asChild>
            <a href={url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </a>
          </Button>
        </div>
      </div>
    );
  }

  // PDF: inline viewer with expand/collapse
  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-red-500/10 flex items-center justify-center">
            <FileText className="h-5 w-5 text-red-500" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">CV van {candidateName}</p>
            <p className="text-xs text-muted-foreground">
              PDF {numPages > 0 ? `· ${numPages} pagina${numPages !== 1 ? "'s" : ""}` : ""}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href={url} download target="_blank" rel="noopener noreferrer">
              <Download className="h-4 w-4 mr-1.5" />
              Download
            </a>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setOpen(!open)}>
            {open ? (
              <>
                <X className="h-4 w-4 mr-1.5" />
                Sluiten
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-1.5" />
                Bekijken
              </>
            )}
          </Button>
        </div>
      </div>

      {open && (
        <div className="p-4 bg-muted/30 max-h-[600px] overflow-y-auto">
          <Document
            file={url}
            onLoadSuccess={onDocumentLoadSuccess}
            loading={
              <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                PDF laden...
              </div>
            }
            error={
              <div className="flex items-center justify-center py-12 text-sm text-destructive">
                Kan PDF niet laden. Probeer het document te downloaden.
              </div>
            }
          >
            {Array.from({ length: numPages }, (_, i) => (
              <Page
                key={`page_${i + 1}`}
                pageNumber={i + 1}
                width={560}
                className="mb-4 shadow-sm rounded-lg overflow-hidden mx-auto"
              />
            ))}
          </Document>
        </div>
      )}

      {/* Collapsed preview: show just first page */}
      {!open && isPdf && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="w-full p-4 bg-muted/20 hover:bg-muted/40 transition-colors cursor-pointer"
        >
          <Document file={url} loading={null} error={null}>
            <Page
              pageNumber={1}
              width={280}
              className="mx-auto shadow-sm rounded-lg overflow-hidden opacity-80 hover:opacity-100 transition-opacity"
            />
          </Document>
          <p className="text-xs text-muted-foreground mt-2">Klik om het volledige CV te bekijken</p>
        </button>
      )}
    </div>
  );
}

"use client";

import { Braces, ExternalLink, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { JsonPayloadViewer } from "./json-payload-viewer";

export type RunJobSummary = {
  id: string;
  title: string;
  company: string | null;
  externalId: string;
  externalUrl: string | null;
  location: string | null;
};

type RunDetailJobsProps = {
  jobs: RunJobSummary[];
  emptyMessage?: string;
};

export function RunDetailJobs({
  jobs,
  emptyMessage = "Geen vacaturekoppeling beschikbaar voor deze run.",
}: RunDetailJobsProps) {
  const [jsonDialogOpen, setJsonDialogOpen] = useState(false);
  const [rawPayload, setRawPayload] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedJobTitle, setSelectedJobTitle] = useState<string>("");

  const openJsonForJob = async (jobId: string, title: string) => {
    setSelectedJobTitle(title);
    setJsonDialogOpen(true);
    setRawPayload(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/opdrachten/${jobId}/raw`);
      const json = await res.json();
      if (res.ok && json?.data?.rawPayload !== undefined) {
        setRawPayload(json.data.rawPayload as Record<string, unknown>);
      } else {
        setRawPayload(null);
      }
    } catch {
      setRawPayload(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {jobs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4">{emptyMessage}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead>Titel</TableHead>
                <TableHead>Opdrachtgever</TableHead>
                <TableHead>Locatie</TableHead>
                <TableHead className="w-[180px]">Acties</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job) => (
                <TableRow key={job.id} className="border-border">
                  <TableCell className="font-medium">
                    <Link href={`/opdrachten/${job.id}`} className="text-primary hover:underline">
                      {job.title}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{job.company ?? "-"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {job.location ?? "-"}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/opdrachten/${job.id}`}
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" />
                        Naar opdracht
                      </Link>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs"
                        onClick={() => openJsonForJob(job.id, job.title)}
                      >
                        <Braces className="h-3 w-3" />
                        Bekijk JSON
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <Dialog open={jsonDialogOpen} onOpenChange={setJsonDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="truncate pr-8">
              Ruwe JSON — {selectedJobTitle || "Laden…"}
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden min-h-0">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <JsonPayloadViewer data={rawPayload} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

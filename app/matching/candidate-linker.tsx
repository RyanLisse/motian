interface CandidateLinkerProps {
  pipelineState?: string | null;
}

export function CandidateLinker({ pipelineState }: CandidateLinkerProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Handmatige pipeline-koppeling</p>
      <p className="mt-1">Status: {pipelineState ?? "Al in pipeline"}</p>
      {/* Legacy compatibility marker: linkCandidateToJob */}
    </div>
  );
}

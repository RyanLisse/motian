interface MatchActionsProps {
  disabled?: boolean;
}

export function MatchActions({ disabled }: MatchActionsProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className="inline-flex items-center rounded-md border border-border px-3 py-2 text-sm"
    >
      Voeg toe aan pipeline
    </button>
  );
}

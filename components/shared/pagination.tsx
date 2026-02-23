import Link from "next/link";

interface PaginationProps {
  page: number;
  totalPages: number;
  /** Build the href for a given page number */
  buildHref: (page: number) => string;
}

export function Pagination({ page, totalPages, buildHref }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-2 pt-4">
      {page > 1 && (
        <Link
          href={buildHref(page - 1)}
          className="h-9 px-4 flex items-center bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Vorige
        </Link>
      )}
      <span className="text-sm text-muted-foreground px-2">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="h-9 px-4 flex items-center bg-card border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
        >
          Volgende
        </Link>
      )}
    </div>
  );
}

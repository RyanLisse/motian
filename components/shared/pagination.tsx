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
          className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
        >
          Vorige
        </Link>
      )}
      <span className="text-sm text-[#6b6b6b] px-2">
        {page} / {totalPages}
      </span>
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
        >
          Volgende
        </Link>
      )}
    </div>
  );
}

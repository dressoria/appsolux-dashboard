"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const ALLOWED_PER_PAGE = [10, 20, 50, 100] as const;

type Props = {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (page: number) => void;
  onPerPageChange: (perPage: number) => void;
};

export function PaginationBar({
  page,
  perPage,
  total,
  onPageChange,
  onPerPageChange,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const start = Math.min((page - 1) * perPage + 1, total);
  const end = Math.min(page * perPage, total);

  function pageNumbers(): (number | "...")[] {
    if (totalPages <= 7)
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: (number | "...")[] = [1];
    if (page > 3) pages.push("...");
    for (
      let i = Math.max(2, page - 1);
      i <= Math.min(totalPages - 1, page + 1);
      i++
    ) {
      pages.push(i);
    }
    if (page < totalPages - 2) pages.push("...");
    pages.push(totalPages);
    return pages;
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm text-[#667085]">
      <span>
        Mostrando {start}–{end} de {total}
      </span>
      <div className="flex items-center gap-1.5">
        {ALLOWED_PER_PAGE.map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPerPageChange(n)}
            className={`rounded px-2 py-0.5 text-xs ${n === perPage ? "bg-[#1E52F1] text-white" : "hover:bg-slate-100"}`}
          >
            {n}
          </button>
        ))}
        <span className="ml-1 text-xs">por página</span>
      </div>
      <div className="flex items-center gap-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Página anterior"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Anterior</span>
        </Button>
        <div className="hidden items-center gap-0.5 sm:flex">
          {pageNumbers().map((n, i) =>
            n === "..." ? (
              <span key={`dot-${i}`} className="px-1">
                …
              </span>
            ) : (
              <button
                key={n}
                type="button"
                onClick={() => onPageChange(n)}
                className={`min-w-7 rounded px-1.5 py-0.5 text-xs ${n === page ? "bg-[#1E52F1] text-white" : "hover:bg-slate-100"}`}
              >
                {n}
              </button>
            ),
          )}
        </div>
        <span className="text-xs sm:hidden">
          {page} de {totalPages}
        </span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Página siguiente"
        >
          <span className="hidden sm:inline">Siguiente</span>
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

export function sanitizePerPage(value: unknown): number {
  const n = Number(value);
  if (ALLOWED_PER_PAGE.includes(n as (typeof ALLOWED_PER_PAGE)[number]))
    return n;
  return 20;
}

export function sanitizePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

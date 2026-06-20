"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SriDocumentCollapsible({
  title,
  badge,
  badgeClass,
  defaultOpen = false,
  children,
}: {
  title: string;
  badge?: string;
  badgeClass?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-6 py-4 text-left"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-sm font-medium text-slate-800">{title}</span>
          {badge && (
            <span
              className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${badgeClass ?? "border-slate-200 bg-slate-50 text-slate-600"}`}
            >
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
        )}
      </button>

      {open && (
        <div className="border-t border-slate-100 px-6 pb-6 pt-4">
          {children}
        </div>
      )}
    </div>
  );
}

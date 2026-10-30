"use client";

import { useMemo, useState, useRef, useEffect } from "react";

type Props = {
  name: string;
  value: string;
  onChange: (v: string) => void;
  existingValues: string[];
  label: string;
  emptyLabel?: string;
  addLabel?: string;
};

export function TenantValueCombobox({
  name,
  value,
  onChange,
  existingValues,
  label,
  emptyLabel = "Sin asignar",
  addLabel = "+ Nuevo",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const uniqueValues = useMemo(
    () => [...new Set(existingValues.filter(Boolean))].sort(),
    [existingValues],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return uniqueValues;
    return uniqueValues.filter((v) => v.toLowerCase().includes(q));
  }, [uniqueValues, query]);

  const showAdd =
    query.trim() &&
    !uniqueValues.some(
      (v) => v.toLowerCase() === query.trim().toLowerCase(),
    );

  function select(v: string) {
    onChange(v);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        value={open ? query : value || ""}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery(value || "");
        }}
        placeholder={label}
        autoComplete="off"
        aria-label={label}
        className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
          <button
            type="button"
            onClick={() => select("")}
            className="w-full px-3 py-1.5 text-left text-sm text-[#667085] hover:bg-[#F0F4FF]"
          >
            {emptyLabel}
          </button>
          {filtered.map((v) => (
            <button
              type="button"
              key={v}
              onClick={() => select(v)}
              className={`w-full px-3 py-1.5 text-left text-sm hover:bg-[#F0F4FF] ${v === value ? "bg-[#F0F4FF] font-medium text-[#1E52F1]" : "text-[#172033]"}`}
            >
              {v}
            </button>
          ))}
          {showAdd && (
            <button
              type="button"
              onClick={() => select(query.trim())}
              className="w-full px-3 py-1.5 text-left text-sm text-[#1E52F1] hover:bg-[#F0F4FF]"
            >
              {addLabel}: &quot;{query.trim()}&quot;
            </button>
          )}
        </div>
      )}
    </div>
  );
}

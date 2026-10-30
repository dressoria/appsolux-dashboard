"use client";

import { useMemo, useState, useRef, useEffect } from "react";

type Entity = { id: string; name: string; identification: string | null };

type Props = {
  name: string;
  value: string;
  onChange: (id: string) => void;
  entities: Entity[];
  excludeId?: string;
  label: string;
  emptyLabel?: string;
};

export function EntityCombobox({
  name,
  value,
  onChange,
  entities,
  excludeId,
  label,
  emptyLabel = "Sin vincular",
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

  const available = useMemo(
    () => entities.filter((e) => e.id !== excludeId),
    [entities, excludeId],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return available.slice(0, 30);
    return available
      .filter(
        (e) =>
          e.name.toLowerCase().includes(q) ||
          (e.identification?.includes(q) ?? false),
      )
      .slice(0, 30);
  }, [available, query]);

  const selectedName = useMemo(
    () => entities.find((e) => e.id === value)?.name ?? "",
    [entities, value],
  );

  function select(id: string) {
    onChange(id);
    setQuery("");
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <input type="hidden" name={name} value={value} />
      <input
        type="text"
        value={open ? query : selectedName}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        placeholder={label}
        autoComplete="off"
        aria-label={label}
        className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
      />
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
          <button
            type="button"
            onClick={() => select("")}
            className="w-full px-3 py-1.5 text-left text-sm text-[#667085] hover:bg-[#F0F4FF]"
          >
            {emptyLabel}
          </button>
          {filtered.map((e) => (
            <button
              type="button"
              key={e.id}
              onClick={() => select(e.id)}
              className={`flex w-full items-baseline gap-2 px-3 py-1.5 text-left text-sm hover:bg-[#F0F4FF] ${e.id === value ? "bg-[#F0F4FF] font-medium text-[#1E52F1]" : "text-[#172033]"}`}
            >
              <span>{e.name}</span>
              {e.identification && (
                <span className="text-xs text-[#667085]">
                  {e.identification}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="px-3 py-2 text-center text-xs text-[#667085]">
              No hay resultados
            </p>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  QUICK_REPLIES,
  QUICK_REPLY_CATEGORIES,
  type QuickReply,
  applyVariables,
  normalizeSearch,
} from "@/lib/conversations/quick-replies";

type Props = {
  onSelect: (text: string) => void;
  contactName?: string;
};

export function QuickRepliesButton({ onSelect, contactName }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }

  function handleSelect(reply: QuickReply) {
    onSelect(applyVariables(reply.text, contactName));
    setOpen(false);
    setSearch("");
  }

  const normalizedSearch = normalizeSearch(search);
  const filtered = normalizedSearch
    ? QUICK_REPLIES.filter(
        (r) =>
          normalizeSearch(r.title).includes(normalizedSearch) ||
          normalizeSearch(r.category).includes(normalizedSearch) ||
          r.shortcut.includes(normalizedSearch)
      )
    : QUICK_REPLIES;

  const grouped = QUICK_REPLY_CATEGORIES.reduce<Record<string, QuickReply[]>>(
    (acc, cat) => {
      const items = filtered.filter((r) => r.category === cat);
      if (items.length > 0) acc[cat] = items;
      return acc;
    },
    {}
  );

  return (
    <div className="relative">
      <Button type="button" variant="outline" size="sm" onClick={handleToggle}>
        Respuestas rápidas
      </Button>

      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 w-[min(380px,calc(100vw-2rem))] rounded-xl border bg-background shadow-xl">
          <div className="border-b p-2">
            <input
              ref={searchRef}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar respuesta..."
              className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            />
          </div>
          <div className="max-h-72 space-y-3 overflow-y-auto p-2">
            {Object.keys(grouped).length === 0 ? (
              <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                No encontramos respuestas con esa búsqueda.
              </p>
            ) : (
              Object.entries(grouped).map(([cat, items]) => (
                <div key={cat}>
                  <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {cat}
                  </p>
                  {items.map((reply) => (
                    <button
                      key={reply.id}
                      type="button"
                      className="w-full rounded-lg px-3 py-2 text-left hover:bg-muted/60"
                      onClick={() => handleSelect(reply)}
                    >
                      <p className="text-sm font-medium">{reply.title}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                        {applyVariables(reply.text, contactName)}
                      </p>
                    </button>
                  ))}
                </div>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

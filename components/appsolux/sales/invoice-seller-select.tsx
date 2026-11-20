"use client";

import { useState } from "react";
import { Popover } from "radix-ui";
import { Check, ChevronDown, UserRound } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { InvoiceSeller } from "@/types/invoice-ui";

export function InvoiceSellerSelect({ value, onChange, sellers, canSelect, disabled }: {
  value: string;
  onChange: (id: string) => void;
  sellers: InvoiceSeller[];
  canSelect: boolean;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = sellers.find((seller) => seller.id === value);
  const matches = sellers.filter((seller) => `${seller.name} ${seller.email ?? ""}`.toLocaleLowerCase("es").includes(query.trim().toLocaleLowerCase("es")));
  const select = (id: string) => { onChange(id); setOpen(false); setQuery(""); };

  return (
    <div className="min-w-0 space-y-2 sm:col-span-2">
      <p className="text-xs font-medium text-slate-600">Vendedor</p>
      <Popover.Root open={open} onOpenChange={(next) => { setOpen(next); setQuery(""); }}>
        <Popover.Trigger asChild>
          <button type="button" disabled={disabled || !canSelect} aria-label={selected ? "Cambiar vendedor" : "Seleccionar vendedor"}
            className={`flex min-h-16 w-full min-w-0 items-center gap-3 rounded-xl border p-3 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-facturom-action-strong disabled:cursor-default ${selected ? "border-facturom-action/40 bg-facturom-action-soft" : "border-slate-200 bg-slate-50"}`}>
            <UserRound className="size-5 shrink-0 text-facturom-action-strong" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block break-words font-semibold text-slate-900">{selected?.name ?? (value ? "Vendedor no disponible" : "Sin vendedor seleccionado")}</span>
              {selected ? <span className="mt-1 flex items-center gap-1 text-xs text-facturom-action-strong"><Check className="size-3" aria-hidden="true" />Seleccionado</span> : null}
            </span>
            {canSelect && !disabled ? <span className="flex shrink-0 items-center gap-1 text-xs text-facturom-action-strong">{selected ? "Cambiar" : "Elegir"}<ChevronDown className="size-4" aria-hidden="true" /></span> : null}
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content align="start" sideOffset={6} className="z-50 w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
            <Input aria-label="Buscar vendedor por nombre" placeholder="Buscar por nombre o correo" value={query} onChange={(event) => setQuery(event.target.value)} className="mb-2 h-11" />
            <div className="max-h-60 overflow-y-auto" aria-label="Vendedores del equipo activo">
              <button type="button" onClick={() => select("")} className="min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-facturom-action-strong">Sin vendedor</button>
              {matches.map((seller) => <button key={seller.id} type="button" onClick={() => select(seller.id)} aria-pressed={seller.id === value}
                className={`flex min-h-11 w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-facturom-action-soft focus-visible:outline-2 focus-visible:outline-facturom-action-strong ${seller.id === value ? "bg-facturom-action-soft" : ""}`}>
                <span className="min-w-0 flex-1"><span className="block break-words font-medium">{seller.name}</span>{seller.email ? <span className="block break-all text-xs text-slate-500">{seller.email}</span> : null}</span>
                {seller.id === value ? <Check className="size-4 shrink-0 text-facturom-action-strong" aria-label="Seleccionado" /> : null}
              </button>)}
              {!matches.length ? <p className="p-3 text-sm text-slate-500">No hay vendedores que coincidan.</p> : null}
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <p className="text-xs text-slate-500">Miembro del equipo con permiso de venta. Se conserva en el borrador; la venta final aún no almacena vendedor.</p>
      {value && !selected ? <ButtonToClear disabled={disabled} onClear={() => onChange("")} /> : null}
      {!canSelect ? <p className="text-xs text-slate-500">El cambio de vendedor se habilita en Configuración: «Seleccionar el vendedor al facturar».</p> : null}
    </div>
  );
}

function ButtonToClear({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
  return <button type="button" disabled={disabled} onClick={onClear} className="min-h-9 text-xs font-medium text-facturom-action-strong underline focus-visible:outline-2">Quitar vendedor no disponible</button>;
}

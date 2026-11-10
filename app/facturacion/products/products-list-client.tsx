"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { ProductActionsClient } from "./product-actions-client";
import { productTaxLabel } from "@/lib/core/inventory-product-input";
import { PaginationBar } from "@/components/appsolux/people/pagination-bar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Product = {
  id: string;
  name: string;
  primaryCode: string | null;
  barcode: string | null;
  price: string;
  price2: string | null;
  price3: string | null;
  price4: string | null;
  cost: string | null;
  stock: number;
  taxRate: string;
  taxCategory: string | null;
  type: string;
  isActive: boolean;
  imageStorageKey: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
  minStock?: number | null;
};

type Props = {
  initialProducts: Product[];
  initialTotal: number;
  q: string;
  type: string;
  status: string;
  page: number;
  perPage: number;
  saved?: string;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  true: { label: "Activo", className: "bg-emerald-50 text-emerald-700" },
  false: { label: "Inactivo", className: "bg-red-50 text-red-700" },
};

const STATUS_OPTIONS = [
  { value: "active", label: "Activos" },
  { value: "inactive", label: "Inactivos" },
  { value: "all", label: "Todos" },
];

const TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "PRODUCT", label: "Producto" },
  { value: "SERVICE", label: "Servicio" },
  { value: "COMBO", label: "Combo" },
];

export function ProductsListClient({ initialProducts: products, initialTotal, q, type, status, page, perPage, saved }: Props) {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const allVisibleSelected = products.length > 0 && products.every((p) => selected.has(p.id));

  function buildUrl(overrides: Record<string, string | number>) {
    const params: Record<string, string> = { q, type, status, page: String(page), perPage: String(perPage) };
    for (const [k, v] of Object.entries(overrides)) params[k] = String(v);
    if (!params.q) delete params.q;
    if (!params.type) delete params.type;
    if (params.status === "active") delete params.status;
    if (params.page === "1") delete params.page;
    if (params.perPage === "20") delete params.perPage;
    return `/facturacion/products?${new URLSearchParams(params)}`;
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const product of products) {
        if (allVisibleSelected) next.delete(product.id); else next.add(product.id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/facturacion/products/new">
          <Button size="sm" className="bg-[#1E52F1] text-white hover:bg-[#1745CE]">+ Crear producto</Button>
        </Link>
        <ProductActionsClient key={`${q}:${type}`} selected={[...selected]} q={q} type={type} />
      </div>

      {saved && showSuccess && (
        <div role="status" className="fixed bottom-4 right-4 z-50 max-w-md rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-800 shadow-lg flex gap-4 justify-between">
          {saved === "created" ? "Producto creado correctamente." : "Producto actualizado correctamente."}
          <button aria-label="Cerrar notificación" onClick={() => setShowSuccess(false)} className="font-medium hover:underline">Cerrar</button>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <form className="flex flex-1 items-center gap-2" onSubmit={(event) => {
          event.preventDefault();
          const formQ = String(new FormData(event.currentTarget).get("q") ?? "").trim();
          router.push(buildUrl({ q: formQ, page: 1 }));
        }}>
          <Input
            aria-label="Buscar productos"
            placeholder="Buscar por nombre, código o barras..."
            name="q"
            key={`${q}:${type}:${status}`}
            defaultValue={q}
            className="max-w-sm"
          />
          <Button size="sm" variant="outline" type="submit">Buscar</Button>
        </form>
        <div className="flex items-center gap-1.5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => router.push(buildUrl({ status: opt.value, page: 1 }))}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${status === opt.value ? "bg-[#1E52F1] text-white" : "bg-[#F0F2F5] text-[#667085] hover:bg-[#E4E9F0]"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <select
          value={type}
          onChange={(e) => router.push(buildUrl({ type: e.target.value, page: 1 }))}
          className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
        >
          {TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        {selected.size > 0 && <span className="text-xs text-[#667085]">{selected.size} seleccionados</span>}
      </div>

      <Card className="border-[#E4E9F0]">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#E4E9F0] bg-[#F8F9FB]">
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox" aria-label="Seleccionar productos visibles" checked={allVisibleSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Código</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Nombre</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#667085]">Marca</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Costo</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">PVP</th>
                  <th className="px-3 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#667085]">Stock</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">IVA</th>
                  <th className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[#667085]">Estado</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-[#667085]">
                      No hay productos{q ? ` que coincidan con "${q}"` : ""}. {!q && <Link href="/facturacion/products/new" className="text-[#1E52F1] hover:underline">Crea el primero</Link>}
                    </td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const statusBadge = STATUS_BADGE[String(p.isActive)];
                    const lowStock = p.minStock != null && p.stock <= p.minStock && p.isActive;
                    return (
                      <tr key={p.id} className="border-b border-[#E4E9F0] last:border-0 hover:bg-[#F8F9FB] transition-colors">
                        <td className="px-3 py-2.5">
                          <input type="checkbox" aria-label={`Seleccionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                        </td>
                        <td className="px-3 py-2.5 font-mono text-xs text-[#667085]">{p.primaryCode ?? "—"}</td>
                        <td className="px-3 py-2.5">
                          <Link href={`/facturacion/products/${p.id}`} className="font-medium text-[#172033] hover:text-[#1E52F1] hover:underline">
                            {p.name}
                          </Link>
                          {p.category && <span className="ml-2 text-xs text-[#667085]">{p.category.name}</span>}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-[#667085]">{p.brand?.name ?? "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs">{p.cost ? `$${Number(p.cost).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2.5 text-right font-mono text-xs font-medium">${Number(p.price).toFixed(2)}</td>
                        <td className="px-3 py-2.5 text-right">
                          <span className={`inline-flex items-center gap-1 font-mono text-xs ${lowStock ? "font-semibold text-amber-600" : p.stock <= 0 ? "text-red-600" : ""}`}>
                            {lowStock && <AlertTriangle className="size-3" />}
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-center text-xs text-[#667085]">{productTaxLabel(p.taxCategory, p.taxRate)}</td>
                        <td className="px-3 py-2.5 text-center">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusBadge?.className}`}>
                            {statusBadge?.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[#E4E9F0]">
            <PaginationBar
              page={page}
              perPage={perPage}
              total={initialTotal}
              onPageChange={(p) => router.push(buildUrl({ page: p }))}
              onPerPageChange={(pp) => router.push(buildUrl({ perPage: pp, page: 1 }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

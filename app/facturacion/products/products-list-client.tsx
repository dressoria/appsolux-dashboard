"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ProductActionsClient } from "./product-actions-client";
import { productTaxLabel } from "@/lib/core/inventory-product-input";
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
};

type Props = {
  initialProducts: Product[];
  initialTotal: number;
  q: string;
  type: string;
  page: number;
  saved?: string;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  true: { label: "Activo", className: "bg-green-100 text-green-800" },
  false: { label: "Inactivo", className: "bg-red-100 text-red-800" },
};

export function ProductsListClient({ initialProducts: products, initialTotal, q, type, page, saved }: Props) {
  const router = useRouter();
  const [showSuccess, setShowSuccess] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const filtered = products;
  const allVisibleSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const pageUrl = (nextPage: number) => `/facturacion/products?${new URLSearchParams({ q, type, page: String(nextPage) })}`;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const product of filtered) {
        if (allVisibleSelected) next.delete(product.id); else next.add(product.id);
      }
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/facturacion/products/new">
          <Button size="sm">+ Crear producto</Button>
        </Link>
        <ProductActionsClient key={`${q}:${type}`} selected={[...selected]} q={q} type={type} />
      </div>
      {saved && showSuccess && <div role="status" className="fixed bottom-4 right-4 z-50 max-w-md rounded border border-green-300 bg-green-50 p-4 text-green-800 shadow-lg flex gap-4 justify-between">
        {saved === "created" ? "Producto creado correctamente." : "Producto actualizado correctamente."}
        <button aria-label="Cerrar notificación" onClick={() => setShowSuccess(false)}>Cerrar</button>
      </div>}
      <form className="flex flex-wrap items-center gap-2" onSubmit={(event) => {
        event.preventDefault();
        router.push(`/facturacion/products?${new URLSearchParams({ q: String(new FormData(event.currentTarget).get("q") ?? "").trim(), type })}`);
      }}>
        <Input aria-label="Buscar productos" placeholder="Buscar por nombre, código o barras..." name="q" key={`${q}:${type}`} defaultValue={q} className="max-w-sm" />
        <Button size="sm" variant="outline" type="submit">Buscar</Button>
        {type === "COMBO" && <span className="text-sm">Tipo: Combo</span>}
        {selected.size > 0 && <span className="text-sm text-muted-foreground">{selected.size} seleccionados</span>}
      </form>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox" aria-label="Seleccionar productos visibles" checked={allVisibleSelected} onChange={toggleAll} />
                  </th>
                  <th className="px-3 py-3 text-left font-medium">Código</th>
                  <th className="px-3 py-3 text-left font-medium">Nombre</th>
                  <th className="px-3 py-3 text-left font-medium">Marca</th>
                  <th className="px-3 py-3 text-right font-medium">Costo</th>
                  <th className="px-3 py-3 text-right font-medium">PVP Público</th>
                  <th className="px-3 py-3 text-right font-medium">PVP Dist.</th>
                  <th className="px-3 py-3 text-right font-medium">PVP May.</th>
                  <th className="px-3 py-3 text-right font-medium">PVP Tarj.</th>
                  <th className="px-3 py-3 text-right font-medium">Stock</th>
                  <th className="px-3 py-3 text-center font-medium">IVA</th>
                  <th className="px-3 py-3 text-center font-medium">Estado</th>
                  <th className="px-3 py-3 text-center font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={13} className="px-4 py-8 text-center text-muted-foreground">
                      No hay productos. Crea el primero.
                    </td>
                  </tr>
                ) : (
                  filtered.map((p) => {
                    const status = STATUS_BADGE[String(p.isActive)];
                    return (
                      <tr key={p.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2">
                          <input type="checkbox" aria-label={`Seleccionar ${p.name}`} checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{p.primaryCode ?? "—"}</td>
                        <td className="px-3 py-2">
                          <Link href={`/facturacion/products/${p.id}`} className="hover:underline font-medium">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-3 py-2 text-xs">{p.brand?.name ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{p.cost ? `$${Number(p.cost).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">${Number(p.price).toFixed(2)}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{p.price2 ? `$${Number(p.price2).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{p.price3 ? `$${Number(p.price3).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-xs">{p.price4 ? `$${Number(p.price4).toFixed(2)}` : "—"}</td>
                        <td className="px-3 py-2 text-right">{p.stock}</td>
                        <td className="px-3 py-2 text-center text-xs">{productTaxLabel(p.taxCategory, p.taxRate)}</td>
                        <td className="px-3 py-2 text-center">
                          <span className={`rounded px-2 py-0.5 text-xs font-medium ${status?.className}`}>
                            {status?.label}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-center">
                          <Link href={`/facturacion/products/${p.id}`}>
                            <Button size="sm" variant="ghost">Editar</Button>
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="border-t px-4 py-2 text-xs text-muted-foreground">
            {initialTotal} producto(s) total · Página {page}
            <div className="flex gap-4 mt-2">
              {page > 1 && <Link href={pageUrl(page - 1)}>Anterior</Link>}
              {page * 50 < initialTotal && <Link href={pageUrl(page + 1)}>Siguiente</Link>}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
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
  type: string;
  isActive: boolean;
  imageStorageKey: string | null;
  category: { id: string; name: string } | null;
  brand: { id: string; name: string } | null;
};

type Props = {
  initialProducts: Product[];
  initialTotal: number;
  warehouses: Array<{ id: string; code: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  true: { label: "Activo", className: "bg-green-100 text-green-800" },
  false: { label: "Inactivo", className: "bg-red-100 text-red-800" },
};

export function ProductsListClient({ initialProducts, initialTotal, warehouses, brands }: Props) {
  const [products] = useState(initialProducts);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");

  const filtered = search
    ? products.filter(
        (p) =>
          p.name.toLowerCase().includes(search.toLowerCase()) ||
          p.primaryCode?.toLowerCase().includes(search.toLowerCase()) ||
          p.barcode?.toLowerCase().includes(search.toLowerCase()),
      )
    : products;

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((p) => p.id)));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/facturacion/products/new">
          <Button size="sm">+ Crear producto</Button>
        </Link>
        <Button size="sm" variant="outline" disabled>Actualizar precios</Button>
        <Button size="sm" variant="outline" disabled>Importar</Button>
        <Button size="sm" variant="outline" disabled>Descargar formato</Button>
        <Button size="sm" variant="outline" disabled>Combos</Button>
        <Button size="sm" variant="outline" disabled={selected.size === 0}>
          Imprimir códigos de barras
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar por nombre, código o barras..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        {selected.size > 0 && (
          <span className="text-sm text-muted-foreground">
            {selected.size} seleccionados
          </span>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-left">
                    <input type="checkbox" checked={selected.size === filtered.length && filtered.length > 0} onChange={toggleAll} />
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
                          <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} />
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
                        <td className="px-3 py-2 text-center text-xs">{Number(p.taxRate)}%</td>
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
            {initialTotal} producto(s) total
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

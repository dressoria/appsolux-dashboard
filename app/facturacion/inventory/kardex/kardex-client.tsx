"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type KardexRow = {
  id: string;
  date: string;
  movementType: string;
  reference: string | null;
  inQty: string;
  outQty: string;
  unitCost: string | null;
  balance: string;
  value: string | null;
};

type KardexData = {
  openingBalance: string;
  rows: KardexRow[];
  closingBalance: string;
};

export function KardexClient() {
  const [productId, setProductId] = useState("");
  const [data, setData] = useState<KardexData | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!productId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/inventory/kardex?productId=${productId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <div>
          <label className="text-sm font-medium">ID del producto</label>
          <Input value={productId} onChange={(e) => setProductId(e.target.value)} className="mt-1" />
        </div>
        <Button onClick={load} disabled={loading}>{loading ? "Cargando..." : "Consultar"}</Button>
      </div>

      {data && (
        <Card>
          <CardContent className="p-0">
            <div className="px-4 py-2 text-sm font-medium bg-muted/50">
              Saldo inicial: {data.openingBalance}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="px-4 py-2 text-left font-medium">Fecha</th>
                  <th className="px-4 py-2 text-left font-medium">Tipo</th>
                  <th className="px-4 py-2 text-left font-medium">Referencia</th>
                  <th className="px-4 py-2 text-right font-medium">Entrada</th>
                  <th className="px-4 py-2 text-right font-medium">Salida</th>
                  <th className="px-4 py-2 text-right font-medium">Costo unit.</th>
                  <th className="px-4 py-2 text-right font-medium">Saldo</th>
                  <th className="px-4 py-2 text-right font-medium">Valor</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-4 py-2 text-xs">{new Date(r.date).toLocaleDateString("es-EC")}</td>
                    <td className="px-4 py-2 text-xs">{r.movementType}</td>
                    <td className="px-4 py-2 text-xs">{r.reference ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(r.inQty) > 0 ? r.inQty : ""}</td>
                    <td className="px-4 py-2 text-right font-mono">{Number(r.outQty) > 0 ? r.outQty : ""}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.unitCost ?? "—"}</td>
                    <td className="px-4 py-2 text-right font-mono font-medium">{r.balance}</td>
                    <td className="px-4 py-2 text-right font-mono text-xs">{r.value ? `$${r.value}` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-4 py-2 text-sm font-medium border-t">
              Saldo final: {data.closingBalance}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

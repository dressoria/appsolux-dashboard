"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type ReceiptRow = {
  id: string;
  receiptNumber: string;
  status: string;
  notes: string | null;
  confirmedAt: string | null;
  createdAt: string;
  purchaseDocument: {
    documentNumber: string;
    supplier: { name: string } | null;
  } | null;
  warehouse: { name: string } | null;
  items: Array<{
    quantityExpected: number;
    quantityReceived: number;
    product: { name: string } | null;
  }>;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Borrador",
  CONFIRMED: "Confirmada",
  CANCELLED: "Anulada",
};

export function PurchaseReceiptsClient() {
  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/purchases/receipts");
    const data = await res.json();
    setReceipts(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchReceipts();
  }, [fetchReceipts]);

  async function handleConfirm(id: string) {
    if (!confirm("¿Confirmar recepción? Esto generará movimientos de inventario.")) return;
    const res = await fetch(`/api/purchases/receipts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "confirm" }),
    });
    const data = await res.json();
    if (data.ok) {
      fetchReceipts();
    } else {
      alert(data.error || "Error al confirmar.");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Recepciones de compra</h1>
        <p className="text-sm text-muted-foreground">
          Recepción de mercadería con generación de movimientos de inventario
        </p>
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : receipts.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay recepciones registradas.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Nº Recepción</th>
                    <th className="px-4 py-3 font-medium">Compra</th>
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">Bodega</th>
                    <th className="px-4 py-3 font-medium">Ítems</th>
                    <th className="px-4 py-3 font-medium">Confirmada</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {receipts.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-xs">{r.receiptNumber}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {r.purchaseDocument?.documentNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {r.purchaseDocument?.supplier?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">{r.warehouse?.name ?? "—"}</td>
                      <td className="px-4 py-3">{r.items.length}</td>
                      <td className="px-4 py-3">
                        {r.confirmedAt
                          ? new Date(r.confirmedAt).toLocaleDateString("es-EC")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className="rounded bg-muted px-2 py-0.5 text-xs">
                          {STATUS_LABELS[r.status] ?? r.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "DRAFT" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleConfirm(r.id)}
                          >
                            Confirmar
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

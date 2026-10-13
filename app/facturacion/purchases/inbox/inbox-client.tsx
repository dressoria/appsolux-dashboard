"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

type InboxItem = {
  id: string;
  accessKey: string | null;
  supplierRuc: string | null;
  supplierName: string | null;
  documentType: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  total: string | null;
  suggestedCategory: string | null;
  suggestedDeductibility: string | null;
  status: string;
  createdAt: string;
  purchaseDocument: { id: string } | null;
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "Nuevo",
  CLASSIFIED: "Clasificado",
  NEEDS_REVIEW: "Revisión necesaria",
  REGISTERED: "Registrado",
  IGNORED: "Ignorado",
};

const STATUS_COLORS: Record<string, string> = {
  NEW: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  CLASSIFIED: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  NEEDS_REVIEW: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  REGISTERED: "bg-muted",
  IGNORED: "bg-muted text-muted-foreground",
};

export function PurchaseInboxClient() {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set("status", statusFilter);
    if (search) params.set("search", search);
    const res = await fetch(`/api/purchases/inbox?${params}`);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  async function updateStatus(id: string, status: string) {
    await fetch("/api/purchases/inbox", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, status }),
    });
    fetchItems();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bandeja de compras</h1>
        <p className="text-sm text-muted-foreground">
          Documentos recibidos pendientes de clasificación y registro
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Input
              placeholder="Buscar por proveedor o RUC..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border px-3 py-2 text-sm"
            >
              <option value="">Todos los estados</option>
              {Object.entries(STATUS_LABELS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Cargando...</div>
          ) : items.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">
              No hay documentos en la bandeja.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Proveedor</th>
                    <th className="px-4 py-3 font-medium">RUC</th>
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">Nº Documento</th>
                    <th className="px-4 py-3 font-medium">Fecha</th>
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                    <th className="px-4 py-3 font-medium">Categoría sugerida</th>
                    <th className="px-4 py-3 font-medium">Estado</th>
                    <th className="px-4 py-3 font-medium">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">{item.supplierName ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.supplierRuc ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">{item.documentType ?? "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {item.documentNumber ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        {item.issueDate
                          ? new Date(item.issueDate).toLocaleDateString("es-EC")
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-medium">
                        {item.total ? `$${Number(item.total).toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {item.suggestedCategory ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded px-2 py-0.5 text-xs ${STATUS_COLORS[item.status] ?? "bg-muted"}`}
                        >
                          {STATUS_LABELS[item.status] ?? item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {item.status === "NEW" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus(item.id, "IGNORED")}
                            >
                              Ignorar
                            </Button>
                          )}
                          {item.status === "IGNORED" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => updateStatus(item.id, "NEW")}
                            >
                              Restaurar
                            </Button>
                          )}
                        </div>
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

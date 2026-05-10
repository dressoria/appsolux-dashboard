"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextCompany,
  ErpnextItem,
  ErpnextPurchaseOrder,
  ErpnextSupplier,
} from "@/types/erpnext";

type Props = {
  suppliers: ErpnextSupplier[];
  items: ErpnextItem[];
  companies: ErpnextCompany[];
};

type DraftRow = {
  id: number;
  item_code: string;
  qty: string;
  rate: string;
};

type CreateOrderResponse = ApiResponse<{ order: ErpnextPurchaseOrder }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function CreatePurchaseOrderDialog({ suppliers, items, companies }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [company, setCompany] = useState(companies[0]?.name ?? "");
  const [date, setDate] = useState(today);
  const [rows, setRows] = useState<DraftRow[]>([
    { id: 1, item_code: "", qty: "1", rate: "" },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: Date.now(), item_code: "", qty: "1", rate: "" },
    ]);
  }

  function removeRow(id: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function updateRow(
    id: number,
    field: "item_code" | "qty" | "rate",
    value: string
  ) {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function resetForm() {
    setSupplier("");
    setCompany(companies[0]?.name ?? "");
    setDate(today());
    setRows([{ id: 1, item_code: "", qty: "1", rate: "" }]);
    setMessage(null);
    setIsError(false);
  }

  function handleClose() {
    resetForm();
    setOpen(false);
  }

  async function handleSubmit() {
    setMessage(null);
    setIsError(false);

    if (!supplier) {
      setIsError(true);
      setMessage("Selecciona un proveedor.");
      return;
    }
    if (!company) {
      setIsError(true);
      setMessage("Selecciona una empresa.");
      return;
    }

    const validRows = rows.filter((r) => r.item_code && r.qty && r.rate);
    if (validRows.length === 0) {
      setIsError(true);
      setMessage("Agrega al menos un producto con cantidad y costo.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/erpnext/purchases/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          company,
          transaction_date: date,
          items: validRows.map((r) => ({
            item_code: r.item_code,
            qty: Number(r.qty),
            rate: Number(r.rate),
          })),
        }),
      });
      const result = (await response.json()) as CreateOrderResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Orden ${result.data.order.name} creada en borrador.`);
      router.refresh();
      window.setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear la orden."
      );
    } finally {
      setIsPending(false);
    }
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)} disabled={suppliers.length === 0}>
        Nueva orden de compra
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nueva orden de compra</h2>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isPending}
          >
            Cerrar
          </Button>
        </div>

        <div className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Proveedor</Label>
              <select
                className={selectClassName}
                value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
              >
                <option value="">Selecciona proveedor</option>
                {suppliers
                  .filter((s) => s.disabled !== 1)
                  .map((s) => (
                    <option key={s.name} value={s.name}>
                      {s.supplier_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Empresa</Label>
              <select
                className={selectClassName}
                value={company}
                onChange={(e) => setCompany(e.target.value)}
              >
                <option value="">Selecciona empresa</option>
                {companies.map((c) => (
                  <option key={c.name} value={c.name}>
                    {c.company_name ?? c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Productos</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addRow}
              >
                + Agregar fila
              </Button>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/30 text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pl-3 pr-2 text-left font-medium">
                      Producto
                    </th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Cantidad
                    </th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Costo unitario
                    </th>
                    <th className="w-8" />
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="py-1.5 pl-3 pr-2">
                        <select
                          className={selectClassName}
                          value={row.item_code}
                          onChange={(e) =>
                            updateRow(row.id, "item_code", e.target.value)
                          }
                        >
                          <option value="">Selecciona producto</option>
                          {items
                            .filter((i) => i.disabled !== 1)
                            .map((i) => (
                              <option key={i.name} value={i.item_code}>
                                {i.item_name} ({i.item_code})
                              </option>
                            ))}
                        </select>
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min="0.001"
                          step="0.001"
                          value={row.qty}
                          onChange={(e) =>
                            updateRow(row.id, "qty", e.target.value)
                          }
                          className="h-8 w-20"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          value={row.rate}
                          onChange={(e) =>
                            updateRow(row.id, "rate", e.target.value)
                          }
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="py-1.5 pr-2 text-center">
                        <button
                          type="button"
                          onClick={() => removeRow(row.id)}
                          disabled={rows.length === 1}
                          className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                        >
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              El documento se crea en borrador. El stock no cambia hasta que sea
              confirmado.
            </p>
          </div>

          {message ? (
            <p
              className={
                isError ? "text-sm text-destructive" : "text-sm text-green-700"
              }
            >
              {message}
            </p>
          ) : null}

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? "Creando..." : "Crear orden de compra"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

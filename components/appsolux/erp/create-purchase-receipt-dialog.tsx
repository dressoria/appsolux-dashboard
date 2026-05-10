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
  ErpnextPurchaseReceipt,
  ErpnextSupplier,
  ErpnextWarehouse,
} from "@/types/erpnext";

type Props = {
  suppliers: ErpnextSupplier[];
  items: ErpnextItem[];
  companies: ErpnextCompany[];
  warehouses: ErpnextWarehouse[];
};

type DraftRow = {
  id: number;
  item_code: string;
  qty: string;
  rate: string;
};

type CreateReceiptResponse = ApiResponse<{ receipt: ErpnextPurchaseReceipt }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function today() {
  return new Date().toISOString().split("T")[0];
}

export function CreatePurchaseReceiptDialog({
  suppliers,
  items,
  companies,
  warehouses,
}: Props) {
  const router = useRouter();
  const operativeWarehouses = warehouses.filter((w) => w.is_group !== 1);

  const [open, setOpen] = useState(false);
  const [supplier, setSupplier] = useState("");
  const [company, setCompany] = useState(companies[0]?.name ?? "");
  const [warehouse, setWarehouse] = useState(
    operativeWarehouses[0]?.name ?? ""
  );
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
    setWarehouse(operativeWarehouses[0]?.name ?? "");
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
    if (!warehouse) {
      setIsError(true);
      setMessage("Selecciona una bodega.");
      return;
    }

    const validRows = rows.filter((r) => r.item_code && r.qty);
    if (validRows.length === 0) {
      setIsError(true);
      setMessage("Agrega al menos un producto con cantidad.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/erpnext/purchases/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplier,
          company,
          posting_date: date,
          items: validRows.map((r) => ({
            item_code: r.item_code,
            qty: Number(r.qty),
            warehouse,
            ...(r.rate ? { rate: Number(r.rate) } : {}),
          })),
        }),
      });
      const result = (await response.json()) as CreateReceiptResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(
        `Ingreso ${result.data.receipt.name} registrado en borrador.`
      );
      router.refresh();
      window.setTimeout(() => {
        handleClose();
      }, 1800);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el ingreso."
      );
    } finally {
      setIsPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        disabled={
          suppliers.length === 0 ||
          operativeWarehouses.length === 0 ||
          items.length === 0
        }
      >
        Registrar ingreso de mercaderia
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-2xl rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Registrar ingreso de mercaderia</h2>
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
          <div className="grid gap-3 md:grid-cols-2">
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
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Bodega de destino</Label>
              {operativeWarehouses.length === 0 ? (
                <p className="text-sm text-destructive">
                  No hay bodegas operativas. Crea una en Inventario → Bodegas.
                </p>
              ) : (
                <select
                  className={selectClassName}
                  value={warehouse}
                  onChange={(e) => setWarehouse(e.target.value)}
                >
                  <option value="">Selecciona bodega</option>
                  {operativeWarehouses.map((w) => (
                    <option key={w.name} value={w.name}>
                      {w.warehouse_name}
                    </option>
                  ))}
                </select>
              )}
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
              <Label>Productos recibidos</Label>
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
                      Costo{" "}
                      <span className="font-normal">(opcional)</span>
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
              El ingreso se crea en borrador. El stock se actualiza cuando el
              documento sea confirmado en el ERP.
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
              {isPending ? "Registrando..." : "Registrar ingreso"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

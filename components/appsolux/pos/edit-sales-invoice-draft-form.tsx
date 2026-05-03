"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextItem,
  ErpnextSalesInvoice,
  ErpnextWarehouse,
  UpdateSalesInvoiceDraftItemInput,
} from "@/types/erpnext";

type EditSalesInvoiceDraftFormProps = {
  salesInvoice: ErpnextSalesInvoice;
  availableItems: ErpnextItem[];
  availableWarehouses: ErpnextWarehouse[];
};

type DraftLine = {
  id: string;
  name?: string;
  item_code: string;
  qty: string;
  rate: string;
  warehouse: string;
};

type UpdateInvoiceResponse = ApiResponse<{
  sales_invoice: ErpnextSalesInvoice;
}>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function createLineId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getInitialLines(salesInvoice: ErpnextSalesInvoice): DraftLine[] {
  return (salesInvoice.items ?? []).map((item) => ({
    id: item.name ?? createLineId(),
    name: item.name,
    item_code: item.item_code,
    qty: String(item.qty ?? 1),
    rate: String(item.rate ?? 0),
    warehouse: item.warehouse ?? "",
  }));
}

export function EditSalesInvoiceDraftForm({
  salesInvoice,
  availableItems,
  availableWarehouses,
}: EditSalesInvoiceDraftFormProps) {
  const usableWarehouses = availableWarehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const activeItems = availableItems.filter((item) => item.disabled !== 1);
  const [lines, setLines] = useState<DraftLine[]>(() =>
    getInitialLines(salesInvoice)
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const estimatedTotal = lines.reduce((sum, line) => {
    const qty = Number(line.qty);
    const rate = Number(line.rate);

    return sum + (Number.isFinite(qty) && Number.isFinite(rate) ? qty * rate : 0);
  }, 0);

  function updateLine(
    lineId: string,
    field: keyof Omit<DraftLine, "id" | "name">,
    value: string
  ) {
    setLines((currentLines) =>
      currentLines.map((line) =>
        line.id === lineId ? { ...line, [field]: value } : line
      )
    );
  }

  function addLine() {
    setLines((currentLines) => [
      ...currentLines,
      {
        id: createLineId(),
        item_code: activeItems[0]?.item_code ?? "",
        qty: "1",
        rate: "0",
        warehouse: usableWarehouses[0]?.name ?? "",
      },
    ]);
  }

  function removeLine(lineId: string) {
    setLines((currentLines) =>
      currentLines.filter((line) => line.id !== lineId)
    );
  }

  function getPayloadItems(): UpdateSalesInvoiceDraftItemInput[] {
    return lines.map((line) => ({
      name: line.name,
      item_code: line.item_code.trim(),
      qty: Number(line.qty),
      rate: Number(line.rate),
      warehouse: line.warehouse.trim() || undefined,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payloadItems = getPayloadItems();
    const invalidItem = payloadItems.find(
      (item) =>
        !item.item_code ||
        !Number.isFinite(item.qty) ||
        item.qty <= 0 ||
        !Number.isFinite(item.rate) ||
        item.rate < 0
    );

    if (payloadItems.length === 0 || invalidItem) {
      setIsSubmitting(false);
      setIsError(true);
      setMessage(
        "Agrega al menos un producto con cantidad mayor a 0 y precio valido."
      );
      return;
    }

    try {
      const response = await fetch(
        `/api/erpnext/sales-invoices/${encodeURIComponent(salesInvoice.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            due_date: String(formData.get("due_date") ?? "").trim(),
            remarks: String(formData.get("remarks") ?? "").trim(),
            items: payloadItems,
          }),
        }
      );
      const result = (await response.json()) as UpdateInvoiceResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Factura actualizada correctamente.");
      window.location.reload();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo editar la factura"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div id="editar-borrador" className="space-y-4 rounded-xl border bg-card p-4">
      <div>
        <h2 className="font-semibold">Editar factura en borrador</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Puedes cambiar productos, cantidades y precios antes de confirmar la
          factura.
        </p>
      </div>

      <form className="space-y-4" onSubmit={handleSubmit}>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="draft_due_date">Fecha de vencimiento</Label>
            <Input
              id="draft_due_date"
              name="due_date"
              type="date"
              defaultValue={salesInvoice.due_date ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="draft_remarks">Observacion / nota</Label>
            <Input
              id="draft_remarks"
              name="remarks"
              defaultValue={salesInvoice.remarks ?? ""}
            />
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">Productos</h3>
            <Button type="button" variant="outline" onClick={addLine}>
              Agregar producto
            </Button>
          </div>

          {lines.length === 0 ? (
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Agrega al menos un producto.
            </div>
          ) : null}

          {lines.map((line) => (
            <div key={line.id} className="rounded-lg border bg-background p-3">
              <div className="grid gap-3 md:grid-cols-[minmax(0,1.4fr)_0.6fr_0.6fr]">
                <div className="space-y-2">
                  <Label htmlFor={`item_${line.id}`}>Producto</Label>
                  <select
                    id={`item_${line.id}`}
                    className={selectClassName}
                    value={line.item_code}
                    onChange={(event) =>
                      updateLine(line.id, "item_code", event.target.value)
                    }
                    required
                  >
                    <option value="">Selecciona un producto</option>
                    {activeItems.map((item) => (
                      <option key={item.name} value={item.item_code}>
                        {item.item_name} ({item.item_code})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`qty_${line.id}`}>Cantidad</Label>
                  <Input
                    id={`qty_${line.id}`}
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={line.qty}
                    onChange={(event) =>
                      updateLine(line.id, "qty", event.target.value)
                    }
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`rate_${line.id}`}>Precio</Label>
                  <Input
                    id={`rate_${line.id}`}
                    type="number"
                    min="0"
                    step="0.01"
                    value={line.rate}
                    onChange={(event) =>
                      updateLine(line.id, "rate", event.target.value)
                    }
                    required
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-end gap-3">
                <div className="min-w-56 flex-1 space-y-2">
                  <Label htmlFor={`warehouse_${line.id}`}>
                    Bodega / ubicacion
                  </Label>
                  <select
                    id={`warehouse_${line.id}`}
                    className={selectClassName}
                    value={line.warehouse}
                    onChange={(event) =>
                      updateLine(line.id, "warehouse", event.target.value)
                    }
                  >
                    <option value="">Sin bodega especifica</option>
                    {usableWarehouses.map((warehouse) => (
                      <option key={warehouse.name} value={warehouse.name}>
                        {warehouse.warehouse_name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Subtotal: </span>
                  <span className="font-medium">
                    {(Number(line.qty) * Number(line.rate) || 0).toFixed(2)}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => removeLine(line.id)}
                >
                  Eliminar linea
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border bg-muted/40 p-4 text-sm">
          <div className="flex items-center justify-between font-semibold">
            <span>Total estimado</span>
            <span>{estimatedTotal.toFixed(2)}</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            El total final lo calcula el ERP al guardar.
          </p>
        </div>

        {message ? (
          <div
            className={
              isError
                ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
            }
          >
            {message}
          </div>
        ) : null}

        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Guardando..." : "Guardar cambios"}
        </Button>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextCompany,
  ErpnextCustomer,
  ErpnextItem,
  ErpnextQuotation,
} from "@/types/erpnext";

type Props = {
  customers: ErpnextCustomer[];
  items: ErpnextItem[];
  companies: ErpnextCompany[];
};

type DraftRow = {
  id: number;
  item_code: string;
  qty: string;
  rate: string;
  discount_percentage: string;
};

type CreateQuotationResponse = ApiResponse<{ quotation: ErpnextQuotation }>;

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-background px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function today() {
  return new Date().toISOString().split("T")[0];
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  return value.toISOString().split("T")[0];
}

export function CreateQuotationDialog({ customers, items, companies }: Props) {
  const router = useRouter();
  const currentDate = today();
  const [open, setOpen] = useState(false);
  const [customer, setCustomer] = useState("");
  const [company, setCompany] = useState(companies[0]?.name ?? "");
  const [transactionDate, setTransactionDate] = useState(currentDate);
  const [validTill, setValidTill] = useState(addDays(currentDate, 15));
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<DraftRow[]>([
    {
      id: 1,
      item_code: "",
      qty: "1",
      rate: "",
      discount_percentage: "0",
    },
  ]);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isPending, setIsPending] = useState(false);

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        id: Date.now(),
        item_code: "",
        qty: "1",
        rate: "",
        discount_percentage: "0",
      },
    ]);
  }

  function removeRow(id: number) {
    if (rows.length === 1) return;
    setRows((prev) => prev.filter((row) => row.id !== id));
  }

  function updateRow(
    id: number,
    field: "item_code" | "qty" | "rate" | "discount_percentage",
    value: string
  ) {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function resetForm() {
    const nextToday = today();
    setCustomer("");
    setCompany(companies[0]?.name ?? "");
    setTransactionDate(nextToday);
    setValidTill(addDays(nextToday, 15));
    setNotes("");
    setRows([
      {
        id: 1,
        item_code: "",
        qty: "1",
        rate: "",
        discount_percentage: "0",
      },
    ]);
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

    if (!customer || !company || !transactionDate) {
      setIsError(true);
      setMessage("Selecciona cliente, empresa y fecha.");
      return;
    }

    const validRows = rows.filter((row) => row.item_code && row.qty && row.rate);
    if (validRows.length === 0) {
      setIsError(true);
      setMessage("Agrega al menos un producto con cantidad y precio.");
      return;
    }

    setIsPending(true);
    try {
      const response = await fetch("/api/erpnext/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          company,
          transaction_date: transactionDate,
          valid_till: validTill || undefined,
          notes: notes || undefined,
          items: validRows.map((row) => ({
            item_code: row.item_code,
            qty: Number(row.qty),
            rate: Number(row.rate),
            discount_percentage: Number(row.discount_percentage || 0),
          })),
        }),
      });
      const result = (await response.json()) as CreateQuotationResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage(`Cotizacion ${result.data.quotation.name} creada en borrador.`);
      router.refresh();
      window.setTimeout(() => {
        handleClose();
      }, 1600);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear la cotizacion."
      );
    } finally {
      setIsPending(false);
    }
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        disabled={customers.length === 0 || items.length === 0 || companies.length === 0}
      >
        Nueva cotizacion
      </Button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-background/80 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-3xl rounded-xl border bg-card p-5 shadow-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Nueva cotizacion</h2>
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
          <div className="grid gap-3 md:grid-cols-4">
            <div className="space-y-2 md:col-span-2">
              <Label>Cliente</Label>
              <select
                className={selectClassName}
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
              >
                <option value="">Selecciona cliente</option>
                {customers
                  .filter((item) => item.disabled !== 1)
                  .map((item) => (
                    <option key={item.name} value={item.name}>
                      {item.customer_name}
                    </option>
                  ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Empresa</Label>
              <select
                className={selectClassName}
                value={company}
                onChange={(event) => setCompany(event.target.value)}
              >
                <option value="">Selecciona empresa</option>
                {companies.map((item) => (
                  <option key={item.name} value={item.name}>
                    {item.company_name ?? item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={transactionDate}
                onChange={(event) => setTransactionDate(event.target.value)}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label>Valida hasta</Label>
              <Input
                type="date"
                value={validTill}
                onChange={(event) => setValidTill(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Productos</Label>
              <Button type="button" variant="outline" size="sm" onClick={addRow}>
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
                      Precio
                    </th>
                    <th className="py-2 pr-2 text-left font-medium">
                      Descuento %
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
                          onChange={(event) =>
                            updateRow(row.id, "item_code", event.target.value)
                          }
                        >
                          <option value="">Selecciona producto</option>
                          {items
                            .filter((item) => item.disabled !== 1)
                            .map((item) => (
                              <option key={item.name} value={item.item_code}>
                                {item.item_name} ({item.item_code})
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
                          onChange={(event) =>
                            updateRow(row.id, "qty", event.target.value)
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
                          onChange={(event) =>
                            updateRow(row.id, "rate", event.target.value)
                          }
                          className="h-8 w-24"
                        />
                      </td>
                      <td className="py-1.5 pr-2">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          value={row.discount_percentage}
                          onChange={(event) =>
                            updateRow(
                              row.id,
                              "discount_percentage",
                              event.target.value
                            )
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
                          x
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              La cotizacion se crea como borrador en ERPNext. No factura ni mueve
              inventario hasta que se procese en el ERP.
            </p>
          </div>

          <div className="space-y-2">
            <Label>Observacion opcional</Label>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              maxLength={1000}
            />
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
              {isPending ? "Creando..." : "Crear cotizacion"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

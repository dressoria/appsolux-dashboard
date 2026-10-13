"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
export type Row = Record<string, unknown>;
export type List = {
  items: Row[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};
export type Options = {
  accounts: Row[];
  customers: Row[];
  suppliers: Row[];
  users: Row[];
};
export const value = (row: Row | null | undefined, key: string) =>
  typeof row?.[key] === "string"
    ? (row[key] as string)
    : typeof row?.[key] === "number"
      ? String(row[key])
      : "";
export const child = (row: Row, key: string): Row =>
  row[key] && typeof row[key] === "object" ? (row[key] as Row) : {};
export const moneyLabel = (v: unknown) => {
  if (typeof v !== "string" || !/^-?\d+(\.\d+)?$/.test(v))
    return "No disponible";
  const [whole, fraction = ""] = v.split(".");
  return `$${whole}.${fraction.padEnd(2, "0")}`;
};
export const dateLabel = (v: unknown, time = false) =>
  typeof v === "string"
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "short",
        ...(time ? { timeStyle: "short" as const } : {}),
      }).format(new Date(v))
    : "No disponible";
export const ecuNow = () =>
  new Intl.DateTimeFormat("sv-SE", {
    timeZone: "America/Guayaquil",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(new Date())
    .replace(" ", "T");
export const fieldClass =
  "min-w-0 w-full rounded-lg border bg-background px-3 py-2 text-sm";
export const labels: Record<string, string> = {
  OPEN: "Abierto",
  CLOSED: "Cerrado",
  CANCELLED: "Cancelado",
  CONFIRMED: "Confirmado",
  RECONCILED: "Conciliado",
  PENDING: "Pendiente",
  PARTIAL: "Parcial",
  PAID: "Pagado",
  OVERDUE: "Vencido",
  AVAILABLE: "Disponible",
  PARTIALLY_APPLIED: "Aplicado parcialmente",
  APPLIED: "Aplicado",
  SETTLED: "Acreditado",
  DISPUTED: "En disputa",
  REVERSED: "Reversado",
  READY_TO_DEPOSIT: "Listo para depositar",
  DEPOSITED: "Depositado",
  CLEARED: "Clearing confirmado",
  BOUNCED: "Devuelto",
  DELIVERED: "Entregado",
  DRAFT: "Borrador",
  IN_PROGRESS: "En progreso",
  COMPLETED: "Completado",
  IN: "Entrada",
  OUT: "Salida",
  CASH: "Caja",
  BANK: "Banco",
  CARD: "Tarjeta",
  SALE_COLLECTION: "Cobro de venta",
  PURCHASE_PAYMENT: "Pago de compra",
  CASH_IN: "Ingreso de caja",
  CASH_OUT: "Egreso de caja",
  BANK_DEPOSIT: "Depósito",
  BANK_WITHDRAWAL: "Retiro",
  BANK_TRANSFER: "Transferencia",
  CUSTOMER_ADVANCE: "Anticipo cliente",
  SUPPLIER_ADVANCE: "Anticipo proveedor",
  CARD_COLLECTION: "Cobro tarjeta",
  CARD_SETTLEMENT: "Acreditación tarjeta",
  CARD_FEE: "Comisión tarjeta",
  CHECK_CLEARED: "Clearing cheque",
  CHECK_BOUNCED: "Cheque devuelto",
  ADJUSTMENT: "Ajuste",
  SALE_PAYMENT: "Pago de venta",
  PURCHASE_PAYMENT_SOURCE: "Pago de compra",
  OBLIGATION: "Cartera",
  TRANSFER: "Transferencia",
  ADVANCE: "Anticipo",
  CHECK: "Cheque",
  MANUAL: "Manual",
  REVERSAL: "Reverso",
  RECEIVABLE: "Por cobrar",
  PAYABLE: "Por pagar",
};
export function useResource<T>(url: string | null) {
  const [state, setState] = useState<{
    url: string | null;
    data: T | null;
    error: string | null;
  }>({ url: null, data: null, error: null });
  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error ?? "No se pudo cargar la información.");
        if (!controller.signal.aborted) setState({ url, data, error: null });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            url,
            data: null,
            error:
              error instanceof Error ? error.message : "Error de conexión.",
          });
      });
    return () => controller.abort();
  }, [url]);
  const current = !!url && state.url === url;
  return {
    data: current ? state.data : null,
    error: current ? state.error : null,
    loading: !!url && !current,
  };
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      role={error ? "alert" : "status"}
      className={`rounded-xl border p-4 text-sm ${error ? "border-red-200 bg-red-50 text-red-800" : "border-amber-200 bg-amber-50 text-amber-900"}`}
    >
      {children}
    </div>
  );
}
export function Status({ status }: { status: string }) {
  return (
    <span
      className={`rounded-md px-2 py-1 text-xs ${["PAID", "SETTLED", "COMPLETED", "RECONCILED", "CLEARED"].includes(status) ? "bg-green-50 text-green-800" : ["BOUNCED", "CANCELLED", "OVERDUE"].includes(status) ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}
export type Column = { label: string; render: (row: Row) => ReactNode };
export function DataTable({
  data,
  columns,
  page,
  setPage,
  empty = "No hay registros para estos filtros.",
}: {
  data: List;
  columns: Column[];
  page: number;
  setPage: (n: number) => void;
  empty?: string;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">{data.total} registros</p>
      {!data.items.length ? (
        <p className="rounded-xl border bg-background p-8 text-center text-sm text-muted-foreground">
          {empty}
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-[850px] text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                {columns.map((c) => (
                  <th
                    className="whitespace-nowrap p-3 font-medium"
                    key={c.label}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.items.map((row) => (
                <tr className="border-t align-top" key={value(row, "id")}>
                  {columns.map((c) => (
                    <td className="p-3" key={c.label}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex items-center justify-between gap-3 text-sm">
        <span>
          Página {page} de {Math.max(1, data.totalPages)}
        </span>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Anterior
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= data.totalPages}
            onClick={() => setPage(page + 1)}
          >
            Siguiente
          </Button>
        </div>
      </div>
    </div>
  );
}
export type Field = {
  name: string;
  label: string;
  type?:
    | "text"
    | "money"
    | "signed-money"
    | "date"
    | "datetime-local"
    | "checkbox"
    | "number"
    | "select";
  required?: boolean;
  initial?: string | boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
};
export function ActionForm({
  title,
  fields,
  submit,
  busy,
  close,
  help,
}: {
  title: string;
  fields: Field[];
  submit: (body: Row) => Promise<void>;
  busy: boolean;
  close?: () => void;
  help?: string;
}) {
  const [requestKey] = useState(() => crypto.randomUUID());
  return (
    <form
      className="space-y-4 rounded-xl border bg-background p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        const body: Row = { requestKey };
        for (const field of fields) {
          const raw = data.get(field.name);
          body[field.name] =
            field.type === "checkbox"
              ? data.has(field.name)
              : field.type === "datetime-local" && raw
                ? `${String(raw)}:00-05:00`
                : (raw ?? "");
        }
        void submit(body);
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{title}</h2>
        {close && (
          <Button variant="ghost" size="sm" type="button" onClick={close}>
            Cerrar
          </Button>
        )}
      </div>
      {help && <p className="text-sm text-muted-foreground">{help}</p>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((f) => (
          <label key={f.name} className="grid gap-1 text-sm">
            {f.label}
            {f.type === "select" ? (
              <select
                className={fieldClass}
                required={f.required !== false}
                name={f.name}
                defaultValue={String(f.initial ?? "")}
              >
                <option value="">Seleccionar</option>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : f.type === "checkbox" ? (
              <input
                className="h-4 w-4 accent-blue-600"
                type="checkbox"
                name={f.name}
                defaultChecked={f.initial === true}
              />
            ) : (
              <input
                className={fieldClass}
                name={f.name}
                required={f.required !== false}
                type={
                  f.type === "money" || f.type === "signed-money"
                    ? "text"
                    : (f.type ?? "text")
                }
                inputMode={f.type?.includes("money") ? "decimal" : undefined}
                pattern={
                  f.type === "money"
                    ? "[0-9]{1,12}(\.[0-9]{1,2})?"
                    : f.type === "signed-money"
                      ? "-?[0-9]{1,12}(\.[0-9]{1,2})?"
                      : undefined
                }
                defaultValue={
                  typeof f.initial === "string" ? f.initial : undefined
                }
                min={f.min}
                max={f.max}
                maxLength={2000}
              />
            )}
          </label>
        ))}
      </div>
      <Button
        className="bg-blue-600 text-white hover:bg-blue-700"
        disabled={busy}
        type="submit"
      >
        {busy ? "Guardando…" : "Confirmar"}
      </Button>
    </form>
  );
}
export const selectOptions = (rows: Row[] = [], extra?: (row: Row) => string) =>
  rows.map((row) => ({
    value: value(row, "id"),
    label: `${value(row, "name")}${extra ? extra(row) : ""}`,
  }));
export const apiPost = async (path: string, body: Row) => {
  const res = await fetch(`/api/treasury/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok)
    throw new Error(data.error ?? "No se pudo completar la operación.");
  return data as Row;
};

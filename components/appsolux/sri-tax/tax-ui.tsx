"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { TaxIssue } from "@/lib/core/sri-tax/types";

export const currency = (value: string | null | undefined) =>
  value === null || value === undefined ? "No disponible" : `$${value}`;
export const dateLabel = (value: string | null) =>
  value
    ? new Intl.DateTimeFormat("es-EC", {
        timeZone: "America/Guayaquil",
        dateStyle: "short",
      }).format(new Date(value))
    : "No disponible";
export const TYPE_LABELS: Record<string, string> = {
  INVOICE: "Factura",
  CREDIT_NOTE: "Nota de crédito",
  DEBIT_NOTE: "Nota de débito",
  PURCHASE_SETTLEMENT: "Liquidación de compra",
  WITHHOLDING: "Retención recibida",
  OTHER: "Otros",
};
export const STATUS_LABELS: Record<string, string> = {
  NEW: "Pendiente",
  CLASSIFIED: "Clasificado",
  NEEDS_REVIEW: "Con problemas",
  REGISTERED: "Registrado",
  AUTHORIZED: "Autorizado",
  IGNORED: "Ignorado",
  DRAFT: "Pendiente",
  CANCELLED: "Anulado",
  REJECTED: "Rechazado",
};
export const fieldClass =
  "min-w-0 rounded-lg border bg-background px-3 py-2 text-sm";

export function useTaxResource<T>(url: string | null) {
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
        if (!controller.signal.aborted)
          setState({ url, data: data as T, error: null });
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
export function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="text-xl font-semibold tabular-nums">{value}</p>
        {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
      </CardContent>
    </Card>
  );
}
export function LoadingError({
  loading,
  error,
}: {
  loading: boolean;
  error: string | null;
}) {
  return loading ? (
    <p role="status" className="py-6 text-sm text-muted-foreground">
      Cargando información tributaria…
    </p>
  ) : error ? (
    <Notice error>{error}</Notice>
  ) : null;
}
export function Pager({
  page,
  totalPages,
  setPage,
}: {
  page: number;
  totalPages: number;
  setPage: (page: number) => void;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
      <span>
        Página {page} de {Math.max(totalPages, 1)}
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
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Siguiente
        </Button>
      </div>
    </div>
  );
}
export function IssuesTable({ issues }: { issues: TaxIssue[] }) {
  const [page, setPage] = useState(1);
  const effectivePage = Math.min(
    page,
    Math.max(1, Math.ceil(issues.length / 25)),
  );
  if (!issues.length)
    return (
      <p className="py-5 text-sm text-muted-foreground">
        Sin observaciones para estos filtros.
      </p>
    );
  return (
    <>
      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead className="bg-muted/50">
            <tr>
              {[
                "Severidad",
                "Código",
                "Documento",
                "Descripción",
                "Acción sugerida",
              ].map((h) => (
                <th key={h} className="p-3 font-medium">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {issues
              .slice((effectivePage - 1) * 25, effectivePage * 25)
              .map((i, index) => (
                <tr
                  key={`${i.code}-${i.document}-${index}`}
                  className="border-t align-top"
                >
                  <td className="p-3">
                    <span
                      className={`rounded-md px-2 py-1 text-xs ${i.severity === "ERROR" ? "bg-red-50 text-red-800" : i.severity === "WARNING" ? "bg-amber-50 text-amber-800" : "bg-muted text-muted-foreground"}`}
                    >
                      {i.severity === "ERROR"
                        ? "Error"
                        : i.severity === "WARNING"
                          ? "Advertencia"
                          : "Información"}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{i.code}</td>
                  <td className="p-3">{i.document ?? "Período"}</td>
                  <td className="max-w-sm p-3">{i.description}</td>
                  <td className="max-w-xs p-3">
                    {i.action}
                    {i.href && (
                      <Link
                        href={i.href}
                        className="mt-1 block text-blue-600 hover:underline"
                      >
                        Abrir documento
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <Pager
        page={effectivePage}
        totalPages={Math.ceil(issues.length / 25)}
        setPage={setPage}
      />
    </>
  );
}

export async function downloadResponse(res: Response, filename: string) {
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "No se pudo exportar el reporte.");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

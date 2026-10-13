"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { AtsPeriodData } from "@/lib/core/sri-tax/ats-data";
import { TAX_REPORT_FOOTER } from "@/lib/core/sri-tax/ats-summary";
import {
  currency,
  downloadResponse,
  IssuesTable,
  LoadingError,
  Metric,
  Notice,
  Pager,
  TYPE_LABELS,
  useTaxResource,
} from "./tax-ui";

export function AtsReportClient({
  query,
  summary,
}: {
  query: string;
  summary: boolean;
}) {
  const { data, loading, error } = useTaxResource<AtsPeriodData>(
    `/api/sri-tax/ats/preview?${query}`,
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  async function download(format: "xml" | "pdf") {
    setBusy(true);
    setExportError(null);
    try {
      await downloadResponse(
        await fetch(
          `/api/sri-tax/ats/${format === "xml" ? "xml" : "summary"}?${query}${format === "pdf" ? "&format=pdf" : ""}`,
        ),
        `${format === "xml" ? "ATS" : "ATS_Resumen"}_${data?.company?.ruc ?? "empresa"}_${data?.period.key}.${format}`,
      );
    } catch (error) {
      setExportError(
        error instanceof Error ? error.message : "Error al descargar.",
      );
    } finally {
      setBusy(false);
    }
  }
  const docs = data
    ? [
        ...data.purchases,
        ...data.sales,
        ...data.withholdings,
        ...data.cancelled,
      ]
    : [];
  return (
    <div className="space-y-5">
      <LoadingError loading={loading} error={error} />
      {exportError && <Notice error>{exportError}</Notice>}
      {data && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">
                {summary
                  ? "Talón resumen ATS · Facturom"
                  : "Anexo Transaccional Simplificado (ATS)"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {data.company?.legalName ?? "Empresa por completar"} · RUC{" "}
                {data.company?.ruc ?? "Por completar"} · {data.period.label}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => download("pdf")}
              >
                Descargar PDF del resumen
              </Button>
              <Button
                className="bg-blue-600 text-white hover:bg-blue-700"
                disabled={
                  busy ||
                  data.domainStatus !== "DOMAIN_VALIDATION_OK" ||
                  data.xsdStatus === "XSD_VALIDATION_ERROR"
                }
                onClick={() => download("xml")}
              >
                Descargar XML ATS
              </Button>
            </div>
          </div>
          {!data.hasInformation && (
            <Notice>
              Sin información definitiva registrada en el período. Los totales
              cero representan registros locales; verifica la integridad del
              período antes de usar un anexo sin transacciones.
            </Notice>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Ventas"
              value={currency(data.totals.sales.base)}
              detail={`${data.totals.sales.count} registros · IVA ${currency(data.totals.sales.iva)}`}
            />
            <Metric
              label="Compras"
              value={currency(data.totals.purchases.base)}
              detail={`${data.totals.purchases.count} registros · IVA ${currency(data.totals.purchases.iva)}`}
            />
            <Metric
              label="Retenciones emitidas"
              value={currency(data.totals.withholdings.amount)}
              detail={`${data.totals.withholdings.count} registros`}
            />
            <Metric
              label="Documentos cancelados registrados"
              value={String(data.totals.cancelled.count)}
              detail="Aplicabilidad ATS por verificar"
            />
          </div>
          <section className="grid gap-2 rounded-xl border p-4 text-sm">
            <h3 className="font-semibold">Estado de validación</h3>
            <p>
              Validación interna Facturom:{" "}
              {data.domainStatus === "DOMAIN_VALIDATION_OK" ? "OK" : "Errores"}
            </p>
            <p>
              XML:{" "}
              {data.xmlStatus === "XML_GENERATED" ? "Generado" : "Pendiente"}
            </p>
            <p>
              Validación XSD:{" "}
              {data.xsdStatus === "XSD_VALIDATED"
                ? "OK"
                : data.xsdStatus === "XSD_VALIDATION_ERROR"
                  ? "Error"
                  : "Pendiente"}
            </p>
            <p className="text-muted-foreground">
              Este resumen condensa registros de Facturom. La validación
              estructural no acredita la presentación ni aceptación del anexo.
            </p>
          </section>
          <IssuesTable issues={data.issues} />
          {!summary && (
            <section className="space-y-3">
              <h3 className="font-semibold">Vista previa de registros</h3>
              {!docs.length ? (
                <p className="text-sm text-muted-foreground">
                  No hay transacciones definitivas para mostrar.
                </p>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full min-w-[700px] text-left text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {[
                            "Operación",
                            "Documento",
                            "Tipo",
                            "Base",
                            "IVA",
                          ].map((h) => (
                            <th className="p-3" key={h}>
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {docs.slice((page - 1) * 25, page * 25).map((d) => (
                          <tr className="border-t" key={d.id}>
                            <td className="p-3">
                              {d.direction === "SALE" ? "Emitido" : "Compra"}
                            </td>
                            <td className="p-3">
                              <Link className="text-blue-600" href={d.href}>
                                {d.number ?? d.id}
                              </Link>
                            </td>
                            <td className="p-3">
                              {TYPE_LABELS[d.type] ?? d.type}
                              {d.status === "CANCELLED" && " · Cancelado"}
                            </td>
                            <td className="p-3">
                              {d.type === "CREDIT_NOTE" ? "−" : ""}
                              {currency(d.base)}
                            </td>
                            <td className="p-3">
                              {d.type === "CREDIT_NOTE" ? "−" : ""}
                              {currency(d.iva)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pager
                    page={page}
                    totalPages={Math.ceil(docs.length / 25)}
                    setPage={setPage}
                  />
                </>
              )}
            </section>
          )}
          <p className="text-xs text-muted-foreground">{TAX_REPORT_FOOTER}</p>
        </>
      )}
    </div>
  );
}

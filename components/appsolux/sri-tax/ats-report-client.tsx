"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BlobButton } from "@/components/ui/blob-button";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { AnimatedFormPanel } from "@/components/ui/animated-form-panel";
import { atsPreparationState } from "@/lib/core/sri-tax/ui-state";
import { TaxDiagnostics } from "./tax-diagnostics";
import type { AtsPeriodData } from "@/lib/core/sri-tax/ats-data";
import { TAX_REPORT_FOOTER } from "@/lib/core/sri-tax/ats-summary";
import {
  currency,
  downloadResponse,
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
  revision = 0,
}: {
  query: string;
  summary: boolean;
  revision?: number;
}) {
  const [stage, setStage] = useState("prepare");
  const [attempt, setAttempt] = useState(0);
  const { data, loading, error } = useTaxResource<AtsPeriodData>(
    `/api/sri-tax/ats/preview?${query}&revision=${revision}&attempt=${attempt}`,
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
  const state = data ? atsPreparationState(data) : null;
  return (
    <div className="space-y-5">
      <LoadingError loading={loading} error={error} />
      {exportError && <Notice error>{exportError}</Notice>}
      {!summary && <AnimatedSegmentedControl label="Etapas del ATS" value={stage} onValueChange={setStage}
        options={[{ value: "prepare", label: "Preparar" }, { value: "review", label: "Revisar" }, { value: "generate", label: "Generar" }]} className="w-full max-w-xl" />}
      {!summary && <p className="text-sm text-slate-600">Prepara los registros, revisa los diagnósticos y comprueba los requisitos del XML. Este flujo no envía anexos al SRI.</p>}
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
                Resumen local (PDF)
              </Button>
              <BlobButton disabled={busy || loading} onClick={() => { setStage("generate"); setAttempt((value) => value + 1); setExportError(null); }}>Generar ATS</BlobButton>
            </div>
          </div>
          <AnimatedFormPanel mode={summary ? "summary" : stage}>
          <div className="space-y-5">
          {!data.hasInformation && (
            <Notice>
              Sin información definitiva registrada en el período. Los totales
              cero representan registros locales; verifica la integridad del
              período antes de usar un anexo sin transacciones.
            </Notice>
          )}
          {(summary || stage === "prepare") && <>
          <p className="rounded-xl border bg-white p-4 text-sm text-slate-600">Frecuencia consultada: {data.period.frequency === "MONTHLY" ? "mensual" : "semestral"}. Su aplicabilidad a esta empresa requiere confirmar la obligación tributaria; no se deduce de sus movimientos.</p>
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
          <Metric label="Documentos modificados registrados" value={String([...data.sales, ...data.purchases].filter((document) => ["CREDIT_NOTE", "DEBIT_NOTE"].includes(document.type)).length)} detail="Notas de crédito y débito en los registros del período." />
          {!summary && <Button type="button" variant="outline" onClick={() => setStage("review")}>Revisar documentos y diagnósticos</Button>}
          </>}
          {(summary || stage === "generate") && <>
          {state && <Notice error={state.errors.length > 0 || data.xsdStatus === "XSD_VALIDATION_ERROR"}><strong className="block">{state.title}</strong><span className="mt-1 block">{state.nextAction}</span></Notice>}
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
          <div className="space-y-2"><BlobButton disabled={busy || !state?.canDownloadXml} onClick={() => download("xml")}>Descargar XML ATS</BlobButton><p className="text-xs text-slate-600">La descarga requiere validaciones internas y XSD correctas y XML generado. Un resumen visual no sustituye al XML ni acredita presentación o aceptación del SRI.</p></div>
          </>}
          {(summary || stage === "review" || stage === "generate") && <TaxDiagnostics issues={data.issues} />}
          {!summary && stage === "review" && (
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
          </div>
          </AnimatedFormPanel>
          <p className="text-xs text-muted-foreground">{TAX_REPORT_FOOTER}</p>
        </>
      )}
    </div>
  );
}

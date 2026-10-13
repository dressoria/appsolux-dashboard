"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  IVA_CLASSIFICATIONS,
  type IvaClassification,
} from "@/lib/core/sri-tax/iva-104-catalog";
import type {
  Iva104Report,
  IvaManualInputs,
} from "@/lib/core/sri-tax/iva-104-report";
import type { PeriodSelection } from "./tax-center-client";
import {
  currency,
  downloadResponse,
  fieldClass,
  IssuesTable,
  LoadingError,
  Metric,
  Notice,
  Pager,
} from "./tax-ui";

export function Iva104Client({ period }: { period: PeriodSelection }) {
  const [report, setReport] = useState<Iva104Report | null>(null);
  const [manual, setManual] = useState<IvaManualInputs>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/sri-tax/iva-104", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(period),
      signal: controller.signal,
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Error al generar reporte.");
        if (!controller.signal.aborted) {
          setReport(data);
          setLoading(false);
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            error instanceof Error ? error.message : "Error de conexión.",
          );
          setLoading(false);
        }
      });
    return () => controller.abort();
  }, [period]);
  async function generate(format = "json") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/sri-tax/iva-104", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...period, manualInputs: manual, format }),
      });
      if (format !== "json")
        await downloadResponse(
          res,
          `IVA104_${period.year}${String(period.month).padStart(2, "0")}_Facturom.${format}`,
        );
      else {
        const data = await res.json();
        if (!res.ok)
          throw new Error(data.error ?? "No se pudo generar el reporte.");
        setReport(data);
        setDirty(false);
        setPage(1);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Error de conexión.");
    } finally {
      setBusy(false);
    }
  }
  function setValue(key: keyof IvaManualInputs, value: string) {
    setManual((m) => ({ ...m, [key]: value }));
    setDirty(true);
  }
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">
        Reporte de apoyo para la declaración de IVA · ESTIMADO
      </p>
      <LoadingError loading={loading} error={error} />
      {report && (
        <>
          <div className="flex flex-wrap justify-between gap-3">
            <p className="text-sm">
              {report.company?.legalName ?? "Empresa por completar"} · RUC{" "}
              {report.company?.ruc ?? "Por completar"} · {report.period.label}
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={busy || dirty}
                onClick={() => generate("pdf")}
              >
                PDF
              </Button>
              <Button
                variant="outline"
                disabled={busy || dirty}
                onClick={() => generate("xlsx")}
              >
                XLSX
              </Button>
            </div>
          </div>
          <section className="space-y-3 rounded-xl border p-4">
            <div className="flex flex-wrap justify-between gap-2">
              <h2 className="font-semibold">Completitud del reporte</h2>
              <strong>{report.completeness.percentage}%</strong>
            </div>
            <progress
              className="h-2 w-full accent-blue-600"
              max={100}
              value={report.completeness.percentage}
              aria-label="Completitud del reporte"
            />
            <ul className="grid gap-1 text-sm sm:grid-cols-2">
              {report.completeness.factors.map((f) => (
                <li
                  key={f.label}
                  className={f.complete ? "text-green-700" : "text-amber-800"}
                >
                  {f.complete ? "✓" : "Pendiente:"} {f.label}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              Porcentaje de controles completados; no es una certificación de
              exactitud tributaria.
            </p>
          </section>
          <form
            className="space-y-3 rounded-xl border p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <h2 className="font-semibold">
              Saldos y crédito aplicable{" "}
              <span className="rounded bg-muted px-2 py-1 text-xs font-normal">
                Dato manual
              </span>
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  [
                    "previousPurchasesCredit",
                    "605 · Saldo crédito compras período anterior",
                  ],
                  [
                    "previousWithholdingsCredit",
                    "606 · Saldo por retenciones período anterior",
                  ],
                  [
                    "applicablePurchasesCredit",
                    "564 · Crédito tributario aplicable revisado",
                  ],
                ] as const
              ).map(([key, label]) => (
                <label className="grid gap-1 text-sm" key={key}>
                  {label}
                  <input
                    className={fieldClass}
                    type="text"
                    inputMode="decimal"
                    pattern="[0-9]{1,10}(\.[0-9]{1,2})?"
                    placeholder="Por completar"
                    value={manual[key] ?? ""}
                    onChange={(e) => setValue(key, e.target.value)}
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Usa punto decimal. Los valores vacíos permanecen desconocidos.
              Verifica el factor de proporcionalidad o tu contabilidad para el
              crédito aplicable.
            </p>
            {dirty && (
              <Notice>
                Hay cambios manuales pendientes de aplicar. Actualiza el reporte
                antes de exportarlo.
              </Notice>
            )}
            <Button
              className="bg-blue-600 text-white hover:bg-blue-700"
              disabled={busy}
              type="submit"
            >
              Actualizar reporte
            </Button>
          </form>
          {(
            [
              ["SALE", "A. Resumen de ventas"],
              ["PURCHASE", "B. Resumen de compras y gastos"],
            ] as const
          ).map(([direction, title]) => (
            <section key={direction} className="space-y-3">
              <h2 className="font-semibold">{title}</h2>
              <div className="overflow-x-auto rounded-xl border">
                <table className="w-full min-w-[800px] text-left text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {[
                        "Casilleros",
                        "Concepto",
                        "Valor bruto",
                        "Valor neto",
                        "Impuesto generado",
                      ].map((h) => (
                        <th key={h} className="p-3 font-medium">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {report.rows
                      .filter((r) => r.direction === direction)
                      .map((r) => (
                        <tr className="border-t" key={r.key}>
                          <td className="p-3 font-mono text-xs">
                            {r.codes.join(" / ")}
                          </td>
                          <td className="p-3">
                            {r.label}
                            {r.manual && (
                              <span className="ml-2 rounded bg-muted px-1 text-xs">
                                Dato manual
                              </span>
                            )}
                          </td>
                          <td className="p-3 tabular-nums">
                            {currency(r.gross)}
                          </td>
                          <td className="p-3 tabular-nums">
                            {currency(r.net)}
                          </td>
                          <td className="p-3 tabular-nums">
                            {r.codes.length === 3
                              ? currency(r.iva)
                              : "No aplica"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-muted-foreground">
                Total registrado: Base{" "}
                {currency(
                  direction === "SALE"
                    ? report.sales.base
                    : report.purchases.base,
                )}{" "}
                · IVA{" "}
                {currency(
                  direction === "SALE"
                    ? report.sales.iva
                    : report.purchases.iva,
                )}
                . Incluye montos pendientes de clasificación.
              </p>
            </section>
          ))}
          <section className="space-y-3">
            <h2 className="font-semibold">Tasas históricas registradas</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {report.rateGroups.map((r) => (
                <Metric
                  key={`${r.direction}-${r.rate}`}
                  label={`${r.direction === "SALE" ? "Ventas" : "Compras"} · IVA ${r.rate}%`}
                  value={currency(r.base)}
                  detail={`IVA ${currency(r.iva)} · Separación por tasa, clasificación fiscal por verificar`}
                />
              ))}
            </div>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">C. Resumen de impuesto · ESTIMADO</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Metric
                label="601 · Impuesto causado estimado"
                value={currency(report.tax.causedTax)}
              />
              <Metric
                label="Crédito disponible estimado"
                value={currency(report.tax.availableCredit)}
              />
              <Metric
                label="609 · Retenciones IVA recibidas"
                value={currency(report.tax.receivedWithholdings)}
              />
              <Metric
                label="Subtotal parcial antes de retenciones y ajustes"
                value={currency(report.tax.preliminarySubtotal)}
              />
              <Metric
                label="Subtotal a pagar"
                value={currency(report.tax.subtotal)}
              />
              <Metric
                label="Total ESTIMADO"
                value={currency(report.tax.totalEstimated)}
              />
            </div>
            <Notice>
              El subtotal parcial omite retenciones y ajustes desconocidos. El
              total permanece no disponible mientras falten estos datos.
            </Notice>
          </section>
          <section className="space-y-3">
            <h2 className="font-semibold">D. Operaciones por clasificar</h2>
            <p className="text-sm text-muted-foreground">
              Las clasificaciones son manuales y temporales. Operaciones mixtas,
              tarifas diferenciadas e importaciones necesitan una clasificación
              específica aún pendiente.
            </p>
            {report.unclassified.length ? (
              <>
                <div className="overflow-x-auto rounded-xl border">
                  <table className="w-full min-w-[900px] text-left text-sm">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Documento",
                          "Operación",
                          "Base",
                          "IVA",
                          "Clasificación fiscal temporal",
                        ].map((h) => (
                          <th className="p-3" key={h}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {report.unclassified
                        .slice((page - 1) * 25, page * 25)
                        .map((d) => (
                          <tr className="border-t" key={d.id}>
                            <td className="p-3">
                              <Link href={d.href} className="text-blue-600">
                                {d.number ?? d.id}
                              </Link>
                            </td>
                            <td className="p-3">
                              {d.direction === "SALE" ? "Venta" : "Compra"}
                            </td>
                            <td className="p-3">{currency(d.base)}</td>
                            <td className="p-3">{currency(d.iva)}</td>
                            <td className="p-3">
                              <select
                                aria-label={`Clasificación fiscal de ${d.number ?? d.id}`}
                                className={`${fieldClass} max-w-80`}
                                value={manual.classifications?.[d.id] ?? ""}
                                onChange={(e) => {
                                  const value = e.target.value;
                                  setManual((m) => {
                                    const classifications = {
                                      ...m.classifications,
                                    };
                                    if (value)
                                      classifications[d.id] =
                                        value as IvaClassification;
                                    else delete classifications[d.id];
                                    return { ...m, classifications };
                                  });
                                  setDirty(true);
                                }}
                              >
                                <option value="">Por clasificar</option>
                                {Object.entries(IVA_CLASSIFICATIONS)
                                  .filter(
                                    ([, definition]) =>
                                      definition.direction === d.direction,
                                  )
                                  .map(([key, definition]) => (
                                    <option value={key} key={key}>
                                      {definition.label}
                                    </option>
                                  ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <Pager
                  page={page}
                  totalPages={Math.ceil(report.unclassified.length / 25)}
                  setPage={setPage}
                />
                <Button disabled={busy || !dirty} onClick={() => generate()}>
                  Aplicar clasificaciones
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin operaciones pendientes de clasificación.
              </p>
            )}
            {Object.keys(manual.classifications ?? {}).length > 0 && (
              <Button
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setManual((m) => ({ ...m, classifications: {} }));
                  setDirty(true);
                }}
              >
                Quitar clasificaciones temporales
              </Button>
            )}
          </section>
          <div className="space-y-2">
            {report.observations.map((observation) => (
              <p className="text-sm text-amber-800" key={observation}>
                {observation}
              </p>
            ))}
            <p className="text-xs text-muted-foreground">
              Casilleros pendientes de clasificación o cálculo:{" "}
              {report.pendingBoxes.join(", ")}
            </p>
          </div>
          <IssuesTable issues={report.issues} />
        </>
      )}
    </div>
  );
}

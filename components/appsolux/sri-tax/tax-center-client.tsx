"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { SRI_TAX_NAVIGATION } from "@/config/sri-tax-navigation";
import type { buildSriTaxSummary } from "@/lib/core/sri-tax/sri-tax-summary";
import type { getReceivedSyncState } from "@/lib/core/sri-tax/received-documents";
import type { TaxIssue } from "@/lib/core/sri-tax/types";
import { ReceivedDocumentsClient } from "./received-documents-client";
import { AtsReportClient } from "./ats-report-client";
import { Iva104Client } from "./iva-104-client";
import {
  currency,
  fieldClass,
  IssuesTable,
  LoadingError,
  Metric,
  Notice,
  useTaxResource,
} from "./tax-ui";

export type TaxView =
  "summary" | "received" | "ats" | "ats-summary" | "iva-104" | "validations";
export type PeriodSelection = {
  year: number;
  month: number;
  frequency: "MONTHLY" | "SEMIANNUAL";
};
export const periodQuery = (period: PeriodSelection) =>
  new URLSearchParams({
    year: String(period.year),
    month: String(period.month),
    frequency: period.frequency,
  }).toString();

export function TaxCenterClient({
  view,
  initialYear,
  initialMonth,
}: {
  view: TaxView;
  initialYear: number;
  initialMonth: number;
}) {
  const [selection, setSelection] = useState<PeriodSelection>({
    year: initialYear,
    month: initialMonth,
    frequency: "MONTHLY",
  });
  const [period, setPeriod] = useState(selection);
  if (view === "received") return <ReceivedDocumentsClient />;
  return (
    <div className="space-y-6">
      <form
        className="flex flex-wrap items-end gap-3 rounded-xl border p-4"
        onSubmit={(event) => {
          event.preventDefault();
          setPeriod({ ...selection });
        }}
      >
        <label className="grid gap-1 text-sm">
          Presentación
          <select
            className={fieldClass}
            value={selection.frequency}
            onChange={(e) => {
              const frequency = e.target.value as PeriodSelection["frequency"];
              setSelection((s) => ({
                ...s,
                frequency,
                month:
                  frequency === "SEMIANNUAL"
                    ? s.month <= 6
                      ? 6
                      : 12
                    : s.month,
              }));
            }}
          >
            <option value="MONTHLY">Mensual</option>
            <option value="SEMIANNUAL">Semestral</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          {selection.frequency === "MONTHLY" ? "Mes" : "Semestre"}
          <select
            className={fieldClass}
            value={selection.month}
            onChange={(e) =>
              setSelection((s) => ({ ...s, month: Number(e.target.value) }))
            }
          >
            {selection.frequency === "MONTHLY" ? (
              [
                "Enero",
                "Febrero",
                "Marzo",
                "Abril",
                "Mayo",
                "Junio",
                "Julio",
                "Agosto",
                "Septiembre",
                "Octubre",
                "Noviembre",
                "Diciembre",
              ].map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))
            ) : (
              <>
                <option value={6}>Primer semestre</option>
                <option value={12}>Segundo semestre</option>
              </>
            )}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Año
          <input
            className={`${fieldClass} w-28`}
            type="number"
            min={2000}
            max={initialYear}
            required
            value={selection.year}
            onChange={(e) =>
              setSelection((s) => ({ ...s, year: Number(e.target.value) }))
            }
          />
        </label>
        <Button
          className="bg-blue-600 text-white hover:bg-blue-700"
          type="submit"
        >
          {view === "ats" ? "Generar ATS" : "Consultar período"}
        </Button>
      </form>
      <p className="text-sm text-muted-foreground">
        Período consultado: {period.month.toString().padStart(2, "0")}/
        {period.year} ·{" "}
        {period.frequency === "MONTHLY" ? "Mensual" : "Semestral"}. La
        frecuencia requiere verificar tu obligación tributaria.
      </p>
      {view === "summary" && <SummaryClient query={periodQuery(period)} />}
      {(view === "ats" || view === "ats-summary") && (
        <AtsReportClient
          key={periodQuery(period)}
          query={periodQuery(period)}
          summary={view === "ats-summary"}
        />
      )}
      {view === "iva-104" && (
        <Iva104Client key={periodQuery(period)} period={period} />
      )}
      {view === "validations" && (
        <ValidationsClient query={periodQuery(period)} />
      )}
    </div>
  );
}

function SummaryClient({ query }: { query: string }) {
  const { data, loading, error } = useTaxResource<
    ReturnType<typeof buildSriTaxSummary> & {
      sync: Awaited<ReturnType<typeof getReceivedSyncState>>;
    }
  >(`/api/sri-tax/summary?${query}`);
  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SRI_TAX_NAVIGATION.slice(1).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border bg-background p-4 font-medium transition-colors hover:border-blue-400"
          >
            {item.title}
            <span className="mt-2 block text-sm font-normal text-blue-600">
              Abrir →
            </span>
          </Link>
        ))}
      </div>
      <LoadingError loading={loading} error={error} />
      {data && (
        <>
          <p className="text-sm">
            {data.company?.legalName ?? "Empresa por completar"} · RUC{" "}
            {data.company?.ruc ?? "Por completar"}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Ventas netas registradas"
              value={currency(data.sales.base)}
            />
            <Metric
              label="IVA generado registrado"
              value={currency(data.sales.iva)}
            />
            <Metric
              label="Compras netas registradas"
              value={currency(data.purchases.base)}
            />
            <Metric
              label="IVA compras / crédito potencial"
              value={currency(data.purchases.iva)}
            />
            <Metric
              label="Retenciones emitidas"
              value={currency(data.issuedWithholdings)}
            />
            <Metric
              label="Retenciones recibidas"
              value={currency(data.receivedWithholdings)}
            />
            <Metric
              label="Comprobantes con problemas"
              value={String(data.problems)}
            />
          </div>
          <Notice>{data.coverage}</Notice>
          <section className="space-y-3 rounded-xl border p-4">
            <h2 className="font-semibold">Estado del período</h2>
            <p className="text-sm">ATS: {data.atsStatus}</p>
            <p className="text-sm">Formulario IVA: {data.ivaStatus}</p>
            <p className="text-sm">
              Comprobantes recibidos: {data.received.registered} registrados ·{" "}
              {data.received.pending} pendientes
            </p>
          </section>
          <section className="space-y-2 rounded-xl border p-4">
            <h2 className="font-semibold">
              Comprobantes recibidos · automatización
            </h2>
            <p className="text-sm">
              Estado:{" "}
              {data.sync.available
                ? data.sync.syncStatus === "ACTIVE"
                  ? "Activo"
                  : data.sync.syncStatus === "ERROR"
                    ? "Error"
                    : "Pendiente"
                : "Pendiente de instalación"}
            </p>
            <p className="text-sm">
              Última sincronización:{" "}
              {data.sync.lastSyncAt
                ? new Date(data.sync.lastSyncAt).toLocaleString("es-EC", {
                    timeZone: "America/Guayaquil",
                  })
                : "No disponible"}
            </p>
            <Link
              className="text-sm text-blue-600"
              href="/facturacion/sri/received"
            >
              Ver comprobantes
            </Link>
          </section>
        </>
      )}
    </div>
  );
}

function ValidationsClient({ query }: { query: string }) {
  const [severity, setSeverity] = useState("");
  const [type, setType] = useState("");
  const { data, loading, error } = useTaxResource<{ issues: TaxIssue[] }>(
    `/api/sri-tax/validations?${query}&severity=${severity}&type=${type}`,
  );
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <label className="grid gap-1 text-sm">
          Severidad
          <select
            className={fieldClass}
            value={severity}
            onChange={(e) => setSeverity(e.target.value)}
          >
            <option value="">Todas</option>
            <option value="ERROR">Errores</option>
            <option value="WARNING">Advertencias</option>
            <option value="INFO">Información</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Tipo
          <select
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos</option>
            <option value="SALE">Ventas / emitidos</option>
            <option value="PURCHASE">Compras</option>
            <option value="RECEIVED">Recibidos</option>
            <option value="PERIOD">Período</option>
            <option value="ATS">ATS</option>
          </select>
        </label>
      </div>
      <LoadingError loading={loading} error={error} />
      {data && (
        <>
          <p className="text-sm text-muted-foreground">
            {data.issues.length} observaciones. Los comprobantes pendientes no
            se incluyen como transacciones definitivas.
          </p>
          <IssuesTable
            key={`${severity}-${type}-${query}`}
            issues={data.issues}
          />
        </>
      )}
    </div>
  );
}

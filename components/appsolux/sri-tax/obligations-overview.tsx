import { ShieldQuestion } from "lucide-react";
import { Metric, dateLabel } from "./tax-ui";
import styles from "./sri-center.module.css";

export function ObligationsOverview({ company, period, loadedAt }: {
  company: { legalName: string; ruc: string } | null;
  period: string;
  loadedAt: string | null;
}) {
  return <section className="space-y-5" aria-label="Obligaciones tributarias">
    <div className={`${styles.panel} flex flex-wrap items-start justify-between gap-4`}>
      <div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-facturom-action-strong">Obligaciones tributarias</p><h2 className="mt-2 break-words text-xl font-semibold">{company?.legalName ?? "Datos fiscales por completar"}</h2><p className="mt-1 text-sm text-slate-600">RUC {company?.ruc ?? "No disponible"} · {period}</p></div>
      <span className="flex items-center gap-2 rounded-full bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900"><ShieldQuestion className="size-4" aria-hidden="true" />Sin verificar</span>
      <dl className="grid w-full gap-3 border-t pt-3 text-xs text-slate-600 sm:grid-cols-3"><div><dt className="font-medium">Fuente de importes</dt><dd className="mt-1">Registros internos de Facturom</dd></div><div><dt className="font-medium">Última consulta local</dt><dd className="mt-1">{dateLabel(loadedAt)}</dd></div><div><dt className="font-medium">Última verificación de obligaciones SRI</dt><dd className="mt-1">No disponible</dd></div></dl>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {["Obligaciones vencidas", "Próximas obligaciones", "Cumplidas verificadas", "Pendientes de verificar"].map((label) => <Metric key={label} label={label} value="Sin verificar" detail="No hay un conteo confirmado por el SRI." />)}
    </div>
    <div className={`${styles.panel} space-y-3`}><h3 className="font-semibold">Seguimiento de obligaciones</h3><p className="text-sm text-slate-600">No hay obligaciones verificadas disponibles para listar. Falta una consulta autenticada de obligaciones, vencimientos y declaraciones del contribuyente ante el SRI.</p><p className="text-xs text-slate-500">Las credenciales y la sincronización de comprobantes no prueban cumplimiento tributario. Los movimientos registrados no se utilizan para inventar obligaciones ni calendarios.</p></div>
  </section>;
}

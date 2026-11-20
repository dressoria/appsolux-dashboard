import type { TaxIssue } from "@/lib/core/sri-tax/types";
import { taxIssueGroups } from "@/lib/core/sri-tax/ui-state";
import { IssuesTable } from "./tax-ui";
import styles from "./sri-center.module.css";

export function TaxDiagnostics({ issues }: { issues: TaxIssue[] }) {
  const groups = taxIssueGroups(issues);
  return <section className={`${styles.panel} space-y-4`} aria-label="Diagnósticos tributarios">
    <div><h3 className="font-semibold">Diagnósticos del período</h3><p className="mt-1 text-sm text-slate-600">{groups.errors.length ? "Existen errores que bloquean la preparación del anexo." : groups.warnings.length ? "Hay advertencias que requieren revisión." : "Sin diagnósticos reportados por las validaciones locales."}</p></div>
    <div className="flex flex-wrap gap-3 text-sm"><span className="rounded-lg bg-red-50 px-3 py-2 text-red-800">{groups.errors.length} {groups.errors.length === 1 ? "error bloqueante" : "errores bloqueantes"}</span><span className="rounded-lg bg-amber-50 px-3 py-2 text-amber-900">{groups.warnings.length} {groups.warnings.length === 1 ? "advertencia" : "advertencias"}</span><span className="rounded-lg bg-blue-50 px-3 py-2 text-blue-800">{groups.information.length} {groups.information.length === 1 ? "informativo" : "informativos"}</span></div>
    {issues.length ? <p className="text-sm text-slate-600"><span className="font-medium text-slate-900">Siguiente acción: </span>{groups.errors[0]?.action ?? groups.warnings[0]?.action ?? groups.information[0]?.action}</p> : null}
    <details className="rounded-xl border p-3"><summary className="text-sm font-medium">Ver detalles técnicos y documentos ({issues.length})</summary><div className="mt-4 space-y-5">
      {([["Errores bloqueantes", groups.errors], ["Advertencias", groups.warnings], ["Información", groups.information]] as const).map(([title, items]) => items.length ? <div key={title}><h4 className="mb-2 text-sm font-semibold">{title}</h4><IssuesTable issues={items} /></div> : null)}
      {!issues.length ? <p className="text-sm text-slate-500">No hay diagnósticos disponibles.</p> : null}
    </div></details>
  </section>;
}

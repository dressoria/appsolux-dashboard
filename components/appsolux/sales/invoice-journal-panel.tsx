"use client";

import { useEffect, useState } from "react";
import { BookOpen, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceJournal } from "@/types/invoice-ui";

const money = (value: string) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(value));
type Result = { saleId: string; entry: InvoiceJournal | null; message?: string };

export function InvoiceJournalPanel({ saleId }: { saleId?: string }) {
  const [result, setResult] = useState<Result | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!saleId) return;
    const controller = new AbortController();
    fetch(`/api/basic/sales/${encodeURIComponent(saleId)}/journal`, { signal: controller.signal, cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as { entry?: InvoiceJournal | null; message?: string };
        if (!controller.signal.aborted) setResult({ saleId, entry: response.ok ? data.entry ?? null : null, message: response.ok ? undefined : data.message ?? "No se pudo consultar el asiento." });
      })
      .catch(() => { if (!controller.signal.aborted) setResult({ saleId, entry: null, message: "No se pudo consultar el asiento. Intenta nuevamente." }); });
    return () => controller.abort();
  }, [saleId, attempt]);

  const current = result?.saleId === saleId ? result : null;
  const entry = current?.entry;
  const loading = Boolean(saleId && !current);
  const status = entry?.status === "POSTED" ? "Contabilizado" : entry?.status === "REVERSED" ? "Revertido" : "Borrador contable · No contabilizado";
  return (
    <section aria-label="Asiento de la factura" aria-busy={loading} className="space-y-4">
      {entry ? <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><div><p className="font-semibold">{entry.number}</p><p className="mt-1 text-slate-500">{entry.description}</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs text-blue-700">{status}</span></div> : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="p-3 font-medium">Cuenta contable</th><th className="p-3 text-right font-medium">Debe</th><th className="p-3 text-right font-medium">Haber</th></tr></thead>
          <tbody className="divide-y">
            {entry?.lines.map((line) => <tr key={line.id}><td className="p-3"><span className="block font-medium">{line.accountCode}</span><span className="break-words text-slate-500">{line.accountName}</span></td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(line.debit)}</td><td className="whitespace-nowrap p-3 text-right tabular-nums">{money(line.credit)}</td></tr>)}
            {!entry ? <tr><td colSpan={3} className="px-4 py-10 text-center">
              {loading ? <p role="status" className="flex items-center justify-center gap-2 text-slate-500"><LoaderCircle className="size-4 motion-safe:animate-spin" />Consultando asiento…</p> : <div role="status" className="mx-auto max-w-md space-y-2"><BookOpen className="mx-auto size-6 text-slate-400" aria-hidden="true" /><p className="font-medium">{current?.message ?? "Asiento contable no disponible todavía para esta factura."}</p><p className="text-xs leading-relaxed text-slate-500">{current?.message ? "La consulta no modifica la factura ni su estado tributario." : saleId ? "No hay un asiento asociado. Abrir esta sección no genera ni contabiliza movimientos." : "La factura aún no se ha guardado como venta. Se mostrará aquí un asiento existente cuando esté disponible."}</p></div>}
            </td></tr> : null}
          </tbody>
        </table>
      </div>
      <dl className="grid gap-3 text-sm sm:grid-cols-3">
        {[["Total Debe", entry?.totalDebit], ["Total Haber", entry?.totalCredit], ["Diferencia", entry?.difference]].map(([label, value]) => <div key={label} className="flex min-w-0 items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 sm:block"><dt className="text-xs text-slate-500">{label}</dt><dd className={`mt-1 text-right font-semibold tabular-nums ${label === "Diferencia" && value && Number(value) !== 0 ? "text-red-700" : "text-slate-900"}`}>{value !== undefined ? money(value) : "—"}</dd></div>)}
      </dl>
      {saleId ? <Button type="button" variant="outline" disabled={loading} onClick={() => { setResult(null); setAttempt((value) => value + 1); }}>Actualizar consulta</Button> : null}
    </section>
  );
}

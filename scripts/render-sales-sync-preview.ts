// Static, explicitly labelled fixture preview. No API, DB or SRI requests.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { SalesAutomaticSyncView } from "../components/appsolux/sri-tax/sales-automatic-sync-view";
import type { SyncJobView } from "../lib/core/sri-sync-presentation";

const destination = process.argv[2];
if (!destination) throw new Error("Indique un directorio nuevo de salida.");
mkdirSync(destination, { recursive: true });
const job: SyncJobView = { id: "fixture-preview", type: "SYNC_ISSUED_DOCUMENTS", status: "RUNNING", dateFrom: "2026-01-01T05:00:00Z", dateTo: "2026-10-31T05:00:00Z", checkpointDate: "2026-01-27T05:00:00Z", totalDays: 304, completedDays: 27, currentDateLabel: "2026-01-28", documentsFound: 4, documentsImported: 1, documentsSkipped: 0, documentsRejected: 3, documentsFailed: 0, startedAt: "2026-10-31T10:00:00Z", finishedAt: null };
const cssDirectory = resolve(".next/static/chunks");
const css = readdirSync(cssDirectory).filter((file) => file.endsWith(".css")).map((file) => readFileSync(resolve(cssDirectory, file), "utf8")).join("\n");
for (const [name, current] of [["en-progreso", job], ["reanudar", { ...job, status: "FAILED", resumable: true, errorCode: "SRI_QUERY_FAILED", errorMessage: "Fixture: respuesta JSF incompleta; el checkpoint se conserva.", finishedAt: "2026-10-31T10:05:00Z" }]] as const) {
  const html = renderToStaticMarkup(createElement(SalesAutomaticSyncView, { credential: { configured: true, status: "VERIFIED", verifiedAt: "2026-10-30T15:00:00Z" }, config: { enabled: true, syncFrequency: "DAILY", nextSyncAt: "2026-11-01T10:00:00Z" }, job: current, latestJob: current, busy: false, loading: false, error: null, onSync() {}, onToggle() {}, onFrequency() {} }));
  writeFileSync(resolve(destination, `${name}.html`), `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Facturom · Vista de prueba de ventas</title><style>${css}</style><body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif"><p style="padding:12px 24px;background:#fffbeb;color:#92400e;font-size:12px">VISTA ESTÁTICA CON DATOS DE PRUEBA · No representa una ejecución SRI real. Las acciones están disponibles en la aplicación.</p><main style="max-width:1120px;margin:32px auto;padding:0 24px 40px">${html}</main></body></html>`);
}
console.log(destination);

"use client";
import { useEffect, useId, useState } from "react";
import type { LegalBundleSummary, LegalProof } from "@/lib/legal/catalog";

export function ContractAcceptance({ onChange }: { onChange?: (proof: LegalProof | null) => void }) {
  const id = useId();
  const [bundle, setBundle] = useState<LegalBundleSummary | null>(null);
  const [message, setMessage] = useState("Cargando condiciones contractuales…");
  const [accepted, setAccepted] = useState(false);
  const [authorized, setAuthorized] = useState(false);
  useEffect(() => {
    let live = true;
    fetch("/api/legal/current", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.message ?? "Contratación temporalmente no disponible.");
      if (live) setBundle(body.bundle);
    }).catch((error: unknown) => { if (live) setMessage(error instanceof Error ? error.message : "Condiciones no disponibles."); });
    return () => { live = false; };
  }, []);
  function changed(a: boolean, r: boolean) {
    setAccepted(a); setAuthorized(r);
    onChange?.(bundle && a && r ? { accepted: true, authorizedRepresentative: true, releaseId: bundle.id, releaseHash: bundle.hash } : null);
  }
  return <fieldset className="space-y-3 rounded-xl border bg-card p-4 text-sm" aria-describedby={`${id}-notice`}>
    <legend className="px-1 font-semibold">Condiciones de contratación</legend>
    {bundle ? <>
      <p>Versión contractual {bundle.version}. Revisa los documentos antes de continuar:</p>
      <ul className="space-y-1">{bundle.documents.map((doc) => <li key={doc.type}><a className="underline" href={doc.url} target="_blank" rel="noopener noreferrer">{doc.title} · {doc.version}</a></li>)}</ul>
      <input type="hidden" name="legalReleaseId" value={bundle.id} />
      <input type="hidden" name="legalReleaseHash" value={bundle.hash} />
      <label className="flex items-start gap-3"><input type="checkbox" name="legalAccepted" required checked={accepted} onChange={(e) => changed(e.target.checked, authorized)} className="mt-1" /><span>He leído y acepto los Términos y Condiciones, las Condiciones de Pagos y Suscripciones y el Acuerdo de Tratamiento de Datos aplicable. Reconozco haber recibido la información de Privacidad y Cookies.</span></label>
      <label className="flex items-start gap-3"><input type="checkbox" name="legalAuthorized" required checked={authorized} onChange={(e) => changed(accepted, e.target.checked)} className="mt-1" /><span>Declaro estar autorizado para contratar en nombre de esta empresa.</span></label>
    </> : <p role="status">{message}</p>}
    <p id={`${id}-notice`} className="text-xs text-muted-foreground">Esta aceptación formaliza el contrato; no autoriza publicidad ni otros tratamientos opcionales de datos.</p>
  </fieldset>;
}

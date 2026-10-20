"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { canRequestSriCancellation, sriCancellationLabel } from "@/lib/sri-cancellation-status";
import type { CancellationEligibility } from "@/lib/core/sri-cancellation";

export function SriCancellationAction({ sriStatus, cancellationStatus, documentType, onClick, label = "Anular factura" }: {
  sriStatus?: string | null;
  cancellationStatus?: string | null;
  documentType?: string | null;
  onClick: () => void;
  label?: string;
}) {
  if (!canRequestSriCancellation(sriStatus, cancellationStatus, documentType)) return null;
  return <Button type="button" variant="ghost" size="sm" className="text-red-700 hover:bg-red-50" onClick={onClick}>{label}</Button>;
}

export function SriCancellationModal({ sriDocumentId, onClose, onSuccess }: {
  sriDocumentId: string;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const submittingRef = useRef(false);
  const titleId = useId();
  const reasonId = useId();
  const commentId = useId();
  const [reason, setReason] = useState("EMISSION_ERROR");
  const [comment, setComment] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [eligibility, setEligibility] = useState<CancellationEligibility | null>(null);
  const [requestStatus, setRequestStatus] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    dialog.current?.showModal();
    async function load() {
      try {
        const response = await fetch(`/api/sri/documents/${sriDocumentId}/cancel`, { signal: controller.signal });
        const data = await response.json();
        if (!response.ok || !data.eligibility) throw new Error(data.error ?? "No se pudo verificar elegibilidad.");
        if (!controller.signal.aborted) {
          setEligibility(data.eligibility);
          setRequestStatus(data.requests?.[0]?.status ?? null);
        }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "No se pudo verificar elegibilidad.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }
    void load();
    return () => controller.abort();
  }, [sriDocumentId]);

  async function submit() {
    if (submittingRef.current || !confirmed || !eligibility?.eligible || !canRequestSriCancellation("AUTHORIZED", requestStatus)) return;
    submittingRef.current = true; setSubmitting(true); setError("");
    try {
      const response = await fetch(`/api/sri/documents/${sriDocumentId}/cancel`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reasonCode: reason, reasonText: comment }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) throw new Error(data.message ?? "No se pudo solicitar la anulación.");
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo solicitar la anulación.");
      submittingRef.current = false; setSubmitting(false);
    }
  }

  const canSubmit = !loading && eligibility?.eligible && canRequestSriCancellation("AUTHORIZED", requestStatus);
  return <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); if (!submitting) onClose(); }} className="m-auto max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-lg overflow-auto rounded-2xl border bg-white p-6 shadow-xl backdrop:bg-black/50">
    <h2 id={titleId} className="text-lg font-bold text-red-700">Anular factura SRI</h2>
    <p className="mt-2 text-sm text-slate-600">La factura no se marcará como anulada hasta que el SRI confirme la anulación.</p>
    {loading ? <p className="mt-4 text-sm" role="status">Verificando elegibilidad...</p> : null}
    {requestStatus ? <p className="mt-3 text-sm" role="status">{sriCancellationLabel("AUTHORIZED", requestStatus)}</p> : null}
    {!loading && eligibility && !eligibility.eligible ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{eligibility.reason}</p> : null}
    {canSubmit ? <div className="mt-4 space-y-3">
      {eligibility.deadlineDate ? <p className="text-xs text-slate-500">Plazo de anulación en línea: hasta {eligibility.deadlineDate}</p> : null}
      <label htmlFor={reasonId} className="block text-sm">Motivo</label>
      <select id={reasonId} value={reason} disabled={submitting} onChange={(e) => setReason(e.target.value)} className="h-9 w-full rounded border px-3 text-sm"><option value="EMISSION_ERROR">Error de emisión</option><option value="OPERATION_NOT_OCCURRED">La operación no se realizó</option></select>
      <label htmlFor={commentId} className="block text-sm">Comentario (opcional)</label>
      <textarea id={commentId} value={comment} disabled={submitting} onChange={(e) => setComment(e.target.value)} rows={3} className="w-full rounded border px-3 py-2 text-sm" />
      <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={submitting} onChange={(e) => setConfirmed(e.target.checked)} />Confirmo que deseo solicitar la anulación de este comprobante al SRI.</label>
    </div> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-red-700">{error}</p> : null}
    <div className="mt-4 flex justify-end gap-2"><Button variant="outline" disabled={submitting} onClick={onClose}>Cerrar</Button>{canSubmit ? <Button variant="destructive" disabled={!confirmed || submitting} onClick={() => void submit()}>{submitting ? "Enviando..." : "Solicitar anulación al SRI"}</Button> : null}</div>
  </dialog>;
}

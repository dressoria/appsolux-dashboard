// Shared presentation policy; the API remains authoritative for eligibility.
export const SRI_CANCELLATION_LABELS: Record<string, string> = {
  QUEUED: "Anulación en cola",
  RUNNING: "Procesando anulación",
  SUBMITTED: "Pendiente de confirmación SRI",
  HUMAN_VERIFICATION_REQUIRED: "Requiere verificación manual",
  FAILED: "Anulación fallida",
  CONFIRMED: "Anulado",
  NOT_ELIGIBLE: "No elegible para anulación",
  CANCELLED_BY_USER: "Solicitud de anulación cancelada",
};
const BLOCKING_STATUSES = new Set(["QUEUED", "RUNNING", "SUBMITTED", "HUMAN_VERIFICATION_REQUIRED", "CONFIRMED"]);
export function canRequestSriCancellation(sriStatus?: string | null, cancellationStatus?: string | null, documentType?: string | null) {
  return (!documentType || documentType === "INVOICE") && sriStatus === "AUTHORIZED" && !BLOCKING_STATUSES.has(cancellationStatus ?? "");
}
export function sriCancellationLabel(sriStatus?: string | null, cancellationStatus?: string | null) {
  if (sriStatus === "CANCELLED") return "Anulado";
  return cancellationStatus ? SRI_CANCELLATION_LABELS[cancellationStatus] ?? cancellationStatus : null;
}

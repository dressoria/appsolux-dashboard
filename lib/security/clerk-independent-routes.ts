// These handlers authenticate independently (Paddle signature, cron secret, API key)
// or expose only already-published legal information.
const exact = new Set([
  "/api/billing/webhooks/paddle", "/api/cron/billing/paddle", "/api/legal/current",
  "/terminos-y-condiciones", "/politica-de-privacidad", "/pagos-y-suscripciones",
  "/acuerdo-tratamiento-datos", "/politica-de-cookies",
]);
export function isClerkIndependentRoute(pathname: string) {
  return exact.has(pathname) || pathname.startsWith("/api/v1/");
}

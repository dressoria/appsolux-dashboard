// Functional preferences are optional. Authentication and payment storage are untouched.
const choiceKey = "facturom.cookie-preferences.v1";
export const functionalKeys = ["facturom.sidebar.collapsed", "facturom.sidebar.open-groups", "facturom.sidebar.open-submenus", "billing-sidebar-open", "billing-sidebar-collapsed"];
export function functionalStorageAllowed() {
  try { return JSON.parse(window.localStorage.getItem(choiceKey) ?? "null")?.functional === true; } catch { return false; }
}
export function readFunctionalPreference(key: string) {
  try { return functionalStorageAllowed() ? window.localStorage.getItem(key) : null; } catch { return null; }
}
export function saveFunctionalPreference(key: string, value: string) {
  try { if (functionalStorageAllowed()) window.localStorage.setItem(key, value); } catch { /* Storage may be blocked. */ }
}
export function setFunctionalStorageAllowed(allowed: boolean) {
  try {
    window.localStorage.setItem(choiceKey, JSON.stringify({ functional: allowed, recordedAt: new Date().toISOString(), version: "1" }));
    if (!allowed) for (const key of functionalKeys) window.localStorage.removeItem(key);
  } catch { /* No persistence is safer than implicitly enabling optional storage. */ }
}

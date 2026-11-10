"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Dialog } from "radix-ui";
import { Copy, KeyRound, Loader2, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { API_MODULES, type ApiScopeDefinition } from "@/lib/integration-api/catalog";

type KeyRow = { id: string; userId: string; name: string; keyPrefix: string; fullAccess: boolean; scopes: string[]; createdAt: string; lastUsedAt: string | null; expiresAt: string | null; status: string; revokedAt: string | null; user: { name: string; email: string }; tenant: { id: string; name: string } };
type ManagementData = { keys: KeyRow[]; tenant: { id: string; name: string }; tenants: { id: string; name: string }[]; availableScopes: ApiScopeDefinition[]; userId: string; admin: boolean };
type Secret = { key: KeyRow; secret: string; previousKeyActive?: boolean };
function displayDate(value: string | null) { return value ? new Date(value).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "medium", timeStyle: "short" }) : "—"; }
async function api<T>(url: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { cache: "no-store", signal, ...(body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error?.message ?? "No se pudo completar la solicitud.");
  return result.data;
}
function Modal({ open, onOpenChange, title, children }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; children: React.ReactNode }) {
  return <Dialog.Root open={open} onOpenChange={onOpenChange}><Dialog.Portal><Dialog.Overlay className="fixed inset-0 z-50 bg-slate-950/40" /><Dialog.Content className="fixed left-1/2 top-1/2 z-50 max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border bg-white p-6 shadow-xl"><Dialog.Title className="pr-8 text-xl font-semibold">{title}</Dialog.Title><Dialog.Description className="mt-1 text-sm text-slate-500">Integraciones seguras para tu empresa en Facturom.</Dialog.Description><Dialog.Close asChild><button type="button" aria-label="Cerrar ventana" className="absolute right-4 top-4 rounded p-1 text-slate-500 hover:bg-slate-100"><X className="size-5" /></button></Dialog.Close><div className="mt-5">{children}</div></Dialog.Content></Dialog.Portal></Dialog.Root>;
}
export function ApiKeysManager({ initialTenantId }: { initialTenantId: string }) {
  const [tenantId, setTenantId] = useState(initialTenantId), [state, setState] = useState<ManagementData | null>(null);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [creating, setCreating] = useState(false), [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]), [expiration, setExpiration] = useState("90"), [customDate, setCustomDate] = useState("");
  const [secret, setSecret] = useState<Secret | null>(null), [copied, setCopied] = useState(false);
  const [inspection, setInspection] = useState<KeyRow | null>(null), [action, setAction] = useState<{ key: KeyRow; type: "revoke" | "rotate" } | null>(null);
  const [rotationMode, setRotationMode] = useState("overlap");
  const refresh = useCallback(async () => {
    setLoading(true); setError("");
    try { setState(await api<ManagementData>(`/api/settings/api-keys?tenantId=${encodeURIComponent(tenantId)}`)); }
    catch (e) { setError(e instanceof Error ? e.message : "Error al cargar claves."); setState(null); }
    finally { setLoading(false); }
  }, [tenantId]);
  useEffect(() => {
    const controller = new AbortController();
    void api<ManagementData>(`/api/settings/api-keys?tenantId=${encodeURIComponent(tenantId)}`, undefined, controller.signal)
      .then(result => { if (!controller.signal.aborted) setState(result); })
      .catch(e => { if (!controller.signal.aborted) { setError(e instanceof Error ? e.message : "Error al cargar claves."); setState(null); } })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [tenantId]);
  const available = state?.availableScopes ?? [];
  const fullAccess = available.length > 0 && available.every(s => selected.includes(s.id));
  const toggle = (ids: string[], checked: boolean) => setSelected(current => checked ? [...new Set([...current, ...ids])] : current.filter(id => !ids.includes(id)));
  function startCreate() { setName(""); setSelected([]); setExpiration("90"); setCustomDate(""); setError(""); setCreating(true); }
  async function create(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const expiresAt = expiration === "none" ? null : expiration === "custom" ? new Date(`${customDate}T23:59:59-05:00`).toISOString() : new Date(Date.now() + Number(expiration) * 86400000).toISOString();
      const result = await api<Secret>("/api/settings/api-keys", { tenantId, name, scopes: selected, fullAccess, expiresAt });
      setCreating(false); setCopied(false); setSecret(result); await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo crear la clave."); }
    finally { setBusy(false); }
  }
  async function confirmAction() {
    if (!action) return;
    setBusy(true); setError("");
    try {
      const result = await api<Secret>(`/api/settings/api-keys/${action.key.id}`, { tenantId, action: action.type, ...(action.type === "rotate" ? { mode: rotationMode } : {}) });
      setAction(null); if (action.type === "rotate") { setCopied(false); setSecret(result); } await refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo completar la acción."); }
    finally { setBusy(false); }
  }
  const errors = error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null;
  return <div className="space-y-6">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-slate-500">Configuración / Integraciones</p><h1 className="mt-1 flex items-center gap-2 text-3xl font-semibold"><KeyRound className="size-7 text-[#1E52F1]" />Claves API</h1><p className="mt-2 text-sm text-slate-500">Conecta n8n y tus aplicaciones con los permisos de tu empresa.</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" asChild><Link href="/settings/integrations/api-docs">Documentación API</Link></Button><Button disabled={!state?.availableScopes.length || loading} onClick={startCreate} className="bg-[#1E52F1] text-white hover:bg-[#1769E0]"><Plus className="size-4" />Crear nueva clave</Button></div></div>
    {errors}
    <Card><CardContent className="flex flex-wrap items-end justify-between gap-4 pt-6"><div className="min-w-64 space-y-2"><Label htmlFor="key-tenant">Empresa de las claves</Label><select id="key-tenant" disabled={loading || busy} value={tenantId} className="h-10 w-full rounded-md border bg-white px-3 text-sm" onChange={e => { setState(null); setLoading(true); setError(""); setSelected([]); setTenantId(e.target.value); }}>{state?.tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>) ?? <option value={tenantId}>Empresa activa</option>}</select></div><Button variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className={`size-4 ${loading ? "animate-spin" : ""}`} />Actualizar</Button></CardContent></Card>
    <div className="overflow-x-auto rounded-xl border bg-white"><table className="w-full min-w-[1100px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr>{["Clave / identificador", "Propietario / empresa", "Acceso", "Creación", "Último uso", "Expiración", "Estado", "Acciones"].map(label => <th key={label} className="px-4 py-3 font-medium">{label}</th>)}</tr></thead><tbody>{state?.keys.map(key => {
      const active = key.status === "ACTIVE" && !key.revokedAt, expired = !!key.expiresAt && new Date(key.expiresAt) <= new Date();
      return <tr key={key.id} className="border-t align-top"><td className="px-4 py-4"><p className="font-medium">{key.name}</p><code className="text-xs text-slate-500">{key.keyPrefix}…</code></td><td className="px-4 py-4"><p>{key.user.name}</p><p className="text-xs text-slate-500">{key.tenant.name}</p></td><td className="px-4 py-4"><button className="text-left text-[#1E52F1] underline-offset-4 hover:underline" onClick={() => setInspection(key)}>{key.fullAccess ? "Full Access" : "Personalizado"}<span className="block text-xs">{key.scopes.length} permisos</span></button></td><td className="px-4 py-4 text-xs">{displayDate(key.createdAt)}</td><td className="px-4 py-4 text-xs">{key.lastUsedAt ? displayDate(key.lastUsedAt) : "Sin uso"}</td><td className="px-4 py-4 text-xs">{key.expiresAt ? displayDate(key.expiresAt) : "Sin expiración"}</td><td className="px-4 py-4"><span className={`rounded-full px-2 py-1 text-xs ${!active ? "bg-slate-100 text-slate-600" : expired ? "bg-amber-50 text-amber-800" : "bg-blue-50 text-blue-700"}`}>{!active ? "Revocada" : expired ? "Vencida" : "Activa"}</span></td><td className="space-x-2 whitespace-nowrap px-4 py-4"><Button variant="outline" size="sm" disabled={!active || expired || key.userId !== state.userId} onClick={() => { setRotationMode("overlap"); setAction({ key, type: "rotate" }); }}>Rotar</Button><Button variant="outline" size="sm" disabled={!active} onClick={() => setAction({ key, type: "revoke" })}>Revocar</Button></td></tr>;
    })}</tbody></table>{loading ? <p role="status" className="flex items-center justify-center gap-2 p-8 text-slate-500"><Loader2 className="size-4 animate-spin" />Cargando claves…</p> : state?.keys.length === 0 ? <p className="p-10 text-center text-slate-500">Esta empresa todavía no tiene claves API. Crea la primera para conectar tus aplicaciones.</p> : null}</div>
    <p className="text-xs text-slate-500">{state?.admin ? "Puedes revocar claves de la organización. Solo su propietario puede generar y ver el secreto de reemplazo." : "Solo puedes administrar tus propias claves."} Las claves existentes muestran únicamente su identificador público.</p>
    <Modal open={creating} onOpenChange={open => { if (!busy) setCreating(open); }} title="Crear clave API"><form className="space-y-5" onSubmit={create}>
      {errors}<div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="key-name">Nombre de la clave</Label><Input id="key-name" required maxLength={100} value={name} onChange={e => setName(e.target.value)} placeholder="Automatización n8n — Inventario" /></div><div className="space-y-2"><Label>Empresa seleccionada</Label><p className="rounded-md border bg-slate-50 px-3 py-2 text-sm">{state?.tenant.name}</p></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="expiration">Expiración</Label><select id="expiration" className="h-10 w-full rounded-md border px-3 text-sm" value={expiration} onChange={e => setExpiration(e.target.value)}><option value="none">Sin fecha de expiración</option><option value="30">30 días</option><option value="90">90 días</option><option value="365">1 año</option><option value="custom">Fecha personalizada</option></select></div>{expiration === "custom" && <div className="space-y-2"><Label htmlFor="custom-expiration">Fecha personalizada</Label><Input id="custom-expiration" type="date" required value={customDate} onChange={e => setCustomDate(e.target.value)} /></div>}</div>
      <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"><input className="size-5 accent-[#1E52F1]" type="checkbox" checked={fullAccess} onChange={e => setSelected(e.target.checked ? available.map(s => s.id) : [])} /><ShieldCheck className="size-6 shrink-0 text-[#1E52F1]" /><span><span className="block font-semibold text-[#1E52F1]">Acceso completo (Full Access)</span><span className="block text-xs text-slate-600">Selecciona todos tus permisos autorizados. Puedes desmarcar operaciones individuales.</span></span></label>
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm"><p>{fullAccess ? "Acceso completo" : "Permisos personalizados"} · {selected.length} de {available.length}</p><div className="flex gap-3"><button type="button" className="text-[#1E52F1] hover:underline" onClick={() => setSelected(available.map(s => s.id))}>Seleccionar todos</button><button type="button" className="text-slate-500 hover:underline" onClick={() => setSelected([])}>Deseleccionar todos</button></div></div>
      <div className="max-h-72 space-y-2 overflow-y-auto rounded-xl border p-3">{Object.entries(API_MODULES).map(([module, label]) => {
        const group = available.filter(s => s.module === module); if (!group.length) return null;
        return <details key={module} className="rounded-lg border px-3 py-2" open><summary className="cursor-pointer text-sm font-medium">{label}<span className="ml-2 text-xs text-[#1769E0]">{group.filter(s => selected.includes(s.id)).length}/{group.length}</span></summary><label className="mt-3 flex items-center gap-2 text-sm font-medium"><input type="checkbox" className="accent-[#1E52F1]" checked={group.every(s => selected.includes(s.id))} onChange={e => toggle(group.map(s => s.id), e.target.checked)} />Todo el módulo</label><div className="my-2 grid gap-2 sm:grid-cols-2">{group.map(scope => <label key={scope.id} className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1 accent-[#1E52F1]" checked={selected.includes(scope.id)} onChange={e => toggle([scope.id], e.target.checked)} /><span>{scope.label}<code className="block text-[10px] text-slate-500">{scope.id}</code></span></label>)}</div></details>;
      })}</div><div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={busy} onClick={() => setCreating(false)}>Cancelar</Button><Button className="bg-[#1E52F1] hover:bg-[#1769E0]" disabled={busy || !name.trim() || !selected.length}>{busy ? "Creando…" : "Crear clave"}</Button></div>
    </form></Modal>
    <Modal open={!!secret} onOpenChange={open => { if (!open) { setSecret(null); setCopied(false); } }} title="Guarda tu nueva clave">{secret && <div className="space-y-4"><p className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">Guarda esta clave en un lugar seguro. Por seguridad, no volveremos a mostrarla.</p><dl className="grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">Nombre</dt><dd>{secret.key.name}</dd></div><div><dt className="text-slate-500">Empresa</dt><dd>{secret.key.tenant.name}</dd></div><div><dt className="text-slate-500">Acceso</dt><dd>{secret.key.fullAccess ? "Full Access" : "Personalizado"} · {secret.key.scopes.length} permisos</dd></div><div><dt className="text-slate-500">Expiración</dt><dd>{secret.key.expiresAt ? displayDate(secret.key.expiresAt) : "Sin expiración"}</dd></div></dl><div className="rounded-lg border bg-slate-50 p-4"><code className="break-all text-sm" data-private="true">{secret.secret}</code></div><Button className="bg-[#1E52F1] hover:bg-[#1769E0]" onClick={async () => { try { await navigator.clipboard.writeText(secret.secret); setCopied(true); } catch { setError("No se pudo copiar. Selecciona y copia la clave manualmente."); } }}><Copy className="size-4" />{copied ? "Copiada" : "Copiar clave"}</Button>{secret.previousKeyActive && <p className="text-sm text-amber-800">La clave anterior sigue activa. Actualiza n8n, verifica GET /api/v1/me con la nueva clave y revoca después la anterior.</p>}<details><summary className="cursor-pointer text-sm">Consultar permisos</summary><ul className="mt-2 max-h-40 overflow-y-auto text-xs">{secret.key.scopes.map(s => <li key={s}>{s}</li>)}</ul></details><div className="flex justify-end"><Button variant="outline" onClick={() => setSecret(null)}>Ya guardé la clave</Button></div></div>}</Modal>
    <Modal open={!!inspection} onOpenChange={open => { if (!open) setInspection(null); }} title={`Permisos de ${inspection?.name ?? "la clave"}`}><ul className="grid gap-2 sm:grid-cols-2">{inspection?.scopes.map(s => <li key={s} className="rounded border p-2 text-sm"><p>{available.find(a => a.id === s)?.label ?? s}</p><code className="text-xs text-slate-500">{s}</code></li>)}</ul><p className="mt-4 text-xs text-slate-500">La ejecución también comprueba el rol y la membresía actuales del propietario.</p></Modal>
    <Modal open={!!action} onOpenChange={open => { if (!open && !busy) setAction(null); }} title={action?.type === "revoke" ? "Revocar clave" : "Rotar clave"}><div className="space-y-4">{errors}<p className="text-sm">{action?.key.name} · {action?.key.tenant.name}</p>{action?.type === "revoke" ? <p className="text-sm text-slate-600">La clave dejará de funcionar inmediatamente para nuevas solicitudes. Las automatizaciones que la usan deberán actualizar sus credenciales.</p> : <fieldset className="space-y-3 text-sm"><legend className="mb-2 font-medium">Procedimiento de reemplazo</legend><label className="flex gap-2"><input type="radio" name="rotation" value="overlap" checked={rotationMode === "overlap"} onChange={() => setRotationMode("overlap")} />Mantener ambas activas hasta actualizar y verificar la integración.</label><label className="flex gap-2"><input type="radio" name="rotation" value="replace" checked={rotationMode === "replace"} onChange={() => setRotationMode("replace")} />Revocar la anterior inmediatamente y generar el reemplazo.</label></fieldset>}<div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setAction(null)}>Cancelar</Button><Button disabled={busy} className="bg-[#1E52F1] hover:bg-[#1769E0]" onClick={() => void confirmAction()}>{busy ? "Procesando…" : action?.type === "revoke" ? "Confirmar revocación" : "Generar reemplazo"}</Button></div></div></Modal>
  </div>;
}

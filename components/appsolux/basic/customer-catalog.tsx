"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Archive, FileCheck2, MoreHorizontal, Plus, Search, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CatalogCustomer = {
  id: string; name: string; phone: string | null; email: string | null; additionalEmails: string[];
  address: string | null; identificationType: "RUC" | "CEDULA" | "PASSPORT" | "FOREIGN_ID" | null;
  identification: string | null; notes: string | null; isActive: boolean; balance: string;
};

const identificationLabels = { RUC: "RUC", CEDULA: "Cédula", PASSPORT: "Pasaporte", FOREIGN_ID: "Identificación del exterior" };
const isFiscalReady = (customer: CatalogCustomer) => Boolean(customer.name.trim() && customer.identificationType && customer.identification);

export function CustomerCatalog({ customers, limitReached }: { customers: CatalogCustomer[]; limitReached: boolean }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<CatalogCustomer | "new" | null>(null);
  const [query, setQuery] = useState(""); const [status, setStatus] = useState("active"); const [fiscal, setFiscal] = useState("all");
  const [openMenu, setOpenMenu] = useState(""); const [error, setError] = useState("");
  const filtered = useMemo(() => customers.filter((customer) => {
    const needle = query.trim().toLowerCase();
    const matches = !needle || [customer.name, customer.identification, customer.phone, customer.email, ...customer.additionalEmails].some((value) => value?.toLowerCase().includes(needle));
    return matches && (status === "all" || customer.isActive === (status === "active")) && (fiscal === "all" || isFiscalReady(customer) === (fiscal === "ready"));
  }), [customers, fiscal, query, status]);

  async function mutate(customer: CatalogCustomer, action: "toggle" | "delete") {
    if (action === "delete" && !window.confirm(`¿Eliminar a ${customer.name}? Esta acción no se puede deshacer.`)) return;
    setError(""); const response = await fetch(`/api/basic/customers/${customer.id}`, action === "delete" ? { method: "DELETE" } : { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !customer.isActive }) });
    const result = await response.json() as { message?: string }; if (!response.ok) return setError(result.message ?? "No se pudo completar la acción."); router.refresh();
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar nombre, identificación, teléfono o correo" className="h-10 rounded-xl border-slate-200 pl-9"/></div>
      <select aria-label="Estado del cliente" value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select>
      <select aria-label="Estado fiscal" value={fiscal} onChange={(event) => setFiscal(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Todo estado fiscal</option><option value="ready">Listos para facturar</option><option value="pending">Datos pendientes</option></select>
      <Button disabled={limitReached} onClick={() => setDrawer("new")} className="rounded-xl bg-facturom-primary text-white hover:bg-facturom-primary-soft"><Plus className="mr-2 h-4 w-4"/>Nuevo cliente</Button>
    </div>
    {limitReached ? <p className="text-sm text-amber-700">Alcanzaste el límite de clientes de tu plan.</p> : null}{error ? <p className="text-sm text-red-600">{error}</p> : null}
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm"><div className="overflow-x-auto"><table className="w-full min-w-[920px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Cliente</th><th>Teléfono</th><th>Correo</th><th>Saldo</th><th>Estado fiscal</th><th>Estado</th><th className="pr-5 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">
      {filtered.map((customer) => <tr key={customer.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-950">{customer.name}</p><p className="text-xs text-slate-500">{customer.identificationType && customer.identification ? `${identificationLabels[customer.identificationType]} ${customer.identification}` : "Solo contacto"}</p></td><td>{customer.phone || "—"}</td><td>{customer.email || "—"}</td><td className="font-semibold">${Number(customer.balance).toFixed(2)}</td><td><span className={isFiscalReady(customer) ? "text-emerald-700" : "text-amber-700"}>{isFiscalReady(customer) ? "Listo para facturar" : "Datos pendientes"}</span></td><td>{customer.isActive ? "Activo" : "Inactivo"}</td><td className="relative pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => setOpenMenu(openMenu === customer.id ? "" : customer.id)} aria-label={`Acciones de ${customer.name}`}><MoreHorizontal className="h-4 w-4"/></Button>{openMenu === customer.id ? <div className="absolute right-5 z-10 w-44 rounded-xl border bg-white p-1 text-left shadow-lg"><button className="w-full rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setDrawer(customer)}>Editar</button><Link className="block rounded-lg px-3 py-2 text-sm hover:bg-slate-50" href={`/basic/customers/${customer.id}`}>Ver detalle</Link><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-slate-50" onClick={() => mutate(customer,"toggle")}><Archive className="h-4 w-4"/>{customer.isActive ? "Desactivar" : "Activar"}</button><button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50" onClick={() => mutate(customer,"delete")}><Trash2 className="h-4 w-4"/>Eliminar</button></div> : null}</td></tr>)}
    </tbody></table></div>{filtered.length === 0 ? <div className="p-12 text-center text-sm text-slate-500"><UserRound className="mx-auto mb-3 h-8 w-8 text-slate-300"/>No hay clientes que coincidan con los filtros.</div> : null}</div>
    {drawer ? <CustomerDrawer customer={drawer === "new" ? undefined : drawer} onClose={() => setDrawer(null)}/> : null}
  </div>;
}

function CustomerDrawer({ customer, onClose }: { customer?: CatalogCustomer; onClose: () => void }) {
  const router = useRouter(); const [fiscalEnabled, setFiscalEnabled] = useState(Boolean(customer?.identificationType));
  const [type, setType] = useState(customer?.identificationType ?? "RUC"); const [emails, setEmails] = useState([customer?.email ?? "", ...(customer?.additionalEmails ?? [])]);
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget); const payload = { name: String(form.get("name") ?? ""), phone: String(form.get("phone") ?? ""), address: String(form.get("address") ?? ""), notes: String(form.get("notes") ?? ""), emails, isActive: form.get("isActive") === "on", identificationType: fiscalEnabled ? type : "", identification: fiscalEnabled ? String(form.get("identification") ?? "") : "" }; const response = await fetch(customer ? `/api/basic/customers/${customer.id}` : "/api/basic/customers", { method: customer ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { message?: string }; setSaving(false); if (!response.ok) return setError(result.message ?? "No se pudo guardar."); onClose(); router.refresh(); }
  return <div className="fixed inset-0 z-50 bg-slate-950/35" role="dialog" aria-modal="true"><div className="absolute inset-0" onClick={onClose}/><aside className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-2xl sm:max-w-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><p className="text-lg font-bold">{customer ? "Editar cliente" : "Nuevo cliente"}</p><p className="text-sm text-slate-500">Contacto y datos de facturación.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5"/></Button></div><form onSubmit={submit} className="space-y-7 p-5 sm:p-7">
    <section className="grid gap-4 sm:grid-cols-2"><Field label="Razón social / Nombre" wide><Input name="name" defaultValue={customer?.name ?? ""} required placeholder="Nombre del cliente o empresa"/></Field><Field label="Teléfono"><Input name="phone" defaultValue={customer?.phone ?? ""} inputMode="tel" placeholder="0999999999"/></Field><Field label="Dirección"><Input name="address" defaultValue={customer?.address ?? ""}/></Field></section>
    <section className="rounded-2xl border border-slate-200 p-4"><div className="flex items-center justify-between gap-4"><div><p className="font-semibold">Datos de facturación</p><p className="text-xs text-slate-500">Actívalos solo si este cliente recibirá facturas SRI.</p></div><input aria-label="Activar datos fiscales" type="checkbox" checked={fiscalEnabled} onChange={(event) => setFiscalEnabled(event.target.checked)} className="h-5 w-5 accent-violet-700"/></div>{fiscalEnabled ? <div className="mt-4 grid gap-4 sm:grid-cols-2"><Field label="Tipo de identificación"><select value={type} onChange={(event) => setType(event.target.value as typeof type)} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="RUC">RUC</option><option value="CEDULA">Cédula de identidad</option><option value="PASSPORT">Pasaporte</option><option value="FOREIGN_ID">Identificación del exterior</option></select></Field><Field label="Identificación"><Input name="identification" defaultValue={customer?.identification ?? ""} required inputMode={type === "RUC" || type === "CEDULA" ? "numeric" : "text"} minLength={type === "RUC" ? 13 : type === "CEDULA" ? 10 : 3} maxLength={type === "RUC" ? 13 : type === "CEDULA" ? 10 : 30}/></Field></div> : null}</section>
    <section><div className="mb-3 flex items-center justify-between"><div><p className="font-semibold">Correos electrónicos</p><p className="text-xs text-slate-500">El primero será el correo principal. Máximo 5.</p></div><Button type="button" variant="outline" size="sm" disabled={emails.length >= 5} onClick={() => setEmails((current) => [...current, ""])}><Plus className="mr-1 h-4 w-4"/>Agregar</Button></div>{emails.map((email,index) => <div key={index} className="mb-2 flex gap-2"><Input aria-label={`Correo ${index + 1}`} type="email" value={email} onChange={(event) => setEmails((current) => current.map((value,i) => i === index ? event.target.value : value))} placeholder="cliente@correo.com"/><Button type="button" variant="ghost" size="icon" disabled={emails.length === 1} onClick={() => setEmails((current) => current.filter((_,i) => i !== index))}><X className="h-4 w-4"/></Button></div>)}</section>
    <Field label="Observaciones"><textarea name="notes" defaultValue={customer?.notes ?? ""} className="min-h-24 w-full rounded-md border border-input px-3 py-2 text-sm" placeholder="Notas internas, referencias o instrucciones de entrega"/></Field><label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={customer?.isActive ?? true}/>Cliente activo</label>{fiscalEnabled ? <p className="flex items-center gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-800"><FileCheck2 className="h-4 w-4"/>La identificación será validada nuevamente en el servidor.</p> : null}{error ? <p className="text-sm text-red-600">{error}</p> : null}<div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white py-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving} className="bg-facturom-primary hover:bg-facturom-primary-soft">{saving ? "Guardando…" : "Guardar cliente"}</Button></div>
  </form></aside></div>;
}

function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }

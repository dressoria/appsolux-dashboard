import { CircleDollarSign, ContactRound, FileCheck2 } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { CustomerCatalog } from "@/components/appsolux/basic/customer-catalog";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listCustomers } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function BasicCustomersPage(_props?: { searchParams?: Promise<{ q?: string }> }) {
  void _props;
  const user = await getCurrentUser();
  if (!user) return <BasicModuleShell title="Clientes" description="Administra contactos y datos de facturación." activeHref={routes.basicCustomers}><p>Sesión requerida.</p></BasicModuleShell>;
  const tenant = await getCurrentTenant(user);
  const [customers, counts, mode] = await Promise.all([
    listCustomers(tenant.id, { take: 50 }),
    getBasicUsageCounts(tenant.id),
    getTenantModeState(tenant),
  ]);
  const pendingBalance = customers.reduce((sum, customer) => sum + Number(customer.balance), 0);
  const fiscalReady = customers.filter((customer) => customer.identificationType && customer.identification).length;
  return <BasicModuleShell title="Clientes" description="Administra contactos y datos de facturación." activeHref={routes.basicCustomers}>
    <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-3"><Metric icon={<ContactRound className="h-5 w-5"/>} label="Clientes" value={`${counts.customers} / ${mode.operationalLimits.customers}`}/><Metric icon={<FileCheck2 className="h-5 w-5"/>} label="Listos para facturar" value={String(fiscalReady)}/><Metric icon={<CircleDollarSign className="h-5 w-5"/>} label="Saldo pendiente" value={`$${pendingBalance.toFixed(2)}`}/></div>
      <CustomerCatalog limitReached={counts.customers >= mode.operationalLimits.customers} customers={customers.map((customer) => ({ id: customer.id, name: customer.name, phone: customer.phone, email: customer.email, additionalEmails: customer.additionalEmails, address: customer.address, identificationType: customer.identificationType, identification: customer.identification, notes: customer.notes, isActive: customer.isActive, balance: customer.balance.toString() }))}/>
    </div>
  </BasicModuleShell>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 text-violet-700">{icon}</span><div><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="text-2xl font-black text-slate-950">{value}</p></div></div></div>; }

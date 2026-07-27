import Link from "next/link";
import { CircleDollarSign, ContactRound, Plus, Users } from "lucide-react";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { CustomerForm } from "@/components/appsolux/basic/customer-form";
import { CustomerList } from "@/components/appsolux/basic/customer-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getBasicUsageCounts, listCustomers } from "@/lib/core/lightweight-pos";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

type BasicCustomersPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function BasicCustomersPage({
  searchParams,
}: BasicCustomersPageProps) {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <BasicModuleShell
        title="Clientes"
        description="Registra clientes para llevar historial y ventas fiadas."
        activeHref={routes.basicCustomers}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </BasicModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const resolvedSearchParams = await searchParams;
  const tenantMode = await getTenantModeState(tenant);
  const [customers, counts] = await Promise.all([
    listCustomers(tenant.id, { search: resolvedSearchParams.q }),
    getBasicUsageCounts(tenant.id),
  ]);
  const limitReached = counts.customers >= tenantMode.operationalLimits.customers;
  const pendingBalanceTotal = customers.reduce(
    (sum, customer) => sum + Number(customer.balance.toString()),
    0
  );
  const customersWithBalance = customers.filter((customer) => Number(customer.balance.toString()) > 0).length;

  return (
    <BasicModuleShell
      title="Clientes"
      description="Clientes ligeros, contacto y saldos pendientes para ventas fiadas."
      activeHref={routes.basicCustomers}
    >
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#588100] text-white">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#588100]">Clientes</span>
              </div>
              <p className="mt-4 text-sm text-slate-500">Total registrados</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{counts.customers}</p>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <ContactRound className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Plan</span>
              </div>
              <p className="mt-4 text-sm text-slate-500">Uso actual</p>
              <p className="mt-1 text-2xl font-black text-slate-950">
                {counts.customers} / {tenantMode.operationalLimits.customers}
              </p>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <CircleDollarSign className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Saldo</span>
              </div>
              <p className="mt-4 text-sm text-slate-500">Pendiente total</p>
              <p className="mt-1 text-2xl font-black text-slate-950">${pendingBalanceTotal.toFixed(2)}</p>
            </CardContent>
          </Card>

          <Card className="rounded-[24px] border-slate-200 bg-white shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
                  <Users className="h-4.5 w-4.5" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Seguimiento</span>
              </div>
              <p className="mt-4 text-sm text-slate-500">Con saldo pendiente</p>
              <p className="mt-1 text-2xl font-black text-slate-950">{customersWithBalance}</p>
            </CardContent>
          </Card>
        </div>

        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
          <CardHeader className="px-6 pt-6 pb-3">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#588100] text-white">
                <Plus className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-lg text-slate-950">Nuevo cliente</CardTitle>
                <p className="mt-1 text-sm text-slate-500">
                  Registra contacto, correo y dirección para llevar mejor seguimiento comercial.
                </p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="px-6 pb-6">
            {limitReached ? (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Llegaste al limite de tu plan actual.{" "}
                <Button asChild variant="link" className="h-auto p-0">
                  <Link href="/billing">Mejorar plan</Link>
                </Button>
              </div>
            ) : null}
            <CustomerForm disabled={limitReached} />
          </CardContent>
        </Card>

        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
          <CardHeader className="px-6 pt-6 pb-3">
            <CardTitle className="text-lg text-slate-950">Listado de clientes</CardTitle>
            <p className="text-sm text-slate-500">
              Busca clientes y entra rápido a su detalle o edición.
            </p>
          </CardHeader>
          <CardContent className="space-y-4 px-6 pb-6">
            <form className="mb-2 flex flex-col gap-2 sm:flex-row">
              <Input
                name="q"
                defaultValue={resolvedSearchParams.q ?? ""}
                placeholder="Buscar por nombre, teléfono o correo"
                className="rounded-2xl border-slate-200 bg-white"
              />
              <Button type="submit" className="rounded-full bg-[#588100] text-white hover:bg-[#4b6f00]">
                Buscar
              </Button>
            </form>
            <CustomerList
              customers={customers.map((customer) => ({
                id: customer.id,
                name: customer.name,
                phone: customer.phone,
                email: customer.email,
                address: customer.address,
                balance: customer.balance.toString(),
              }))}
            />
          </CardContent>
        </Card>
      </div>
    </BasicModuleShell>
  );
}

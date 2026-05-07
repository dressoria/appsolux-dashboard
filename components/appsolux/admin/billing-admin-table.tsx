"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TenantBillingRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string | null;
  planKey: "free" | "trial" | "pro" | "enterprise";
  planName: string;
  status: "active" | "trialing" | "past_due" | "canceled" | "manual";
  trialEndsAt?: string | Date | null;
  currentPeriodEndsAt?: string | Date | null;
  canRequestDedicatedErp: boolean;
  erpStatus: string;
  erpDisplayStatus: string;
};

type EditableState = {
  planKey: TenantBillingRow["planKey"];
  status: TenantBillingRow["status"];
  trialEndsAt: string;
  currentPeriodEndsAt: string;
};

const planOptions: TenantBillingRow["planKey"][] = [
  "free",
  "trial",
  "pro",
  "enterprise",
];
const statusOptions: TenantBillingRow["status"][] = [
  "active",
  "trialing",
  "manual",
  "past_due",
  "canceled",
];

function toDateInput(value: TenantBillingRow["trialEndsAt"]) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function buildInitialState(tenants: TenantBillingRow[]) {
  return Object.fromEntries(
    tenants.map((tenant) => [
      tenant.tenantId,
      {
        planKey: tenant.planKey,
        status: tenant.status,
        trialEndsAt: toDateInput(tenant.trialEndsAt),
        currentPeriodEndsAt: toDateInput(tenant.currentPeriodEndsAt),
      },
    ])
  ) as Record<string, EditableState>;
}

export function BillingAdminTable({
  tenants,
}: {
  tenants: TenantBillingRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [state, setState] = useState(() => buildInitialState(tenants));
  const [message, setMessage] = useState<string | null>(null);
  const sortedTenants = useMemo(
    () =>
      [...tenants].sort((a, b) =>
        a.tenantName.localeCompare(b.tenantName, "es")
      ),
    [tenants]
  );

  function updateTenant(tenantId: string, next: Partial<EditableState>) {
    setState((current) => ({
      ...current,
      [tenantId]: {
        ...current[tenantId],
        ...next,
      },
    }));
  }

  async function saveTenant(tenantId: string) {
    setMessage(null);
    const value = state[tenantId];
    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/subscription`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: value.planKey,
          status: value.status,
          trialEndsAt: value.trialEndsAt || null,
          currentPeriodEndsAt: value.currentPeriodEndsAt || null,
        }),
      }
    );
    const payload = (await response.json()) as {
      ok?: boolean;
      message?: string;
    };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo guardar el cambio.");
      return;
    }

    setMessage("Plan actualizado.");
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-3">
      {message ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">
          {message}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-md border">
        <table className="min-w-[1100px] w-full text-left text-sm">
          <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Tenant</th>
              <th className="px-3 py-2 font-medium">Owner</th>
              <th className="px-3 py-2 font-medium">Plan</th>
              <th className="px-3 py-2 font-medium">Estado</th>
              <th className="px-3 py-2 font-medium">Trial fin</th>
              <th className="px-3 py-2 font-medium">Periodo fin</th>
              <th className="px-3 py-2 font-medium">ERP</th>
              <th className="px-3 py-2 font-medium">Accion</th>
            </tr>
          </thead>
          <tbody>
            {sortedTenants.map((tenant) => {
              const value = state[tenant.tenantId];

              return (
                <tr key={tenant.tenantId} className="border-t align-top">
                  <td className="px-3 py-3">
                    <p className="font-medium">{tenant.tenantName}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.tenantSlug}
                    </p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground">
                    {tenant.ownerEmail ?? "Sin owner"}
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={value.planKey}
                      onChange={(event) =>
                        updateTenant(tenant.tenantId, {
                          planKey: event.target.value as EditableState["planKey"],
                        })
                      }
                    >
                      {planOptions.map((plan) => (
                        <option key={plan} value={plan}>
                          {plan}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <select
                      className="h-8 rounded-md border bg-background px-2 text-sm"
                      value={value.status}
                      onChange={(event) =>
                        updateTenant(tenant.tenantId, {
                          status: event.target.value as EditableState["status"],
                        })
                      }
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="date"
                      value={value.trialEndsAt}
                      onChange={(event) =>
                        updateTenant(tenant.tenantId, {
                          trialEndsAt: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <Input
                      type="date"
                      value={value.currentPeriodEndsAt}
                      onChange={(event) =>
                        updateTenant(tenant.tenantId, {
                          currentPeriodEndsAt: event.target.value,
                        })
                      }
                    />
                  </td>
                  <td className="px-3 py-3">
                    <p>{tenant.erpDisplayStatus}</p>
                    <p className="text-xs text-muted-foreground">
                      {tenant.canRequestDedicatedErp
                        ? "Puede solicitar ERP"
                        : "ERP bloqueado"}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => void saveTenant(tenant.tenantId)}
                    >
                      Guardar
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {tenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tenants para administrar.
        </p>
      ) : null}
    </div>
  );
}

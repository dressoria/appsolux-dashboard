"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type LegacyPlanKey = "free" | "trial" | "pro" | "enterprise";
type SubscriptionStatus = "active" | "trialing" | "past_due" | "suspended" | "canceled" | "manual";
type BillingMode = "stripe" | "manual" | "internal" | "trial";
type CommercialPlan = "BASIC" | "PLUS" | "ADVANCED" | "ENTERPRISE";
type OperatingMode = "CORE" | "SHARED_ERP" | "DEDICATED_ERP";
type OperationalStatus = "active" | "pending_setup" | "suspended" | "disabled";
type BusinessSuiteStatus =
  | "locked"
  | "pending_migration"
  | "migrating"
  | "active"
  | "failed"
  | "suspended";
type BusinessSuiteMode = "none" | "shared" | "dedicated";
type PublicPlan = "basic" | "business_shared" | "business_dedicated";
type FeatureKey =
  | "inventory_basic"
  | "pos_basic"
  | "sales_basic"
  | "customers_basic"
  | "reports_basic"
  | "sri_invoicing"
  | "sri_configuration"
  | "inventory_advanced"
  | "purchases"
  | "warehouses"
  | "kardex"
  | "advanced_reports"
  | "shared_erp"
  | "dedicated_erp"
  | "erp_provisioning"
  | "admin_access"
  | "beta_access";
type OverrideState = "default" | "enabled" | "disabled";

type TenantBillingRow = {
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  ownerEmail: string | null;
  planKey: LegacyPlanKey;
  planName: string;
  status: SubscriptionStatus;
  billingMode: BillingMode;
  trialEndsAt?: string | Date | null;
  currentPeriodEndsAt?: string | Date | null;
  commercialPlan: CommercialPlan;
  publicPlan: PublicPlan;
  businessSuiteMode: BusinessSuiteMode;
  businessSuiteStatus: BusinessSuiteStatus;
  configuredOperatingMode: OperatingMode;
  effectiveOperatingMode: OperatingMode;
  operationalStatus: OperationalStatus;
  operationalConfig: {
    operatingMode: OperatingMode;
    status: OperationalStatus;
    businessSuiteStatus: BusinessSuiteStatus;
    sriEnabled: boolean;
    sharedErpEnabled: boolean;
    dedicatedErpEnabled: boolean;
    suspendedAt: string | Date | null;
    notes: string | null;
  };
  effectiveFeatures: Record<FeatureKey, boolean>;
  featureOverrides: Array<{
    featureKey: FeatureKey;
    enabled: boolean;
    source: string;
    notes: string | null;
  }>;
  configBackfillPending: boolean;
  erpStatus: string;
  erpDisplayStatus: string;
  hasRealDedicatedErp: boolean;
  hasPendingDedicatedErp: boolean;
  sriEnabled: boolean;
  sharedErpEnabled: boolean;
  dedicatedErpEnabled: boolean;
  latestActivationJob: {
    id: string;
    status: "queued" | "running" | "succeeded" | "failed" | "needs_review";
    dryRun: boolean;
    summary: {
      tenant?: {
        name?: string;
        slug?: string;
      };
      subscription?: {
        planKey?: string;
        planName?: string;
        status?: string;
        billingMode?: string;
      };
      businessSuite?: {
        mode?: string;
        sourceMode?: string;
        targetMode?: string;
      };
      counts?: {
        products?: number;
        customers?: number;
        stockMovements?: number;
        salesHistory?: number;
        openCreditSales?: number;
        sriDocuments?: number;
        sriAuthorizedDocuments?: number;
      };
      warnings?: string[];
      readyForReview?: boolean;
    } | null;
    createdAt: string | Date;
  } | null;
};

type PlanEditableState = {
  planKey: LegacyPlanKey;
  status: SubscriptionStatus;
  billingMode: BillingMode;
  trialEndsAt: string;
  currentPeriodEndsAt: string;
};

type OperationalEditableState = {
  operatingMode: OperatingMode;
  status: OperationalStatus;
  businessSuiteStatus: BusinessSuiteStatus;
  sriEnabled: boolean;
  sharedErpEnabled: boolean;
  dedicatedErpEnabled: boolean;
  notes: string;
};

type FeatureEditableState = Record<FeatureKey, OverrideState>;
type BusinessSuiteActionMode = Extract<BusinessSuiteMode, "shared" | "dedicated">;

const planOptions: LegacyPlanKey[] = ["free", "trial", "pro", "enterprise"];
const statusOptions: SubscriptionStatus[] = [
  "active",
  "trialing",
  "manual",
  "past_due",
  "suspended",
  "canceled",
];
const billingModeOptions: BillingMode[] = ["manual", "internal", "trial", "stripe"];
const operatingModeOptions: OperatingMode[] = [
  "CORE",
  "SHARED_ERP",
  "DEDICATED_ERP",
];
const operationalStatusOptions: OperationalStatus[] = [
  "active",
  "pending_setup",
  "suspended",
  "disabled",
];
const businessSuiteStatusOptions: BusinessSuiteStatus[] = [
  "locked",
  "pending_migration",
  "migrating",
  "active",
  "failed",
  "suspended",
];
const featureOptions: Array<{ key: FeatureKey; label: string }> = [
  { key: "inventory_basic", label: "Inventario basico" },
  { key: "pos_basic", label: "POS basico" },
  { key: "sales_basic", label: "Ventas basicas" },
  { key: "customers_basic", label: "Clientes basicos" },
  { key: "reports_basic", label: "Reportes basicos" },
  { key: "sri_invoicing", label: "Facturacion SRI" },
  { key: "sri_configuration", label: "Configuracion SRI" },
  { key: "inventory_advanced", label: "Inventario avanzado" },
  { key: "purchases", label: "Compras" },
  { key: "warehouses", label: "Bodegas" },
  { key: "kardex", label: "Kardex" },
  { key: "advanced_reports", label: "Reportes avanzados" },
  { key: "shared_erp", label: "Shared ERP" },
  { key: "dedicated_erp", label: "Dedicated ERP" },
  { key: "erp_provisioning", label: "Provisioning ERP" },
  { key: "admin_access", label: "Admin access" },
  { key: "beta_access", label: "Beta access" },
];

function toDateInput(value: string | Date | null | undefined) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toISOString().slice(0, 10);
}

function buildPlanState(tenants: TenantBillingRow[]) {
  return Object.fromEntries(
    tenants.map((tenant) => [
      tenant.tenantId,
      {
        planKey: tenant.planKey,
        status: tenant.status,
        billingMode: tenant.billingMode,
        trialEndsAt: toDateInput(tenant.trialEndsAt),
        currentPeriodEndsAt: toDateInput(tenant.currentPeriodEndsAt),
      },
    ])
  ) as Record<string, PlanEditableState>;
}

function buildOperationalState(tenants: TenantBillingRow[]) {
  return Object.fromEntries(
    tenants.map((tenant) => [
      tenant.tenantId,
      {
        operatingMode: tenant.operationalConfig.operatingMode,
        status: tenant.operationalConfig.status,
        businessSuiteStatus: tenant.operationalConfig.businessSuiteStatus,
        sriEnabled: tenant.operationalConfig.sriEnabled,
        sharedErpEnabled: tenant.operationalConfig.sharedErpEnabled,
        dedicatedErpEnabled: tenant.operationalConfig.dedicatedErpEnabled,
        notes: tenant.operationalConfig.notes ?? "",
      },
    ])
  ) as Record<string, OperationalEditableState>;
}

function buildFeatureState(tenants: TenantBillingRow[]) {
  return Object.fromEntries(
    tenants.map((tenant) => {
      const overrides = new Map(
        tenant.featureOverrides.map((override) => [override.featureKey, override.enabled])
      );

      return [
        tenant.tenantId,
        Object.fromEntries(
          featureOptions.map(({ key }) => [
            key,
            overrides.has(key)
              ? overrides.get(key)
                ? "enabled"
                : "disabled"
              : "default",
          ])
        ),
      ];
    })
  ) as Record<string, FeatureEditableState>;
}

function badgeClass(enabled: boolean) {
  return enabled
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : "border-slate-200 bg-slate-50 text-slate-500";
}

function publicPlanLabel(plan: PublicPlan) {
  if (plan === "business_dedicated") return "Gestion Empresarial Dedicada";
  if (plan === "business_shared") return "Gestion Empresarial Compartida";
  return "Basico";
}

function businessSuiteModeLabel(mode: BusinessSuiteMode) {
  if (mode === "dedicated") return "Dedicado";
  if (mode === "shared") return "Compartido";
  return "Sin activar";
}

export function BillingAdminTable({
  tenants,
}: {
  tenants: TenantBillingRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [planState, setPlanState] = useState(() => buildPlanState(tenants));
  const [operationalState, setOperationalState] = useState(() =>
    buildOperationalState(tenants)
  );
  const [featureState, setFeatureState] = useState(() => buildFeatureState(tenants));
  const sortedTenants = useMemo(
    () =>
      [...tenants].sort((a, b) =>
        a.tenantName.localeCompare(b.tenantName, "es")
      ),
    [tenants]
  );

  function updatePlanState(tenantId: string, next: Partial<PlanEditableState>) {
    setPlanState((current) => ({
      ...current,
      [tenantId]: { ...current[tenantId], ...next },
    }));
  }

  function updateOperationalState(
    tenantId: string,
    next: Partial<OperationalEditableState>
  ) {
    setOperationalState((current) => ({
      ...current,
      [tenantId]: { ...current[tenantId], ...next },
    }));
  }

  function updateFeatureState(
    tenantId: string,
    featureKey: FeatureKey,
    value: OverrideState
  ) {
    setFeatureState((current) => ({
      ...current,
      [tenantId]: {
        ...current[tenantId],
        [featureKey]: value,
      },
    }));
  }

  async function savePlan(tenantId: string) {
    setMessage(null);
    const reason = window.prompt("Razón del cambio de plan (queda en auditoría):")?.trim();
    if (!reason) {
      setMessage("El cambio requiere una razón de auditoría.");
      return;
    }
    const value = planState[tenantId];
    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/subscription`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          planKey: value.planKey,
          status: value.status,
          billingMode: value.billingMode,
          trialEndsAt: value.trialEndsAt || null,
          currentPeriodEndsAt: value.currentPeriodEndsAt || null,
          reason,
        }),
      }
    );
    const payload = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo guardar el plan.");
      return;
    }

    setMessage("Plan comercial actualizado.");
    startTransition(() => router.refresh());
  }

  async function saveOperationalConfig(tenantId: string) {
    setMessage(null);
    const value = operationalState[tenantId];
    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/operational-config`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(value),
      }
    );
    const payload = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo guardar la configuracion operativa.");
      return;
    }

    setMessage("Configuracion operativa actualizada.");
    startTransition(() => router.refresh());
  }

  async function prepareInternalActivation(
    tenantId: string,
    businessSuiteMode: BusinessSuiteActionMode
  ) {
    setMessage(null);
    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/business-suite/internal-activation`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessSuiteMode }),
      }
    );
    const payload = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo preparar la activacion interna.");
      return;
    }

    setMessage("Activacion interna preparada.");
    startTransition(() => router.refresh());
  }

  async function runMigrationDryRun(
    tenantId: string,
    businessSuiteMode: BusinessSuiteActionMode
  ) {
    setMessage(null);
    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/business-suite/dry-run`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessSuiteMode }),
      }
    );
    const payload = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo ejecutar el dry-run.");
      return;
    }

    setMessage("Dry-run de migracion registrado.");
    startTransition(() => router.refresh());
  }

  async function saveFeatureOverride(tenantId: string, featureKey: FeatureKey) {
    setMessage(null);
    const value = featureState[tenantId][featureKey];

    if (value === "default") {
      const response = await fetch(
        `/api/admin/billing/tenants/${tenantId}/feature-overrides`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featureKey }),
        }
      );
      const payload = (await response.json()) as { ok?: boolean; message?: string };

      if (!response.ok || !payload.ok) {
        setMessage(payload.message ?? "No se pudo borrar el override.");
        return;
      }

      setMessage(`Override eliminado para ${featureKey}.`);
      startTransition(() => router.refresh());
      return;
    }

    const response = await fetch(
      `/api/admin/billing/tenants/${tenantId}/feature-overrides`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featureKey,
          enabled: value === "enabled",
        }),
      }
    );
    const payload = (await response.json()) as { ok?: boolean; message?: string };

    if (!response.ok || !payload.ok) {
      setMessage(payload.message ?? "No se pudo guardar el override.");
      return;
    }

    setMessage(`Override actualizado para ${featureKey}.`);
    startTransition(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      {message ? (
        <div className="rounded-md border bg-muted/40 p-3 text-sm">{message}</div>
      ) : null}

      {sortedTenants.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No hay tenants para administrar.
        </p>
      ) : null}

      {sortedTenants.map((tenant) => {
        const plan = planState[tenant.tenantId];
        const operational = operationalState[tenant.tenantId];

        return (
          <div key={tenant.tenantId} className="rounded-xl border bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold">{tenant.tenantName}</p>
                <p className="text-sm text-muted-foreground">
                  {tenant.tenantSlug} · {tenant.ownerEmail ?? "Sin owner"}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span className={`rounded-full border px-2.5 py-1 ${badgeClass(true)}`}>
                  Plan comercial: {tenant.commercialPlan}
                </span>
                <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-sky-700">
                  Suite: {publicPlanLabel(tenant.publicPlan)}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Modo configurado: {tenant.configuredOperatingMode}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Modo efectivo: {tenant.effectiveOperatingMode}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-slate-700">
                  Estado operativo: {tenant.operationalStatus}
                </span>
              </div>
            </div>

            {tenant.configBackfillPending ? (
              <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                Este tenant aun no tiene `TenantOperationalConfig` persistido. Se
                esta mostrando fallback seguro en CORE mientras se aplica el
                backfill.
              </div>
            ) : null}

            <div className="mt-4 grid gap-4 xl:grid-cols-3">
              <section className="rounded-lg border p-4">
                <p className="font-medium">Plan comercial</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Plan legacy</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={plan.planKey}
                        onChange={(event) =>
                          updatePlanState(tenant.tenantId, {
                            planKey: event.target.value as LegacyPlanKey,
                          })
                        }
                      >
                        {planOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Estado</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={plan.status}
                        onChange={(event) =>
                          updatePlanState(tenant.tenantId, {
                            status: event.target.value as SubscriptionStatus,
                          })
                        }
                      >
                        {statusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Cobro</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={plan.billingMode}
                        onChange={(event) =>
                          updatePlanState(tenant.tenantId, {
                            billingMode: event.target.value as BillingMode,
                          })
                        }
                      >
                        {billingModeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Trial fin</span>
                      <Input
                        type="date"
                        value={plan.trialEndsAt}
                        onChange={(event) =>
                          updatePlanState(tenant.tenantId, {
                            trialEndsAt: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Periodo fin</span>
                      <Input
                        type="date"
                        value={plan.currentPeriodEndsAt}
                        onChange={(event) =>
                          updatePlanState(tenant.tenantId, {
                            currentPeriodEndsAt: event.target.value,
                          })
                        }
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void savePlan(tenant.tenantId)}
                  >
                    Guardar plan
                  </Button>
                </div>
              </section>

              <section className="rounded-lg border p-4">
                <p className="font-medium">Configuracion operativa</p>
                <div className="mt-3 space-y-3 text-sm">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Modo</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={operational.operatingMode}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            operatingMode: event.target.value as OperatingMode,
                          })
                        }
                      >
                        {operatingModeOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">Estado</span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={operational.status}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            status: event.target.value as OperationalStatus,
                          })
                        }
                      >
                        {operationalStatusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-muted-foreground">
                        Estado Gestion Empresarial
                      </span>
                      <select
                        className="h-9 w-full rounded-md border bg-background px-2"
                        value={operational.businessSuiteStatus}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            businessSuiteStatus: event.target.value as BusinessSuiteStatus,
                          })
                        }
                      >
                        {businessSuiteStatusOptions.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="grid gap-2">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={operational.sriEnabled}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            sriEnabled: event.target.checked,
                          })
                        }
                      />
                      <span>SRI habilitado</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={operational.sharedErpEnabled}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            sharedErpEnabled: event.target.checked,
                          })
                        }
                      />
                      <span>Gestion compartida habilitada</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={operational.dedicatedErpEnabled}
                        onChange={(event) =>
                          updateOperationalState(tenant.tenantId, {
                            dedicatedErpEnabled: event.target.checked,
                          })
                        }
                      />
                      <span>Gestion dedicada habilitada</span>
                    </label>
                  </div>
                  <label className="space-y-1">
                    <span className="text-muted-foreground">Notas</span>
                    <textarea
                      className="min-h-24 w-full rounded-md border bg-background p-2"
                      value={operational.notes}
                      onChange={(event) =>
                        updateOperationalState(tenant.tenantId, {
                          notes: event.target.value,
                        })
                      }
                    />
                  </label>
                  <Button
                    type="button"
                    size="sm"
                    disabled={isPending}
                    onClick={() => void saveOperationalConfig(tenant.tenantId)}
                  >
                    Guardar configuracion
                  </Button>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        void prepareInternalActivation(tenant.tenantId, "shared")
                      }
                    >
                      Marcar interno compartido
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={isPending}
                      onClick={() =>
                        void runMigrationDryRun(tenant.tenantId, "shared")
                      }
                    >
                      Dry-run compartido
                    </Button>
                  </div>
                </div>
              </section>

              <section className="rounded-lg border p-4">
                <p className="font-medium">Estado efectivo</p>
                <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                  <p>Provision dedicado: {tenant.erpDisplayStatus}</p>
                  <p>Billing mode: {tenant.billingMode}</p>
                  <p>Suite publica: {publicPlanLabel(tenant.publicPlan)}</p>
                  <p>Modo suite: {businessSuiteModeLabel(tenant.businessSuiteMode)}</p>
                  <p>Estado suite: {tenant.businessSuiteStatus}</p>
                  <p>SRI flag: {tenant.sriEnabled ? "Habilitado" : "Bloqueado"}</p>
                  <p>
                    Gestion compartida: {tenant.sharedErpEnabled ? "Habilitado" : "Bloqueado"}
                  </p>
                  <p>
                    Gestion dedicada:{" "}
                    {tenant.dedicatedErpEnabled ? "Habilitado" : "Bloqueado"}
                  </p>
                  <p>ERP real activo: {tenant.hasRealDedicatedErp ? "Si" : "No"}</p>
                  <p>
                    ERP pendiente/error: {tenant.hasPendingDedicatedErp ? "Si" : "No"}
                  </p>
                  {tenant.latestActivationJob ? (
                    <div className="rounded-md border bg-slate-50 p-3">
                      <p className="font-medium text-slate-900">
                        Ultimo dry-run: {tenant.latestActivationJob.status}
                      </p>
                      <p>
                        Plan: {tenant.latestActivationJob.summary?.subscription?.planName ?? tenant.planName} ·
                        Cobro: {tenant.latestActivationJob.summary?.subscription?.billingMode ?? tenant.billingMode} ·
                        Destino: {tenant.latestActivationJob.summary?.businessSuite?.targetMode ?? tenant.publicPlan}
                      </p>
                      <p>
                        Productos: {tenant.latestActivationJob.summary?.counts?.products ?? 0} ·
                        Clientes: {tenant.latestActivationJob.summary?.counts?.customers ?? 0} ·
                        Movs.: {tenant.latestActivationJob.summary?.counts?.stockMovements ?? 0} ·
                        Ventas: {tenant.latestActivationJob.summary?.counts?.salesHistory ?? 0} ·
                        SRI: {tenant.latestActivationJob.summary?.counts?.sriDocuments ?? 0}
                      </p>
                      {(tenant.latestActivationJob.summary?.warnings?.length ?? 0) > 0 ? (
                        <p>
                          Advertencias: {tenant.latestActivationJob.summary?.warnings?.length}
                        </p>
                      ) : null}
                      <p>
                        Listo para revision:{" "}
                        {tenant.latestActivationJob.summary?.readyForReview ? "Si" : "No"}
                      </p>
                    </div>
                  ) : null}
                </div>
              </section>
            </div>

            <details className="mt-4 rounded-lg border p-4">
              <summary className="cursor-pointer font-medium">
                Editar feature overrides
              </summary>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {featureOptions.map(({ key, label }) => {
                  const currentValue = tenant.effectiveFeatures[key];
                  const overrideValue = featureState[tenant.tenantId][key];

                  return (
                    <div key={key} className="rounded-md border p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium">{label}</p>
                        <span className={`rounded-full border px-2 py-0.5 text-xs ${badgeClass(currentValue)}`}>
                          {currentValue ? "Activa" : "Bloqueada"}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">{key}</p>
                      <div className="mt-3 flex items-center gap-2">
                        <select
                          className="h-9 flex-1 rounded-md border bg-background px-2"
                          value={overrideValue}
                          onChange={(event) =>
                            updateFeatureState(
                              tenant.tenantId,
                              key,
                              event.target.value as OverrideState
                            )
                          }
                        >
                          <option value="default">Default</option>
                          <option value="enabled">Forzar ON</option>
                          <option value="disabled">Forzar OFF</option>
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isPending}
                          onClick={() => void saveFeatureOverride(tenant.tenantId, key)}
                        >
                          Aplicar
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          </div>
        );
      })}
    </div>
  );
}

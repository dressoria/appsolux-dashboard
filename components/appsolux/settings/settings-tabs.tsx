"use client";

import Link from "next/link";
import { useState } from "react";
import { CompanySettingsCard } from "./company-settings-card";
import {
  FiscalSettingsPlaceholder,
} from "./fiscal-settings-placeholder";
import { UsersPermissionsSettings } from "./users-permissions-settings";
import { CreatePaymentAccountForm } from "./create-payment-account-form";
import { CreatePaymentMethodForm } from "./create-payment-method-form";
import { PaymentMethodAccountForm } from "./payment-method-account-form";
import { WarehousesSettingsCard } from "./warehouses-settings-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import type {
  ErpnextAccount,
  ErpnextCompany,
  ErpnextCompanyDetail,
  ErpnextModeOfPaymentDetail,
  ErpnextWarehouse,
} from "@/types/erpnext";
import type { MembershipRole, MembershipStatus, UserStatus } from "@prisma/client";

type MembershipRow = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    createdAt: Date | string;
  };
};

type SettingsTabId =
  | "empresa"
  | "sucursales"
  | "pagos"
  | "fiscal"
  | "usuarios"
  | "integraciones";

type SettingsTabsProps = {
  company?: ErpnextCompanyDetail;
  companies: ErpnextCompany[];
  warehouses: ErpnextWarehouse[];
  modesOfPayment: ErpnextModeOfPaymentDetail[];
  accounts: ErpnextAccount[];
  erpActive: boolean;
  erpDisplayStatus: string;
  memberships: MembershipRow[];
};

const TABS: Array<{ id: SettingsTabId; label: string }> = [
  { id: "empresa", label: "Empresa" },
  { id: "sucursales", label: "Sucursales" },
  { id: "pagos", label: "Pagos" },
  { id: "fiscal", label: "Fiscal / SRI" },
  { id: "usuarios", label: "Usuarios" },
  { id: "integraciones", label: "Integraciones" },
];

function ErpNotActiveCard({
  title,
  what,
  erpDisplayStatus,
}: {
  title: string;
  what: string;
  erpDisplayStatus: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        <p>
          Esta seccion requiere ERP activo. Estado actual:{" "}
          <span className="font-medium">{erpDisplayStatus}</span>.
        </p>
        <p>
          Una vez que tu ERP este listo, podras configurar {what} desde aqui.
        </p>
        <Link
          href={routes.erp}
          className="inline-flex h-8 items-center rounded-lg border bg-background px-3 text-sm transition-colors hover:bg-muted"
        >
          Ver estado del ERP
        </Link>
      </CardContent>
    </Card>
  );
}

type IntegrationCardItem = {
  label: string;
  description: string;
  status: string;
  statusClassName: string;
  href?: string;
  linkLabel?: string;
};

function IntegrationCard({
  label,
  description,
  status,
  statusClassName,
  href,
  linkLabel,
}: IntegrationCardItem) {
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
        </div>
        <span
          className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${statusClassName}`}
        >
          {status}
        </span>
      </div>
      {href && linkLabel ? (
        <Link
          href={href}
          className="inline-flex h-7 items-center rounded-lg border bg-background px-3 text-xs transition-colors hover:bg-muted"
        >
          {linkLabel}
        </Link>
      ) : null}
    </div>
  );
}

function IntegrationsSection({
  erpActive,
  erpDisplayStatus,
}: {
  erpActive: boolean;
  erpDisplayStatus: string;
}) {
  const cards: IntegrationCardItem[] = [
    {
      label: "Conversaciones",
      description:
        "Chatwoot: bandeja unificada de chats, WhatsApp, Instagram y Messenger.",
      status: "Activo",
      statusClassName: "border-green-200 bg-green-50 text-green-700",
      href: routes.conversations,
      linkLabel: "Ver conversaciones",
    },
    {
      label: "ERP Comercial",
      description:
        "Ventas, inventario, clientes, compras y contabilidad integrados.",
      status: erpActive ? "Activo" : erpDisplayStatus,
      statusClassName: erpActive
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-amber-200 bg-amber-50 text-amber-700",
      href: routes.erp,
      linkLabel: "Ver ERP",
    },
    {
      label: "Punto de venta (POS)",
      description:
        "Vender con productos, clientes, bodegas y pagos del ERP.",
      status: erpActive ? "Disponible" : "Requiere ERP activo",
      statusClassName: erpActive
        ? "border-green-200 bg-green-50 text-green-700"
        : "border-slate-200 bg-slate-50 text-slate-600",
      href: erpActive ? routes.pos : undefined,
      linkLabel: erpActive ? "Abrir POS" : undefined,
    },
    {
      label: "Canales",
      description:
        "Conecta WhatsApp, Instagram, Messenger y Webchat a tu cuenta.",
      status: "Configurar",
      statusClassName: "border-blue-200 bg-blue-50 text-blue-700",
      href: routes.channels,
      linkLabel: "Ver canales",
    },
  ];

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        {cards.map((card) => (
          <IntegrationCard key={card.label} {...card} />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        El estado de integraciones es de solo lectura. No se exponen tokens,
        claves ni endpoints en esta pantalla.
      </p>
    </div>
  );
}

export function SettingsTabs({
  company,
  companies,
  warehouses,
  modesOfPayment,
  accounts,
  erpActive,
  erpDisplayStatus,
  memberships,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("empresa");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-xl border bg-muted/30 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "whitespace-nowrap rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-sm"
                : "whitespace-nowrap rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-background/70"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "empresa" ? (
        <CompanySettingsCard company={company} />
      ) : null}

      {activeTab === "sucursales" ? (
        erpActive ? (
          <WarehousesSettingsCard
            warehouses={warehouses}
            companies={companies}
            defaultCompany={company?.name}
          />
        ) : (
          <ErpNotActiveCard
            title="Sucursales y bodegas"
            what="bodegas, ubicaciones y sucursales"
            erpDisplayStatus={erpDisplayStatus}
          />
        )
      ) : null}

      {activeTab === "pagos" ? (
        erpActive ? (
          <div className="space-y-4">
            <CreatePaymentAccountForm
              companies={companies}
              defaultCompany={company?.name}
              defaultCurrency={company?.default_currency}
            />
            <CreatePaymentMethodForm />
            <PaymentMethodAccountForm
              modesOfPayment={modesOfPayment}
              accounts={accounts}
              company={company?.name}
            />
          </div>
        ) : (
          <ErpNotActiveCard
            title="Metodos de pago y cuentas"
            what="metodos de pago y cuentas de caja o banco"
            erpDisplayStatus={erpDisplayStatus}
          />
        )
      ) : null}

      {activeTab === "fiscal" ? <FiscalSettingsPlaceholder /> : null}

      {activeTab === "usuarios" ? (
        <UsersPermissionsSettings memberships={memberships} />
      ) : null}

      {activeTab === "integraciones" ? (
        <IntegrationsSection
          erpActive={erpActive}
          erpDisplayStatus={erpDisplayStatus}
        />
      ) : null}
    </div>
  );
}

"use client";

import { useState } from "react";
import { CompanySettingsCard } from "./company-settings-card";
import {
  FiscalSettingsPlaceholder,
  SecuritySettingsPlaceholder,
} from "./fiscal-settings-placeholder";
import { CreatePaymentAccountForm } from "./create-payment-account-form";
import { CreatePaymentMethodForm } from "./create-payment-method-form";
import { PaymentMethodAccountForm } from "./payment-method-account-form";
import { WarehousesSettingsCard } from "./warehouses-settings-card";
import type {
  ErpnextAccount,
  ErpnextCompany,
  ErpnextCompanyDetail,
  ErpnextModeOfPaymentDetail,
  ErpnextWarehouse,
} from "@/types/erpnext";

type SettingsTabId = "empresa" | "erp" | "pagos" | "fiscal" | "seguridad";

type SettingsTabsProps = {
  company?: ErpnextCompanyDetail;
  companies: ErpnextCompany[];
  warehouses: ErpnextWarehouse[];
  modesOfPayment: ErpnextModeOfPaymentDetail[];
  accounts: ErpnextAccount[];
};

const tabs: Array<{ id: SettingsTabId; label: string }> = [
  { id: "empresa", label: "Empresa" },
  { id: "erp", label: "ERP y bodegas" },
  { id: "pagos", label: "Pagos" },
  { id: "fiscal", label: "Fiscal / SRI" },
  { id: "seguridad", label: "Seguridad" },
];

export function SettingsTabs({
  company,
  companies,
  warehouses,
  modesOfPayment,
  accounts,
}: SettingsTabsProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("empresa");

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-xl border bg-muted/30 p-2">
        {tabs.map((tab) => (
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

      {activeTab === "erp" ? (
        <WarehousesSettingsCard
          warehouses={warehouses}
          companies={companies}
          defaultCompany={company?.name}
        />
      ) : null}

      {activeTab === "pagos" ? (
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
      ) : null}

      {activeTab === "fiscal" ? <FiscalSettingsPlaceholder /> : null}

      {activeTab === "seguridad" ? <SecuritySettingsPlaceholder /> : null}
    </div>
  );
}

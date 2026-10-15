"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Account = { id: string; code: string; name: string };

type Mapping = {
  id: string;
  key: string;
  accountId: string;
  account: Account;
};

type Props = {
  initialMappings: Mapping[];
  accounts: Account[];
  hasPlan: boolean;
};

const TABS: Record<string, string[]> = {
  General: ["TRANSITORY_CLEARING", "ASSUMED_WITHHOLDING_LIABILITY", "ASSUMED_WITHHOLDING_EXPENSE"],
  Cartera: [
    "CUSTOMER_RECEIVABLE_LOCAL", "CUSTOMER_RECEIVABLE_FOREIGN",
    "CUSTOMER_ADVANCE_LOCAL", "CUSTOMER_ADVANCE_FOREIGN", "IMPORTED_CUSTOMER_OBLIGATION",
    "SUPPLIER_PAYABLE_LOCAL", "SUPPLIER_PAYABLE_FOREIGN",
    "SUPPLIER_ADVANCE_LOCAL", "SUPPLIER_ADVANCE_FOREIGN", "IMPORTED_SUPPLIER_OBLIGATION",
  ],
  Inventario: [
    "INVENTORY_TAXABLE", "INVENTORY_ZERO", "INVENTORY_NON_OBJECT", "INVENTORY_EXEMPT",
    "COGS_TAXABLE", "COGS_ZERO", "COGS_NON_OBJECT", "COGS_EXEMPT",
    "UNSUPPORTED_MERCHANDISE", "PHYSICAL_COUNT_ADJUSTMENT",
  ],
  Impuestos: ["VAT_OUTPUT", "VAT_INPUT", "VAT_COST_EXPENSE"],
  "Cuentas Cierre": ["CLOSING_ACCUMULATED_RESULTS", "CLOSING_PROFIT_LOSS", "CLOSING_CURRENT_RESULT"],
  Tarjetas: ["CARD_CLEARING"],
};

const KEY_LABELS: Record<string, string> = {
  TRANSITORY_CLEARING: "Cuenta transitoria",
  ASSUMED_WITHHOLDING_LIABILITY: "Retención asumida – pasivo",
  ASSUMED_WITHHOLDING_EXPENSE: "Retención asumida – gasto",
  CUSTOMER_RECEIVABLE_LOCAL: "CxC local",
  CUSTOMER_RECEIVABLE_FOREIGN: "CxC exterior",
  CUSTOMER_ADVANCE_LOCAL: "Anticipo clientes local",
  CUSTOMER_ADVANCE_FOREIGN: "Anticipo clientes exterior",
  IMPORTED_CUSTOMER_OBLIGATION: "Obligación importada clientes",
  SUPPLIER_PAYABLE_LOCAL: "CxP local",
  SUPPLIER_PAYABLE_FOREIGN: "CxP exterior",
  SUPPLIER_ADVANCE_LOCAL: "Anticipo proveedores local",
  SUPPLIER_ADVANCE_FOREIGN: "Anticipo proveedores exterior",
  IMPORTED_SUPPLIER_OBLIGATION: "Obligación importada proveedores",
  INVENTORY_TAXABLE: "Inventario gravado",
  INVENTORY_ZERO: "Inventario tarifa 0",
  INVENTORY_NON_OBJECT: "Inventario no objeto",
  INVENTORY_EXEMPT: "Inventario exento",
  COGS_TAXABLE: "Costo ventas gravado",
  COGS_ZERO: "Costo ventas tarifa 0",
  COGS_NON_OBJECT: "Costo ventas no objeto",
  COGS_EXEMPT: "Costo ventas exento",
  UNSUPPORTED_MERCHANDISE: "Mercadería sin sustento",
  PHYSICAL_COUNT_ADJUSTMENT: "Ajuste conteo físico",
  VAT_OUTPUT: "IVA en ventas",
  VAT_INPUT: "IVA en compras",
  VAT_COST_EXPENSE: "IVA al costo/gasto",
  CLOSING_ACCUMULATED_RESULTS: "Resultados acumulados",
  CLOSING_PROFIT_LOSS: "Utilidad/pérdida ejercicio",
  CLOSING_CURRENT_RESULT: "Resultado ejercicio actual",
  CARD_CLEARING: "Cuenta puente tarjetas",
};

export function ParametersClient({ initialMappings, accounts, hasPlan }: Props) {
  const [activeTab, setActiveTab] = useState(Object.keys(TABS)[0]);
  const [mappingState, setMappingState] = useState<Record<string, string>>(() => {
    const state: Record<string, string> = {};
    for (const m of initialMappings) state[m.key] = m.accountId;
    return state;
  });
  const [saving, setSaving] = useState(false);

  if (!hasPlan) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Configura un plan de cuentas antes de definir parámetros contables.
        </CardContent>
      </Card>
    );
  }

  async function save() {
    setSaving(true);
    const keys = TABS[activeTab];
    const toSave = keys
      .filter((key) => mappingState[key])
      .map((key) => ({ key, accountId: mappingState[key] }));

    await fetch("/api/accounting/parameters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mappings: toSave }),
    });
    setSaving(false);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {Object.keys(TABS).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab
                ? "bg-blue-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            {TABS[activeTab].map((key) => (
              <div key={key} className="flex items-center gap-4">
                <label className="min-w-[200px] text-sm font-medium">
                  {KEY_LABELS[key] ?? key}
                </label>
                <select
                  value={mappingState[key] ?? ""}
                  onChange={(e) =>
                    setMappingState((prev) => ({ ...prev, [key]: e.target.value }))
                  }
                  className="flex-1 rounded border px-3 py-2 text-sm"
                >
                  <option value="">— Sin asignar —</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.code} {a.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="mt-4 flex justify-end">
            <Button onClick={save} disabled={saving}>
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

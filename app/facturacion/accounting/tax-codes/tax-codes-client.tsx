"use client";

import { Card, CardContent } from "@/components/ui/card";

type TaxMapping = {
  id: string;
  withholdingCode: {
    id: string;
    code: string;
    description: string;
    taxType: string;
  };
  assetAccount: { code: string; name: string } | null;
  liabilityAccount: { code: string; name: string } | null;
  expenseAccount: { code: string; name: string } | null;
};

type Props = {
  initialMappings: TaxMapping[];
};

export function TaxCodesClient({ initialMappings }: Props) {
  const ivaMappings = initialMappings.filter((m) => m.withholdingCode.taxType === "IVA");
  const rentaMappings = initialMappings.filter((m) => m.withholdingCode.taxType === "RENTA");

  function renderTable(mappings: TaxMapping[], title: string) {
    return (
      <div className="space-y-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-3 py-3 text-left font-medium">Código</th>
                  <th className="px-3 py-3 text-left font-medium">Descripción</th>
                  <th className="px-3 py-3 text-left font-medium">Activo</th>
                  <th className="px-3 py-3 text-left font-medium">Pasivo</th>
                  <th className="px-3 py-3 text-left font-medium">Gasto</th>
                </tr>
              </thead>
              <tbody>
                {mappings.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">
                      No hay códigos configurados. Configura los códigos de retención primero.
                    </td>
                  </tr>
                ) : (
                  mappings.map((m) => (
                    <tr key={m.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{m.withholdingCode.code}</td>
                      <td className="px-3 py-2 text-xs">{m.withholdingCode.description}</td>
                      <td className="px-3 py-2 text-xs">
                        {m.assetAccount ? `${m.assetAccount.code} ${m.assetAccount.name}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.liabilityAccount ? `${m.liabilityAccount.code} ${m.liabilityAccount.name}` : "—"}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {m.expenseAccount ? `${m.expenseAccount.code} ${m.expenseAccount.name}` : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {renderTable(ivaMappings, "Retenciones IVA")}
      {renderTable(rentaMappings, "Retenciones Renta")}
    </div>
  );
}

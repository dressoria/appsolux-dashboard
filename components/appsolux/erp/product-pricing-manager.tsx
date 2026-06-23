"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ErpnextItem } from "@/types/erpnext";
import type { ProductPricingRecord } from "@/types/quick-invoice";

type ProductPricingManagerProps = {
  items: ErpnextItem[];
  pricingMap: Record<string, ProductPricingRecord>;
};

type PriceFormState = {
  retailPrice: string;
  wholesalePrice: string;
  distributorPrice: string;
  notes: string;
};

function buildInitialState(
  items: ErpnextItem[],
  pricingMap: Record<string, ProductPricingRecord>
) {
  return Object.fromEntries(
    items.map((item) => {
      const pricing = pricingMap[item.item_code];

      return [
        item.item_code,
        {
          retailPrice: pricing?.retailPrice != null ? String(pricing.retailPrice) : "",
          wholesalePrice:
            pricing?.wholesalePrice != null ? String(pricing.wholesalePrice) : "",
          distributorPrice:
            pricing?.distributorPrice != null ? String(pricing.distributorPrice) : "",
          notes: pricing?.notes ?? "",
        } satisfies PriceFormState,
      ];
    })
  ) as Record<string, PriceFormState>;
}

export function ProductPricingManager({
  items,
  pricingMap,
}: ProductPricingManagerProps) {
  const [search, setSearch] = useState("");
  const [forms, setForms] = useState<Record<string, PriceFormState>>(
    () => buildInitialState(items, pricingMap)
  );
  const [savingCode, setSavingCode] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return items;
    }

    return items.filter((item) =>
      [item.item_name, item.item_code].some((value) =>
        value.toLowerCase().includes(query)
      )
    );
  }, [items, search]);

  function updateField(itemCode: string, field: keyof PriceFormState, value: string) {
    setForms((current) => ({
      ...current,
      [itemCode]: {
        ...current[itemCode],
        [field]: value,
      },
    }));
  }

  async function savePricing(item: ErpnextItem) {
    const form = forms[item.item_code];
    setSavingCode(item.item_code);
    setMessage(null);
    setIsError(false);

    try {
      const response = await fetch("/api/erpnext/product-pricing", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          itemCode: item.item_code,
          itemName: item.item_name,
          retailPrice: form.retailPrice,
          wholesalePrice: form.wholesalePrice,
          distributorPrice: form.distributorPrice,
          notes: form.notes,
        }),
      });
      const result = (await response.json()) as {
        success: boolean;
        error?: { message: string };
      };

      if (!result.success) {
        setIsError(true);
        setMessage(result.error?.message ?? "No se pudo guardar el precio.");
        return;
      }

      setMessage(`Precios guardados para ${item.item_name}.`);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar el precio."
      );
    } finally {
      setSavingCode(null);
    }
  }

  return (
    <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
      <CardHeader>
        <CardTitle className="text-xl text-slate-900">Precios por canal</CardTitle>
        <CardDescription>
          Define precio minorista, mayorista y distribuidor. Si un canal no tiene valor,
          el sistema usara el precio minorista.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pb-6">
        <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto]">
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar producto por codigo o nombre"
          />
          <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-600">
            {filteredItems.length} visibles
          </div>
        </div>

        {message ? (
          <div
            className={
              isError
                ? "rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                : "rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700"
            }
          >
            {message}
          </div>
        ) : null}

        <div className="space-y-3">
          {filteredItems.map((item) => {
            const form = forms[item.item_code];

            return (
              <div
                key={item.item_code}
                className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs text-slate-500">{item.item_code}</p>
                    <h3 className="font-medium text-slate-900">{item.item_name}</h3>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    className="rounded-full"
                    disabled={savingCode === item.item_code}
                    onClick={() => savePricing(item)}
                  >
                    {savingCode === item.item_code ? "Guardando..." : "Guardar"}
                  </Button>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor={`retail_${item.item_code}`}>Minorista</Label>
                    <Input
                      id={`retail_${item.item_code}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form?.retailPrice ?? ""}
                      onChange={(event) =>
                        updateField(item.item_code, "retailPrice", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`wholesale_${item.item_code}`}>Mayorista</Label>
                    <Input
                      id={`wholesale_${item.item_code}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form?.wholesalePrice ?? ""}
                      onChange={(event) =>
                        updateField(item.item_code, "wholesalePrice", event.target.value)
                      }
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`distributor_${item.item_code}`}>Distribuidor</Label>
                    <Input
                      id={`distributor_${item.item_code}`}
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form?.distributorPrice ?? ""}
                      onChange={(event) =>
                        updateField(item.item_code, "distributorPrice", event.target.value)
                      }
                    />
                  </div>
                </div>

                <div className="mt-3 space-y-1.5">
                  <Label htmlFor={`notes_${item.item_code}`}>Nota interna</Label>
                  <Input
                    id={`notes_${item.item_code}`}
                    value={form?.notes ?? ""}
                    onChange={(event) =>
                      updateField(item.item_code, "notes", event.target.value)
                    }
                    placeholder="Ej. canal sugerido, promo temporal, convenio"
                  />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

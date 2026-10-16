"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

import { normalizeProductInput, PRODUCT_TAX_OPTIONS, productTaxValue, productPriceCalculation } from "@/lib/core/inventory-product-input";

type Props = {
  mode: "create" | "edit";
  product?: Record<string, unknown>;
  warehouses: Array<{ id: string; code: string; name: string }>;
  brands: Array<{ id: string; name: string }>;
  units: Array<{ id: string; code: string; name: string; abbreviation: string | null }>;
  categories: Array<{ id: string; name: string }>;
};

const TABS = [
  { key: "data", label: "Datos del producto" },
  { key: "prices", label: "Impuestos y precios" },
  { key: "accounting", label: "Cuentas contables" },
  { key: "additional", label: "Información adicional" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function ProductFormClient({ mode, product, warehouses, brands, units, categories }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("data");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: (product?.name as string) ?? "",
    description: (product?.description as string) ?? "",
    type: (product?.type as string) ?? "PRODUCT",
    primaryCode: (product?.primaryCode as string) ?? "",
    auxiliaryCode: (product?.auxiliaryCode as string) ?? "",
    auxiliaryTransportCode: (product?.auxiliaryTransportCode as string) ?? "",
    barcode: (product?.barcode as string) ?? "",
    categoryId: (product?.categoryId as string) ?? "",
    unitId: (product?.unitId as string) ?? "",
    brandId: (product?.brandId as string) ?? "",
    defaultWarehouseId: (product?.defaultWarehouseId as string) ?? "",
    isActive: product?.isActive !== false,
    trackInventory: product?.trackInventory !== false,
    minStock: product?.minStock != null ? String(product.minStock) : "",
    price: product?.price != null ? String(Number(product.price)) : "0",
    price2: product?.price2 != null ? String(Number(product.price2)) : "",
    price3: product?.price3 != null ? String(Number(product.price3)) : "",
    price4: product?.price4 != null ? String(Number(product.price4)) : "",
    cost: product?.cost != null ? String(Number(product.cost)) : "",
    taxRate: product?.taxRate != null ? String(Number(product.taxRate)) : "15",
    taxCategory: (product?.taxCategory as string) ?? (Number(product?.taxRate ?? 15) === 0 ? "ZERO" : "TAXABLE"),
    salesAccountId: (product?.salesAccountId as string) ?? "",
    inventoryAccountId: (product?.inventoryAccountId as string) ?? "",
    cogsAccountId: (product?.cogsAccountId as string) ?? "",
    purchaseAccountId: (product?.purchaseAccountId as string) ?? "",
    color: (product?.color as string) ?? "",
    additionalComment: (product?.additionalComment as string) ?? "",
    isProcessed: (product?.isProcessed as boolean) ?? false,
    warrantyDuration: product?.warrantyDuration != null ? String(product.warrantyDuration) : "",
    warrantyUnit: (product?.warrantyUnit as string) ?? "",
  });

  const set = (key: string, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const handleSave = async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    let redirected = false;
    try {
      const payload = normalizeProductInput(form);

      const url = mode === "create"
        ? "/api/inventory/products"
        : `/api/inventory/products/${product?.id}`;
      const method = mode === "create" ? "POST" : "PATCH";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError(err.message ?? err.error ?? `No se pudo guardar (HTTP ${res.status}).`);
        return;
      }

      router.push(`/facturacion/products?saved=${mode === "create" ? "created" : "updated"}`);
      router.refresh();
      redirected = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo conectar con el servidor.");
    } finally {
      if (!redirected) {
        savingRef.current = false;
        setSaving(false);
      }
    }
  };

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Inventario</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            {mode === "create" ? "Nuevo producto" : form.name || "Editar producto"}
          </h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/facturacion/products")}>
            Volver
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </div>
      </div>

      <div className="flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.key}
            aria-pressed={tab === t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <Card>
        <CardContent className="p-6 space-y-4">
          {tab === "data" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-isActive" className="text-sm font-medium">Estado</label>
                  <select id="product-isActive"
                    className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
                    value={form.isActive ? "true" : "false"}
                    onChange={(e) => set("isActive", e.target.value === "true")}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="product-type" className="text-sm font-medium">Tipo de producto</label>
                  <select id="product-type"
                    className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
                    value={form.type}
                    onChange={(e) => set("type", e.target.value)}
                  >
                    <option value="PRODUCT">Producto simple</option>
                    <option value="SERVICE">Servicio</option>
                    <option value="COMBO">Combo</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="product-primaryCode" className="text-sm font-medium">Código principal</label>
                  <Input id="product-primaryCode" value={form.primaryCode} onChange={(e) => set("primaryCode", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="product-auxiliaryCode" className="text-sm font-medium">Código auxiliar</label>
                  <Input id="product-auxiliaryCode" value={form.auxiliaryCode} onChange={(e) => set("auxiliaryCode", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="product-barcode" className="text-sm font-medium">Código de barras</label>
                  <Input id="product-barcode" value={form.barcode} onChange={(e) => set("barcode", e.target.value)} className="mt-1" />
                </div>
              </div>
              <div>
                <label htmlFor="product-name" className="text-sm font-medium">Nombre *</label>
                <Input id="product-name" value={form.name} onChange={(e) => set("name", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label htmlFor="product-description" className="text-sm font-medium">Descripción</label>
                <textarea id="product-description"
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm min-h-[80px]"
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="product-categoryId" className="text-sm font-medium">Categoría</label>
                  <select id="product-categoryId" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={form.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
                    <option value="">— Sin categoría —</option>
                    {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="product-unitId" className="text-sm font-medium">Unidad</label>
                  <select id="product-unitId" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={form.unitId} onChange={(e) => set("unitId", e.target.value)}>
                    <option value="">— Sin unidad —</option>
                    {units.map((u) => <option key={u.id} value={u.id}>{u.name}{u.abbreviation ? ` (${u.abbreviation})` : ""}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="product-brandId" className="text-sm font-medium">Marca</label>
                  <select id="product-brandId" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={form.brandId} onChange={(e) => set("brandId", e.target.value)}>
                    <option value="">— Sin marca —</option>
                    {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </div>
              {form.type !== "SERVICE" && <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-defaultWarehouseId" className="text-sm font-medium">Bodega predeterminada</label>
                  <select id="product-defaultWarehouseId" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={form.defaultWarehouseId} onChange={(e) => set("defaultWarehouseId", e.target.value)}>
                    <option value="">— Ninguna —</option>
                    {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="product-minStock" className="text-sm font-medium">Stock mínimo</label>
                  <Input id="product-minStock" type="number" value={form.minStock} onChange={(e) => set("minStock", e.target.value)} className="mt-1" />
                </div>
              </div>}
              {form.type !== "SERVICE" && <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.trackInventory} onChange={(e) => set("trackInventory", e.target.checked)} />
                Controlar inventario
              </label>}
            </>
          )}

          {tab === "prices" && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-tax" className="text-sm font-medium">IVA</label>
                  <select id="product-tax" className="w-full mt-1 rounded-md border px-3 py-2 text-sm"
                    value={productTaxValue(form.taxCategory, form.taxRate)}
                    onChange={(e) => {
                      const option = PRODUCT_TAX_OPTIONS.find((o) => o.value === e.target.value)!;
                      setForm((f) => ({ ...f, taxCategory: option.taxCategory, taxRate: String(option.taxRate) }));
                    }}>
                    {PRODUCT_TAX_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">Los precios se almacenan sin IVA. Valor con IVA muestra el total con la tarifa seleccionada.</p>
              <div>
                <label htmlFor="product-cost" className="text-sm font-medium">Costo</label>
                <Input id="product-cost" type="number" min="0" step="0.01" value={form.cost} onChange={(e) => set("cost", e.target.value)} className="mt-1" />
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="px-3 py-2 text-left font-medium">Tipo</th>
                      <th className="px-3 py-2 text-right font-medium">Precio</th>
                      <th className="px-3 py-2 text-right font-medium">Ganancia</th>
                      <th className="px-3 py-2 text-right font-medium">% Ganancia</th>
                      <th className="px-3 py-2 text-right font-medium">Valor con IVA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["price", "price2", "price3", "price4"] as const).map((key, idx) => {
                      const labels = ["A - Público", "B - Distribuidor", "C - Mayorista", "D - Tarjeta"];
                      const val = Number(form[key]) || 0;
                      const costVal = Number(form.cost) || 0;
                      const { gain: profit, margin, withTax: withIva } = productPriceCalculation(val, costVal, Number(form.taxRate) || 0);
                      return (
                        <tr key={key} className="border-b">
                          <td className="px-3 py-2">{labels[idx]}</td>
                          <td className="px-3 py-2 text-right">
                            <Input
                              aria-label={`${labels[idx]} precio`} type="number" min="0" step="0.01" className="w-28 ml-auto text-right"
                              value={form[key]} onChange={(e) => set(key, e.target.value)}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono">${profit.toFixed(2)}</td>
                          <td className="px-3 py-2 text-right font-mono">{margin.toFixed(1)}%</td>
                          <td className="px-3 py-2 text-right font-mono">${withIva.toFixed(2)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {tab === "accounting" && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Asigne cuentas contables específicas para este producto. Si no se asignan, se usarán los parámetros globales del plan contable.
              </p>
              <div>
                <label htmlFor="product-salesAccountId" className="text-sm font-medium">Cuenta contable — Venta</label>
                <Input id="product-salesAccountId" value={form.salesAccountId} onChange={(e) => set("salesAccountId", e.target.value)} placeholder="ID de cuenta contable" className="mt-1" />
              </div>
              <div>
                <label htmlFor="product-inventoryAccountId" className="text-sm font-medium">Cuenta contable — Inventario / Compra</label>
                <Input id="product-inventoryAccountId" value={form.inventoryAccountId} onChange={(e) => set("inventoryAccountId", e.target.value)} placeholder="ID de cuenta contable" className="mt-1" />
              </div>
              <div>
                <label htmlFor="product-cogsAccountId" className="text-sm font-medium">Cuenta contable — Costos</label>
                <Input id="product-cogsAccountId" value={form.cogsAccountId} onChange={(e) => set("cogsAccountId", e.target.value)} placeholder="ID de cuenta contable" className="mt-1" />
              </div>
            </div>
          )}

          {tab === "additional" && (
            <div className="space-y-4">
              <div>
                <label htmlFor="product-color" className="text-sm font-medium">Color</label>
                <Input id="product-color" value={form.color} onChange={(e) => set("color", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label htmlFor="product-additionalComment" className="text-sm font-medium">Comentario adicional</label>
                <textarea id="product-additionalComment"
                  className="w-full mt-1 rounded-md border px-3 py-2 text-sm min-h-[80px]"
                  value={form.additionalComment}
                  onChange={(e) => set("additionalComment", e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.isProcessed} onChange={(e) => set("isProcessed", e.target.checked)} />
                Producto procesado
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="product-warrantyDuration" className="text-sm font-medium">Duración garantía</label>
                  <Input id="product-warrantyDuration" type="number" value={form.warrantyDuration} onChange={(e) => set("warrantyDuration", e.target.value)} className="mt-1" />
                </div>
                <div>
                  <label htmlFor="product-warrantyUnit" className="text-sm font-medium">Unidad garantía</label>
                  <select id="product-warrantyUnit" className="w-full mt-1 rounded-md border px-3 py-2 text-sm" value={form.warrantyUnit} onChange={(e) => set("warrantyUnit", e.target.value)}>
                    <option value="">— Ninguna —</option>
                    <option value="DAYS">Días</option>
                    <option value="MONTHS">Meses</option>
                    <option value="YEARS">Años</option>
                  </select>
                </div>
              </div>
              <div>
                <label htmlFor="product-auxiliaryTransportCode" className="text-sm font-medium">Código auxiliar transporte</label>
                <Input id="product-auxiliaryTransportCode" value={form.auxiliaryTransportCode} onChange={(e) => set("auxiliaryTransportCode", e.target.value)} className="mt-1" />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

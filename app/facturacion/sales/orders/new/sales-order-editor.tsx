"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";

type Customer = { id: string; name: string; identification: string | null; email: string | null; phone: string | null; address: string | null };
type Product = { id: string; name: string; code: string | null; description: string | null; price: number; price2: number | null; price3: number | null; stock: number; taxRate: number; taxCategory: string | null };
type Warehouse = { id: string; name: string };
type Line = { productId: string; productName: string; code: string | null; quantity: number; unitPrice: number; discount: number; taxRate: number; taxCategory: string | null; description: string };

const money = (v: number) => new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(v);
const dateInput = (d: Date) => d.toISOString().slice(0, 10);

export function SalesOrderEditor({
  currentUserName,
  customers,
  products,
  warehouses,
}: {
  currentUserName: string;
  customers: Customer[];
  products: Product[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [warehouseId, setWarehouseId] = useState(warehouses[0]?.id ?? "");
  const [issueDate, setIssueDate] = useState(dateInput(new Date()));
  const [expectedDate, setExpectedDate] = useState("");
  const [sellerName, setSellerName] = useState(currentUserName);
  const [observation, setObservation] = useState("");
  const [priceTier, setPriceTier] = useState("PVP1");
  const [lines, setLines] = useState<Line[]>([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const productById = useMemo(() => new Map(products.map((p) => [p.id, p])), [products]);

  const filteredCustomers = customerSearch.trim()
    ? customers.filter((c) => `${c.name} ${c.identification ?? ""}`.toLowerCase().includes(customerSearch.toLowerCase()))
    : customers.slice(0, 30);

  const filteredProducts = productSearch.trim()
    ? products.filter((p) => `${p.name} ${p.code ?? ""}`.toLowerCase().includes(productSearch.toLowerCase()))
    : products.slice(0, 30);

  function addLine(productId: string) {
    const p = productById.get(productId);
    if (!p) return;
    const existing = lines.findIndex((l) => l.productId === productId);
    if (existing >= 0) {
      setLines((prev) => prev.map((l, i) => (i === existing ? { ...l, quantity: l.quantity + 1 } : l)));
      return;
    }
    const price = priceTier === "PVP2" && p.price2 ? p.price2 : priceTier === "PVP3" && p.price3 ? p.price3 : p.price;
    setLines((prev) => [...prev, { productId, productName: p.name, code: p.code, quantity: 1, unitPrice: price, discount: 0, taxRate: p.taxRate, taxCategory: p.taxCategory, description: "" }]);
    setProductSearch("");
  }

  function updateLine(index: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)));
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  const computedLines = lines.map((l) => {
    const base = l.quantity * l.unitPrice;
    const subtotal = base - l.discount;
    const tax = subtotal * (l.taxRate / 100);
    return { ...l, subtotal, tax, total: subtotal + tax };
  });

  const subtotal = computedLines.reduce((s, l) => s + l.subtotal, 0);
  const discount = lines.reduce((s, l) => s + l.discount, 0);
  const tax = computedLines.reduce((s, l) => s + l.tax, 0);
  const total = subtotal + tax;

  async function save(asDraft: boolean) {
    if (savingRef.current) return;
    if (lines.length === 0) { setMessage("Agregue al menos un producto."); return; }
    savingRef.current = true;
    setSaving(true);
    setMessage("");

    const body = {
      customerId: customerId || null,
      warehouseId: warehouseId || null,
      issueDate,
      expectedDate: expectedDate || null,
      sellerName: sellerName || null,
      observation: observation || null,
      status: asDraft ? "DRAFT" : "CONFIRMED",
      subtotal,
      discount,
      tax,
      total,
      items: computedLines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        code: l.code,
        description: l.description || null,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        discount: l.discount,
        taxRate: l.taxRate,
        taxCategory: l.taxCategory,
        subtotal: l.subtotal,
        tax: l.tax,
        total: l.total,
      })),
    };

    try {
      const res = await fetch("/api/facturacion/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        router.push(routes.facturacionSalesOrders);
      } else {
        setMessage(data.error ?? "Error al guardar.");
      }
    } catch {
      setMessage("Error de conexión.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  const selectedCustomer = customers.find((c) => c.id === customerId);

  return (
    <div className="space-y-5">
      <header className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href={routes.facturacionSalesOrders}><ArrowLeft className="mr-1 h-4 w-4" />Volver</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Nueva orden de venta</h1>
      </header>

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {/* Customer */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-sm">Cliente</h2>
            <Input placeholder="Buscar cliente..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="h-9" />
            {customerSearch && (
              <div className="max-h-40 overflow-y-auto rounded-lg border bg-white divide-y text-sm">
                {filteredCustomers.map((c) => (
                  <button key={c.id} className="w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => { setCustomerId(c.id); setCustomerSearch(""); }}>
                    <span className="font-medium">{c.name}</span>
                    <span className="ml-2 text-slate-400">{c.identification}</span>
                  </button>
                ))}
              </div>
            )}
            {selectedCustomer && (
              <div className="rounded-lg bg-slate-50 p-3 text-sm">
                <p className="font-medium">{selectedCustomer.name}</p>
                <p className="text-slate-500">{selectedCustomer.identification ?? "Sin ID"} · {selectedCustomer.email ?? ""} · {selectedCustomer.phone ?? ""}</p>
                <button className="mt-1 text-xs text-red-500" onClick={() => setCustomerId("")}>Quitar cliente</button>
              </div>
            )}
          </div>

          {/* Products */}
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-sm">Productos</h2>
              <select className="h-8 rounded border bg-white px-2 text-xs" value={priceTier} onChange={(e) => setPriceTier(e.target.value)}>
                <option value="PVP1">PVP 1</option>
                <option value="PVP2">PVP 2</option>
                <option value="PVP3">PVP 3</option>
              </select>
            </div>
            <div className="relative">
              <Input placeholder="Buscar producto para agregar..." value={productSearch} onChange={(e) => setProductSearch(e.target.value)} className="h-9" />
              {productSearch && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg divide-y text-sm">
                  {filteredProducts.map((p) => (
                    <button key={p.id} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-slate-50" onClick={() => addLine(p.id)}>
                      <Plus className="h-3.5 w-3.5 text-slate-400" />
                      <span className="font-medium">{p.name}</span>
                      <span className="ml-auto text-slate-400">{p.code}</span>
                      <span className="font-medium">{money(p.price)}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {lines.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs font-medium uppercase text-slate-500 border-b">
                      <th className="py-2 pr-2">Producto</th>
                      <th className="py-2 px-2 w-20">Cant.</th>
                      <th className="py-2 px-2 w-24">Precio</th>
                      <th className="py-2 px-2 w-24">Desc.</th>
                      <th className="py-2 px-2 text-right w-24">Total</th>
                      <th className="py-2 w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {computedLines.map((l, i) => (
                      <tr key={i} className="border-b last:border-0">
                        <td className="py-2 pr-2">
                          <span className="font-medium">{l.productName}</span>
                          {l.code && <span className="ml-1 text-xs text-slate-400">{l.code}</span>}
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(i, { quantity: Math.max(1, Number(e.target.value)) })} className="h-8 w-20" />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={0} step={0.01} value={l.unitPrice} onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })} className="h-8 w-24" />
                        </td>
                        <td className="py-2 px-2">
                          <Input type="number" min={0} step={0.01} value={l.discount} onChange={(e) => updateLine(i, { discount: Number(e.target.value) })} className="h-8 w-24" />
                        </td>
                        <td className="py-2 px-2 text-right font-medium tabular-nums">{money(l.total)}</td>
                        <td className="py-2 text-center">
                          <button onClick={() => removeLine(i)} className="text-red-400 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border bg-white p-4 space-y-3">
            <h2 className="font-semibold text-sm">Detalles</h2>
            <label className="block text-xs font-medium text-slate-500">Fecha emisión</label>
            <Input type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} className="h-9" />
            <label className="block text-xs font-medium text-slate-500">Fecha esperada</label>
            <Input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="h-9" />
            <label className="block text-xs font-medium text-slate-500">Bodega</label>
            <select className="h-9 w-full rounded-md border bg-white px-3 text-sm" value={warehouseId} onChange={(e) => setWarehouseId(e.target.value)}>
              <option value="">Sin bodega</option>
              {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <label className="block text-xs font-medium text-slate-500">Vendedor</label>
            <Input value={sellerName} onChange={(e) => setSellerName(e.target.value)} className="h-9" />
            <label className="block text-xs font-medium text-slate-500">Observación</label>
            <textarea className="w-full rounded-md border px-3 py-2 text-sm" rows={3} value={observation} onChange={(e) => setObservation(e.target.value)} />
          </div>

          <div className="rounded-xl border bg-white p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-slate-500">Subtotal</span><span className="font-medium tabular-nums">{money(subtotal)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">Descuento</span><span className="font-medium tabular-nums">{money(discount)}</span></div>
            <div className="flex justify-between text-sm"><span className="text-slate-500">IVA</span><span className="font-medium tabular-nums">{money(tax)}</span></div>
            <hr />
            <div className="flex justify-between text-base font-bold"><span>Total</span><span className="tabular-nums">{money(total)}</span></div>
          </div>

          {message && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}

          <div className="space-y-2">
            <Button className="w-full rounded-xl bg-[#1E52F1] text-white hover:bg-[#1E52F1]/90" disabled={saving} onClick={() => save(false)}>
              <Save className="mr-2 h-4 w-4" /> Guardar como Confirmada
            </Button>
            <Button variant="outline" className="w-full rounded-xl" disabled={saving} onClick={() => save(true)}>
              Guardar como Borrador
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

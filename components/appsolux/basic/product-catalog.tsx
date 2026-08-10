"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Boxes, Pencil, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type CatalogProduct = {
  id: string; name: string; type: "PRODUCT" | "SERVICE" | "COMBO"; primaryCode: string | null;
  auxiliaryCode: string | null; barcode: string | null; description: string | null; price: string;
  price2: string | null; price3: string | null; cost: string | null; stock: number; minStock: number | null;
  expiresAt: string | null; taxRate: string; isActive: boolean; trackInventory: boolean; unit: string;
  categoryId: string | null; categoryName: string | null; iceEnabled: boolean; iceCode: string | null;
  iceRate: string | null; comboItems: Array<{ componentProductId: string; quantity: number }>;
};

type Category = { id: string; name: string };
const typeLabels = { PRODUCT: "Producto", SERVICE: "Servicio", COMBO: "Combo" };

export function ProductCatalog({ products, categories: initialCategories, limitReached }: { products: CatalogProduct[]; categories: Category[]; limitReached: boolean }) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<CatalogProduct | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("active");
  const [stockFilter, setStockFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [categories, setCategories] = useState(initialCategories);
  const [error, setError] = useState("");

  const filtered = useMemo(() => products.filter((product) => {
    const needle = query.toLowerCase();
    return (!needle || [product.name, product.primaryCode, product.auxiliaryCode, product.barcode].some((value) => value?.toLowerCase().includes(needle)))
      && (typeFilter === "ALL" || product.type === typeFilter)
      && (statusFilter === "all" || product.isActive === (statusFilter === "active"))
      && (categoryFilter === "all" || product.categoryId === categoryFilter)
      && (stockFilter === "all" || (product.trackInventory && (stockFilter === "out" ? product.stock === 0 : product.stock > 0 && product.stock <= (product.minStock ?? 0))));
  }), [products, query, typeFilter, statusFilter, categoryFilter, stockFilter]);

  async function toggleActive(product: CatalogProduct) {
    const response = await fetch(`/api/basic/products/${product.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !product.isActive }) });
    const result = await response.json() as { message?: string };
    if (!response.ok) return setError(result.message ?? "No se pudo actualizar.");
    router.refresh();
  }

  return <div className="space-y-4">
    <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
      <div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar por nombre, código o código de barras" className="h-10 rounded-xl border-slate-200 pl-9"/></div>
      <select aria-label="Filtrar por tipo" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="ALL">Todos los tipos</option><option value="PRODUCT">Productos</option><option value="SERVICE">Servicios</option><option value="COMBO">Combos</option></select>
      <select aria-label="Filtrar por estado" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="active">Activos</option><option value="inactive">Inactivos</option><option value="all">Todos</option></select>
      <select aria-label="Filtrar por stock" value={stockFilter} onChange={(event) => setStockFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Todo stock</option><option value="low">Stock bajo</option><option value="out">Sin stock</option></select>
      <select aria-label="Filtrar por categoría" value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"><option value="all">Toda categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
      <Button disabled={limitReached} onClick={() => setDrawer("new")} className="rounded-xl bg-facturom-primary text-white hover:bg-facturom-primary/90"><Plus className="mr-2 h-4 w-4"/>Nuevo producto</Button>
    </div>
    {error && <p className="text-sm text-red-600">{error}</p>}
    <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Producto</th><th>Código</th><th>Tipo</th><th>Categoría</th><th>PVP</th><th>Stock</th><th>Estado</th><th className="pr-5 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-slate-100">
        {filtered.map((product) => <tr key={product.id} className="hover:bg-slate-50/70"><td className="px-5 py-4"><p className="font-semibold text-slate-950">{product.name}</p><p className="max-w-[260px] truncate text-xs text-slate-500">{product.description || "Sin descripción"}</p></td><td className="font-mono text-xs">{product.primaryCode}</td><td><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-700">{typeLabels[product.type]}</span></td><td>{product.categoryName || "—"}</td><td className="font-semibold">${Number(product.price).toFixed(2)}</td><td>{product.trackInventory ? product.stock : "No aplica"}</td><td><span className={product.isActive ? "text-emerald-700" : "text-slate-400"}>{product.isActive ? "Activo" : "Inactivo"}</span></td><td className="pr-5 text-right"><Button variant="ghost" size="sm" onClick={() => setDrawer(product)}><Pencil className="h-4 w-4"/><span className="sr-only">Editar</span></Button><Button variant="ghost" size="sm" onClick={() => toggleActive(product)}><Archive className="h-4 w-4"/><span className="sr-only">{product.isActive ? "Desactivar" : "Activar"}</span></Button></td></tr>)}
      </tbody></table></div>{filtered.length === 0 && <div className="p-12 text-center text-sm text-slate-500"><Boxes className="mx-auto mb-3 h-8 w-8 text-slate-300"/>No hay productos que coincidan con los filtros.</div>}
    </div>
    {drawer && <ProductDrawer product={drawer === "new" ? undefined : drawer} products={products} categories={categories} onCategory={(category) => setCategories((current) => [...current, category])} onClose={() => setDrawer(null)} />}
  </div>;
}

function ProductDrawer({ product, products, categories, onCategory, onClose }: { product?: CatalogProduct; products: CatalogProduct[]; categories: Category[]; onCategory: (category: Category) => void; onClose: () => void }) {
  const router = useRouter();
  const [type, setType] = useState(product?.type ?? "PRODUCT");
  const [cost, setCost] = useState(product?.cost ?? "");
  const [price, setPrice] = useState(product?.price ?? "");
  const [trackInventory, setTrackInventory] = useState(product?.trackInventory ?? true);
  const [iceEnabled, setIceEnabled] = useState(product?.iceEnabled ?? false);
  const [components, setComponents] = useState(product?.comboItems ?? []);
  const [error, setError] = useState(""); const [saving, setSaving] = useState(false);
  const margin = Number(price) > 0 && Number(cost) >= 0 ? ((Number(price) - Number(cost)) / Number(price)) * 100 : 0;

  async function createCategory() { const name = window.prompt("Nombre de la nueva categoría"); if (!name) return; const response = await fetch("/api/basic/product-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); const result = await response.json() as { category?: Category; message?: string }; if (!response.ok || !result.category) return setError(result.message ?? "No se pudo crear."); onCategory(result.category); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); const form = new FormData(event.currentTarget);
    const number = (key: string) => form.get(key) ? Number(form.get(key)) : undefined;
    const payload = { name: String(form.get("name") ?? ""), type, primaryCode: String(form.get("primaryCode") ?? ""), auxiliaryCode: String(form.get("auxiliaryCode") ?? ""), barcode: String(form.get("barcode") ?? ""), description: String(form.get("description") ?? ""), cost: number("cost"), price: number("price") ?? 0, price2: number("price2"), price3: number("price3"), taxRate: number("taxRate") ?? 0, categoryId: String(form.get("categoryId") ?? ""), unit: String(form.get("unit") ?? "UNIT"), trackInventory, stock: number("stock") ?? 0, minStock: number("minStock"), expiresAt: String(form.get("expiresAt") ?? ""), isActive: form.get("isActive") === "on", iceEnabled, iceCode: String(form.get("iceCode") ?? ""), iceRate: number("iceRate"), comboItems: components };
    const response = await fetch(product ? `/api/basic/products/${product.id}` : "/api/basic/products", { method: product ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }); const result = await response.json() as { message?: string }; setSaving(false); if (!response.ok) return setError(result.message ?? "No se pudo guardar."); onClose(); router.refresh();
  }
  return <div className="fixed inset-0 z-50 bg-slate-950/35" role="dialog" aria-modal="true"><div className="absolute inset-0" onClick={onClose}/><aside className="absolute inset-y-0 right-0 w-full overflow-y-auto bg-white shadow-2xl sm:max-w-3xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b bg-white px-5 py-4"><div><p className="text-lg font-bold text-slate-950">{product ? "Editar producto" : "Nuevo producto"}</p><p className="text-sm text-slate-500">Información comercial, tributaria e inventario.</p></div><Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5"/></Button></div>
    <form onSubmit={submit} className="space-y-7 p-5 sm:p-7"><section><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-violet-700">Tipo</p><div className="grid grid-cols-3 gap-2">{Object.entries(typeLabels).map(([value,label]) => <button key={value} type="button" onClick={() => setType(value as typeof type)} className={`rounded-xl border p-3 text-sm font-medium ${type === value ? "border-violet-500 bg-violet-50 text-violet-800" : "border-slate-200"}`}>{label}</button>)}</div></section>
    <Section title="Información principal"><Field label="Nombre"><Input name="name" defaultValue={product?.name} required/></Field><Field label="Código principal"><Input name="primaryCode" defaultValue={product?.primaryCode ?? ""} required/></Field><Field label="Código auxiliar"><Input name="auxiliaryCode" defaultValue={product?.auxiliaryCode ?? ""}/></Field><Field label="Código de barras"><Input name="barcode" defaultValue={product?.barcode ?? ""}/></Field><Field label="Descripción" wide><textarea name="description" defaultValue={product?.description ?? ""} className="min-h-20 w-full rounded-md border border-input px-3 py-2 text-sm"/></Field></Section>
    <Section title="Precios e impuestos"><Field label="Costo"><Input name="cost" type="number" min="0" step=".01" value={cost} onChange={(e) => setCost(e.target.value)}/></Field><Field label="PVP 1"><Input name="price" type="number" min="0" step=".01" value={price} onChange={(e) => setPrice(e.target.value)} required/></Field><Field label="PVP 2"><Input name="price2" type="number" min="0" step=".01" defaultValue={product?.price2 ?? ""}/></Field><Field label="PVP 3"><Input name="price3" type="number" min="0" step=".01" defaultValue={product?.price3 ?? ""}/></Field><Field label="Margen calculado"><div className="flex h-10 items-center rounded-md bg-slate-50 px-3 text-sm font-semibold">{margin.toFixed(1)}%</div></Field><Field label="IVA"><select name="taxRate" defaultValue={product?.taxRate ?? "0"} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="0">IVA 0%</option><option value="8">IVA 8%</option><option value="15">IVA 15%</option></select></Field></Section>
    <Section title="Organización"><Field label="Categoría"><div className="flex gap-2"><select name="categoryId" defaultValue={product?.categoryId ?? ""} className="h-10 min-w-0 flex-1 rounded-md border border-input bg-white px-3 text-sm"><option value="">Sin categoría</option>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><Button type="button" variant="outline" onClick={createCategory}>+</Button></div></Field><Field label="Unidad"><select name="unit" defaultValue={product?.unit ?? "UNIT"} className="h-10 w-full rounded-md border border-input bg-white px-3 text-sm"><option value="UNIT">Unidad</option><option value="KILOGRAM">Kilogramo</option><option value="GRAM">Gramo</option><option value="LITER">Litro</option><option value="METER">Metro</option><option value="HOUR">Hora</option><option value="SERVICE">Servicio</option></select></Field></Section>
    {type === "PRODUCT" && <Section title="Inventario"><label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" checked={trackInventory} onChange={(event) => setTrackInventory(event.target.checked)}/>Controlar existencias</label>{trackInventory && <><Field label="Stock inicial"><Input name="stock" type="number" min="0" defaultValue={product?.stock ?? 0}/></Field><Field label="Stock mínimo"><Input name="minStock" type="number" min="0" defaultValue={product?.minStock ?? ""}/></Field><Field label="Vencimiento"><Input name="expiresAt" type="date" defaultValue={product?.expiresAt?.slice(0,10) ?? ""}/></Field></>}</Section>}
    {type === "COMBO" && <section><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-violet-700">Componentes del combo</p>{components.map((item,index) => <div key={`${item.componentProductId}-${index}`} className="mb-2 flex gap-2"><select value={item.componentProductId} onChange={(event) => setComponents((current) => current.map((value,i) => i === index ? {...value, componentProductId: event.target.value} : value))} className="h-10 flex-1 rounded-md border px-3 text-sm"><option value="">Selecciona un componente</option>{products.filter((candidate) => candidate.type !== "COMBO" && candidate.isActive && candidate.id !== product?.id).map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}</option>)}</select><Input aria-label="Cantidad" type="number" min="1" step="1" value={item.quantity} onChange={(event) => setComponents((current) => current.map((value,i) => i === index ? {...value, quantity: Number(event.target.value)} : value))} className="w-28"/><Button type="button" variant="ghost" onClick={() => setComponents((current) => current.filter((_,i) => i !== index))}><X className="h-4 w-4"/></Button></div>)}<Button type="button" variant="outline" onClick={() => setComponents((current) => [...current, { componentProductId: "", quantity: 1 }])}><Plus className="mr-2 h-4 w-4"/>Agregar componente</Button></section>}
    <details className="rounded-xl border border-slate-200 p-4"><summary className="cursor-pointer text-sm font-semibold">Opciones tributarias avanzadas</summary><div className="mt-4 grid gap-4 sm:grid-cols-2"><label className="col-span-full flex items-center gap-2 text-sm"><input type="checkbox" checked={iceEnabled} onChange={(event) => setIceEnabled(event.target.checked)}/>Registrar configuración ICE</label>{iceEnabled && <><Field label="Código ICE"><Input name="iceCode" defaultValue={product?.iceCode ?? ""}/></Field><Field label="Tarifa ICE"><Input name="iceRate" type="number" min="0" step=".0001" defaultValue={product?.iceRate ?? ""}/></Field><p className="col-span-full text-xs text-amber-700">La configuración se guarda en catálogo; su emisión en XML SRI aún requiere integración tributaria específica.</p></>}</div></details>
    <label className="flex items-center gap-2 text-sm"><input name="isActive" type="checkbox" defaultChecked={product?.isActive ?? true}/>Activo y disponible para ventas</label>{error && <p className="text-sm text-red-600">{error}</p>}<div className="sticky bottom-0 flex justify-end gap-2 border-t bg-white py-4"><Button type="button" variant="outline" onClick={onClose}>Cancelar</Button><Button disabled={saving} className="bg-facturom-primary hover:bg-facturom-primary/90">{saving ? "Guardando…" : "Guardar producto"}</Button></div></form></aside></div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) { return <section><p className="mb-3 text-xs font-bold uppercase tracking-[.16em] text-violet-700">{title}</p><div className="grid gap-4 sm:grid-cols-2">{children}</div></section>; }
function Field({ label, children, wide = false }: { label: string; children: React.ReactNode; wide?: boolean }) { return <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}><Label>{label}</Label>{children}</div>; }

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { ArrowLeft, FileDown, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";

type Customer = {
  id: string;
  name: string;
  tradeName: string | null;
  identification: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
};
type Product = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  price: number;
  price2: number | null;
  price3: number | null;
  stock: number;
  taxRate: number;
};
type Establishment = { id: string; code: string; name: string };
type Line = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  observation: string;
};
type Initial = {
  id: string;
  number: string;
  customerId: string | null;
  establishmentId: string | null;
  issueDate: string;
  validUntil: string | null;
  observation: string | null;
  status: string;
  items: Line[];
};

const money = (value: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    value,
  );
const dateInput = (date: Date) => date.toISOString().slice(0, 10);

export function ProformaEditor({
  currentUserName,
  customers,
  products,
  establishments,
  initial,
}: {
  currentUserName: string;
  customers: Customer[];
  products: Product[];
  establishments: Establishment[];
  initial?: Initial;
}) {
  const router = useRouter();
  const [customerId, setCustomerId] = useState(initial?.customerId ?? "");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [establishmentId, setEstablishmentId] = useState(
    initial?.establishmentId ?? establishments[0]?.id ?? "",
  );
  const [issueDate, setIssueDate] = useState(
    initial?.issueDate.slice(0, 10) ?? dateInput(new Date()),
  );
  const [validUntil, setValidUntil] = useState(
    initial?.validUntil?.slice(0, 10) ??
      dateInput(new Date(Date.now() + 15 * 86400000)),
  );
  const [observation, setObservation] = useState(initial?.observation ?? "");
  const [priceTier, setPriceTier] = useState("PVP1");
  const [lines, setLines] = useState<Line[]>(initial?.items ?? []);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const productById = useMemo(
    () => new Map(products.map((product) => [product.id, product])),
    [products],
  );
  const selectedCustomer = customers.find(
    (customer) => customer.id === customerId,
  );
  const customerMatches = customerSearch
    ? customers
        .filter((customer) =>
          [
            customer.name,
            customer.tradeName,
            customer.identification,
            customer.email,
          ].some((value) =>
            value?.toLowerCase().includes(customerSearch.toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const productMatches = productSearch
    ? products
        .filter((product) =>
          [product.name, product.code, product.description].some((value) =>
            value?.toLowerCase().includes(productSearch.toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const calculated = lines.map((line) => {
    const product = productById.get(line.productId)!;
    const gross = line.quantity * line.unitPrice;
    const discount = Math.min(line.discount, gross);
    const subtotal = gross - discount;
    const tax = (subtotal * product.taxRate) / 100;
    return { ...line, product, discount, subtotal, tax, total: subtotal + tax };
  });
  const totals = calculated.reduce(
    (sum, line) => ({
      subtotal: sum.subtotal + line.subtotal,
      discount: sum.discount + line.discount,
      tax: sum.tax + line.tax,
      total: sum.total + line.total,
    }),
    { subtotal: 0, discount: 0, tax: 0, total: 0 },
  );
  const bases = calculated.reduce<Record<number, number>>(
    (result, line) => ({
      ...result,
      [line.product.taxRate]:
        (result[line.product.taxRate] ?? 0) + line.subtotal,
    }),
    {},
  );
  function addProduct(product: Product) {
    if (lines.some((line) => line.productId === product.id)) return;
    const price =
      priceTier === "PVP2"
        ? (product.price2 ?? product.price)
        : priceTier === "PVP3"
          ? (product.price3 ?? product.price)
          : product.price;
    setLines((current) => [
      ...current,
      {
        productId: product.id,
        quantity: 1,
        unitPrice: price,
        discount: 0,
        observation: "",
      },
    ]);
    setProductSearch("");
  }
  function updateLine(productId: string, value: Partial<Line>) {
    setLines((current) =>
      current.map((line) =>
        line.productId === productId ? { ...line, ...value } : line,
      ),
    );
  }
  async function save() {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch(
        initial ? `/api/basic/proformas/${initial.id}` : "/api/basic/proformas",
        {
          method: initial ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId: customerId || undefined,
            establishmentId: establishmentId || undefined,
            issueDate,
            validUntil,
            observation,
            items: lines.map((line) => ({
              ...line,
              taxRate: productById.get(line.productId)?.taxRate ?? 0,
            })),
          }),
        },
      );
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        proforma?: { id: string };
      };
      if (!response.ok || !result.ok || !result.proforma)
        throw new Error(result.message ?? "No se pudo guardar la proforma.");
      if (!initial)
        router.replace(`/facturacion/proformas/${result.proforma.id}`);
      else {
        setMessage("Proforma actualizada.");
        router.refresh();
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  return (
    <div className="space-y-4 pb-10">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-4 py-3">
        <div>
          <h1 className="text-xl font-semibold">
            {initial ? initial.number : "Nueva proforma"}
          </h1>
          <p className="text-xs text-slate-500">
            Documento comercial · no tributario
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={save} disabled={saving || !lines.length}>
            <Save />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
          <Button asChild size="sm" variant="outline" aria-disabled={!initial}>
            {initial ? (
              <a
                href={`/api/basic/proformas/${initial.id}/pdf`}
                target="_blank"
              >
                <FileDown />
                Imprimir
              </a>
            ) : (
              <span>
                <FileDown />
                Imprimir
              </span>
            )}
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={routes.facturacionProformas}>
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        </div>
      </header>
      {message ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-slate-600">
          {message}
        </p>
      ) : null}
      <section className="grid gap-4 rounded-xl border bg-white p-4 md:grid-cols-4">
        <label className="grid gap-1 text-xs text-slate-500">
          Número
          <Input readOnly value={initial?.number ?? "Automático al guardar"} />
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Establecimiento
          <select
            className="h-8 rounded-lg border px-2 text-sm"
            value={establishmentId}
            onChange={(event) => setEstablishmentId(event.target.value)}
          >
            <option value="">Sin establecimiento</option>
            {establishments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} · {item.name}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Fecha de emisión
          <Input
            type="date"
            value={issueDate}
            onChange={(event) => setIssueDate(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Válida hasta / Entrega
          <Input
            type="date"
            value={validUntil}
            onChange={(event) => setValidUntil(event.target.value)}
          />
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Responsable
          <Input readOnly value={currentUserName} />
        </label>
        <label className="grid gap-1 text-xs text-slate-500 md:col-span-3">
          Observación
          <Input
            value={observation}
            onChange={(event) => setObservation(event.target.value)}
          />
        </label>
      </section>
      <section className="rounded-xl border bg-white p-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Cliente</h2>
          <Button asChild size="sm" variant="outline">
            <Link href="/facturacion/customers/new">
              <Plus />
              Nuevo cliente
            </Link>
          </Button>
        </div>
        <div className="relative">
          <Input
            value={customerSearch}
            onChange={(event) => setCustomerSearch(event.target.value)}
            placeholder="Identificación, nombre, nombre comercial o email"
          />
          {customerMatches.length ? (
            <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow">
              {customerMatches.map((customer) => (
                <button
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                  key={customer.id}
                  onClick={() => {
                    setCustomerId(customer.id);
                    setCustomerSearch("");
                  }}
                >
                  {customer.name} ·{" "}
                  {customer.identification ?? "Sin identificación"}
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {selectedCustomer ? (
          <p className="mt-2 text-sm text-slate-600">
            <strong>{selectedCustomer.name}</strong> ·{" "}
            {selectedCustomer.identification ?? "—"} ·{" "}
            {selectedCustomer.tradeName ?? "Sin nombre comercial"} ·{" "}
            {selectedCustomer.phone ?? "—"} · {selectedCustomer.address ?? "—"}{" "}
            · {selectedCustomer.email ?? "—"}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-500">
            Consumidor Final · 9999999999999
          </p>
        )}
      </section>
      <div className="grid gap-4 xl:grid-cols-[1fr_280px]">
        <section className="rounded-xl border bg-white p-4">
          <div className="mb-3 grid gap-2 sm:grid-cols-[160px_1fr]">
            <select
              className="h-8 rounded-lg border px-2 text-sm"
              value={priceTier}
              onChange={(event) => setPriceTier(event.target.value)}
            >
              <option>PVP1</option>
              <option>PVP2</option>
              <option>PVP3</option>
            </select>
            <div className="relative">
              <Input
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Buscar producto por código, nombre o descripción"
              />
              {productMatches.length ? (
                <div className="absolute z-10 mt-1 w-full rounded-lg border bg-white shadow">
                  {productMatches.map((product) => (
                    <button
                      className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
                      key={product.id}
                      onClick={() => addProduct(product)}
                    >
                      <span>
                        {product.code} · {product.name}
                      </span>
                      <span>
                        {money(product.price)} · stock {product.stock}
                      </span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[1000px] w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-slate-500">
                  <th>#</th>
                  <th>Producto</th>
                  <th>Código</th>
                  <th>Observación</th>
                  <th>Stock</th>
                  <th>Cantidad</th>
                  <th>Precio</th>
                  <th>IVA</th>
                  <th>Desc. $</th>
                  <th>Subtotal</th>
                  <th>Total</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {calculated.map((line, index) => (
                  <tr className="border-b" key={line.productId}>
                    <td>{index + 1}</td>
                    <td>{line.product.name}</td>
                    <td>{line.product.code ?? "—"}</td>
                    <td>
                      <Input
                        className="h-7 w-32"
                        value={line.observation}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            observation: event.target.value,
                          })
                        }
                      />
                    </td>
                    <td>{line.product.stock}</td>
                    <td>
                      <Input
                        className="h-7 w-20"
                        type="number"
                        min={1}
                        value={line.quantity}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            quantity: Math.max(1, Number(event.target.value)),
                          })
                        }
                      />
                    </td>
                    <td>
                      <Input
                        className="h-7 w-24"
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.unitPrice}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            unitPrice: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td>{line.product.taxRate}%</td>
                    <td>
                      <Input
                        className="h-7 w-24"
                        type="number"
                        min={0}
                        step="0.01"
                        value={line.discount}
                        onChange={(event) =>
                          updateLine(line.productId, {
                            discount: Number(event.target.value),
                          })
                        }
                      />
                    </td>
                    <td>{money(line.subtotal)}</td>
                    <td>{money(line.total)}</td>
                    <td>
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        onClick={() =>
                          setLines((current) =>
                            current.filter(
                              (item) => item.productId !== line.productId,
                            ),
                          )
                        }
                      >
                        <Trash2 />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!lines.length ? (
              <p className="p-8 text-center text-sm text-slate-400">
                Busca un producto para comenzar.
              </p>
            ) : null}
          </div>
        </section>
        <aside className="h-fit rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Totales</h2>
          {Object.entries(bases).map(([rate, value]) => (
            <p className="flex justify-between py-1 text-sm" key={rate}>
              <span>Subtotal {rate}%</span>
              <span>{money(value)}</span>
            </p>
          ))}
          <p className="flex justify-between py-1 text-sm">
            <span>No objeto</span>
            <span>{money(0)}</span>
          </p>
          <p className="flex justify-between py-1 text-sm">
            <span>Exento</span>
            <span>{money(0)}</span>
          </p>
          <p className="flex justify-between py-1 text-sm">
            <span>Descuento</span>
            <span>-{money(totals.discount)}</span>
          </p>
          <p className="flex justify-between py-1 text-sm">
            <span>IVA</span>
            <span>{money(totals.tax)}</span>
          </p>
          <div className="mt-3 flex justify-between border-t pt-3">
            <strong>TOTAL</strong>
            <strong className="text-2xl">{money(totals.total)}</strong>
          </div>
        </aside>
      </div>
    </div>
  );
}

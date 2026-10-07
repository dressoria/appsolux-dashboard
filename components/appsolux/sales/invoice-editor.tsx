"use client";

import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  Plus,
  ReceiptText,
  Save,
  Search,
  Send,
  Trash2,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Customer = {
  id: string;
  name: string;
  tradeName: string | null;
  identification: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
};
type Product = {
  id: string;
  name: string;
  primaryCode: string | null;
  auxiliaryCode: string | null;
  description: string | null;
  price: string;
  price2: string | null;
  price3: string | null;
  stock: number;
  taxRate: string;
};
type Establishment = { id: string; code: string; name: string };
type IssuePoint = {
  id: string;
  code: string;
  name: string;
  establishmentId: string;
};
type Line = {
  productId: string;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  description: string;
};
type SavedResult = {
  saleId: string;
  documentId?: string;
  flowState?: "preparing" | "sending" | "received" | "authorized" | "rejected";
  flowLabel?: string;
};

const SRI_PAYMENTS = [
  {
    code: "01",
    shortLabel: "Sin sistema financiero",
    label: "SIN UTILIZACIÓN DEL SISTEMA FINANCIERO",
  },
  { code: "16", shortLabel: "Tarjeta de débito", label: "TARJETA DE DÉBITO" },
  { code: "17", shortLabel: "Dinero electrónico", label: "DINERO ELECTRÓNICO" },
  { code: "18", shortLabel: "Tarjeta prepago", label: "TARJETA PREPAGO" },
  { code: "19", shortLabel: "Tarjeta", label: "TARJETA DE CRÉDITO" },
  {
    code: "20",
    shortLabel: "Otros con sistema financiero",
    label: "OTROS CON UTILIZACIÓN DEL SISTEMA FINANCIERO",
  },
  { code: "21", shortLabel: "Endoso de títulos", label: "ENDOSO DE TÍTULOS" },
];
const money = (value: number) =>
  new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(
    value,
  );
const priceFor = (product: Product, tier: string) =>
  Number(
    tier === "PVP2"
      ? (product.price2 ?? product.price)
      : tier === "PVP3"
        ? (product.price3 ?? product.price)
        : product.price,
  );

export function InvoiceEditor({
  currentUserName,
  submissionEnabled = true,
  submissionMessage,
  customers,
  products,
  establishments,
  issuePoints,
}: {
  currentUserName: string;
  submissionEnabled?: boolean;
  submissionMessage?: string;
  customers: Customer[];
  products: Product[];
  establishments: Establishment[];
  issuePoints: IssuePoint[];
}) {
  const [customerId, setCustomerId] = useState("");
  const [customerSearch, setCustomerSearch] = useState("");
  const [productSearch, setProductSearch] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [priceTier, setPriceTier] = useState("PVP1");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [sriPaymentCode, setSriPaymentCode] = useState("01");
  const [notes, setNotes] = useState("");
  const [globalPct, setGlobalPct] = useState(0);
  const [globalAmount, setGlobalAmount] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState<SavedResult | null>(null);
  const savingRef = useRef(false);
  const selectedCustomer =
    customers.find((item) => item.id === customerId) ?? null;
  const establishment = establishments[0] ?? null;
  const issuePoint =
    issuePoints.find((item) => item.establishmentId === establishment?.id) ??
    null;
  const productById = useMemo(
    () => new Map(products.map((item) => [item.id, item])),
    [products],
  );
  const customerMatches = customerSearch.trim()
    ? customers
        .filter((item) =>
          [item.identification, item.name, item.tradeName, item.email].some(
            (value) =>
              value?.toLowerCase().includes(customerSearch.toLowerCase()),
          ),
        )
        .slice(0, 8)
    : [];
  const productMatches = productSearch.trim()
    ? products
        .filter((item) =>
          [
            item.primaryCode,
            item.auxiliaryCode,
            item.name,
            item.description,
          ].some((value) =>
            value?.toLowerCase().includes(productSearch.toLowerCase()),
          ),
        )
        .slice(0, 10)
    : [];
  const calculated = lines.map((line) => {
    const product = productById.get(line.productId)!;
    const gross = line.unitPrice * line.quantity;
    const discount = Math.min(gross, (gross * line.discountPct) / 100);
    const subtotal = gross - discount;
    const tax = (subtotal * Number(product.taxRate)) / 100;
    return {
      ...line,
      product,
      gross,
      discount,
      subtotal,
      tax,
      total: subtotal + tax,
    };
  });
  const baseBeforeGlobal = calculated.reduce(
    (sum, item) => sum + item.subtotal,
    0,
  );
  const requestedGlobal = globalAmount || (baseBeforeGlobal * globalPct) / 100;
  const appliedGlobal = Math.min(
    baseBeforeGlobal,
    Math.max(0, requestedGlobal),
  );
  const bases = calculated.reduce(
    (result, item) => {
      const share = baseBeforeGlobal
        ? (appliedGlobal * item.subtotal) / baseBeforeGlobal
        : 0;
      const adjusted = item.subtotal - share;
      const rate = Number(item.product.taxRate);
      result[rate] = (result[rate] ?? 0) + adjusted;
      return result;
    },
    {} as Record<number, number>,
  );
  const lineDiscount = calculated.reduce((sum, item) => sum + item.discount, 0);
  const taxTotal = Object.entries(bases).reduce(
    (sum, [rate, base]) => sum + (Number(rate) * base) / 100,
    0,
  );
  const subtotalAfterDiscount = Math.max(0, baseBeforeGlobal - appliedGlobal);
  const total = subtotalAfterDiscount + taxTotal;
  const dirty = lines.length > 0 || Boolean(customerId || notes);
  function addProduct(product: Product) {
    setLines((current) => {
      const existing = current.find((item) => item.productId === product.id);
      return existing
        ? current.map((item) =>
            item.productId === product.id
              ? {
                  ...item,
                  quantity: Math.min(product.stock, item.quantity + 1),
                }
              : item,
          )
        : [
            ...current,
            {
              productId: product.id,
              quantity: 1,
              unitPrice: priceFor(product, priceTier),
              discountPct: 0,
              description: "",
            },
          ];
    });
    setProductSearch("");
    setSaved(null);
  }
  function updateLine(productId: string, patch: Partial<Line>) {
    setLines((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, ...patch } : item,
      ),
    );
    setSaved(null);
  }
  function reset() {
    if (dirty && !window.confirm("¿Limpiar la factura actual?")) return;
    setCustomerId("");
    setCustomerSearch("");
    setProductSearch("");
    setLines([]);
    setNotes("");
    setGlobalPct(0);
    setGlobalAmount(0);
    setSaved(null);
    setMessage("");
  }
  function buildItems() {
    return calculated.map((item) => {
      const globalShare = baseBeforeGlobal
        ? (appliedGlobal * item.subtotal) / baseBeforeGlobal
        : 0;
      return {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountAmount: Number((item.discount + globalShare).toFixed(2)),
        description: item.description,
      };
    });
  }
  async function save(sendToSri: boolean) {
    if (savingRef.current || saved) return;
    if (!submissionEnabled) {
      setMessage(
        submissionMessage ??
          "La creación de facturas está temporalmente no disponible para este motor.",
      );
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setMessage("");
    try {
      if (!lines.length) throw new Error("Agrega al menos un producto.");
      if (!customerId && sendToSri) {
        /* consumidor final permitido */
      }
      const response = await fetch("/api/basic/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerId || undefined,
          paymentMethod,
          paidAmount: paymentMethod === "credit" ? 0 : total,
          outputMode: sendToSri ? "sri_invoice" : "internal_receipt",
          sriPaymentCode,
          notes,
          items: buildItems(),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        sale?: { id: string };
        output?: {
          status?: string;
          errorMessage?: string;
          sri?: {
            documentId: string;
            flowState: SavedResult["flowState"];
            flowLabel: string;
          };
        };
      };
      if (!response.ok || !result.ok || !result.sale)
        throw new Error(result.message ?? "No se pudo guardar la factura.");
      setSaved({
        saleId: result.sale.id,
        documentId: result.output?.sri?.documentId,
        flowState: result.output?.sri?.flowState,
        flowLabel: result.output?.sri?.flowLabel,
      });
      setMessage(
        result.output?.errorMessage ??
          (sendToSri
            ? "Venta guardada y flujo SRI iniciado."
            : "Venta guardada. Ya puedes enviarla al SRI."),
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar.",
      );
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  async function sendSaved() {
    if (savingRef.current) return;
    if (!submissionEnabled) {
      setMessage(
        submissionMessage ??
          "El envío de facturas está temporalmente no disponible para este motor.",
      );
      return;
    }
    if (!saved) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const response = await fetch("/api/sri/documents/from-basic-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saleId: saved.saleId }),
      });
      const result = (await response.json()) as {
        error?: string;
        documentId?: string;
        flowState?: SavedResult["flowState"];
        flowLabel?: string;
        message?: string;
      };
      if (!response.ok)
        throw new Error(result.error ?? "No se pudo iniciar el envío.");
      setSaved({
        ...saved,
        documentId: result.documentId,
        flowState: result.flowState,
        flowLabel: result.flowLabel,
      });
      setMessage(result.message ?? "Flujo SRI iniciado.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No se pudo enviar.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }
  const status = saved?.flowLabel ?? (saved ? "Guardada" : "Borrador local");
  const statusClass =
    saved?.flowState === "authorized"
      ? "bg-emerald-50 text-emerald-700"
      : saved?.flowState === "rejected"
        ? "bg-red-50 text-red-700"
        : saved?.flowState === "preparing"
          ? "bg-amber-50 text-amber-700"
          : saved?.flowState
            ? "bg-blue-50 text-blue-700"
            : "bg-slate-100 text-slate-600";
  return (
    <div className="space-y-4 pb-10">
      <header className="sticky top-0 z-30 -mx-3 flex flex-wrap items-center justify-between gap-2 border-b bg-white/95 px-3 py-3 backdrop-blur sm:-mx-5 sm:px-5">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-semibold text-[#172033]">
            Nueva factura
          </h1>
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${statusClass}`}
          >
            {status}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={reset}>
            <Plus />
            Nueva factura
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled
            title="El modelo actual no persiste borradores sin afectar inventario"
          >
            <Save />
            Guardar borrador
          </Button>
          <Button
            size="sm"
            className="bg-[#1E52F1] text-white"
            disabled={
              !submissionEnabled || saving || !lines.length || Boolean(saved)
            }
            title={!submissionEnabled ? submissionMessage : undefined}
            onClick={() => save(true)}
          >
            <Send />
            Guardar y enviar al SRI
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={
              !submissionEnabled ||
              saving ||
              !saved ||
              Boolean(saved.documentId)
            }
            title={!submissionEnabled ? submissionMessage : undefined}
            onClick={sendSaved}
          >
            <Send />
            Enviar al SRI
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={saved?.flowState !== "authorized" || !saved.documentId}
            onClick={() => {
              if (saved?.documentId)
                window.location.href = `/api/sri/documents/${saved.documentId}/download-ride`;
            }}
          >
            <FileDown />
            RIDE
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!saved}
            onClick={() => {
              if (saved)
                window.location.href = `/api/basic/sales/${saved.saleId}/download-receipt`;
            }}
          >
            <ReceiptText />
            Ticket
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href="/facturacion/documents">
              <ArrowLeft />
              Volver
            </Link>
          </Button>
        </div>
      </header>
      {!submissionEnabled && submissionMessage ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-[#667085]">
          {submissionMessage}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border bg-white px-3 py-2 text-sm text-[#667085]">
          {message}
        </p>
      ) : null}
      <fieldset disabled={Boolean(saved)} className="contents">
        <div className="grid gap-4 lg:grid-cols-2">
          <Card title="Datos de factura">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Establecimiento / Punto de emisión">
                <Input
                  readOnly
                  value={
                    establishment && issuePoint
                      ? `${establishment.code}-${issuePoint.code} · ${establishment.name}`
                      : "Configuración SRI pendiente"
                  }
                />
              </Field>
              <Field label="Fecha de emisión">
                <Input
                  readOnly
                  value={new Intl.DateTimeFormat("es-EC", {
                    dateStyle: "medium",
                  }).format(new Date())}
                />
              </Field>
              <Field label="Tipo de documento">
                <Input readOnly value="Factura" />
              </Field>
              <Field label="Vendedor">
                <Input readOnly value={currentUserName} />
              </Field>
              <Field label="Forma de pago comercial">
                <select
                  className="h-8 rounded-lg border px-2 text-sm"
                  value={paymentMethod}
                  onChange={(event) => {
                    const method = event.target.value;
                    setPaymentMethod(method);
                    setSriPaymentCode(
                      method === "cash"
                        ? "01"
                        : method === "card"
                          ? "19"
                          : "20",
                    );
                  }}
                >
                  <option value="cash">Efectivo</option>
                  <option value="transfer">Transferencia</option>
                  <option value="card">Tarjeta</option>
                  <option value="credit">Crédito</option>
                </select>
              </Field>
              <Field label="Forma de pago SRI">
                <select
                  className="h-8 min-w-0 w-full truncate rounded-lg border px-2 text-sm"
                  value={sriPaymentCode}
                  onChange={(event) => setSriPaymentCode(event.target.value)}
                  title={`${sriPaymentCode} · ${SRI_PAYMENTS.find((item) => item.code === sriPaymentCode)?.label ?? ""}`}
                >
                  {SRI_PAYMENTS.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} · {item.shortLabel}
                    </option>
                  ))}
                </select>
              </Field>
            </div>
          </Card>
          <Card title="Cliente">
            <div className="relative">
              <Label>Buscar cliente</Label>
              <div className="mt-1 flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2 size-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    value={customerSearch}
                    onChange={(event) => setCustomerSearch(event.target.value)}
                    placeholder="Identificación, nombre, nombre comercial o email"
                  />
                  {customerMatches.length ? (
                    <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                      {customerMatches.map((item) => (
                        <button
                          type="button"
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                          key={item.id}
                          onClick={() => {
                            setCustomerId(item.id);
                            setCustomerSearch(item.name);
                            setSaved(null);
                          }}
                        >
                          {item.name} ·{" "}
                          {item.identification ?? "Sin identificación"}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
                <Button asChild variant="outline">
                  <Link href="/facturacion/customers/new">+ Nuevo cliente</Link>
                </Button>
              </div>
            </div>
            {selectedCustomer ? (
              <div className="mt-3 grid gap-1 rounded-lg bg-slate-50 p-3 text-sm sm:grid-cols-2">
                <p>
                  <b>{selectedCustomer.name}</b>
                </p>
                <p>{selectedCustomer.identification ?? "—"}</p>
                <p>{selectedCustomer.tradeName ?? "—"}</p>
                <p>{selectedCustomer.phone ?? "—"}</p>
                <p>{selectedCustomer.address ?? "—"}</p>
                <p>{selectedCustomer.email ?? "—"}</p>
              </div>
            ) : (
              <button
                type="button"
                className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left text-sm text-blue-700"
                onClick={() => {
                  setCustomerId("");
                  setCustomerSearch("CONSUMIDOR FINAL · 9999999999999");
                }}
              >
                CONSUMIDOR FINAL · 9999999999999
              </button>
            )}
            <div className="mt-3">
              <Label>Observación</Label>
              <Input
                className="mt-1"
                value={notes}
                onChange={(event) => {
                  setNotes(event.target.value);
                  setSaved(null);
                }}
                placeholder="Opcional"
              />
            </div>
          </Card>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_310px]">
          <Card title="Detalle de factura">
            <div className="mb-3 grid gap-2 md:grid-cols-[180px_150px_minmax(0,1fr)]">
              <Input readOnly value="Stock general" aria-label="Bodega" />
              <select
                aria-label="Lista de precios"
                className="h-8 rounded-lg border px-2 text-sm"
                value={priceTier}
                onChange={(event) => setPriceTier(event.target.value)}
              >
                <option>PVP1</option>
                <option disabled={!products.some((item) => item.price2)}>
                  PVP2
                </option>
                <option disabled={!products.some((item) => item.price3)}>
                  PVP3
                </option>
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-2 size-4 text-slate-400" />
                <Input
                  className="pl-9"
                  value={productSearch}
                  onChange={(event) => setProductSearch(event.target.value)}
                  placeholder="Código principal, auxiliar, nombre o descripción"
                />
                {productMatches.length ? (
                  <div className="absolute z-20 mt-1 w-full rounded-lg border bg-white shadow-lg">
                    {productMatches.map((item) => (
                      <button
                        type="button"
                        className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-50"
                        disabled={item.stock <= 0}
                        key={item.id}
                        onClick={() => addProduct(item)}
                      >
                        <span>
                          {item.name} ·{" "}
                          {item.primaryCode ?? item.auxiliaryCode ?? "—"}
                        </span>
                        <span>
                          {money(priceFor(item, priceTier))} · Stock{" "}
                          {item.stock}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[1050px] text-left text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    {[
                      "#",
                      "Producto / Código",
                      "Observación",
                      "Stock",
                      "Cantidad",
                      "Precio",
                      "IVA",
                      "Desc. %",
                      "Desc. $",
                      "Subtotal",
                      "Total",
                      "",
                    ].map((label) => (
                      <th className="px-2 py-2 font-medium" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {calculated.map((item, index) => (
                    <tr key={item.productId}>
                      <td className="px-2">{index + 1}</td>
                      <td className="px-2 font-medium">
                        {item.product.name}
                        <br />
                        <span className="font-normal text-slate-400">
                          {item.product.primaryCode ??
                            item.product.auxiliaryCode ??
                            "—"}
                        </span>
                      </td>
                      <td className="px-2">
                        <Input
                          className="h-7 w-36"
                          value={item.description}
                          onChange={(event) =>
                            updateLine(item.productId, {
                              description: event.target.value,
                            })
                          }
                        />
                      </td>
                      <td className="px-2">{item.product.stock}</td>
                      <td className="px-2">
                        <Input
                          className="h-7 w-16"
                          type="number"
                          min={1}
                          max={item.product.stock}
                          value={item.quantity}
                          onChange={(event) =>
                            updateLine(item.productId, {
                              quantity: Math.max(
                                1,
                                Math.min(
                                  item.product.stock,
                                  Number(event.target.value),
                                ),
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2">
                        <Input
                          className="h-7 w-24"
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(event) =>
                            updateLine(item.productId, {
                              unitPrice: Math.max(
                                0,
                                Number(event.target.value),
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2">{item.product.taxRate}%</td>
                      <td className="px-2">
                        <Input
                          className="h-7 w-16"
                          type="number"
                          min={0}
                          max={100}
                          value={item.discountPct}
                          onChange={(event) =>
                            updateLine(item.productId, {
                              discountPct: Math.max(
                                0,
                                Math.min(100, Number(event.target.value)),
                              ),
                            })
                          }
                        />
                      </td>
                      <td className="px-2">{money(item.discount)}</td>
                      <td className="px-2">{money(item.subtotal)}</td>
                      <td className="px-2 font-semibold">
                        {money(item.total)}
                      </td>
                      <td className="px-2">
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          onClick={() =>
                            setLines((current) =>
                              current.filter(
                                (line) => line.productId !== item.productId,
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
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Descuento global %">
                <Input
                  className="w-24"
                  type="number"
                  min={0}
                  max={100}
                  value={globalPct}
                  onChange={(event) => {
                    setGlobalPct(Number(event.target.value));
                    setGlobalAmount(0);
                    setSaved(null);
                  }}
                />
              </Field>
              <Field label="Descuento global $">
                <Input
                  className="w-28"
                  type="number"
                  min={0}
                  step="0.01"
                  value={globalAmount}
                  onChange={(event) => {
                    setGlobalAmount(Number(event.target.value));
                    setGlobalPct(0);
                    setSaved(null);
                  }}
                />
              </Field>
            </div>
          </Card>
          <aside className="h-fit rounded-xl border bg-white p-4">
            <h2 className="mb-3 font-semibold">Totales</h2>
            <Total label="Subtotal 15%" value={bases[15] ?? 0} />
            <Total label="Subtotal 0%" value={bases[0] ?? 0} />
            {lineDiscount + appliedGlobal > 0 ? (
              <Total
                label="Descuento"
                value={-(lineDiscount + appliedGlobal)}
              />
            ) : null}
            <Total
              label="Subtotal después de descuento"
              value={subtotalAfterDiscount}
            />
            <Total label="IVA" value={taxTotal} />
            <div className="my-3 border-t" />
            <div className="flex items-end justify-between">
              <span className="font-semibold">TOTAL A PAGAR</span>
              <strong className="text-2xl text-[#172033]">
                {money(total)}
              </strong>
            </div>
            <Button
              className="mt-4 w-full bg-[#1E52F1] text-white"
              disabled={
                !submissionEnabled || saving || !lines.length || Boolean(saved)
              }
              title={!submissionEnabled ? submissionMessage : undefined}
              onClick={() => save(false)}
            >
              {saving ? "Guardando..." : "Guardar factura"}
            </Button>
          </aside>
        </div>
      </fieldset>
    </div>
  );
}
function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-3 font-semibold text-[#172033]">{title}</h2>
      {children}
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1 text-xs text-slate-500">
      <span>{label}</span>
      {children}
    </label>
  );
}
function Total({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-slate-500">{label}</span>
      <span>{money(value)}</span>
    </div>
  );
}

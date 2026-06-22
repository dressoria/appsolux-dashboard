"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  ReceiptText,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { SaleStatusBadge } from "@/components/appsolux/basic/sales-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";

type Product = {
  id: string;
  name: string;
  price: string;
  stock: number;
  barcode?: string | null;
  taxRate: string;
};

type Customer = {
  id: string;
  name: string;
};

type CartItem = {
  productId: string;
  quantity: number;
  discountAmount: number;
};

type SaleResponse = {
  id: string;
  createdAt: string;
  total: string;
  subtotal: string;
  taxTotal: string;
  discountTotal: string;
  status: string;
  paymentStatus: string;
  customer?: { name: string } | null;
  items: Array<{
    quantity: number;
    price: string;
    discountAmount: string;
    taxRate: string;
    taxAmount: string;
    total: string;
    product: { name: string };
  }>;
  payments: Array<{
    method: string;
    amount: string;
  }>;
};

type SaleOutputResult = {
  mode: "internal_receipt" | "sri_invoice";
  status: "completed" | "partial";
  saleId: string;
  errorMessage?: string;
  sri?: {
    documentId: string;
    flowState: "preparing" | "sending" | "received" | "authorized" | "rejected";
    flowLabel: string;
    message: string;
    documentStatus: string;
  };
};

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

export function BasicPosClient({
  tenantName,
  products,
  customers: initialCustomers,
  initialCustomerId,
  hasSriConfig = false,
}: {
  tenantName: string;
  products: Product[];
  customers: Customer[];
  initialCustomerId?: string;
  hasSriConfig?: boolean;
}) {
  const router = useRouter();

  // Cart & sale state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [outputMode, setOutputMode] = useState<"internal_receipt" | "sri_invoice">("internal_receipt");
  const [paidAmount, setPaidAmount] = useState("");
  const [search, setSearch] = useState("");
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [lastOutput, setLastOutput] = useState<SaleOutputResult | null>(null);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Raw string values for cart quantity inputs
  const [cartInputs, setCartInputs] = useState<Record<string, string>>({});
  // Raw string values for discount inputs
  const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});

  // Transfer fields (UI-only)
  const [transferBank, setTransferBank] = useState("");
  const [transferRef, setTransferRef] = useState("");

  // Customer state
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Modals / tooltips
  const [showComprobanteTip, setShowComprobanteTip] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddr, setNewCustomerAddr] = useState("");
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  const productById = new Map(products.map((p) => [p.id, p]));

  // Per-line calculated values
  function calcLine(item: CartItem) {
    const product = productById.get(item.productId);
    if (!product) return { gross: 0, discount: 0, subtotal: 0, tax: 0, total: 0, taxRate: 0 };
    const gross = toNumber(product.price) * item.quantity;
    const discount = Math.max(0, Math.min(item.discountAmount, gross));
    const sub = gross - discount;
    const taxRate = toNumber(product.taxRate);
    const tax = Math.round(sub * taxRate) / 100;
    return { gross, discount, subtotal: sub, tax, total: sub + tax, taxRate };
  }

  // Cart totals
  const cartTotals = cart.reduce(
    (acc, item) => {
      const line = calcLine(item);
      return {
        subtotal: acc.subtotal + line.subtotal,
        taxTotal: acc.taxTotal + line.tax,
        discountTotal: acc.discountTotal + line.discount,
        total: acc.total + line.total,
      };
    },
    { subtotal: 0, taxTotal: 0, discountTotal: 0, total: 0 }
  );

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      (product.barcode ?? "").toLowerCase().includes(term)
    );
  });

  const creditWithoutCustomer = paymentMethod === "credit" && !customerId;
  const sriNotReady = outputMode === "sri_invoice" && !hasSriConfig;

  function addProduct(productId: string) {
    setError("");
    setCart((current) => {
      const product = productById.get(productId);
      if (!product || product.stock <= 0) return current;

      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= product.stock) {
          setError(`Stock insuficiente para ${product.name}.`);
          return current;
        }
        const newQty = existing.quantity + 1;
        setCartInputs((prev) => ({ ...prev, [productId]: String(newQty) }));
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: newQty } : item
        );
      }
      setCartInputs((prev) => ({ ...prev, [productId]: "1" }));
      setDiscountInputs((prev) => ({ ...prev, [productId]: "0" }));
      return [...current, { productId, quantity: 1, discountAmount: 0 }];
    });
  }

  function commitQuantity(productId: string) {
    const raw = cartInputs[productId] ?? "";
    const product = productById.get(productId);
    const parsed = parseInt(raw, 10);
    const safe =
      !Number.isFinite(parsed) || parsed < 1
        ? 1
        : product
          ? Math.min(parsed, product.stock)
          : parsed;
    setCartInputs((prev) => ({ ...prev, [productId]: String(safe) }));
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, quantity: safe } : item
      )
    );
  }

  function commitDiscount(productId: string) {
    const raw = discountInputs[productId] ?? "0";
    const parsed = parseFloat(raw);
    const safe = !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
    const product = productById.get(productId);
    const cartItem = cart.find((i) => i.productId === productId);
    const maxDiscount = product && cartItem
      ? toNumber(product.price) * cartItem.quantity
      : safe;
    const clamped = Math.min(safe, maxDiscount);
    setDiscountInputs((prev) => ({ ...prev, [productId]: clamped.toFixed(2) }));
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, discountAmount: clamped } : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
    setCartInputs((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
    setDiscountInputs((prev) => {
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }

  async function submitSale() {
    setIsLoading(true);
    setError("");

    try {
      if (creditWithoutCustomer) {
        throw new Error("Para vender a crédito debes seleccionar o crear un cliente.");
      }

      for (const item of cart) {
        const product = productById.get(item.productId);
        if (!product || item.quantity > product.stock) {
          throw new Error(`Stock insuficiente para ${product?.name ?? "producto"}.`);
        }
      }

      const response = await fetch("/api/basic/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          paymentMethod,
          paidAmount:
            paymentMethod === "credit" ? 0 : paidAmount ? Number(paidAmount) : cartTotals.total,
          outputMode,
          items: cart.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            discountAmount: item.discountAmount,
          })),
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        sale?: SaleResponse;
        output?: SaleOutputResult;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo confirmar venta.");
      }

      setCart([]);
      setCartInputs({});
      setDiscountInputs({});
      setCustomerId("");
      setPaidAmount("");
      setTransferBank("");
      setTransferRef("");
      setShowReceipt(false);
      setShowDetail(false);
      setLastSale(result.sale ?? null);
      setLastOutput(result.output ?? null);
      router.refresh();
    } catch (requestError) {
      setError(
        requestError instanceof Error ? requestError.message : "No se pudo confirmar venta."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setNewCustomerLoading(true);
    setNewCustomerError("");

    try {
      const response = await fetch("/api/basic/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim() || undefined,
          email: newCustomerEmail.trim() || undefined,
          address: newCustomerAddr.trim() || undefined,
        }),
      });
      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
        customer?: Customer;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message ?? "No se pudo crear cliente.");
      }

      if (result.customer) {
        setCustomers((prev) => [...prev, result.customer!]);
        setCustomerId(result.customer.id);
      }

      setShowNewCustomer(false);
      setNewCustomerName("");
      setNewCustomerPhone("");
      setNewCustomerEmail("");
      setNewCustomerAddr("");
    } catch (err) {
      setNewCustomerError(err instanceof Error ? err.message : "No se pudo crear cliente.");
    } finally {
      setNewCustomerLoading(false);
    }
  }

  function startNewSale() {
    setLastSale(null);
    setLastOutput(null);
    setShowReceipt(false);
    setShowDetail(false);
    setCartInputs({});
    setError("");
  }

  const hasIva = cartTotals.taxTotal > 0;
  const hasDiscount = cartTotals.discountTotal > 0;

  return (
    <div className="space-y-4">

      {/* Quick-create customer modal */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-[28px] border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Nuevo cliente</h3>
              <button
                type="button"
                onClick={() => setShowNewCustomer(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleNewCustomer} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-name">Nombre / Razón social</Label>
                <Input
                  id="nc-name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="Ej. Juan Pérez"
                  required
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-phone">Teléfono</Label>
                <Input
                  id="nc-phone"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="0999000000"
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-email">Email</Label>
                <Input
                  id="nc-email"
                  type="email"
                  value={newCustomerEmail}
                  onChange={(e) => setNewCustomerEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  disabled={newCustomerLoading}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-addr">Dirección</Label>
                <Input
                  id="nc-addr"
                  value={newCustomerAddr}
                  onChange={(e) => setNewCustomerAddr(e.target.value)}
                  placeholder="Opcional"
                  disabled={newCustomerLoading}
                />
              </div>
              {newCustomerError && (
                <p className="text-sm text-destructive">{newCustomerError}</p>
              )}
              <div className="flex gap-2 pt-1">
                <Button
                  type="submit"
                  disabled={newCustomerLoading}
                  className="flex-1 bg-[#004080] hover:bg-[#003060]"
                >
                  {newCustomerLoading ? "Guardando..." : "Crear cliente"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowNewCustomer(false)}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Compact success strip */}
      {lastOutput && lastSale ? (
        <div className="space-y-3 rounded-[22px] border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                {lastOutput.mode === "sri_invoice"
                  ? lastOutput.status === "partial"
                    ? "Venta creada · Factura SRI con observaciones"
                    : "Venta finalizada · Factura SRI iniciada"
                  : "Venta finalizada · Recibo interno listo"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastOutput.mode === "internal_receipt" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowReceipt((v) => !v)}
                >
                  {showReceipt ? "Ocultar recibo" : "Ver recibo"}
                </Button>
              )}
              {lastOutput.mode === "sri_invoice" && lastOutput.sri?.documentId && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/sri/documents/${lastOutput.sri.documentId}`}>
                    Ver factura SRI
                  </Link>
                </Button>
              )}
              <Button asChild size="sm" variant="outline">
                <Link href={`/basic/sales/${lastSale.id}`}>Ver venta</Link>
              </Button>
              <Button
                size="sm"
                className="bg-[#004080] hover:bg-[#003060]"
                onClick={startNewSale}
              >
                Nueva venta
              </Button>
            </div>
          </div>

          {lastOutput.mode === "sri_invoice" &&
            lastOutput.status === "partial" &&
            lastOutput.errorMessage && (
              <p className="text-xs text-amber-700">{lastOutput.errorMessage}</p>
            )}

          {showReceipt && lastOutput.mode === "internal_receipt" && (
            <div className="pt-1">
              <SimpleReceipt tenantName={tenantName} sale={lastSale} />
            </div>
          )}
        </div>
      ) : null}

      {/* POS grid */}
      <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">

        {/* Left: product search + grid */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-medium text-slate-900">Productos</Label>
              <SaleStatusBadge
                label={`${filteredProducts.length} disponibles`}
                variant="info"
              />
            </div>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar producto o codigo"
              className="rounded-2xl border-slate-200 bg-white"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            {filteredProducts.map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addProduct(product.id)}
                className="rounded-[22px] border border-slate-200 bg-white p-4 text-left text-sm shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50"
                disabled={isLoading || product.stock <= 0}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <span className="block font-medium text-slate-900">{product.name}</span>
                    <span className="text-slate-500">
                      {money(toNumber(product.price))} · stock {product.stock}
                    </span>
                    {toNumber(product.taxRate) > 0 && (
                      <span className="block text-xs text-slate-400">
                        IVA {product.taxRate}%
                      </span>
                    )}
                  </div>
                  <SaleStatusBadge
                    label={product.stock > 0 ? "Disponible" : "Agotado"}
                    variant={product.stock > 0 ? "success" : "danger"}
                  />
                </div>
                <p className="mt-3 text-xs text-slate-500">Toca para agregar al carrito.</p>
              </button>
            ))}
          </div>

          {filteredProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No hay productos disponibles.</p>
          ) : null}
        </div>

        {/* Right: cart + checkout */}
        <div className="space-y-4 rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">

          {/* Cart header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">Carrito</p>
              {hasIva || hasDiscount ? (
                <p className="text-xs text-slate-500">
                  {hasDiscount && `Desc. ${money(cartTotals.discountTotal)} · `}
                  {hasIva && `IVA ${money(cartTotals.taxTotal)} · `}
                  Total {money(cartTotals.total)}
                </p>
              ) : (
                <p className="text-xs text-slate-500">Total: {money(cartTotals.total)}</p>
              )}
            </div>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={() => setShowDetail((v) => !v)}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
              >
                {showDetail ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                {showDetail ? "Ocultar detalle" : "Ver detalle"}
              </button>
            )}
          </div>

          {/* Detail panel — editable pre-invoice view */}
          {showDetail && cart.length > 0 && (
            <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-3 text-xs">
              <p className="font-semibold text-slate-700 text-xs uppercase tracking-wide">
                Detalle del comprobante
              </p>
              <p className="text-slate-500">
                Cliente: {customers.find((c) => c.id === customerId)?.name ?? "Consumidor final"}
              </p>

              {/* Line table */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="pb-1.5 text-left font-medium">Producto</th>
                      <th className="pb-1.5 text-right font-medium w-16">Cant.</th>
                      <th className="pb-1.5 text-right font-medium w-20">P. unit.</th>
                      <th className="pb-1.5 text-right font-medium w-20">Desc.</th>
                      <th className="pb-1.5 text-right font-medium w-16">IVA %</th>
                      <th className="pb-1.5 text-right font-medium w-20">IVA $</th>
                      <th className="pb-1.5 text-right font-medium w-20">Total</th>
                      <th className="pb-1.5 w-8" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cart.map((item) => {
                      const product = productById.get(item.productId);
                      const line = calcLine(item);
                      return (
                        <tr key={item.productId} className="align-middle">
                          <td className="py-2 pr-2 font-medium text-slate-800">
                            {product?.name}
                          </td>
                          {/* Quantity */}
                          <td className="py-2 pr-1">
                            <Input
                              type="number"
                              min="1"
                              max={product?.stock ?? undefined}
                              value={cartInputs[item.productId] ?? String(item.quantity)}
                              onChange={(e) =>
                                setCartInputs((prev) => ({ ...prev, [item.productId]: e.target.value }))
                              }
                              onBlur={() => commitQuantity(item.productId)}
                              className="h-7 w-14 text-right text-xs"
                            />
                          </td>
                          {/* Unit price */}
                          <td className="py-2 pr-1 text-right text-slate-600">
                            {money(toNumber(product?.price ?? 0))}
                          </td>
                          {/* Discount */}
                          <td className="py-2 pr-1">
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={discountInputs[item.productId] ?? "0"}
                              onChange={(e) =>
                                setDiscountInputs((prev) => ({ ...prev, [item.productId]: e.target.value }))
                              }
                              onBlur={() => commitDiscount(item.productId)}
                              className="h-7 w-20 text-right text-xs"
                              placeholder="0.00"
                            />
                          </td>
                          {/* IVA % */}
                          <td className="py-2 pr-1 text-right text-slate-500">
                            {line.taxRate}%
                          </td>
                          {/* IVA $ */}
                          <td className="py-2 pr-1 text-right text-slate-600">
                            {money(line.tax)}
                          </td>
                          {/* Total */}
                          <td className="py-2 pr-1 text-right font-semibold text-slate-800">
                            {money(line.total)}
                          </td>
                          <td className="py-2">
                            <button
                              type="button"
                              onClick={() => removeFromCart(item.productId)}
                              className="flex h-6 w-6 items-center justify-center rounded text-slate-300 hover:bg-red-50 hover:text-red-500"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-200 pt-2 space-y-1 text-right">
                <div className="flex justify-between text-slate-500">
                  <span>Subtotal (base imponible)</span>
                  <span>{money(cartTotals.subtotal)}</span>
                </div>
                {hasDiscount && (
                  <div className="flex justify-between text-slate-500">
                    <span>Descuento total</span>
                    <span>-{money(cartTotals.discountTotal)}</span>
                  </div>
                )}
                {hasIva && (
                  <div className="flex justify-between text-slate-500">
                    <span>IVA total</span>
                    <span>{money(cartTotals.taxTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between font-semibold text-slate-900 text-sm pt-1 border-t border-slate-200">
                  <span>Total</span>
                  <span>{money(cartTotals.total)}</span>
                </div>
              </div>
            </div>
          )}

          {/* Compact cart rows — visible when detail is hidden */}
          {!showDetail && (
            <div className="space-y-2">
              {cart.map((item) => {
                const product = productById.get(item.productId);
                const rawValue = cartInputs[item.productId] ?? String(item.quantity);
                const line = calcLine(item);
                return (
                  <div key={item.productId} className="grid grid-cols-[1fr_80px_32px] items-center gap-2">
                    <div>
                      <p className="text-sm text-slate-900">{product?.name}</p>
                      <p className="text-xs text-slate-500">
                        {money(toNumber(product?.price ?? 0))}
                        {line.taxRate > 0 && ` · IVA ${line.taxRate}%`}
                        {item.discountAmount > 0 && ` · Desc. ${money(item.discountAmount)}`}
                      </p>
                    </div>
                    <Input
                      type="number"
                      min="1"
                      max={product?.stock ?? undefined}
                      value={rawValue}
                      onChange={(event) =>
                        setCartInputs((prev) => ({ ...prev, [item.productId]: event.target.value }))
                      }
                      onBlur={() => commitQuantity(item.productId)}
                    />
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600"
                      title="Eliminar del carrito"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Customer selector + quick-create */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="customerId">Cliente</Label>
              <button
                type="button"
                onClick={() => setShowNewCustomer(true)}
                className="flex items-center gap-1 text-xs text-[#004080] hover:text-[#003060]"
              >
                <UserPlus className="h-3 w-3" />
                Nuevo cliente
              </button>
            </div>
            {initialCustomerId && customerId === initialCustomerId && (
              <p className="text-xs text-slate-500">
                Cliente seleccionado desde conversacion.
              </p>
            )}
            <select
              id="customerId"
              value={customerId}
              onChange={(event) => setCustomerId(event.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="">Consumidor final</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>
                  {customer.name}
                </option>
              ))}
            </select>

            {creditWithoutCustomer && (
              <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <AlertCircle className="h-3 w-3 shrink-0" />
                Para vender a crédito debes seleccionar o crear un cliente.
              </p>
            )}
          </div>

          {/* Payment method */}
          <div className="space-y-2">
            <Label htmlFor="paymentMethod">Método de pago</Label>
            <select
              id="paymentMethod"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              className="h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 text-sm"
            >
              <option value="cash">Efectivo</option>
              <option value="transfer">Transferencia</option>
              <option value="card">Tarjeta</option>
              <option value="credit">Fiado / Crédito</option>
            </select>
          </div>

          {/* Transfer fields */}
          {paymentMethod === "transfer" && (
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/60 p-3">
              <p className="text-xs font-medium text-slate-600">Datos de transferencia</p>
              <div className="space-y-1.5">
                <Label htmlFor="transferBank">Banco</Label>
                <Input
                  id="transferBank"
                  value={transferBank}
                  onChange={(e) => setTransferBank(e.target.value)}
                  placeholder="Ej. Banco Pichincha"
                  className="bg-white"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="transferRef">Número / referencia</Label>
                <Input
                  id="transferRef"
                  value={transferRef}
                  onChange={(e) => setTransferRef(e.target.value)}
                  placeholder="Ej. 00123456"
                  className="bg-white"
                />
              </div>
              <p className="text-xs text-slate-400">
                Referencia visual — no se almacena en esta versión.
              </p>
            </div>
          )}

          {/* Paid amount */}
          <div className="space-y-2">
            <Label htmlFor="paidAmount">Monto pagado</Label>
            <Input
              id="paidAmount"
              type="number"
              step="0.01"
              min="0"
              value={paidAmount}
              placeholder={cartTotals.total.toFixed(2)}
              onChange={(event) => setPaidAmount(event.target.value)}
              disabled={paymentMethod === "credit"}
            />
            {paymentMethod === "credit" ? (
              <p className="text-xs text-slate-500">
                El total quedará pendiente en el saldo del cliente.
              </p>
            ) : null}
          </div>

          {/* Sale output mode */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-slate-900">Comprobante</Label>
              <button
                type="button"
                onClick={() => setShowComprobanteTip((v) => !v)}
                className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                aria-label="Información sobre tipos de comprobante"
              >
                ?
              </button>
            </div>
            {showComprobanteTip && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600 space-y-1.5">
                <p><span className="font-medium text-slate-800">Recibo interno:</span> Registra la venta, descuenta inventario y genera un recibo operativo sin enviarlo al SRI.</p>
                <p><span className="font-medium text-slate-800">Factura SRI:</span> Registra la venta, descuenta inventario y genera una factura electrónica SRI automáticamente.</p>
              </div>
            )}
            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setOutputMode("internal_receipt")}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  outputMode === "internal_receipt"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <ReceiptText className="h-4 w-4 shrink-0" />
                Recibo interno
              </button>
              <button
                type="button"
                onClick={() => hasSriConfig && setOutputMode("sri_invoice")}
                disabled={!hasSriConfig}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition",
                  outputMode === "sri_invoice"
                    ? "bg-white text-slate-900 shadow-sm"
                    : hasSriConfig
                      ? "text-slate-500 hover:text-slate-700"
                      : "cursor-not-allowed text-slate-300"
                )}
              >
                <FileCheck2 className="h-4 w-4 shrink-0" />
                Factura SRI
              </button>
            </div>

            {!hasSriConfig && (
              <p className="text-xs text-slate-500">
                Para emitir facturas SRI,{" "}
                <Link href={routes.sri} className="underline text-[#004080] hover:text-[#003060]">
                  configura el módulo SRI
                </Link>
                .
              </p>
            )}

            {sriNotReady && outputMode === "sri_invoice" && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Falta completar la configuración SRI.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button asChild size="sm" variant="outline" className="border-amber-300 text-amber-800 hover:bg-amber-100">
                    <Link href={routes.sri}>Completar SRI</Link>
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOutputMode("internal_receipt")}>
                    Usar recibo
                  </Button>
                </div>
              </div>
            )}
          </div>

          <Button
            type="button"
            onClick={submitSale}
            disabled={isLoading || cart.length === 0 || creditWithoutCustomer}
            className="w-full"
          >
            {isLoading
              ? "Finalizando..."
              : outputMode === "sri_invoice"
                ? "Emitir factura SRI"
                : "Finalizar venta"}
          </Button>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}

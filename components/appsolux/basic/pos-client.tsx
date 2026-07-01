"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  FileCheck2,
  Maximize2,
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

const SRI_PAYMENT_OPTIONS = [
  { code: "01", label: "Sin utilización del sistema financiero (efectivo)" },
  { code: "16", label: "Tarjeta de débito" },
  { code: "17", label: "Dinero electrónico" },
  { code: "18", label: "Tarjeta prepago" },
  { code: "19", label: "Tarjeta de crédito" },
  { code: "20", label: "Otros con utilización del sistema financiero" },
  { code: "21", label: "Endoso de títulos" },
] as const;

function defaultSriCode(method: string): string {
  switch (method) {
    case "cash": return "01";
    case "transfer": return "20";
    case "card": return "19";
    default: return "01";
  }
}

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
  phone?: string | null;
  email?: string | null;
  address?: string | null;
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
  payments: Array<{ method: string; amount: string }>;
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
  currentUserName,
  products,
  customers: initialCustomers,
  initialCustomerId,
  hasSriConfig = false,
  saleEndpoint = "/api/basic/sales",
  engine = "CORE",
}: {
  tenantName: string;
  currentUserName?: string;
  products: Product[];
  customers: Customer[];
  initialCustomerId?: string;
  hasSriConfig?: boolean;
  saleEndpoint?: string;
  engine?: "CORE" | "SHARED_ERP";
}) {
  const router = useRouter();

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
  const [showInvoiceEditor, setShowInvoiceEditor] = useState(false);
  const [invoiceSearch, setInvoiceSearch] = useState("");

  const [cartInputs, setCartInputs] = useState<Record<string, string>>({});
  const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});
  const [discountPctInputs, setDiscountPctInputs] = useState<Record<string, string>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});

  const [transferBank, setTransferBank] = useState("");
  const [transferRef, setTransferRef] = useState("");

  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);

  // Invoice editor customer fields (editable overrides)
  const [invoiceCustomerName, setInvoiceCustomerName] = useState("Consumidor Final");
  const [invoiceCustomerIdentification, setInvoiceCustomerIdentification] = useState("9999999999999");
  const [invoiceCustomerPhone, setInvoiceCustomerPhone] = useState("");
  const [invoiceCustomerEmail, setInvoiceCustomerEmail] = useState("");
  const [invoiceCustomerAddress, setInvoiceCustomerAddress] = useState("");
  const [invoiceCustomerNotes, setInvoiceCustomerNotes] = useState("");

  const [sriPaymentCode, setSriPaymentCode] = useState("01");

  const [showComprobanteTip, setShowComprobanteTip] = useState(false);
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddr, setNewCustomerAddr] = useState("");
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const productById = new Map(products.map((p) => [p.id, p]));

  // Sync invoice customer fields when selection changes
  useEffect(() => {
    if (!customerId) {
      setInvoiceCustomerName("Consumidor Final");
      setInvoiceCustomerIdentification("9999999999999");
      setInvoiceCustomerPhone("");
      setInvoiceCustomerEmail("");
      setInvoiceCustomerAddress("");
    } else {
      const found = customers.find((c) => c.id === customerId);
      if (found) {
        setInvoiceCustomerName(found.name);
        setInvoiceCustomerIdentification("");
        setInvoiceCustomerPhone(found.phone ?? "");
        setInvoiceCustomerEmail(found.email ?? "");
        setInvoiceCustomerAddress(found.address ?? "");
      }
    }
  }, [customerId, customers]);

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

  const subtotalByRate = cart.reduce((acc, item) => {
    const line = calcLine(item);
    const r = line.taxRate;
    acc[r] = (acc[r] ?? 0) + line.subtotal;
    return acc;
  }, {} as Record<number, number>);

  const filteredProducts = products.filter((product) => {
    const term = search.trim().toLowerCase();
    if (!term) return true;
    return (
      product.name.toLowerCase().includes(term) ||
      (product.barcode ?? "").toLowerCase().includes(term)
    );
  });

  const filteredInvoiceProducts = invoiceSearch.trim()
    ? products
        .filter(
          (p) =>
            p.name.toLowerCase().includes(invoiceSearch.toLowerCase()) ||
            (p.barcode ?? "").toLowerCase().includes(invoiceSearch.toLowerCase())
        )
        .slice(0, 6)
    : [];

  const creditWithoutCustomer = paymentMethod === "credit" && !customerId;

  const paidNum = paidAmount ? Number(paidAmount) : (paymentMethod === "credit" ? 0 : cartTotals.total);
  const saldo = paymentMethod === "credit" ? cartTotals.total : Math.max(0, cartTotals.total - paidNum);
  const vuelto = paymentMethod !== "credit" && paidNum > cartTotals.total ? paidNum - cartTotals.total : 0;

  function showTip() {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = setTimeout(() => setShowComprobanteTip(true), 400);
  }

  function hideTip() {
    if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
    tipTimerRef.current = null;
    setShowComprobanteTip(false);
  }

  function handleTipClick() {
    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }
    setShowComprobanteTip((v) => !v);
  }

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
        // recalculate pct display after qty change
        const gross = toNumber(product.price) * newQty;
        const pct = gross > 0 ? (existing.discountAmount / gross) * 100 : 0;
        setDiscountPctInputs((prev) => ({ ...prev, [productId]: pct.toFixed(1) }));
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: newQty } : item
        );
      }
      setCartInputs((prev) => ({ ...prev, [productId]: "1" }));
      setDiscountInputs((prev) => ({ ...prev, [productId]: "0" }));
      setDiscountPctInputs((prev) => ({ ...prev, [productId]: "0.0" }));
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
    setCart((current) => {
      const updated = current.map((item) =>
        item.productId === productId ? { ...item, quantity: safe } : item
      );
      // recalculate pct after qty change
      const cartItem = updated.find((i) => i.productId === productId);
      if (product && cartItem) {
        const gross = toNumber(product.price) * safe;
        const pct = gross > 0 ? (cartItem.discountAmount / gross) * 100 : 0;
        setDiscountPctInputs((prev) => ({ ...prev, [productId]: pct.toFixed(1) }));
      }
      return updated;
    });
  }

  function commitDiscount(productId: string) {
    const raw = discountInputs[productId] ?? "0";
    const parsed = parseFloat(raw);
    const safe = !Number.isFinite(parsed) || parsed < 0 ? 0 : parsed;
    const product = productById.get(productId);
    const cartItem = cart.find((i) => i.productId === productId);
    const maxDiscount =
      product && cartItem ? toNumber(product.price) * cartItem.quantity : safe;
    const clamped = Math.min(safe, maxDiscount);
    setDiscountInputs((prev) => ({ ...prev, [productId]: clamped.toFixed(2) }));
    if (product && cartItem) {
      const gross = toNumber(product.price) * cartItem.quantity;
      const pct = gross > 0 ? (clamped / gross) * 100 : 0;
      setDiscountPctInputs((prev) => ({ ...prev, [productId]: pct.toFixed(1) }));
    }
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, discountAmount: clamped } : item
      )
    );
  }

  function commitDiscountPct(productId: string) {
    const raw = discountPctInputs[productId] ?? "0";
    const pct = parseFloat(raw);
    const safePct = !Number.isFinite(pct) || pct < 0 ? 0 : Math.min(pct, 100);
    const product = productById.get(productId);
    const cartItem = cart.find((i) => i.productId === productId);
    if (!product || !cartItem) return;
    const gross = toNumber(product.price) * cartItem.quantity;
    const discountAmt = Math.round(gross * safePct) / 100;
    setDiscountPctInputs((prev) => ({ ...prev, [productId]: safePct.toFixed(1) }));
    setDiscountInputs((prev) => ({ ...prev, [productId]: discountAmt.toFixed(2) }));
    setCart((current) =>
      current.map((item) =>
        item.productId === productId ? { ...item, discountAmount: discountAmt } : item
      )
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((item) => item.productId !== productId));
    setCartInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setDiscountInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setDiscountPctInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setLineNotes((prev) => { const n = { ...prev }; delete n[productId]; return n; });
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

      const response = await fetch(saleEndpoint, {
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
      setDiscountPctInputs({});
      setLineNotes({});
      setCustomerId("");
      setPaidAmount("");
      setTransferBank("");
      setTransferRef("");
      setShowReceipt(false);
      setShowInvoiceEditor(false);
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
    setShowInvoiceEditor(false);
    setCartInputs({});
    setDiscountInputs({});
    setDiscountPctInputs({});
    setLineNotes({});
    setError("");
  }

  const hasIva = cartTotals.taxTotal > 0;
  const hasDiscount = cartTotals.discountTotal > 0;
  const todayStr = new Date().toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  // Expanded line table used inside the invoice editor modal
  function InvoiceLineTable() {
    if (cart.length === 0) {
      return (
        <div className="rounded-xl border border-dashed border-slate-200 py-10 text-center">
          <p className="text-sm text-slate-400">
            Sin productos. Busca arriba para agregar.
          </p>
        </div>
      );
    }
    return (
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[860px] text-sm">
          <thead className="bg-slate-50">
            <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              <th className="w-20 px-3 py-3 text-left">Código</th>
              <th className="px-4 py-3 text-left">Producto</th>
              <th className="w-28 px-3 py-3 text-left">Observación</th>
              <th className="w-16 px-3 py-3 text-right">Cant.</th>
              <th className="w-22 px-3 py-3 text-right">P. unit.</th>
              <th className="w-14 px-3 py-3 text-right">IVA%</th>
              <th className="w-18 px-3 py-3 text-right">Desc.%</th>
              <th className="w-22 px-3 py-3 text-right">Desc.$</th>
              <th className="w-18 px-3 py-3 text-right">IVA$</th>
              <th className="w-22 px-3 py-3 text-right">Total</th>
              <th className="w-8 px-2 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cart.map((item) => {
              const product = productById.get(item.productId);
              const line = calcLine(item);
              return (
                <tr key={item.productId} className="align-middle transition hover:bg-slate-50/50">
                  <td className="px-3 py-2.5 text-[11px] text-slate-400 font-mono">
                    {product?.barcode ?? "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium text-slate-800 leading-tight">{product?.name}</p>
                    {line.taxRate === 0 && (
                      <p className="text-[10px] text-slate-400">Sin IVA</p>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      value={lineNotes[item.productId] ?? ""}
                      onChange={(e) =>
                        setLineNotes((prev) => ({ ...prev, [item.productId]: e.target.value }))
                      }
                      placeholder="Obs."
                      className="h-7 w-full text-xs rounded-lg border-slate-200"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min="1"
                      max={product?.stock ?? undefined}
                      value={cartInputs[item.productId] ?? String(item.quantity)}
                      onChange={(e) =>
                        setCartInputs((prev) => ({ ...prev, [item.productId]: e.target.value }))
                      }
                      onBlur={() => commitQuantity(item.productId)}
                      className="h-7 w-14 text-right text-xs rounded-lg"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600 text-xs">
                    {money(toNumber(product?.price ?? 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-500 text-xs">
                    {line.taxRate}%
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPctInputs[item.productId] ?? "0.0"}
                      onChange={(e) =>
                        setDiscountPctInputs((prev) => ({ ...prev, [item.productId]: e.target.value }))
                      }
                      onBlur={() => commitDiscountPct(item.productId)}
                      className="h-7 w-16 text-right text-xs rounded-lg"
                      placeholder="0.0"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountInputs[item.productId] ?? "0.00"}
                      onChange={(e) =>
                        setDiscountInputs((prev) => ({ ...prev, [item.productId]: e.target.value }))
                      }
                      onBlur={() => commitDiscount(item.productId)}
                      className="h-7 w-20 text-right text-xs rounded-lg"
                      placeholder="0.00"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-right text-slate-600 text-xs">
                    {money(line.tax)}
                  </td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-900 text-xs">
                    {money(line.total)}
                  </td>
                  <td className="px-2 py-2.5">
                    <button
                      type="button"
                      onClick={() => removeFromCart(item.productId)}
                      className="flex h-6 w-6 items-center justify-center rounded-lg text-slate-300 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-4">

      {/* ── New customer modal ─────────────────────────────────────────────── */}
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
                <Button type="button" variant="outline" onClick={() => setShowNewCustomer(false)}>
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Professional invoice editor modal ──────────────────────────────── */}
      {showInvoiceEditor && (
        <div className="fixed inset-0 z-40 overflow-y-auto bg-black/50">
          <div className="flex min-h-full items-start justify-center p-4 pt-6">
            <div className="mb-8 w-full max-w-6xl rounded-2xl border border-slate-200 bg-white shadow-2xl">

              {/* Modal header */}
              <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-semibold text-slate-900">
                      {outputMode === "sri_invoice"
                        ? "Factura electrónica SRI"
                        : "Recibo interno de venta"}
                    </h2>
                    <span className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
                      outputMode === "sri_invoice"
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-500"
                    )}>
                      {outputMode === "sri_invoice" ? "SRI" : "Interno"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{todayStr}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowInvoiceEditor(false)}
                  className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal body */}
              <div className="grid lg:grid-cols-[1fr_288px]">

                {/* ── Left column: document data + customer + products ─── */}
                <div className="space-y-6 p-6">

                  {/* Tipo de comprobante */}
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Tipo de comprobante
                    </h3>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setOutputMode("internal_receipt")}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                          outputMode === "internal_receipt"
                            ? "border-[#004080] bg-blue-50 text-[#004080]"
                            : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        )}
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        Recibo interno
                      </button>
                      <button
                        type="button"
                        onClick={() => hasSriConfig && setOutputMode("sri_invoice")}
                        disabled={!hasSriConfig}
                        title={!hasSriConfig ? "Configura el módulo SRI primero" : undefined}
                        className={cn(
                          "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                          outputMode === "sri_invoice"
                            ? "border-[#004080] bg-blue-50 text-[#004080]"
                            : hasSriConfig
                              ? "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                              : "cursor-not-allowed border-slate-100 text-slate-300"
                        )}
                      >
                        <FileCheck2 className="h-3.5 w-3.5" />
                        Factura SRI
                        {!hasSriConfig && (
                          <span className="ml-1 text-[10px]">(sin config.)</span>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Datos del documento */}
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Datos del documento
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Fecha</Label>
                        <Input
                          value={todayStr}
                          readOnly
                          className="rounded-lg bg-slate-50 text-sm text-slate-700"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500">Cajero / Vendedor</Label>
                        <Input
                          value={currentUserName ?? "—"}
                          readOnly
                          className="rounded-lg bg-slate-50 text-sm text-slate-700"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-slate-500">Forma de pago (SRI)</Label>
                        <select
                          value={sriPaymentCode}
                          onChange={(e) => setSriPaymentCode(e.target.value)}
                          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"
                        >
                          {SRI_PAYMENT_OPTIONS.map((o) => (
                            <option key={o.code} value={o.code}>
                              {o.code} – {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-xs text-slate-500">
                          N. Guía de remisión{" "}
                          <span className="text-slate-400">(opcional)</span>
                        </Label>
                        <div className="flex items-center gap-1.5">
                          <Input
                            disabled
                            placeholder="000"
                            className="w-14 rounded-lg bg-slate-50 text-center text-sm opacity-50"
                          />
                          <span className="text-slate-400">-</span>
                          <Input
                            disabled
                            placeholder="000"
                            className="w-14 rounded-lg bg-slate-50 text-center text-sm opacity-50"
                          />
                          <span className="text-slate-400">-</span>
                          <Input
                            disabled
                            placeholder="000000000"
                            className="flex-1 rounded-lg bg-slate-50 text-center text-sm opacity-50"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="modal-reimburse"
                          disabled
                          className="cursor-not-allowed opacity-40"
                          title="Disponible con ERP"
                        />
                        <Label
                          htmlFor="modal-reimburse"
                          className="cursor-not-allowed text-xs text-slate-400"
                          title="Disponible con ERP"
                        >
                          Factura por reembolso
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="modal-export"
                          disabled
                          className="cursor-not-allowed opacity-40"
                          title="Disponible con ERP"
                        />
                        <Label
                          htmlFor="modal-export"
                          className="cursor-not-allowed text-xs text-slate-400"
                          title="Disponible con ERP"
                        >
                          Factura de exportación
                        </Label>
                      </div>
                    </div>
                  </div>

                  {/* Datos del cliente */}
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Datos del cliente
                    </h3>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-xs text-slate-500">Seleccionar cliente</Label>
                        {engine === "CORE" ? (
                          <button
                            type="button"
                            onClick={() => setShowNewCustomer(true)}
                            className="flex items-center gap-1 text-xs text-[#004080] hover:text-[#003060]"
                          >
                            <UserPlus className="h-3 w-3" />
                            Nuevo cliente
                          </button>
                        ) : null}
                      </div>
                      <select
                        value={customerId}
                        onChange={(e) => setCustomerId(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm"
                      >
                        <option value="">Consumidor Final</option>
                        {customers.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Nombre / Razón social</Label>
                          <Input
                            value={invoiceCustomerName}
                            onChange={(e) => setInvoiceCustomerName(e.target.value)}
                            placeholder="Consumidor Final"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Cédula / RUC / Pasaporte</Label>
                          <Input
                            value={invoiceCustomerIdentification}
                            onChange={(e) => setInvoiceCustomerIdentification(e.target.value)}
                            placeholder="9999999999999"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Teléfono</Label>
                          <Input
                            value={invoiceCustomerPhone}
                            onChange={(e) => setInvoiceCustomerPhone(e.target.value)}
                            placeholder="0999000000"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500">Correo electrónico</Label>
                          <Input
                            type="email"
                            value={invoiceCustomerEmail}
                            onChange={(e) => setInvoiceCustomerEmail(e.target.value)}
                            placeholder="correo@ejemplo.com"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-slate-500">Dirección</Label>
                          <Input
                            value={invoiceCustomerAddress}
                            onChange={(e) => setInvoiceCustomerAddress(e.target.value)}
                            placeholder="Dirección del cliente"
                            className="rounded-lg text-sm"
                          />
                        </div>
                        <div className="space-y-1 sm:col-span-2">
                          <Label className="text-xs text-slate-500">Observaciones</Label>
                          <Input
                            value={invoiceCustomerNotes}
                            onChange={(e) => setInvoiceCustomerNotes(e.target.value)}
                            placeholder="Información adicional para la factura"
                            className="rounded-lg text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Productos */}
                  <div>
                    <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Productos
                    </h3>
                    <div className="space-y-3">
                      <div className="relative">
                        <Input
                          value={invoiceSearch}
                          onChange={(e) => setInvoiceSearch(e.target.value)}
                          placeholder="Buscar y agregar producto por nombre o código..."
                          className="rounded-xl border-slate-200 bg-slate-50 text-sm"
                        />
                        {filteredInvoiceProducts.length > 0 && (
                          <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                            {filteredInvoiceProducts.map((p) => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => {
                                  addProduct(p.id);
                                  setInvoiceSearch("");
                                }}
                                disabled={p.stock <= 0}
                                className="flex w-full items-center justify-between px-4 py-2.5 text-left text-sm hover:bg-slate-50 disabled:opacity-40"
                              >
                                <span className="font-medium text-slate-800">{p.name}</span>
                                <span className="shrink-0 text-xs text-slate-500">
                                  {money(toNumber(p.price))} · stock {p.stock}
                                  {toNumber(p.taxRate) > 0 && ` · IVA ${p.taxRate}%`}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <InvoiceLineTable />
                    </div>
                  </div>
                </div>

                {/* ── Right column: totals + payment + actions ────────── */}
                <div className="flex flex-col gap-4 border-t border-slate-100 p-6 lg:border-l lg:border-t-0">

                  {/* Resumen detallado */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                    <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      Resumen
                    </p>

                    {Object.entries(subtotalByRate)
                      .sort(([a], [b]) => Number(a) - Number(b))
                      .map(([rate, base]) => (
                        <div key={rate} className="flex justify-between text-slate-600">
                          <span>Base IVA {rate}%</span>
                          <span>{money(base)}</span>
                        </div>
                      ))}

                    {hasDiscount && (
                      <div className="flex justify-between text-slate-600">
                        <span>Descuento</span>
                        <span className="text-red-600">-{money(cartTotals.discountTotal)}</span>
                      </div>
                    )}

                    {hasIva && (
                      <div className="flex justify-between text-slate-600">
                        <span>IVA</span>
                        <span>{money(cartTotals.taxTotal)}</span>
                      </div>
                    )}

                    <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                      <span>Total factura</span>
                      <span className="text-base">{money(cartTotals.total)}</span>
                    </div>
                  </div>

                  {/* Forma de pago */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-slate-700">Forma de pago</Label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => {
                        setPaymentMethod(e.target.value);
                        setSriPaymentCode(defaultSriCode(e.target.value));
                      }}
                      className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
                    >
                      <option value="cash">Efectivo</option>
                      <option value="transfer">Transferencia</option>
                      <option value="card">Tarjeta</option>
                      <option value="credit">Fiado / Crédito</option>
                    </select>
                  </div>

                  {/* Monto pagado */}
                  {paymentMethod !== "credit" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium text-slate-700">Monto pagado</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={paidAmount}
                        placeholder={cartTotals.total.toFixed(2)}
                        onChange={(e) => setPaidAmount(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  )}

                  {/* Saldo / Vuelto */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Monto pagado</span>
                      <span>{money(paidNum)}</span>
                    </div>
                    {vuelto > 0 ? (
                      <div className="flex justify-between font-medium text-emerald-700">
                        <span>Vuelto</span>
                        <span>{money(vuelto)}</span>
                      </div>
                    ) : (
                      <div className={cn(
                        "flex justify-between font-medium",
                        saldo > 0 ? "text-amber-700" : "text-emerald-700"
                      )}>
                        <span>Saldo pendiente</span>
                        <span>{money(saldo)}</span>
                      </div>
                    )}
                  </div>

                  {paymentMethod === "credit" && (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      El saldo quedará pendiente en la cuenta del cliente.
                    </p>
                  )}

                  {creditWithoutCustomer && (
                    <p className="flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                      <AlertCircle className="h-3 w-3 shrink-0" />
                      Selecciona un cliente para usar crédito.
                    </p>
                  )}

                  {error && (
                    <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">
                      {error}
                    </p>
                  )}

                  {/* Actions */}
                  <div className="mt-auto space-y-2 pt-2">
                    <Button
                      type="button"
                      onClick={submitSale}
                      disabled={isLoading || cart.length === 0 || creditWithoutCustomer}
                      className="w-full bg-[#004080] hover:bg-[#003060]"
                    >
                      {isLoading
                        ? "Procesando..."
                        : outputMode === "sri_invoice"
                          ? "Emitir factura SRI"
                          : "Finalizar venta"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled
                      title="Próximamente: guardar como borrador"
                      className="w-full cursor-not-allowed opacity-50"
                    >
                      Guardar borrador
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setShowInvoiceEditor(false)}
                      className="w-full text-slate-500"
                    >
                      Cerrar
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Compact success strip ───────────────────────────────────────────── */}
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
              {engine === "CORE" ? (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/basic/sales/${lastSale.id}`}>Ver venta</Link>
                </Button>
              ) : null}
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

      {/* ── POS grid ────────────────────────────────────────────────────────── */}
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
                onClick={() => setShowInvoiceEditor(true)}
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 transition hover:border-[#004080] hover:text-[#004080]"
                title="Abrir facturero completo"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                Facturero
              </button>
            )}
          </div>

          {/* Compact cart rows */}
          <div className="space-y-2">
            {cart.map((item) => {
              const product = productById.get(item.productId);
              const rawValue = cartInputs[item.productId] ?? String(item.quantity);
              const line = calcLine(item);
              return (
                <div
                  key={item.productId}
                  className="grid grid-cols-[1fr_80px_32px] items-center gap-2"
                >
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
                      setCartInputs((prev) => ({
                        ...prev,
                        [item.productId]: event.target.value,
                      }))
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

          {/* Customer selector */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="customerId">Cliente</Label>
              {engine === "CORE" ? (
                <button
                  type="button"
                  onClick={() => setShowNewCustomer(true)}
                  className="flex items-center gap-1 text-xs text-[#004080] hover:text-[#003060]"
                >
                  <UserPlus className="h-3 w-3" />
                  Nuevo cliente
                </button>
              ) : null}
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
              onChange={(event) => {
                setPaymentMethod(event.target.value);
                setSriPaymentCode(defaultSriCode(event.target.value));
              }}
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

          {/* Sale output mode + tooltip */}
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Label className="text-sm font-medium text-slate-900">Comprobante</Label>
              <div className="relative">
                <button
                  type="button"
                  onMouseEnter={showTip}
                  onMouseLeave={hideTip}
                  onFocus={showTip}
                  onBlur={hideTip}
                  onClick={handleTipClick}
                  className="flex h-5 w-5 items-center justify-center rounded-full border border-slate-200 text-[10px] text-slate-400 hover:border-slate-300 hover:text-slate-600"
                  aria-label="Información sobre tipos de comprobante"
                >
                  ?
                </button>
                {showComprobanteTip && (
                  <div className="absolute bottom-full left-0 z-50 mb-2 w-72 rounded-xl border border-slate-200 bg-white p-3 shadow-lg space-y-1.5">
                    <div
                      className="absolute -bottom-1.5 left-2 h-3 w-3 rotate-45 border-b border-r border-slate-200 bg-white"
                      aria-hidden
                    />
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">Recibo interno: </span>
                      Registra la venta, descuenta inventario y genera un recibo operativo sin enviarlo al SRI.
                    </p>
                    <p className="text-xs text-slate-600">
                      <span className="font-medium text-slate-800">Factura SRI: </span>
                      Registra la venta, descuenta inventario y emite una factura electrónica autorizada por el SRI.
                    </p>
                  </div>
                )}
              </div>
            </div>

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
                <Link
                  href={routes.sri}
                  className="underline text-[#004080] hover:text-[#003060]"
                >
                  configura el módulo SRI
                </Link>
                .
              </p>
            )}

            {outputMode === "sri_invoice" && !hasSriConfig && (
              <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-800">
                  <AlertCircle className="h-3 w-3 shrink-0" />
                  Falta completar la configuración SRI.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="border-amber-300 text-amber-800 hover:bg-amber-100"
                  >
                    <Link href={routes.sri}>Completar SRI</Link>
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOutputMode("internal_receipt")}
                  >
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

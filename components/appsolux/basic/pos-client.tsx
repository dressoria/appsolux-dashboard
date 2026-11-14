"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Minus,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

import { BillingWarehouseSelector } from "@/components/appsolux/billing/billing-warehouse-selector";
import { SimpleReceipt } from "@/components/appsolux/basic/simple-receipt";
import { SaleStatusBadge } from "@/components/appsolux/basic/sales-ui";
import {
  PaymentModal,
  MultiplePaymentModal,
  type TreasuryAccountOption,
  type PaymentEntry,
} from "@/components/appsolux/sales/payment-modal";
import { COMMERCIAL_LABELS } from "@/lib/core/payment-method-labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import {
  defaultSriPaymentCode,
  fiscalSelection,
} from "@/lib/core/pos-checkout";

// ── SRI payment codes ──────────────────────────────────────────────────────────
const SRI_PAYMENT_OPTIONS = [
  { code: "01", label: "Sin utilización del sistema financiero (efectivo)" },
  { code: "16", label: "Tarjeta de débito" },
  { code: "17", label: "Dinero electrónico" },
  { code: "18", label: "Tarjeta prepago" },
  { code: "19", label: "Tarjeta de crédito" },
  { code: "20", label: "Otros con utilización del sistema financiero" },
  { code: "21", label: "Endoso de títulos" },
] as const;

const CORE_PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "check", label: "Cheque" },
  { value: "deposit", label: "Depósito" },
  { value: "transfer", label: "Transferencia" },
  { value: "debit_card", label: "Débito" },
  { value: "credit_card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
  { value: "multiple", label: "Múltiple" },
] as const;

const ERP_PAYMENT_METHODS = [
  { value: "cash", label: "Efectivo" },
  { value: "transfer", label: "Transferencia" },
  { value: "card", label: "Tarjeta" },
  { value: "credit", label: "Crédito" },
] as const;

// ── Types ──────────────────────────────────────────────────────────────────────
type Product = {
  id: string;
  name: string;
  price: string;
  stock: number;
  barcode?: string | null;
  primaryCode?: string | null;
  auxiliaryCode?: string | null;
  description?: string | null;
  taxRate: string;
  warehouseStock?: Record<string, number>;
};

type Customer = {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  identification?: string | null;
  tradeName?: string | null;
  customerType?: string | null;
};

type EstablishmentOption = { id: string; code: string; name: string };
type IssuePointOption = { id: string; code: string; name: string; establishmentId: string };
type WarehouseOption = { name: string; label?: string | null };

type ProductSnapshot = {
  name: string;
  price: number;
  taxRate: number;
  stock: number;
  primaryCode: string | null;
  barcode: string | null;
};

type CartItem = {
  productId: string;
  quantity: number;
  discountAmount: number;
  snapshot: ProductSnapshot;
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
    flowState: string;
    flowLabel: string;
    message: string;
    documentStatus: string;
  };
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function productInitials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function makeSnapshot(product: Product, availableStock: number): ProductSnapshot {
  return {
    name: product.name,
    price: toNumber(product.price),
    taxRate: toNumber(product.taxRate),
    stock: availableStock,
    primaryCode: product.primaryCode ?? null,
    barcode: product.barcode ?? null,
  };
}

function calcLine(item: CartItem) {
  const { price, taxRate } = item.snapshot;
  const gross = price * item.quantity;
  const discount = Math.max(0, Math.min(item.discountAmount, gross));
  const sub = gross - discount;
  const tax = Math.round(sub * taxRate) / 100;
  return { gross, discount, subtotal: sub, tax, total: sub + tax, taxRate };
}

// ── Component ──────────────────────────────────────────────────────────────────
export function BasicPosClient({
  tenantName,
  tenantId = "",
  userId = "",
  currentUserName,
  products,
  customers: initialCustomers,
  initialCustomerId,
  hasSriConfig = false,
  saleEndpoint = "/api/basic/sales",
  engine = "CORE",
  warehouses = [],
  initialWarehouseName = "",
  establishments = [],
  issuePoints = [],
}: {
  tenantName: string;
  tenantId?: string;
  userId?: string;
  currentUserName?: string;
  products: Product[];
  customers: Customer[];
  initialCustomerId?: string;
  hasSriConfig?: boolean;
  saleEndpoint?: string;
  engine?: "CORE" | "SHARED_ERP";
  warehouses?: WarehouseOption[];
  initialWarehouseName?: string;
  establishments?: EstablishmentOption[];
  issuePoints?: IssuePointOption[];
}) {
  const router = useRouter();
  const useServerPagination = engine === "CORE";

  // ── Core state ─────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? "");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [outputMode, setOutputMode] = useState<"internal_receipt" | "sri_invoice">("internal_receipt");
  const [paidAmount, setPaidAmount] = useState("");
  const paidAmountManual = useRef(false);
  const [search, setSearch] = useState("");
  const [lastSale, setLastSale] = useState<SaleResponse | null>(null);
  const [lastOutput, setLastOutput] = useState<SaleOutputResult | null>(null);
  const [error, setError] = useState("");
  const [revalWarnings, setRevalWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);

  // ── Customer state ─────────────────────────────────────────────────────────
  const [customers, setCustomers] = useState<Customer[]>(initialCustomers);
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [customerEditing, setCustomerEditing] = useState(false);
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // ── New customer ───────────────────────────────────────────────────────────
  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerEmail, setNewCustomerEmail] = useState("");
  const [newCustomerAddr, setNewCustomerAddr] = useState("");
  const [newCustomerLoading, setNewCustomerLoading] = useState(false);
  const [newCustomerError, setNewCustomerError] = useState("");

  // ── Cart state ─────────────────────────────────────────────────────────────
  const [cartInputs, setCartInputs] = useState<Record<string, string>>({});
  const [discountInputs, setDiscountInputs] = useState<Record<string, string>>({});
  const [discountPctInputs, setDiscountPctInputs] = useState<Record<string, string>>({});
  const [lineNotes, setLineNotes] = useState<Record<string, string>>({});
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [clearCartConfirm, setClearCartConfirm] = useState(false);

  // ── SRI state ──────────────────────────────────────────────────────────────
  const [establishmentId, setEstablishmentId] = useState(establishments[0]?.id ?? "");
  const availableIssuePoints = issuePoints.filter((ip) => ip.establishmentId === establishmentId);
  const [issuePointId, setIssuePointId] = useState(availableIssuePoints[0]?.id ?? "");
  const [sriPaymentCode, setSriPaymentCode] = useState("01");
  const [sriFieldsOpen, setSriFieldsOpen] = useState(false);

  // ── Treasury / payment (CORE) ──────────────────────────────────────────────
  const [treasuryAccounts, setTreasuryAccounts] = useState<TreasuryAccountOption[]>([]);
  const [payments, setPayments] = useState<PaymentEntry[]>([]);
  const [showPaymentModal, setShowPaymentModal] = useState<string | null>(null);
  const [showMultiplePaymentModal, setShowMultiplePaymentModal] = useState(false);

  // ── Server pagination (CORE) ───────────────────────────────────────────────
  const [serverProducts, setServerProducts] = useState<Product[]>([]);
  const [productPage, setProductPage] = useState(1);
  const [productPerPage, setProductPerPage] = useState(12);
  const [productTotal, setProductTotal] = useState(0);
  const [productTotalPages, setProductTotalPages] = useState(1);
  const [availability, setAvailability] = useState<"available" | "all" | "out_of_stock">("available");
  const [productLoading, setProductLoading] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Warehouse (SHARED_ERP) ─────────────────────────────────────────────────
  const [selectedWarehouse, setSelectedWarehouse] = useState(initialWarehouseName);

  // ── Refs ────────────────────────────────────────────────────────────────────
  const hydrated = useRef(false);
  const submittingRef = useRef(false);
  const cartProductCache = useRef(new Map<string, Product>());

  // Seed cache with initial products
  for (const p of products) cartProductCache.current.set(p.id, p);

  const cartStorageKey = tenantId && userId ? `pos_cart_${tenantId}_${userId}` : "";

  // ── Cart persistence: load ─────────────────────────────────────────────────
  useEffect(() => {
    if (!cartStorageKey) { hydrated.current = true; return; }
    try {
      const raw = localStorage.getItem(cartStorageKey);
      if (!raw) { hydrated.current = true; return; }
      const saved = JSON.parse(raw) as {
        cart?: CartItem[];
        customerId?: string;
        cartInputs?: Record<string, string>;
        discountInputs?: Record<string, string>;
        discountPctInputs?: Record<string, string>;
        lineNotes?: Record<string, string>;
        paymentMethod?: string;
        outputMode?: string;
      };
      if (saved.cart?.length) {
        const validCart = saved.cart.filter((item) => {
          if (item.snapshot) return true;
          const cached = cartProductCache.current.get(item.productId);
          if (cached) {
            (item as CartItem).snapshot = makeSnapshot(cached, cached.stock);
            return true;
          }
          return false;
        });
        if (validCart.length) {
          setCart(validCart);
          if (saved.cartInputs) setCartInputs(saved.cartInputs);
          if (saved.discountInputs) setDiscountInputs(saved.discountInputs);
          if (saved.discountPctInputs) setDiscountPctInputs(saved.discountPctInputs);
          if (saved.lineNotes) setLineNotes(saved.lineNotes);
        }
        if (saved.customerId) setCustomerId(saved.customerId);
        if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
        if (saved.outputMode === "internal_receipt" || saved.outputMode === "sri_invoice") setOutputMode(saved.outputMode);
      }
    } catch { /* ignore */ }
    hydrated.current = true;
  }, [cartStorageKey]);

  // ── Cart persistence: save ─────────────────────────────────────────────────
  useEffect(() => {
    if (!cartStorageKey || !hydrated.current) return;
    try {
      if (cart.length === 0) {
        localStorage.removeItem(cartStorageKey);
      } else {
        localStorage.setItem(cartStorageKey, JSON.stringify({
          cart, customerId, cartInputs, discountInputs, discountPctInputs, lineNotes,
          paymentMethod, outputMode,
        }));
      }
    } catch { /* ignore */ }
  }, [cartStorageKey, cart, customerId, cartInputs, discountInputs, discountPctInputs, lineNotes, paymentMethod, outputMode]);

  // ── Fetch products (CORE) ──────────────────────────────────────────────────
  const fetchProducts = useRef(async (q: string, pg: number, pp: number, avail: string) => {
    if (!useServerPagination) return;
    setProductLoading(true);
    try {
      const params = new URLSearchParams({ q, page: String(pg), perPage: String(pp), availability: avail });
      const res = await fetch(`/api/facturacion/pos/products?${params}`);
      const data = await res.json();
      if (data.ok) {
        setServerProducts(data.products);
        setProductTotal(data.total);
        setProductTotalPages(data.totalPages);
        setProductPage(data.page);
        for (const p of data.products) cartProductCache.current.set(p.id, p);
      }
    } finally {
      setProductLoading(false);
    }
  }).current;

  useEffect(() => {
    fetchProducts(search, productPage, productPerPage, availability);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productPage, productPerPage, availability]);

  useEffect(() => {
    if (!useServerPagination) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setProductPage(1);
      fetchProducts(search, 1, productPerPage, availability);
    }, 300);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // ── Treasury accounts (CORE) ───────────────────────────────────────────────
  useEffect(() => {
    if (engine !== "CORE") return;
    fetch("/api/facturacion/payment-options")
      .then((r) => r.json())
      .then((data) => { if (data.ok) setTreasuryAccounts(data.accounts); })
      .catch(() => {});
  }, [engine]);

  // ── Customer dropdown click-outside ────────────────────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setCustomerDropdownOpen(false);
        setCustomerEditing(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // ── Warehouse default ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!warehouses.length) return;
    if (selectedWarehouse && warehouses.some((w) => w.name === selectedWarehouse)) return;
    setSelectedWarehouse(initialWarehouseName || warehouses[0]?.name || "");
  }, [initialWarehouseName, selectedWarehouse, warehouses]);

  // ── Auto-update paid amount ────────────────────────────────────────────────
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
    { subtotal: 0, taxTotal: 0, discountTotal: 0, total: 0 },
  );

  useEffect(() => {
    if (!paidAmountManual.current && paymentMethod !== "credit") {
      setPaidAmount(cartTotals.total > 0 ? cartTotals.total.toFixed(2) : "");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartTotals.total, paymentMethod]);

  const subtotalByRate = cart.reduce(
    (acc, item) => {
      const line = calcLine(item);
      acc[line.taxRate] = (acc[line.taxRate] ?? 0) + line.subtotal;
      return acc;
    },
    {} as Record<number, number>,
  );

  // ── Derived values ─────────────────────────────────────────────────────────
  const displayProducts = useServerPagination ? serverProducts : products;
  const filteredProducts = useServerPagination
    ? serverProducts
    : products.filter((p) => {
        const term = search.trim().toLowerCase();
        if (!term) return true;
        return p.name.toLowerCase().includes(term) ||
          (p.barcode ?? "").toLowerCase().includes(term) ||
          (p.primaryCode ?? "").toLowerCase().includes(term) ||
          (p.auxiliaryCode ?? "").toLowerCase().includes(term) ||
          (p.description ?? "").toLowerCase().includes(term);
      });

  const customerMatches = customerSearch.trim()
    ? customers.filter((c) =>
        [c.identification, c.name, c.tradeName, c.email].some((v) =>
          v?.toLowerCase().includes(customerSearch.toLowerCase()),
        ),
      ).slice(0, 8)
    : [];

  const selectedCustomer = customers.find((c) => c.id === customerId);
  const creditWithoutCustomer = paymentMethod === "credit" && !customerId;
  const paidNum = paidAmount ? Number(paidAmount) : paymentMethod === "credit" ? 0 : cartTotals.total;
  const saldo = paymentMethod === "credit" ? cartTotals.total : Math.max(0, cartTotals.total - paidNum);
  const vuelto = paymentMethod !== "credit" && paidNum > cartTotals.total ? paidNum - cartTotals.total : 0;
  const hasIva = cartTotals.taxTotal > 0;
  const hasDiscount = cartTotals.discountTotal > 0;
  const cartItemMap = new Map(cart.map((item) => [item.productId, item]));

  function getAvailableStock(product: Product) {
    if (engine !== "SHARED_ERP") return product.stock;
    if (!selectedWarehouse) return product.stock;
    return Math.max(0, product.warehouseStock?.[selectedWarehouse] ?? 0);
  }

  // ── Cart actions ───────────────────────────────────────────────────────────
  function addProduct(productId: string) {
    setError("");
    setRevalWarnings([]);
    const product = cartProductCache.current.get(productId) ??
      displayProducts.find((p) => p.id === productId);
    if (!product) return;
    const availableStock = getAvailableStock(product);
    if (availableStock <= 0) return;

    setCart((current) => {
      const existing = current.find((item) => item.productId === productId);
      if (existing) {
        if (existing.quantity >= availableStock) {
          setError(`Stock insuficiente para ${product.name}.`);
          return current;
        }
        const newQty = existing.quantity + 1;
        setCartInputs((prev) => ({ ...prev, [productId]: String(newQty) }));
        const gross = existing.snapshot.price * newQty;
        const pct = gross > 0 ? (existing.discountAmount / gross) * 100 : 0;
        setDiscountPctInputs((prev) => ({ ...prev, [productId]: pct.toFixed(1) }));
        return current.map((item) =>
          item.productId === productId ? { ...item, quantity: newQty } : item,
        );
      }
      setCartInputs((prev) => ({ ...prev, [productId]: "1" }));
      setDiscountInputs((prev) => ({ ...prev, [productId]: "0" }));
      setDiscountPctInputs((prev) => ({ ...prev, [productId]: "0.0" }));
      return [...current, {
        productId,
        quantity: 1,
        discountAmount: 0,
        snapshot: makeSnapshot(product, availableStock),
      }];
    });
  }

  function commitQuantity(productId: string) {
    const raw = cartInputs[productId] ?? "";
    const parsed = parseInt(raw, 10);
    const item = cart.find((i) => i.productId === productId);
    const maxStock = item?.snapshot.stock ?? parsed;
    const safe = !Number.isFinite(parsed) || parsed < 1 ? 1 : Math.min(parsed, maxStock);
    setCartInputs((prev) => ({ ...prev, [productId]: String(safe) }));
    setCart((current) => {
      const updated = current.map((ci) =>
        ci.productId === productId ? { ...ci, quantity: safe } : ci,
      );
      const cartItem = updated.find((ci) => ci.productId === productId);
      if (cartItem) {
        const gross = cartItem.snapshot.price * safe;
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
    const item = cart.find((i) => i.productId === productId);
    const maxDiscount = item ? item.snapshot.price * item.quantity : safe;
    const clamped = Math.min(safe, maxDiscount);
    setDiscountInputs((prev) => ({ ...prev, [productId]: clamped.toFixed(2) }));
    if (item) {
      const gross = item.snapshot.price * item.quantity;
      const pct = gross > 0 ? (clamped / gross) * 100 : 0;
      setDiscountPctInputs((prev) => ({ ...prev, [productId]: pct.toFixed(1) }));
    }
    setCart((current) =>
      current.map((ci) => ci.productId === productId ? { ...ci, discountAmount: clamped } : ci),
    );
  }

  function commitDiscountPct(productId: string) {
    const raw = discountPctInputs[productId] ?? "0";
    const pct = parseFloat(raw);
    const safePct = !Number.isFinite(pct) || pct < 0 ? 0 : Math.min(pct, 100);
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;
    const gross = item.snapshot.price * item.quantity;
    const discountAmt = Math.round(gross * safePct) / 100;
    setDiscountPctInputs((prev) => ({ ...prev, [productId]: safePct.toFixed(1) }));
    setDiscountInputs((prev) => ({ ...prev, [productId]: discountAmt.toFixed(2) }));
    setCart((current) =>
      current.map((ci) => ci.productId === productId ? { ...ci, discountAmount: discountAmt } : ci),
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) => current.filter((ci) => ci.productId !== productId));
    setCartInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setDiscountInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setDiscountPctInputs((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    setLineNotes((prev) => { const n = { ...prev }; delete n[productId]; return n; });
    if (editingProductId === productId) setEditingProductId(null);
  }

  function clearCart() {
    setCart([]);
    setCartInputs({});
    setDiscountInputs({});
    setDiscountPctInputs({});
    setLineNotes({});
    setEditingProductId(null);
    setClearCartConfirm(false);
  }

  // ── Payment handling ───────────────────────────────────────────────────────
  function handlePaymentMethodChange(method: string) {
    setPaymentMethod(method);
    setSriPaymentCode(defaultSriPaymentCode(method));
    setPayments([]);
    paidAmountManual.current = false;
    setPaidAmount("");

    if (engine === "CORE" && method !== "credit") {
      if (method === "multiple") {
        setShowMultiplePaymentModal(true);
      } else {
        setShowPaymentModal(method);
      }
    }
  }

  function handlePaymentSave(entry: PaymentEntry) {
    setPayments([entry]);
    setShowPaymentModal(null);
    if (entry.amount > 0) {
      setPaidAmount(entry.amount.toFixed(2));
      paidAmountManual.current = true;
    }
  }

  function handleMultiplePaymentSave(entries: PaymentEntry[]) {
    setPayments(entries);
    setShowMultiplePaymentModal(false);
    const total = entries.reduce((s, p) => s + p.amount, 0);
    if (total > 0) {
      setPaidAmount(total.toFixed(2));
      paidAmountManual.current = true;
    }
  }

  function buildPaymentsPayload() {
    if (engine !== "CORE" || payments.length === 0) return undefined;
    return payments.map((p) => ({
      method: p.method,
      amount: p.amount,
      treasuryAccountId: p.accountId || undefined,
      referenceNumber: p.referenceNumber || undefined,
      batchNumber: p.batchNumber || undefined,
      voucherNumber: p.voucherNumber || undefined,
      dueDate: p.dueDate || undefined,
    }));
  }

  // ── Submit sale ────────────────────────────────────────────────────────────
  async function submitSale() {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsLoading(true);
    setError("");
    setRevalWarnings([]);

    try {
      if (creditWithoutCustomer) {
        throw new Error("Para vender a crédito debes seleccionar o crear un cliente.");
      }

      // Pre-sale revalidation (CORE)
      if (engine === "CORE" && cart.length > 0) {
        const ids = cart.map((i) => i.productId).join(",");
        const revalRes = await fetch(`/api/facturacion/pos/products?ids=${encodeURIComponent(ids)}&availability=all`);
        const revalData = await revalRes.json();
        if (revalData.ok) {
          const freshMap = new Map<string, Product>(revalData.products.map((p: Product) => [p.id, p]));
          const warnings: string[] = [];
          for (const item of cart) {
            const fresh = freshMap.get(item.productId);
            if (!fresh) {
              warnings.push(`"${item.snapshot.name}" ya no existe o fue desactivado.`);
              continue;
            }
            const freshPrice = toNumber(fresh.price);
            if (Math.abs(freshPrice - item.snapshot.price) > 0.005) {
              warnings.push(`"${item.snapshot.name}": precio cambió de ${money(item.snapshot.price)} a ${money(freshPrice)}.`);
            }
            if (fresh.stock < item.quantity) {
              warnings.push(`"${item.snapshot.name}": stock insuficiente (disponible: ${fresh.stock}, en carrito: ${item.quantity}).`);
            }
          }
          if (warnings.length > 0) {
            setRevalWarnings(warnings);
            setIsLoading(false);
            submittingRef.current = false;
            return;
          }
        }
      }

      // Stock check for SHARED_ERP
      if (engine === "SHARED_ERP") {
        for (const item of cart) {
          if (item.quantity > item.snapshot.stock) {
            throw new Error(`Stock insuficiente para ${item.snapshot.name}.`);
          }
        }
      }

      const body: Record<string, unknown> = {
        customerId: customerId || undefined,
        paymentMethod: paymentMethod === "multiple" ? "cash" : paymentMethod,
        paidAmount: paymentMethod === "credit" ? 0 : paidNum,
        outputMode,
        sriPaymentCode,
        ...fiscalSelection(outputMode, establishmentId, issuePointId),
        warehouseName: selectedWarehouse || undefined,
        items: cart.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          discountAmount: item.discountAmount,
        })),
      };

      const paymentsPayload = buildPaymentsPayload();
      if (paymentsPayload) body.payments = paymentsPayload;

      const response = await fetch(saleEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
      setPayments([]);
      setShowReceipt(false);
      setEditingProductId(null);
      paidAmountManual.current = false;
      setLastSale(result.sale ?? null);
      setLastOutput(result.output ?? null);
      router.refresh();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "No se pudo confirmar venta.");
    } finally {
      setIsLoading(false);
      submittingRef.current = false;
    }
  }

  // ── New customer ───────────────────────────────────────────────────────────
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
      const result = (await response.json()) as { ok?: boolean; message?: string; customer?: Customer };
      if (!response.ok || !result.ok) throw new Error(result.message ?? "No se pudo crear cliente.");
      if (result.customer) {
        setCustomers((prev) => [...prev, result.customer!]);
        setCustomerId(result.customer.id);
        setCustomerEditing(false);
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
    setEditingProductId(null);
    setError("");
    setRevalWarnings([]);
    paidAmountManual.current = false;
  }

  const submitLabel = outputMode === "sri_invoice" ? "COBRAR Y EMITIR FACTURA" : "COBRAR Y FINALIZAR";
  const canSubmit = !isLoading && cart.length > 0 && !creditWithoutCustomer &&
    !(outputMode === "sri_invoice" && !hasSriConfig);

  // ── RENDER ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── New customer modal ──────────────────────────────────────────────── */}
      {showNewCustomer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Nuevo cliente</h3>
              <button type="button" onClick={() => setShowNewCustomer(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleNewCustomer} className="space-y-3">
              <div className="space-y-1.5">
                <Label htmlFor="nc-name">Nombre / Razón social</Label>
                <Input id="nc-name" value={newCustomerName} onChange={(e) => setNewCustomerName(e.target.value)} placeholder="Ej. Juan Pérez" required disabled={newCustomerLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-phone">Teléfono</Label>
                <Input id="nc-phone" value={newCustomerPhone} onChange={(e) => setNewCustomerPhone(e.target.value)} placeholder="0999000000" disabled={newCustomerLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-email">Email</Label>
                <Input id="nc-email" type="email" value={newCustomerEmail} onChange={(e) => setNewCustomerEmail(e.target.value)} placeholder="correo@ejemplo.com" disabled={newCustomerLoading} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="nc-addr">Dirección</Label>
                <Input id="nc-addr" value={newCustomerAddr} onChange={(e) => setNewCustomerAddr(e.target.value)} placeholder="Opcional" disabled={newCustomerLoading} />
              </div>
              {newCustomerError && <p className="text-sm text-destructive">{newCustomerError}</p>}
              <div className="flex gap-2 pt-1">
                <Button type="submit" disabled={newCustomerLoading} className="flex-1 bg-[#1E52F1] hover:bg-[#1E52F1]/90">{newCustomerLoading ? "Guardando..." : "Crear cliente"}</Button>
                <Button type="button" variant="outline" onClick={() => setShowNewCustomer(false)}>Cancelar</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Payment config modals (CORE) ───────────────────────────────────── */}
      {showPaymentModal && engine === "CORE" && (
        <PaymentModal
          method={showPaymentModal}
          accounts={treasuryAccounts}
          invoiceTotal={cartTotals.total}
          pendingAmount={cartTotals.total}
          customerName={selectedCustomer?.name ?? null}
          hasCustomer={!!customerId}
          onSave={handlePaymentSave}
          onClose={() => setShowPaymentModal(null)}
        />
      )}
      {showMultiplePaymentModal && engine === "CORE" && (
        <MultiplePaymentModal
          accounts={treasuryAccounts}
          invoiceTotal={cartTotals.total}
          customerName={selectedCustomer?.name ?? null}
          hasCustomer={!!customerId}
          initialPayments={payments}
          onSave={handleMultiplePaymentSave}
          onClose={() => setShowMultiplePaymentModal(false)}
        />
      )}

      {/* ── Success strip ──────────────────────────────────────────────────── */}
      {lastOutput && lastSale ? (
        <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-800">
                {lastOutput.mode === "sri_invoice"
                  ? lastOutput.status === "partial" ? "Venta creada · Factura SRI con observaciones" : "Venta finalizada · Factura SRI iniciada"
                  : "Venta finalizada · Recibo interno listo"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {lastOutput.mode === "internal_receipt" && (
                <Button size="sm" variant="outline" onClick={() => setShowReceipt((v) => !v)}>
                  {showReceipt ? "Ocultar recibo" : "Ver recibo"}
                </Button>
              )}
              {lastOutput.mode === "sri_invoice" && lastOutput.sri?.documentId && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/sri/documents/${lastOutput.sri.documentId}`}>Ver factura SRI</Link>
                </Button>
              )}
              {engine === "CORE" && (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/basic/sales/${lastSale.id}`}>Ver venta</Link>
                </Button>
              )}
              <Button size="sm" className="bg-[#1E52F1] hover:bg-[#1E52F1]/90" onClick={startNewSale}>Nueva venta</Button>
            </div>
          </div>
          {lastOutput.mode === "sri_invoice" && lastOutput.status === "partial" && lastOutput.errorMessage && (
            <p className="text-xs text-amber-700">{lastOutput.errorMessage}</p>
          )}
          {showReceipt && lastOutput.mode === "internal_receipt" && (
            <div className="pt-1"><SimpleReceipt tenantName={tenantName} sale={lastSale} /></div>
          )}
        </div>
      ) : null}

      {/* ── Warehouse selector (SHARED_ERP) ────────────────────────────────── */}
      {engine === "SHARED_ERP" && (
        <BillingWarehouseSelector warehouses={warehouses} selectedWarehouse={selectedWarehouse} preferredWarehouse={initialWarehouseName} onChange={setSelectedWarehouse} disabled={isLoading} />
      )}

      {/* ── Establishment/Issue point bar ───────────────────────────────────── */}
      <div className="grid gap-3 rounded-2xl border bg-white p-3 text-sm sm:grid-cols-3">
        <label className="grid gap-1 text-xs text-slate-500">
          Establecimiento
          <select className="h-9 rounded-lg border px-2 text-sm" value={establishmentId} onChange={(e) => { setEstablishmentId(e.target.value); setIssuePointId(issuePoints.find((ip) => ip.establishmentId === e.target.value)?.id ?? ""); }}>
            <option value="">Sin configurar</option>
            {establishments.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 text-xs text-slate-500">
          Punto de emisión
          <select className="h-9 rounded-lg border px-2 text-sm" value={issuePointId} onChange={(e) => setIssuePointId(e.target.value)}>
            <option value="">Sin configurar</option>
            {availableIssuePoints.map((item) => <option key={item.id} value={item.id}>{item.code} · {item.name}</option>)}
          </select>
        </label>
        <div className="grid gap-1 text-xs text-slate-500">
          <span>Vendedor · Fecha</span>
          <span className="h-9 rounded-lg border px-3 py-2 text-sm text-slate-700">
            {currentUserName ?? "—"} · {new Date().toLocaleDateString("es-EC", { day: "2-digit", month: "short", year: "numeric" })}
          </span>
        </div>
      </div>

      {/* ── POS grid ───────────────────────────────────────────────────────── */}
      <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
        {/* ── Left: Product catalog ──────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <Label className="text-sm font-semibold text-slate-900">Productos</Label>
              <SaleStatusBadge label={useServerPagination ? `${productTotal} productos` : `${filteredProducts.length} disponibles`} variant="info" />
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o código" className="rounded-xl border-slate-200 bg-white pl-10" />
            </div>
            {useServerPagination && (
              <div className="flex flex-wrap items-center gap-2">
                {(["available", "all", "out_of_stock"] as const).map((av) => (
                  <button key={av} type="button" onClick={() => { setAvailability(av); setProductPage(1); }}
                    className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition", availability === av ? "bg-[#1E52F1] text-white" : "border border-slate-200 text-slate-500 hover:border-slate-300")}>
                    {av === "available" ? "Disponibles" : av === "all" ? "Todos" : "Agotados"}
                  </button>
                ))}
                <select className="ml-auto h-7 rounded-lg border px-2 text-xs" value={productPerPage} onChange={(e) => { setProductPerPage(Number(e.target.value)); setProductPage(1); }}>
                  <option value={12}>12</option>
                  <option value={24}>24</option>
                  <option value={48}>48</option>
                </select>
              </div>
            )}
          </div>

          {/* Product grid */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
            {filteredProducts.map((product) => {
              const inCart = cartItemMap.get(product.id);
              const stock = getAvailableStock(product);
              const outOfStock = stock <= 0;
              return (
                <button
                  key={product.id}
                  type="button"
                  onClick={() => addProduct(product.id)}
                  disabled={isLoading || outOfStock}
                  title={product.name}
                  className={cn(
                    "relative flex flex-col items-center rounded-xl border bg-white p-3 text-center shadow-sm transition hover:shadow-md",
                    outOfStock ? "cursor-not-allowed border-slate-100 opacity-50" : "border-slate-200 hover:border-[#1E52F1]/40",
                    inCart && "ring-2 ring-[#1E52F1]/20",
                  )}
                >
                  {/* Price badge */}
                  <span className="absolute left-2 top-2 rounded-md bg-slate-100 px-1.5 py-0.5 text-xs font-bold text-slate-800">
                    {money(toNumber(product.price))}
                  </span>
                  {/* Qty badge */}
                  {inCart && (
                    <span className="absolute right-2 top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1E52F1] px-1 text-[10px] font-bold text-white">
                      {inCart.quantity}
                    </span>
                  )}
                  {/* Initials */}
                  <div className="mb-2 mt-5 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-lg font-bold text-slate-400">
                    {productInitials(product.name)}
                  </div>
                  {/* Name */}
                  <p className="w-full truncate text-sm font-medium text-slate-900">{product.name}</p>
                  {/* Code */}
                  <p className="w-full truncate text-xs font-mono text-slate-400">{product.primaryCode ?? product.barcode ?? "—"}</p>
                  {/* Stock */}
                  <p className={cn("mt-1 text-xs", outOfStock ? "font-medium text-red-500" : "text-slate-500")}>
                    {outOfStock ? "Agotado" : `Stock: ${stock}`}
                  </p>
                </button>
              );
            })}
          </div>

          {filteredProducts.length === 0 && (
            <p className="text-sm text-slate-500">{productLoading ? "Cargando productos..." : "No hay productos disponibles."}</p>
          )}

          {useServerPagination && productTotalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-slate-500">
              <span>Página {productPage} de {productTotalPages}</span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={productPage <= 1} onClick={() => setProductPage((p) => p - 1)}>←</Button>
                <Button variant="outline" size="sm" disabled={productPage >= productTotalPages} onClick={() => setProductPage((p) => p + 1)}>→</Button>
              </div>
            </div>
          )}
        </div>

        {/* ── Right: Cart + checkout sidebar ─────────────────────────────── */}
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">

          {/* §1 CARRITO ─────────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">Carrito</h3>
                {cart.length > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#1E52F1] px-1.5 text-[10px] font-bold text-white">{cart.length}</span>
                )}
              </div>
              {cart.length > 0 && (
                clearCartConfirm ? (
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-500">¿Vaciar?</span>
                    <button type="button" onClick={clearCart} className="font-medium text-red-600 hover:text-red-700">Sí</button>
                    <button type="button" onClick={() => setClearCartConfirm(false)} className="font-medium text-slate-500 hover:text-slate-700">No</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setClearCartConfirm(true)} className="text-xs text-slate-400 hover:text-red-500">Vaciar</button>
                )
              )}
            </div>

            {cart.length === 0 ? (
              <p className="py-6 text-center text-sm text-slate-400">Sin productos en el carrito</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {cart.map((item) => {
                  const line = calcLine(item);
                  const isEditing = editingProductId === item.productId;
                  return (
                    <div key={item.productId} className="py-2">
                      {/* Cart row */}
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-900" title={item.snapshot.name}>{item.snapshot.name}</p>
                          <p className="text-xs text-slate-500">
                            {item.quantity} × {money(item.snapshot.price)} = {money(line.total)}
                            {item.discountAmount > 0 && <span className="ml-1 text-red-500">-{money(line.discount)}</span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => setEditingProductId(isEditing ? null : item.productId)} className={cn("rounded-lg p-1.5 transition", isEditing ? "bg-[#1E52F1]/10 text-[#1E52F1]" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600")} title="Editar">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button type="button" onClick={() => removeFromCart(item.productId)} className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500" title="Eliminar">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      {/* Inline detail editor */}
                      {isEditing && (
                        <div className="mt-2 space-y-2 rounded-xl border border-[#1E52F1]/20 bg-slate-50 p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700">Cantidad</span>
                            <div className="flex items-center gap-1">
                              <button type="button" onClick={() => { const newQty = Math.max(1, item.quantity - 1); setCartInputs((p) => ({ ...p, [item.productId]: String(newQty) })); setCart((c) => c.map((ci) => ci.productId === item.productId ? { ...ci, quantity: newQty } : ci)); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border text-slate-600 hover:bg-white"><Minus className="h-3 w-3" /></button>
                              <Input type="number" min="1" max={item.snapshot.stock} value={cartInputs[item.productId] ?? String(item.quantity)}
                                onChange={(e) => setCartInputs((p) => ({ ...p, [item.productId]: e.target.value }))}
                                onBlur={() => commitQuantity(item.productId)}
                                className="h-7 w-14 text-center text-xs" />
                              <button type="button" onClick={() => { const newQty = Math.min(item.snapshot.stock, item.quantity + 1); setCartInputs((p) => ({ ...p, [item.productId]: String(newQty) })); setCart((c) => c.map((ci) => ci.productId === item.productId ? { ...ci, quantity: newQty } : ci)); }}
                                className="flex h-7 w-7 items-center justify-center rounded-lg border text-slate-600 hover:bg-white"><Plus className="h-3 w-3" /></button>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-slate-700">P. unitario</span>
                            <span className="text-xs text-slate-600">{money(item.snapshot.price)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="shrink-0 text-xs font-medium text-slate-700">Desc. %</span>
                            <Input type="number" min="0" max="100" step="0.1" value={discountPctInputs[item.productId] ?? "0.0"}
                              onChange={(e) => setDiscountPctInputs((p) => ({ ...p, [item.productId]: e.target.value }))}
                              onBlur={() => commitDiscountPct(item.productId)}
                              className="h-7 w-20 text-right text-xs" />
                            <span className="shrink-0 text-xs font-medium text-slate-700">$</span>
                            <Input type="number" min="0" step="0.01" value={discountInputs[item.productId] ?? "0.00"}
                              onChange={(e) => setDiscountInputs((p) => ({ ...p, [item.productId]: e.target.value }))}
                              onBlur={() => commitDiscount(item.productId)}
                              className="h-7 w-20 text-right text-xs" />
                          </div>
                          <div className="space-y-1">
                            <span className="text-xs font-medium text-slate-700">Observación</span>
                            <Input value={lineNotes[item.productId] ?? ""} onChange={(e) => setLineNotes((p) => ({ ...p, [item.productId]: e.target.value }))} placeholder="Ej. Entregar mañana" className="h-7 text-xs" />
                          </div>
                          <div className="flex items-center justify-between border-t border-slate-200 pt-2">
                            <span className="text-xs font-medium text-slate-700">Total línea</span>
                            <span className="text-sm font-bold text-slate-900">{money(line.total)}</span>
                          </div>
                          <button type="button" onClick={() => removeFromCart(item.productId)} className="flex w-full items-center justify-center gap-1 rounded-lg border border-red-200 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                            <Trash2 className="h-3 w-3" /> Eliminar del carrito
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Cart total */}
            {cart.length > 0 && (
              <div className="mt-2 flex items-center justify-between border-t border-slate-200 pt-2">
                <span className="text-sm font-medium text-slate-700">Total carrito</span>
                <span className="text-base font-bold text-slate-900">{money(cartTotals.total)}</span>
              </div>
            )}
          </div>

          {/* §2 CLIENTE ─────────────────────────────────────────────────── */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cliente</h3>
              <button type="button" onClick={() => setShowNewCustomer(true)} className="flex items-center gap-1 text-xs text-[#1E52F1] hover:text-[#1E52F1]/80">
                <UserPlus className="h-3 w-3" /> Nuevo
              </button>
            </div>
            <div className="relative" ref={customerDropdownRef}>
              {customerId && selectedCustomer && !customerEditing ? (
                <div className="flex h-9 items-center justify-between rounded-xl border border-slate-200 bg-white px-3">
                  <span className="truncate text-sm font-medium text-slate-900">{selectedCustomer.name}</span>
                  <button type="button" onClick={() => { setCustomerId(""); setCustomerEditing(false); }} className="ml-2 shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : customerEditing || customerDropdownOpen ? (
                <Input
                  autoFocus
                  value={customerSearch}
                  onChange={(e) => { setCustomerSearch(e.target.value); setCustomerDropdownOpen(true); }}
                  onKeyDown={(e) => { if (e.key === "Escape") { setCustomerDropdownOpen(false); setCustomerEditing(false); setCustomerSearch(""); } }}
                  placeholder="Buscar cliente..."
                  className="rounded-xl"
                />
              ) : (
                <button type="button" onClick={() => { setCustomerEditing(true); setCustomerDropdownOpen(true); }}
                  className="flex h-9 w-full items-center rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-500 hover:border-slate-300">
                  CONSUMIDOR FINAL
                </button>
              )}
              {customerDropdownOpen && customerMatches.length > 0 && (
                <div className="absolute z-20 mt-1 w-full rounded-xl border bg-white shadow-lg">
                  {customerMatches.map((c) => (
                    <button key={c.id} type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                      onClick={() => { setCustomerId(c.id); setCustomerSearch(""); setCustomerDropdownOpen(false); setCustomerEditing(false); }}>
                      <span className="font-medium">{c.name}</span>
                      {c.identification && <span className="ml-2 text-xs text-slate-400">{c.identification}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {outputMode === "sri_invoice" && customerId && selectedCustomer && !selectedCustomer.identification && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                <AlertCircle className="h-3 w-3 shrink-0" /> Sin identificación fiscal. Requerida para factura SRI.
              </p>
            )}
            {creditWithoutCustomer && (
              <p className="mt-1.5 flex items-center gap-1 text-xs text-amber-700">
                <AlertCircle className="h-3 w-3 shrink-0" /> Selecciona un cliente para vender a crédito.
              </p>
            )}
          </div>

          {/* §3 FORMA DE PAGO ───────────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Forma de pago</h3>
            {engine === "CORE" ? (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {CORE_PAYMENT_METHODS.map((m) => (
                    <button key={m.value} type="button" onClick={() => handlePaymentMethodChange(m.value)}
                      className={cn("rounded-lg px-2.5 py-1.5 text-xs font-medium transition",
                        paymentMethod === m.value ? "bg-[#1E52F1] text-white" : "border border-slate-200 text-slate-600 hover:border-slate-300")}>
                      {m.label}
                    </button>
                  ))}
                </div>
                {payments.length > 0 && (
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs">
                    {payments.map((p, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-slate-600">{COMMERCIAL_LABELS[p.method] ?? p.method}{p.accountName ? ` · ${p.accountName}` : ""}</span>
                        <span className="font-medium">{money(p.amount)}</span>
                      </div>
                    ))}
                    <button type="button" onClick={() => paymentMethod === "multiple" ? setShowMultiplePaymentModal(true) : setShowPaymentModal(paymentMethod)}
                      className="mt-1 text-[#1E52F1] hover:underline">Editar</button>
                  </div>
                )}
              </div>
            ) : (
              <select value={paymentMethod} onChange={(e) => handlePaymentMethodChange(e.target.value)}
                className="h-9 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                {ERP_PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            )}
          </div>

          {/* §4 MONTO PAGADO ────────────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Monto pagado</h3>
            {paymentMethod !== "credit" ? (
              <Input type="number" step="0.01" min="0" value={paidAmount} placeholder={cartTotals.total.toFixed(2)}
                onChange={(e) => { setPaidAmount(e.target.value); paidAmountManual.current = true; }}
                onBlur={() => { if (!paidAmount.trim()) paidAmountManual.current = false; }}
                className="rounded-xl" />
            ) : (
              <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
                El total quedará pendiente en el saldo del cliente.
              </p>
            )}
            <div className="mt-2 space-y-1 text-xs">
              <div className="flex justify-between text-slate-600"><span>Total</span><span className="font-medium">{money(cartTotals.total)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Pagado</span><span className="font-medium">{money(paidNum)}</span></div>
              {vuelto > 0 ? (
                <div className="flex justify-between font-medium text-emerald-700"><span>Vuelto</span><span>{money(vuelto)}</span></div>
              ) : saldo > 0 ? (
                <div className="flex justify-between font-medium text-amber-700"><span>Saldo pendiente</span><span>{money(saldo)}</span></div>
              ) : null}
            </div>
          </div>

          {/* §5 COMPROBANTE ─────────────────────────────────────────────── */}
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Comprobante</h3>
            <div className="flex rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button type="button" onClick={() => setOutputMode("internal_receipt")}
                className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                  outputMode === "internal_receipt" ? "bg-[#1E52F1] text-white shadow-sm" : "text-slate-500 hover:text-slate-700")}>
                <ReceiptText className="h-3.5 w-3.5" /> Recibo interno
              </button>
              <button type="button" onClick={() => hasSriConfig && setOutputMode("sri_invoice")} disabled={!hasSriConfig}
                className={cn("flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition",
                  outputMode === "sri_invoice" ? "bg-[#1E52F1] text-white shadow-sm" : hasSriConfig ? "text-slate-500 hover:text-slate-700" : "cursor-not-allowed text-slate-300")}>
                <FileCheck2 className="h-3.5 w-3.5" /> Factura SRI
              </button>
            </div>
            {!hasSriConfig && (
              <p className="mt-1.5 text-xs text-slate-500">
                Para emitir facturas SRI, <Link href={routes.sri} className="text-[#1E52F1] underline">configura el módulo SRI</Link>.
              </p>
            )}
          </div>

          {/* §6 SRI FIELDS (conditional) ────────────────────────────────── */}
          {outputMode === "sri_invoice" && (
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-3">
              <button type="button" onClick={() => setSriFieldsOpen((v) => !v)} className="flex w-full items-center justify-between text-xs font-semibold text-[#1E52F1]">
                Campos SRI
                {sriFieldsOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </button>
              {sriFieldsOpen && (
                <div className="mt-3 space-y-2">
                  <label className="block text-xs text-slate-600">
                    Forma de pago SRI
                    <select value={sriPaymentCode} onChange={(e) => setSriPaymentCode(e.target.value)} className="mt-1 h-8 w-full rounded-lg border px-2 text-xs">
                      {SRI_PAYMENT_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.code} – {o.label}</option>)}
                    </select>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* §7 RESUMEN ─────────────────────────────────────────────────── */}
          {cart.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs">
              <p className="mb-2 font-semibold uppercase tracking-wide text-slate-400">Resumen</p>
              {Object.entries(subtotalByRate).sort(([a], [b]) => Number(a) - Number(b)).map(([rate, base]) => (
                <div key={rate} className="flex justify-between text-slate-600">
                  <span>Base IVA {rate}%</span><span>{money(base)}</span>
                </div>
              ))}
              {hasDiscount && (
                <div className="flex justify-between text-slate-600"><span>Descuento</span><span className="text-red-600">-{money(cartTotals.discountTotal)}</span></div>
              )}
              {hasIva && (
                <div className="flex justify-between text-slate-600"><span>IVA</span><span>{money(cartTotals.taxTotal)}</span></div>
              )}
              <div className="mt-1.5 flex justify-between border-t border-slate-200 pt-1.5 font-semibold text-slate-900">
                <span>Total a cobrar</span><span className="text-base">{money(cartTotals.total)}</span>
              </div>
            </div>
          )}

          {/* §8 ERRORS / WARNINGS ───────────────────────────────────────── */}
          {revalWarnings.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              <p className="mb-1 font-semibold">Verificar antes de cobrar:</p>
              <ul className="list-inside list-disc space-y-0.5">
                {revalWarnings.map((w, i) => <li key={i}>{w}</li>)}
              </ul>
              <button type="button" onClick={() => setRevalWarnings([])} className="mt-2 text-[#1E52F1] hover:underline">Ignorar y continuar</button>
            </div>
          )}
          {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-destructive">{error}</p>}

          {/* §9 SUBMIT ──────────────────────────────────────────────────── */}
          <Button type="button" onClick={submitSale} disabled={!canSubmit}
            className="w-full bg-[#1E52F1] text-sm font-bold uppercase tracking-wide hover:bg-[#1E52F1]/90">
            {isLoading ? "Procesando..." : submitLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

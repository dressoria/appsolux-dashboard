"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import type { ApiResponse } from "@/types/api";
import type {
  ErpnextBin,
  ErpnextCompany,
  ErpnextCustomer,
  ErpnextItem,
  ErpnextModeOfPayment,
  ErpnextWarehouse,
  PosCartItem,
  PosCheckoutResult,
} from "@/types/erpnext";

type PosTenant = {
  id: string;
  name: string;
  slug: string;
};

type PosClientProps = {
  items: ErpnextItem[];
  inventory: ErpnextBin[];
  customers: ErpnextCustomer[];
  warehouses: ErpnextWarehouse[];
  companies: ErpnextCompany[];
  modesOfPayment: ErpnextModeOfPayment[];
  tenant: PosTenant;
};

type CreateSalesOrderResponse = ApiResponse<{
  sales_order: {
    name: string;
    customer: string;
    grand_total?: number;
    status?: string;
  };
}>;

type PosCheckoutResponse = ApiResponse<PosCheckoutResult>;

const selectClassName =
  "h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatQuantity(value: number) {
  return new Intl.NumberFormat("es-EC", {
    maximumFractionDigits: 2,
  }).format(value);
}

function getTotalStockByItem(inventory: ErpnextBin[]) {
  return inventory.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.item_code] =
      (accumulator[row.item_code] ?? 0) + (row.actual_qty ?? 0);

    return accumulator;
  }, {});
}

function getStockByItemAndWarehouse(inventory: ErpnextBin[]) {
  return inventory.reduce<Record<string, number>>((accumulator, row) => {
    const key = `${row.item_code}::${row.warehouse}`;
    accumulator[key] = (accumulator[key] ?? 0) + (row.actual_qty ?? 0);

    return accumulator;
  }, {});
}

export function PosClient({
  items,
  inventory,
  customers,
  warehouses,
  companies,
  modesOfPayment,
  tenant,
}: PosClientProps) {
  const router = useRouter();
  const usableWarehouses = warehouses.filter(
    (warehouse) => warehouse.disabled !== 1 && warehouse.is_group !== 1
  );
  const activeItems = items.filter((item) => item.disabled !== 1);
  const activeCustomers = customers.filter(
    (customer) => customer.disabled !== 1
  );
  const enabledModesOfPayment = modesOfPayment.filter(
    (modeOfPayment) =>
      modeOfPayment.enabled !== false && modeOfPayment.enabled !== 0
  );
  const [search, setSearch] = useState("");
  const [customer, setCustomer] = useState(
    activeCustomers.length === 1 ? activeCustomers[0]?.name ?? "" : ""
  );
  const [company, setCompany] = useState(
    companies.length === 1 ? companies[0]?.name ?? "" : ""
  );
  const [warehouse, setWarehouse] = useState(
    usableWarehouses.length === 1 ? usableWarehouses[0]?.name ?? "" : ""
  );
  const [modeOfPayment, setModeOfPayment] = useState(
    enabledModesOfPayment.length === 1
      ? enabledModesOfPayment[0]?.name ?? ""
      : ""
  );
  const [paidAmount, setPaidAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [note, setNote] = useState("");
  const [cart, setCart] = useState<PosCartItem[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [createdOrderName, setCreatedOrderName] = useState<string | null>(null);
  const [checkoutResult, setCheckoutResult] = useState<PosCheckoutResult | null>(
    null
  );
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const totalStockByItem = useMemo(
    () => getTotalStockByItem(inventory),
    [inventory]
  );
  const stockByItemAndWarehouse = useMemo(
    () => getStockByItemAndWarehouse(inventory),
    [inventory]
  );
  const visibleItems = activeItems.filter((item) => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return true;
    }

    return [item.item_name, item.item_code].some((value) =>
      value.toLowerCase().includes(query)
    );
  });
  const total = cart.reduce(
    (sum, item) => sum + item.qty * item.rate,
    0
  );
  const checkoutPaidAmount = paidAmount.trim() ? Number(paidAmount) : total;
  const canCreateOrder = Boolean(
    customer.trim() &&
      company.trim() &&
      warehouse.trim() &&
      cart.length > 0 &&
      cart.every((item) => item.qty > 0 && item.rate >= 0)
  );
  const canCheckout = Boolean(
    canCreateOrder &&
      modeOfPayment.trim() &&
      Number.isFinite(checkoutPaidAmount) &&
      checkoutPaidAmount > 0 &&
      enabledModesOfPayment.length > 0
  );

  function getWarehouseStock(itemCode: string) {
    if (!warehouse) {
      return null;
    }

    return stockByItemAndWarehouse[`${itemCode}::${warehouse}`] ?? 0;
  }

  function addToCart(item: ErpnextItem) {
    setMessage(null);
    setIsError(false);
    setCreatedOrderName(null);
    setCheckoutResult(null);
    setCart((currentCart) => {
      const existingItem = currentCart.find(
        (cartItem) => cartItem.item_code === item.item_code
      );

      if (existingItem) {
        return currentCart.map((cartItem) =>
          cartItem.item_code === item.item_code
            ? { ...cartItem, qty: cartItem.qty + 1 }
            : cartItem
        );
      }

      return [
        ...currentCart,
        {
          item_code: item.item_code,
          item_name: item.item_name,
          stock_uom: item.stock_uom,
          qty: 1,
          rate: 0,
        },
      ];
    });
  }

  function updateCartItem(
    itemCode: string,
    field: "qty" | "rate",
    value: number
  ) {
    setCart((currentCart) =>
      currentCart.map((item) =>
        item.item_code === itemCode ? { ...item, [field]: value } : item
      )
    );
  }

  function removeCartItem(itemCode: string) {
    setCart((currentCart) =>
      currentCart.filter((item) => item.item_code !== itemCode)
    );
  }

  async function handleCreateOrder() {
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    setCreatedOrderName(null);
    setCheckoutResult(null);

    try {
      const response = await fetch("/api/erpnext/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          company,
          warehouse,
          note,
          items: cart.map((item) => ({
            item_code: item.item_code,
            qty: item.qty,
            rate: item.rate,
            warehouse,
          })),
        }),
      });
      const result = (await response.json()) as CreateSalesOrderResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Pedido creado correctamente.");
      setCreatedOrderName(result.data.sales_order.name);
      setCart([]);
      setPaidAmount("");
      setReferenceNo("");
      setReferenceDate("");
      setNote("");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el pedido"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCheckout() {
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);
    setCreatedOrderName(null);
    setCheckoutResult(null);

    try {
      const response = await fetch("/api/erpnext/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer,
          company,
          warehouse,
          mode_of_payment: modeOfPayment,
          paid_amount: checkoutPaidAmount,
          note,
          reference_no: referenceNo,
          reference_date: referenceDate,
          items: cart.map((item) => ({
            item_code: item.item_code,
            qty: item.qty,
            rate: item.rate,
            warehouse,
          })),
        }),
      });
      const result = (await response.json()) as PosCheckoutResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Venta registrada correctamente.");
      setCheckoutResult(result.data);
      setCart([]);
      setPaidAmount("");
      setReferenceNo("");
      setReferenceDate("");
      setNote("");
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo finalizar la venta"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function startNewSale() {
    setMessage(null);
    setIsError(false);
    setCreatedOrderName(null);
    setCheckoutResult(null);
    setCart([]);
    setPaidAmount("");
    setReferenceNo("");
    setReferenceDate("");
    setNote("");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">Tenant: {tenant.name}</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            POS / Punto de venta
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Vende productos usando clientes, stock y bodegas reales conectados
            al ERP.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={routes.posOrders}>Ver pedidos POS</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.posInvoices}>Ver facturas y cobros</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.posPayments}>Caja y cobros</Link>
          </Button>
        </div>
      </div>

      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="space-y-1 p-4 text-sm text-blue-900">
          <p>
            Finalizar venta crea y confirma la factura, registra el pago y
            actualiza inventario automaticamente.
          </p>
          <p>Si aun no cobraste, guarda como pedido pendiente.</p>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(380px,0.65fr)]">
        <Card>
          <CardHeader>
            <CardTitle>Productos</CardTitle>
            <CardDescription>
              Busca productos reales y agregalos al carrito.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre o codigo"
            />

            {activeItems.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                No hay productos disponibles. Crea productos primero en ERP.
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {visibleItems.map((item) => {
                  const totalStock = totalStockByItem[item.item_code] ?? 0;
                  const warehouseStock = getWarehouseStock(item.item_code);
                  const showStockWarning =
                    item.is_stock_item !== 0 &&
                    warehouse &&
                    warehouseStock !== null &&
                    warehouseStock <= 0;

                  return (
                    <div
                      key={item.name}
                      className="rounded-xl border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">
                            {item.item_code}
                          </p>
                          <h3 className="font-medium">{item.item_name}</h3>
                          <p className="text-xs text-muted-foreground">
                            Unidad: {item.stock_uom ?? "-"}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => addToCart(item)}
                        >
                          Agregar
                        </Button>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                        <p>Stock total: {formatQuantity(totalStock)}</p>
                        {warehouse ? (
                          <p>
                            Stock en bodega seleccionada:{" "}
                            {formatQuantity(warehouseStock ?? 0)}
                          </p>
                        ) : null}
                        {item.is_stock_item !== 0 && totalStock <= 0 ? (
                          <p className="text-amber-700">
                            Sin stock disponible.
                          </p>
                        ) : null}
                        {showStockWarning ? (
                          <p className="text-amber-700">
                            Este producto no tiene stock disponible en la
                            bodega seleccionada.
                          </p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Caja</CardTitle>
            <CardDescription>
              Selecciona cliente, bodega, metodo de pago y revisa el carrito.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pos_customer">Cliente</Label>
              <select
                id="pos_customer"
                className={selectClassName}
                value={customer}
                onChange={(event) => setCustomer(event.target.value)}
                disabled={activeCustomers.length === 0}
              >
                <option value="">Selecciona un cliente</option>
                {activeCustomers.map((erpCustomer) => (
                  <option key={erpCustomer.name} value={erpCustomer.name}>
                    {erpCustomer.customer_name}
                  </option>
                ))}
              </select>
              {activeCustomers.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Crea un cliente primero para poder generar pedidos.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_company">Empresa</Label>
              <select
                id="pos_company"
                className={selectClassName}
                value={company}
                onChange={(event) => setCompany(event.target.value)}
                disabled={companies.length === 0}
              >
                <option value="">Selecciona una empresa</option>
                {companies.map((erpCompany) => (
                  <option key={erpCompany.name} value={erpCompany.name}>
                    {erpCompany.company_name ?? erpCompany.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_warehouse">Bodega / ubicacion de venta</Label>
              <select
                id="pos_warehouse"
                className={selectClassName}
                value={warehouse}
                onChange={(event) => setWarehouse(event.target.value)}
                disabled={usableWarehouses.length === 0}
              >
                <option value="">Selecciona una bodega</option>
                {usableWarehouses.map((erpWarehouse) => (
                  <option key={erpWarehouse.name} value={erpWarehouse.name}>
                    {erpWarehouse.warehouse_name}
                  </option>
                ))}
              </select>
              {usableWarehouses.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Configura una bodega utilizable antes de vender.
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_mode_of_payment">Metodo de pago</Label>
              <select
                id="pos_mode_of_payment"
                className={selectClassName}
                value={modeOfPayment}
                onChange={(event) => setModeOfPayment(event.target.value)}
                disabled={enabledModesOfPayment.length === 0}
              >
                <option value="">Selecciona un metodo</option>
                {enabledModesOfPayment.map((paymentMode) => (
                  <option key={paymentMode.name} value={paymentMode.name}>
                    {paymentMode.name}
                  </option>
                ))}
              </select>
              {enabledModesOfPayment.length === 0 ? (
                <p className="text-xs text-amber-700">
                  Primero configura metodos de pago para poder finalizar ventas.
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                Cada metodo de pago debe tener una cuenta de caja o banco
                configurada. Ejemplo: Efectivo a Caja general, Transferencia a
                Banco Pichincha.
              </p>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-medium">Carrito</h2>
                <span className="text-sm text-muted-foreground">
                  {cart.length} lineas
                </span>
              </div>

              {cart.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                  Agrega productos para crear el pedido.
                </div>
              ) : (
                <div className="space-y-3">
                  {cart.map((cartItem) => (
                    <div
                      key={cartItem.item_code}
                      className="rounded-lg border bg-background p-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium">{cartItem.item_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {cartItem.item_code}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => removeCartItem(cartItem.item_code)}
                        >
                          Quitar
                        </Button>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <Label htmlFor={`qty_${cartItem.item_code}`}>
                            Cantidad
                          </Label>
                          <Input
                            id={`qty_${cartItem.item_code}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={cartItem.qty}
                            onChange={(event) =>
                              updateCartItem(
                                cartItem.item_code,
                                "qty",
                                Number(event.target.value)
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label htmlFor={`rate_${cartItem.item_code}`}>
                            Precio unitario
                          </Label>
                          <Input
                            id={`rate_${cartItem.item_code}`}
                            type="number"
                            min="0"
                            step="0.01"
                            value={cartItem.rate}
                            onChange={(event) =>
                              updateCartItem(
                                cartItem.item_code,
                                "rate",
                                Number(event.target.value)
                              )
                            }
                          />
                        </div>
                      </div>
                      <p className="mt-2 text-right text-sm font-medium">
                        Subtotal: {formatMoney(cartItem.qty * cartItem.rate)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_note">Nota opcional</Label>
              <textarea
                id="pos_note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                className="min-h-20 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                placeholder="Ej. pedido tomado en tienda"
              />
            </div>

            <div className="rounded-xl border bg-muted/40 p-4">
              <div className="flex items-center justify-between text-lg font-semibold">
                <span>Total</span>
                <span>{formatMoney(total)}</span>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="pos_paid_amount">Monto recibido</Label>
                <Input
                  id="pos_paid_amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={paidAmount}
                  onChange={(event) => setPaidAmount(event.target.value)}
                  placeholder={total > 0 ? String(total) : "0.00"}
                />
                <p className="text-xs text-muted-foreground">
                  Si lo dejas vacio, se cobrara el total.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="pos_reference_date">Fecha referencia</Label>
                <Input
                  id="pos_reference_date"
                  type="date"
                  value={referenceDate}
                  onChange={(event) => setReferenceDate(event.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pos_reference_no">Referencia opcional</Label>
              <Input
                id="pos_reference_no"
                value={referenceNo}
                onChange={(event) => setReferenceNo(event.target.value)}
                placeholder="Ej. transferencia, voucher o numero de autorizacion"
              />
            </div>

            {message ? (
              <div
                className={
                  isError
                    ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                    : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
                }
              >
                <p>{message}</p>
                {isError && message.includes("Ajustes > Pagos") ? (
                  <Button asChild className="mt-2" size="sm" variant="outline">
                    <Link href={`${routes.settings}`}>Ir a Ajustes &gt; Pagos</Link>
                  </Button>
                ) : null}
                {createdOrderName ? (
                  <p className="mt-1 font-medium">Pedido: {createdOrderName}</p>
                ) : null}
                {checkoutResult ? (
                  <div className="mt-2 space-y-2">
                    <p className="font-medium">
                      Factura: {checkoutResult.invoice.name}
                    </p>
                    <p className="font-medium">
                      Pago: {checkoutResult.payment.name}
                    </p>
                    <p>
                      Total cobrado:{" "}
                      {formatMoney(checkoutResult.payment.paid_amount ?? 0)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={`${routes.posInvoices}/${encodeURIComponent(
                            checkoutResult.invoice.name
                          )}`}
                        >
                          Ver factura
                        </Link>
                      </Button>
                      <Button type="button" size="sm" onClick={startNewSale}>
                        Nueva venta
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                className="w-full"
                disabled={!canCheckout || isSubmitting}
                onClick={handleCheckout}
              >
                {isSubmitting ? "Finalizando..." : "Finalizar venta"}
              </Button>
              <Button
                type="button"
                className="w-full"
                variant="outline"
                disabled={!canCreateOrder || isSubmitting}
                onClick={handleCreateOrder}
              >
                {isSubmitting ? "Guardando..." : "Guardar como pedido pendiente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

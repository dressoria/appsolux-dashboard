"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import {
  formatPriceChannelNote,
  priceChannelLabels,
  resolvePriceForChannel,
} from "@/lib/core/price-channels";
import { parseQuickInvoiceMessage } from "@/lib/core/quick-invoice";
import type { PosCheckoutResult } from "@/types/erpnext";
import type {
  PriceChannel,
  ProductPricingRecord,
  QuickInvoiceCatalogCompany,
  QuickInvoiceCatalogCustomer,
  QuickInvoiceCatalogItem,
  QuickInvoiceDraftItem,
  QuickInvoiceParsedDraft,
} from "@/types/quick-invoice";

type QuickInvoiceClientProps = {
  items: QuickInvoiceCatalogItem[];
  customers: QuickInvoiceCatalogCustomer[];
  companies: QuickInvoiceCatalogCompany[];
  territories: string[];
  warehouses: string[];
  modesOfPayment: string[];
  defaultCompanyName?: string;
};

type DraftResponse = {
  success: boolean;
  data?: {
    quickInvoiceDraftId: string;
    salesOrder: {
      name: string;
      customer: string;
      grand_total?: number;
      status?: string;
    };
  };
  error?: { message: string };
};

type ConfirmResponse = {
  success: boolean;
  data?: {
    quickInvoiceDraftId: string;
    checkout: PosCheckoutResult;
  };
  error?: { message: string };
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function toMoney(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.round(value * 100) / 100
    : null;
}

function cloneDraft(draft: QuickInvoiceParsedDraft): QuickInvoiceParsedDraft {
  return JSON.parse(JSON.stringify(draft)) as QuickInvoiceParsedDraft;
}

function recalculateDraft(draft: QuickInvoiceParsedDraft) {
  const warnings = draft.items.flatMap((item) => item.warnings);
  const totalAmount = toMoney(
    draft.items.reduce((sum, item) => sum + (item.total ?? 0), 0)
  );
  const hasInvalidItem = draft.items.some(
    (item) =>
      !item.itemCode || !Number.isFinite(item.qty) || item.qty <= 0 || !Number.isFinite(item.unitPrice ?? NaN) || (item.unitPrice ?? 0) <= 0
  );

  return {
    ...draft,
    warnings,
    totalAmount,
    requiresReview:
      warnings.length > 0 ||
      hasInvalidItem ||
      !draft.customer.customerName.trim() ||
      !draft.companyName.trim(),
  };
}

function updateItemPricing(
  item: QuickInvoiceDraftItem,
  pricing: ProductPricingRecord | null | undefined,
  channel: PriceChannel
) {
  const nextWarnings = item.warnings.filter(
    (warning) => !warning.includes("no tiene precio configurado")
  );
  const unitPrice =
    channel === "MANUAL"
      ? item.unitPrice
      : resolvePriceForChannel(pricing, channel);
  const normalRate = resolvePriceForChannel(pricing, "RETAIL");

  if (unitPrice == null) {
    nextWarnings.push(`El producto ${item.itemName} no tiene precio configurado.`);
  }

  return {
    ...item,
    priceChannel: channel,
    unitPrice: toMoney(unitPrice),
    normalUnitPrice: toMoney(normalRate),
    total:
      unitPrice != null ? toMoney(unitPrice * item.qty) : null,
    discountAmount:
      unitPrice != null &&
      normalRate != null &&
      unitPrice < normalRate
        ? toMoney((normalRate - unitPrice) * item.qty)
        : null,
    warnings: nextWarnings,
  };
}

export function QuickInvoiceClient({
  items,
  customers,
  companies,
  territories,
  warehouses,
  modesOfPayment,
  defaultCompanyName,
}: QuickInvoiceClientProps) {
  const [rawMessage, setRawMessage] = useState("");
  const [draft, setDraft] = useState<QuickInvoiceParsedDraft | null>(null);
  const [note, setNote] = useState("");
  const [territory, setTerritory] = useState(territories[0] ?? "");
  const [warehouse, setWarehouse] = useState(warehouses[0] ?? "");
  const [modeOfPayment, setModeOfPayment] = useState(modesOfPayment[0] ?? "");
  const [paidAmount, setPaidAmount] = useState("");
  const [referenceNo, setReferenceNo] = useState("");
  const [referenceDate, setReferenceDate] = useState("");
  const [createCustomerIfMissing, setCreateCustomerIfMissing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState<null | "draft" | "confirm">(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [createdDraftName, setCreatedDraftName] = useState<string | null>(null);
  const [confirmedInvoiceName, setConfirmedInvoiceName] = useState<string | null>(null);

  const itemMap = useMemo(
    () => Object.fromEntries(items.map((item) => [item.itemCode, item])),
    [items]
  );

  function analyzeMessage() {
    setMessage(null);
    setIsError(false);
    setCreatedDraftName(null);
    setConfirmedInvoiceName(null);

    const nextDraft = parseQuickInvoiceMessage(rawMessage, {
      items,
      customers,
      companies,
      defaultCompanyName,
    });

    setDraft(nextDraft);
    setPaidAmount(nextDraft.totalAmount != null ? String(nextDraft.totalAmount) : "");
  }

  function patchDraft(mutator: (current: QuickInvoiceParsedDraft) => QuickInvoiceParsedDraft) {
    setDraft((current) => (current ? recalculateDraft(mutator(cloneDraft(current))) : current));
  }

  function updateGlobalChannel(channel: PriceChannel) {
    patchDraft((current) => ({
      ...current,
      priceChannel: channel,
      items: current.items.map((item) => {
        const sourceItem = item.itemCode ? itemMap[item.itemCode] : null;
        const effectiveChannel = item.priceChannel === "MANUAL" ? "MANUAL" : channel;
        return updateItemPricing(item, sourceItem?.pricing, effectiveChannel);
      }),
    }));
  }

  function updateLine(itemIndex: number, patch: Partial<QuickInvoiceDraftItem>) {
    patchDraft((current) => {
      const nextItems = current.items.map((item, index) => {
        if (index !== itemIndex) {
          return item;
        }

        const nextItem = {
          ...item,
          ...patch,
        };

        return {
          ...nextItem,
          total:
            nextItem.unitPrice != null
              ? toMoney(nextItem.qty * nextItem.unitPrice)
              : null,
          discountAmount:
            nextItem.normalUnitPrice != null &&
            nextItem.unitPrice != null &&
            nextItem.unitPrice < nextItem.normalUnitPrice
              ? toMoney((nextItem.normalUnitPrice - nextItem.unitPrice) * nextItem.qty)
              : null,
        };
      });

      return {
        ...current,
        items: nextItems,
      };
    });
  }

  function changeDetectedProduct(itemIndex: number, itemCode: string) {
    patchDraft((current) => {
      const selected = itemCode ? itemMap[itemCode] : null;

      return {
        ...current,
        items: current.items.map((item, index) => {
          if (index !== itemIndex) {
            return item;
          }

          const nextWarnings = item.warnings.filter(
            (warning) =>
              !warning.includes("No se encontro producto") &&
              !warning.includes("Producto ambiguo")
          );
          const nextChannel = item.priceChannel === "MANUAL" ? "MANUAL" : current.priceChannel;
          const nextItem = updateItemPricing(
            {
              ...item,
              itemCode: selected?.itemCode ?? null,
              itemName: selected?.itemName ?? item.itemName,
              warnings: nextWarnings,
            },
            selected?.pricing,
            nextChannel
          );

          return nextItem;
        }),
      };
    });
  }

  async function createDraft() {
    if (!draft) return;
    setIsSubmitting("draft");
    setMessage(null);
    setIsError(false);
    setCreatedDraftName(null);
    setConfirmedInvoiceName(null);

    try {
      const response = await fetch("/api/erpnext/quick-invoice/draft", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft,
          company: draft.companyName,
          warehouse,
          territory,
          note,
          createCustomerIfMissing,
        }),
      });
      const result = (await response.json()) as DraftResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error?.message ?? "No se pudo crear el borrador.");
        return;
      }

      setMessage("Borrador ERP creado correctamente.");
      setCreatedDraftName(result.data?.salesOrder.name ?? null);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo crear el borrador."
      );
    } finally {
      setIsSubmitting(null);
    }
  }

  async function confirmInvoice() {
    if (!draft) return;
    setIsSubmitting("confirm");
    setMessage(null);
    setIsError(false);
    setCreatedDraftName(null);
    setConfirmedInvoiceName(null);

    try {
      const response = await fetch("/api/erpnext/quick-invoice/confirm", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          draft,
          company: draft.companyName,
          warehouse,
          territory,
          modeOfPayment,
          paidAmount,
          referenceNo,
          referenceDate,
          note,
          createCustomerIfMissing,
        }),
      });
      const result = (await response.json()) as ConfirmResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error?.message ?? "No se pudo confirmar la factura.");
        return;
      }

      setMessage("Factura creada correctamente desde el facturador rapido.");
      setConfirmedInvoiceName(result.data?.checkout.invoice.name ?? null);
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo confirmar la factura."
      );
    } finally {
      setIsSubmitting(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
        <CardHeader>
          <CardTitle className="text-xl text-slate-900">Facturador rapido</CardTitle>
          <CardDescription>
            Pega un mensaje libre, analiza cliente y productos, revisa el borrador y
            decide si quieres crear un pedido o facturar.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pb-6">
          <div className="space-y-2">
            <Label htmlFor="quick_invoice_message">Mensaje original</Label>
            <textarea
              id="quick_invoice_message"
              value={rawMessage}
              onChange={(event) => setRawMessage(event.target.value)}
              className="min-h-44 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              placeholder="Ej. Dennys Paola Sarzosa&#10;1725325862&#10;0984778406&#10;La Vicentina&#10;&#10;facturar 2 peptonas por mayor a nombre de Bionvers"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={analyzeMessage} disabled={!rawMessage.trim()}>
              Analizar mensaje
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={routes.pos}>Ir al POS</Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      {draft ? (
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
              <CardHeader>
                <CardTitle className="text-xl text-slate-900">Borrador de factura</CardTitle>
                <CardDescription>
                  Todo se puede corregir antes de crear el pedido o confirmar la factura.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5 pb-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="draft_customer_name">Cliente</Label>
                    <Input
                      id="draft_customer_name"
                      value={draft.customer.customerName}
                      onChange={(event) =>
                        patchDraft((current) => ({
                          ...current,
                          customer: {
                            ...current.customer,
                            customerName: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="draft_tax_id">Identificacion</Label>
                    <Input
                      id="draft_tax_id"
                      value={draft.customer.taxId}
                      onChange={(event) =>
                        patchDraft((current) => ({
                          ...current,
                          customer: {
                            ...current.customer,
                            taxId: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="draft_phone">Telefono</Label>
                    <Input
                      id="draft_phone"
                      value={draft.customer.phone}
                      onChange={(event) =>
                        patchDraft((current) => ({
                          ...current,
                          customer: {
                            ...current.customer,
                            phone: event.target.value,
                          },
                        }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="draft_company">Empresa emisora</Label>
                    <select
                      id="draft_company"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={draft.companyName}
                      onChange={(event) =>
                        patchDraft((current) => ({
                          ...current,
                          companyName: event.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona una empresa</option>
                      {companies.map((company) => (
                        <option key={company.name} value={company.name}>
                          {company.companyName ?? company.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="draft_address">Direccion</Label>
                  <Input
                    id="draft_address"
                    value={draft.customer.address}
                    onChange={(event) =>
                      patchDraft((current) => ({
                        ...current,
                        customer: {
                          ...current.customer,
                          address: event.target.value,
                        },
                      }))
                    }
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="draft_channel">Canal principal</Label>
                    <select
                      id="draft_channel"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={draft.priceChannel}
                      onChange={(event) => updateGlobalChannel(event.target.value as PriceChannel)}
                    >
                      {Object.entries(priceChannelLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="draft_territory">Territorio para cliente nuevo</Label>
                    <select
                      id="draft_territory"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={territory}
                      onChange={(event) => setTerritory(event.target.value)}
                    >
                      <option value="">Selecciona un territorio</option>
                      {territories.map((territoryName) => (
                        <option key={territoryName} value={territoryName}>
                          {territoryName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-slate-900">Cliente ERP detectado</p>
                      <p className="text-sm text-slate-500">
                        {draft.customer.existingCustomerName || "Aun no existe en ERP."}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={createCustomerIfMissing}
                        onChange={(event) => setCreateCustomerIfMissing(event.target.checked)}
                      />
                      Crear cliente si no existe
                    </label>
                  </div>
                </div>

                <div className="space-y-4">
                  {draft.items.map((item, index) => (
                    <div
                      key={`${item.sourceFragment}-${index}`}
                      className="rounded-[24px] border border-slate-200 bg-slate-50/50 p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-slate-500">Detectado desde: {item.sourceFragment}</p>
                          <h3 className="font-medium text-slate-900">{item.itemName}</h3>
                        </div>
                        <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-600">
                          {formatPriceChannelNote({
                            channel: item.priceChannel,
                            manualReason: item.manualPriceReason,
                          })}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                        <div className="space-y-1.5 xl:col-span-2">
                          <Label htmlFor={`detected_item_${index}`}>Producto ERP</Label>
                          <select
                            id={`detected_item_${index}`}
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value={item.itemCode ?? ""}
                            onChange={(event) => changeDetectedProduct(index, event.target.value)}
                          >
                            <option value="">Selecciona un producto</option>
                            {item.candidates.map((candidate) => (
                              <option key={candidate.itemCode} value={candidate.itemCode}>
                                {candidate.itemName} ({candidate.itemCode})
                              </option>
                            ))}
                            {items
                              .filter(
                                (catalogItem) =>
                                  !item.candidates.some(
                                    (candidate) => candidate.itemCode === catalogItem.itemCode
                                  )
                              )
                              .map((catalogItem) => (
                                <option key={catalogItem.itemCode} value={catalogItem.itemCode}>
                                  {catalogItem.itemName} ({catalogItem.itemCode})
                                </option>
                              ))}
                            {!item.candidates.some((candidate) => candidate.itemCode === item.itemCode) &&
                            item.itemCode ? (
                              <option value={item.itemCode}>
                                {item.itemName} ({item.itemCode})
                              </option>
                            ) : null}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`detected_qty_${index}`}>Cantidad</Label>
                          <Input
                            id={`detected_qty_${index}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.qty}
                            onChange={(event) =>
                              updateLine(index, { qty: Number(event.target.value) })
                            }
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`detected_channel_${index}`}>Canal</Label>
                          <select
                            id={`detected_channel_${index}`}
                            className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                            value={item.priceChannel}
                            onChange={(event) => {
                              const nextChannel = event.target.value as PriceChannel;
                              const sourceItem = item.itemCode ? itemMap[item.itemCode] : null;
                              updateLine(
                                index,
                                updateItemPricing(item, sourceItem?.pricing, nextChannel)
                              );
                            }}
                          >
                            {Object.entries(priceChannelLabels).map(([value, label]) => (
                              <option key={value} value={value}>
                                {label}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label htmlFor={`detected_price_${index}`}>Precio unitario</Label>
                          <Input
                            id={`detected_price_${index}`}
                            type="number"
                            min="0.01"
                            step="0.01"
                            value={item.unitPrice ?? ""}
                            onChange={(event) =>
                              updateLine(index, {
                                unitPrice: Number(event.target.value),
                                priceChannel: "MANUAL",
                                manualPriceReason: item.manualPriceReason || "Ajustado manualmente en borrador",
                              })
                            }
                          />
                        </div>
                      </div>

                      <div className="mt-3 grid gap-3 md:grid-cols-3">
                        <div className="space-y-1.5">
                          <Label htmlFor={`detected_manual_reason_${index}`}>Razon precio manual</Label>
                          <Input
                            id={`detected_manual_reason_${index}`}
                            value={item.manualPriceReason ?? ""}
                            onChange={(event) =>
                              updateLine(index, {
                                manualPriceReason: event.target.value,
                                priceChannel: event.target.value.trim() ? "MANUAL" : item.priceChannel,
                              })
                            }
                            placeholder="Ej. promo, redondeo, cliente especial"
                          />
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          Precio base: {item.normalUnitPrice != null ? formatMoney(item.normalUnitPrice) : "Sin precio"}
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                          Subtotal: {item.total != null ? formatMoney(item.total) : "Pendiente"}
                          {item.discountAmount != null && item.discountAmount > 0 ? (
                            <span className="block text-emerald-700">
                              Descuento implícito: {formatMoney(item.discountAmount)}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
              <CardHeader>
                <CardTitle className="text-xl text-slate-900">Revision y confirmacion</CardTitle>
                <CardDescription>
                  Este flujo no envia SRI automaticamente. Primero revisa y luego confirma.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pb-6">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quick_warehouse">Bodega</Label>
                    <select
                      id="quick_warehouse"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={warehouse}
                      onChange={(event) => setWarehouse(event.target.value)}
                    >
                      <option value="">Selecciona una bodega</option>
                      {warehouses.map((warehouseName) => (
                        <option key={warehouseName} value={warehouseName}>
                          {warehouseName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick_mode_of_payment">Metodo de pago</Label>
                    <select
                      id="quick_mode_of_payment"
                      className="h-10 w-full rounded-xl border border-input bg-background px-3 text-sm"
                      value={modeOfPayment}
                      onChange={(event) => setModeOfPayment(event.target.value)}
                    >
                      <option value="">Selecciona un metodo</option>
                      {modesOfPayment.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick_note">Nota operativa</Label>
                    <textarea
                      id="quick_note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      className="min-h-24 w-full rounded-2xl border border-input bg-background px-4 py-3 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                      placeholder="Ej. tomado por WhatsApp, revisar identificacion, cliente recurrente"
                    />
                  </div>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="quick_paid_amount">Monto recibido</Label>
                      <Input
                        id="quick_paid_amount"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={paidAmount}
                        onChange={(event) => setPaidAmount(event.target.value)}
                        placeholder={draft.totalAmount != null ? String(draft.totalAmount) : "0.00"}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="quick_reference_date">Fecha referencia</Label>
                      <Input
                        id="quick_reference_date"
                        type="date"
                        value={referenceDate}
                        onChange={(event) => setReferenceDate(event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="quick_reference_no">Referencia</Label>
                    <Input
                      id="quick_reference_no"
                      value={referenceNo}
                      onChange={(event) => setReferenceNo(event.target.value)}
                      placeholder="Voucher, transferencia o nota interna"
                    />
                  </div>
                </div>

                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <p className="text-sm font-medium text-slate-900">Resumen</p>
                  <div className="mt-2 space-y-1 text-sm text-slate-600">
                    <p>Cliente: {draft.customer.customerName || "Pendiente"}</p>
                    <p>Empresa: {draft.companyName || "Pendiente"}</p>
                    <p>Canal principal: {priceChannelLabels[draft.priceChannel]}</p>
                    <p>Total calculado: {draft.totalAmount != null ? formatMoney(draft.totalAmount) : "Pendiente"}</p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-medium text-amber-900">Advertencias del parser</p>
                  <div className="mt-2 space-y-1 text-sm text-amber-800">
                    {draft.warnings.length > 0 ? (
                      draft.warnings.map((warning, index) => <p key={`${warning}-${index}`}>• {warning}</p>)
                    ) : (
                      <p>Sin advertencias criticas.</p>
                    )}
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
                    <p>{message}</p>
                    {createdDraftName ? <p className="mt-1 font-medium">Pedido: {createdDraftName}</p> : null}
                    {confirmedInvoiceName ? (
                      <div className="mt-2 flex flex-wrap gap-2">
                        <p className="font-medium">Factura: {confirmedInvoiceName}</p>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`${routes.posInvoices}/${encodeURIComponent(confirmedInvoiceName)}`}>
                            Ver factura
                          </Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="grid gap-2 sm:grid-cols-2">
                  <Button
                    type="button"
                    variant="outline"
                    disabled={isSubmitting !== null}
                    onClick={createDraft}
                  >
                    {isSubmitting === "draft" ? "Creando..." : "Crear borrador"}
                  </Button>
                  <Button
                    type="button"
                    disabled={draft.requiresReview || isSubmitting !== null}
                    onClick={confirmInvoice}
                  >
                    {isSubmitting === "confirm" ? "Facturando..." : "Confirmar factura"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ConfigTabId = "sistema" | "comprobantes" | "firma" | "accesos";

type Settings = Record<string, unknown> & {
  id?: string;
  hasCreditNoteAuthPassword?: boolean;
  logoFileName?: string | null;
  logoMimeType?: string | null;
};

const TABS: Array<{ id: ConfigTabId; label: string }> = [
  { id: "sistema", label: "Sistema" },
  { id: "comprobantes", label: "Comprobantes" },
  { id: "firma", label: "Firma electrónica" },
  { id: "accesos", label: "Accesos directos" },
];

function ToggleSwitch({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-blue-600" : "bg-slate-200"
      }`}
    >
      <span
        className={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
          checked ? "translate-x-4" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SectionCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        {description && (
          <p className="text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function CheckboxRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 py-0.5 text-sm cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
      />
      {label}
    </label>
  );
}

function SistemaTab({
  settings,
  onUpdate,
  saving,
}: {
  settings: Settings;
  onUpdate: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const bool = (key: string) => Boolean(settings[key]);
  const num = (key: string, fallback = 0) => {
    const v = settings[key];
    return typeof v === "number" ? v : fallback;
  };
  const str = (key: string, fallback = "") => {
    const v = settings[key];
    return typeof v === "string" ? v : fallback;
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Factura">
        <SettingRow label="Email por defecto clientes">
          <Input
            className="w-48"
            defaultValue={str("defaultCustomerEmail")}
            placeholder="email@ejemplo.com"
            onBlur={(e) => onUpdate({ defaultCustomerEmail: e.target.value.trim() || null })}
          />
        </SettingRow>
        <SettingRow label="Cantidad por defecto">
          <Input
            className="w-20"
            type="number"
            min={1}
            defaultValue={num("defaultQuantity", 1)}
            onBlur={(e) => onUpdate({ defaultQuantity: Number(e.target.value) || 1 })}
          />
        </SettingRow>
        <SettingRow label="Decimales para ventas">
          <Input
            className="w-20"
            type="number"
            min={0}
            max={6}
            defaultValue={num("salesDecimals", 2)}
            onBlur={(e) => onUpdate({ salesDecimals: Number(e.target.value) || 2 })}
          />
        </SettingRow>
        <SettingRow label="Descripción en venta">
          <Input
            className="w-48"
            defaultValue={str("saleDescription")}
            placeholder="Descripción..."
            onBlur={(e) => onUpdate({ saleDescription: e.target.value.trim() || null })}
          />
        </SettingRow>
        <SettingRow label="Habilitar Gestión Subsidios">
          <ToggleSwitch
            checked={bool("enableSubsidyManagement")}
            onChange={(v) => onUpdate({ enableSubsidyManagement: v })}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow label="Editar datos del vendedor">
          <ToggleSwitch
            checked={bool("editSellerData")}
            onChange={(v) => onUpdate({ editSellerData: v })}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow label="Mostrar clientes del vendedor">
          <ToggleSwitch
            checked={bool("showSellerCustomers")}
            onChange={(v) => onUpdate({ showSellerCustomers: v })}
            disabled={saving}
          />
        </SettingRow>
        <SettingRow label="Precio costo desde total neto">
          <ToggleSwitch
            checked={bool("costPriceFromNetTotal")}
            onChange={(v) => onUpdate({ costPriceFromNetTotal: v })}
            disabled={saving}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Ocultar campos de tabla"
        description="Los campos desmarcados permanecerán ocultos en las tablas de venta."
      >
        <CheckboxRow label="Observación" checked={!bool("hideObservation")} onChange={(v) => onUpdate({ hideObservation: !v })} />
        <CheckboxRow label="Stock" checked={!bool("hideStock")} onChange={(v) => onUpdate({ hideStock: !v })} />
        <CheckboxRow label="IVA" checked={!bool("hideIva")} onChange={(v) => onUpdate({ hideIva: !v })} />
        <CheckboxRow label="Descuentos" checked={!bool("hideDiscounts")} onChange={(v) => onUpdate({ hideDiscounts: !v })} />
      </SectionCard>

      <SectionCard title="Inventario">
        <SettingRow label="Controlar stock en venta">
          <ToggleSwitch checked={bool("controlStockOnSale")} onChange={(v) => onUpdate({ controlStockOnSale: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Controlar stock en proforma y orden de trabajo">
          <ToggleSwitch checked={bool("controlStockOnProforma")} onChange={(v) => onUpdate({ controlStockOnProforma: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Inventario detallado">
          <ToggleSwitch checked={bool("detailedInventory")} onChange={(v) => onUpdate({ detailedInventory: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Realizar costeo de productos">
          <ToggleSwitch checked={bool("enableProductCosting")} onChange={(v) => onUpdate({ enableProductCosting: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Descuento automático venta">
          <ToggleSwitch checked={bool("autoDiscountOnSale")} onChange={(v) => onUpdate({ autoDiscountOnSale: v })} disabled={saving} />
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Columnas de productos — Rol de usuario"
        description="Las columnas marcadas serán visibles; las desmarcadas estarán ocultas para este rol."
      >
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <CheckboxRow label="Cód. Barras" checked={bool("colBarcode")} onChange={(v) => onUpdate({ colBarcode: v })} />
          <CheckboxRow label="Imagen" checked={bool("colImage")} onChange={(v) => onUpdate({ colImage: v })} />
          <CheckboxRow label="Código" checked={bool("colCode")} onChange={(v) => onUpdate({ colCode: v })} />
          <CheckboxRow label="Nombre" checked={bool("colName")} onChange={(v) => onUpdate({ colName: v })} />
          <CheckboxRow label="Marca" checked={bool("colBrand")} onChange={(v) => onUpdate({ colBrand: v })} />
          <CheckboxRow label="Costo" checked={bool("colCost")} onChange={(v) => onUpdate({ colCost: v })} />
          <CheckboxRow label="PVP (IVA incluido)" checked={bool("colPvpIva")} onChange={(v) => onUpdate({ colPvpIva: v })} />
          <CheckboxRow label="Barra" checked={bool("colBar")} onChange={(v) => onUpdate({ colBar: v })} />
          <CheckboxRow label="Impuesto" checked={bool("colTax")} onChange={(v) => onUpdate({ colTax: v })} />
          <CheckboxRow label="Categoría" checked={bool("colCategory")} onChange={(v) => onUpdate({ colCategory: v })} />
          <CheckboxRow label="Stock" checked={bool("colStock")} onChange={(v) => onUpdate({ colStock: v })} />
          <CheckboxRow label="Estado" checked={bool("colStatus")} onChange={(v) => onUpdate({ colStatus: v })} />
        </div>
      </SectionCard>

      <SectionCard title="Transacciones">
        <SettingRow label="Permitir eliminar documentos">
          <ToggleSwitch checked={bool("allowDeleteDocuments")} onChange={(v) => onUpdate({ allowDeleteDocuments: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Pedir clave al crear venta">
          <ToggleSwitch checked={bool("requireKeyOnSale")} onChange={(v) => onUpdate({ requireKeyOnSale: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Seleccionar el vendedor al facturar">
          <ToggleSwitch checked={bool("selectSellerOnInvoice")} onChange={(v) => onUpdate({ selectSellerOnInvoice: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Seleccionar fecha al facturar">
          <ToggleSwitch checked={bool("selectDateOnInvoice")} onChange={(v) => onUpdate({ selectDateOnInvoice: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Desactivar cambios de precio manual al vendedor">
          <ToggleSwitch checked={bool("disableManualPriceChange")} onChange={(v) => onUpdate({ disableManualPriceChange: v })} disabled={saving} />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Impresiones">
        <SettingRow label="Mostrar precio + IVA en ticket">
          <ToggleSwitch checked={bool("showPriceWithIvaOnTicket")} onChange={(v) => onUpdate({ showPriceWithIvaOnTicket: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Usar información de sucursales en impresiones">
          <ToggleSwitch checked={bool("useBranchInfoOnPrint")} onChange={(v) => onUpdate({ useBranchInfoOnPrint: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Incluir logo de la empresa en ticket">
          <ToggleSwitch checked={bool("includeLogoOnTicket")} onChange={(v) => onUpdate({ includeLogoOnTicket: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Columnas código de barras">
          <Input
            className="w-20"
            type="number"
            min={1}
            max={4}
            defaultValue={num("barcodeColumns", 1)}
            onBlur={(e) => onUpdate({ barcodeColumns: Number(e.target.value) || 1 })}
          />
        </SettingRow>
      </SectionCard>

      <SectionCard title="Configurar etiqueta de código de barras">
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <CheckboxRow label="Mostrar nombre" checked={bool("labelShowName")} onChange={(v) => onUpdate({ labelShowName: v })} />
          <CheckboxRow label="Mostrar código" checked={bool("labelShowCode")} onChange={(v) => onUpdate({ labelShowCode: v })} />
          <CheckboxRow label="Mostrar marca" checked={bool("labelShowBrand")} onChange={(v) => onUpdate({ labelShowBrand: v })} />
          <CheckboxRow label="Mostrar color" checked={bool("labelShowColor")} onChange={(v) => onUpdate({ labelShowColor: v })} />
          <CheckboxRow label="Mostrar precio" checked={bool("labelShowPrice")} onChange={(v) => onUpdate({ labelShowPrice: v })} />
          <CheckboxRow label="Mostrar talla" checked={bool("labelShowSize")} onChange={(v) => onUpdate({ labelShowSize: v })} />
        </div>
      </SectionCard>

      <SectionCard title="Cierre de caja">
        <SettingRow label="Modo de cierre">
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={str("cashClosingMode", "by_cash_register")}
            onChange={(e) => onUpdate({ cashClosingMode: e.target.value })}
          >
            <option value="by_cash_register">Por caja</option>
            <option value="by_user">Por usuario</option>
          </select>
        </SettingRow>
        <SettingRow label="Tipo de cierre">
          <select
            className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm"
            value={str("cashClosingType", "cash_only")}
            onChange={(e) => onUpdate({ cashClosingType: e.target.value })}
          >
            <option value="cash_only">Cierre Efectivo</option>
            <option value="total">Cierre Total</option>
          </select>
        </SettingRow>
      </SectionCard>

      <SectionCard
        title="Autorización de notas de crédito"
        description="Configura una clave para controlar la autorización al registrar notas de crédito en una venta."
      >
        <SettingRow label="Solicitar clave de autorización">
          <ToggleSwitch checked={bool("requireCreditNoteAuth")} onChange={(v) => onUpdate({ requireCreditNoteAuth: v })} disabled={saving} />
        </SettingRow>
        {bool("requireCreditNoteAuth") && (
          <div className="space-y-2">
            <Label htmlFor="cnAuthPassword">Clave de autorización</Label>
            <Input
              id="cnAuthPassword"
              type="password"
              placeholder={settings.hasCreditNoteAuthPassword ? "••••••••" : "Nueva clave"}
              autoComplete="new-password"
            />
            <p className="text-xs text-muted-foreground">
              La clave no se muestra una vez guardada.
            </p>
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function ProformaFormatCard({
  name,
  selected,
  onSelect,
}: {
  name: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-colors ${
        selected
          ? "border-blue-500 bg-blue-50/50"
          : "border-slate-200 bg-white hover:border-slate-300"
      }`}
    >
      <div className="flex h-20 w-16 items-center justify-center rounded border bg-slate-50 text-xs text-slate-400">
        PDF
      </div>
      <span className="text-sm font-medium">{name}</span>
    </button>
  );
}

function ComprobantesTab({
  settings,
  onUpdate,
  saving,
}: {
  settings: Settings;
  onUpdate: (patch: Record<string, unknown>) => void;
  saving: boolean;
}) {
  const bool = (key: string) => Boolean(settings[key]);
  const str = (key: string, fallback = "") => {
    const v = settings[key];
    return typeof v === "string" ? v : fallback;
  };

  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoUploading, setLogoUploading] = useState(false);
  const [logoMessage, setLogoMessage] = useState<string | null>(null);

  const hasLogo = Boolean(settings.logoFileName);

  useEffect(() => {
    if (hasLogo) {
      setLogoPreview(`/api/business-settings/logo?t=${Date.now()}`);
    }
  }, [hasLogo]);

  async function handleLogoUpload(file: File) {
    setLogoUploading(true);
    setLogoMessage(null);
    const form = new FormData();
    form.append("logo", file);

    let res: Response;
    try {
      res = await fetch("/api/business-settings/logo", {
        method: "POST",
        body: form,
      });
    } catch {
      setLogoMessage("Error de conexión al subir logo.");
      setLogoUploading(false);
      return;
    }

    try {
      const result = await res.json();
      if (!res.ok) {
        setLogoMessage(result.error || "No se pudo guardar el logo.");
        setLogoUploading(false);
        return;
      }
      setLogoPreview(`/api/business-settings/logo?t=${Date.now()}`);
      setLogoMessage("Logo actualizado correctamente.");
    } catch {
      setLogoMessage(
        res.ok ? "Logo actualizado correctamente." : "No se pudo guardar el logo.",
      );
    } finally {
      setLogoUploading(false);
    }
  }

  async function handleLogoDelete() {
    setLogoUploading(true);
    setLogoMessage(null);
    try {
      await fetch("/api/business-settings/logo", { method: "DELETE" });
      setLogoPreview(null);
      setLogoMessage("Logo eliminado.");
    } catch {
      setLogoMessage("Error al eliminar logo.");
    } finally {
      setLogoUploading(false);
    }
  }

  const proformaFormats = [
    { id: "standard", name: "Estándar" },
    { id: "format_a", name: "Formato A" },
    { id: "format_b", name: "Formato B" },
    { id: "format_c", name: "Formato C" },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard title="Formato proforma" description="Selecciona el formato visual para las proformas.">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {proformaFormats.map((f) => (
            <ProformaFormatCard
              key={f.id}
              name={f.name}
              selected={str("proformaFormat", "standard") === f.id}
              onSelect={() => onUpdate({ proformaFormat: f.id })}
            />
          ))}
        </div>
      </SectionCard>

      <SectionCard title="PDF">
        <SettingRow label="Color de fondo">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={str("pdfBackgroundColor", "#FFFFFF")}
              onChange={(e) => onUpdate({ pdfBackgroundColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">
              {str("pdfBackgroundColor", "#FFFFFF")}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Color del formato">
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={str("pdfAccentColor", "#1a1a1a")}
              onChange={(e) => onUpdate({ pdfAccentColor: e.target.value })}
              className="h-8 w-8 cursor-pointer rounded border"
            />
            <span className="text-xs text-muted-foreground">
              {str("pdfAccentColor", "#1a1a1a")}
            </span>
          </div>
        </SettingRow>
        <SettingRow label="Incluir número de secuencial extra en la factura">
          <ToggleSwitch checked={bool("includeExtraSequential")} onChange={(v) => onUpdate({ includeExtraSequential: v })} disabled={saving} />
        </SettingRow>
        <div className="space-y-2">
          <Label htmlFor="invoiceLegend">Leyenda factura</Label>
          <Input
            id="invoiceLegend"
            defaultValue={str("invoiceLegend")}
            placeholder="Leyenda..."
            onBlur={(e) => onUpdate({ invoiceLegend: e.target.value.trim() || null })}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="invoiceExtraNote">Nota adicional</Label>
          <Input
            id="invoiceExtraNote"
            defaultValue={str("invoiceExtraNote")}
            placeholder="Nota adicional..."
            onBlur={(e) => onUpdate({ invoiceExtraNote: e.target.value.trim() || null })}
          />
        </div>
      </SectionCard>

      <SectionCard
        title="Datos adicionales factura"
        description="Datos a incluir en la sección de detalles adicionales de la factura."
      >
        <CheckboxRow label="Responsable" checked={bool("showResponsible")} onChange={(v) => onUpdate({ showResponsible: v })} />
        <CheckboxRow label="Bodega" checked={bool("showWarehouse")} onChange={(v) => onUpdate({ showWarehouse: v })} />
        <CheckboxRow label="Vendedor" checked={bool("showSeller")} onChange={(v) => onUpdate({ showSeller: v })} />
      </SectionCard>

      <SectionCard title="Información de ticket">
        <SettingRow label="Mostrar ticket automáticamente">
          <ToggleSwitch checked={bool("showTicketAutomatically")} onChange={(v) => onUpdate({ showTicketAutomatically: v })} disabled={saving} />
        </SettingRow>
        <SettingRow label="Firmas de responsabilidad">
          <ToggleSwitch checked={bool("showResponsibilitySignatures")} onChange={(v) => onUpdate({ showResponsibilitySignatures: v })} disabled={saving} />
        </SettingRow>
      </SectionCard>

      <div className="lg:col-span-2">
        <SectionCard
          title="Logo para impresiones"
          description="Se utilizará en el RIDE / PDF factura, proforma y ticket cuando la configuración lo permita."
        >
          <div className="flex flex-wrap items-start gap-6">
            <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50">
              {logoPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoPreview}
                  alt="Logo"
                  className="max-h-28 max-w-28 object-contain"
                />
              ) : (
                <span className="text-xs text-slate-400">Sin logo</span>
              )}
            </div>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="logoUpload"
                  className={`inline-flex h-9 cursor-pointer items-center rounded-lg border bg-white px-4 text-sm font-medium transition-colors hover:bg-slate-50 ${
                    logoUploading ? "pointer-events-none opacity-50" : ""
                  }`}
                >
                  {logoUploading ? "Subiendo..." : hasLogo ? "Reemplazar logo" : "Subir logo"}
                </label>
                <input
                  id="logoUpload"
                  type="file"
                  accept=".png,.jpg,.jpeg"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleLogoUpload(file);
                    e.target.value = "";
                  }}
                />
              </div>

              {hasLogo && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogoDelete}
                  disabled={logoUploading}
                  className="text-red-600 hover:text-red-700"
                >
                  Eliminar logo
                </Button>
              )}

              <div className="text-xs text-muted-foreground space-y-0.5">
                <p>Formatos: PNG, JPG, JPEG</p>
                <p>PNG con fondo transparente recomendado</p>
                <p>Tamaño recomendado: 1000 × 1000 px</p>
                <p>Peso máximo: 2 MB</p>
              </div>

              {logoMessage && (
                <p className={`text-sm ${logoMessage.includes("Error") ? "text-red-600" : "text-emerald-600"}`}>
                  {logoMessage}
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}

function FirmaTab() {
  return (
    <SectionCard
      title="Firma electrónica"
      description="Gestiona tu certificado digital para la emisión de comprobantes electrónicos."
    >
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          La configuración de firma electrónica se gestiona desde la sección SRI
          del menú lateral. Accede a{" "}
          <a
            href="/facturacion/sri/signature"
            className="font-medium text-blue-600 hover:underline"
          >
            SRI → Firma electrónica
          </a>{" "}
          para ver el estado del certificado, cargarlo o reemplazarlo.
        </p>
        <a
          href="/facturacion/sri/signature"
          className="inline-flex h-9 items-center rounded-lg border bg-white px-4 text-sm font-medium transition-colors hover:bg-slate-50"
        >
          Ir a Firma electrónica
        </a>
      </div>
    </SectionCard>
  );
}

function AccesosTab() {
  return (
    <SectionCard title="Accesos directos">
      <div className="flex min-h-[120px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50">
        <p className="text-center text-sm text-muted-foreground">
          Próximamente podrás configurar qué accesos directos aparecen en el
          inicio de Facturom.
        </p>
      </div>
    </SectionCard>
  );
}

export function ConfigurationPageClient() {
  const [activeTab, setActiveTab] = useState<ConfigTabId>("sistema");
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/business-settings");
      const result = await res.json();
      if (result.success) {
        setSettings(result.data);
      }
    } catch {
      setMessage("Error cargando configuración.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleUpdate(patch: Record<string, unknown>) {
    if (saving) return;
    setSaving(true);
    setMessage(null);

    try {
      const res = await fetch("/api/business-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const result = await res.json();
      if (result.success) {
        setSettings(result.data);
      } else {
        setMessage(result.error || "Error al guardar.");
      }
    } catch {
      setMessage("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando configuración...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2 overflow-x-auto rounded-xl border bg-muted/30 p-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "whitespace-nowrap rounded-lg bg-background px-4 py-2 text-sm font-medium shadow-sm"
                : "whitespace-nowrap rounded-lg px-4 py-2 text-sm text-muted-foreground hover:bg-background/70"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {saving && (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-2 text-sm text-blue-700">
          Guardando...
        </div>
      )}

      {message && (
        <div className="rounded-lg border border-red-100 bg-red-50/60 px-4 py-2 text-sm text-red-700">
          {message}
        </div>
      )}

      {activeTab === "sistema" && settings && (
        <SistemaTab settings={settings} onUpdate={handleUpdate} saving={saving} />
      )}

      {activeTab === "comprobantes" && settings && (
        <ComprobantesTab settings={settings} onUpdate={handleUpdate} saving={saving} />
      )}

      {activeTab === "firma" && <FirmaTab />}

      {activeTab === "accesos" && <AccesosTab />}
    </div>
  );
}

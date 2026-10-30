"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, Plus, Search, X, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EcuadorLocationPicker } from "@/components/appsolux/people/ecuador-location-picker";
import { TenantUserSelect } from "@/components/appsolux/people/tenant-user-select";
import { TenantValueCombobox } from "@/components/appsolux/people/tenant-value-combobox";
import { EntityCombobox } from "@/components/appsolux/people/entity-combobox";
import {
  getIdentificationMaxLength,
  getIdentificationInputMode,
  isForeignIdentificationType,
} from "@/lib/core/identification-rules";
import type { LightweightCustomerIdentificationType } from "@prisma/client";

type Supplier = Record<string, string | string[] | boolean | null> & {
  id: string;
  name: string;
  additionalEmails: string[];
  phoneNumbers: string[];
  isActive: boolean;
};
type Lookup = {
  found: boolean;
  message?: string;
  source?: string;
  identification?: string;
  legalName?: string;
  tradeName?: string;
  address?: string;
  taxpayerStatus?: string;
  taxpayerClass?: string;
  taxpayerType?: string;
  province?: string;
  city?: string;
  parish?: string;
  economicActivity?: string;
  ciiuCode?: string;
  accountingRequired?: boolean;
  specialTaxpayer?: boolean;
  withholdingAgent?: boolean;
  sourceUpdatedAt?: string;
  queriedAt?: string;
};
type OtherSupplier = { id: string; name: string; identification: string | null };

const ORIGIN_OPTIONS = [
  { value: "NATIONAL", label: "Nacional" },
  { value: "FOREIGN", label: "Extranjero" },
  { value: "MIXED", label: "Mixto" },
];

export function SupplierEditor({
  supplier,
  tenantSuppliers = [],
  existingSectors = [],
  existingZones = [],
  existingTypes = [],
}: {
  supplier?: Supplier;
  tenantSuppliers?: OtherSupplier[];
  existingSectors?: string[];
  existingZones?: string[];
  existingTypes?: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<LightweightCustomerIdentificationType>(
    (supplier?.identificationType as LightweightCustomerIdentificationType) ?? "RUC",
  );
  const [identification, setIdentification] = useState(
    String(supplier?.identification ?? ""),
  );
  const [emails, setEmails] = useState([
    String(supplier?.email ?? ""),
    ...(supplier?.additionalEmails ?? []),
  ]);
  const [phones, setPhones] = useState([
    String(supplier?.phone ?? "+593"),
    ...(supplier?.phoneNumbers ?? []),
  ]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupData, setLookupData] = useState<Lookup | null>(null);
  const [name, setName] = useState(String(supplier?.name ?? ""));
  const [tradeName, setTradeName] = useState(String(supplier?.tradeName ?? ""));
  const [address, setAddress] = useState(String(supplier?.address ?? ""));
  const [province, setProvince] = useState(String(supplier?.province ?? ""));
  const [city, setCity] = useState(String(supplier?.city ?? ""));
  const [parish, setParish] = useState(String(supplier?.parish ?? ""));
  const [country, setCountry] = useState(String(supplier?.country ?? "Ecuador"));
  const [isForeign, setIsForeign] = useState(Boolean(supplier?.isForeign));
  const [isRelated, setIsRelated] = useState(Boolean(supplier?.isRelated));
  const [assignedBuyerId, setAssignedBuyerId] = useState(
    String(supplier?.assignedBuyerId ?? ""),
  );
  const [supplierOrigin, setSupplierOrigin] = useState(
    String(supplier?.supplierOrigin ?? ""),
  );
  const [sector, setSector] = useState(String(supplier?.sector ?? ""));
  const [zone, setZone] = useState(String(supplier?.zone ?? ""));
  const [supplierType, setSupplierType] = useState(
    String(supplier?.supplierType ?? ""),
  );
  const [groupName, setGroupName] = useState(
    String(supplier?.groupName ?? "SIN GRUPO"),
  );
  const [relatedSupplierId, setRelatedSupplierId] = useState(
    String(supplier?.relatedSupplierId ?? ""),
  );

  useEffect(() => {
    const foreign = isForeignIdentificationType(type);
    if (foreign && !isForeign) {
      setIsForeign(true);
    }
    if (!foreign && isForeign && (type === "RUC" || type === "CEDULA")) {
      setIsForeign(false);
      setCountry("Ecuador");
    }
  }, [type]);

  useEffect(() => {
    if (!isForeign) {
      setCountry("Ecuador");
    }
  }, [isForeign]);

  async function searchTaxpayer() {
    setError("");
    setLookupFeedback("");
    setLookupLoading(true);
    setLookupData(null);
    try {
      const response = await fetch(
        `/api/sri/taxpayer-lookup?identification=${encodeURIComponent(identification)}`,
      );
      const data = (await response.json()) as Lookup;
      if (!response.ok || !data.found) {
        setLookupFeedback(
          data.message ??
            "No encontramos información tributaria. Puedes completar los datos manualmente.",
        );
        return;
      }
      setLookupData(data);
      if (data.legalName) setName(data.legalName);
      if (data.tradeName) setTradeName(data.tradeName);
      if (data.address) setAddress(data.address);
      if (data.province) setProvince(data.province);
      if (data.city) setCity(data.city);
      if (data.parish) setParish(data.parish);
      setLookupFeedback("✓ Datos del SRI cargados");
      setTimeout(() => setLookupFeedback(""), 4000);
    } finally {
      setLookupLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const form = new FormData(event.currentTarget);
    const string = (key: string) => String(form.get(key) ?? "");
    const payload = {
      name,
      tradeName,
      identificationType: type,
      identification,
      address,
      country: isForeign ? country : "Ecuador",
      province,
      city,
      parish,
      sector,
      zone,
      supplierType,
      supplierOrigin,
      groupName,
      assignedBuyerId,
      isRelated,
      isForeign,
      notes: string("notes"),
      emails,
      email: emails[0],
      additionalEmails: emails.slice(1),
      phone: phones[0],
      phoneNumbers: phones.slice(1),
      isActive: form.get("isActive") === "on",
      relatedSupplierId: isRelated ? relatedSupplierId : "",
      taxpayerStatus: lookupData?.taxpayerStatus,
      taxpayerLegalName: lookupData?.legalName,
      taxpayerTradeName: lookupData?.tradeName,
      taxpayerClass: lookupData?.taxpayerClass,
      taxpayerType: lookupData?.taxpayerType,
      economicActivity: lookupData?.economicActivity,
      ciiuCode: lookupData?.ciiuCode,
      accountingRequired: lookupData?.accountingRequired,
      specialTaxpayer: lookupData?.specialTaxpayer,
      withholdingAgent: lookupData?.withholdingAgent,
      taxDataSource: lookupData?.source,
      taxDataSourceUpdatedAt: lookupData?.sourceUpdatedAt,
      taxDataQueriedAt: lookupData?.queriedAt,
    };
    const response = await fetch(
      supplier ? `/api/basic/suppliers/${supplier.id}` : "/api/basic/suppliers",
      {
        method: supplier ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await response.json()) as {
      message?: string;
      supplier?: { id: string };
    };
    setSaving(false);
    if (!response.ok) return setError(data.message ?? "No se pudo guardar.");
    router.push(`/facturacion/suppliers/${supplier?.id ?? data.supplier?.id}`);
    router.refresh();
  }

  const maxLen = getIdentificationMaxLength(type);
  const inputMode = getIdentificationInputMode(type);

  return (
    <form onSubmit={submit} className="pb-8">
      <header className="sticky top-0 z-20 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-[#E4E9F0] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#172033]">
            {supplier ? "Editar proveedor" : "Nuevo proveedor"}
          </h1>
          <p className="text-xs text-[#667085]">
            Información administrativa y tributaria
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/facturacion/suppliers">Cancelar</Link>
          </Button>
          <Button
            disabled={saving}
            className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
          >
            {saving ? "Guardando..." : "Guardar proveedor"}
          </Button>
        </div>
      </header>

      <div className="space-y-4">
        <Section title="Identificación">
          <Field label="Tipo de identificación">
            <select
              value={type}
              onChange={(e) =>
                setType(e.target.value as LightweightCustomerIdentificationType)
              }
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              <option value="RUC">RUC</option>
              <option value="CEDULA">Cédula</option>
              <option value="PASSPORT">Pasaporte</option>
              <option value="FOREIGN_ID">Identificación exterior</option>
            </select>
          </Field>
          <Field label="Identificación">
            <div className="flex gap-2">
              <Input
                value={identification}
                onChange={(e) => {
                  const v =
                    inputMode === "numeric"
                      ? e.target.value.replace(/\D/g, "")
                      : e.target.value;
                  setIdentification(v);
                  setLookupData(null);
                }}
                maxLength={maxLen}
                inputMode={inputMode}
                required
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="Consultar datos tributarios"
                aria-label="Consultar datos tributarios"
                onClick={searchTaxpayer}
                disabled={
                  lookupLoading || (type !== "RUC" && type !== "CEDULA")
                }
              >
                {lookupLoading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <Search />
                )}
              </Button>
            </div>
          </Field>
          <Field label="Razón social / Nombres completos">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </Field>
          <Field label="Nombre comercial">
            <Input
              value={tradeName}
              onChange={(e) => setTradeName(e.target.value)}
            />
          </Field>
        </Section>

        {lookupFeedback && (
          <div
            className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${lookupFeedback.startsWith("✓") ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}
          >
            {lookupFeedback.startsWith("✓") && <Check className="size-4" />}
            <span>{lookupFeedback}</span>
          </div>
        )}

        <Section title="Contacto">
          <div className="sm:col-span-2">
            <ArrayFields
              title="Correos electrónicos"
              values={emails}
              setValues={setEmails}
              max={5}
              type="email"
            />
          </div>
          <div className="sm:col-span-2">
            <ArrayFields
              title="Teléfonos"
              values={phones}
              setValues={setPhones}
              max={3}
              type="tel"
            />
          </div>
        </Section>

        <Section title="Ubicación">
          <Field label="Dirección" wide>
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </Field>
          {isForeign && country !== "Ecuador" ? (
            <>
              <Field label="País">
                <Input
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  required
                />
              </Field>
              <Field label="Ciudad">
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
            </>
          ) : (
            <div className="sm:col-span-2">
              <EcuadorLocationPicker
                province={province}
                city={city}
                parish={parish}
                onProvinceChange={setProvince}
                onCityChange={setCity}
                onParishChange={setParish}
              />
            </div>
          )}
        </Section>

        <div className="flex flex-wrap gap-x-6 gap-y-3 rounded-xl border border-[#E4E9F0] bg-white px-4 py-3">
          <Toggle
            label="Extranjero"
            checked={isForeign}
            onChange={(v) => {
              setIsForeign(v);
              if (v && type !== "PASSPORT" && type !== "FOREIGN_ID") {
                setType("PASSPORT");
              }
            }}
          />
          <Toggle label="Relacionado" checked={isRelated} onChange={setIsRelated} />
        </div>

        {isRelated && (
          <Section title="Proveedor relacionado">
            <Field label="Proveedor vinculado" wide>
              <EntityCombobox
                name="relatedSupplierId"
                value={relatedSupplierId}
                onChange={setRelatedSupplierId}
                entities={tenantSuppliers}
                excludeId={supplier?.id}
                label="Buscar proveedor..."
                emptyLabel="Solo marcar como parte relacionada"
              />
            </Field>
          </Section>
        )}

        <Section title="Datos adicionales">
          <Field label="Comprador asignado">
            <TenantUserSelect
              name="assignedBuyerId"
              value={assignedBuyerId}
              onChange={setAssignedBuyerId}
              label="Comprador"
              emptyLabel="Sin comprador"
            />
          </Field>
          <Field label="Origen">
            <select
              value={supplierOrigin}
              onChange={(e) => setSupplierOrigin(e.target.value)}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              <option value="">Seleccionar</option>
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {supplierOrigin &&
                !ORIGIN_OPTIONS.some((o) => o.value === supplierOrigin) && (
                  <option value={supplierOrigin}>{supplierOrigin}</option>
                )}
            </select>
          </Field>
          <Field label="Tipo de proveedor">
            <TenantValueCombobox
              name="supplierType"
              value={supplierType}
              onChange={setSupplierType}
              existingValues={existingTypes}
              label="Tipo"
              emptyLabel="Sin tipo"
              addLabel="+ Nuevo tipo"
            />
          </Field>
          <Field label="Sector">
            <TenantValueCombobox
              name="sector"
              value={sector}
              onChange={setSector}
              existingValues={existingSectors}
              label="Sector"
              emptyLabel="Sin sector"
              addLabel="+ Nuevo sector"
            />
          </Field>
          <Field label="Zona">
            <TenantValueCombobox
              name="zone"
              value={zone}
              onChange={setZone}
              existingValues={existingZones}
              label="Zona"
              emptyLabel="Sin zona"
              addLabel="+ Nueva zona"
            />
          </Field>
          <Field label="Grupo">
            <TenantValueCombobox
              name="groupName"
              value={groupName}
              onChange={setGroupName}
              existingValues={[]}
              label="Grupo"
              emptyLabel="SIN GRUPO"
              addLabel="+ Nuevo grupo"
            />
          </Field>
          <Field label="Observaciones" wide>
            <textarea
              name="notes"
              defaultValue={String(supplier?.notes ?? "")}
              className="min-h-24 w-full rounded-lg border border-[#E4E9F0] px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={supplier?.isActive ?? true}
            />
            Proveedor activo
          </label>
        </Section>

        {error ? (
          <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-[#E4E9F0] bg-white p-4">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-[#172033]">
        {title}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({
  label,
  children,
  wide,
}: {
  label: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${wide ? "sm:col-span-2" : ""}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#172033]">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-[#1E52F1]" : "bg-slate-300"}`}
      >
        <span
          className={`absolute left-0.5 top-0.5 size-4 rounded-full bg-white transition-transform ${checked ? "translate-x-4" : ""}`}
        />
      </button>
      {label}
    </label>
  );
}
function ArrayFields({
  title,
  values,
  setValues,
  max,
  type,
}: {
  title: string;
  values: string[];
  setValues: (values: string[]) => void;
  max: number;
  type: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <Label>{title}</Label>
          <p className="text-xs text-[#667085]">
            El primero es el principal. Máximo {max}.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={values.length >= max}
          onClick={() => setValues([...values, ""])}
        >
          <Plus />
          Agregar
        </Button>
      </div>
      <div className="space-y-2">
        {values.map((value, index) => (
          <div key={index} className="flex gap-2">
            <Input
              type={type}
              value={value}
              onChange={(e) =>
                setValues(
                  values.map((current, i) =>
                    i === index ? e.target.value : current,
                  ),
                )
              }
            />
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={values.length === 1}
              onClick={() => setValues(values.filter((_, i) => i !== index))}
            >
              <X />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

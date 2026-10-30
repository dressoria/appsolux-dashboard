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

type Customer = Record<string, string | string[] | boolean | null> & {
  id: string;
  name: string;
  identificationType: string | null;
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
  queriedAt?: string;
};
type OtherCustomer = { id: string; name: string; identification: string | null };

const ORIGIN_OPTIONS = [
  { value: "NATIONAL", label: "Nacional" },
  { value: "FOREIGN", label: "Extranjero" },
  { value: "MIXED", label: "Mixto" },
];

const CUSTOMER_TYPES = [
  "Público",
  "Distribuidor",
  "Mayorista",
  "Tarjeta",
  "Precio E",
  "Precio F",
];

const GENDER_OPTIONS = [
  { value: "", label: "No especificado" },
  { value: "M", label: "Masculino" },
  { value: "F", label: "Femenino" },
  { value: "O", label: "Otro" },
];

export function CustomerEditor({
  customer,
  tenantCustomers = [],
  existingSectors = [],
  existingGroups = [],
  existingZones = [],
}: {
  customer?: Customer;
  tenantCustomers?: OtherCustomer[];
  existingSectors?: string[];
  existingGroups?: string[];
  existingZones?: string[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState<LightweightCustomerIdentificationType>(
    (customer?.identificationType as LightweightCustomerIdentificationType) ?? "RUC",
  );
  const [identification, setIdentification] = useState(
    String(customer?.identification ?? ""),
  );
  const [emails, setEmails] = useState([
    String(customer?.email ?? ""),
    ...(customer?.additionalEmails ?? []),
  ]);
  const [phones, setPhones] = useState([
    String(customer?.phone ?? "+593"),
    ...(customer?.phoneNumbers ?? []),
  ]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupData, setLookupData] = useState<Lookup | null>(null);
  const [name, setName] = useState(String(customer?.name ?? ""));
  const [tradeName, setTradeName] = useState(String(customer?.tradeName ?? ""));
  const [address, setAddress] = useState(String(customer?.address ?? ""));
  const [province, setProvince] = useState(String(customer?.province ?? ""));
  const [city, setCity] = useState(String(customer?.city ?? ""));
  const [parish, setParish] = useState(String(customer?.parish ?? ""));
  const [country, setCountry] = useState(String(customer?.country ?? "Ecuador"));
  const [isForeign, setIsForeign] = useState(Boolean(customer?.isForeign));
  const [isRelated, setIsRelated] = useState(Boolean(customer?.isRelated));
  const [invoiceThirdParty, setInvoiceThirdParty] = useState(
    Boolean(customer?.invoiceThirdParty),
  );
  const [assignedSellerId, setAssignedSellerId] = useState(
    String(customer?.assignedSellerId ?? ""),
  );
  const [customerOrigin, setCustomerOrigin] = useState(
    String(customer?.customerOrigin ?? ""),
  );
  const [gender, setGender] = useState(String(customer?.gender ?? ""));
  const [sector, setSector] = useState(String(customer?.sector ?? ""));
  const [zone, setZone] = useState(String(customer?.zone ?? ""));
  const [groupName, setGroupName] = useState(
    String(customer?.groupName ?? "SIN GRUPO"),
  );
  const [relatedCustomerId, setRelatedCustomerId] = useState(
    String(customer?.relatedCustomerId ?? ""),
  );
  const [invoiceThirdPartyCustomerId, setInvoiceThirdPartyCustomerId] =
    useState(String(customer?.invoiceThirdPartyCustomerId ?? ""));

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
      customerType: string("customerType"),
      customerOrigin,
      groupName,
      assignedSellerId,
      isRelated,
      isForeign,
      invoiceThirdParty,
      notes: string("notes"),
      emails,
      phone: phones[0],
      phoneNumbers: phones.slice(1),
      isActive: form.get("isActive") === "on",
      gender,
      relatedCustomerId: isRelated ? relatedCustomerId : "",
      invoiceThirdPartyCustomerId: invoiceThirdParty
        ? invoiceThirdPartyCustomerId
        : "",
      taxpayerStatus: lookupData?.taxpayerStatus,
      taxpayerLegalName: lookupData?.legalName,
      taxpayerTradeName: lookupData?.tradeName,
      taxpayerType: lookupData?.taxpayerType,
      economicActivity: lookupData?.economicActivity,
      taxDataSource: lookupData?.source,
      taxDataQueriedAt: lookupData?.queriedAt,
    };
    const response = await fetch(
      customer ? `/api/basic/customers/${customer.id}` : "/api/basic/customers",
      {
        method: customer ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await response.json()) as {
      message?: string;
      customer?: { id: string };
    };
    setSaving(false);
    if (!response.ok) return setError(data.message ?? "No se pudo guardar.");
    router.push(`/facturacion/customers/${customer?.id ?? data.customer?.id}`);
    router.refresh();
  }

  const maxLen = getIdentificationMaxLength(type);
  const inputMode = getIdentificationInputMode(type);
  const showEcuadorLocation = !isForeign || country === "Ecuador";

  return (
    <form onSubmit={submit} className="pb-8">
      <header className="sticky top-0 z-20 -mx-4 mb-5 flex items-center justify-between gap-3 border-b border-[#E4E9F0] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div>
          <h1 className="text-xl font-semibold text-[#172033]">
            {customer ? "Editar cliente" : "Nuevo cliente"}
          </h1>
          <p className="text-xs text-[#667085]">
            Información comercial y tributaria
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/facturacion/customers">Cancelar</Link>
          </Button>
          <Button
            disabled={saving}
            className="bg-[#1E52F1] text-white hover:bg-[#1745CE]"
          >
            {saving ? "Guardando..." : "Guardar cliente"}
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
          <Toggle
            label="Facturar otra persona"
            checked={invoiceThirdParty}
            onChange={(v) => {
              setInvoiceThirdParty(v);
              if (!v) setInvoiceThirdPartyCustomerId("");
            }}
          />
        </div>

        {isRelated && (
          <Section title="Cliente relacionado">
            <Field label="Cliente vinculado" wide>
              <EntityCombobox
                name="relatedCustomerId"
                value={relatedCustomerId}
                onChange={setRelatedCustomerId}
                entities={tenantCustomers}
                excludeId={customer?.id}
                label="Buscar cliente..."
                emptyLabel="Solo marcar como parte relacionada"
              />
            </Field>
          </Section>
        )}

        {invoiceThirdParty && (
          <Section title="Facturar por defecto a">
            <Field label="Cliente destinatario fiscal" wide>
              <EntityCombobox
                name="invoiceThirdPartyCustomerId"
                value={invoiceThirdPartyCustomerId}
                onChange={setInvoiceThirdPartyCustomerId}
                entities={tenantCustomers}
                excludeId={customer?.id}
                label="Buscar cliente..."
              />
            </Field>
          </Section>
        )}

        <Section title="Datos adicionales">
          <Field label="Vendedor">
            <TenantUserSelect
              name="assignedSellerId"
              value={assignedSellerId}
              onChange={setAssignedSellerId}
              label="Vendedor"
              emptyLabel="Sin vendedor"
            />
          </Field>
          <Field label="Origen de ingresos">
            <select
              value={customerOrigin}
              onChange={(e) => setCustomerOrigin(e.target.value)}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              <option value="">Seleccionar</option>
              {ORIGIN_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              {customerOrigin &&
                !ORIGIN_OPTIONS.some((o) => o.value === customerOrigin) && (
                  <option value={customerOrigin}>{customerOrigin}</option>
                )}
            </select>
          </Field>
          <Field label="Tipo de cliente">
            <select
              name="customerType"
              defaultValue={String(customer?.customerType ?? "Público")}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              {CUSTOMER_TYPES.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Género">
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
              existingValues={existingGroups}
              label="Grupo"
              emptyLabel="SIN GRUPO"
              addLabel="+ Nuevo grupo"
            />
          </Field>
          <Field label="Observaciones" wide>
            <textarea
              name="notes"
              defaultValue={String(customer?.notes ?? "")}
              className="min-h-24 w-full rounded-lg border border-[#E4E9F0] px-3 py-2 text-sm"
            />
          </Field>
          <label className="flex items-center gap-2 text-sm">
            <input
              name="isActive"
              type="checkbox"
              defaultChecked={customer?.isActive ?? true}
            />
            Cliente activo
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

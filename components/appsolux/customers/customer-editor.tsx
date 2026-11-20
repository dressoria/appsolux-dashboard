"use client";

import Link from "next/link";
import { Children, cloneElement, isValidElement, useId, useState, type FormEvent, type ReactElement } from "react";
import { LoaderCircle, Plus, Search, X, Check, FileText, Zap, LockKeyhole, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AnimatedSegmentedControl } from "@/components/ui/animated-segmented-control";
import { AnimatedSwitch } from "@/components/ui/animated-switch";
import { BlobButton } from "@/components/ui/blob-button";
import { AnimatedFormPanel } from "@/components/ui/animated-form-panel";
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
  defaultQuickMode = false,
}: {
  customer?: Customer;
  tenantCustomers?: OtherCustomer[];
  existingSectors?: string[];
  existingGroups?: string[];
  existingZones?: string[];
  defaultQuickMode?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [quickMode, setQuickMode] = useState(!customer && defaultQuickMode);
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
    String(customer?.phone ?? ""),
    ...(customer?.phoneNumbers ?? []),
  ]);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupFeedback, setLookupFeedback] = useState("");
  const [lookupData, setLookupData] = useState<Lookup | null>(null);
  const [name, setName] = useState(String(customer?.name ?? ""));
  const [tradeName, setTradeName] = useState(String(customer?.tradeName ?? ""));
  const [address, setAddress] = useState(String(customer?.address ?? ""));
  const [internalCode, setInternalCode] = useState(String(customer?.internalCode ?? ""));
  const [notes, setNotes] = useState(String(customer?.notes ?? ""));
  const [isActive, setIsActive] = useState(customer?.isActive ?? true);
  const [customerType, setCustomerType] = useState(String(customer?.customerType ?? "Público"));
  const [province, setProvince] = useState(String(customer?.province ?? ""));
  const [city, setCity] = useState(String(customer?.city ?? ""));
  const [parish, setParish] = useState(String(customer?.parish ?? ""));
  const [country, setCountry] = useState(String(customer?.country ?? "Ecuador"));
  const [isForeign, setIsForeign] = useState(Boolean(customer?.isForeign) || isForeignIdentificationType(type));
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

  function changeIdentificationType(nextType: LightweightCustomerIdentificationType) {
    setType(nextType);
    const foreign = isForeignIdentificationType(nextType);
    setIsForeign(foreign);
    if (!foreign) setCountry("Ecuador");
    setLookupData(null);
  }

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
    } catch {
      setLookupFeedback("No se pudo consultar. Puedes completar los datos manualmente.");
    } finally {
      setLookupLoading(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    const common = { name, phone: phones[0], address, internalCode, isActive, notes };
    // Keep previously entered full-mode data when saving from quick mode.
    // A name-only customer has no fiscal identification, including no fake type.
    const payload = {
      ...common,
      tradeName,
      identificationType: quickMode && !identification.trim() ? null : type,
      identification,
      country: isForeign ? country : "Ecuador",
      province,
      city,
      parish,
      sector,
      zone,
      customerType,
      customerOrigin,
      groupName,
      assignedSellerId,
      isRelated,
      isForeign,
      invoiceThirdParty,
      emails,
      phoneNumbers: phones.slice(1),
      gender,
      relatedCustomerId: isRelated ? relatedCustomerId : "",
      invoiceThirdPartyCustomerId: invoiceThirdParty ? invoiceThirdPartyCustomerId : "",
      taxpayerStatus: lookupData?.taxpayerStatus,
      taxpayerLegalName: lookupData?.legalName,
      taxpayerTradeName: lookupData?.tradeName,
      taxpayerType: lookupData?.taxpayerType,
      economicActivity: lookupData?.economicActivity,
      taxDataSource: lookupData?.source,
      taxDataQueriedAt: lookupData?.queriedAt,
    };
    try {
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
      if (!response.ok) return setError(data.message ?? "No se pudo guardar.");
      const savedId = customer?.id ?? data.customer?.id;
      if (!savedId) throw new Error("El servidor no devolvió el cliente guardado.");
      router.push(`/facturacion/customers/${savedId}`);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "No se pudo guardar. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  const maxLen = getIdentificationMaxLength(type);
  const inputMode = getIdentificationInputMode(type);

  return (
    <form onSubmit={submit} aria-busy={saving} className="customer-editor pb-8">
      <header className="sticky top-0 z-20 -mx-4 mb-5 flex flex-col gap-3 border-b border-[#E4E9F0] bg-white/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h1 className="text-xl font-semibold text-[#172033]">
              {customer ? "Editar cliente" : "Nuevo cliente"}
            </h1>
            <p className="mt-1 text-sm text-[#667085]">
              {quickMode ? "Empieza con un nombre y completa los datos cuando lo necesites." : "Información comercial y tributaria de tu cliente."}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button asChild variant="outline" className="h-11 rounded-xl px-4">
              <Link href="/facturacion/customers">Cancelar</Link>
            </Button>
            <BlobButton
              type="submit"
              disabled={saving}
            >
              {saving ? <LoaderCircle className="motion-safe:animate-spin" /> : <Save />}
              {saving ? "Guardando..." : "Guardar cliente"}
            </BlobButton>
          </div>
        </div>
        {!customer && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
            <AnimatedSegmentedControl
              label="Modo de creación del cliente"
              value={quickMode ? "quick" : "full"}
              onValueChange={(value) => setQuickMode(value === "quick")}
              options={[
                { value: "full", label: "Completo", icon: <FileText className="size-4" /> },
                { value: "quick", label: "Rápido", icon: <Zap className="size-4" /> },
              ]}
              disabled={saving}
              className="w-full sm:w-72"
            />
            <p className="text-xs text-[#667085]">Puedes cambiar de modo sin perder lo escrito.</p>
          </div>
        )}
      </header>

      <AnimatedFormPanel mode={quickMode ? "quick" : "full"}>
      <div className="space-y-5">
        {quickMode ? (
          <Section title="Datos básicos">
            <Field label="Nombre del cliente o razón social *" wide>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Nombre o razón social"
              />
            </Field>
            <Field label="Teléfono (opcional)">
              <Input type="tel" autoComplete="tel" value={phones[0]} onChange={(e) => setPhones([e.target.value, ...phones.slice(1)])} placeholder="Ej. 099 123 4567 o +593…" />
            </Field>
            <Field label="Dirección (opcional)">
              <Input value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" placeholder="Calle, número y referencia" />
            </Field>
            <p className="text-xs text-[#667085] sm:col-span-2">Solo el nombre es obligatorio. Los datos fiscales se pueden completar después.</p>
          </Section>
        ) : (
          <>
            <Section title="Identificación">
              <Field label="Tipo de identificación">
                <select
                  value={type}
                  onChange={(e) =>
                    changeIdentificationType(e.target.value as LightweightCustomerIdentificationType)
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
                    aria-label="Número de identificación"
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
                      <LoaderCircle className="motion-safe:animate-spin" />
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
                  if (!v) setCountry("Ecuador");
                  if (v && type !== "PASSPORT" && type !== "FOREIGN_ID") {
                    changeIdentificationType("PASSPORT");
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
                  value={customerType}
                  onChange={(e) => setCustomerType(e.target.value)}
                  className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
                >
                  {CUSTOMER_TYPES.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                  {!CUSTOMER_TYPES.includes(customerType) && <option value={customerType}>{customerType || "Sin clasificación"}</option>}
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
            </Section>
          </>
        )}

        <Section title="Gestión interna">
          <Field label="Código interno de cliente (opcional)">
            <Input name="internalCode" value={internalCode} onChange={(e) => setInternalCode(e.target.value)} maxLength={100} placeholder="Ej. CLI-001" aria-describedby="customer-code-help" />
            <p id="customer-code-help" className="text-xs text-[#667085]">Referencia única en tu empresa. Es independiente de la cédula o RUC.</p>
          </Field>
          <div className="flex min-h-20 items-center justify-between gap-4 rounded-xl border border-[#E4E9F0] bg-slate-50 px-4 py-3">
            <div>
              <Label htmlFor="customer-active">Cliente {isActive ? "activo" : "inactivo"}</Label>
              <p className="mt-1 text-xs text-[#667085]">Estado del registro en tu empresa.</p>
            </div>
            <AnimatedSwitch id="customer-active" checked={isActive} onCheckedChange={setIsActive} aria-label="Cliente activo" />
          </div>
          <Field label="Observación interna (opcional)" wide>
            <textarea name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} aria-describedby="customer-notes-help" placeholder="Notas para tu equipo sobre este cliente…" className="min-h-28 w-full resize-y rounded-xl border border-[#E4E9F0] px-3 py-2.5 text-sm outline-none" />
            <p id="customer-notes-help" className="flex items-center gap-1.5 text-xs text-[#667085]"><LockKeyhole className="size-3.5 shrink-0" aria-hidden="true" />Solo para uso interno; no se incluye en comprobantes electrónicos.</p>
          </Field>
        </Section>

        {error ? (
          <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}
      </div>
      </AnimatedFormPanel>
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
    <section className="min-w-0 rounded-2xl border border-[#E4E9F0] bg-white p-4 shadow-sm shadow-slate-200/30 sm:p-6">
      <h2 className="mb-5 border-b border-[#E4E9F0] pb-3 text-sm font-semibold text-[#172033]">
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
  const id = useId();
  const items = Children.toArray(children);
  const controlIndex = items.findIndex((child) => isValidElement(child) && (child.type === Input || child.type === "select" || child.type === "textarea"));
  return (
    <div role={controlIndex < 0 ? "group" : undefined} aria-labelledby={controlIndex < 0 ? `${id}-label` : undefined} className={`min-w-0 space-y-2 ${wide ? "sm:col-span-2" : ""}`}>
      <Label id={`${id}-label`} htmlFor={controlIndex >= 0 ? id : undefined}>{label}</Label>
      {items.map((child, index) => index === controlIndex ? cloneElement(child as ReactElement<{ id?: string }>, { id }) : child)}
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
    <label className="flex min-h-11 items-center gap-2 text-sm text-[#172033]">
      <AnimatedSwitch checked={checked} onCheckedChange={onChange} aria-label={label} />
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
              aria-label={`${title}: ${index === 0 ? "principal" : index + 1}`}
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
              aria-label={`Quitar ${title.toLowerCase()}: ${index + 1}`}
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

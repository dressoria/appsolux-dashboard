"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { LoaderCircle, Plus, Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ECUADOR_LOCATIONS,
  getEcuadorCantons,
  getEcuadorParishes,
} from "@/lib/core/ecuador-locations";
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
  taxpayerType?: string;
  province?: string;
  city?: string;
  parish?: string;
  economicActivity?: string;
  queriedAt?: string;
};

export function CustomerEditor({ customer }: { customer?: Customer }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [type, setType] = useState(customer?.identificationType ?? "RUC");
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
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupMessage, setLookupMessage] = useState("");
  const [suggested, setSuggested] = useState<Lookup | null>(null);
  const [name, setName] = useState(String(customer?.name ?? ""));
  const [tradeName, setTradeName] = useState(String(customer?.tradeName ?? ""));
  const [address, setAddress] = useState(String(customer?.address ?? ""));
  const [province, setProvince] = useState(String(customer?.province ?? ""));
  const [canton, setCanton] = useState(String(customer?.city ?? ""));
  const [parish, setParish] = useState(String(customer?.parish ?? ""));
  async function searchTaxpayer() {
    setError("");
    setLookupMessage("");
    setLookupLoading(true);
    setSuggested(null);
    try {
      const response = await fetch(
        `/api/sri/taxpayer-lookup?identification=${encodeURIComponent(identification)}`,
      );
      const data = (await response.json()) as Lookup;
      if (!response.ok) {
        setLookup(null);
        setLookupMessage(
          data.message ??
            "No pudimos consultar la información tributaria en este momento. Puedes continuar manualmente.",
        );
        return;
      }
      setLookup(data);
      if (!data.found) {
        setLookupMessage(
          "No encontramos información tributaria para esta identificación. Puedes completar los datos manualmente.",
        );
        return;
      }
      const conflicts =
        (data.legalName && name && data.legalName !== name) ||
        (data.tradeName && tradeName && data.tradeName !== tradeName) ||
        (data.address && address && data.address !== address) ||
        (data.province && province && data.province !== province) ||
        (data.city && canton && data.city !== canton) ||
        (data.parish && parish && data.parish !== parish);
      if (!name && data.legalName) setName(data.legalName);
      if (!tradeName && data.tradeName) setTradeName(data.tradeName);
      if (!address && data.address) setAddress(data.address);
      if (!province && data.province) setProvince(data.province);
      if (!canton && data.city) setCanton(data.city);
      if (!parish && data.parish) setParish(data.parish);
      if (conflicts) setSuggested(data);
      setLookupMessage("Datos tributarios encontrados.");
    } finally {
      setLookupLoading(false);
    }
  }
  function useSuggested() {
    if (!suggested) return;
    if (suggested.legalName) setName(suggested.legalName);
    if (suggested.tradeName) setTradeName(suggested.tradeName);
    if (suggested.address) setAddress(suggested.address);
    if (suggested.province) setProvince(suggested.province);
    if (suggested.city) setCanton(suggested.city);
    if (suggested.parish) setParish(suggested.parish);
    setSuggested(null);
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
      country: string("country"),
      province: string("province"),
      city: string("city"),
      parish: string("parish"),
      sector: string("sector"),
      zone: string("zone"),
      customerType: string("customerType"),
      customerOrigin: string("customerOrigin"),
      groupName: string("groupName"),
      assignedSellerId: string("assignedSellerId"),
      isRelated: form.get("isRelated") === "on",
      isForeign: form.get("isForeign") === "on",
      invoiceThirdParty: form.get("invoiceThirdParty") === "on",
      notes: string("notes"),
      emails,
      phone: phones[0],
      phoneNumbers: phones.slice(1),
      isActive: form.get("isActive") === "on",
      taxpayerStatus: lookup?.taxpayerStatus,
      taxpayerLegalName: lookup?.legalName,
      taxpayerTradeName: lookup?.tradeName,
      taxpayerType: lookup?.taxpayerType,
      economicActivity: lookup?.economicActivity,
      taxDataSource: lookup?.source,
      taxDataQueriedAt: lookup?.queriedAt,
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
        <Section title="Datos principales">
          <Field label="Tipo de identificación">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              <option value="RUC">RUC</option>
              <option value="CEDULA">Cédula</option>
              <option value="PASSPORT">Pasaporte</option>
              <option value="FOREIGN_ID">Exterior</option>
            </select>
          </Field>
          <Field label="Identificación">
            <div className="flex gap-2">
              <Input
                value={identification}
                onChange={(e) => {
                  setIdentification(e.target.value);
                  setLookup(null);
                }}
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
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </Field>
          <Field label="Nombre comercial">
            <Input
              name="tradeName"
              value={tradeName}
              onChange={(event) => setTradeName(event.target.value)}
            />
          </Field>
          <Field label="Dirección">
            <Input
              name="address"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </Field>
          {type === "FOREIGN_ID" || type === "PASSPORT" ? (
            <Field label="País exterior">
              <Input
                name="country"
                defaultValue={String(
                  customer?.country === "Ecuador"
                    ? ""
                    : (customer?.country ?? ""),
                )}
                required
              />
            </Field>
          ) : (
            <input type="hidden" name="country" value="Ecuador" />
          )}
        </Section>
        {lookupMessage ? (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#E4E9F0] bg-white px-3 py-2 text-sm text-[#667085]">
            <span>{lookupMessage}</span>
            {suggested ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={useSuggested}
              >
                Usar datos encontrados
              </Button>
            ) : null}
          </div>
        ) : null}
        {lookup ? (
          <section className="rounded-xl border border-[#E4E9F0] bg-[#F8FAFD] p-4">
            {lookup.found ? (
              <>
                <p className="font-medium text-[#172033]">
                  Datos tributarios encontrados
                </p>
                <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                  {lookup.taxpayerStatus ? (
                    <Read
                      label="Estado contribuyente RUC"
                      value={lookup.taxpayerStatus}
                    />
                  ) : null}
                  {lookup.taxpayerType ? (
                    <Read
                      label="Tipo contribuyente"
                      value={lookup.taxpayerType}
                    />
                  ) : null}
                  {lookup.economicActivity ? (
                    <Read
                      label="Actividad económica"
                      value={lookup.economicActivity}
                    />
                  ) : null}
                  {lookup.source ? (
                    <Read label="Fuente" value={lookup.source} />
                  ) : null}
                  {lookup.queriedAt ? (
                    <Read
                      label="Fecha de búsqueda"
                      value={new Intl.DateTimeFormat("es-EC", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(lookup.queriedAt))}
                    />
                  ) : null}
                </div>
                <p className="mt-3 text-xs text-[#667085]">
                  Se guardarán como datos de solo lectura. Copia manualmente los
                  valores que quieras usar en los campos principales.
                </p>
              </>
            ) : (
              <p className="text-sm text-[#667085]">
                No se encontró información tributaria pública para esta
                identificación.
              </p>
            )}
          </section>
        ) : null}
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
        <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-[#E4E9F0] bg-white px-4 py-3">
          <Switch
            name="isRelated"
            label="Relacionado"
            defaultChecked={Boolean(customer?.isRelated)}
          />
          <Switch
            name="isForeign"
            label="Extranjero"
            defaultChecked={Boolean(customer?.isForeign)}
          />
          <Switch
            name="invoiceThirdParty"
            label="Facturar otra persona"
            defaultChecked={Boolean(customer?.invoiceThirdParty)}
          />
        </div>
        <Section title="Datos adicionales">
          <Field label="Provincia">
            <select
              name="province"
              value={province}
              onChange={(event) => {
                setProvince(event.target.value);
                setCanton("");
              }}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              <option value="">Seleccionar</option>
              {province &&
              !ECUADOR_LOCATIONS.some((item) => item.name === province) ? (
                <option value={province}>{province}</option>
              ) : null}
              {ECUADOR_LOCATIONS.map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Cantón / Ciudad">
            <select
              name="city"
              value={canton}
              onChange={(event) => setCanton(event.target.value)}
              disabled={!province}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Seleccionar</option>
              {canton &&
              !getEcuadorCantons(province).some(
                (item) => item.name === canton,
              ) ? (
                <option value={canton}>{canton}</option>
              ) : null}
              {getEcuadorCantons(province).map((item) => (
                <option key={item.name}>{item.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Parroquia">
            <select
              name="parish"
              value={parish}
              onChange={(event) => setParish(event.target.value)}
              disabled={!canton}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm disabled:bg-slate-50"
            >
              <option value="">Seleccionar</option>
              {parish &&
              !getEcuadorParishes(province, canton).includes(parish) ? (
                <option value={parish}>{parish}</option>
              ) : null}
              {getEcuadorParishes(province, canton).map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          {[
            "sector:Sector",
            "zone:Zona",
            "assignedSellerId:Vendedor",
            "customerOrigin:Origen de ingresos",
          ].map((item) => {
            const [name, label] = item.split(":");
            return (
              <Field key={name} label={label}>
                <Input
                  name={name}
                  defaultValue={String(customer?.[name] ?? "")}
                />
              </Field>
            );
          })}
          <Field label="Tipo de cliente">
            <select
              name="customerType"
              defaultValue={String(customer?.customerType ?? "Público")}
              className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
            >
              {[
                "Público",
                "Distribuidor",
                "Mayorista",
                "Tarjeta",
                "Precio E",
                "Precio F",
              ].map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </Field>
          <Field label="Grupo">
            <Input
              name="groupName"
              defaultValue={String(customer?.groupName ?? "SIN GRUPO")}
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
function Read({ label, value }: { label: string; value?: string }) {
  return (
    <p>
      <span className="text-[#667085]">{label}:</span> {value || "—"}
    </p>
  );
}
function Switch({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-[#172033]">
      <input
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="relative h-5 w-9 rounded-full bg-slate-300 transition-colors peer-checked:bg-[#1E52F1] after:absolute after:left-0.5 after:top-0.5 after:size-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
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

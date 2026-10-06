"use client";

import Link from "next/link";
import { LoaderCircle, Plus, Search, X } from "lucide-react";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ECUADOR_LOCATIONS,
  getEcuadorCantons,
  getEcuadorParishes,
} from "@/lib/core/ecuador-locations";
import { applySupplierLookup } from "@/lib/core/lightweight-supplier-utils";

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
  legalName?: string;
  tradeName?: string;
  province?: string;
  city?: string;
  parish?: string;
  taxpayerStatus?: string;
  taxpayerClass?: string;
  taxpayerType?: string;
  economicActivity?: string;
  ciiuCode?: string;
  accountingRequired?: boolean;
  specialTaxpayer?: boolean;
  withholdingAgent?: boolean;
  source?: string;
  sourceUpdatedAt?: string;
  queriedAt?: string;
};

export function SupplierEditor({ supplier }: { supplier?: Supplier }) {
  const router = useRouter();
  const [type, setType] = useState(
    String(supplier?.identificationType ?? "RUC"),
  );
  const [identification, setIdentification] = useState(
    String(supplier?.identification ?? ""),
  );
  const [name, setName] = useState(supplier?.name ?? "");
  const [tradeName, setTradeName] = useState(String(supplier?.tradeName ?? ""));
  const [province, setProvince] = useState(String(supplier?.province ?? ""));
  const [city, setCity] = useState(String(supplier?.city ?? ""));
  const [parish, setParish] = useState(String(supplier?.parish ?? ""));
  const [emails, setEmails] = useState([
    String(supplier?.email ?? ""),
    ...(supplier?.additionalEmails ?? []),
  ]);
  const [phones, setPhones] = useState([
    String(supplier?.phone ?? "+593"),
    ...(supplier?.phoneNumbers ?? []),
  ]);
  const [lookup, setLookup] = useState<Lookup | null>(null);
  const [suggested, setSuggested] = useState<Lookup | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  async function search() {
    setLoading(true);
    setMessage("");
    setSuggested(null);
    try {
      const response = await fetch(
        `/api/sri/taxpayer-lookup?identification=${encodeURIComponent(identification)}`,
      );
      const data = (await response.json()) as Lookup;
      if (!response.ok || !data.found) {
        setLookup(null);
        setMessage(
          data.message ??
            "No encontramos información tributaria para esta identificación. Puedes completar los datos manualmente.",
        );
        return;
      }
      setLookup(data);
      const merged = applySupplierLookup(
        { name, tradeName, province, city, parish },
        data,
      );
      setName(merged.values.name);
      setTradeName(merged.values.tradeName);
      setProvince(merged.values.province);
      setCity(merged.values.city);
      setParish(merged.values.parish);
      if (merged.conflicts) setSuggested(data);
      setMessage("Datos tributarios encontrados.");
    } finally {
      setLoading(false);
    }
  }
  function useFound() {
    if (!suggested) return;
    if (suggested.legalName) setName(suggested.legalName);
    if (suggested.tradeName) setTradeName(suggested.tradeName);
    if (suggested.province) setProvince(suggested.province);
    if (suggested.city) setCity(suggested.city);
    if (suggested.parish) setParish(suggested.parish);
    setSuggested(null);
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);
    const value = (key: string) => String(form.get(key) ?? "");
    const payload = {
      identificationType: type,
      identification,
      name,
      tradeName,
      email: emails[0],
      additionalEmails: emails.slice(1),
      phone: phones[0],
      phoneNumbers: phones.slice(1),
      address: value("address"),
      country: value("country"),
      province,
      city,
      parish,
      sector: value("sector"),
      zone: value("zone"),
      supplierType: value("supplierType"),
      supplierOrigin: value("supplierOrigin"),
      groupName: value("groupName"),
      assignedBuyerId: value("assignedBuyerId"),
      isRelated: form.get("isRelated") === "on",
      isForeign: form.get("isForeign") === "on",
      isActive: form.get("isActive") === "on",
      taxpayerStatus: lookup?.taxpayerStatus,
      taxpayerLegalName: lookup?.legalName,
      taxpayerTradeName: lookup?.tradeName,
      taxpayerClass: lookup?.taxpayerClass,
      taxpayerType: lookup?.taxpayerType,
      economicActivity: lookup?.economicActivity,
      ciiuCode: lookup?.ciiuCode,
      accountingRequired: lookup?.accountingRequired,
      specialTaxpayer: lookup?.specialTaxpayer,
      withholdingAgent: lookup?.withholdingAgent,
      taxDataSource: lookup?.source,
      taxDataSourceUpdatedAt: lookup?.sourceUpdatedAt,
      taxDataQueriedAt: lookup?.queriedAt,
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
    if (!response.ok) return setMessage(data.message ?? "No se pudo guardar.");
    router.push(`/facturacion/suppliers/${supplier?.id ?? data.supplier?.id}`);
    router.refresh();
  }
  return (
    <form onSubmit={submit} className="space-y-4 pb-8">
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-white/95 py-3">
        <div>
          <h1 className="text-xl font-semibold">
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
          <Button disabled={saving} className="bg-[#1E52F1] text-white">
            {saving ? "Guardando..." : "Guardar proveedor"}
          </Button>
        </div>
      </header>
      <Section title="Datos principales">
        <Field label="Tipo de identificación">
          <Select
            value={type}
            onChange={setType}
            options={["RUC", "CEDULA", "PASSPORT", "FOREIGN_ID"]}
          />
        </Field>
        <Field label="Identificación">
          <div className="flex gap-2">
            <Input
              value={identification}
              onChange={(e) => {
                setIdentification(e.target.value);
                setLookup(null);
              }}
            />
            <Button
              type="button"
              size="icon"
              variant="outline"
              title="Consultar datos tributarios"
              onClick={search}
              disabled={loading || !["RUC", "CEDULA"].includes(type)}
            >
              {loading ? <LoaderCircle className="animate-spin" /> : <Search />}
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
        <Field label="Dirección">
          <Input
            name="address"
            defaultValue={String(supplier?.address ?? "")}
          />
        </Field>
        {["FOREIGN_ID", "PASSPORT"].includes(type) ? (
          <Field label="País exterior">
            <Input
              name="country"
              defaultValue={String(
                supplier?.country === "Ecuador"
                  ? ""
                  : (supplier?.country ?? ""),
              )}
              required
            />
          </Field>
        ) : (
          <input type="hidden" name="country" value="Ecuador" />
        )}
      </Section>
      {message ? (
        <div className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-sm text-[#667085]">
          <span>{message}</span>
          {suggested ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={useFound}
            >
              Usar datos encontrados
            </Button>
          ) : null}
        </div>
      ) : null}
      {lookup?.found ? (
        <section className="rounded-xl border bg-[#F8FAFD] p-4">
          <h2 className="font-medium">Datos tributarios encontrados</h2>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            {[
              ["Estado", lookup.taxpayerStatus],
              ["Clase", lookup.taxpayerClass],
              ["Tipo contribuyente", lookup.taxpayerType],
              ["Actividad económica", lookup.economicActivity],
              ["CIIU", lookup.ciiuCode],
              [
                "Obligado a llevar contabilidad",
                yesNo(lookup.accountingRequired),
              ],
              ["Contribuyente especial", yesNo(lookup.specialTaxpayer)],
              ["Agente de retención", yesNo(lookup.withholdingAgent)],
              ["Fuente", lookup.source],
              ["Fecha de actualización", lookup.sourceUpdatedAt],
            ]
              .filter((item) => item[1] !== undefined)
              .map(([label, value]) => (
                <p key={String(label)}>
                  <span className="text-[#667085]">{label}:</span>{" "}
                  {String(value)}
                </p>
              ))}
          </div>
        </section>
      ) : null}
      <Section title="Contacto">
        <ArrayInput
          label="Correos electrónicos"
          values={emails}
          setValues={setEmails}
          max={5}
          type="email"
        />
        <ArrayInput
          label="Teléfonos"
          values={phones}
          setValues={setPhones}
          max={3}
          type="tel"
        />
      </Section>
      <div className="flex gap-6 rounded-xl border bg-white px-4 py-3">
        <Switch
          name="isRelated"
          label="Relacionado"
          checked={Boolean(supplier?.isRelated)}
        />
        <Switch
          name="isForeign"
          label="Extranjero"
          checked={Boolean(supplier?.isForeign)}
        />
      </div>
      <Section title="Datos adicionales">
        <Field label="Provincia">
          <select
            className="h-8 rounded-lg border px-2"
            value={province}
            onChange={(e) => {
              setProvince(e.target.value);
              setCity("");
              setParish("");
            }}
          >
            <option value="">Seleccionar</option>
            {ECUADOR_LOCATIONS.map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Cantón / Ciudad">
          <select
            className="h-8 rounded-lg border px-2"
            value={city}
            disabled={!province}
            onChange={(e) => {
              setCity(e.target.value);
              setParish("");
            }}
          >
            <option value="">Seleccionar</option>
            {getEcuadorCantons(province).map((item) => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Parroquia">
          <select
            className="h-8 rounded-lg border px-2"
            value={parish}
            disabled={!city}
            onChange={(e) => setParish(e.target.value)}
          >
            <option value="">Seleccionar</option>
            {getEcuadorParishes(province, city).map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        {[
          ["Sector", "sector"],
          ["Zona", "zone"],
          ["Tipo de proveedor", "supplierType"],
          ["Origen", "supplierOrigin"],
          ["Grupo", "groupName"],
          ["Responsable / Comprador asignado", "assignedBuyerId"],
        ].map(([label, key]) => (
          <Field key={key} label={label}>
            <Input
              name={key}
              defaultValue={String(
                supplier?.[key] ?? (key === "groupName" ? "SIN GRUPO" : ""),
              )}
            />
          </Field>
        ))}
      </Section>
      <label className="flex items-center gap-2 text-sm">
        <input
          name="isActive"
          type="checkbox"
          defaultChecked={supplier?.isActive ?? true}
        />
        Proveedor activo
      </label>
    </form>
  );
}
const yesNo = (value: boolean | undefined) =>
  value === undefined ? undefined : value ? "Sí" : "No";
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-white p-4">
      <h2 className="mb-4 font-semibold">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1.5 text-sm">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <select
      className="h-8 rounded-lg border px-2"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </select>
  );
}
function Switch({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input name={name} type="checkbox" defaultChecked={checked} />
      {label}
    </label>
  );
}
function ArrayInput({
  label,
  values,
  setValues,
  max,
  type,
}: {
  label: string;
  values: string[];
  setValues: (values: string[]) => void;
  max: number;
  type: string;
}) {
  return (
    <div>
      <div className="mb-2 flex justify-between">
        <Label>{label}</Label>
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
          <div className="flex gap-2" key={index}>
            <Input
              type={type}
              value={value}
              onChange={(e) =>
                setValues(
                  values.map((item, i) =>
                    i === index ? e.target.value : item,
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

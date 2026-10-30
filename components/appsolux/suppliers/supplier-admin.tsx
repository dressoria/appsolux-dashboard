"use client";

import Link from "next/link";
import {
  Eye,
  FileSpreadsheet,
  FileText,
  FilterX,
  Pencil,
  Plus,
  Search,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PaginationBar } from "@/components/appsolux/people/pagination-bar";

type Supplier = {
  id: string;
  identificationType: string | null;
  identification: string | null;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
  city: string | null;
  supplierType: string | null;
  supplierOrigin: string | null;
  assignedBuyerId: string | null;
  buyerName: string | null;
  isActive: boolean;
  createdAt: string;
};
type Filters = {
  q: string;
  type: string;
  status: string;
  origin: string;
};

export function SupplierAdmin({
  suppliers,
  total,
  page,
  perPage,
  filters,
}: {
  suppliers: Supplier[];
  total: number;
  page: number;
  perPage: number;
  filters: Filters;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function navigate(updates: Record<string, string>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    if (!updates.page) params.delete("page");
    router.push(`/facturacion/suppliers?${params.toString()}`);
  }

  const exportQuery = new URLSearchParams({
    q: filters.q,
    type: filters.type,
    status: filters.status,
    origin: filters.origin,
  }).toString();

  async function toggle(supplier: Supplier) {
    await fetch(`/api/basic/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !supplier.isActive }),
    });
    router.refresh();
  }

  const hasFilters = filters.q || filters.type || filters.status || filters.origin;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#172033]">Proveedores</h1>
          <p className="text-sm text-[#667085]">
            Directorio administrativo y tributario
          </p>
        </div>
        <Button asChild className="bg-[#1E52F1] text-white hover:bg-[#1745CE]">
          <Link href="/facturacion/suppliers/new">
            <Plus />
            Crear proveedor
          </Link>
        </Button>
      </header>

      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline">
          <a href={`/api/basic/suppliers/export?format=pdf&${exportQuery}`}>
            <FileText />
            PDF
          </a>
        </Button>
        <Button asChild variant="outline">
          <a href={`/api/basic/suppliers/export?format=xlsx&${exportQuery}`}>
            <FileSpreadsheet />
            Excel
          </a>
        </Button>
      </div>

      <section className="grid gap-2 rounded-xl border border-[#E4E9F0] bg-white p-3 md:grid-cols-5">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 size-4 text-[#667085]" />
          <Input
            className="pl-9"
            placeholder="Buscar proveedor..."
            defaultValue={filters.q}
            onKeyDown={(e) => {
              if (e.key === "Enter")
                navigate({ q: (e.target as HTMLInputElement).value });
            }}
          />
        </label>
        <FilterSelect
          label="Tipo de proveedor"
          value={filters.type}
          onChange={(v) => navigate({ type: v })}
          options={[
            ...new Set(
              suppliers
                .map((s) => s.supplierType)
                .filter((v): v is string => Boolean(v)),
            ),
          ]}
        />
        <FilterSelect
          label="Estado"
          value={filters.status}
          onChange={(v) => navigate({ status: v })}
          options={["active", "inactive"]}
          labels={{ active: "Activo", inactive: "Inactivo" }}
        />
        <FilterSelect
          label="Origen"
          value={filters.origin}
          onChange={(v) => navigate({ origin: v })}
          options={["NATIONAL", "FOREIGN", "MIXED"]}
          labels={{
            NATIONAL: "Nacional",
            FOREIGN: "Extranjero",
            MIXED: "Mixto",
          }}
        />
        {hasFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() =>
              navigate({ q: "", type: "", status: "", origin: "" })
            }
          >
            <FilterX className="size-3.5" />
            Limpiar
          </Button>
        )}
      </section>

      <div className="overflow-hidden rounded-xl border border-[#E4E9F0] bg-white">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-xs">
            <thead className="bg-[#F6F8FB] text-[#667085]">
              <tr>
                {[
                  "#",
                  "Tipo",
                  "Identificación",
                  "Proveedor",
                  "Origen",
                  "Email",
                  "Teléfono",
                  "Ubicación",
                  "Comprador",
                  "Registro",
                  "Estado",
                  "Acciones",
                ].map((label) => (
                  <th className="px-3 py-3 font-medium" key={label}>
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E4E9F0]">
              {suppliers.map((supplier, index) => (
                <tr key={supplier.id} className="hover:bg-[#F8FAFD]">
                  <td className="px-3 py-3">
                    {(page - 1) * perPage + index + 1}
                  </td>
                  <td className="px-3">
                    {supplier.identificationType ?? "—"}
                  </td>
                  <td className="px-3 font-medium">
                    {supplier.identification ?? "—"}
                  </td>
                  <td className="px-3">
                    <div className="font-medium text-[#172033]">
                      {supplier.name}
                    </div>
                    {supplier.tradeName && (
                      <div className="text-[10px] text-[#667085]">
                        {supplier.tradeName}
                      </div>
                    )}
                  </td>
                  <td className="px-3">{supplier.supplierOrigin ?? "—"}</td>
                  <td className="px-3">{supplier.email ?? "—"}</td>
                  <td className="px-3">{supplier.phone ?? "—"}</td>
                  <td className="px-3">
                    <div>{supplier.city ?? "—"}</div>
                    {supplier.province && (
                      <div className="text-[10px] text-[#667085]">
                        {supplier.province}
                      </div>
                    )}
                  </td>
                  <td className="px-3">{supplier.buyerName ?? "—"}</td>
                  <td className="px-3">
                    {new Intl.DateTimeFormat("es-EC").format(
                      new Date(supplier.createdAt),
                    )}
                  </td>
                  <td className="px-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${supplier.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-[#667085]"}`}
                    >
                      {supplier.isActive ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-3">
                    <div className="flex gap-1">
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        title="Ver proveedor"
                      >
                        <Link
                          href={`/facturacion/suppliers/${supplier.id}`}
                          aria-label="Ver proveedor"
                        >
                          <Eye />
                        </Link>
                      </Button>
                      <Button
                        asChild
                        size="icon-sm"
                        variant="ghost"
                        title="Editar proveedor"
                      >
                        <Link
                          href={`/facturacion/suppliers/${supplier.id}?edit=1`}
                          aria-label="Editar proveedor"
                        >
                          <Pencil />
                        </Link>
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => toggle(supplier)}
                        title={
                          supplier.isActive
                            ? "Desactivar proveedor"
                            : "Activar proveedor"
                        }
                      >
                        {supplier.isActive ? "Desactivar" : "Activar"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!suppliers.length ? (
          <p className="p-8 text-center text-sm text-[#667085]">
            No hay proveedores que coincidan con los filtros.
          </p>
        ) : null}
        <PaginationBar
          page={page}
          perPage={perPage}
          total={total}
          onPageChange={(p) => navigate({ page: String(p) })}
          onPerPageChange={(pp) => navigate({ perPage: String(pp) })}
        />
      </div>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  labels,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
  labels?: Record<string, string>;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm"
    >
      <option value="">{label}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {labels?.[option] ?? option}
        </option>
      ))}
    </select>
  );
}

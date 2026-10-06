"use client";

import Link from "next/link";
import { FileSpreadsheet, FileText, Pencil, Plus, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Supplier = {
  id: string;
  identification: string | null;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
  city: string | null;
  supplierType: string | null;
  isActive: boolean;
  createdAt: string;
};

export function SupplierAdmin({ suppliers }: { suppliers: Supplier[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const filtered = useMemo(
    () =>
      suppliers.filter((supplier) => {
        const needle = query.trim().toLowerCase();
        return (
          (!needle ||
            [
              supplier.identification,
              supplier.name,
              supplier.tradeName,
              supplier.email,
              supplier.phone,
            ].some((value) => value?.toLowerCase().includes(needle))) &&
          (!status || supplier.isActive === (status === "active")) &&
          (!type || supplier.supplierType === type)
        );
      }),
    [suppliers, query, status, type],
  );
  const exportQuery = new URLSearchParams({
    q: query,
    status,
    type,
  }).toString();
  async function toggle(supplier: Supplier) {
    await fetch(`/api/basic/suppliers/${supplier.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !supplier.isActive }),
    });
    router.refresh();
  }
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-[#172033]">Proveedores</h1>
          <p className="text-sm text-[#667085]">
            Directorio administrativo y tributario
          </p>
        </div>
        <Button asChild className="bg-[#1E52F1] text-white">
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
      <section className="grid gap-2 rounded-xl border border-[#E4E9F0] bg-white p-3 md:grid-cols-4">
        <label className="relative md:col-span-2">
          <Search className="absolute left-3 top-2.5 size-4 text-[#667085]" />
          <Input
            className="pl-9"
            placeholder="Buscar proveedor..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <select
          aria-label="Tipo"
          className="h-8 rounded-lg border px-2 text-sm"
          value={type}
          onChange={(event) => setType(event.target.value)}
        >
          <option value="">Tipo de proveedor</option>
          {[
            ...new Set(
              suppliers.map((item) => item.supplierType).filter(Boolean),
            ),
          ].map((item) => (
            <option key={item!}>{item}</option>
          ))}
        </select>
        <select
          aria-label="Estado"
          className="h-8 rounded-lg border px-2 text-sm"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="">Estado</option>
          <option value="active">Activo</option>
          <option value="inactive">Inactivo</option>
        </select>
      </section>
      <div className="overflow-x-auto rounded-xl border border-[#E4E9F0] bg-white">
        <table className="w-full min-w-[1200px] text-left text-xs">
          <thead className="bg-[#F6F8FB] text-[#667085]">
            <tr>
              {[
                "#",
                "Identificación",
                "Nombre / Razón social",
                "Nombre comercial",
                "Email",
                "Teléfono",
                "Provincia / Ciudad",
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
          <tbody className="divide-y">
            {filtered.map((supplier, index) => (
              <tr key={supplier.id}>
                <td className="px-3 py-3">{index + 1}</td>
                <td className="px-3 font-medium">
                  {supplier.identification ?? "—"}
                </td>
                <td className="px-3 font-medium text-[#172033]">
                  {supplier.name}
                </td>
                <td className="px-3">{supplier.tradeName ?? "—"}</td>
                <td className="px-3">{supplier.email ?? "—"}</td>
                <td className="px-3">{supplier.phone ?? "—"}</td>
                <td className="px-3">
                  {[supplier.province, supplier.city]
                    .filter(Boolean)
                    .join(" / ") || "—"}
                </td>
                <td className="px-3">
                  {new Intl.DateTimeFormat("es-EC").format(
                    new Date(supplier.createdAt),
                  )}
                </td>
                <td className="px-3">
                  {supplier.isActive ? "Activo" : "Inactivo"}
                </td>
                <td className="px-3">
                  <div className="flex gap-1">
                    <Button asChild size="icon-sm" variant="ghost">
                      <Link
                        href={`/facturacion/suppliers/${supplier.id}`}
                        aria-label="Editar proveedor"
                      >
                        <Pencil />
                      </Link>
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => toggle(supplier)}
                    >
                      {supplier.isActive ? "Desactivar" : "Activar"}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!filtered.length ? (
          <p className="p-8 text-center text-sm text-[#667085]">
            No hay proveedores que coincidan con los filtros.
          </p>
        ) : null}
      </div>
    </div>
  );
}

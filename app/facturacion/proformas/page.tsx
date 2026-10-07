import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { routes } from "@/config/routes";
import { listProformas } from "@/lib/core/lightweight-proformas";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function ProformasPage({
  searchParams,
}: {
  searchParams: Promise<{ search?: string; from?: string; to?: string }>;
}) {
  const [{ tenant }, params] = await Promise.all([
    requireDashboardSession(),
    searchParams,
  ]);
  const proformas = await listProformas(tenant.id, {
    search: params.search,
    from: params.from ? new Date(params.from) : undefined,
    to: params.to ? new Date(`${params.to}T23:59:59.999`) : undefined,
  });
  return (
    <DashboardShell
      contentClassName="mx-auto max-w-[1600px]"
      mainClassName="px-4 py-5 sm:px-6"
    >
      <div className="space-y-4">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold">Proformas</h1>
            <p className="text-sm text-slate-500">
              Documentos comerciales sin emisión tributaria ni movimiento de
              stock.
            </p>
          </div>
          <Button asChild>
            <Link href={routes.facturacionProformasNew}>Nueva proforma</Link>
          </Button>
        </header>
        <form className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[160px_160px_1fr_auto]">
          <Input
            name="from"
            type="date"
            defaultValue={params.from}
            aria-label="Desde"
          />
          <Input
            name="to"
            type="date"
            defaultValue={params.to}
            aria-label="Hasta"
          />
          <Input
            name="search"
            defaultValue={params.search}
            placeholder="Secuencial, cliente o identificación"
          />
          <Button type="submit" variant="outline">
            Buscar
          </Button>
        </form>
        <div className="overflow-x-auto rounded-xl border bg-white">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs text-slate-500">
              <tr>
                <th className="p-3">#</th>
                <th>Número / Secuencial</th>
                <th>Cliente</th>
                <th>Identificación</th>
                <th>Total</th>
                <th>Fecha emisión</th>
                <th>Válida hasta</th>
                <th>Estado</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {proformas.map((item, index) => {
                const snapshot = item.customerSnapshot as Record<
                  string,
                  string | null
                >;
                return (
                  <tr className="border-t" key={item.id}>
                    <td className="p-3">{index + 1}</td>
                    <td className="font-medium">{item.number}</td>
                    <td>{snapshot.name ?? "Consumidor Final"}</td>
                    <td>{snapshot.identification ?? "9999999999999"}</td>
                    <td>${item.total.toFixed(2)}</td>
                    <td>{item.issueDate.toLocaleDateString("es-EC")}</td>
                    <td>
                      {item.validUntil?.toLocaleDateString("es-EC") ?? "—"}
                    </td>
                    <td>{item.status}</td>
                    <td>
                      <div className="flex gap-2">
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/facturacion/proformas/${item.id}`}>
                            Ver / Editar
                          </Link>
                        </Button>
                        <Button asChild size="sm" variant="ghost">
                          <a
                            href={`/api/basic/proformas/${item.id}/pdf`}
                            target="_blank"
                          >
                            PDF
                          </a>
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!proformas.length ? (
            <p className="p-10 text-center text-sm text-slate-500">
              No hay proformas para los filtros seleccionados.
            </p>
          ) : null}
        </div>
      </div>
    </DashboardShell>
  );
}

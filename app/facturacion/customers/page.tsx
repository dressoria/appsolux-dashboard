import { CustomerAdmin } from "@/components/appsolux/customers/customer-admin";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getPrismaClient } from "@/lib/db/prisma";
import type { Prisma } from "@prisma/client";

const ALLOWED_PER_PAGE = [10, 20, 50, 100];

function sanitize(value: string | null, fallback: number, allowed?: number[]): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  if (allowed && !allowed.includes(n)) return fallback;
  return Math.floor(n);
}

export default async function FacturacionCustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { tenant } = await requireDashboardSession();
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const type = params.type || "";
  const status = params.status || "";
  const origin = params.origin || "";
  const province = params.province || "";
  const city = params.city || "";
  const perPage = sanitize(params.perPage ?? null, 20, ALLOWED_PER_PAGE);
  const page = sanitize(params.page ?? null, 1);

  const prisma = getPrismaClient();
  const where: Prisma.LightweightCustomerWhereInput = {
    tenantId: tenant.id,
    ...(type ? { identificationType: type as never } : {}),
    ...(status ? { isActive: status === "active" } : {}),
    ...(origin ? { customerOrigin: origin } : {}),
    ...(province ? { province } : {}),
    ...(city ? { city } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { tradeName: { contains: q, mode: "insensitive" } },
            { identification: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { phone: { contains: q } },
          ],
        }
      : {}),
  };

  const [total, customers, sellerUsers] = await Promise.all([
    prisma.lightweightCustomer.count({ where }),
    prisma.lightweightCustomer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    prisma.membership
      .findMany({
        where: { tenantId: tenant.id, status: "active" },
        include: {
          user: { select: { id: true, name: true, email: true, status: true } },
        },
      })
      .then((memberships) =>
        memberships
          .filter((m) => m.user.status === "active")
          .map((m) => ({
            id: m.user.id,
            name: m.user.name ?? m.user.email ?? m.userId,
          })),
      ),
  ]);

  const sellerMap = Object.fromEntries(sellerUsers.map((u) => [u.id, u.name]));

  const serialized = customers.map((customer) => ({
    ...customer,
    balance: customer.balance.toString(),
    createdAt: customer.createdAt.toISOString(),
    updatedAt: customer.updatedAt.toISOString(),
    taxDataQueriedAt: customer.taxDataQueriedAt?.toISOString() ?? null,
    sellerName: customer.assignedSellerId
      ? (sellerMap[customer.assignedSellerId] ?? null)
      : null,
  }));

  return (
    <DashboardShell
      contentClassName="mx-auto max-w-[1600px]"
      mainClassName="px-4 py-5 sm:px-6"
    >
      <CustomerAdmin
        customers={serialized}
        total={total}
        page={page}
        perPage={perPage}
        filters={{ q, type, status, origin, province, city }}
      />
    </DashboardShell>
  );
}

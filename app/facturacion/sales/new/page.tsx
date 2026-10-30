import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { InvoiceEditor } from "@/components/appsolux/sales/invoice-editor";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { listSriEstablishments, listSriIssuePoints } from "@/lib/core/sri";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getPrismaClient } from "@/lib/db/prisma";

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { user, tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);
  const prisma = getPrismaClient();
  const params = await searchParams;
  const aiProposalId = typeof params.aiProposalId === "string" ? params.aiProposalId : undefined;
  const aiDraftId = typeof params.aiDraftId === "string" ? params.aiDraftId : undefined;
  const draftIdParam = typeof params.draftId === "string" ? params.draftId : undefined;

  const [
    customers,
    products,
    establishments,
    issuePoints,
    warehouses,
    warehouseStocks,
    shipmentGuides,
    treasuryAccounts,
  ] = await Promise.all([
    prisma.lightweightCustomer.findMany({
      where: { tenantId: tenant.id, isActive: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
    prisma.lightweightProduct.findMany({
      where: { tenantId: tenant.id, isActive: true },
      include: { comboItems: { include: { componentProduct: true } } },
      orderBy: { name: "asc" },
      take: 500,
    }),
    listSriEstablishments(tenant.id),
    listSriIssuePoints(tenant.id),
    prisma.inventoryWarehouse.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { name: "asc" },
    }),
    prisma.inventoryStockBalance.findMany({
      where: { tenantId: tenant.id },
      select: { warehouseId: true, productId: true, quantity: true },
    }),
    prisma.shipmentGuide.findMany({
      where: { tenantId: tenant.id, saleId: null, status: { in: ["DRAFT", "ISSUED"] } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.treasuryAccount.findMany({
      where: { tenantId: tenant.id, active: true },
      orderBy: { name: "asc" },
    }),
  ]);

  let initialCustomerId: string | undefined;
  let initialLines: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
    discountPct: number;
    description: string;
  }> | undefined;
  let initialPaymentMethod: string | undefined;
  let initialSriPaymentCode: string | undefined;

  if (aiProposalId) {
    const proposal = await prisma.aiInvoiceProposal.findFirst({
      where: { id: aiProposalId, tenantId: tenant.id },
      include: { draft: true },
    });

    if (proposal) {
      const items = proposal.items as Array<{
        productId: string;
        quantity: number;
        unitPrice: string;
        discountAmount: string;
      }>;

      initialCustomerId = proposal.draft.customerId ?? undefined;
      initialPaymentMethod = proposal.draft.paymentMethod ?? "transfer";
      initialSriPaymentCode = proposal.draft.sriPaymentCode ?? "20";
      initialLines = items.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        discountPct: 0,
        description: "",
      }));
    }
  }

  let draftPayload: Record<string, unknown> | undefined;
  if (draftIdParam) {
    const draft = await prisma.salesInvoiceDraft.findFirst({
      where: { id: draftIdParam, tenantId: tenant.id, status: "DRAFT" },
    });
    if (draft) {
      draftPayload = draft.payload as Record<string, unknown>;
    }
  }

  const activeEstablishments = establishments.filter((item) => item.isActive);
  const activeIssuePoints = issuePoints.filter((item) => item.isActive);

  return (
    <DashboardShell
      contentClassName="mx-auto max-w-[1700px]"
      mainClassName="px-3 py-4 sm:px-5"
    >
      <InvoiceEditor
        currentUserName={user.name}
        submissionEnabled={!tenantMode.canUseAdvancedErp}
        submissionMessage={
          tenantMode.canUseAdvancedErp
            ? "La creación de facturas para este motor está temporalmente no disponible."
            : undefined
        }
        customers={customers.map((item) => ({
          id: item.id,
          name: item.name,
          tradeName: item.tradeName,
          identification: item.identification,
          email: item.email,
          phone: item.phone,
          address: item.address,
        }))}
        products={products.map((item) => ({
          id: item.id,
          name: item.name,
          primaryCode: item.primaryCode,
          auxiliaryCode: item.auxiliaryCode,
          description: item.description,
          price: item.price.toString(),
          price2: item.price2?.toString() ?? null,
          price3: item.price3?.toString() ?? null,
          stock:
            item.type === "COMBO"
              ? Math.max(
                  0,
                  Math.min(
                    ...item.comboItems
                      .filter((entry) => entry.componentProduct.trackInventory)
                      .map((entry) =>
                        Math.floor(
                          entry.componentProduct.stock / Number(entry.quantity),
                        ),
                      ),
                    999999,
                  ),
                )
              : item.trackInventory
                ? item.stock
                : 999999,
          taxRate: item.taxRate.toString(),
          taxCategory: item.taxCategory ?? null,
          cost: item.cost?.toString() ?? null,
          trackInventory: item.trackInventory,
          type: item.type,
        }))}
        warehouses={warehouses.map((w) => ({
          id: w.id,
          code: w.code,
          name: w.name,
          isDefault: w.isDefault,
        }))}
        warehouseStocks={warehouseStocks.map((s) => ({
          warehouseId: s.warehouseId,
          productId: s.productId,
          quantity: Number(s.quantity),
        }))}
        shipmentGuides={shipmentGuides.map((g) => ({
          id: g.id,
          number: g.number,
          status: g.status,
          destinationAddress: g.destinationAddress,
        }))}
        establishments={activeEstablishments.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
        }))}
        issuePoints={activeIssuePoints.map((item) => ({
          id: item.id,
          code: item.code,
          name: item.name,
          establishmentId: item.establishmentId,
        }))}
        treasuryAccounts={treasuryAccounts.map((a) => ({
          id: a.id,
          name: a.name,
          type: a.type,
          bankName: a.bankName,
          provider: a.provider,
          balance: a.openingBalance.toString(),
        }))}
        initialCustomerId={initialCustomerId}
        initialLines={initialLines}
        initialPaymentMethod={initialPaymentMethod}
        initialSriPaymentCode={initialSriPaymentCode}
        aiDraftId={aiDraftId}
        aiProposalId={aiProposalId}
        draftId={draftIdParam}
        draftPayload={draftPayload as any}
      />
    </DashboardShell>
  );
}

import { redirect } from "next/navigation";

import { PaddleCheckoutClient } from "@/components/appsolux/billing/paddle-checkout-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { getPaddleBillingAvailability, getPaddleEnvironment } from "@/lib/core/billing/paddle-config";
import { getPrismaClient } from "@/lib/db/prisma";
import { assertContractOwner } from "@/lib/legal/service";
import { PaddleCheckoutReview } from "@/components/appsolux/billing/paddle-checkout-review";
import {
  isPaddleBillingInterval,
  isPaddlePlanCode,
  resolvePaddlePrice,
} from "@/lib/core/billing/paddle-price-map";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function PaddleCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ planCode?: string; billingInterval?: string; intentId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!isTenantOwner(user)) redirect("/billing");
  if (!getPaddleBillingAvailability().configured) redirect("/billing");

  const tenant = await getCurrentTenant(user);
  const params = await searchParams;

  await assertContractOwner(getPrismaClient(), user.id, tenant.id);
  const intent = params.intentId ? await getPrismaClient().paddleCheckoutIntent.findFirst({ where: { id: params.intentId, tenantId: tenant.id, userId: user.id, status: "pending", environment: getPaddleEnvironment(), legalAcceptanceId: { not: null }, expiresAt: { gt: new Date() } } }) : null;
  const planCode = intent?.planCode ?? params.planCode;
  const interval = intent?.billingInterval ?? params.billingInterval;
  if (!isPaddlePlanCode(planCode) || !isPaddleBillingInterval(interval) || (params.intentId && !intent)) redirect("/billing");
  const selection = resolvePaddlePrice(planCode, interval);
  const paddleEnv = getPaddleEnvironment();
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? "";
  const current = await getPrismaClient().tenantSubscription.findFirst({ where: { tenantId: tenant.id }, orderBy: { startedAt: "desc" } });
  const changeExisting = current?.billingMode === "paddle" && current.status === "active" && !!current.providerSubscriptionId;
  if (!intent) return <DashboardShell><PaddleCheckoutReview planCode={planCode} billingInterval={interval} amount={selection.amount} name={selection.displayName} sandbox={paddleEnv === "sandbox"} changeExisting={changeExisting} /></DashboardShell>;

  return (
    <DashboardShell>
      <PaddleCheckoutClient
        priceId={selection.priceId}
        planDisplayName={selection.displayName}
        billingInterval={selection.billingInterval}
        amount={selection.amount}
        customerEmail={user.email}
        checkoutIntentToken={intent.token}
        checkoutIntentId={intent.id}
        paddleEnv={paddleEnv === "production" ? "production" : "sandbox"}
        clientToken={clientToken}
      />
    </DashboardShell>
  );
}

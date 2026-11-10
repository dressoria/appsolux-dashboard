import { redirect } from "next/navigation";

import { PaddleCheckoutClient } from "@/components/appsolux/billing/paddle-checkout-client";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { getPaddleBillingAvailability, getPaddleEnvironment } from "@/lib/core/billing/paddle-config";
import { createCheckoutIntent } from "@/lib/core/billing/paddle-billing";
import {
  isPaddleBillingInterval,
  isPaddlePlanCode,
  resolvePaddlePrice,
} from "@/lib/core/billing/paddle-price-map";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export default async function PaddleCheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ planCode?: string; billingInterval?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");

  if (!isTenantOwner(user)) redirect("/billing");
  if (!getPaddleBillingAvailability().configured) redirect("/billing");

  const tenant = await getCurrentTenant(user);
  const params = await searchParams;

  if (!isPaddlePlanCode(params.planCode) || !isPaddleBillingInterval(params.billingInterval)) {
    redirect("/billing");
  }

  const selection = resolvePaddlePrice(params.planCode, params.billingInterval);
  const paddleEnv = getPaddleEnvironment();
  const clientToken = process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN?.trim() ?? "";

  const intent = await createCheckoutIntent({
    tenantId: tenant.id,
    userId: user.id,
    planCode: params.planCode,
    billingInterval: params.billingInterval,
  });

  return (
    <DashboardShell>
      <PaddleCheckoutClient
        priceId={selection.priceId}
        planDisplayName={selection.displayName}
        billingInterval={selection.billingInterval}
        amount={selection.amount}
        customerEmail={user.email}
        checkoutIntentToken={intent.token}
        paddleEnv={paddleEnv === "production" ? "production" : "sandbox"}
        clientToken={clientToken}
      />
    </DashboardShell>
  );
}

import { BillingModuleShell } from "@/components/appsolux/billing/billing-module-shell";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return <BillingModuleShell>{children}</BillingModuleShell>;
}

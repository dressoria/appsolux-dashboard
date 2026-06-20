import { BillingModuleShell } from "@/components/appsolux/billing/billing-module-shell";

export default function BasicLayout({ children }: { children: React.ReactNode }) {
  return <BillingModuleShell>{children}</BillingModuleShell>;
}

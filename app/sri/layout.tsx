import { BillingModuleShell } from "@/components/appsolux/billing/billing-module-shell";

export default function SriLayout({ children }: { children: React.ReactNode }) {
  return <BillingModuleShell>{children}</BillingModuleShell>;
}

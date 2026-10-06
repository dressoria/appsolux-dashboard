import { CustomerEditor } from "@/components/appsolux/customers/customer-editor";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
export default function NewCustomerPage() { return <DashboardShell contentClassName="mx-auto max-w-6xl" mainClassName="px-4 sm:px-6"><CustomerEditor /></DashboardShell>; }

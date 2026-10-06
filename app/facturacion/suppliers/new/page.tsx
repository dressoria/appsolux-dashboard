import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { SupplierEditor } from "@/components/appsolux/suppliers/supplier-editor";

export default function NewSupplierPage() {
  return (
    <DashboardShell
      contentClassName="mx-auto max-w-6xl"
      mainClassName="px-4 sm:px-6"
    >
      <SupplierEditor />
    </DashboardShell>
  );
}

import { AlertTriangle } from "lucide-react";

type CoreMigrationNoticeProps = {
  coreProductCount: number;
  coreCustomerCount: number;
  type: "products" | "customers" | "inventory";
};

export function CoreMigrationNotice({
  coreProductCount,
  coreCustomerCount,
  type,
}: CoreMigrationNoticeProps) {
  const total = coreProductCount + coreCustomerCount;
  if (total === 0) return null;

  const lines: string[] = [];
  if (type === "products" || type === "inventory") {
    if (coreProductCount > 0)
      lines.push(`${coreProductCount} producto${coreProductCount !== 1 ? "s" : ""} en Básico`);
  }
  if (type === "customers") {
    if (coreCustomerCount > 0)
      lines.push(`${coreCustomerCount} cliente${coreCustomerCount !== 1 ? "s" : ""} en Básico`);
  }

  if (lines.length === 0) return null;

  return (
    <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
      <div className="space-y-1">
        <p className="font-medium">
          Tienes datos básicos pendientes de migrar a Gestión Empresarial.
        </p>
        <p className="text-xs text-amber-700">
          {lines.join(" · ")}. Ejecuta el script de migración para incorporarlos al motor
          empresarial:{" "}
          <code className="rounded bg-amber-100 px-1 py-0.5 font-mono text-[11px]">
            npm run maintenance:upgrade-core-to-business-suite
          </code>
        </p>
      </div>
    </div>
  );
}

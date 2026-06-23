"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ModeSwitcherProps = {
  canUseBasic: boolean;
  canUseErp: boolean;
  erpStatusLabel: string;
  basicHref: string;
  erpHref: string;
  upgradeHref: string;
};

function getCurrentMode(pathname: string) {
  if (pathname.startsWith("/basic")) {
    return "basic";
  }

  if (
    pathname.startsWith("/erp") ||
    pathname.startsWith("/pos") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings")
  ) {
    return "erp";
  }

  return "neutral";
}

export function ModeSwitcher({
  canUseBasic,
  canUseErp,
  erpStatusLabel,
  basicHref,
  erpHref,
  upgradeHref,
}: ModeSwitcherProps) {
  const pathname = usePathname();
  const currentMode = getCurrentMode(pathname);
  const erpTarget = canUseErp ? erpHref : upgradeHref;
  const basicLabel = canUseErp ? "Historial Basico" : "Basico";
  const erpLabel = canUseErp ? "Gestion Empresarial" : "Activar Gestion";

  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-1 rounded-lg border bg-muted/30 p-1"
      aria-label="Selector de modo Appsolux"
    >
      <Button
        asChild={canUseBasic}
        type="button"
        size="sm"
        variant={currentMode === "basic" ? "default" : "ghost"}
        disabled={!canUseBasic}
        className={cn(
          "h-7 px-2 text-xs",
          currentMode !== "basic" && "text-muted-foreground"
        )}
      >
        {canUseBasic ? <Link href={basicHref}>{basicLabel}</Link> : <span>{basicLabel}</span>}
      </Button>
      <Button
        asChild
        size="sm"
        variant={currentMode === "erp" ? "default" : "ghost"}
        title={
          canUseErp
            ? "Gestion Empresarial activa"
            : "Gestion Empresarial requiere activacion"
        }
        className={cn(
          "h-7 px-2 text-xs",
          currentMode !== "erp" && "text-muted-foreground"
        )}
      >
        <Link href={erpTarget}>{erpLabel}</Link>
      </Button>
      {!canUseErp ? (
        <span className="hidden px-2 text-[11px] text-muted-foreground xl:inline">
          {erpStatusLabel}
        </span>
      ) : null}
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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

  return (
    <div
      className="flex max-w-full flex-wrap items-center gap-2"
      aria-label="Estado del motor de facturacion"
    >
      <Link
        href={erpTarget}
        className={cn(
          "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition",
          currentMode === "erp"
            ? "border-sky-200 bg-sky-50 text-sky-800"
            : "border-slate-200 bg-white text-slate-700 hover:border-sky-200 hover:text-sky-800"
        )}
        title={canUseErp ? "Facturacion con motor empresarial activo" : erpStatusLabel}
      >
        <span>Facturacion</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px]",
            canUseErp
              ? "bg-emerald-100 text-emerald-700"
              : "bg-slate-100 text-slate-600"
          )}
        >
          {canUseErp ? "Gestion Empresarial activa" : "Motor basico"}
        </span>
      </Link>
      {canUseBasic ? (
        <Link
          href={basicHref}
          className={cn(
            "inline-flex items-center rounded-full border px-3 py-1.5 text-xs transition",
            currentMode === "basic"
              ? "border-slate-300 bg-slate-100 text-slate-800"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
          )}
        >
          {canUseErp ? "Historial basico" : "Basico"}
        </Link>
      ) : null}
      {!canUseErp ? (
        <Link
          href={upgradeHref}
          className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-sky-200 hover:text-sky-800"
          title={erpStatusLabel}
        >
          Activar Gestion Empresarial
        </Link>
      ) : null}
    </div>
  );
}

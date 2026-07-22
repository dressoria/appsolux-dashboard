"use client";

import Link from "next/link";

type ModeSwitcherProps = {
  modeLabel: string;
  href: string;
};

export function ModeSwitcher({
  modeLabel,
  href,
}: ModeSwitcherProps) {
  return (
    <Link
      href={href}
      className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
      aria-label="Estado del plan operativo"
    >
      {modeLabel}
    </Link>
  );
}

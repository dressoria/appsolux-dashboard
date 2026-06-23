"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Lock,
  Package,
  ReceiptText,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Wallet,
  Archive,
  type LucideIcon,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type NavLink = {
  kind: "link";
  icon: LucideIcon;
  label: string;
  href: string;
  exact: boolean;
};

type NavLocked = {
  kind: "locked";
  icon: LucideIcon;
  label: string;
};

type NavItem = NavLink | NavLocked;

type NavSubSection = {
  key: string;
  label: string;
  items: NavItem[];
};

type NavGroupNested = {
  key: string;
  section: string;
  subsections: NavSubSection[];
};

type NavGroupFlat = {
  key: string;
  section: string;
  items: NavItem[];
};

type NavGroup = NavGroupFlat | NavGroupNested;

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS: NavGroup[] = [
  {
    key: "transacciones",
    section: "Transacciones",
    subsections: [
      {
        key: "ventas",
        label: "Ventas",
        items: [
          { kind: "link", icon: ShoppingCart, label: "Facturar", href: "/basic/pos", exact: false },
          { kind: "link", icon: ReceiptText, label: "Documentos", href: "/basic/sales", exact: false },
          { kind: "locked", icon: Lock, label: "Órdenes de venta" },
          { kind: "locked", icon: Lock, label: "Proformas" },
        ],
      },
      {
        key: "compras",
        label: "Compras",
        items: [
          { kind: "locked", icon: Lock, label: "Documentos" },
          { kind: "locked", icon: Lock, label: "Registrar compra" },
        ],
      },
    ],
  },
  {
    key: "gestion",
    section: "Gestión",
    items: [
      { kind: "link", icon: Users, label: "Clientes", href: "/basic/customers", exact: false },
      { kind: "link", icon: Package, label: "Productos", href: "/basic/products", exact: false },
      { kind: "link", icon: Archive, label: "Inventario", href: "/basic/stock", exact: false },
      { kind: "link", icon: Wallet, label: "Caja / Pagos", href: "/basic/cash", exact: false },
      { kind: "link", icon: BarChart3, label: "Reportes", href: "/reports", exact: false },
    ],
  },
  {
    key: "sistema",
    section: "Sistema",
    items: [
      { kind: "link", icon: Shield, label: "SRI", href: "/sri", exact: true },
      { kind: "link", icon: Settings, label: "Configuración", href: "/settings", exact: false },
    ],
  },
];

// Default open state: Transacciones + Ventas open, everything else closed
const DEFAULT_OPEN: Record<string, boolean> = {
  transacciones: true,
  ventas: true,
  compras: false,
  gestion: true,
  sistema: false,
};

const STORAGE_KEY = "billing-sidebar-open";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAllItems(groups: NavGroup[]): NavItem[] {
  const all: NavItem[] = [];
  for (const group of groups) {
    if ("subsections" in group) {
      for (const sub of group.subsections) all.push(...sub.items);
    } else {
      all.push(...group.items);
    }
  }
  return all;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function BillingModuleSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>(DEFAULT_OPEN);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setOpen({ ...DEFAULT_OPEN, ...JSON.parse(raw) });

      const wasCollapsed = localStorage.getItem("billing-sidebar-collapsed") === "true";
      setCollapsed(wasCollapsed);
    } catch {}
  }, []);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("billing-sidebar-collapsed", String(next)); } catch {}
  }

  function toggleSection(key: string) {
    setOpen((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  }

  function isActive(item: NavLink): boolean {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");
  }

  // ── Render helpers ───────────────────────────────────────────────────────

  function renderNavItem(item: NavItem, indent = false) {
    const indentClass = indent && !collapsed ? "pl-5" : "";

    if (item.kind === "locked") {
      return (
        <div
          key={item.label}
          title={item.label + " · Disponible con plan ERP"}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-not-allowed select-none opacity-40 ${
            collapsed ? "justify-center" : indentClass
          }`}
        >
          <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-300" />
          {!collapsed && (
            <>
              <span className="text-sm text-slate-400">{item.label}</span>
              <span className="ml-auto shrink-0 rounded-full border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wide text-slate-400">
                ERP
              </span>
            </>
          )}
        </div>
      );
    }

    const active = isActive(item);
    return (
      <Link
        key={item.href}
        href={item.href}
        title={collapsed ? item.label : undefined}
        className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
          collapsed ? "justify-center" : indentClass
        } ${
          active
            ? "bg-[#004080]/10 font-medium text-[#004080]"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
        }`}
      >
        <item.icon
          className={`h-4 w-4 shrink-0 ${active ? "text-[#004080]" : "text-slate-400"}`}
        />
        {!collapsed && <span>{item.label}</span>}
      </Link>
    );
  }

  // ── Collapsed mode: flat list of all icons ───────────────────────────────

  if (collapsed) {
    return (
      <aside
        className="relative flex w-16 shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200"
        style={{ minHeight: "100vh" }}
      >
        <div className="flex h-14 shrink-0 items-center justify-center border-b border-slate-100 px-3">
          <button
            onClick={toggleCollapsed}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            aria-label="Expandir menú"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col overflow-y-auto p-2 pt-3 gap-0.5">
          {getAllItems(NAV_GROUPS).map((item) => renderNavItem(item))}
        </nav>

        <div className="shrink-0 border-t border-slate-100 p-2">
          <Link
            href="/workspace"
            title="Volver al workspace"
            className="flex items-center justify-center rounded-xl px-3 py-2.5 text-slate-500 transition hover:bg-slate-50 hover:text-[#004080]"
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
          </Link>
        </div>
      </aside>
    );
  }

  // ── Expanded mode: full collapsible structure ────────────────────────────

  return (
    <aside
      className="relative flex w-60 shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200"
      style={{ minHeight: "100vh" }}
    >
      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4">
        <div className="flex items-center gap-2.5">
          <div className="h-5 w-1 rounded-full bg-[#004080]" />
          <span className="text-sm font-bold tracking-tight text-[#004080]">Facturación</span>
        </div>
        <button
          onClick={toggleCollapsed}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Colapsar menú"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 pt-3">
        {NAV_GROUPS.map((group) => {
          const isGroupOpen = open[group.key] ?? true;

          return (
            <div key={group.key} className="mb-1">
              {/* Section header — clickable toggle */}
              <button
                type="button"
                onClick={() => toggleSection(group.key)}
                className="flex w-full items-center justify-between px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span>{group.section}</span>
                <ChevronDown
                  className={`h-3 w-3 shrink-0 transition-transform ${
                    isGroupOpen ? "rotate-0" : "-rotate-90"
                  }`}
                />
              </button>

              {isGroupOpen && (
                <div className="mt-0.5">
                  {"subsections" in group ? (
                    // Nested: Transacciones → Ventas, Compras
                    group.subsections.map((sub) => {
                      const isSubOpen = open[sub.key] ?? true;
                      return (
                        <div key={sub.key} className="mb-0.5">
                          {/* Subsection toggle */}
                          <button
                            type="button"
                            onClick={() => toggleSection(sub.key)}
                            className="flex w-full items-center justify-between px-3 py-1.5 text-[8px] font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-500 transition-colors"
                          >
                            <span>{sub.label}</span>
                            <ChevronDown
                              className={`h-2.5 w-2.5 shrink-0 transition-transform ${
                                isSubOpen ? "rotate-0" : "-rotate-90"
                              }`}
                            />
                          </button>

                          {isSubOpen && (
                            <div className="flex flex-col gap-0.5">
                              {sub.items.map((item) => renderNavItem(item, true))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  ) : (
                    // Flat: Gestión, Sistema
                    <div className="flex flex-col gap-0.5">
                      {group.items.map((item) => renderNavItem(item))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Back to workspace */}
      <div className="shrink-0 border-t border-slate-100 p-2">
        <Link
          href="/workspace"
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-[#004080]"
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          <span>Volver al workspace</span>
        </Link>
      </div>
    </aside>
  );
}

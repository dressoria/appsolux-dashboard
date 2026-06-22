"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
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
  label: string;
  items: NavItem[];
};

type NavGroupFlat = {
  section: string;
  items: NavItem[];
};

type NavGroupNested = {
  section: string;
  subsections: NavSubSection[];
};

type NavGroup = NavGroupFlat | NavGroupNested;

const NAV_GROUPS: NavGroup[] = [
  {
    section: "Transacciones",
    subsections: [
      {
        label: "Ventas",
        items: [
          { kind: "link", icon: ShoppingCart, label: "Facturar", href: "/basic/pos", exact: false },
          { kind: "link", icon: ReceiptText, label: "Documentos", href: "/basic/sales", exact: false },
          { kind: "locked", icon: Lock, label: "Órdenes de venta" },
          { kind: "locked", icon: Lock, label: "Proformas" },
        ],
      },
      {
        label: "Compras",
        items: [
          { kind: "locked", icon: Lock, label: "Documentos" },
          { kind: "locked", icon: Lock, label: "Registrar compra" },
        ],
      },
    ],
  },
  {
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
    section: "Sistema",
    items: [
      { kind: "link", icon: Shield, label: "SRI", href: "/sri", exact: true },
      { kind: "link", icon: Settings, label: "Configuración", href: "/settings", exact: false },
    ],
  },
];

export function BillingModuleSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("billing-sidebar-collapsed") === "true");
    } catch {}
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      localStorage.setItem("billing-sidebar-collapsed", String(next));
    } catch {}
  }

  function isActive(item: NavLink): boolean {
    return item.exact
      ? pathname === item.href
      : pathname === item.href || pathname.startsWith(item.href + "/");
  }

  function renderItem(item: NavItem) {
    if (item.kind === "locked") {
      return (
        <div
          key={item.label}
          title={collapsed ? `${item.label} · Disponible con plan ERP` : "Disponible con plan ERP"}
          className={`flex items-center gap-3 rounded-xl px-3 py-2 cursor-not-allowed select-none opacity-45 ${
            collapsed ? "justify-center" : ""
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
          collapsed ? "justify-center" : ""
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

  return (
    <aside
      className={`relative flex shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-60"
      }`}
      style={{ minHeight: "100vh" }}
    >
      {/* Header */}
      <div
        className={`flex h-14 shrink-0 items-center border-b border-slate-100 ${
          collapsed ? "justify-center px-3" : "justify-between px-4"
        }`}
      >
        {!collapsed && (
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-1 rounded-full bg-[#004080]" />
            <span className="text-sm font-bold tracking-tight text-[#004080]">
              Facturación
            </span>
          </div>
        )}
        <button
          onClick={toggle}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav groups */}
      <nav className="flex flex-1 flex-col overflow-y-auto p-2 pt-3">
        {NAV_GROUPS.map((group) => (
          <div key={group.section} className="mb-1">
            {/* Section header */}
            {!collapsed && (
              <p className="mb-0.5 px-3 pt-2 pb-0.5 text-[9px] font-bold uppercase tracking-widest text-slate-400">
                {group.section}
              </p>
            )}

            {"subsections" in group ? (
              // Nested group: Transacciones → Ventas, Compras
              group.subsections.map((sub) => (
                <div key={sub.label} className="mb-1">
                  {!collapsed && (
                    <p className="mb-0.5 px-3 pt-1.5 pb-0.5 text-[8px] font-semibold uppercase tracking-wider text-slate-300">
                      {sub.label}
                    </p>
                  )}
                  <div className="flex flex-col gap-0.5">
                    {sub.items.map((item) => renderItem(item))}
                  </div>
                </div>
              ))
            ) : (
              // Flat group: Gestión, Sistema
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => renderItem(item))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* Back to workspace */}
      <div className="shrink-0 border-t border-slate-100 p-2">
        <Link
          href="/workspace"
          title={collapsed ? "Volver al workspace" : undefined}
          className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-500 transition hover:bg-slate-50 hover:text-[#004080] ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <ArrowLeft className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Volver al workspace</span>}
        </Link>
      </div>
    </aside>
  );
}

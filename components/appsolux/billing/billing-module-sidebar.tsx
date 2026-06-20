"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  FileCheck2,
  LayoutDashboard,
  Package,
  ReceiptText,
  Settings,
  Shield,
  ShoppingCart,
  Users,
  Wallet,
  Archive,
} from "lucide-react";

const NAV_ITEMS = [
  { icon: LayoutDashboard, label: "Inicio", href: "/sales", exact: true },
  { icon: ShoppingCart, label: "Nueva venta", href: "/basic/pos", exact: false },
  { icon: ReceiptText, label: "Ventas", href: "/basic/sales", exact: false },
  { icon: Users, label: "Clientes", href: "/basic/customers", exact: false },
  { icon: Package, label: "Productos", href: "/basic/products", exact: false },
  { icon: Archive, label: "Inventario", href: "/basic/stock", exact: false },
  { icon: FileCheck2, label: "Comprobantes", href: "/sri/documents", exact: false },
  { icon: Wallet, label: "Caja / Pagos", href: "/basic/cash", exact: false },
  { icon: BarChart3, label: "Reportes", href: "/reports", exact: false },
  { icon: Shield, label: "SRI", href: "/sri", exact: true },
  { icon: Settings, label: "Configuración", href: "/settings", exact: false },
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

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto p-2 pt-3">
        {NAV_ITEMS.map(({ icon: Icon, label, href, exact }) => {
          const isActive = exact
            ? pathname === href
            : pathname === href || pathname.startsWith(href + "/");

          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : undefined}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                collapsed ? "justify-center" : ""
              } ${
                isActive
                  ? "bg-[#004080]/10 font-medium text-[#004080]"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-[#004080]" : "text-slate-400"
                }`}
              />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
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

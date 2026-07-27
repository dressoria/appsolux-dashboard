"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  CreditCard,
  FileCheck,
  FileText,
  FolderTree,
  LayoutGrid,
  Menu,
  MessageSquareText,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings2,
  ShoppingCart,
  Sparkles,
  Users,
  Warehouse,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { cn } from "@/lib/utils";
import { LogoutButton } from "./logout-button";
import type { NavGroup, SidebarIconName } from "./sidebar";

type DashboardFrameProps = {
  children: ReactNode;
  hideTopbar?: boolean;
  mainClassName: string;
  contentClassName: string;
  userName: string;
  tenantName: string;
  modeLabel: string;
  navigationGroups: NavGroup[];
  clerkActive: boolean;
};

const SIDEBAR_STORAGE_KEY = "facturom.sidebar.collapsed";

const sidebarIcons: Record<SidebarIconName, LucideIcon> = {
  archive: Archive,
  "bar-chart-3": BarChart3,
  "book-open": BookOpen,
  "building-2": Building2,
  "credit-card": CreditCard,
  "file-check": FileCheck,
  "file-text": FileText,
  "folder-tree": FolderTree,
  "layout-grid": LayoutGrid,
  "message-square-text": MessageSquareText,
  package: Package,
  receipt: Receipt,
  "settings-2": Settings2,
  "shopping-cart": ShoppingCart,
  sparkles: Sparkles,
  users: Users,
  warehouse: Warehouse,
  "wallet-cards": WalletCards,
};

function FacturomBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href={routes.facturacion} className="flex items-center gap-3">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[20px] bg-gradient-to-br from-[#588100] via-[#8db600] to-[#7f00b2] text-white shadow-lg shadow-[#588100]/15">
        <span className="text-[11px] font-black uppercase tracking-[0.22em]">FT</span>
      </div>
      <div className={cn("min-w-0", collapsed && "hidden")}>
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">
          Facturom
        </p>
        <p className="truncate text-base font-black text-slate-950">Facturación</p>
      </div>
    </Link>
  );
}

export function DashboardFrame({
  children,
  hideTopbar = false,
  mainClassName,
  contentClassName,
  userName,
  tenantName,
  modeLabel,
  navigationGroups,
  clerkActive,
}: DashboardFrameProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedValue === "1") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const sidebarWidth = collapsed ? "lg:w-24" : "lg:w-[304px]";

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-slate-200/80 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <FacturomBrand collapsed={collapsed} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:inline-flex"
            aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(false)}
            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={cn(
            "mt-4 rounded-[24px] border border-[#588100]/12 bg-gradient-to-br from-[#588100]/10 via-white to-[#bc4ed8]/10 p-4 shadow-sm",
            collapsed && "hidden"
          )}
        >
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#588100]">
            Módulo principal
          </p>
          <p className="mt-2 text-base font-black text-slate-950">Centro de facturación</p>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Vende, factura y controla tu operación desde una estructura constante de Facturom.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-5">
          {navigationGroups.map((group) => (
            <div key={group.title} className="space-y-2">
              <p
                className={cn(
                  "px-3 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400",
                  collapsed && "sr-only"
                )}
              >
                {group.title}
              </p>
              <div className="space-y-1">
                {group.items.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = sidebarIcons[item.icon];
                  return (
                    <Link
                      key={`${group.title}-${item.href}-${item.title}`}
                      href={item.href}
                      title={collapsed ? item.title : undefined}
                      className={cn(
                        "group relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-sm transition-all",
                        active
                          ? "bg-gradient-to-r from-[#588100]/12 via-[#8db600]/10 to-[#bc4ed8]/12 text-slate-950 shadow-sm"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                        collapsed && "justify-center px-2"
                      )}
                    >
                      <div
                        className={cn(
                          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                          active
                            ? "bg-white text-[#588100] shadow-sm"
                            : "bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-[#7f00b2]"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={cn("truncate", collapsed && "hidden")}>{item.title}</span>
                      {collapsed ? (
                        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 hidden -translate-y-1/2 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-lg group-hover:block">
                          {item.title}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(141,182,0,0.10),_transparent_24%),radial-gradient(circle_at_top_right,_rgba(188,78,216,0.08),_transparent_20%),linear-gradient(180deg,_#f8fafc_0%,_#ffffff_48%,_#f5f7fb_100%)]">
      <div className="lg:flex">
        <div className="hidden border-r border-slate-200/80 bg-white/80 backdrop-blur-xl lg:block">
          <aside className={cn("min-h-screen transition-[width] duration-300", sidebarWidth)}>
            {sidebarContent}
          </aside>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
        ) : null}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[320px] border-r border-slate-200/80 bg-white/95 backdrop-blur-xl transition-transform duration-300 lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>

        <div className="min-h-screen min-w-0 flex-1">
          {hideTopbar ? null : (
            <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
              <div className="flex min-h-16 items-center justify-between gap-4 px-4 py-3 sm:px-6">
                <div className="flex min-w-0 items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setMobileOpen(true)}
                    className="rounded-full border-slate-200 lg:hidden"
                    aria-label="Abrir menú"
                  >
                    <Menu className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setCollapsed((value) => !value)}
                    className="hidden rounded-full border-slate-200 lg:inline-flex"
                    aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
                  >
                    {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                      Facturom
                    </p>
                    <p className="truncate text-sm font-semibold text-slate-900">
                      Facturación y operación
                    </p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm sm:block">
                    {modeLabel}
                  </div>
                  <div className="hidden max-w-44 truncate rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm md:block">
                    {tenantName}
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-semibold text-slate-900">{userName}</p>
                    <p className="text-xs text-slate-500">Espacio interno</p>
                  </div>
                  {clerkActive ? <UserButton appearance={{ elements: { avatarBox: "h-8 w-8" } }} /> : <LogoutButton />}
                </div>
              </div>
            </header>
          )}

          <main className={mainClassName}>
            <div className={contentClassName}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

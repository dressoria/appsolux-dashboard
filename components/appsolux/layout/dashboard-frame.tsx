"use client";

import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  Archive,
  BarChart3,
  BookOpen,
  Building2,
  ChevronDown,
  CreditCard,
  FileCheck,
  FileText,
  FolderTree,
  LayoutGrid,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Users,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import { UserButton } from "@clerk/nextjs";

import { Button } from "@/components/ui/button";
import { FacturomBrand as FacturomBrandLogo } from "@/components/public/facturom-brand";
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
const SIDEBAR_OPEN_STORAGE_KEY = "facturom.sidebar.open-groups";

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
  package: Package,
  receipt: Receipt,
  "settings-2": Settings2,
  "shield-check": ShieldCheck,
  "shopping-cart": ShoppingCart,
  users: Users,
  "wallet-cards": WalletCards,
};

function FacturomBrand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link href={routes.facturacion} className="flex min-w-0 items-center" aria-label="Ir al inicio de Facturom">
      <FacturomBrandLogo
        variant="white"
        iconOnly={collapsed}
        imageClassName={cn("w-auto object-contain", collapsed ? "h-9" : "h-9 max-w-[150px]")}
      />
    </Link>
  );
}

function matchesPath(pathname: string, href: string, exact = false) {
  return exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`);
}

function groupContainsPath(group: NavGroup, pathname: string) {
  return group.items.some((entry) =>
    entry.kind === "link"
      ? matchesPath(pathname, entry.href, entry.exact)
      : entry.items.some((item) => matchesPath(pathname, item.href, item.exact))
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
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const storedValue = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (storedValue === "1") {
      setCollapsed(true);
    }
    try {
      const storedGroups = window.localStorage.getItem(SIDEBAR_OPEN_STORAGE_KEY);
      if (storedGroups) setOpenGroups(JSON.parse(storedGroups) as Record<string, boolean>);
    } catch {
      setOpenGroups({});
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    setMobileOpen(false);
    const activeGroup = navigationGroups.find((group) => groupContainsPath(group, pathname));
    if (activeGroup && !activeGroup.direct) {
      setOpenGroups((current) => ({ ...current, [activeGroup.key]: true }));
    }
  }, [navigationGroups, pathname]);

  function toggleGroup(key: string) {
    setOpenGroups((current) => {
      const next = { ...current, [key]: !current[key] };
      window.localStorage.setItem(SIDEBAR_OPEN_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }

  const sidebarWidth = collapsed ? "lg:w-20" : "lg:w-64";
  const activeGroupKey = navigationGroups.find((group) => groupContainsPath(group, pathname))?.key;

  function renderLink(
    item: Extract<NavGroup["items"][number], { kind: "link" }>,
    key: string,
    nested = false,
    activeAllowed = true
  ) {
    const active = activeAllowed && matchesPath(pathname, item.href, item.exact);
    const Icon = item.icon ? sidebarIcons[item.icon] : null;

    return (
      <Link
        key={key}
        href={item.href}
        className={cn(
          "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors",
          nested && "ml-2 pl-4 text-[13px]",
          active
            ? "bg-facturom-primary text-white"
            : "text-white/70 hover:bg-white/[0.07] hover:text-white"
        )}
      >
        {Icon ? <Icon className="h-4 w-4 shrink-0" /> : <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />}
        <span className="truncate">{item.title}</span>
      </Link>
    );
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      <div className="border-b border-white/10 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <FacturomBrand collapsed={collapsed} />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setCollapsed((value) => !value)}
            className="hidden rounded-full text-white/65 hover:bg-white/10 hover:text-white lg:inline-flex"
            aria-label={collapsed ? "Expandir sidebar" : "Contraer sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setMobileOpen(false)}
            className="rounded-full text-white/65 hover:bg-white/10 hover:text-white lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          {navigationGroups.map((group) => {
            const Icon = sidebarIcons[group.icon];
            const groupActive = activeGroupKey === group.key;
            const firstEntry = group.items[0];
            const firstLink = firstEntry?.kind === "link" ? firstEntry : firstEntry?.items[0];

            if (collapsed) {
              return firstLink ? (
                <Link
                  key={group.key}
                  href={firstLink.href}
                  title={group.title}
                  className={cn(
                    "flex items-center justify-center rounded-xl px-2 py-2.5 transition-colors",
                    groupActive ? "bg-facturom-primary text-white" : "text-white/70 hover:bg-white/[0.07] hover:text-white"
                  )}
                >
                  <Icon className="h-5 w-5" />
                </Link>
              ) : null;
            }

            if (group.direct && firstLink) {
              return (
                <Link
                  key={group.key}
                  href={firstLink.href}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    groupActive ? "bg-facturom-primary text-white" : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {firstLink.title}
                </Link>
              );
            }

            const open = openGroups[group.key] ?? groupActive;
            return (
              <div key={group.key} className="space-y-1">
                <button
                  type="button"
                  onClick={() => toggleGroup(group.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
                    groupActive ? "text-white" : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                  )}
                  aria-expanded={open}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="min-w-0 flex-1 truncate text-left">{group.title}</span>
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
                </button>
                {open ? (
                  <div className="space-y-1 border-l border-white/10 pl-2">
                    {group.items.map((entry, index) =>
                      entry.kind === "link" ? (
                        renderLink(entry, `${group.key}-${entry.href}`, false, groupActive)
                      ) : (
                        <div key={`${group.key}-${entry.title}-${index}`} className="space-y-1 py-1">
                          <p className="px-4 pt-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                            {entry.title}
                          </p>
                          {entry.items.map((item) => renderLink(item, `${group.key}-${entry.title}-${item.href}`, true, groupActive))}
                        </div>
                      )
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-facturom-bg">
      <div className="lg:flex">
        <div className="hidden bg-facturom-sidebar lg:block">
          <aside className={cn("sticky top-0 h-screen transition-[width] duration-300", sidebarWidth)}>
            {sidebarContent}
          </aside>
        </div>

        {mobileOpen ? (
          <div className="fixed inset-0 z-40 bg-slate-950/40 backdrop-blur-sm lg:hidden" onClick={() => setMobileOpen(false)} />
        ) : null}

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 w-[88vw] max-w-[320px] bg-facturom-sidebar shadow-2xl transition-transform duration-300 lg:hidden",
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          {sidebarContent}
        </aside>

        <div className="min-h-screen min-w-0 flex-1">
          {hideTopbar ? null : (
            <header className="sticky top-0 z-30 border-b border-facturom-border bg-white">
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
                    <p className="text-xs font-medium text-facturom-text-muted">Empresa activa</p>
                    <p className="truncate text-sm font-semibold text-facturom-text">{tenantName}</p>
                  </div>
                </div>

                <div className="flex min-w-0 items-center gap-2 sm:gap-3">
                  <div className="hidden rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-500 shadow-sm sm:block">
                    {modeLabel}
                  </div>
                  <div className="hidden text-right lg:block">
                    <p className="text-sm font-semibold text-slate-900">{userName}</p>
                    <p className="text-xs text-slate-500">Cuenta activa</p>
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

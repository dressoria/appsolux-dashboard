import Link from "next/link";
import { dashboardNavigation } from "@/config/navigation";

const navigationGroups = [
  {
    title: "General",
    items: dashboardNavigation.filter((item) =>
      ["/dashboard", "/conversations", "/channels", "/automations", "/notifications"].includes(
        item.href
      )
    ),
  },
  {
    title: "Modo Basico",
    items: dashboardNavigation.filter((item) => item.href === "/basic"),
  },
  {
    title: "ERP Avanzado",
    items: dashboardNavigation.filter((item) =>
      ["/erp", "/pos", "/reports"].includes(item.href)
    ),
  },
  {
    title: "Cuenta",
    items: dashboardNavigation.filter((item) =>
      ["/billing", "/settings"].includes(item.href)
    ),
  },
];

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r bg-background px-4 py-6 lg:block">
      <div className="mb-8 px-2">
        <p className="text-sm text-muted-foreground">Appsolux</p>
        <h2 className="text-xl font-semibold tracking-tight">Client Portal</h2>
      </div>

      <nav className="space-y-5">
        {navigationGroups.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-3 text-xs font-medium uppercase text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
              >
                {item.title}
              </Link>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

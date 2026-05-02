import Link from "next/link";
import { dashboardNavigation } from "@/config/navigation";

export function Sidebar() {
  return (
    <aside className="hidden min-h-screen w-72 border-r bg-background px-4 py-6 lg:block">
      <div className="mb-8 px-2">
        <p className="text-sm text-muted-foreground">Appsolux</p>
        <h2 className="text-xl font-semibold tracking-tight">Client Portal</h2>
      </div>

      <nav className="space-y-1">
        {dashboardNavigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block rounded-lg px-3 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {item.title}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
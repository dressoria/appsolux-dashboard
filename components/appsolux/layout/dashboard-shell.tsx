import type { ReactNode } from "react";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type DashboardShellProps = {
  children: ReactNode;
  hideTopbar?: boolean;
  mainClassName?: string;
  contentClassName?: string;
};

export async function DashboardShell({
  children,
  hideTopbar = false,
  mainClassName = "px-6 py-8",
  contentClassName = "mx-auto max-w-6xl",
}: DashboardShellProps) {
  const { user } = await requireDashboardSession();

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />

        <div className="min-h-screen flex-1">
          {hideTopbar ? null : <Topbar user={user} />}

          <main className={mainClassName}>
            <div className={contentClassName}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

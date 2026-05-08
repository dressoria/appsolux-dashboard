import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type DashboardShellProps = {
  children: ReactNode;
  hideTopbar?: boolean;
  mainClassName?: string;
  contentClassName?: string;
};

export function DashboardShell({
  children,
  hideTopbar = false,
  mainClassName = "px-6 py-8",
  contentClassName = "mx-auto max-w-6xl",
}: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar />

        <div className="min-h-screen flex-1">
          {hideTopbar ? null : <Topbar />}

          <main className={mainClassName}>
            <div className={contentClassName}>{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}

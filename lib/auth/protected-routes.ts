import type { AppsoluxModule } from "./permissions";

type ProtectedRoute = {
  path: string;
  module: AppsoluxModule;
};

export const protectedDashboardRoutes: ProtectedRoute[] = [
  { path: "/dashboard", module: "dashboard" },
  { path: "/conversations", module: "conversations" },
  { path: "/channels", module: "channels" },
  { path: "/erp", module: "erp" },
  { path: "/pos", module: "pos" },
  { path: "/reports", module: "reports" },
  { path: "/settings", module: "settings" },
];

export function getProtectedModuleForPath(pathname: string) {
  return protectedDashboardRoutes.find(
    (route) =>
      pathname === route.path || pathname.startsWith(`${route.path}/`)
  )?.module;
}

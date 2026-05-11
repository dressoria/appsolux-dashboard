import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MembershipRole, MembershipStatus, UserStatus } from "@prisma/client";

type MembershipRow = {
  id: string;
  role: MembershipRole;
  status: MembershipStatus;
  createdAt: Date | string;
  user: {
    id: string;
    name: string;
    email: string;
    status: UserStatus;
    createdAt: Date | string;
  };
};

type Props = {
  memberships: MembershipRow[];
};

const ROLE_LABELS: Record<MembershipRole, string> = {
  owner: "Propietario",
  admin: "Administrador",
  support: "Soporte",
  seller: "Vendedor",
  viewer: "Lector",
};

const PERMISSIONS: Array<{
  module: string;
  roles: MembershipRole[];
}> = [
  { module: "Dashboard", roles: ["owner", "admin", "support", "seller", "viewer"] },
  { module: "Conversaciones", roles: ["owner", "admin", "support"] },
  { module: "Appsolux Basico", roles: ["owner", "admin", "seller"] },
  { module: "ERP Avanzado", roles: ["owner", "admin", "seller", "viewer"] },
  { module: "POS", roles: ["owner", "admin", "seller"] },
  { module: "Reportes", roles: ["owner", "admin", "viewer"] },
  { module: "Configuracion", roles: ["owner", "admin"] },
];

function formatDate(value: Date | string) {
  return new Date(value).toISOString().slice(0, 10);
}

export function UsersPermissionsSettings({ memberships }: Props) {
  const activeCount = memberships.filter((membership) => membership.status === "active").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Usuarios y permisos</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Gestion basica activa desde Membership del tenant actual. Las
                invitaciones por email y auditoria avanzada se agregaran despues.
              </p>
            </div>
            <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
              Control basico activo
            </span>
          </div>
        </CardHeader>
        <CardContent>
          {memberships.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
              No hay usuarios asociados a este tenant.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b text-xs text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Usuario</th>
                    <th className="py-2 pr-4 font-medium">Email</th>
                    <th className="py-2 pr-4 font-medium">Rol</th>
                    <th className="py-2 pr-4 font-medium">Estado</th>
                    <th className="py-2 font-medium">Creado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {memberships.map((membership) => (
                    <tr key={membership.id}>
                      <td className="py-2 pr-4 font-medium">{membership.user.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{membership.user.email}</td>
                      <td className="py-2 pr-4">{ROLE_LABELS[membership.role]}</td>
                      <td className="py-2 pr-4">
                        <span className="inline-flex h-5 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs text-slate-600">
                          {membership.status} / {membership.user.status}
                        </span>
                      </td>
                      <td className="py-2 text-muted-foreground">{formatDate(membership.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-sm">Usuarios activos</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{activeCount}</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Owners/Admins</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">
            {memberships.filter((m) => m.role === "owner" || m.role === "admin").length}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-sm">Roles disponibles</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold">{Object.keys(ROLE_LABELS).length}</CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Matriz inicial por rol</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-xs text-muted-foreground">
              <tr>
                <th className="py-2 pr-4 font-medium">Modulo</th>
                {Object.entries(ROLE_LABELS).map(([role, label]) => (
                  <th key={role} className="py-2 pr-4 font-medium">{label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {PERMISSIONS.map((row) => (
                <tr key={row.module}>
                  <td className="py-2 pr-4 font-medium">{row.module}</td>
                  {Object.keys(ROLE_LABELS).map((role) => (
                    <td key={role} className="py-2 pr-4">
                      {row.roles.includes(role as MembershipRole) ? "Acceso" : "Sin acceso"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-muted-foreground">
            Esta matriz documenta el control inicial por rol. No expone hashes,
            sesiones ni secretos.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

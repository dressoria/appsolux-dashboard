"use client";

type CredentialStatusBadgeProps = {
  status: string | null | undefined;
  size?: "sm" | "md";
};

const STATUS_CONFIG: Record<string, { label: string; className: string; description: string }> = {
  VERIFIED: {
    label: "Verificado",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300",
    description: "Conexión al SRI activa y funcionando.",
  },
  PENDING_VERIFICATION: {
    label: "Verificando",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
    description: "Verificación en progreso.",
  },
  INVALID: {
    label: "Credenciales inválidas",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    description: "El SRI rechazó las credenciales. Actualízalas para continuar.",
  },
  ERROR: {
    label: "Error",
    className: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
    description: "Error al verificar conexión con el SRI.",
  },
  HUMAN_VERIFICATION_REQUIRED: {
    label: "Verificación manual requerida",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
    description: "El SRI solicita verificación adicional. Ingresa al portal SRI manualmente para resolverla.",
  },
};

const FALLBACK = {
  label: "Desconocido",
  className: "bg-gray-100 text-gray-700 dark:bg-gray-900 dark:text-gray-300",
  description: "Estado no reconocido.",
};

export function CredentialStatusBadge({ status, size = "sm" }: CredentialStatusBadgeProps) {
  if (!status) return null;
  const config = STATUS_CONFIG[status] ?? FALLBACK;
  const sizeClass = size === "md" ? "px-3 py-1 text-sm" : "px-2 py-0.5 text-xs";

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${sizeClass} ${config.className}`}
      title={config.description}
    >
      {config.label}
    </span>
  );
}

export function CredentialStatusDetail({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const config = STATUS_CONFIG[status] ?? FALLBACK;

  return (
    <div className={`rounded-md border p-3 text-sm ${config.className.replace(/bg-\S+/, "").trim()}`}>
      <p className="font-medium">{config.label}</p>
      <p className="mt-1 text-xs opacity-80">{config.description}</p>
    </div>
  );
}

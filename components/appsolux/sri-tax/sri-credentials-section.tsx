"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Link from "next/link";
import { SRI_CONFIGURATION_NAVIGATION } from "@/config/sri-tax-navigation";

type SriProfile = {
  ruc: string | null;
  legalName: string | null;
  tradeName: string | null;
  taxRegime: string | null;
  accountingRequired: boolean;
};

type CredentialInfo = {
  configured: boolean;
  usernameMasked?: string;
  additionalUserConfigured?: boolean;
  status?: string;
  verifiedAt?: string | null;
  lastVerificationAt?: string | null;
  lastVerificationErrorSafe?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  VERIFIED: { label: "Verificada", color: "text-emerald-700 bg-emerald-50" },
  PENDING_VERIFICATION: { label: "Pendiente de verificación", color: "text-amber-700 bg-amber-50" },
  INVALID: { label: "Inválida", color: "text-red-700 bg-red-50" },
  ERROR: { label: "Error", color: "text-red-700 bg-red-50" },
  HUMAN_VERIFICATION_REQUIRED: { label: "Verificación humana requerida", color: "text-orange-700 bg-orange-50" },
};

export function SriCredentialsSection() {
  const [profile, setProfile] = useState<SriProfile | null>(null);
  const [cred, setCred] = useState<CredentialInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [additionalUser, setAdditionalUser] = useState("");
  const [showAdditional, setShowAdditional] = useState(false);
  const [saving, setSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);
  const [credSuccess, setCredSuccess] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [profileRes, credRes] = await Promise.all([
        fetch("/api/sri/profile"),
        fetch("/api/purchases/sri-credentials"),
      ]);
      const profileData = await profileRes.json();
      const credData: CredentialInfo = await credRes.json();
      setProfile(profileData.profile ?? null);
      setCred(credData);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function handleSaveCredentials() {
    if (!username.trim() || !password.trim()) {
      setCredError("Usuario y contraseña son obligatorios.");
      return;
    }
    setSaving(true);
    setCredError(null);
    setCredSuccess(null);
    try {
      const res = await fetch("/api/purchases/sri-credentials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          additionalUserId: additionalUser.trim() || null,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCredSuccess("Credenciales guardadas. Verificación en proceso...");
        setEditing(false);
        setPassword("");
        fetchAll();
      } else {
        setCredError(data.error ?? "Error al guardar.");
      }
    } catch {
      setCredError("Error de conexión.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setCredError(null);
    setCredSuccess(null);
    try {
      await fetch("/api/purchases/sri-credentials", { method: "DELETE" });
      setConfirmDelete(false);
      setCredSuccess("Credenciales eliminadas.");
      fetchAll();
    } catch {
      setCredError("Error al eliminar.");
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-sm text-muted-foreground">Cargando configuración SRI...</p>
      </div>
    );
  }

  const statusInfo = cred?.status ? STATUS_LABELS[cred.status] : null;

  return (
    <div className="space-y-6">
      {/* Taxpayer Info */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Información del contribuyente</CardTitle>
        </CardHeader>
        <CardContent>
          {profile ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs text-muted-foreground">Razón social</p>
                <p className="text-sm font-medium">{profile.legalName || "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RUC</p>
                <p className="text-sm font-mono">{profile.ruc || "—"}</p>
              </div>
              {profile.tradeName && (
                <div>
                  <p className="text-xs text-muted-foreground">Nombre comercial</p>
                  <p className="text-sm">{profile.tradeName}</p>
                </div>
              )}
              {profile.taxRegime && (
                <div>
                  <p className="text-xs text-muted-foreground">Régimen tributario</p>
                  <p className="text-sm">{profile.taxRegime}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground">Obligado a llevar contabilidad</p>
                <p className="text-sm">{profile.accountingRequired ? "Sí" : "No"}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No se han configurado los datos fiscales.{" "}
              <Link href="/facturacion/sri/company" className="text-blue-600 hover:underline">
                Configurar datos fiscales
              </Link>
            </p>
          )}
        </CardContent>
      </Card>

      {/* SRI Credentials */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base">Credenciales de acceso al SRI</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Usuario y contraseña para el portal SRI en Línea. Se utilizan tanto para la
                sincronización de ventas como de compras.
              </p>
            </div>
            {cred?.configured && statusInfo && (
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusInfo.color}`}>
                {statusInfo.label}
              </span>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {credError && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {credError}
            </div>
          )}
          {credSuccess && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300">
              {credSuccess}
            </div>
          )}

          {cred?.configured && !editing ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Usuario SRI</p>
                  <p className="text-sm font-mono">{cred.usernameMasked}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contraseña</p>
                  <p className="text-sm">••••••••</p>
                </div>
                {cred.additionalUserConfigured && (
                  <div>
                    <p className="text-xs text-muted-foreground">Identificación adicional</p>
                    <p className="text-sm">Configurada</p>
                  </div>
                )}
                {cred.verifiedAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Última verificación exitosa</p>
                    <p className="text-sm">{new Date(cred.verifiedAt).toLocaleString("es-EC")}</p>
                  </div>
                )}
                {cred.lastVerificationAt && (
                  <div>
                    <p className="text-xs text-muted-foreground">Último intento de verificación</p>
                    <p className="text-sm">{new Date(cred.lastVerificationAt).toLocaleString("es-EC")}</p>
                  </div>
                )}
              </div>
              {cred.lastVerificationErrorSafe && (
                <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
                  Último error: {cred.lastVerificationErrorSafe}
                </div>
              )}
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  Actualizar credenciales
                </Button>
                {!confirmDelete ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-red-600 hover:text-red-700"
                    onClick={() => setConfirmDelete(true)}
                  >
                    Eliminar
                  </Button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-600">¿Confirmar eliminación?</span>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600"
                      onClick={handleDelete}
                      disabled={deleting}
                    >
                      {deleting ? "Eliminando..." : "Sí, eliminar"}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => setConfirmDelete(false)}>
                      Cancelar
                    </Button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4 max-w-md">
              <div className="space-y-2">
                <Label htmlFor="sri-username">Usuario del SRI (RUC o cédula)</Label>
                <Input
                  id="sri-username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="0990000000001"
                  autoComplete="off"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sri-password">Contraseña del SRI</Label>
                <Input
                  id="sri-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={() => setShowAdditional(!showAdditional)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  {showAdditional ? "Ocultar" : "Agregar"} identificación adicional
                </button>
                {showAdditional && (
                  <div className="mt-2 space-y-2">
                    <Label htmlFor="sri-additional">Identificación adicional</Label>
                    <Input
                      id="sri-additional"
                      value={additionalUser}
                      onChange={(e) => setAdditionalUser(e.target.value)}
                      placeholder="Opcional"
                      autoComplete="off"
                    />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveCredentials} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar y verificar"}
                </Button>
                {cred?.configured && (
                  <Button variant="outline" onClick={() => { setEditing(false); setCredError(null); }}>
                    Cancelar
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                La contraseña se almacena cifrada (AES-256-GCM) y nunca se muestra.
                Al guardar se iniciará una verificación de conexión con el portal del SRI.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Config links */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configuración fiscal</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {SRI_CONFIGURATION_NAVIGATION.filter((i) => i.href !== "/facturacion/configuration").map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-xl border p-4 transition-colors hover:border-blue-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <h3 className="text-sm font-medium">{item.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{item.description}</p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

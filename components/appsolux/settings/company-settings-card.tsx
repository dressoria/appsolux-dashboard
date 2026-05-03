"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ApiResponse } from "@/types/api";
import type { ErpnextCompanyDetail } from "@/types/erpnext";

type CompanySettingsCardProps = {
  company?: ErpnextCompanyDetail;
};

type CompanyResponse = ApiResponse<{
  company: ErpnextCompanyDetail;
}>;

export function CompanySettingsCard({ company }: CompanySettingsCardProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!company) {
      return;
    }

    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);

    try {
      const response = await fetch(
        `/api/erpnext/companies/${encodeURIComponent(company.name)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_email: String(formData.get("company_email") ?? "").trim(),
            phone_no: String(formData.get("phone_no") ?? "").trim(),
            website: String(formData.get("website") ?? "").trim(),
            tax_id: String(formData.get("tax_id") ?? "").trim(),
          }),
        }
      );
      const result = (await response.json()) as CompanyResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      setMessage("Empresa actualizada correctamente.");
    } catch (error) {
      setIsError(true);
      setMessage(
        error instanceof Error ? error.message : "No se pudo actualizar empresa"
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  if (!company) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No hay empresa configurada en el ERP.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Empresa</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 text-sm md:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Empresa ERP</p>
            <p className="font-medium">{company.company_name ?? company.name}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Moneda</p>
            <p className="font-medium">{company.default_currency ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Pais</p>
            <p className="font-medium">{company.country ?? "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Abreviatura</p>
            <p className="font-medium">{company.abbr ?? "-"}</p>
          </div>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="tax_id">RUC / Tax ID</Label>
              <Input
                id="tax_id"
                name="tax_id"
                defaultValue={company.tax_id ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="company_email">Email</Label>
              <Input
                id="company_email"
                name="company_email"
                type="email"
                defaultValue={company.company_email ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone_no">Telefono</Label>
              <Input
                id="phone_no"
                name="phone_no"
                defaultValue={company.phone_no ?? ""}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Sitio web</Label>
              <Input
                id="website"
                name="website"
                defaultValue={company.website ?? ""}
              />
            </div>
          </div>

          {message ? (
            <div
              className={
                isError
                  ? "rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
                  : "rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground"
              }
            >
              {message}
            </div>
          ) : null}

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Guardando..." : "Guardar empresa"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

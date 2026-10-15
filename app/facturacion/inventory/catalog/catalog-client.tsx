"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Settings = {
  catalogTitle: string | null;
  catalogShowPrices: boolean;
  catalogShowStock: boolean;
  catalogShowImages: boolean;
} | null;

export function CatalogClient({ settings }: { settings: Settings }) {
  const [title, setTitle] = useState(settings?.catalogTitle ?? "Catálogo de Productos");
  const [showPrices, setShowPrices] = useState(settings?.catalogShowPrices ?? true);
  const [showStock, setShowStock] = useState(settings?.catalogShowStock ?? false);
  const [showImages, setShowImages] = useState(settings?.catalogShowImages ?? true);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      await fetch("/api/inventory/catalog/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          catalogTitle: title,
          catalogShowPrices: showPrices,
          catalogShowStock: showStock,
          catalogShowImages: showImages,
        }),
      });
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/inventory/catalog/settings");
      if (res.ok) {
        alert("Vista previa del catálogo disponible en la configuración.");
      }
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <h3 className="font-medium">Configuración del catálogo</h3>
          <div>
            <label className="text-sm font-medium">Título del catálogo</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1" />
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showPrices} onChange={(e) => setShowPrices(e.target.checked)} className="rounded" />
              <span className="text-sm">Mostrar precios</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showStock} onChange={(e) => setShowStock(e.target.checked)} className="rounded" />
              <span className="text-sm">Mostrar stock</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={showImages} onChange={(e) => setShowImages(e.target.checked)} className="rounded" />
              <span className="text-sm">Mostrar imágenes</span>
            </label>
          </div>
          <div className="flex gap-2">
            <Button onClick={handleSaveConfig} disabled={saving}>
              {saving ? "Guardando..." : "Guardar configuración"}
            </Button>
            <Button variant="outline" onClick={handleGenerate} disabled={generating}>
              {generating ? "Generando..." : "Vista previa"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Vehicle = {
  id: string;
  plate: string;
  brand: string | null;
  model: string | null;
  isActive: boolean;
};

export function VehiclesClient({ initialVehicles }: { initialVehicles: Vehicle[] }) {
  const [vehicles, setVehicles] = useState(initialVehicles);
  const [showForm, setShowForm] = useState(false);
  const [plate, setPlate] = useState("");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!plate) return;
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/vehicles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plate, brand: brand || null, model: model || null }),
      });
      if (res.ok) {
        const created = await res.json();
        setVehicles([...vehicles, created]);
        setShowForm(false);
        setPlate("");
        setBrand("");
        setModel("");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{vehicles.length} vehículo(s)</p>
        <Button onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancelar" : "Nuevo vehículo"}
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">Placa *</label>
                <Input value={plate} onChange={(e) => setPlate(e.target.value)} className="mt-1" placeholder="ABC-1234" />
              </div>
              <div>
                <label className="text-sm font-medium">Marca</label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Modelo</label>
                <Input value={model} onChange={(e) => setModel(e.target.value)} className="mt-1" />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={saving || !plate}>
              {saving ? "Guardando..." : "Crear vehículo"}
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Placa</th>
                <th className="px-4 py-3 text-left font-medium">Marca</th>
                <th className="px-4 py-3 text-left font-medium">Modelo</th>
                <th className="px-4 py-3 text-center font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No hay vehículos registrados.
                  </td>
                </tr>
              ) : (
                vehicles.map((v) => (
                  <tr key={v.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2 font-mono">{v.plate}</td>
                    <td className="px-4 py-2">{v.brand ?? "—"}</td>
                    <td className="px-4 py-2">{v.model ?? "—"}</td>
                    <td className="px-4 py-2 text-center">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${v.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}`}>
                        {v.isActive ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

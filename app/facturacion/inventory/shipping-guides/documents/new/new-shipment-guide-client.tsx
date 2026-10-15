"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";

type Vehicle = { id: string; plate: string; brand: string | null };
type Warehouse = { id: string; code: string; name: string };

export function NewShipmentGuideClient({
  vehicles,
  warehouses,
}: {
  vehicles: Vehicle[];
  warehouses: Warehouse[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [recipientName, setRecipientName] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [originAddress, setOriginAddress] = useState("");
  const [destinationAddress, setDestinationAddress] = useState("");
  const [vehicleId, setVehicleId] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [driverName, setDriverName] = useState("");
  const [driverId, setDriverId] = useState("");
  const [items, setItems] = useState<Array<{ productId: string; quantity: string; description: string }>>([
    { productId: "", quantity: "1", description: "" },
  ]);

  const addItem = () => setItems([...items, { productId: "", quantity: "1", description: "" }]);

  const updateItem = (idx: number, field: string, value: string) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], [field]: value };
    setItems(updated);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/inventory/shipping-guides", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientName,
          recipientId,
          originAddress,
          destinationAddress,
          vehicleId: vehicleId || null,
          startDate,
          endDate,
          driverName,
          driverId,
          items: items.filter((i) => i.productId),
        }),
      });
      if (res.ok) {
        router.push("/facturacion/inventory/shipping-guides/documents");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 max-w-4xl">
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium">Nombre destinatario *</label>
              <Input value={recipientName} onChange={(e) => setRecipientName(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">CI/RUC destinatario *</label>
              <Input value={recipientId} onChange={(e) => setRecipientId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Dirección origen *</label>
              <Input value={originAddress} onChange={(e) => setOriginAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Dirección destino *</label>
              <Input value={destinationAddress} onChange={(e) => setDestinationAddress(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha inicio *</label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha fin *</label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Conductor</label>
              <Input value={driverName} onChange={(e) => setDriverName(e.target.value)} className="mt-1" placeholder="Nombre del conductor" />
            </div>
            <div>
              <label className="text-sm font-medium">CI conductor</label>
              <Input value={driverId} onChange={(e) => setDriverId(e.target.value)} className="mt-1" />
            </div>
            <div>
              <label className="text-sm font-medium">Vehículo</label>
              <select
                className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={vehicleId}
                onChange={(e) => setVehicleId(e.target.value)}
              >
                <option value="">Sin vehículo</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.plate} {v.brand ? `(${v.brand})` : ""}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-medium">Productos</h3>
            <Button variant="outline" size="sm" onClick={addItem}>Agregar producto</Button>
          </div>
          {items.map((item, idx) => (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-sm font-medium">ID producto</label>
                <Input value={item.productId} onChange={(e) => updateItem(idx, "productId", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Cantidad</label>
                <Input type="number" value={item.quantity} onChange={(e) => updateItem(idx, "quantity", e.target.value)} className="mt-1" />
              </div>
              <div>
                <label className="text-sm font-medium">Descripción</label>
                <Input value={item.description} onChange={(e) => updateItem(idx, "description", e.target.value)} className="mt-1" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={saving || !recipientName || !recipientId || !originAddress || !destinationAddress}>
          {saving ? "Guardando..." : "Crear guía"}
        </Button>
        <Button variant="outline" onClick={() => router.back()}>Cancelar</Button>
      </div>
    </div>
  );
}

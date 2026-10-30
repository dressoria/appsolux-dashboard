"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ECUADOR_LOCATIONS,
  getEcuadorCantons,
  getEcuadorParishes,
} from "@/lib/core/ecuador-locations";

type FlatCity = { canton: string; province: string };

const ALL_CITIES: FlatCity[] = ECUADOR_LOCATIONS.flatMap((prov) =>
  prov.cantons.map((c) => ({ canton: c.name, province: prov.name })),
);

type Props = {
  province: string;
  city: string;
  parish: string;
  onProvinceChange: (v: string) => void;
  onCityChange: (v: string) => void;
  onParishChange: (v: string) => void;
  manualFallback?: boolean;
};

export function EcuadorLocationPicker({
  province,
  city,
  parish,
  onProvinceChange,
  onCityChange,
  onParishChange,
  manualFallback = true,
}: Props) {
  const [cityQuery, setCityQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const [manualMode, setManualMode] = useState(false);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const cityInCatalog = useMemo(
    () => ALL_CITIES.some((c) => c.canton === city),
    [city],
  );

  const filtered = useMemo(() => {
    const q = cityQuery.trim().toLowerCase();
    if (!q) return ALL_CITIES.slice(0, 20);
    return ALL_CITIES.filter(
      (c) =>
        c.canton.toLowerCase().includes(q) ||
        c.province.toLowerCase().includes(q),
    ).slice(0, 20);
  }, [cityQuery]);

  const parishes = useMemo(
    () => getEcuadorParishes(province, city),
    [province, city],
  );

  function selectCity(c: FlatCity) {
    onCityChange(c.canton);
    onProvinceChange(c.province);
    onParishChange("");
    setCityQuery("");
    setOpen(false);
    setManualMode(false);
  }

  if (manualMode) {
    return (
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Provincia</Label>
          <Input
            name="province"
            value={province}
            onChange={(e) => onProvinceChange(e.target.value)}
            placeholder="Provincia"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Ciudad / Cantón</Label>
          <Input
            name="city"
            value={city}
            onChange={(e) => onCityChange(e.target.value)}
            placeholder="Ciudad"
          />
        </div>
        <div className="space-y-1.5">
          <Label>Parroquia</Label>
          <Input
            name="parish"
            value={parish}
            onChange={(e) => onParishChange(e.target.value)}
            placeholder="Parroquia"
          />
        </div>
        <button
          type="button"
          onClick={() => setManualMode(false)}
          className="text-xs text-[#1E52F1] hover:underline sm:col-span-3"
        >
          Usar catálogo de ubicaciones
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="relative space-y-1.5" ref={ref}>
        <Label>Ciudad / Cantón</Label>
        <Input
          value={open ? cityQuery : city || cityQuery}
          onChange={(e) => {
            setCityQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Buscar ciudad..."
          autoComplete="off"
        />
        <input type="hidden" name="city" value={city} />
        {open && (
          <div className="absolute left-0 top-full z-30 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-[#E4E9F0] bg-white shadow-lg">
            {filtered.map((c) => (
              <button
                type="button"
                key={`${c.canton}-${c.province}`}
                onClick={() => selectCity(c)}
                className="flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm hover:bg-[#F0F4FF]"
              >
                <span className="font-medium text-[#172033]">{c.canton}</span>
                <span className="text-xs text-[#667085]">{c.province}</span>
              </button>
            ))}
            {filtered.length === 0 && (
              <div className="px-3 py-3 text-center text-xs text-[#667085]">
                No se encontró la ciudad.
                {manualFallback && (
                  <button
                    type="button"
                    onClick={() => {
                      setManualMode(true);
                      setOpen(false);
                      if (cityQuery) {
                        onCityChange(cityQuery);
                        setCityQuery("");
                      }
                    }}
                    className="ml-1 text-[#1E52F1] hover:underline"
                  >
                    Escribir manualmente
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="space-y-1.5">
        <Label>Provincia</Label>
        <input type="hidden" name="province" value={province} />
        <div className="flex h-8 items-center rounded-lg border border-[#E4E9F0] bg-slate-50 px-2 text-sm text-[#667085]">
          {province || "Se autodetecta"}
        </div>
      </div>
      <div className="space-y-1.5">
        <Label>Parroquia</Label>
        <select
          name="parish"
          value={parish}
          onChange={(e) => onParishChange(e.target.value)}
          disabled={!city || parishes.length === 0}
          className="h-8 w-full rounded-lg border border-[#E4E9F0] bg-white px-2 text-sm disabled:bg-slate-50"
        >
          <option value="">Seleccionar</option>
          {parish && !parishes.includes(parish) && (
            <option value={parish}>{parish}</option>
          )}
          {parishes.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      {!cityInCatalog && city && manualFallback && (
        <p className="text-xs text-[#667085] sm:col-span-3">
          &quot;{city}&quot; no está en el catálogo.{" "}
          <button
            type="button"
            onClick={() => setManualMode(true)}
            className="text-[#1E52F1] hover:underline"
          >
            Editar manualmente
          </button>
        </p>
      )}
    </div>
  );
}

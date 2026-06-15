"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import { Boxes, FolderPlus, Info, Package, Plus, Ruler, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { routes } from "@/config/routes";
import type { ApiResponse } from "@/types/api";
import type { ErpnextItem, ErpnextItemGroup, ErpnextUom } from "@/types/erpnext";

type CreateItemFormProps = {
  itemGroups: ErpnextItemGroup[];
  uoms: ErpnextUom[];
};

type CreateItemResponse = ApiResponse<{ item: ErpnextItem }>;
type CreateItemGroupResponse = ApiResponse<{ itemGroup: ErpnextItemGroup }>;
type CreateUomResponse = ApiResponse<{ uom: ErpnextUom }>;

const selectClassName =
  "h-10 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus-visible:border-sky-300 focus-visible:ring-4 focus-visible:ring-sky-100 disabled:pointer-events-none disabled:opacity-50";

const checkboxClassName =
  "size-4 rounded border-slate-300 text-blue-600 focus-visible:ring-4 focus-visible:ring-sky-100";

const frequentUnits = [
  {
    label: "Unidad",
    matches: ["unidad", "unidad(es)", "unit", "units", "nos", "ea", "each"],
  },
  {
    label: "Caja",
    matches: ["caja", "box"],
  },
  {
    label: "Paquete",
    matches: ["paquete", "pack"],
  },
  {
    label: "Metro",
    matches: ["metro", "meter", "metre", "m"],
  },
  {
    label: "Litro",
    matches: ["litro", "liter", "litre", "l"],
  },
  {
    label: "Kilo",
    matches: ["kilo"],
  },
  {
    label: "Kilogramo",
    matches: ["kilogramo", "kilogram", "kg"],
  },
  {
    label: "Docena",
    matches: ["docena", "dozen"],
  },
  {
    label: "Par",
    matches: ["par", "pair"],
  },
  {
    label: "Servicio",
    matches: ["servicio", "service"],
  },
];

function getItemGroupLabel(itemGroup: ErpnextItemGroup) {
  return itemGroup.item_group_name ?? itemGroup.name;
}

function getFrequentUoms(uoms: ErpnextUom[]) {
  return frequentUnits
    .map((unit) => {
      const uom = uoms.find((erpUom) =>
        [erpUom.name, erpUom.uom_name ?? ""].some((value) =>
          unit.matches.includes(value.toLowerCase())
        )
      );

      return uom ? { label: unit.label, uom } : null;
    })
    .filter((unit): unit is { label: string; uom: ErpnextUom } => Boolean(unit));
}

function getOrderedUoms(uoms: ErpnextUom[]) {
  const recommended = getFrequentUoms(uoms);
  const recommendedNames = new Set(recommended.map((unit) => unit.uom.name));
  const remaining = uoms
    .filter((uom) => !recommendedNames.has(uom.name))
    .map((uom) => ({ label: uom.uom_name ?? uom.name, uom }))
    .sort((left, right) => left.label.localeCompare(right.label));

  return [...recommended, ...remaining];
}

function sortItemGroups(itemGroups: ErpnextItemGroup[]) {
  return [...itemGroups].sort((left, right) =>
    getItemGroupLabel(left).localeCompare(getItemGroupLabel(right))
  );
}

type InlineModalProps = {
  title: string;
  description: string;
  onClose: () => void;
  children: React.ReactNode;
};

function InlineModal({ title, description, onClose, children }: InlineModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/20 p-4 backdrop-blur-sm">
      <div className="my-8 w-full max-w-lg rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl shadow-slate-300/40">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" className="rounded-full" onClick={onClose}>
            Cerrar
          </Button>
        </div>
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}

export function CreateItemForm({ itemGroups, uoms }: CreateItemFormProps) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCreatingItemGroup, setIsCreatingItemGroup] = useState(false);
  const [isCreatingUom, setIsCreatingUom] = useState(false);
  const [openItemGroupModal, setOpenItemGroupModal] = useState(false);
  const [openUomModal, setOpenUomModal] = useState(false);
  const [localItemGroups, setLocalItemGroups] = useState(() => sortItemGroups(itemGroups));
  const [localUoms, setLocalUoms] = useState(() => [...uoms]);
  const [selectedItemGroup, setSelectedItemGroup] = useState(itemGroups[0]?.name ?? "");
  const [selectedUom, setSelectedUom] = useState(uoms[0]?.name ?? "");

  const visibleUoms = useMemo(() => getOrderedUoms(localUoms), [localUoms]);
  const parentOptions = useMemo(() => sortItemGroups(localItemGroups), [localItemGroups]);
  const canCreateItem = localItemGroups.length > 0 && localUoms.length > 0;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      item_code: String(formData.get("item_code") ?? "").trim(),
      item_name: String(formData.get("item_name") ?? "").trim(),
      item_group: String(formData.get("item_group") ?? "").trim(),
      stock_uom: String(formData.get("stock_uom") ?? "").trim(),
      is_stock_item: formData.get("is_stock_item") === "on",
    };

    try {
      const response = await fetch("/api/erpnext/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateItemResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      event.currentTarget.reset();
      setSelectedItemGroup(localItemGroups[0]?.name ?? "");
      setSelectedUom(localUoms[0]?.name ?? "");
      setMessage(`Producto creado: ${result.data.item.item_code}`);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo crear el producto");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleCreateItemGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingItemGroup(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      item_group_name: String(formData.get("item_group_name") ?? "").trim(),
      parent_item_group: String(formData.get("parent_item_group") ?? "").trim() || undefined,
      is_group: formData.get("is_group") === "on",
    };

    try {
      const response = await fetch("/api/erpnext/item-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateItemGroupResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      const nextItemGroups = sortItemGroups([...localItemGroups, result.data.itemGroup]);
      setLocalItemGroups(nextItemGroups);
      setSelectedItemGroup(result.data.itemGroup.name);
      setOpenItemGroupModal(false);
      setMessage(`Categoria creada: ${getItemGroupLabel(result.data.itemGroup)}`);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo crear la categoria.");
    } finally {
      setIsCreatingItemGroup(false);
    }
  }

  async function handleCreateUom(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreatingUom(true);
    setMessage(null);
    setIsError(false);

    const formData = new FormData(event.currentTarget);
    const payload = {
      uom_name: String(formData.get("uom_name") ?? "").trim(),
    };

    try {
      const response = await fetch("/api/erpnext/uoms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await response.json()) as CreateUomResponse;

      if (!result.success) {
        setIsError(true);
        setMessage(result.error.message);
        return;
      }

      const nextUoms = [...localUoms, result.data.uom];
      setLocalUoms(nextUoms);
      setSelectedUom(result.data.uom.name);
      setOpenUomModal(false);
      setMessage(`Unidad creada: ${result.data.uom.uom_name ?? result.data.uom.name}`);
      router.refresh();
    } catch (error) {
      setIsError(true);
      setMessage(error instanceof Error ? error.message : "No se pudo crear la unidad.");
    } finally {
      setIsCreatingUom(false);
    }
  }

  return (
    <>
      <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm shadow-slate-200/60">
        <CardHeader className="pb-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700">
                <Sparkles className="h-3.5 w-3.5" />
                Alta guiada
              </div>
              <CardTitle className="mt-3 text-xl text-slate-900">Crear producto</CardTitle>
              <CardDescription className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Crea y organiza productos para ventas, compras e inventario.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200"
                onClick={() => setOpenItemGroupModal(true)}
              >
                <FolderPlus className="h-4 w-4" />
                Nueva categoria
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200"
                onClick={() => setOpenUomModal(true)}
              >
                <Ruler className="h-4 w-4" />
                Nueva unidad
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 pb-6">
          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-4">
              <div className="flex items-start gap-3">
                <div className="rounded-2xl bg-white p-2.5 text-blue-600 shadow-sm">
                  <Info className="h-4 w-4" />
                </div>
                <div className="space-y-2">
                  <p className="text-sm font-medium text-slate-900">
                    Puedes seleccionar una categoria existente o crear una nueva sin salir de esta pantalla.
                  </p>
                  <p className="text-sm leading-6 text-slate-600">
                    Usa una unidad frecuente como Unidad, Caja o Paquete. Si tu negocio necesita otra,
                    puedes crearla aqui mismo.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Categorias
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {localItemGroups.length}
                </p>
                <p className="mt-1 text-sm text-slate-500">Disponibles para clasificar productos.</p>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Unidades
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {localUoms.length}
                </p>
                <p className="mt-1 text-sm text-slate-500">Listas para stock, compras y ventas.</p>
              </div>
            </div>
          </div>

          {!canCreateItem ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/80 p-4 text-sm text-amber-800">
              <p className="font-medium">Falta preparar una base minima para crear productos.</p>
              <p className="mt-1 leading-6">
                Crea al menos una categoria y una unidad desde aqui, o abre sus pantallas completas si
                prefieres administrarlas con mas detalle.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setOpenItemGroupModal(true)}
                >
                  <Plus className="h-4 w-4" />
                  Crear categoria
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setOpenUomModal(true)}
                >
                  <Plus className="h-4 w-4" />
                  Crear unidad
                </Button>
                <Button asChild type="button" size="sm" variant="ghost" className="rounded-full">
                  <Link href={routes.erpInventoryCategories}>Ir a categorias</Link>
                </Button>
                <Button asChild type="button" size="sm" variant="ghost" className="rounded-full">
                  <Link href={routes.erpInventoryUnits}>Ir a unidades</Link>
                </Button>
              </div>
            </div>
          ) : null}

          <form className="space-y-6" onSubmit={handleSubmit}>
            <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 text-blue-600 shadow-sm">
                  <Package className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Informacion basica
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Codigo, nombre, categoria y unidad del producto.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="item_code" className="text-slate-700">
                    Codigo
                  </Label>
                  <Input
                    id="item_code"
                    name="item_code"
                    className="h-10 rounded-2xl border-slate-200 bg-white"
                    disabled={!canCreateItem}
                    placeholder="SKU-001"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item_name" className="text-slate-700">
                    Nombre
                  </Label>
                  <Input
                    id="item_name"
                    name="item_name"
                    className="h-10 rounded-2xl border-slate-200 bg-white"
                    disabled={!canCreateItem}
                    placeholder="Nombre del producto"
                    required
                  />
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="item_group" className="text-slate-700">
                      Categoria
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-blue-700"
                      onClick={() => setOpenItemGroupModal(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Crear
                    </Button>
                  </div>
                  <select
                    id="item_group"
                    name="item_group"
                    className={selectClassName}
                    value={selectedItemGroup}
                    onChange={(event) => setSelectedItemGroup(event.target.value)}
                    disabled={!canCreateItem}
                    required
                  >
                    <option value="">Selecciona una categoria</option>
                    {localItemGroups.map((itemGroup) => (
                      <option key={itemGroup.name} value={itemGroup.name}>
                        {getItemGroupLabel(itemGroup)}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-slate-500">
                    Organiza familias como accesorios, repuestos, belleza o suplementos.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <Label htmlFor="stock_uom" className="text-slate-700">
                      Unidad
                    </Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="rounded-full text-blue-700"
                      onClick={() => setOpenUomModal(true)}
                    >
                      <Plus className="h-4 w-4" />
                      Crear
                    </Button>
                  </div>
                  <select
                    id="stock_uom"
                    name="stock_uom"
                    className={selectClassName}
                    value={selectedUom}
                    onChange={(event) => setSelectedUom(event.target.value)}
                    disabled={!canCreateItem}
                    required
                  >
                    <option value="">Selecciona una unidad</option>
                    {visibleUoms.map((unit) => (
                      <option key={unit.uom.name} value={unit.uom.name}>
                        {unit.label}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs leading-5 text-slate-500">
                    Elige una unidad frecuente como Unidad, Caja, Paquete o crea una nueva.
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-slate-200 bg-slate-50/60 p-5">
              <div className="mb-4 flex items-center gap-3">
                <div className="rounded-2xl bg-white p-2.5 text-blue-600 shadow-sm">
                  <Boxes className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Inventario
                  </h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Define si el producto controlara existencias en ERP.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm">
                <input
                  type="checkbox"
                  name="is_stock_item"
                  defaultChecked
                  disabled={!canCreateItem}
                  className={checkboxClassName}
                />
                <span>
                  <span className="block font-medium text-slate-900">Maneja inventario</span>
                  <span className="mt-1 block leading-6 text-slate-500">
                    Activalo para controlar existencias. Desactivalo si es un servicio o un item sin stock.
                  </span>
                </span>
              </label>
            </section>

            <section className="rounded-[24px] border border-dashed border-slate-200 bg-white p-5">
              <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
                Precio, costo y stock inicial
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                La API actual de alta de producto en este dashboard no guarda precio, costo, bodega inicial ni
                stock inicial en el mismo paso. Primero crea el producto y luego completa stock desde{" "}
                <Link href={routes.erpInventoryAdjustments} className="font-medium text-blue-700 hover:underline">
                  Ajustes
                </Link>{" "}
                o revisa existencias en{" "}
                <Link href={routes.erpInventoryStock} className="font-medium text-blue-700 hover:underline">
                  Stock actual
                </Link>
                .
              </p>
            </section>

            {message ? (
              <p
                className={
                  isError
                    ? "rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
                    : "rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
                }
              >
                {message}
              </p>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                El producto quedara listo para stock, compras, ventas y POS.
              </p>
              <Button type="submit" className="rounded-full px-5" disabled={!canCreateItem || isSubmitting}>
                {isSubmitting ? "Creando..." : "Crear producto"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {openItemGroupModal ? (
        <InlineModal
          title="Nueva categoria"
          description="Crea una categoria sin salir del alta de producto. Al guardarla se seleccionara automaticamente."
          onClose={() => setOpenItemGroupModal(false)}
        >
          <form className="space-y-4" onSubmit={handleCreateItemGroup}>
            <div className="space-y-2">
              <Label htmlFor="inline_item_group_name">Nombre</Label>
              <Input
                id="inline_item_group_name"
                name="item_group_name"
                className="h-10 rounded-2xl border-slate-200"
                placeholder="Ej. Accesorios"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inline_parent_item_group">Categoria padre</Label>
              <select
                id="inline_parent_item_group"
                name="parent_item_group"
                className={selectClassName}
                defaultValue=""
              >
                <option value="">Sin padre / raiz</option>
                {parentOptions.map((itemGroup) => (
                  <option key={itemGroup.name} value={itemGroup.name}>
                    {getItemGroupLabel(itemGroup)}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 text-sm">
              <input type="checkbox" name="is_group" className={checkboxClassName} />
              <span>
                <span className="block font-medium text-slate-900">Crear como grupo contenedor</span>
                <span className="mt-1 block leading-6 text-slate-500">
                  Activalo solo si esta categoria sera una carpeta organizadora para otras categorias.
                </span>
              </span>
            </label>
            <div className="flex justify-between gap-3">
              <Button asChild type="button" variant="ghost" className="rounded-full">
                <Link href={routes.erpInventoryCategories}>Abrir pantalla completa</Link>
              </Button>
              <Button type="submit" className="rounded-full" disabled={isCreatingItemGroup}>
                {isCreatingItemGroup ? "Guardando..." : "Guardar categoria"}
              </Button>
            </div>
          </form>
        </InlineModal>
      ) : null}

      {openUomModal ? (
        <InlineModal
          title="Nueva unidad"
          description="Crea una unidad sin salir del alta de producto. Al guardarla se seleccionara automaticamente."
          onClose={() => setOpenUomModal(false)}
        >
          <form className="space-y-4" onSubmit={handleCreateUom}>
            <div className="space-y-2">
              <Label htmlFor="inline_uom_name">Nombre</Label>
              <Input
                id="inline_uom_name"
                name="uom_name"
                className="h-10 rounded-2xl border-slate-200"
                placeholder="Ej. Unidad"
                required
              />
            </div>
            <div className="rounded-2xl border border-sky-100 bg-sky-50/70 p-4 text-sm leading-6 text-slate-600">
              Crea una unidad nueva solo si no puedes reutilizar una existente como Unidad, Caja, Paquete o
              Litro.
            </div>
            <div className="flex justify-between gap-3">
              <Button asChild type="button" variant="ghost" className="rounded-full">
                <Link href={routes.erpInventoryUnits}>Abrir pantalla completa</Link>
              </Button>
              <Button type="submit" className="rounded-full" disabled={isCreatingUom}>
                {isCreatingUom ? "Guardando..." : "Guardar unidad"}
              </Button>
            </div>
          </form>
        </InlineModal>
      ) : null}
    </>
  );
}

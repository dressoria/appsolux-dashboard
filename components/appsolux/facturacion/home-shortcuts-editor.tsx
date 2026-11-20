"use client";

import { useCallback, useState } from "react";
import {
  BookOpen,
  Building2,
  ChevronDown,
  ChevronUp,
  FileCheck2,
  GripVertical,
  Package,
  Pencil,
  Plus,
  ReceiptText,
  Settings2,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BlobButton } from "@/components/ui/blob-button";
import { Dialog } from "radix-ui";
import styles from "./home.module.css";

type ShortcutEntry = {
  key: string;
  title: string;
  description: string;
  icon: string;
  tone: "blue" | "orange";
  optional?: boolean;
};

const iconMap: Record<string, LucideIcon> = {
  ReceiptText,
  ShoppingCart,
  BookOpen,
  FileCheck2,
  Package,
  Users,
  Wallet,
  Building2,
  ShieldCheck,
  Settings2,
};

type EditorProps = {
  initialKeys: string[];
  catalog: ShortcutEntry[];
};

export function HomeShortcutsEditor({ initialKeys, catalog }: EditorProps) {
  const [open, setOpen] = useState(false);
  const [keys, setKeys] = useState(initialKeys);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setKeys(initialKeys);
      setDirty(false);
    }
    setOpen(nextOpen);
  }

  const catalogMap = new Map(catalog.map((c) => [c.key, c]));
  const available = catalog.filter((c) => !keys.includes(c.key));

  const moveUp = useCallback((index: number) => {
    if (index === 0) return;
    setKeys((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next;
    });
    setDirty(true);
  }, []);

  const moveDown = useCallback((index: number) => {
    setKeys((prev) => {
      if (index >= prev.length - 1) return prev;
      const next = [...prev];
      [next[index], next[index + 1]] = [next[index + 1], next[index]];
      return next;
    });
    setDirty(true);
  }, []);

  const remove = useCallback((key: string) => {
    setKeys((prev) => prev.filter((k) => k !== key));
    setDirty(true);
  }, []);

  const add = useCallback((key: string) => {
    setKeys((prev) => (prev.includes(key) ? prev : [...prev, key]));
    setDirty(true);
  }, []);

  const restore = useCallback(() => {
    setKeys(initialKeys);
    setDirty(false);
  }, [initialKeys]);

  const save = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch("/api/home-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keys }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || "Error al guardar");
      }
      setFeedback("Guardado");
      setDirty(false);
      setTimeout(() => {
        setFeedback(null);
        setOpen(false);
        window.location.reload();
      }, 800);
    } catch (err) {
      setFeedback(err instanceof Error ? err.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>
      <BlobButton variant="outline" className="shrink-0 px-4 text-xs" aria-label="Editar accesos rápidos">
        <Pencil className="size-3.5" />
        Editar
      </BlobButton>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className={styles.dialogOverlay} />
        <Dialog.Content className={`${styles.editor} ${styles.editorPosition}`}>
            <div className="flex items-center justify-between border-b border-[#E4E9F0] px-5 py-4">
              <Dialog.Title className="text-base font-semibold text-[#000345]">Personalizar accesos</Dialog.Title>
              <button type="button" onClick={() => setOpen(false)} className="rounded-full p-1 text-[#667085] transition-colors hover:bg-slate-100 hover:text-[#000345]" aria-label="Cerrar">
                <X className="size-5" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <Dialog.Description className="mb-3 text-xs text-[#667085]">Usa las flechas para ordenar tus accesos.</Dialog.Description>
              <ul className="space-y-1.5">
                {keys.map((key, index) => {
                  const entry = catalogMap.get(key);
                  if (!entry) return null;
                  const Icon = iconMap[entry.icon] || FileCheck2;
                  return (
                    <li key={key} className="flex items-center gap-2 rounded-lg border border-[#E4E9F0] bg-white px-3 py-2.5 transition-colors hover:bg-slate-50">
                      <GripVertical className="size-4 shrink-0 text-[#C4CAD4]" />
                      <span className={styles.editorIcon}>
                        <Icon className="size-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-[#000345]">{entry.title}</span>
                      <button type="button" onClick={() => moveUp(index)} disabled={index === 0} className="rounded p-1 text-[#667085] transition-colors hover:bg-slate-100 disabled:opacity-30" aria-label="Subir">
                        <ChevronUp className="size-4" />
                      </button>
                      <button type="button" onClick={() => moveDown(index)} disabled={index === keys.length - 1} className="rounded p-1 text-[#667085] transition-colors hover:bg-slate-100 disabled:opacity-30" aria-label="Bajar">
                        <ChevronDown className="size-4" />
                      </button>
                      <button type="button" onClick={() => remove(key)} className="rounded p-1 text-red-400 transition-colors hover:bg-red-50 hover:text-red-600" aria-label={`Quitar ${entry.title}`}>
                        <Trash2 className="size-4" />
                      </button>
                    </li>
                  );
                })}
              </ul>
              {available.length > 0 && (
                <div className="mt-5">
                  <p className="mb-2 text-xs font-medium text-[#667085]">Disponibles para agregar</p>
                  <div className="space-y-1.5">
                    {available.map((entry) => {
                      const Icon = iconMap[entry.icon] || FileCheck2;
                      return (
                        <button
                          key={entry.key}
                          type="button"
                          onClick={() => add(entry.key)}
                          className={`flex w-full items-center gap-2 rounded-lg border border-dashed border-[#E4E9F0] px-3 py-2.5 text-left transition-colors ${styles.editorAdd}`}
                        >
                          <Plus className="size-4 shrink-0 text-[#B8006D]" />
                          <span className={styles.editorIcon}>
                            <Icon className="size-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-[#000345]">{entry.title}</span>
                            <span className="block truncate text-xs text-[#667085]">{entry.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E9F0] px-5 py-4">
              <button type="button" onClick={restore} className="text-xs font-medium text-[#667085] underline-offset-2 hover:text-[#000345] hover:underline">
                Restaurar predeterminados
              </button>
              <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
                {feedback && <span role="status" className="text-xs font-medium text-[#000345]">{feedback}</span>}
                <Button type="button" variant="outline" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
                <BlobButton type="button" onClick={save} disabled={saving || !dirty} className="px-3 text-xs">
                  {saving ? "Guardando…" : "Guardar cambios"}
                </BlobButton>
              </div>
            </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

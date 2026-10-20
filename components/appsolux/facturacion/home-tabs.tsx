"use client";

import type { ReactNode } from "react";
import { Tabs } from "radix-ui";

export function HomeTabs({ shortcuts, summary }: { shortcuts: ReactNode; summary: ReactNode }) {
  const triggerClass = "min-w-0 flex-1 border-b-2 border-transparent px-3 py-4 text-sm font-medium leading-5 text-slate-500 transition-colors hover:text-facturom-primary focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-facturom-primary data-[state=active]:border-facturom-primary data-[state=active]:text-facturom-primary sm:flex-none sm:px-5";
  return <Tabs.Root defaultValue="shortcuts" className="min-w-0">
    <Tabs.List aria-label="Vistas de Inicio" className="flex border-b border-slate-200">
      <Tabs.Trigger value="shortcuts" className={triggerClass}>Accesos directos</Tabs.Trigger>
      <Tabs.Trigger value="summary" className={triggerClass}>Resumen y estadísticas</Tabs.Trigger>
    </Tabs.List>
    <Tabs.Content value="shortcuts" forceMount className="min-w-0 pt-6 outline-none data-[state=inactive]:hidden">{shortcuts}</Tabs.Content>
    <Tabs.Content value="summary" forceMount className="min-w-0 space-y-5 pt-6 outline-none data-[state=inactive]:hidden">{summary}</Tabs.Content>
  </Tabs.Root>;
}

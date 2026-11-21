"use client";

import { useState, type CSSProperties, type ReactNode } from "react";
import { Tabs } from "radix-ui";
import { ChartNoAxesCombined, LayoutGrid } from "lucide-react";
import styles from "./home.module.css";

export function HomeTabs({ shortcuts, summary, actions }: { shortcuts: ReactNode; summary: ReactNode; actions?: ReactNode }) {
  const [value, setValue] = useState("shortcuts");
  return <Tabs.Root value={value} onValueChange={setValue} className={styles.tabs}>
    <div className={styles.tabBar}>
      <Tabs.List aria-label="Vistas de Inicio" className={styles.tabList} style={{ "--home-tab-index": value === "summary" ? 1 : 0 } as CSSProperties}>
        <span aria-hidden="true" className={styles.tabIndicator} />
        <Tabs.Trigger value="shortcuts" className={styles.tab}><LayoutGrid size={16} aria-hidden="true" />Accesos directos</Tabs.Trigger>
        <Tabs.Trigger value="summary" className={styles.tab}><ChartNoAxesCombined size={16} aria-hidden="true" />Resumen y estadísticas</Tabs.Trigger>
      </Tabs.List>
      {actions ? <div className={styles.tabActions}>{actions}</div> : null}
    </div>
    <Tabs.Content value="shortcuts" forceMount className={styles.tabContent}>{shortcuts}</Tabs.Content>
    <Tabs.Content value="summary" forceMount className={`${styles.tabContent} ${styles.summary}`}>{summary}</Tabs.Content>
  </Tabs.Root>;
}

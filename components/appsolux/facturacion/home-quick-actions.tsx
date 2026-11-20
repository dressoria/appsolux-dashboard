import Link from "next/link";
import {
  ArrowUpRight, BookOpen, Building2, FileCheck2, Package,
  ReceiptText, Settings2, ShieldCheck, ShoppingCart, Users, Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ShortcutEntry } from "@/lib/core/home-preferences";
import { HomeShortcutsEditor } from "./home-shortcuts-editor";
import styles from "./home.module.css";

const icons: Record<string, LucideIcon> = {
  ReceiptText, ShoppingCart, BookOpen, FileCheck2, Package,
  Users, Wallet, Building2, ShieldCheck, Settings2,
};

export function HomeQuickActions({ shortcuts, initialKeys, catalog }: {
  shortcuts: ShortcutEntry[];
  initialKeys: string[];
  catalog: ShortcutEntry[];
}) {
  return (
    <section aria-labelledby="quick-actions-title" className={styles.quickActions}>
      <div className={styles.sectionHeader}>
        <div>
          <h2 id="quick-actions-title">Acciones rápidas</h2>
          <p>Lo que necesitas para seguir con tu día.</p>
        </div>
        <HomeShortcutsEditor initialKeys={initialKeys} catalog={catalog} />
      </div>
      <div className={styles.shortcutGrid}>
        {shortcuts.map(({ key, title, description, icon, href }) => {
          const Icon = icons[icon] || FileCheck2;
          return (
            <Link key={key} href={href} className={styles.shortcut}>
              <span className={styles.shortcutTop}>
                <span className={styles.shortcutIcon}><Icon size={23} aria-hidden="true" /></span>
                <span className={styles.shortcutArrow}><ArrowUpRight size={19} aria-hidden="true" /></span>
              </span>
              <span className={styles.shortcutTitle}>{title}</span>
              <span className={styles.shortcutDescription}>{description}</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

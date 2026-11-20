"use client";

import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import { SRI_TAX_NAVIGATION } from "@/config/sri-tax-navigation";
import styles from "./sri-center.module.css";

export function TaxNavigation({ activeHref }: { activeHref: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number }>();
  useLayoutEffect(() => {
    const container = track.current;
    if (!container) return;
    const update = () => {
      const link = container.querySelector<HTMLElement>('[aria-current="page"]');
      if (link) {
        setPill({ left: link.offsetLeft, width: link.offsetWidth });
        const viewport = container.parentElement;
        if (viewport) {
          if (link.offsetLeft < viewport.scrollLeft) viewport.scrollLeft = Math.max(0, link.offsetLeft - 4);
          else if (link.offsetLeft + link.offsetWidth > viewport.scrollLeft + viewport.clientWidth) viewport.scrollLeft = link.offsetLeft + link.offsetWidth - viewport.clientWidth + 4;
        }
      }
    };
    const observer = new ResizeObserver(update);
    observer.observe(container);
    if (container.parentElement) observer.observe(container.parentElement);
    container.querySelectorAll('a').forEach((link) => observer.observe(link));
    return () => observer.disconnect();
  }, [activeHref]);
  return <nav aria-label="Centro tributario SRI" className={styles.nav}>
    <div ref={track} className={styles.navTrack} data-measured={Boolean(pill)}>
      {pill ? <span aria-hidden="true" className={styles.navPill} style={{ width: pill.width, transform: `translateX(${pill.left}px)` }} /> : null}
      {SRI_TAX_NAVIGATION.map((item, index) => <Link key={item.href} href={item.href} aria-current={item.href === activeHref ? "page" : undefined} className={styles.navLink}
        onClick={(event) => { if (!event.metaKey && !event.ctrlKey && !event.shiftKey) setPill({ left: event.currentTarget.offsetLeft, width: event.currentTarget.offsetWidth }); }}
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const links = track.current?.querySelectorAll<HTMLAnchorElement>('a');
          const next = event.key === "Home" ? 0 : event.key === "End" ? SRI_TAX_NAVIGATION.length - 1 : (index + (event.key === "ArrowRight" ? 1 : -1) + SRI_TAX_NAVIGATION.length) % SRI_TAX_NAVIGATION.length;
          links?.[next]?.focus();
        }}>{item.title}</Link>)}
    </div>
  </nav>;
}

"use client";

import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import styles from "./animated-controls.module.css";

/** Measures the content without clipping popovers or moving keyboard focus. */
export function AnimatedFormPanel({ mode, children }: { mode: string; children: ReactNode }) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number>();

  useLayoutEffect(() => {
    const content = contentRef.current;
    if (!content) return;
    const observer = new ResizeObserver(() => setHeight(content.getBoundingClientRect().height));
    observer.observe(content);
    return () => observer.disconnect();
  }, [mode]);

  return (
    <div className={styles.formPanel} style={{ height }}>
      <div key={mode} ref={contentRef} className={styles.formContent}>{children}</div>
    </div>
  );
}

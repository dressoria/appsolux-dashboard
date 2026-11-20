"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";
import styles from "./animated-controls.module.css";

export function AnimatedSwitch({
  checked,
  onCheckedChange,
  className,
  ...props
}: Omit<ComponentProps<"button">, "onChange" | "type" | "role" | "aria-checked"> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <button
      {...props}
      type="button"
      role="switch"
      aria-checked={checked}
      className={cn(styles.switch, className)}
      onClick={(event) => {
        props.onClick?.(event);
        if (!event.defaultPrevented) onCheckedChange(!checked);
      }}
    >
      <span aria-hidden="true" className={styles.thumb} />
    </button>
  );
}

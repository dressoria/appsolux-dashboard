import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BlobFill } from "./blob-fill";
import styles from "./animated-controls.module.css";

export function BlobButton({
  children,
  className,
  variant = "solid",
  type = "button",
  ...props
}: Omit<ComponentProps<"button">, "children"> & {
  children: React.ReactNode;
  variant?: "solid" | "outline";
}) {
  return (
    <Button {...props} type={type} variant={variant === "outline" ? "outline" : "default"} data-variant={variant} className={cn(styles.blobHost, styles.blobButton, className)}>
      <BlobFill />
      <span className={styles.buttonLabel}>{children}</span>
    </Button>
  );
}

"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import styles from "./animated-controls.module.css";

type Segment<T extends string> = { value: T; label: string; icon?: ReactNode };

export function AnimatedSegmentedControl<T extends string>({
  value,
  onValueChange,
  options,
  label,
  className,
  disabled = false,
}: {
  value: T;
  onValueChange: (value: T) => void;
  options: readonly Segment<T>[];
  label: string;
  className?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      aria-orientation="horizontal"
      className={cn(styles.segmented, className)}
      style={{ "--segment-count": options.length, "--segment-index": selectedIndex } as CSSProperties}
    >
      <span aria-hidden="true" className={styles.indicator} />
      {options.map((option, index) => (
        <button
          key={option.value}
          id={`${id}-${index}`}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          tabIndex={index === selectedIndex ? 0 : -1}
          disabled={disabled}
          className={styles.segment}
          onClick={() => onValueChange(option.value)}
          onKeyDown={(event) => {
            let next = index;
            if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (index + 1) % options.length;
            else if (event.key === "ArrowLeft" || event.key === "ArrowUp") next = (index - 1 + options.length) % options.length;
            else if (event.key === "Home") next = 0;
            else if (event.key === "End") next = options.length - 1;
            else return;
            event.preventDefault();
            onValueChange(options[next].value);
            document.getElementById(`${id}-${next}`)?.focus();
          }}
        >
          {option.icon ? <span aria-hidden="true">{option.icon}</span> : null}
          {option.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";

export function EditableNumberInput({
  value,
  onChange,
  min = 0,
  max,
  step,
  fallback,
  selectOnFocus = true,
  className,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: string;
  fallback?: number;
  selectOnFocus?: boolean;
  className?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const ref = useRef<HTMLInputElement>(null);
  const editing = draft !== null;

  function handleFocus() {
    setDraft(String(value));
    if (selectOnFocus) {
      requestAnimationFrame(() => ref.current?.select());
    }
  }

  function handleChange(raw: string) {
    setDraft(raw);
  }

  function handleBlur() {
    const text = (draft ?? "").trim();
    setDraft(null);
    if (text === "") {
      onChange(fallback ?? min);
      return;
    }
    let n = Number(text);
    if (!Number.isFinite(n)) {
      onChange(fallback ?? min);
      return;
    }
    if (n < min) n = min;
    if (max !== undefined && n > max) n = max;
    onChange(n);
  }

  return (
    <Input
      ref={ref}
      className={className}
      type="text"
      inputMode="decimal"
      step={step}
      disabled={disabled}
      value={editing ? draft! : String(value)}
      onFocus={handleFocus}
      onChange={(e) => handleChange(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        }
      }}
    />
  );
}

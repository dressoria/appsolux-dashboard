"use client";

import { useState } from "react";

type FacturomBrandProps = {
  variant?: "default" | "white";
  className?: string;
  imageClassName?: string;
  textClassName?: string;
  iconOnly?: boolean;
};

export function FacturomBrand({
  variant = "default",
  className,
  imageClassName,
  textClassName,
  iconOnly = false,
}: FacturomBrandProps) {
  const [hasImageError, setHasImageError] = useState(false);

  const logoSrc =
    variant === "white" ? "/brand/facturom-logo-white.png" : "/brand/facturom-logo.png";
  const iconSrc =
    variant === "white" ? "/brand/facturom-icon-white.png" : "/brand/facturom-icon.png";
  const fallbackTextClassName = variant === "white" ? "text-white" : "text-gray-950";

  if (hasImageError) {
    return (
      <span
        className={[
          "inline-flex items-center font-black tracking-tight",
          fallbackTextClassName,
          textClassName,
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        Facturom
      </span>
    );
  }

  return (
    <span className={["inline-flex items-center", className].filter(Boolean).join(" ")}>
      <img
        src={iconOnly ? iconSrc : logoSrc}
        alt="Facturom"
        className={imageClassName}
        onError={() => setHasImageError(true)}
      />
    </span>
  );
}

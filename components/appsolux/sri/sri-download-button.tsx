"use client";

import { useState } from "react";

type SriDownloadButtonProps = {
  href: string;
  label: string;
  className?: string;
  icon?: React.ComponentType<{ className?: string }>;
  suggestedFilename?: string;
};

export function SriDownloadButton({
  href,
  label,
  className = "",
  icon: Icon,
  suggestedFilename,
}: SriDownloadButtonProps) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleClick() {
    if (loading) return;
    setErrorMsg(null);
    setLoading(true);

    try {
      const res = await fetch(href);

      if (!res.ok) {
        let msg = `Error al descargar (${res.status}).`;
        try {
          const json = (await res.json()) as { error?: string };
          if (json.error) msg = json.error;
        } catch {
          // ignore JSON parse failure
        }
        setErrorMsg(msg);
        return;
      }

      const blob = await res.blob();

      // Extract filename from Content-Disposition header if available
      const cd = res.headers.get("content-disposition") ?? "";
      const serverName = cd.match(/filename="?([^";\n]+)"?/)?.[1]?.trim();
      const filename =
        suggestedFilename ?? serverName ?? label.toLowerCase().replace(/\s+/g, "-");

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "No se pudo descargar.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <span className="inline-flex flex-col gap-0.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className={className}
      >
        {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
        {loading ? "Descargando…" : label}
      </button>
      {errorMsg && (
        <span className="max-w-[220px] text-[10px] leading-tight text-red-600">
          {errorMsg}
        </span>
      )}
    </span>
  );
}

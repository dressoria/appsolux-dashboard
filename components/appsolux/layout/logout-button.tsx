"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton({ inverted = false }: { inverted?: boolean }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleLogout() {
    setIsSubmitting(true);

    try {
      await fetch("/api/auth/logout", {
        method: "POST",
      });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      disabled={isSubmitting}
      onClick={handleLogout}
      className={inverted
        ? "rounded-full border border-white/20 bg-white/8 px-3 py-1 text-xs text-white/75 transition hover:bg-white/15 hover:text-white disabled:opacity-60"
        : "rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"}
    >
      {isSubmitting ? "Saliendo..." : "Cerrar sesion"}
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
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
      className="rounded-full border px-3 py-1 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-60"
    >
      {isSubmitting ? "Saliendo..." : "Cerrar sesion"}
    </button>
  );
}

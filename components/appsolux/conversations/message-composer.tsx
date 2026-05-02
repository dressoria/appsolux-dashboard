"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type MessageComposerProps = {
  conversationId: number;
};

type SendStatus = "idle" | "loading" | "success" | "error";

export function MessageComposer({ conversationId }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<SendStatus>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedContent = content.trim();

    if (!trimmedContent) {
      setStatus("error");
      setMessage("Escribe un mensaje antes de enviar.");
      return;
    }

    setStatus("loading");
    setMessage("");

    try {
      const response = await fetch(
        `/api/chatwoot/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            content: trimmedContent,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error?.message ?? "No se pudo enviar");
      }

      setContent("");
      setStatus("success");
      setMessage("Mensaje enviado correctamente.");
    } catch (error) {
      setStatus("error");
      setMessage(
        error instanceof Error ? error.message : "Error inesperado al enviar"
      );
    }
  }

  const isLoading = status === "loading";

  return (
    <form onSubmit={handleSubmit} className="space-y-2 border-t pt-4">
      <div className="flex gap-2">
        <Input
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Escribe una respuesta..."
          disabled={isLoading}
        />

        <Button type="submit" disabled={isLoading}>
          {isLoading ? "Enviando..." : "Enviar"}
        </Button>
      </div>

      {message ? (
        <p
          className={
            status === "error"
              ? "text-xs text-destructive"
              : "text-xs text-muted-foreground"
          }
        >
          {message}
        </p>
      ) : null}
    </form>
  );
}
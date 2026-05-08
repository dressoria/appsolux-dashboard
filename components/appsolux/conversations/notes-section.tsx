"use client";

import { type FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

type NoteItem = {
  id: string;
  body: string;
  authorName: string | null;
  createdAt: string;
};

type NotesSectionProps = {
  conversationId: number;
};

function formatNoteDate(isoString: string): string {
  return new Intl.DateTimeFormat("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
}

export function NotesSection({ conversationId }: NotesSectionProps) {
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [loadState, setLoadState] = useState<"loading" | "idle" | "error">(
    "loading"
  );
  const [body, setBody] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "error">(
    "idle"
  );
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    async function loadNotes() {
      setLoadState("loading");
      setNotes([]);

      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/notes`
        );
        const payload = (await response.json()) as {
          success: boolean;
          data?: { notes: NoteItem[] };
        };

        if (!response.ok || !payload.success) {
          throw new Error();
        }

        setNotes(payload.data?.notes ?? []);
        setLoadState("idle");
      } catch {
        setLoadState("error");
      }
    }

    void loadNotes();
  }, [conversationId]);

  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedBody = body.trim();

    if (!trimmedBody || saveState === "saving") {
      return;
    }

    setSaveState("saving");
    setSaveError("");

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}/notes`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmedBody }),
        }
      );
      const payload = (await response.json()) as {
        success: boolean;
        data?: { note: NoteItem };
        error?: { message: string };
      };

      if (!response.ok || !payload.success) {
        throw new Error(
          payload.error?.message ?? "No se pudo guardar la nota."
        );
      }

      if (payload.data) {
        setNotes((prev) => [...prev, payload.data!.note]);
      }

      setBody("");
      setSaveState("idle");
    } catch (error) {
      setSaveState("error");
      setSaveError(
        error instanceof Error
          ? error.message
          : "No se pudo guardar la nota."
      );
    }
  }

  return (
    <div className="space-y-3">
      {loadState === "loading" ? (
        <p className="text-sm text-muted-foreground">Cargando notas...</p>
      ) : loadState === "error" ? (
        <p className="text-sm text-destructive">
          No se pudieron cargar las notas.
        </p>
      ) : notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aún no hay notas internas.
        </p>
      ) : (
        <div className="space-y-2">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border bg-muted/30 p-3 text-sm"
            >
              <p className="whitespace-pre-wrap">{note.body}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {note.authorName ?? "Equipo"} — {formatNoteDate(note.createdAt)}
              </p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={saveNote} className="space-y-2">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Agregar nota interna..."
          disabled={saveState === "saving"}
          maxLength={1000}
          rows={3}
          className="w-full resize-none rounded-xl border bg-background p-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={saveState === "saving" || !body.trim()}
        >
          {saveState === "saving" ? "Guardando..." : "Guardar nota"}
        </Button>
        {saveError ? (
          <p className="text-xs text-destructive">{saveError}</p>
        ) : null}
      </form>
    </div>
  );
}

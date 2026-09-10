"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type MemoryControlsProps = {
  id: string;
  isPrivate: boolean;
  memoryKey: string;
};

type ApiError = { error?: string };

export default function MemoryControls({ id, isPrivate, memoryKey }: MemoryControlsProps) {
  const router = useRouter();
  const [pending, setPending] = useState<"privacy" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  async function readError(response: Response, fallback: string) {
    const body = await response.json().catch(() => null) as ApiError | null;
    return typeof body?.error === "string" && body.error.trim() ? body.error : fallback;
  }

  async function updatePrivacy() {
    if (pending) return;
    setPending("privacy");
    setMessage("");
    setFailed(false);

    const shareWithAi = isPrivate;
    try {
      const response = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, shareWithAi }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível alterar a privacidade."));

      setMessage(shareWithAi
        ? "Memória autorizada para contexto da NEYVIX AI."
        : "Memória tornada privada e retirada do contexto da AI.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a privacidade.");
    } finally {
      setPending(null);
    }
  }

  async function removeMemory() {
    if (pending) return;
    const confirmed = window.confirm(`Apagar definitivamente a memória “${memoryKey}”? Esta ação remove o conteúdo da sua Memory.`);
    if (!confirmed) return;

    setPending("delete");
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch("/api/memory", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id }),
      });
      if (!response.ok) throw new Error(await readError(response, "Não foi possível apagar a memória."));

      setMessage("Memória apagada.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Não foi possível apagar a memória.");
    } finally {
      setPending(null);
    }
  }

  return <div>
    <div className="actions" aria-busy={pending !== null}>
      <button className="secondary" type="button" onClick={updatePrivacy} disabled={pending !== null} aria-label={isPrivate ? `Permitir que ${memoryKey} seja usada pela NEYVIX AI` : `Tornar ${memoryKey} privada`}>
        {pending === "privacy" ? "Salvando..." : isPrivate ? "Permitir na AI" : "Tornar privada"}
      </button>
      <button className="secondary" type="button" onClick={removeMemory} disabled={pending !== null} aria-label={`Apagar a memória ${memoryKey}`}>
        {pending === "delete" ? "Apagando..." : "Apagar memória"}
      </button>
    </div>
    {message ? <p role={failed ? "alert" : "status"} aria-live="polite">{message}</p> : null}
  </div>;
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type MemoryControlsProps = {
  id: string;
  isPrivate: boolean;
  memoryKey: string;
};

type ApiPayload = {
  error?: unknown;
  ok?: unknown;
  id?: unknown;
  shareWithAi?: unknown;
};

export default function MemoryControls({ id, isPrivate, memoryKey }: MemoryControlsProps) {
  const router = useRouter();
  const [privateState, setPrivateState] = useState(isPrivate);
  const [pending, setPending] = useState<"privacy" | "delete" | null>(null);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPrivateState(isPrivate);
  }, [isPrivate]);

  async function readPayload(response: Response) {
    return await response.json().catch(() => null) as ApiPayload | null;
  }

  function errorMessage(payload: ApiPayload | null, fallback: string) {
    return typeof payload?.error === "string" && payload.error.trim() ? payload.error : fallback;
  }

  async function updatePrivacy() {
    if (pending) return;
    setPending("privacy");
    setMessage("");
    setFailed(false);

    const shareWithAi = privateState;
    try {
      const response = await fetch("/api/memory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({ id, shareWithAi }),
      });
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(errorMessage(payload, "Não foi possível alterar a privacidade."));
      if (payload?.ok !== true || payload.id !== id || payload.shareWithAi !== shareWithAi) {
        throw new Error("A confirmação da alteração de privacidade veio incompleta. A Memory será sincronizada novamente.");
      }

      setPrivateState(!shareWithAi);
      setMessage(shareWithAi
        ? "Memória autorizada para contexto da NEYVIX AI."
        : "Memória tornada privada e retirada do contexto da AI.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Não foi possível alterar a privacidade.");
      router.refresh();
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
      const payload = await readPayload(response);
      if (!response.ok) throw new Error(errorMessage(payload, "Não foi possível apagar a memória."));
      if (payload?.ok !== true || payload.id !== id) {
        throw new Error("A confirmação da exclusão veio incompleta. A Memory será sincronizada novamente.");
      }

      setMessage("Memória apagada.");
      router.refresh();
    } catch (error) {
      setFailed(true);
      setMessage(error instanceof Error ? error.message : "Não foi possível apagar a memória.");
      router.refresh();
    } finally {
      setPending(null);
    }
  }

  return <div>
    <div className="actions" aria-busy={pending !== null}>
      <button className="secondary" type="button" onClick={updatePrivacy} disabled={pending !== null} aria-label={privateState ? `Permitir que ${memoryKey} seja usada pela NEYVIX AI` : `Tornar ${memoryKey} privada`}>
        {pending === "privacy" ? "Salvando..." : privateState ? "Permitir na AI" : "Tornar privada"}
      </button>
      <button className="secondary" type="button" onClick={removeMemory} disabled={pending !== null} aria-label={`Apagar a memória ${memoryKey}`}>
        {pending === "delete" ? "Apagando..." : "Apagar memória"}
      </button>
    </div>
    {message ? <p role={failed ? "alert" : "status"} aria-live="polite">{message}</p> : null}
  </div>;
}
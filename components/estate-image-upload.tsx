"use client";

import { ChangeEvent, useState } from "react";

export default function EstateImageUpload({ onUploaded }: { onUploaded: (url: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || busy) return;
    setBusy(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      const response = await fetch("/api/estate/upload", { method: "POST", body: form });
      const data = await response.json() as { ok?: boolean; url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error || "Não foi possível enviar a imagem");
      onUploaded(data.url);
      setMessage("Imagem adicionada ao imóvel.");
      event.target.value = "";
    } catch (error) {
      const reason = error instanceof Error ? error.message : "upload_failed";
      const copy: Record<string, string> = {
        storage_not_configured: "Upload próprio aguardando conexão com o armazenamento.",
        unsupported_type: "Use JPG, PNG ou WebP.",
        invalid_size: "A imagem deve ter até 8 MB.",
      };
      setMessage(copy[reason] || "Não foi possível enviar a imagem agora.");
    } finally {
      setBusy(false);
    }
  }

  return <div>
    <label>
      Upload de foto
      <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void upload(event)} disabled={busy} />
    </label>
    {message ? <small role="status">{message}</small> : null}
  </div>;
}

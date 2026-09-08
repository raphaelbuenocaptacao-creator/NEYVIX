"use client";

import Link from "next/link";
import { ChangeEvent, FormEvent, useCallback, useEffect, useState } from "react";
import styles from "./drive.module.css";

type DriveItem = {
  id: string;
  parentId: string | null;
  kind: string;
  name: string;
  mimeType: string | null;
  sizeBytes: number;
  storageKey: string | null;
  createdAt: string;
  updatedAt: string;
};

type Crumb = { id: string | null; name: string };

const MAX_UPLOAD_BYTES = 1024 * 1024;

function bytesToBase64(bytes: Uint8Array) {
  let binary = "";
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(offset + chunk, bytes.length)));
  }
  return btoa(binary);
}

function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DrivePage() {
  const [items, setItems] = useState<DriveItem[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "Meu Drive" }]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [folderName, setFolderName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editName, setEditName] = useState("");

  const currentParent = crumbs.at(-1)?.id ?? null;

  const load = useCallback(async (parentId: string | null) => {
    setLoading(true);
    setError("");
    try {
      const query = parentId ? `?parent=${encodeURIComponent(parentId)}` : "";
      const response = await fetch(`/api/drive${query}`, { cache: "no-store" });
      const data = await response.json() as { items?: DriveItem[]; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?reason=session");
        return;
      }
      if (!response.ok) throw new Error(data.error || "Não foi possível carregar o Drive.");
      setItems(data.items ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar o Drive.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(null); }, [load]);

  async function createFolder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = folderName.trim();
    if (!name || busyId) return;
    setBusyId("create");
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/drive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, parentId: currentParent }),
      });
      const data = await response.json() as { item?: DriveItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Não foi possível criar a pasta.");
      setFolderName("");
      setNotice(`Pasta “${data.item.name}” criada.`);
      await load(currentParent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível criar a pasta.");
    } finally {
      setBusyId("");
    }
  }

  async function uploadFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file || busyId) return;
    input.value = "";
    setError("");
    setNotice("");
    if (file.size < 1) {
      setError("Arquivo vazio não é permitido.");
      return;
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError("O NEYVIX Drive aceita arquivos de até 1 MB nesta versão.");
      return;
    }

    setBusyId("upload");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const response = await fetch("/api/storage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          contentBase64: bytesToBase64(bytes),
          parentId: currentParent,
        }),
      });
      const data = await response.json() as { file?: { id: string; name: string }; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?reason=session");
        return;
      }
      if (!response.ok || !data.file) throw new Error(data.error || "Não foi possível enviar o arquivo.");
      setNotice(`Arquivo “${data.file.name}” enviado com segurança.`);
      await load(currentParent);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível enviar o arquivo.");
    } finally {
      setBusyId("");
    }
  }

  async function downloadFile(item: DriveItem) {
    if (item.kind !== "file" || busyId) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/storage/${encodeURIComponent(item.id)}`, { cache: "no-store" });
      if (response.status === 401) {
        window.location.assign("/login?reason=session");
        return;
      }
      if (!response.ok) {
        const data = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(data?.error || "Não foi possível baixar o arquivo.");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = item.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(`Download de “${item.name}” iniciado.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível baixar o arquivo.");
    } finally {
      setBusyId("");
    }
  }

  async function removeFile(item: DriveItem) {
    if (item.kind !== "file" || busyId || !window.confirm(`Excluir o arquivo “${item.name}”?`)) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`/api/storage/${encodeURIComponent(item.id)}`, { method: "DELETE" });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (response.status === 401) {
        window.location.assign("/login?reason=session");
        return;
      }
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível excluir o arquivo.");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`Arquivo “${item.name}” excluído.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o arquivo.");
    } finally {
      setBusyId("");
    }
  }

  function openFolder(item: DriveItem) {
    if (item.kind !== "folder" || busyId) return;
    setCrumbs((current) => [...current, { id: item.id, name: item.name }]);
    setEditingId("");
    setEditName("");
    setNotice("");
    void load(item.id);
  }

  function goToCrumb(index: number) {
    if (busyId || index === crumbs.length - 1) return;
    const next = crumbs.slice(0, index + 1);
    const parentId = next.at(-1)?.id ?? null;
    setCrumbs(next);
    setEditingId("");
    setEditName("");
    setNotice("");
    void load(parentId);
  }

  function beginRename(item: DriveItem) {
    if (busyId) return;
    setEditingId(item.id);
    setEditName(item.name);
    setError("");
    setNotice("");
  }

  async function saveRename(item: DriveItem) {
    const name = editName.trim();
    if (!name || busyId) return;
    if (name === item.name) {
      setEditingId("");
      setEditName("");
      return;
    }
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/drive", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, name }),
      });
      const data = await response.json() as { item?: DriveItem; error?: string };
      if (!response.ok || !data.item) throw new Error(data.error || "Não foi possível renomear o item.");
      setItems((current) => current.map((candidate) => candidate.id === item.id ? data.item! : candidate));
      setEditingId("");
      setEditName("");
      setNotice(`Item renomeado para “${data.item.name}”.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível renomear o item.");
    } finally {
      setBusyId("");
    }
  }

  async function removeFolder(item: DriveItem) {
    if (item.kind !== "folder" || busyId || !window.confirm(`Excluir a pasta “${item.name}”? A exclusão só será permitida se ela estiver vazia.`)) return;
    setBusyId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/drive", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      const data = await response.json() as { ok?: boolean; error?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível excluir a pasta.");
      setItems((current) => current.filter((candidate) => candidate.id !== item.id));
      setNotice(`Pasta “${item.name}” excluída.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir a pasta.");
    } finally {
      setBusyId("");
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">NEYVIX</Link>
        <div className={styles.live}><span aria-hidden="true" /> DRIVE ONLINE</div>
        <Link className={styles.back} href="/dashboard">Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEYVIX DRIVE · WORKSPACE PRIVADO</p>
          <h1>Organize o que sustenta seu ecossistema.</h1>
          <p>Pastas e arquivos privados persistidos, isolados pelo seu NEYVIX ID e disponíveis para upload e download autenticados.</p>
        </div>
        <div className={styles.heroBadge} aria-label="Status do Drive">
          <strong>DRIVE</strong><span>FUNCIONAL</span>
        </div>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidePanel}>
          <div>
            <p className={styles.eyebrow}>NAVEGAÇÃO</p>
            <h2>Seu espaço</h2>
          </div>
          <nav className={styles.breadcrumbs} aria-label="Caminho de pastas">
            {crumbs.map((crumb, index) => (
              <button key={`${crumb.id ?? "root"}-${index}`} type="button" onClick={() => goToCrumb(index)} disabled={Boolean(busyId) || index === crumbs.length - 1} aria-current={index === crumbs.length - 1 ? "page" : undefined}>
                <span>{index === 0 ? "⌂" : "↳"}</span>{crumb.name}
              </button>
            ))}
          </nav>
          <div className={styles.storageNote}>
            <strong>Storage privado</strong>
            <span>FUNCIONAL · ATÉ 1 MB</span>
            <p>Arquivos ficam vinculados ao seu NEYVIX ID, com download autenticado e checksum SHA-256 no backend.</p>
          </div>
        </aside>

        <section className={styles.mainPanel}>
          <div className={styles.panelHead}>
            <div><p className={styles.eyebrow}>PASTA ATUAL</p><h2>{crumbs.at(-1)?.name ?? "Meu Drive"}</h2></div>
            <form className={styles.createForm} onSubmit={createFolder}>
              <label htmlFor="folder-name" className={styles.srOnly}>Nome da nova pasta</label>
              <input id="folder-name" value={folderName} onChange={(event) => setFolderName(event.target.value)} maxLength={160} placeholder="Nome da nova pasta" disabled={Boolean(busyId)} />
              <button type="submit" disabled={!folderName.trim() || Boolean(busyId)}>{busyId === "create" ? "Criando…" : "+ Nova pasta"}</button>
              <label htmlFor="file-upload" role="button" aria-disabled={Boolean(busyId)}>
                {busyId === "upload" ? "Enviando…" : "↑ Enviar arquivo"}
              </label>
              <input id="file-upload" className={styles.srOnly} type="file" onChange={(event) => void uploadFile(event)} disabled={Boolean(busyId)} />
            </form>
          </div>

          {error ? <div className={styles.error} role="alert" aria-live="assertive">{error}</div> : null}
          {notice ? <div className={styles.notice} role="status" aria-live="polite">{notice}</div> : null}

          {loading ? (
            <div className={styles.loading} aria-live="polite"><i /><i /><i /><span>Sincronizando seu Drive…</span></div>
          ) : items.length ? (
            <div className={styles.itemGrid}>
              {items.map((item) => {
                const editing = editingId === item.id;
                return (
                  <article className={styles.itemCard} key={item.id}>
                    <button className={styles.itemOpen} type="button" onClick={() => openFolder(item)} disabled={item.kind !== "folder" || Boolean(busyId)} aria-label={item.kind === "folder" ? `Abrir pasta ${item.name}` : item.name}>
                      <span className={styles.itemIcon}>{item.kind === "folder" ? "▰" : "◇"}</span>
                      <div>
                        {editing ? <span className={styles.editingLabel}>Renomeando</span> : <strong>{item.name}</strong>}
                        <small>{item.kind === "folder" ? "Pasta privada" : `${item.mimeType || "Arquivo"} · ${formatBytes(item.sizeBytes)}`}</small>
                      </div>
                    </button>

                    {editing ? (
                      <div className={styles.renameRow}>
                        <label className={styles.srOnly} htmlFor={`rename-${item.id}`}>Novo nome de {item.name}</label>
                        <input id={`rename-${item.id}`} value={editName} onChange={(event) => setEditName(event.target.value)} maxLength={160} autoFocus disabled={busyId === item.id} />
                        <button type="button" onClick={() => void saveRename(item)} disabled={!editName.trim() || busyId === item.id}>{busyId === item.id ? "Salvando…" : "Salvar"}</button>
                        <button type="button" onClick={() => { setEditingId(""); setEditName(""); }} disabled={busyId === item.id}>Cancelar</button>
                      </div>
                    ) : (
                      <div className={styles.itemActions}>
                        <span>{new Date(item.updatedAt).toLocaleDateString("pt-BR")}</span>
                        <button type="button" onClick={() => beginRename(item)} disabled={Boolean(busyId)}>Renomear</button>
                        {item.kind === "file" ? <button type="button" onClick={() => void downloadFile(item)} disabled={Boolean(busyId)}>{busyId === item.id ? "Abrindo…" : "Baixar"}</button> : null}
                        {item.kind === "file" ? <button type="button" onClick={() => void removeFile(item)} disabled={Boolean(busyId)}>{busyId === item.id ? "Aguarde…" : "Excluir"}</button> : null}
                        {item.kind === "folder" ? <button type="button" onClick={() => void removeFolder(item)} disabled={Boolean(busyId)}>{busyId === item.id ? "Excluindo…" : "Excluir"}</button> : null}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          ) : (
            <div className={styles.emptyState}>
              <span>＋</span>
              <strong>Esta pasta está pronta para começar.</strong>
              <p>Crie uma pasta ou envie um arquivo privado de até 1 MB para iniciar seu espaço.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

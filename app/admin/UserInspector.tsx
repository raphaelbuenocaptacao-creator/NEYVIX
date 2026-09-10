"use client";

import { useEffect, useMemo, useState } from "react";
import styles from "./admin.module.css";
import type { AdminUserDetail, AdminUserSummary } from "@/lib/admin-user360";

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

const sourceLabel: Record<string, string> = {
  ai: "NEYVIX AI",
  studio: "NEYVIX Studio",
  content: "NEYVIX Content",
  estate: "NEYVIX Estate",
  automation: "NEYVIX Automation",
  approval: "NEYVIX Approval",
};

export default function UserInspector({ users }: { users: AdminUserSummary[] }) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [detailState, setDetailState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [copied, setCopied] = useState("");
  const selected = useMemo(() => users.find((user) => user.id === selectedId) ?? users[0], [selectedId, users]);
  const current = detail?.id === selected?.id ? detail : selected;

  useEffect(() => {
    if (!selected?.id) {
      setDetail(null);
      setDetailState("idle");
      return;
    }

    const controller = new AbortController();
    setDetail(null);
    setDetailState("loading");

    void fetch(`/api/admin/user360?id=${encodeURIComponent(selected.id)}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    })
      .then(async (response) => {
        const payload = await response.json().catch(() => null) as { user?: AdminUserDetail; error?: string } | null;
        if (!response.ok || !payload?.user) throw new Error(payload?.error || "Não foi possível carregar o User 360");
        return payload.user;
      })
      .then((user) => {
        if (controller.signal.aborted) return;
        setDetail(user);
        setDetailState("ready");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        console.error("Falha ao carregar detalhe do User 360", error);
        setDetailState("error");
      });

    return () => controller.abort();
  }, [selected?.id]);

  async function copy(text: string, key: string) {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    window.setTimeout(() => setCopied(""), 1200);
  }

  function speak(text: string) {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "pt-BR";
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  function printResponse(text: string) {
    const popup = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
    if (!popup) return;
    const safe = text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
    popup.document.write(`<!doctype html><html lang="pt-BR"><head><title>Resposta NEYVIX AI</title><style>body{font-family:Inter,Arial,sans-serif;background:#060912;color:#f5f8ff;padding:48px;line-height:1.7}main{max-width:760px;margin:auto;border:1px solid #24324a;border-radius:24px;padding:32px;background:#0b1220}small{color:#67dfff;letter-spacing:.16em}h1{font-size:24px;margin:10px 0 28px}p{white-space:pre-wrap;color:#dfe7f4}</style></head><body><main><small>NEYVIX AI</small><h1>Resposta</h1><p>${safe}</p></main><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  if (!users.length) {
    return (
      <section className={styles.user360Empty}>
        <p className="eyebrow">USER 360</p>
        <h2>Aguardando usuários reais</h2>
        <p>Quando o banco estiver disponível no ambiente, perfis, trials e históricos NEYVIX aparecerão aqui.</p>
      </section>
    );
  }

  return (
    <section className={styles.user360}>
      <div className={styles.userList}>
        <div className={styles.userListHeader}>
          <div>
            <p className="eyebrow">USER 360</p>
            <h2>Usuários</h2>
          </div>
          <span>{users.length}</span>
        </div>
        <div className={styles.userRows}>
          {users.map((user) => (
            <button
              type="button"
              key={user.id}
              onClick={() => setSelectedId(user.id)}
              className={`${styles.userRow} ${selected?.id === user.id ? styles.userRowActive : ""}`}
              aria-pressed={selected?.id === user.id}
            >
              <span className={styles.avatar}>{user.name.slice(0, 1).toUpperCase()}</span>
              <span className={styles.userMeta}>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <span className={styles.userState}>{user.subscriptionStatus ?? "sem plano"}</span>
            </button>
          ))}
        </div>
      </div>

      {current ? (
        <aside className={styles.userPanel} aria-busy={detailState === "loading"}>
          <div className={styles.userPanelTop}>
            <div className={styles.identityLine}>
              <span className={styles.avatarLarge}>{current.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <p className="eyebrow">NEYVIX ID</p>
                <h2>{current.name}</h2>
                <p>{current.email}</p>
              </div>
            </div>
            <span className={current.active ? styles.badgeOk : styles.badgeMuted}>{current.active ? "ATIVO" : "INATIVO"}</span>
          </div>

          <div className={styles.userStats}>
            <div><span>Plano</span><strong>{current.subscriptionStatus ?? "Sem assinatura"}</strong></div>
            <div><span>Trial termina</span><strong>{formatDate(current.trialEndsAt)}</strong></div>
            <div><span>Mensagens AI</span><strong>{current.aiMessages}</strong></div>
            <div><span>Projetos Studio</span><strong>{current.studioProjects}</strong></div>
            <div><span>Conteúdos</span><strong>{current.contentItems}</strong></div>
            <div><span>Criado em</span><strong>{formatDate(current.createdAt)}</strong></div>
          </div>

          {detailState === "loading" ? (
            <p className={styles.noHistory} role="status" aria-live="polite">Carregando atividade protegida…</p>
          ) : null}
          {detailState === "error" ? (
            <p className={styles.noHistory} role="alert">Não foi possível carregar o histórico protegido deste usuário.</p>
          ) : null}

          {detailState === "ready" && detail ? (
            <>
              <div className={styles.responseHeader}>
                <div>
                  <p className="eyebrow">LINHA DO TEMPO</p>
                  <h3>Atividade NEYVIX</h3>
                </div>
                <small>AI · Studio · Content</small>
              </div>

              <div className={styles.responseList}>
                {detail.recentActivity.length ? detail.recentActivity.map((item, index) => (
                  <article key={`${detail.id}-activity-${index}`} className={styles.responseCard}>
                    <div className={styles.responseMeta}>
                      <span>{sourceLabel[item.source] ?? "NEYVIX"}</span>
                      <small>{formatDate(item.createdAt)}</small>
                    </div>
                    <p>{item.summary}</p>
                  </article>
                )) : <p className={styles.noHistory}>Esse usuário ainda não possui atividade salva no ecossistema.</p>}
              </div>

              <div className={styles.responseHeader}>
                <div>
                  <p className="eyebrow">HISTÓRICO DA AI</p>
                  <h3>Respostas recentes</h3>
                </div>
                <small>Copiar · Print/PDF · Voz</small>
              </div>

              <div className={styles.responseList}>
                {detail.recentAi.length ? detail.recentAi.map((item, index) => {
                  const key = `${detail.id}-${index}`;
                  return (
                    <article key={key} className={styles.responseCard}>
                      <div className={styles.responseMeta}>
                        <span>{item.role === "assistant" ? "NEYVIX AI" : "USUÁRIO"}</span>
                        <small>{formatDate(item.createdAt)}</small>
                      </div>
                      <p>{item.content}</p>
                      <div className={styles.responseActions}>
                        <button type="button" onClick={() => void copy(item.content, key)}>{copied === key ? "Copiado ✓" : "Copiar"}</button>
                        <button type="button" onClick={() => printResponse(item.content)}>Print / PDF</button>
                        <button type="button" onClick={() => speak(item.content)}>Ouvir</button>
                      </div>
                    </article>
                  );
                }) : <p className={styles.noHistory}>Esse usuário ainda não possui histórico salvo na NEYVIX AI.</p>}
              </div>
            </>
          ) : null}
        </aside>
      ) : null}
    </section>
  );
}

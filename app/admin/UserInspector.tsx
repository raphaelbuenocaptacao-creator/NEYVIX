"use client";

import { useMemo, useState } from "react";
import styles from "./admin.module.css";
import type { AdminUserSummary } from "@/lib/db";

function formatDate(value: string | null) {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function UserInspector({ users }: { users: AdminUserSummary[] }) {
  const [selectedId, setSelectedId] = useState(users[0]?.id ?? "");
  const [copied, setCopied] = useState("");
  const selected = useMemo(() => users.find((user) => user.id === selectedId) ?? users[0], [selectedId, users]);

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
    popup.document.write(`<!doctype html><html><head><title>NEYVIX AI Response</title><style>body{font-family:Inter,Arial,sans-serif;background:#060912;color:#f5f8ff;padding:48px;line-height:1.7}main{max-width:760px;margin:auto;border:1px solid #24324a;border-radius:24px;padding:32px;background:#0b1220}small{color:#67dfff;letter-spacing:.16em}h1{font-size:24px;margin:10px 0 28px}p{white-space:pre-wrap;color:#dfe7f4}</style></head><body><main><small>NEYVIX AI</small><h1>Resposta</h1><p>${text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")}</p></main><script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }

  if (!users.length) {
    return (
      <section className={styles.user360Empty}>
        <p className="eyebrow">USER 360</p>
        <h2>Aguardando usuários reais</h2>
        <p>Quando o DATABASE_URL estiver ativo no ambiente de produção, os perfis, trials e históricos da NEYVIX AI aparecerão aqui.</p>
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
            >
              <span className={styles.avatar}>{user.name.slice(0, 1).toUpperCase()}</span>
              <span className={styles.userMeta}>
                <strong>{user.name}</strong>
                <small>{user.email}</small>
              </span>
              <span className={styles.userState}>{user.subscriptionStatus ?? "no plan"}</span>
            </button>
          ))}
        </div>
      </div>

      {selected ? (
        <aside className={styles.userPanel}>
          <div className={styles.userPanelTop}>
            <div className={styles.identityLine}>
              <span className={styles.avatarLarge}>{selected.name.slice(0, 1).toUpperCase()}</span>
              <div>
                <p className="eyebrow">NEYVIX ID</p>
                <h2>{selected.name}</h2>
                <p>{selected.email}</p>
              </div>
            </div>
            <span className={selected.active ? styles.badgeOk : styles.badgeMuted}>{selected.active ? "ACTIVE" : "INACTIVE"}</span>
          </div>

          <div className={styles.userStats}>
            <div><span>Plano</span><strong>{selected.subscriptionStatus ?? "Sem assinatura"}</strong></div>
            <div><span>Trial termina</span><strong>{formatDate(selected.trialEndsAt)}</strong></div>
            <div><span>AI messages</span><strong>{selected.aiMessages}</strong></div>
            <div><span>Criado em</span><strong>{formatDate(selected.createdAt)}</strong></div>
          </div>

          <div className={styles.responseHeader}>
            <div>
              <p className="eyebrow">AI HISTORY</p>
              <h3>Respostas recentes</h3>
            </div>
            <small>Copiar · Print/PDF · Voz</small>
          </div>

          <div className={styles.responseList}>
            {selected.recentAi.length ? selected.recentAi.map((item, index) => {
              const key = `${selected.id}-${index}`;
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
        </aside>
      ) : null}
    </section>
  );
}

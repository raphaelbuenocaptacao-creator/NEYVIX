"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import styles from "../page.module.css";

type HistoryMessage = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
};

type HistoryPage = {
  messages?: HistoryMessage[];
  nextCursor?: string | null;
  hasMore?: boolean;
  error?: string;
};

export default function AiHistoryPage() {
  const [messages, setMessages] = useState<HistoryMessage[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);

  const loadPage = useCallback(async (before?: string | null, prepend = false) => {
    prepend ? setLoadingOlder(true) : setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({ limit: "40" });
      if (before) params.set("before", before);
      const response = await fetch(`/api/ai/history?${params.toString()}`, { cache: "no-store" });
      const data = (await response.json()) as HistoryPage;
      if (response.status === 401) {
        setNeedsLogin(true);
        setError("Sua sessão expirou ou sua conta precisa ser validada novamente.");
        return;
      }
      if (response.status === 403) {
        setError("Seu plano atual não inclui acesso ao histórico da NEYVIX AI.");
        return;
      }
      if (!response.ok) {
        setError(data.error || "Não foi possível carregar seu histórico agora.");
        return;
      }
      const incoming = data.messages ?? [];
      setMessages((current) => {
        const combined = prepend ? [...incoming, ...current] : incoming;
        const seen = new Set<string>();
        return combined.filter((item) => {
          if (seen.has(item.id)) return false;
          seen.add(item.id);
          return true;
        });
      });
      setCursor(data.nextCursor ?? null);
      setHasMore(Boolean(data.hasMore && data.nextCursor));
    } catch {
      setError("Falha ao conectar com o histórico da NEYVIX AI.");
    } finally {
      prepend ? setLoadingOlder(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  return (
    <main className={styles.shell}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">NEYVIX</Link>
        <div className={styles.status}><span /> HISTÓRICO PERSISTENTE</div>
        <Link className={styles.back} href="/ai">Voltar para NEYVIX AI</Link>
      </header>

      <section className={styles.hero}>
        <p className="eyebrow">NEYVIX AI · HISTÓRICO</p>
        <h1>Sua inteligência, preservada.</h1>
        <p>Explore conversas persistidas com paginação segura e isolamento por conta.</p>
      </section>

      <section className={styles.workspace}>
        <section className={styles.chat} style={{ width: "100%" }}>
          <div className={styles.messages} aria-live="polite" aria-busy={loading || loadingOlder}>
            {hasMore ? (
              <button className={styles.send} type="button" disabled={loadingOlder || !cursor} onClick={() => void loadPage(cursor, true)}>
                {loadingOlder ? "Carregando..." : "Carregar conversas anteriores ↑"}
              </button>
            ) : null}

            {loading ? <div className={styles.thinking}><i/><i/><i/><span>Sincronizando histórico NEYVIX</span></div> : null}

            {!loading && messages.length === 0 && !error ? (
              <div className={styles.message}>
                <span>N</span>
                <div><small>NEYVIX AI</small><p>Seu histórico ainda está vazio. As conversas persistidas aparecerão aqui quando a geração estiver operacional.</p></div>
              </div>
            ) : null}

            {messages.map((message) => (
              <div key={message.id} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>
                <span>{message.role === "assistant" ? "N" : message.role === "user" ? "VOCÊ" : "SYS"}</span>
                <div>
                  <small>{message.role === "assistant" ? "NEYVIX AI" : message.role === "user" ? "SUA SOLICITAÇÃO" : "SISTEMA"} · {new Date(message.createdAt).toLocaleString("pt-BR")}</small>
                  <p>{message.content}</p>
                </div>
              </div>
            ))}
          </div>

          {needsLogin ? <Link className={styles.send} href="/login?next=/ai/history">Entrar novamente →</Link> : null}
          {error ? <p className={styles.error} role="status">{error}</p> : null}
        </section>
      </section>
    </main>
  );
}

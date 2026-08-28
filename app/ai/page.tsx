"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Message = { role: "user" | "assistant"; content: string };

type HistoryMessage = { role: "user" | "assistant" | "system"; content: string; createdAt?: string };

const welcomeMessage: Message = {
  role: "assistant",
  content: "Olá. Eu sou a NEYVIX AI. Diga o que você quer fazer e eu transformo sua intenção em um próximo passo claro.",
};

const suggestions = [
  ["CRIAR", "Crie uma ideia de aplicativo para uma pizzaria."],
  ["LANÇAR", "Escreva um plano de lançamento para meu negócio."],
  ["AUTOMATIZAR", "Explique como posso automatizar meu atendimento."],
] as const;

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const turns = useMemo(() => messages.filter((item) => item.role === "user").length, [messages]);

  useEffect(() => {
    let active = true;

    async function restoreHistory() {
      try {
        const response = await fetch("/api/ai", { method: "GET", cache: "no-store" });
        const data = (await response.json()) as { messages?: HistoryMessage[]; error?: string };
        if (!active) return;
        if (response.status === 401) {
          setNeedsLogin(true);
          setError("Sua sessão expirou ou sua conta precisa ser validada novamente.");
          return;
        }
        if (!response.ok) {
          setError(data.error || "Seu histórico não pôde ser carregado agora. Você ainda pode continuar nesta sessão.");
          return;
        }

        const restored = (data.messages ?? [])
          .filter((message): message is HistoryMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
          .map((message) => ({ role: message.role, content: message.content }));
        if (restored.length > 0) setMessages(restored);
      } catch {
        if (active) setError("Seu histórico não pôde ser carregado agora. Você ainda pode continuar nesta sessão.");
      } finally {
        if (active) setHistoryLoading(false);
      }
    }

    void restoreHistory();
    return () => { active = false; };
  }, []);

  async function sendPrompt(value: string) {
    const clean = value.trim();
    if (!clean || loading) return;
    setError("");
    setNeedsLogin(false);
    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean }) });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error("Sua sessão expirou ou sua conta precisa ser validada novamente.");
      }
      if (!response.ok || !data.answer) throw new Error(data.error || "Não foi possível obter uma resposta.");
      setMessages((current) => [...current, { role: "assistant", content: data.answer ?? "" }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar com a NEYVIX AI.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendPrompt(prompt);
  }

  return (
    <main className={styles.shell}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">NEYVIX</Link>
        <div className={styles.status}><span /> NÚCLEO DE IA CONFIGURADO</div>
        <Link className={styles.back} href="/dashboard">Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <p className="eyebrow">NEYVIX AI · CAMADA DE INTELIGÊNCIA</p>
        <h1>Pergunte uma vez. Mova tudo.</h1>
        <p>Planeje, escreva, crie, analise e transforme intenção em ação dentro do ecossistema.</p>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.orb}><span>N</span></div>
          <p className={styles.sideTitle}>Atalhos rápidos</p>
          <div className={styles.suggestions}>
            {suggestions.map(([label, suggestion]) => (
              <button key={label} type="button" className={styles.suggestion} onClick={() => void sendPrompt(suggestion)} disabled={loading || needsLogin || historyLoading}>
                <span>{label}</span><strong>{suggestion}</strong>
              </button>
            ))}
          </div>
          <div className={styles.metaCard}>
            <span>HISTÓRICO</span>
            <strong>{historyLoading ? "Sincronizando" : `${turns} solicitações`}</strong>
            <small>{historyLoading ? "Carregando contexto salvo" : "Persistência NEYVIX ativa"}</small>
          </div>
        </aside>

        <section className={styles.chat}>
          <div className={styles.messages} aria-live="polite" aria-busy={historyLoading || loading}>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>
                <span>{message.role === "assistant" ? "N" : "VOCÊ"}</span>
                <div><small>{message.role === "assistant" ? "NEYVIX AI" : "SUA SOLICITAÇÃO"}</small><p>{message.content}</p></div>
              </div>
            ))}
            {historyLoading ? <div className={styles.thinking}><i/><i/><i/><span>Sincronizando seu histórico NEYVIX</span></div> : null}
            {loading ? <div className={styles.thinking}><i/><i/><i/><span>NEYVIX está pensando</span></div> : null}
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <div className={styles.inputFrame}>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Diga à NEYVIX o que você quer fazer acontecer..." maxLength={4000} rows={4} disabled={needsLogin || historyLoading} />
              <div className={styles.footer}>
                <span>{prompt.length}/4000</span>
                {needsLogin ? <Link className={styles.send} href="/login?next=/ai">Entrar novamente →</Link> : <button className={styles.send} type="submit" disabled={loading || historyLoading || !prompt.trim()}>{loading ? "Processando" : historyLoading ? "Sincronizando" : "Enviar para a NEYVIX AI →"}</button>}
              </div>
            </div>
            {error ? <p className={styles.error} role="status">{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}

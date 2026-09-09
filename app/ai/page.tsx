"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type Message = { id?: string; role: "user" | "assistant"; content: string; createdAt?: string };
type HistoryMessage = { id: string; role: "user" | "assistant" | "system"; content: string; createdAt: string };
type HistoryPage = { messages?: HistoryMessage[]; nextCursor?: string | null; hasMore?: boolean; error?: string };
type IntelligenceStatus = "checking" | "configured_unverified" | "ready" | "partial" | "unavailable";

const welcomeMessage: Message = {
  role: "assistant",
  content: "Olá. Eu sou a NEYVIX AI. Diga o que você quer fazer e eu transformo sua intenção em um próximo passo claro.",
};

const suggestions = [
  ["CRIAR", "Crie uma ideia de aplicativo para uma pizzaria."],
  ["LANÇAR", "Escreva um plano de lançamento para meu negócio."],
  ["AUTOMATIZAR", "Explique como posso automatizar meu atendimento."],
] as const;

function toConversation(messages: HistoryMessage[]): Message[] {
  return messages
    .filter((message): message is HistoryMessage & { role: "user" | "assistant" } => message.role === "user" || message.role === "assistant")
    .map((message) => ({ id: message.id, role: message.role, content: message.content, createdAt: message.createdAt }));
}

function mergeConversation(older: Message[], current: Message[]) {
  const persistedIds = new Set<string>();
  return [...older, ...current].filter((message) => {
    if (!message.id) return true;
    if (persistedIds.has(message.id)) return false;
    persistedIds.add(message.id);
    return true;
  });
}

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [historyCursor, setHistoryCursor] = useState<string | null>(null);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingOlder, setHistoryLoadingOlder] = useState(false);
  const [error, setError] = useState("");
  const [needsLogin, setNeedsLogin] = useState(false);
  const [useMemory, setUseMemory] = useState(false);
  const [memoryUsed, setMemoryUsed] = useState<number | null>(null);
  const [intelligenceStatus, setIntelligenceStatus] = useState<IntelligenceStatus>("checking");
  const turns = useMemo(() => messages.filter((item) => item.role === "user").length, [messages]);
  const generationAvailable = intelligenceStatus === "configured_unverified" || intelligenceStatus === "ready";
  const generationUnavailable = !generationAvailable;

  const loadHistory = useCallback(async (before?: string | null, prepend = false) => {
    prepend ? setHistoryLoadingOlder(true) : setHistoryLoading(true);
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
        setError(data.error || "Seu histórico não pôde ser carregado agora. Você ainda pode continuar nesta sessão.");
        return;
      }

      const restored = toConversation(data.messages ?? []);
      setHistoryCursor(data.nextCursor ?? null);
      setHistoryHasMore(Boolean(data.hasMore && data.nextCursor));
      setMessages((current) => {
        if (prepend) return mergeConversation(restored, current);
        return restored.length > 0 ? restored : current;
      });
    } catch {
      setError("Seu histórico não pôde ser carregado agora. Você ainda pode continuar nesta sessão.");
    } finally {
      prepend ? setHistoryLoadingOlder(false) : setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    let active = true;
    async function checkIntelligence() {
      try {
        const response = await fetch("/api/health/intelligence", { cache: "no-store" });
        const data = (await response.json()) as { status?: string; ai?: { gatewayConfigured?: boolean } };
        if (!active) return;
        if (data.status === "configured_unverified" && data.ai?.gatewayConfigured === true) {
          setIntelligenceStatus("configured_unverified");
        } else if (data.status === "ready" && data.ai?.gatewayConfigured === true) {
          setIntelligenceStatus("ready");
        } else if (data.status === "partial") {
          setIntelligenceStatus("partial");
        } else {
          setIntelligenceStatus("unavailable");
        }
      } catch {
        if (active) setIntelligenceStatus("unavailable");
      }
    }
    void checkIntelligence();
    return () => { active = false; };
  }, []);

  async function sendPrompt(value: string) {
    const clean = value.trim();
    if (!clean || loading) return;
    if (generationUnavailable) {
      setError("O núcleo de geração da NEYVIX AI não está configurado para uso agora. Seu histórico e Memory continuam preservados.");
      return;
    }
    setError("");
    setNeedsLogin(false);
    setPrompt("");
    setMemoryUsed(null);
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setLoading(true);
    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean, useMemory }),
      });
      const data = (await response.json()) as { answer?: string; error?: string; memoryUsed?: number };
      if (response.status === 401) {
        setNeedsLogin(true);
        throw new Error("Sua sessão expirou ou sua conta precisa ser validada novamente.");
      }
      if (!response.ok || !data.answer) throw new Error(data.error || "Não foi possível obter uma resposta.");
      setMemoryUsed(typeof data.memoryUsed === "number" ? data.memoryUsed : 0);
      setMessages((current) => [...current, { role: "assistant", content: data.answer ?? "" }]);
      setIntelligenceStatus("ready");
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

  const statusLabel = intelligenceStatus === "ready"
    ? "NÚCLEO DE IA VERIFICADO NESTA SESSÃO"
    : intelligenceStatus === "configured_unverified"
      ? "IA CONFIGURADA · PROVIDER A VALIDAR"
      : intelligenceStatus === "checking"
        ? "VALIDANDO NÚCLEO DE IA"
        : intelligenceStatus === "partial"
          ? "IA PARCIAL · GERAÇÃO INDISPONÍVEL"
          : "NÚCLEO DE IA INDISPONÍVEL";

  return (
    <main className={styles.shell}>
      <div className={styles.aurora} aria-hidden="true" />
      <header className={styles.topbar}>
        <Link className={styles.brand} href="/dashboard">NEYVIX</Link>
        <div className={styles.status} title="Estado verificado em tempo real pelo health de inteligência"><span /> {statusLabel}</div>
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
              <button key={label} type="button" className={styles.suggestion} onClick={() => void sendPrompt(suggestion)} disabled={loading || needsLogin || historyLoading || generationUnavailable}>
                <span>{label}</span><strong>{suggestion}</strong>
              </button>
            ))}
          </div>
          <div className={styles.metaCard}>
            <span>HISTÓRICO</span>
            <strong>{historyLoading ? "Sincronizando" : `${turns} solicitações carregadas`}</strong>
            <small>{historyHasMore ? "Há conversas anteriores disponíveis" : historyLoading ? "Carregando contexto salvo" : "Persistência NEYVIX sincronizada"}</small>
            <Link href="/ai/history">Explorar histórico completo →</Link>
          </div>
          <div className={styles.metaCard}>
            <span>MEMORY</span>
            <strong>{useMemory ? "Contexto autorizado" : "Privado por padrão"}</strong>
            <small>{memoryUsed === null ? "Você controla quando usar memória" : `${memoryUsed} memórias usadas na última resposta`}</small>
          </div>
          <div className={styles.metaCard}>
            <span>READINESS</span>
            <strong>{intelligenceStatus === "ready" ? "Provider verificado" : intelligenceStatus === "configured_unverified" ? "Pronta para validar" : intelligenceStatus === "checking" ? "Verificando" : "Modo preservação"}</strong>
            <small>{intelligenceStatus === "checking" ? "Geração bloqueada até o health confirmar configuração" : intelligenceStatus === "configured_unverified" ? "A primeira geração real valida o provider sem fingir prontidão antecipada" : generationUnavailable ? "Histórico e Memory seguem disponíveis sem prometer geração externa" : "Uma resposta real confirmou o provider nesta sessão"}</small>
          </div>
        </aside>

        <section className={styles.chat}>
          <div className={styles.messages} aria-live="polite" aria-busy={historyLoading || historyLoadingOlder || loading}>
            {historyHasMore ? (
              <button className={styles.send} type="button" disabled={historyLoadingOlder || !historyCursor} onClick={() => void loadHistory(historyCursor, true)}>
                {historyLoadingOlder ? "Carregando histórico..." : "Carregar conversas anteriores ↑"}
              </button>
            ) : null}
            {messages.map((message, index) => (
              <div key={message.id ?? `${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>
                <span>{message.role === "assistant" ? "N" : "VOCÊ"}</span>
                <div><small>{message.role === "assistant" ? "NEYVIX AI" : "SUA SOLICITAÇÃO"}</small><p>{message.content}</p></div>
              </div>
            ))}
            {historyLoading ? <div className={styles.thinking}><i/><i/><i/><span>Sincronizando seu histórico NEYVIX</span></div> : null}
            {historyLoadingOlder ? <div className={styles.thinking}><i/><i/><i/><span>Buscando conversas anteriores</span></div> : null}
            {loading ? <div className={styles.thinking}><i/><i/><i/><span>NEYVIX está pensando</span></div> : null}
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <div className={styles.inputFrame}>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder={generationUnavailable ? "Geração temporariamente indisponível; seu histórico permanece seguro." : "Diga à NEYVIX o que você quer fazer acontecer..."} maxLength={4000} rows={4} disabled={needsLogin || historyLoading || generationUnavailable} />
              <label style={{ display: "flex", gap: ".55rem", alignItems: "center", padding: ".35rem 0" }}>
                <input type="checkbox" checked={useMemory} onChange={(event) => setUseMemory(event.target.checked)} disabled={loading || historyLoading || generationUnavailable} />
                Usar somente memórias que eu autorizei para a AI nesta solicitação
              </label>
              <div className={styles.footer}>
                <span>{prompt.length}/4000</span>
                {needsLogin ? <Link className={styles.send} href="/login?next=/ai">Entrar novamente →</Link> : <button className={styles.send} type="submit" disabled={loading || historyLoading || generationUnavailable || !prompt.trim()}>{loading ? "Processando" : historyLoading ? "Sincronizando" : generationUnavailable ? "Geração indisponível" : intelligenceStatus === "configured_unverified" ? "Validar e enviar →" : "Enviar para a NEYVIX AI →"}</button>}
              </div>
            </div>
            {error ? <p className={styles.error} role="status">{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}

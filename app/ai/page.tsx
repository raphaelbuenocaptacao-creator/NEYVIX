"use client";

import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";
import styles from "./page.module.css";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  ["BUILD", "Crie uma ideia de aplicativo para uma pizzaria."],
  ["LAUNCH", "Escreva um plano de lançamento para meu negócio."],
  ["AUTOMATE", "Explique como posso automatizar meu atendimento."],
] as const;

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Olá. Eu sou a NEYVIX AI. Diga o que você quer fazer e eu transformo sua intenção em um próximo passo claro." },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const turns = useMemo(() => messages.filter((item) => item.role === "user").length, [messages]);

  async function sendPrompt(value: string) {
    const clean = value.trim();
    if (!clean || loading) return;
    setError("");
    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setLoading(true);
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean }) });
      const data = (await response.json()) as { answer?: string; error?: string };
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
        <div className={styles.status}><span /> AI CORE ONLINE</div>
        <Link className={styles.back} href="/dashboard">Command Center</Link>
      </header>

      <section className={styles.hero}>
        <p className="eyebrow">NEYVIX AI · INTELLIGENCE LAYER</p>
        <h1>Ask once. Move everything.</h1>
        <p>Planeje, escreva, crie, analise e transforme intenção em ação dentro do ecossistema.</p>
      </section>

      <section className={styles.workspace}>
        <aside className={styles.sidebar}>
          <div className={styles.orb}><span>N</span></div>
          <p className={styles.sideTitle}>Quick intents</p>
          <div className={styles.suggestions}>
            {suggestions.map(([label, suggestion]) => (
              <button key={label} type="button" className={styles.suggestion} onClick={() => void sendPrompt(suggestion)} disabled={loading}>
                <span>{label}</span><strong>{suggestion}</strong>
              </button>
            ))}
          </div>
          <div className={styles.metaCard}>
            <span>SESSION</span>
            <strong>{turns} requests</strong>
            <small>Gemini via NEYVIX AI Gateway</small>
          </div>
        </aside>

        <section className={styles.chat}>
          <div className={styles.messages} aria-live="polite">
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`${styles.message} ${message.role === "user" ? styles.user : ""}`}>
                <span>{message.role === "assistant" ? "N" : "YOU"}</span>
                <div><small>{message.role === "assistant" ? "NEYVIX AI" : "YOUR REQUEST"}</small><p>{message.content}</p></div>
              </div>
            ))}
            {loading ? <div className={styles.thinking}><i/><i/><i/><span>NEYVIX is thinking</span></div> : null}
          </div>

          <form className={styles.composer} onSubmit={submit}>
            <div className={styles.inputFrame}>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Tell NEYVIX what you want to make happen..." maxLength={4000} rows={4} />
              <div className={styles.footer}>
                <span>{prompt.length}/4000</span>
                <button className={styles.send} type="submit" disabled={loading || !prompt.trim()}>{loading ? "Processing" : "Send to NEYVIX AI →"}</button>
              </div>
            </div>
            {error ? <p className={styles.error}>{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}

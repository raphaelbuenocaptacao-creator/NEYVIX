"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const suggestions = [
  "Crie uma ideia de aplicativo para uma pizzaria.",
  "Escreva um plano de lançamento para meu negócio.",
  "Explique como posso automatizar meu atendimento.",
];

export default function AiPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Olá. Eu sou a NEYVIX AI. Posso ajudar você a criar, planejar, escrever e transformar ideias em projetos.",
    },
  ]);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function sendPrompt(value: string) {
    const clean = value.trim();
    if (!clean || loading) return;

    setError("");
    setPrompt("");
    setMessages((current) => [...current, { role: "user", content: clean }]);
    setLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: clean }),
      });

      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) {
        throw new Error(data.error || "Não foi possível obter uma resposta.");
      }

      setMessages((current) => [
        ...current,
        { role: "assistant", content: data.answer ?? "" },
      ]);
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
    <main className="ai-shell">
      <header className="ai-header">
        <div>
          <p className="eyebrow">NEYVIX AI</p>
          <h1>Sua inteligência dentro do ecossistema.</h1>
          <p className="muted">Gemini conectado via NEYVIX AI Gateway.</p>
        </div>
        <Link className="secondary-button" href="/dashboard">Voltar ao painel</Link>
      </header>

      <section className="ai-layout">
        <aside className="ai-sidebar">
          <p className="eyebrow">Comece por aqui</p>
          <h2>O que você quer fazer?</h2>
          <div className="ai-suggestions">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="ai-suggestion"
                onClick={() => void sendPrompt(suggestion)}
                disabled={loading}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </aside>

        <section className="ai-chat-card">
          <div className="ai-messages" aria-live="polite">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`ai-message ${message.role}`}>
                <span>{message.role === "assistant" ? "N" : "Você"}</span>
                <p>{message.content}</p>
              </article>
            ))}
            {loading ? (
              <article className="ai-message assistant">
                <span>N</span>
                <p>Processando sua ideia...</p>
              </article>
            ) : null}
          </div>

          <form className="ai-composer" onSubmit={submit}>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="Descreva o que você quer criar, entender ou planejar..."
              maxLength={4000}
              rows={4}
            />
            <div className="ai-composer-footer">
              <span>{prompt.length}/4000</span>
              <button className="primary-button" type="submit" disabled={loading || !prompt.trim()}>
                {loading ? "Pensando..." : "Enviar para NEYVIX AI"}
              </button>
            </div>
            {error ? <p className="ai-error">{error}</p> : null}
          </form>
        </section>
      </section>
    </main>
  );
}

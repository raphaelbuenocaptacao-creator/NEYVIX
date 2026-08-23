"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./studio.module.css";

const templates = [
  "SaaS para pequenos negócios",
  "App de pedidos e delivery",
  "Painel administrativo com IA",
];

export default function StudioPage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function build(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = idea.trim();
    if (!clean || loading) return;
    setLoading(true); setError(""); setResult("");
    const instruction = `Você é o NEYVIX Studio, um arquiteto de produto e software. Transforme a ideia abaixo em uma especificação objetiva de MVP pronta para construção. Responda em português do Brasil com: nome sugerido, proposta de valor, público, telas, fluxo principal, funcionalidades do MVP, modelo de dados, APIs/integrações, regras de segurança e plano de implementação em 5 etapas. Não invente integrações já concluídas. Ideia do usuário: ${clean}`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: instruction }) });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Falha ao gerar o projeto.");
      setResult(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conectar ao NEYVIX Studio.");
    } finally { setLoading(false); }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> STUDIO ENGINE READY</div>
        <Link href="/dashboard" className={styles.back}>Command Center</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEYVIX STUDIO · BUILD LAYER</p>
          <h1>From idea to product blueprint.</h1>
          <p>Descreva o que você quer criar. O Studio organiza a ideia em produto, arquitetura, telas, dados, integrações e plano de construção.</p>
        </div>
        <div className={styles.engineOrb}><span>BUILD</span></div>
      </section>

      <section className={styles.templateRow}>
        {templates.map((template) => <button key={template} type="button" onClick={() => setIdea(template)}>{template}</button>)}
      </section>

      <section className={styles.grid}>
        <form className={`${styles.card} ${styles.inputCard}`} onSubmit={build}>
          <div className={styles.cardTop}><span>01</span><strong>Define the idea</strong></div>
          <label htmlFor="idea">O que você quer criar?</label>
          <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ex.: Quero um aplicativo para uma pizzaria receber pedidos, aceitar Pix e ter painel administrativo." maxLength={2500} rows={12} />
          <div className={styles.footer}>
            <span>{idea.length}/2500</span>
            <button type="submit" disabled={loading || !idea.trim()}>{loading ? "Architecting..." : "Generate blueprint →"}</button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>

        <section className={`${styles.card} ${styles.result}`}>
          <div className={styles.resultHeader}>
            <div><p className={styles.eyebrow}>02 · BLUEPRINT</p><h2>Product architecture</h2></div>
            <span className={result ? styles.ready : styles.waiting}>{result ? "Generated" : "Waiting"}</span>
          </div>
          {loading ? <div className={styles.pipeline}><i/><i/><i/><i/><span>Structuring product</span></div> : null}
          {result ? <pre>{result}</pre> : <div className={styles.emptyState}><strong>Your blueprint will appear here.</strong><p>Next: code generation, sandbox validation and deploy orchestration.</p></div>}
        </section>
      </section>
    </main>
  );
}

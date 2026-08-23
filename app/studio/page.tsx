"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "./studio.module.css";

export default function StudioPage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function build(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = idea.trim();
    if (!clean || loading) return;

    setLoading(true);
    setError("");
    setResult("");

    const instruction = `Você é o NEYVIX Studio, um arquiteto de produto e software. Transforme a ideia abaixo em uma especificação objetiva de MVP pronta para construção. Responda em português do Brasil com: nome sugerido, proposta de valor, público, telas, fluxo principal, funcionalidades do MVP, modelo de dados, APIs/integrações, regras de segurança e plano de implementação em 5 etapas. Não invente integrações já concluídas. Ideia do usuário: ${clean}`;

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: instruction }),
      });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Falha ao gerar o projeto.");
      setResult(data.answer);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conectar ao NEYVIX Studio.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>NEYVIX STUDIO · BETA</p>
          <h1>Descreva uma ideia. Comece um produto.</h1>
          <p>O Studio usa a NEYVIX AI para transformar um prompt em uma especificação técnica de MVP.</p>
        </div>
        <Link href="/dashboard" className={styles.back}>Voltar ao painel</Link>
      </header>

      <section className={styles.grid}>
        <form className={styles.card} onSubmit={build}>
          <label htmlFor="idea">O que você quer criar?</label>
          <textarea
            id="idea"
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Ex.: Quero um aplicativo para uma pizzaria receber pedidos, aceitar Pix e ter painel administrativo."
            maxLength={2500}
            rows={12}
          />
          <div className={styles.footer}>
            <span>{idea.length}/2500</span>
            <button type="submit" disabled={loading || !idea.trim()}>{loading ? "Construindo..." : "Criar especificação"}</button>
          </div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>

        <section className={`${styles.card} ${styles.result}`}>
          <div className={styles.resultHeader}>
            <div>
              <p className={styles.eyebrow}>SAÍDA DO STUDIO</p>
              <h2>Blueprint do projeto</h2>
            </div>
            <span>{result ? "Gerado pela NEYVIX AI" : "Aguardando prompt"}</span>
          </div>
          {result ? <pre>{result}</pre> : <p className={styles.placeholder}>A especificação aparecerá aqui. A próxima etapa do Studio será gerar arquivos de código, validar em sandbox e publicar pelo NEYVIX Deploy.</p>}
        </section>
      </section>
    </main>
  );
}

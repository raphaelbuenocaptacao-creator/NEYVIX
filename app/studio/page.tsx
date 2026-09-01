"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "./studio.module.css";

const templates = ["SaaS para pequenos negócios", "App de pedidos e delivery", "Painel administrativo com IA"];

type StudioItem = { id: string; title: string; status: string; updated_at: string };

export default function StudioPage() {
  const [idea, setIdea] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<StudioItem[]>([]);
  const [deletingId, setDeletingId] = useState("");

  async function loadHistory() {
    try {
      const response = await fetch("/api/studio", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { items?: StudioItem[] };
      setHistory(data.items ?? []);
    } catch { /* histórico é complementar */ }
  }

  useEffect(() => { void loadHistory(); }, []);

  async function removeProject(item: StudioItem) {
    if (deletingId || !window.confirm(`Excluir o projeto “${item.title}”? Esta ação remove apenas este blueprint do seu histórico.`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/studio", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) throw new Error("Não foi possível excluir o projeto.");
      setHistory((current) => current.filter((project) => project.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o projeto.");
    } finally {
      setDeletingId("");
    }
  }

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
      const saved = await fetch("/api/studio", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: clean, blueprint: data.answer }) });
      if (!saved.ok) throw new Error("O blueprint foi gerado, mas não foi possível salvar no histórico.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível conectar ao NEYVIX Studio.");
    } finally { setLoading(false); }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> MOTOR DO STUDIO ATIVO</div>
        <Link href="/dashboard" className={styles.back}>Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEYVIX STUDIO · CAMADA DE CONSTRUÇÃO</p>
          <h1>Da ideia ao blueprint do produto.</h1>
          <p>Descreva o que você quer criar. O Studio organiza a ideia em produto, arquitetura, telas, dados, integrações e plano de construção.</p>
        </div>
        <div className={styles.engineOrb}><span>CRIAR</span></div>
      </section>

      <section className={styles.templateRow}>
        {templates.map((template) => <button key={template} type="button" onClick={() => setIdea(template)}>{template}</button>)}
      </section>

      <section className={styles.grid}>
        <form className={`${styles.card} ${styles.inputCard}`} onSubmit={build}>
          <div className={styles.cardTop}><span>01</span><strong>Defina a ideia</strong></div>
          <label htmlFor="idea">O que você quer criar?</label>
          <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} placeholder="Ex.: Quero um aplicativo para uma pizzaria receber pedidos, aceitar Pix e ter painel administrativo." maxLength={2500} rows={12} />
          <div className={styles.footer}>
            <span>{idea.length}/2500</span>
            <button type="submit" disabled={loading || !idea.trim()}>{loading ? "Arquitetando..." : "Gerar blueprint →"}</button>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </form>

        <section className={`${styles.card} ${styles.result}`}>
          <div className={styles.resultHeader}>
            <div><p className={styles.eyebrow}>02 · BLUEPRINT</p><h2>Arquitetura do produto</h2></div>
            <span className={result ? styles.ready : styles.waiting}>{result ? "Gerado e salvo" : "Aguardando"}</span>
          </div>
          {loading ? <div className={styles.pipeline} aria-live="polite"><i/><i/><i/><i/><span>Estruturando produto</span></div> : null}
          {result ? <pre>{result}</pre> : <div className={styles.emptyState}><strong>Seu blueprint aparecerá aqui.</strong><p>Próxima evolução: geração de código, validação em sandbox e publicação pelo NEYVIX Deploy.</p></div>}
        </section>
      </section>

      <section className={styles.historySection}>
        <div className={styles.historyHead}><div><p className={styles.eyebrow}>HISTÓRICO REAL</p><h2>Projetos recentes</h2></div><span>{history.length} salvos</span></div>
        <div className={styles.historyGrid}>{history.length ? history.map((item) => <article key={item.id} className={styles.historyCard}><small>{item.status}</small><strong>{item.title}</strong><span>{new Date(item.updated_at).toLocaleString("pt-BR")}</span><button type="button" onClick={() => void removeProject(item)} disabled={deletingId === item.id} aria-label={`Excluir ${item.title}`}>{deletingId === item.id ? "Excluindo…" : "Excluir"}</button></article>) : <p className={styles.historyEmpty}>Seus próximos blueprints salvos aparecerão aqui.</p>}</div>
      </section>
    </main>
  );
}

"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import styles from "../studio/studio.module.css";

const formats = ["Post Instagram", "Roteiro Reels", "Anúncio", "E-mail", "Página de vendas"];
type ContentItem = { id: string; kind: string; content: string; created_at: string };

export default function ContentPage() {
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState(formats[0]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [history, setHistory] = useState<ContentItem[]>([]);
  const [deletingId, setDeletingId] = useState("");

  async function loadHistory() {
    try {
      const response = await fetch("/api/content", { cache: "no-store" });
      if (!response.ok) return;
      const data = await response.json() as { items?: ContentItem[] };
      setHistory(data.items ?? []);
    } catch { /* histórico é complementar */ }
  }

  useEffect(() => { void loadHistory(); }, []);

  async function removeContent(item: ContentItem) {
    if (deletingId || !window.confirm(`Excluir este ${item.kind}? Esta ação remove apenas este item da sua biblioteca.`)) return;
    setDeletingId(item.id);
    setError("");
    try {
      const response = await fetch("/api/content", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id }),
      });
      if (!response.ok) throw new Error("Não foi possível excluir o conteúdo.");
      setHistory((current) => current.filter((content) => content.id !== item.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir o conteúdo.");
    } finally {
      setDeletingId("");
    }
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const clean = brief.trim();
    if (!clean || loading) return;
    setLoading(true); setError(""); setResult("");
    const prompt = `Você é o NEYVIX Content. Crie um ${format} em português do Brasil a partir deste briefing: ${clean}. Entregue texto pronto para uso, com título/gancho, corpo, CTA e, quando fizer sentido, hashtags. Seja persuasivo sem prometer resultados irreais.`;
    try {
      const response = await fetch("/api/ai", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) });
      const data = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok || !data.answer) throw new Error(data.error || "Falha ao gerar conteúdo.");
      setResult(data.answer);
      const saved = await fetch("/api/content", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind: format, prompt: clean, content: data.answer }) });
      if (!saved.ok) throw new Error("O conteúdo foi gerado, mas não foi possível salvar no histórico.");
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar ao NEYVIX Content.");
    } finally { setLoading(false); }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> MOTOR DE CONTEÚDO ATIVO</div>
        <Link href="/dashboard" className={styles.back}>Central de Comando</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEYVIX CONTENT · CAMADA CRIATIVA</p>
          <h1>Transforme um briefing em conteúdo pronto.</h1>
          <p>Escolha o formato, descreva a intenção e deixe a NEYVIX organizar a peça com gancho, corpo, CTA e linguagem pronta para publicação.</p>
        </div>
        <div className={styles.engineOrb}><span>CRIAR</span></div>
      </section>

      <section className={styles.templateRow}>
        {formats.map((item) => <button key={item} type="button" onClick={() => setFormat(item)}>{item}</button>)}
      </section>

      <section className={styles.grid}>
        <form className={`${styles.card} ${styles.inputCard}`} onSubmit={generate}>
          <div className={styles.cardTop}><span>01</span><strong>Defina o briefing</strong></div>
          <label htmlFor="format">Formato</label>
          <select id="format" value={format} onChange={(e) => setFormat(e.target.value)} style={{width:"100%",padding:"14px 16px",marginBottom:"16px",borderRadius:"16px",background:"rgba(2,6,12,.72)",color:"#f5f7fb",border:"1px solid rgba(255,255,255,.08)",outline:"none"}}>
            {formats.map((item)=><option key={item}>{item}</option>)}
          </select>
          <label htmlFor="brief">Briefing</label>
          <textarea id="brief" value={brief} onChange={(e)=>setBrief(e.target.value)} placeholder="Ex.: lançamento do NEYVIX, público empreendedor, tom futurista e objetivo." maxLength={2000} rows={10}/>
          <div className={styles.footer}><span>{brief.length}/2000</span><button type="submit" disabled={loading || !brief.trim()}>{loading ? "Criando..." : "Gerar conteúdo →"}</button></div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
        </form>

        <section className={`${styles.card} ${styles.result}`}>
          <div className={styles.resultHeader}>
            <div><p className={styles.eyebrow}>02 · RESULTADO</p><h2>Conteúdo pronto</h2></div>
            <span className={result ? styles.ready : styles.waiting}>{result ? `${format} · salvo` : "Aguardando"}</span>
          </div>
          {loading ? <div className={styles.pipeline} aria-live="polite"><i/><i/><i/><i/><span>Escrevendo e estruturando</span></div> : null}
          {result ? <pre>{result}</pre> : <div className={styles.emptyState}><strong>Seu conteúdo aparecerá aqui.</strong><p>Escolha um formato e envie um briefing para gerar a primeira versão.</p></div>}
        </section>
      </section>

      <section className={styles.historySection}>
        <div className={styles.historyHead}><div><p className={styles.eyebrow}>BIBLIOTECA REAL</p><h2>Conteúdos recentes</h2></div><span>{history.length} salvos</span></div>
        <div className={styles.historyGrid}>{history.length ? history.map((item) => <article key={item.id} className={styles.historyCard}><small>{item.kind}</small><strong>{item.content.slice(0, 110)}{item.content.length > 110 ? "…" : ""}</strong><span>{new Date(item.created_at).toLocaleString("pt-BR")}</span><button type="button" onClick={() => void removeContent(item)} disabled={deletingId === item.id} aria-label={`Excluir ${item.kind}`}>{deletingId === item.id ? "Excluindo…" : "Excluir"}</button></article>) : <p className={styles.historyEmpty}>Seus próximos conteúdos salvos aparecerão aqui.</p>}</div>
      </section>
    </main>
  );
}

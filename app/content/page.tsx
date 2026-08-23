"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import styles from "../studio/studio.module.css";

const formats = ["Post Instagram", "Roteiro Reels", "Anúncio", "E-mail", "Página de vendas"];

export default function ContentPage() {
  const [brief, setBrief] = useState("");
  const [format, setFormat] = useState(formats[0]);
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao conectar ao NEYVIX Content.");
    } finally { setLoading(false); }
  }

  return (
    <main className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/dashboard" className={styles.brand}>NEYVIX</Link>
        <div className={styles.status}><span/> CONTENT ENGINE READY</div>
        <Link href="/dashboard" className={styles.back}>Command Center</Link>
      </header>

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>NEYVIX CONTENT · CREATIVE LAYER</p>
          <h1>Turn one brief into ready-to-use content.</h1>
          <p>Escolha o formato, descreva a intenção e deixe a NEYVIX organizar a peça com gancho, corpo, CTA e linguagem pronta para publicação.</p>
        </div>
        <div className={styles.engineOrb}><span>CREATE</span></div>
      </section>

      <section className={styles.templateRow}>
        {formats.map((item) => <button key={item} type="button" onClick={() => setFormat(item)}>{item}</button>)}
      </section>

      <section className={styles.grid}>
        <form className={`${styles.card} ${styles.inputCard}`} onSubmit={generate}>
          <div className={styles.cardTop}><span>01</span><strong>Define the brief</strong></div>
          <label htmlFor="format">Formato</label>
          <select id="format" value={format} onChange={(e) => setFormat(e.target.value)} style={{width:"100%",padding:"14px 16px",marginBottom:"16px",borderRadius:"16px",background:"rgba(2,6,12,.72)",color:"#f5f7fb",border:"1px solid rgba(255,255,255,.08)",outline:"none"}}>
            {formats.map((item)=><option key={item}>{item}</option>)}
          </select>
          <label htmlFor="brief">Briefing</label>
          <textarea id="brief" value={brief} onChange={(e)=>setBrief(e.target.value)} placeholder="Ex.: lançamento do NEYVIX, público empreendedor, tom futurista e objetivo." maxLength={2000} rows={10}/>
          <div className={styles.footer}><span>{brief.length}/2000</span><button type="submit" disabled={loading || !brief.trim()}>{loading ? "Creating..." : "Generate content →"}</button></div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>

        <section className={`${styles.card} ${styles.result}`}>
          <div className={styles.resultHeader}>
            <div><p className={styles.eyebrow}>02 · OUTPUT</p><h2>Content ready</h2></div>
            <span className={result ? styles.ready : styles.waiting}>{result ? format : "Waiting"}</span>
          </div>
          {loading ? <div className={styles.pipeline}><i/><i/><i/><i/><span>Writing and structuring</span></div> : null}
          {result ? <pre>{result}</pre> : <div className={styles.emptyState}><strong>Your content will appear here.</strong><p>Choose a format and send a briefing to generate the first draft.</p></div>}
        </section>
      </section>
    </main>
  );
}

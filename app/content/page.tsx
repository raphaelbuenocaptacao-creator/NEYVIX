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
      <header className={styles.header}>
        <div><p className={styles.eyebrow}>NEYVIX CONTENT · BETA</p><h1>Crie conteúdo sem sair do ecossistema.</h1><p>Use a mesma NEYVIX AI para produzir peças de comunicação em segundos.</p></div>
        <Link href="/dashboard" className={styles.back}>Voltar ao painel</Link>
      </header>
      <section className={styles.grid}>
        <form className={styles.card} onSubmit={generate}>
          <label htmlFor="format">Formato</label>
          <select id="format" value={format} onChange={(e)=>setFormat(e.target.value)} style={{width:"100%",padding:"14px",marginBottom:"16px",borderRadius:"14px",background:"#080d14",color:"#f5f7fb",border:"1px solid rgba(255,255,255,.08)"}}>{formats.map((item)=><option key={item}>{item}</option>)}</select>
          <label htmlFor="brief">Briefing</label>
          <textarea id="brief" value={brief} onChange={(e)=>setBrief(e.target.value)} placeholder="Ex.: lançamento do NEYVIX, público empreendedor, tom futurista e objetivo." maxLength={2000} rows={10}/>
          <div className={styles.footer}><span>{brief.length}/2000</span><button type="submit" disabled={loading || !brief.trim()}>{loading ? "Gerando..." : "Gerar conteúdo"}</button></div>
          {error ? <p className={styles.error}>{error}</p> : null}
        </form>
        <section className={`${styles.card} ${styles.result}`}><div className={styles.resultHeader}><div><p className={styles.eyebrow}>RESULTADO</p><h2>Conteúdo pronto</h2></div><span>{result ? format : "Aguardando briefing"}</span></div>{result ? <pre>{result}</pre> : <p className={styles.placeholder}>O conteúdo gerado aparecerá aqui.</p>}</section>
      </section>
    </main>
  );
}

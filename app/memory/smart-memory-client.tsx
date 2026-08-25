"use client";

import { useState } from "react";

type Suggestion = { key: string; category: string; value: string; confidence: number; sensitive: boolean; reason: string; requiresApproval: boolean };

export default function SmartMemoryClient() {
  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);

  async function analyze() {
    setLoading(true);
    try {
      const response = await fetch("/api/memory/suggest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await response.json();
      setSuggestions(Array.isArray(data.suggestions) ? data.suggestions : []);
    } finally { setLoading(false); }
  }

  return <section className="hero" style={{ marginTop: "1.5rem" }}>
    <p className="eyebrow">MEMORY V2 · APRENDIZADO ASSISTIDO</p>
    <h2>Descobrir o que vale lembrar</h2>
    <p className="lead">Cole uma frase ou contexto. O NEYVIX identifica informações úteis, mas não salva nada automaticamente: você aprova cada memória.</p>
    <textarea value={text} onChange={(event) => setText(event.target.value)} rows={4} maxLength={4000} placeholder="Ex.: Minha empresa se chama NEYVIX e meu foco é vender SaaS para imobiliárias." />
    <div className="actions"><button className="primary-button" type="button" onClick={analyze} disabled={loading || !text.trim()}>{loading ? "Analisando..." : "Analisar memória"}</button></div>
    {suggestions.map((item) => <article key={`${item.key}-${item.value}`} style={{ marginTop: "1rem" }}>
      <span>{item.category.toUpperCase()} · {Math.round(item.confidence * 100)}% confiança{item.sensitive ? " · SENSÍVEL" : ""}</span>
      <h3>{item.key}</h3><p>{item.value}</p><p>{item.reason}</p>
      <form action="/api/memory" method="post">
        <input type="hidden" name="key" value={item.key} /><input type="hidden" name="category" value={item.category} /><input type="hidden" name="value" value={item.value} />
        <button className="primary-button" type="submit">Aprovar e lembrar</button>
      </form>
    </article>)}
    {!loading && text.trim() && suggestions.length === 0 ? <p className="lead">Nenhuma nova memória segura foi sugerida para esse texto.</p> : null}
  </section>;
}

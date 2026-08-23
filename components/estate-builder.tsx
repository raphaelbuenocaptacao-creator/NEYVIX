"use client";

import { FormEvent, useMemo, useState } from "react";

type EstateDraft = {
  brand: string;
  city: string;
  whatsapp: string;
  creci: string;
  headline: string;
  propertyTitle: string;
  propertyPrice: string;
  propertyType: string;
};

const initialDraft: EstateDraft = {
  brand: "Sua Imobiliária",
  city: "Campos do Jordão, SP",
  whatsapp: "",
  creci: "",
  headline: "Imóveis selecionados para viver e investir melhor.",
  propertyTitle: "Residência em localização privilegiada",
  propertyPrice: "R$ 1.250.000",
  propertyType: "Casa",
};

export default function EstateBuilder() {
  const [draft, setDraft] = useState(initialDraft);
  const [published, setPublished] = useState(false);

  const slug = useMemo(() => draft.brand.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "seu-site", [draft.brand]);

  function update<K extends keyof EstateDraft>(key: K, value: EstateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setPublished(false);
  }

  function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPublished(true);
  }

  return <section className="estate-builder-grid">
    <form className="estate-form" onSubmit={generate}>
      <div><p className="eyebrow">DADOS DO NEGÓCIO</p><h2>Monte sua presença digital.</h2></div>
      <label>Nome da imobiliária ou corretor<input value={draft.brand} onChange={(e) => update("brand", e.target.value)} maxLength={80} required /></label>
      <label>Cidade e região<input value={draft.city} onChange={(e) => update("city", e.target.value)} maxLength={100} required /></label>
      <div className="estate-two-cols"><label>WhatsApp<input value={draft.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} maxLength={30} placeholder="(12) 99999-9999" /></label><label>CRECI<input value={draft.creci} onChange={(e) => update("creci", e.target.value)} maxLength={30} placeholder="CRECI 000000-F" /></label></div>
      <label>Frase principal<textarea value={draft.headline} onChange={(e) => update("headline", e.target.value)} maxLength={180} /></label>
      <p className="eyebrow">PRIMEIRO IMÓVEL</p>
      <label>Título do imóvel<input value={draft.propertyTitle} onChange={(e) => update("propertyTitle", e.target.value)} maxLength={120} /></label>
      <div className="estate-two-cols"><label>Preço<input value={draft.propertyPrice} onChange={(e) => update("propertyPrice", e.target.value)} maxLength={40} /></label><label>Tipo<input value={draft.propertyType} onChange={(e) => update("propertyType", e.target.value)} maxLength={40} /></label></div>
      <button className="primary" type="submit">Gerar prévia do site</button>
      {published ? <p role="status">Prévia atualizada. Endereço planejado: <strong>{slug}.neyvix.site</strong></p> : null}
    </form>

    <div className="estate-preview-shell" aria-label="Prévia do site imobiliário">
      <div className="estate-browser-bar"><span /><span /><span /><small>{slug}.neyvix.site</small></div>
      <div className="estate-site-preview">
        <header><strong>{draft.brand}</strong><nav><span>Imóveis</span><span>Sobre</span><span>Contato</span></nav></header>
        <section className="estate-site-hero"><p>{draft.city}</p><h2>{draft.headline}</h2><button type="button">Ver imóveis</button></section>
        <section className="estate-property-card"><div className="estate-property-media"><span>FOTO DO IMÓVEL</span></div><div><small>{draft.propertyType}</small><h3>{draft.propertyTitle}</h3><strong>{draft.propertyPrice}</strong><p>{draft.city}</p></div></section>
        <footer><span>{draft.creci || "CRECI"}</span><strong>{draft.whatsapp || "WhatsApp"}</strong></footer>
      </div>
    </div>
  </section>;
}

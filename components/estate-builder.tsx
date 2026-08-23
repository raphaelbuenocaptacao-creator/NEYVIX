"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type EstateProperty = {
  title: string;
  price: string;
  propertyType: string;
  location: string;
  description: string;
  imageUrls: string[];
};

type EstateDraft = {
  brand: string;
  city: string;
  whatsapp: string;
  creci: string;
  headline: string;
  customDomain: string;
  properties: EstateProperty[];
};

type SavedSite = {
  id: string;
  brand: string;
  slug: string;
  city: string;
  status: string;
  custom_domain?: string | null;
  properties_count?: number;
  updated_at: string;
};

const blankProperty = (city = "") : EstateProperty => ({
  title: "Residência em localização privilegiada",
  price: "R$ 1.250.000",
  propertyType: "Casa",
  location: city,
  description: "",
  imageUrls: [],
});

const initialDraft: EstateDraft = {
  brand: "Sua Imobiliária",
  city: "Campos do Jordão, SP",
  whatsapp: "",
  creci: "",
  headline: "Imóveis selecionados para viver e investir melhor.",
  customDomain: "",
  properties: [blankProperty("Campos do Jordão, SP")],
};

export default function EstateBuilder() {
  const [draft, setDraft] = useState(initialDraft);
  const [savedSites, setSavedSites] = useState<SavedSite[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const slug = useMemo(() => draft.brand.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "seu-site", [draft.brand]);

  useEffect(() => {
    void fetch("/api/estate", { cache: "no-store" })
      .then(async (response) => response.ok ? response.json() as Promise<{ sites?: SavedSite[] }> : { sites: [] })
      .then((data) => setSavedSites(data.sites ?? []))
      .catch(() => undefined);
  }, []);

  function update<K extends keyof Omit<EstateDraft, "properties">>(key: K, value: EstateDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateProperty(index: number, key: keyof EstateProperty, value: string | string[]) {
    setDraft((current) => ({
      ...current,
      properties: current.properties.map((property, propertyIndex) => propertyIndex === index ? { ...property, [key]: value } : property),
    }));
  }

  function addProperty() {
    setDraft((current) => current.properties.length >= 50 ? current : ({ ...current, properties: [...current.properties, blankProperty(current.city)] }));
  }

  function removeProperty(index: number) {
    setDraft((current) => ({ ...current, properties: current.properties.filter((_, propertyIndex) => propertyIndex !== index) }));
  }

  async function save(event: FormEvent<HTMLFormElement>, status: "draft" | "published" = "draft") {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/estate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, slug, status }),
      });
      const data = await response.json() as SavedSite & { error?: string; reason?: string };
      if (!response.ok) throw new Error(data.error || "Não foi possível salvar o site");
      setMessage(status === "published" ? `Site marcado como publicado: ${slug}.neyvix.site` : "Projeto Estate salvo com sucesso.");
      const list = await fetch("/api/estate", { cache: "no-store" }).then((result) => result.ok ? result.json() as Promise<{ sites?: SavedSite[] }> : { sites: [] });
      setSavedSites(list.sites ?? []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Falha ao salvar projeto Estate");
    } finally { setBusy(false); }
  }

  const leadProperty = draft.properties[0] ?? blankProperty(draft.city);

  return <>
    <section className="estate-builder-grid">
      <form className="estate-form" onSubmit={(event) => void save(event, "draft")}>
        <div><p className="eyebrow">DADOS DO NEGÓCIO</p><h2>Monte sua presença digital.</h2></div>
        <label>Nome da imobiliária ou corretor<input value={draft.brand} onChange={(e) => update("brand", e.target.value)} maxLength={80} required /></label>
        <label>Cidade e região<input value={draft.city} onChange={(e) => update("city", e.target.value)} maxLength={100} required /></label>
        <div className="estate-two-cols"><label>WhatsApp<input value={draft.whatsapp} onChange={(e) => update("whatsapp", e.target.value)} maxLength={30} placeholder="(12) 99999-9999" /></label><label>CRECI<input value={draft.creci} onChange={(e) => update("creci", e.target.value)} maxLength={30} placeholder="CRECI 000000-F" /></label></div>
        <label>Frase principal<textarea value={draft.headline} onChange={(e) => update("headline", e.target.value)} maxLength={220} /></label>
        <label>Domínio personalizado opcional<input value={draft.customDomain} onChange={(e) => update("customDomain", e.target.value)} maxLength={200} placeholder="www.suaimobiliaria.com.br" /></label>

        <div className="estate-properties-head"><div><p className="eyebrow">IMÓVEIS</p><strong>{draft.properties.length} cadastrado(s)</strong></div><button type="button" className="secondary" onClick={addProperty}>+ Adicionar imóvel</button></div>
        {draft.properties.map((property, index) => <fieldset className="estate-property-editor" key={index}>
          <legend>Imóvel {index + 1}</legend>
          <label>Título<input value={property.title} onChange={(e) => updateProperty(index, "title", e.target.value)} maxLength={120} required /></label>
          <div className="estate-two-cols"><label>Preço<input value={property.price} onChange={(e) => updateProperty(index, "price", e.target.value)} maxLength={40} /></label><label>Tipo<input value={property.propertyType} onChange={(e) => updateProperty(index, "propertyType", e.target.value)} maxLength={40} /></label></div>
          <label>Localização<input value={property.location} onChange={(e) => updateProperty(index, "location", e.target.value)} maxLength={120} /></label>
          <label>Descrição<textarea value={property.description} onChange={(e) => updateProperty(index, "description", e.target.value)} maxLength={1200} /></label>
          <label>Fotos por URL HTTPS<textarea value={property.imageUrls.join("\n")} onChange={(e) => updateProperty(index, "imageUrls", e.target.value.split("\n").map((value) => value.trim()).filter(Boolean).slice(0, 12))} placeholder="https://...\nhttps://..." /></label>
          {draft.properties.length > 1 ? <button className="danger-link" type="button" onClick={() => removeProperty(index)}>Remover imóvel</button> : null}
        </fieldset>)}

        <div className="estate-submit-row"><button className="secondary" type="submit" disabled={busy}>{busy ? "Salvando..." : "Salvar projeto"}</button><button className="primary" type="button" disabled={busy} onClick={(event) => void save(event as unknown as FormEvent<HTMLFormElement>, "published")}>{busy ? "Publicando..." : "Publicar site"}</button></div>
        {message ? <p role="status">{message}</p> : null}
      </form>

      <div className="estate-preview-shell" aria-label="Prévia do site imobiliário">
        <div className="estate-browser-bar"><span /><span /><span /><small>{draft.customDomain || `${slug}.neyvix.site`}</small></div>
        <div className="estate-site-preview">
          <header><strong>{draft.brand}</strong><nav><span>Imóveis</span><span>Sobre</span><span>Contato</span></nav></header>
          <section className="estate-site-hero"><p>{draft.city}</p><h2>{draft.headline}</h2><button type="button">Ver imóveis</button></section>
          <section className="estate-property-card"><div className="estate-property-media" style={leadProperty.imageUrls[0] ? { backgroundImage: `linear-gradient(rgba(0,0,0,.15),rgba(0,0,0,.35)),url(${leadProperty.imageUrls[0]})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}><span>{leadProperty.imageUrls[0] ? "" : "FOTO DO IMÓVEL"}</span></div><div><small>{leadProperty.propertyType}</small><h3>{leadProperty.title}</h3><strong>{leadProperty.price}</strong><p>{leadProperty.location || draft.city}</p></div></section>
          {draft.properties.length > 1 ? <p className="estate-more-count">+ {draft.properties.length - 1} imóvel(is) no catálogo</p> : null}
          <footer><span>{draft.creci || "CRECI"}</span><strong>{draft.whatsapp || "WhatsApp"}</strong></footer>
        </div>
      </div>
    </section>

    <section className="estate-history"><div><p className="eyebrow">SEUS PROJETOS</p><h2>Sites Estate recentes</h2></div><div className="estate-history-grid">{savedSites.length ? savedSites.map((site) => <article key={site.id}><span>{site.status === "published" ? "PUBLICADO" : "RASCUNHO"}</span><h3>{site.brand}</h3><p>{site.city}</p><small>{site.custom_domain || `${site.slug}.neyvix.site`} · {site.properties_count ?? 0} imóvel(is)</small></article>) : <article><span>PRONTO</span><h3>Seu primeiro projeto aparecerá aqui</h3><p>Salve ou publique um site para criar o histórico do NEYVIX Estate.</p></article>}</div></section>
  </>;
}

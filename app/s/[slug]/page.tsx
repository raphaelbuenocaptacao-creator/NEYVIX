import { notFound } from "next/navigation";
import { getPublishedEstateSite } from "@/lib/estate-db";
import "./site.css";

export const dynamic = "force-dynamic";

export default async function EstatePublicSite({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = await getPublishedEstateSite(slug);
  if (!site) notFound();

  const whatsappDigits = site.whatsapp.replace(/\D/g, "");
  const whatsappHref = whatsappDigits ? `https://wa.me/${whatsappDigits}` : null;

  return <main className="estate-public">
    <header className="estate-public-header">
      <strong>{site.brand}</strong>
      <nav><a href="#imoveis">Imóveis</a><a href="#sobre">Sobre</a>{whatsappHref ? <a className="estate-public-cta" href={whatsappHref} target="_blank" rel="noreferrer">WhatsApp</a> : null}</nav>
    </header>

    <section className="estate-public-hero">
      <div className="estate-public-orbit" aria-hidden="true"><span>N</span></div>
      <div><p>{site.city}</p><h1>{site.headline}</h1><a href="#imoveis">Explorar imóveis</a></div>
    </section>

    <section id="imoveis" className="estate-public-section">
      <div className="estate-public-title"><p>PORTFÓLIO</p><h2>Imóveis em destaque</h2></div>
      <div className="estate-public-grid">
        {site.properties.map((property) => <article key={property.id} className="estate-public-card">
          <div className="estate-public-image" style={property.imageUrls[0] ? { backgroundImage: `linear-gradient(rgba(1,8,14,.08),rgba(1,8,14,.44)),url(${property.imageUrls[0]})` } : undefined}><span>{property.imageUrls[0] ? "" : "NEYVIX ESTATE"}</span></div>
          <div className="estate-public-card-body"><small>{property.propertyType}</small><h3>{property.title}</h3><strong>{property.price}</strong><p>{property.location}</p>{property.description ? <em>{property.description}</em> : null}{whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer">Tenho interesse ↗</a> : null}</div>
        </article>)}
      </div>
    </section>

    <section id="sobre" className="estate-public-about">
      <div><p>ATENDIMENTO</p><h2>{site.brand}</h2><span>{site.city}</span></div>
      <div><strong>{site.creci || "Atendimento imobiliário"}</strong>{whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer">Falar no WhatsApp ↗</a> : null}</div>
    </section>

    <footer className="estate-public-footer"><span>Site criado com</span><strong>NEYVIX Estate</strong></footer>
  </main>;
}

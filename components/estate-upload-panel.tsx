"use client";

import { useState } from "react";
import EstateImageUpload from "@/components/estate-image-upload";

export default function EstateUploadPanel() {
  const [url, setUrl] = useState("");
  return <section className="hero">
    <p className="eyebrow">ARMAZENAMENTO ESTATE</p>
    <h1>Envie a foto do imóvel.</h1>
    <p className="lead">JPG, PNG ou WebP, até 8 MB. A imagem é enviada ao storage configurado pelo NEYVIX e retorna uma URL HTTPS pronta para uso no site.</p>
    <EstateImageUpload onUploaded={setUrl} />
    {url ? <div className="auth-form" style={{ marginTop: "1rem" }}>
      <label>URL da imagem<input value={url} readOnly onFocus={(event) => event.currentTarget.select()} /></label>
      <p className="legal-copy">Copie esta URL e cole no campo “Fotos por URL HTTPS” do imóvel.</p>
    </div> : null}
  </section>;
}

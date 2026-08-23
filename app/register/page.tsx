import Link from "next/link";

const errors: Record<string, string> = {
  invalid: "Revise seu nome, endereço NEYVIX e use uma senha com pelo menos 8 caracteres.",
  taken: "Esse endereço NEYVIX já está em uso. Escolha outro identificador.",
  config: "O cadastro está temporariamente indisponível. A infraestrutura de identidade precisa estar conectada.",
};

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const errorMessage = params.error ? errors[params.error] : null;

  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">CRIAR NEYVIX ID</p>
        <h1>Sua identidade começa aqui.</h1>
        <p className="muted">Crie uma única conta para acessar o Mail e todo o ecossistema NEYVIX.</p>

        {errorMessage ? <p className="legal-copy" role="alert">{errorMessage}</p> : null}

        <form className="auth-form" action="/api/auth/register" method="post">
          <label>
            Nome completo
            <input type="text" name="name" placeholder="Seu nome" autoComplete="name" minLength={2} required />
          </label>
          <label>
            Endereço NEYVIX
            <div className="address-field">
              <input type="text" name="handle" placeholder="seunome" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required />
              <span>@neyvix.com</span>
            </div>
          </label>
          <label>
            Senha
            <input type="password" name="password" minLength={8} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" required />
          </label>
          <button type="submit" className="primary-button">Criar conta</button>
        </form>

        <p className="legal-copy">Quando o banco NEYVIX está conectado, sua conta é persistida no PostgreSQL. Ambientes de prévia sem banco usam uma identidade temporária assinada e protegida no navegador.</p>
        <div className="auth-links"><Link href="/login">Já tenho um NEYVIX ID</Link></div>
      </section>
    </main>
  );
}

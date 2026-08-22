import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">CREATE NEYVIX ID</p>
        <h1>Your identity starts here.</h1>
        <p className="muted">Create one account for NEYVIX Mail and every future NEYVIX product.</p>

        <form className="auth-form" action="/api/auth/register" method="post">
          <label>
            Full name
            <input type="text" name="name" placeholder="Your name" autoComplete="name" minLength={2} required />
          </label>
          <label>
            NEYVIX address
            <div className="address-field">
              <input type="text" name="handle" placeholder="yourname" autoComplete="username" minLength={3} maxLength={32} pattern="[A-Za-z0-9][A-Za-z0-9._-]{2,31}" required />
              <span>@neyvix.com</span>
            </div>
          </label>
          <label>
            Password
            <input type="password" name="password" minLength={8} placeholder="Minimum 8 characters" autoComplete="new-password" required />
          </label>
          <button type="submit" className="primary-button">Create account</button>
        </form>

        <p className="legal-copy">Preview identity is stored in a signed, HttpOnly browser cookie until the dedicated NEYVIX database is provisioned.</p>
        <div className="auth-links"><Link href="/login">I already have a NEYVIX ID</Link></div>
      </section>
    </main>
  );
}

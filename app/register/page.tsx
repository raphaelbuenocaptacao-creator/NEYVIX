import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">CREATE NEYVIX ID</p>
        <h1>Your identity starts here.</h1>
        <p className="muted">Create one account for NEYVIX Mail and every future NEYVIX product.</p>

        <form className="auth-form">
          <label>
            Full name
            <input type="text" name="name" placeholder="Your name" autoComplete="name" required />
          </label>
          <label>
            NEYVIX address
            <div className="address-field">
              <input type="text" name="handle" placeholder="yourname" autoComplete="username" required />
              <span>@neyvix.com</span>
            </div>
          </label>
          <label>
            Password
            <input type="password" name="password" minLength={8} placeholder="Minimum 8 characters" autoComplete="new-password" required />
          </label>
          <button type="submit" className="primary-button">Create account</button>
        </form>

        <p className="legal-copy">By creating an account, you agree to the future NEYVIX Terms and Privacy Policy.</p>
        <div className="auth-links"><Link href="/login">I already have a NEYVIX ID</Link></div>
      </section>
    </main>
  );
}

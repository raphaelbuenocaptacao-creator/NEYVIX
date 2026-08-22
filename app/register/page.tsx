import Link from "next/link";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">ZYVO</Link>
        <p className="eyebrow">CREATE ZYVO ID</p>
        <h1>Your account starts here.</h1>
        <p className="muted">Create one identity for ZYVO Mail and every future ZYVO product.</p>

        <form className="auth-form">
          <label>
            Full name
            <input type="text" name="name" placeholder="Your name" autoComplete="name" />
          </label>
          <label>
            ZYVO address
            <div className="address-field">
              <input type="text" name="handle" placeholder="yourname" autoComplete="username" />
              <span>@zyvo.com</span>
            </div>
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="Minimum 8 characters" autoComplete="new-password" />
          </label>
          <button type="submit" className="primary-button">Create account</button>
        </form>

        <p className="legal-copy">By creating an account, you agree to the future ZYVO Terms and Privacy Policy.</p>
        <div className="auth-links"><Link href="/login">I already have a ZYVO ID</Link></div>
      </section>
    </main>
  );
}

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">NEYVIX</Link>
        <p className="eyebrow">NEYVIX ID</p>
        <h1>Welcome back.</h1>
        <p className="muted">One identity for Mail and the entire NEYVIX ecosystem.</p>

        <form className="auth-form">
          <label>
            Email
            <input type="email" name="email" placeholder="you@neyvix.com" autoComplete="email" required />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" required />
          </label>
          <button type="submit" className="primary-button">Continue</button>
        </form>

        <div className="auth-links">
          <a href="#">Forgot password?</a>
          <span>·</span>
          <Link href="/register">Create NEYVIX ID</Link>
        </div>
      </section>
    </main>
  );
}

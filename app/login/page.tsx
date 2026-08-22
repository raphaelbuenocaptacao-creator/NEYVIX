import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <Link href="/" className="brand">ZYVO</Link>
        <p className="eyebrow">ZYVO ID</p>
        <h1>Welcome back.</h1>
        <p className="muted">One account for your mail and the entire ZYVO ecosystem.</p>

        <form className="auth-form">
          <label>
            Email
            <input type="email" name="email" placeholder="you@zyvo.com" autoComplete="email" />
          </label>
          <label>
            Password
            <input type="password" name="password" placeholder="••••••••" autoComplete="current-password" />
          </label>
          <button type="submit" className="primary-button">Continue</button>
        </form>

        <div className="auth-links">
          <a href="#">Forgot password?</a>
          <span>·</span>
          <Link href="/register">Create ZYVO ID</Link>
        </div>
      </section>
    </main>
  );
}

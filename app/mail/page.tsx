const inbox = [
  { sender: "NEYVIX", subject: "Welcome to NEYVIX Mail", preview: "Your inbox is ready. This is the beginning of your connected digital world.", time: "09:42" },
  { sender: "Security", subject: "Protect your NEYVIX ID", preview: "Add recovery methods and review recent devices.", time: "Yesterday" },
  { sender: "NEYVIX AI", subject: "Meet your future mail assistant", preview: "Summaries, smart replies and search will live directly inside your inbox.", time: "Aug 20" },
];

export default function MailPage() {
  return (
    <main className="mail-app">
      <aside className="mail-sidebar">
        <div className="mail-brand">NEYVIX <span>Mail</span></div>
        <button className="compose-button">＋ Compose</button>
        <nav>
          <a className="active" href="#">Inbox <strong>3</strong></a>
          <a href="#">Starred</a>
          <a href="#">Sent</a>
          <a href="#">Drafts</a>
          <a href="#">Spam</a>
          <a href="#">Trash</a>
        </nav>
        <div className="sidebar-footer">NEYVIX ID<br/><span>demo@neyvix.com</span></div>
      </aside>

      <section className="mail-main">
        <header className="mail-topbar">
          <div>
            <p className="eyebrow">INBOX</p>
            <h1>Good morning.</h1>
          </div>
          <div className="search-box">⌕ Search mail</div>
        </header>

        <div className="mail-toolbar">
          <button>Refresh</button><button>Mark read</button><button>Archive</button>
        </div>

        <div className="message-list">
          {inbox.map((mail) => (
            <article className="message-row" key={mail.subject}>
              <input aria-label={`Select ${mail.subject}`} type="checkbox" />
              <span className="star">☆</span>
              <div className="message-sender">{mail.sender}</div>
              <div className="message-content"><strong>{mail.subject}</strong><span> — {mail.preview}</span></div>
              <time>{mail.time}</time>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

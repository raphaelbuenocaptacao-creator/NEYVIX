import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getProductAccess } from "@/lib/product-access";
import { listMailMessages, type MailFolder, type MailListItem } from "@/lib/mail-db";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

const mailErrors: Record<string, string> = {
  invalid_message: "Revise destinatário, assunto e mensagem.",
  transport_unavailable: "O transporte externo do NEYVIX Mail ainda não foi conectado.",
  send_failed: "Não foi possível entregar a mensagem agora. Tente novamente.",
};

export default async function MailPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; folder?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/mail");

  const access = await getProductAccess(session.email, "mail");
  if (!access.allowed) redirect("/plans?required=business&feature=mail");

  const folder: MailFolder = params.folder === "sent" ? "sent" : "inbox";
  let messages: MailListItem[] = [];
  let databaseReady = true;
  try { messages = await listMailMessages(session.email, 30, folder); } catch (error) {
    databaseReady = false;
    console.error("Falha ao carregar pasta do NEYVIX Mail", error);
  }

  const unread = folder === "inbox" ? messages.filter((message) => !message.isRead).length : 0;
  const notice = params.sent === "1" ? "Mensagem enviada e registrada no NEYVIX Mail." : params.error ? mailErrors[params.error] : null;
  const folderTitle = folder === "sent" ? "Enviados" : "Caixa de entrada";

  return (
    <main className="mail-app">
      <aside className="mail-sidebar">
        <div className="mail-brand">NEYVIX <span>Mail</span></div>
        <a className="compose-button" href="#compose">＋ Escrever</a>
        <nav>
          <a className={folder === "inbox" ? "active" : ""} href="/mail?folder=inbox">Caixa de entrada <strong>{unread}</strong></a>
          <a className={folder === "sent" ? "active" : ""} href="/mail?folder=sent">Enviados</a>
          <a href="#compose">Rascunhos</a>
        </nav>
        <div className="sidebar-footer">NEYVIX ID<br/><span>{session.email}</span></div>
      </aside>

      <section className="mail-main">
        <header className="mail-topbar">
          <div><p className="eyebrow">NEYVIX MAIL · {folderTitle.toUpperCase()}</p><h1>Olá, {session.name}.</h1></div>
          <div className="search-box">⌕ Buscar e-mails</div>
        </header>

        {notice ? <div className="mail-toolbar"><strong>{notice}</strong></div> : null}

        <section id="compose" className="hero" style={{ margin: "1rem 0" }}>
          <p className="eyebrow">NOVA MENSAGEM</p>
          <form className="auth-form" action="/api/mail/send" method="post">
            <label>Para<input type="email" name="to" placeholder="cliente@empresa.com" required /></label>
            <label>Assunto<input type="text" name="subject" maxLength={240} placeholder="Assunto" required /></label>
            <label>Mensagem<textarea name="text" rows={6} maxLength={20000} placeholder="Escreva sua mensagem..." required /></label>
            <button className="primary-button" type="submit">Enviar com NEYVIX Mail</button>
          </form>
        </section>

        <div className="mail-toolbar"><a href={`/mail?folder=${folder}`}>Atualizar</a><span>{databaseReady ? `${folderTitle} sincronizada` : "Persistência aguardando banco"}</span></div>

        <div id="inbox" className="message-list">
          {messages.length > 0 ? messages.map((mail) => (
            <article className="message-row" key={mail.id}>
              <input aria-label={`Selecionar ${mail.subject}`} type="checkbox" disabled />
              <span className="star">{mail.isStarred ? "★" : "☆"}</span>
              <div className="message-sender">{mail.sender}</div>
              <div className="message-content"><strong>{mail.subject}</strong><span> — {mail.preview}</span></div>
              <time dateTime={mail.occurredAt}>{formatWhen(mail.occurredAt)}</time>
            </article>
          )) : (
            <article className="message-row">
              <span className="star">N</span><div className="message-sender">NEYVIX Mail</div>
              <div className="message-content"><strong>{databaseReady ? `${folderTitle} pronta` : "Mail aguardando a base de dados"}</strong><span> — {databaseReady ? (folder === "sent" ? "Suas mensagens enviadas aparecerão aqui." : "Mensagens recebidas aparecerão aqui quando o transporte de entrada estiver conectado.") : "A interface retomará automaticamente quando a persistência estiver disponível."}</span></div><time>Agora</time>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

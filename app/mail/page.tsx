import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listMailMessages, type MailListItem } from "@/lib/mail-db";

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

export default async function MailPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  let session = null;
  try { session = readSession(store.get(SESSION_COOKIE)?.value); } catch { session = null; }
  if (!session) redirect("/login?next=/mail");

  let inbox: MailListItem[] = [];
  let databaseReady = true;
  try { inbox = await listMailMessages(session.email, 30); } catch (error) {
    databaseReady = false;
    console.error("Falha ao carregar a caixa de entrada do NEYVIX Mail", error);
  }

  const unread = inbox.filter((message) => !message.isRead).length;
  const notice = params.sent === "1" ? "Mensagem enviada e registrada no NEYVIX Mail." : params.error ? mailErrors[params.error] : null;

  return (
    <main className="mail-app">
      <aside className="mail-sidebar">
        <div className="mail-brand">NEYVIX <span>Mail</span></div>
        <a className="compose-button" href="#compose">＋ Escrever</a>
        <nav>
          <a className="active" href="#inbox">Caixa de entrada <strong>{unread}</strong></a>
          <a href="#inbox">Com estrela</a><a href="#inbox">Enviados</a><a href="#compose">Rascunhos</a><a href="#inbox">Spam</a><a href="#inbox">Lixeira</a>
        </nav>
        <div className="sidebar-footer">NEYVIX ID<br/><span>{session.email}</span></div>
      </aside>

      <section className="mail-main">
        <header className="mail-topbar">
          <div><p className="eyebrow">NEYVIX MAIL</p><h1>Olá, {session.name}.</h1></div>
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

        <div className="mail-toolbar"><a href="/mail">Atualizar</a><span>{databaseReady ? "Caixa sincronizada" : "Persistência aguardando banco"}</span></div>

        <div id="inbox" className="message-list">
          {inbox.length > 0 ? inbox.map((mail) => (
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
              <div className="message-content"><strong>{databaseReady ? "Sua caixa de entrada está pronta" : "Mail aguardando a base de dados"}</strong><span> — {databaseReady ? "Mensagens recebidas aparecerão aqui quando o transporte de entrada estiver conectado." : "A interface retomará automaticamente quando a persistência estiver disponível."}</span></div><time>Agora</time>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

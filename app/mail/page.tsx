import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, readSession } from "@/lib/auth";
import { listMailMessages, type MailListItem } from "@/lib/mail-db";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();

  if (sameDay) {
    return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  }

  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

export default async function MailPage() {
  const store = await cookies();
  let session = null;
  try {
    session = readSession(store.get(SESSION_COOKIE)?.value);
  } catch {
    session = null;
  }

  if (!session) redirect("/login");

  let inbox: MailListItem[] = [];
  let databaseReady = true;
  try {
    inbox = await listMailMessages(session.email, 30);
  } catch (error) {
    databaseReady = false;
    console.error("Falha ao carregar a caixa de entrada do NEYVIX Mail", error);
  }

  const unread = inbox.filter((message) => !message.isRead).length;

  return (
    <main className="mail-app">
      <aside className="mail-sidebar">
        <div className="mail-brand">NEYVIX <span>Mail</span></div>
        <button className="compose-button" type="button" disabled title="Envio externo será habilitado após a configuração do provedor de e-mail">＋ Escrever</button>
        <nav>
          <a className="active" href="#inbox">Caixa de entrada <strong>{unread}</strong></a>
          <a href="#inbox">Com estrela</a>
          <a href="#inbox">Enviados</a>
          <a href="#inbox">Rascunhos</a>
          <a href="#inbox">Spam</a>
          <a href="#inbox">Lixeira</a>
        </nav>
        <div className="sidebar-footer">NEYVIX ID<br/><span>{session.email}</span></div>
      </aside>

      <section className="mail-main">
        <header className="mail-topbar">
          <div>
            <p className="eyebrow">CAIXA DE ENTRADA</p>
            <h1>Olá, {session.name}.</h1>
          </div>
          <div className="search-box">⌕ Buscar e-mails</div>
        </header>

        <div className="mail-toolbar">
          <a href="/mail">Atualizar</a><button type="button" disabled>Marcar como lido</button><button type="button" disabled>Arquivar</button>
        </div>

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
              <span className="star">N</span>
              <div className="message-sender">NEYVIX Mail</div>
              <div className="message-content">
                <strong>{databaseReady ? "Sua caixa de entrada está pronta" : "Mail aguardando a base de dados"}</strong>
                <span> — {databaseReady ? "Novas mensagens aparecerão aqui quando a camada de entrega estiver conectada." : "A interface está protegida e preparada para retomar assim que a persistência estiver disponível."}</span>
              </div>
              <time>Agora</time>
            </article>
          )}
        </div>
      </section>
    </main>
  );
}

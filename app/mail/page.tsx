import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "@/lib/auth";
import { readActiveSession } from "@/lib/session";
import { getProductAccess } from "@/lib/product-access";
import { listMailMessages, type MailFolder, type MailListItem } from "@/lib/mail-db";
import { getOwnedFailedMailRetryDraft, getOwnedMailOutboxStatus } from "@/lib/mail-outbox-db";

function formatWhen(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay = date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  if (sameDay) return new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit" }).format(date);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(date);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const mailErrors: Record<string, string> = {
  invalid_message: "Revise destinatário, assunto e mensagem.",
  transport_unavailable: "O transporte externo do NEYVIX Mail ainda não foi conectado.",
  send_failed: "Não foi possível entregar a mensagem agora. Tente novamente.",
  send_persist_unavailable: "O NEYVIX Mail não conseguiu reservar a mensagem com segurança. Nada foi enviado.",
  delivery_unknown: "A entrega foi iniciada, mas a confirmação final ficou pendente. O NEYVIX não reenviará automaticamente para evitar duplicidade.",
  sent_persist_failed: "A entrega pode ter ocorrido, mas a confirmação no histórico falhou. Verifique Enviados antes de tentar novamente.",
};

function statusLabel(message: MailListItem) {
  if (message.status === "pending") return "Pendente";
  if (message.status === "failed") return "Falhou";
  return null;
}

function reconciliationLabel(status?: string | null) {
  if (status === "sent") return "Entrega confirmada. A mensagem está registrada como enviada.";
  if (status === "failed") return "A entrega falhou de forma confirmada. Uma nova tentativa manual é permitida.";
  if (status === "pending") return "Entrega ainda sem confirmação. O NEYVIX não reenviará automaticamente para evitar duplicidade.";
  return null;
}

export default async function MailPage({ searchParams }: { searchParams: Promise<{ error?: string; sent?: string; folder?: string; reconcile?: string; retry?: string }> }) {
  const params = await searchParams;
  const store = await cookies();
  const session = await readActiveSession(store.get(SESSION_COOKIE)?.value);
  if (!session) redirect("/login?next=/mail");

  const access = await getProductAccess(session.email, "mail");
  if (!access.allowed) redirect("/plans?required=business&feature=mail");

  const folder: MailFolder = params.folder === "sent" ? "sent" : "inbox";
  let sendToken = randomUUID();
  let retryDraft: Awaited<ReturnType<typeof getOwnedFailedMailRetryDraft>> = null;
  if (params.retry && UUID_RE.test(params.retry)) {
    try {
      retryDraft = await getOwnedFailedMailRetryDraft(session.email, params.retry);
      if (retryDraft) sendToken = retryDraft.idempotencyKey;
    } catch (error) {
      console.error("Falha ao carregar tentativa manual do NEYVIX Mail", error);
    }
  }

  let messages: MailListItem[] = [];
  let databaseReady = true;
  try { messages = await listMailMessages(session.email, 30, folder); } catch (error) {
    databaseReady = false;
    console.error("Falha ao carregar pasta do NEYVIX Mail", error);
  }

  let reconciliationNotice: string | null = null;
  if (folder === "sent" && params.reconcile && UUID_RE.test(params.reconcile)) {
    try {
      const reconciled = await getOwnedMailOutboxStatus(session.email, params.reconcile);
      reconciliationNotice = reconciled
        ? reconciliationLabel(reconciled.status)
        : "Não foi possível localizar essa mensagem na sua caixa de enviados.";
    } catch (error) {
      console.error("Falha ao reconciliar mensagem no NEYVIX Mail", error);
      reconciliationNotice = "Não foi possível verificar a entrega agora. Nenhum reenvio foi realizado.";
    }
  } else if (params.reconcile) {
    reconciliationNotice = "Não foi possível verificar essa referência de mensagem.";
  }

  const unread = folder === "inbox" ? messages.filter((message) => !message.isRead).length : 0;
  const retryNotice = params.retry
    ? retryDraft
      ? "Tentativa manual preparada com a mesma chave de idempotência. Revise e envie somente se desejar tentar novamente."
      : "Não foi possível preparar essa tentativa. Apenas mensagens com falha confirmada podem ser reenviadas."
    : null;
  const notice = reconciliationNotice ?? retryNotice ?? (params.sent === "1" ? "Mensagem enviada e registrada no NEYVIX Mail." : params.error ? mailErrors[params.error] : null);
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
          <p className="eyebrow">{retryDraft ? "REPETIR ENVIO COM SEGURANÇA" : "NOVA MENSAGEM"}</p>
          <form className="auth-form" action="/api/mail/send" method="post">
            <input type="hidden" name="idempotency_key" value={sendToken} />
            <label>Para<input type="email" name="to" defaultValue={retryDraft?.to ?? ""} placeholder="cliente@empresa.com" required /></label>
            <label>Assunto<input type="text" name="subject" maxLength={240} defaultValue={retryDraft?.subject ?? ""} placeholder="Assunto" required /></label>
            <label>Mensagem<textarea name="text" rows={6} maxLength={20000} defaultValue={retryDraft?.text ?? ""} placeholder="Escreva sua mensagem..." required /></label>
            <button className="primary-button" type="submit">{retryDraft ? "Tentar novamente" : "Enviar com NEYVIX Mail"}</button>
          </form>
        </section>

        <div className="mail-toolbar"><a href={`/mail?folder=${folder}`}>Atualizar</a><span>{databaseReady ? `${folderTitle} sincronizada` : "Persistência aguardando banco"}</span></div>

        <div id="inbox" className="message-list">
          {messages.length > 0 ? messages.map((mail) => {
            const deliveryStatus = statusLabel(mail);
            return (
              <article className="message-row" key={mail.id}>
                <input aria-label={`Selecionar ${mail.subject}`} type="checkbox" disabled />
                <span className="star">{mail.isStarred ? "★" : "☆"}</span>
                <div className="message-sender">{mail.sender}</div>
                <div className="message-content">
                  <strong>{deliveryStatus ? `[${deliveryStatus}] ${mail.subject}` : mail.subject}</strong>
                  <span> — {mail.preview}</span>
                  {folder === "sent" && mail.status === "pending" ? <span> · <a href={`/mail?folder=sent&reconcile=${encodeURIComponent(mail.id)}`}>Verificar entrega</a></span> : null}
                  {folder === "sent" && mail.status === "failed" ? <span> · <a href={`/mail?folder=sent&retry=${encodeURIComponent(mail.id)}#compose`}>Tentar novamente</a></span> : null}
                </div>
                <time dateTime={mail.occurredAt}>{formatWhen(mail.occurredAt)}</time>
              </article>
            );
          }) : (
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

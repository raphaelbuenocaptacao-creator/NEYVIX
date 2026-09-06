export type MailTransportMessage = {
  from: string;
  to: string;
  subject: string;
  text: string;
};

export type MailTransportStatus = {
  configured: boolean;
  valid: boolean;
  ready: boolean;
  provider: "webhook" | "resend" | null;
  reason: "ready" | "transport_not_configured" | "transport_invalid";
};

const MAIL_TIMEOUT_MS = 15_000;
const RESEND_ENDPOINT = "https://api.resend.com/emails";

function webhookTransport() {
  const endpoint = process.env.MAIL_TRANSPORT_URL?.trim();
  const secret = process.env.MAIL_TRANSPORT_SECRET?.trim();
  if (!endpoint || !secret) return null;

  try {
    const url = new URL(endpoint);
    return { endpoint, secret, valid: url.protocol === "https:" };
  } catch {
    return { endpoint, secret, valid: false };
  }
}

function validFromAddress(value: string) {
  return /^(?:[^<>\r\n]+\s*)?<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>$/.test(value)
    || /^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(value);
}

function resendTransport() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  const from = process.env.MAIL_FROM_ADDRESS?.trim() ?? "";
  return { apiKey, from, valid: validFromAddress(from) };
}

export function getMailTransportStatus(): MailTransportStatus {
  const webhook = webhookTransport();
  if (webhook) {
    return {
      configured: true,
      valid: webhook.valid,
      ready: webhook.valid,
      provider: "webhook",
      reason: webhook.valid ? "ready" : "transport_invalid",
    };
  }

  const resend = resendTransport();
  if (resend) {
    return {
      configured: true,
      valid: resend.valid,
      ready: resend.valid,
      provider: "resend",
      reason: resend.valid ? "ready" : "transport_invalid",
    };
  }

  return {
    configured: false,
    valid: false,
    ready: false,
    provider: null,
    reason: "transport_not_configured",
  };
}

function providerMessageId(data: unknown) {
  if (!data || typeof data !== "object") return null;
  const value = data as { id?: unknown; messageId?: unknown };
  if (typeof value.id === "string") return value.id.slice(0, 240);
  if (typeof value.messageId === "string") return value.messageId.slice(0, 240);
  return null;
}

async function postMail(url: string, headers: Record<string, string>, body: unknown) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      return { ok: false as const, reason: "transport_rejected" as const, status: response.status, retrySafe: true as const };
    }
    const data = await response.json().catch(() => ({}));
    return { ok: true as const, providerMessageId: providerMessageId(data) };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return {
      ok: false as const,
      reason: timedOut ? "transport_timeout" as const : "transport_unknown" as const,
      retrySafe: false as const,
    };
  } finally {
    clearTimeout(timeout);
  }
}

export async function deliverMail(message: MailTransportMessage) {
  const webhook = webhookTransport();
  if (webhook?.valid) {
    return postMail(
      webhook.endpoint,
      {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${webhook.secret}`,
        "X-NEYVIX-Source": "mail",
      },
      message,
    );
  }

  const resend = resendTransport();
  if (resend?.valid) {
    return postMail(
      RESEND_ENDPOINT,
      {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${resend.apiKey}`,
        "X-Entity-Ref-ID": "neyvix-mail",
      },
      {
        from: resend.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      },
    );
  }

  return {
    ok: false as const,
    reason: webhook || resend ? "transport_invalid" as const : "transport_not_configured" as const,
    retrySafe: true as const,
  };
}

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
  reason: "ready" | "transport_not_configured" | "transport_invalid";
};

const MAIL_TIMEOUT_MS = 15_000;

export function getMailTransportStatus(): MailTransportStatus {
  const endpoint = process.env.MAIL_TRANSPORT_URL?.trim();
  const secret = process.env.MAIL_TRANSPORT_SECRET?.trim();

  if (!endpoint || !secret) {
    return {
      configured: false,
      valid: false,
      ready: false,
      reason: "transport_not_configured",
    };
  }

  try {
    const url = new URL(endpoint);
    const valid = url.protocol === "https:";
    return {
      configured: true,
      valid,
      ready: valid,
      reason: valid ? "ready" : "transport_invalid",
    };
  } catch {
    return {
      configured: true,
      valid: false,
      ready: false,
      reason: "transport_invalid",
    };
  }
}

export async function deliverMail(message: MailTransportMessage) {
  const endpoint = process.env.MAIL_TRANSPORT_URL?.trim();
  const secret = process.env.MAIL_TRANSPORT_SECRET?.trim();
  const transport = getMailTransportStatus();

  if (!transport.ready || !endpoint || !secret) {
    return { ok: false as const, reason: transport.reason };
  }

  const url = new URL(endpoint);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAIL_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${secret}`,
        "X-NEYVIX-Source": "mail",
      },
      body: JSON.stringify(message),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) return { ok: false as const, reason: "transport_failed", status: response.status };
    const data = await response.json().catch(() => ({})) as { id?: string; messageId?: string };
    const providerMessageId = typeof data.id === "string"
      ? data.id.slice(0, 240)
      : typeof data.messageId === "string"
        ? data.messageId.slice(0, 240)
        : null;
    return { ok: true as const, providerMessageId };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { ok: false as const, reason: timedOut ? "transport_timeout" : "transport_failed" };
  } finally {
    clearTimeout(timeout);
  }
}
